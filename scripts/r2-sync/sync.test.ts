import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { scanMedia } from './local';
import { createPlan, synchronize } from './sync';
import type { LocalMedia, RemoteMedia, R2Store, SyncFailure } from './types';

const album = '2026-10-sequence01-测试';
const signal = new AbortController().signal;
const folders: string[] = [];
afterEach(async () => { await Promise.all(folders.splice(0).map(folder => rm(folder, { recursive: true, force: true }))); });
async function fixture(names = ['new.jpg']) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'r2-sync-'))); folders.push(root);
  await mkdir(join(root, album));
  for (const name of names) await writeFile(join(root, album, name), name);
  return { root, local: await scanMedia(root, signal) };
}
function remote(file: LocalMedia): RemoteMedia {
  return { key: file.key, size: file.size, etag: file.md5Hex, lastModified: '2026-10-09T00:00:00.000Z' };
}
class MemoryStore implements R2Store {
  objects = new Map<string, RemoteMedia>();
  heads: string[] = []; puts: string[] = []; removes: string[] = []; lists = 0;
  metadata = new Map<string, string>();
  beforePut?: (file: LocalMedia) => Promise<void>;
  beforeList?: (index: number) => void;
  failedKey?: string;
  wrongEtag = false;
  async list() { this.beforeList?.(++this.lists); return new Map(this.objects); }
  async headMd5(key: string) { this.heads.push(key); return this.metadata.get(key); }
  async put(file: LocalMedia) {
    this.puts.push(file.key); await this.beforePut?.(file);
    if (file.key === this.failedKey) throw new Error('sample-secret-not-for-report');
    this.objects.set(file.key, remote(file)); return this.wrongEtag ? 'a'.repeat(32) : file.md5Hex;
  }
  async remove(objects: RemoteMedia[]): Promise<SyncFailure[]> { for (const object of objects) { this.removes.push(object.key); this.objects.delete(object.key); } return []; }
  close() {}
}
const old: RemoteMedia = { key: `media/${album}/old.jpg`, size: 3, etag: '0'.repeat(32), lastModified: '2026-10-09T00:00:00.000Z' };
const checkpoint = async () => {};
describe('incremental mirror execution', () => {
  it('compares 10000 ordinary objects without HEAD, filtering plans in linear maps', async () => {
    const { root, local } = await fixture();
    const file = [...local.values()][0]; const many = new Map<string, LocalMedia>();
    for (let n = 0; n < 10000; n++) { const key = `media/${album}/${n}.jpg`; many.set(key, { ...file, key }); }
    const store = new MemoryStore();
    for (const item of many.values()) store.objects.set(item.key, remote(item));
    const plan = createPlan(many, store.objects);
    expect(plan.skipped).toHaveLength(10000); expect(plan.uploads).toHaveLength(0);
    // Actual filesystem snapshot stays small; real execution also makes no HEAD calls.
    store.objects = new Map([...local.values()].map(item => [item.key, remote(item)]));
    const result = await synchronize(root, local, store, signal, { checkpoint });
    expect(result.failures).toEqual([]); expect(store.heads).toEqual([]);
  });
  it('uploads before removing historical assets, then reruns with zero uploads', async () => {
    const { root, local } = await fixture(['new.jpg', '电影.MP4']); const store = new MemoryStore();
    store.objects.set(old.key, old);
    store.beforePut = async () => { expect(store.removes).toEqual([]); };
    const first = await synchronize(root, local, store, signal, { checkpoint });
    expect(first.failures).toEqual([]); expect(first.uploaded).toHaveLength(2); expect(first.deleted).toEqual([old.key]);
    store.puts = [];
    const second = await synchronize(root, local, store, signal, { checkpoint });
    expect(second.uploaded).toEqual([]); expect(second.skipped).toHaveLength(2); expect(store.puts).toEqual([]);
  });
  it('only confirms non-MD5 ETags and reuploads missing metadata', async () => {
    const { root, local } = await fixture(['a.jpg', 'b.jpg', 'c.jpg']); const store = new MemoryStore();
    const [a, b, c] = [...local.values()];
    store.objects.set(a.key, { ...remote(a), etag: `"${a.md5Hex.toUpperCase()}"` });
    store.objects.set(b.key, { ...remote(b), etag: 'opaque-3' }); store.metadata.set(b.key, b.md5Hex);
    store.objects.set(c.key, { ...remote(c), etag: 'opaque-2' });
    const result = await synchronize(root, local, store, signal, { checkpoint });
    expect(result.failures).toEqual([]); expect(new Set(store.heads)).toEqual(new Set([b.key, c.key])); expect(store.puts).toEqual([c.key]);
  });
  it('keeps successful uploads on failure and rerun repairs only the failed file', async () => {
    const { root, local } = await fixture(['a.jpg', 'b.jpg']); const store = new MemoryStore();
    store.objects.set(old.key, old); store.failedKey = [...local.keys()][0];
    const first = await synchronize(root, local, store, signal, { checkpoint });
    expect(first.uploaded).toHaveLength(1); expect(first.failures).toHaveLength(1); expect(store.removes).toEqual([]);
    expect(JSON.stringify(first)).not.toContain('sample-secret');
    store.failedKey = undefined; store.puts = [];
    const second = await synchronize(root, local, store, signal, { checkpoint });
    expect(second.failures).toEqual([]); expect(store.puts).toHaveLength(1); expect(second.deleted).toEqual([old.key]);
  });
  it('does not delete on incorrect returned checksum or initial report failure', async () => {
    const { root, local } = await fixture(); const store = new MemoryStore(); store.objects.set(old.key, old); store.wrongEtag = true;
    const wrong = await synchronize(root, local, store, signal, { checkpoint });
    expect(wrong.failures[0].code).toBe('CHECKSUM_MISMATCH'); expect(store.removes).toEqual([]);
    store.objects = new Map([[old.key, old]]); store.puts = [];
    const reportFailed = await synchronize(root, local, store, signal, { checkpoint: async () => { throw new Error('secret'); } });
    expect(reportFailed.failures[0].code).toBe('REPORT_FAILED'); expect(store.puts).toEqual([]);
  });
  it('refuses local additions or remote rewrites before delete', async () => {
    for (const kind of ['local', 'remote']) {
      const { root, local } = await fixture(); const store = new MemoryStore(); store.objects.set(old.key, old);
      if (kind === 'local') store.beforePut = async () => { await writeFile(join(root, album, 'new-arrival.jpg'), 'arrival'); };
      else store.beforeList = index => { if (index === 2) store.objects.set(old.key, { ...old, lastModified: '2026-10-09T01:00:00.000Z' }); };
      const result = await synchronize(root, local, store, signal, { checkpoint });
      expect(result.failures[0].code).toBe(kind === 'local' ? 'LOCAL_CHANGED' : 'REMOTE_CHANGED'); expect(store.removes).toEqual([]);
    }
  });
  it('mirrors a validated empty local directory and an entirely removed album', async () => {
    const { root, local } = await fixture([]); const store = new MemoryStore(); store.objects.set(old.key, old);
    const result = await synchronize(root, local, store, signal, { checkpoint });
    expect(result.failures).toEqual([]); expect(result.deleted).toEqual([old.key]); expect(store.objects.size).toBe(0);
  });
  it('reports acknowledged deletes before a later failed batch and reruns the remainder', async () => {
    const { root, local } = await fixture([]); const store = new MemoryStore();
    for (let n = 0; n < 1001; n++) { const object = { ...old, key: `media/${album}/old-${n}.jpg` }; store.objects.set(object.key, object); }
    const remove = store.remove.bind(store);
    store.remove = async objects => {
      await remove(objects.slice(0, 1000));
      return objects.slice(1000).map(object => ({ key: object.key, phase: 'delete', code: 'ServiceUnavailable' }));
    };
    const first = await synchronize(root, local, store, signal, { checkpoint });
    expect(first.deleted).toHaveLength(1000); expect(first.failures).toHaveLength(1); expect(store.objects.size).toBe(1);
    store.remove = remove;
    const second = await synchronize(root, local, store, signal, { checkpoint });
    expect(second.failures).toEqual([]); expect(second.deleted).toHaveLength(1);
  });
  it('limits uploads to four, waits for all on abort, and never starts deletion', async () => {
    const { root, local } = await fixture(Array.from({ length: 9 }, (_, n) => `${n}.jpg`));
    const store = new MemoryStore(); const controller = new AbortController();
    const releases: Array<() => void> = []; let active = 0, peak = 0;
    store.beforePut = async () => { active++; peak = Math.max(peak, active); await new Promise<void>(accept => releases.push(accept)); active--; };
    const pending = synchronize(root, local, store, controller.signal, { checkpoint });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(active).toBe(4); controller.abort(); for (const release of releases) release();
    const result = await pending;
    expect(peak).toBe(4); expect(active).toBe(0); expect(result.failures.some(item => item.code === 'ABORTED')).toBe(true); expect(store.removes).toEqual([]);
  });
});
