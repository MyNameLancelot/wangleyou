import { mkdtemp, mkdir, open, readFile, realpath, rename, rm, symlink, truncate, utimes, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { truncateSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { assertSnapshotUnchanged, isManagedKey, scanMedia } from './local';
import { MAX_MEDIA_BYTES } from './types';

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, open: vi.fn(actual.open) };
});

const temporary: string[] = [];
const album = '2026-10-sequence01-生日 中文';
const signal = () => new AbortController().signal;
afterEach(async () => {
  vi.mocked(open).mockReset();
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  vi.mocked(open).mockImplementation(actual.open);
  await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

async function workspace() {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'r2-local-'));
  temporary.push(root);
  await mkdir(join(root, album));
  return root;
}

async function media(root: string, relative: string, content = 'abc') {
  const path = join(root, album, relative);
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, content);
  return path;
}

it.each([
  `media/${album}/a.JPG`, `media/${album}/中文 目录/a.MP4`,
  'media/0000-01-sequence00-a/a.svg', 'media/9999-12-sequence99-a/a.avif',
])('accepts managed album key %s', key => expect(isManagedKey(key)).toBe(true));

it.each([
  'media/themes/a.webp', 'media/SOURCES.md', `media/${album}/a.mp3`, `media/${album}/a.json`,
  'other/2026-10-sequence01-a/a.webp', 'media/2026-00-sequence01-a/a.webp',
  'media/2026-13-sequence01-a/a.webp', 'media/2026-1-sequence01-a/a.webp',
  'media/2026-10-sequence1-a/a.webp', 'media/2026-10-sequence01-/a.webp',
  `media/${album}//a.webp`, `media/${album}/./a.webp`, `media/${album}/../a.webp`,
  `media/${album}/a\\b.webp`, `media/${album}/a.webp/`, `media/${album}/a\0.webp`,
])('rejects unmanaged or unsafe key %s', key => expect(isManagedKey(key)).toBe(false));

it('scans only recursive album images and MP4, retaining Unicode, case and known content MD5', async () => {
  const root = await workspace();
  await media(root, '嵌套 空格/a.JPG');
  await media(root, '视频.MP4');
  await media(root, 'a.mp3');
  await media(root, 'meta.json');
  await mkdir(join(root, 'themes'));
  await writeFile(join(root, 'themes', 'a.webp'), 'theme');
  await mkdir(join(root, 'invalid-album'));
  await writeFile(join(root, 'invalid-album', 'a.webp'), 'ignored');
  const files = await scanMedia(root, signal());
  expect([...files.keys()]).toEqual([`media/${album}/嵌套 空格/a.JPG`, `media/${album}/视频.MP4`]);
  const image = files.get(`media/${album}/嵌套 空格/a.JPG`)!;
  expect(image).toMatchObject({ size: 3, md5Hex: '900150983cd24fb0d6963f7d28e17f72', md5Base64: 'kAFQmDzST7DWlj99KOF/cg==', contentType: 'image/jpeg' });
  expect(typeof image.stamp.mtimeNs).toBe('bigint');
  expect(image.stamp.size).toBe(3n);
  await assertSnapshotUnchanged(root, files);
});

it.each([
  ['a.jpeg', 'image/jpeg', false], ['a.png', 'image/png', false], ['a.webp', 'image/webp', false],
  ['a.avif', 'image/avif', false], ['a.gif', 'image/gif', false], ['a.svg', 'image/svg+xml', false],
  ['a.mp4', 'video/mp4', false], ['a.012345abcdef.960.webp', 'image/webp', true],
  ['a.poster.012345abcdef.1600.webp', 'image/webp', true], ['a.012345abcdef.MP4', 'video/mp4', true],
  ['a.012345abcdef.webp', 'image/webp', false], ['a.012345abcdef.0.webp', 'image/webp', false],
  ['a.012345abcdef.0960.webp', 'image/webp', false], ['a.012345abcde.960.webp', 'image/webp', false],
  ['a.012345abcdef.960.jpg', 'image/jpeg', false], ['a.012345ABCDEf.960.webp', 'image/webp', false],
])('assigns MIME and generator-specific cache policy for %s', async (name, contentType, immutable) => {
  const root = await workspace();
  await media(root, name);
  const file = (await scanMedia(root, signal())).get(`media/${album}/${name}`)!;
  expect(file.contentType).toBe(contentType);
  expect(file.cacheControl).toBe(immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate');
});

it('detects different bytes even with identical length and restored modification time', async () => {
  const root = await workspace();
  const path = await media(root, 'a.webp');
  const time = new Date('2026-01-01T00:00:00.000Z');
  await utimes(path, time, time);
  const first = await scanMedia(root, signal());
  await writeFile(path, 'def');
  await utimes(path, time, time);
  const second = await scanMedia(root, signal());
  const before = [...first.values()][0];
  const after = [...second.values()][0];
  expect(before.size).toBe(after.size);
  expect(before.stamp.mtimeNs).toBe(after.stamp.mtimeNs);
  expect(before.md5Hex).not.toBe(after.md5Hex);
  await expect(assertSnapshotUnchanged(root, first)).rejects.toThrow(/changed|变化/i);
});

it('rejects oversized sparse media before opening it for hashing', async () => {
  const root = await workspace();
  await media(root, 'a.webp');
  const path = await media(root, 'oversized.mp4');
  await truncate(path, MAX_MEDIA_BYTES + 1);
  await expect(scanMedia(root, signal())).rejects.toThrow(/200|size|大小/i);
  expect(open).not.toHaveBeenCalled();
});

it('accepts the exact size limit and hashes with at most two open files', async () => {
  const root = await workspace();
  const path = await media(root, 'limit.mp4');
  await truncate(path, MAX_MEDIA_BYTES);
  for (let index = 0; index < 4; index++) await media(root, `file-${index}.webp`);
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  let active = 0;
  let maximum = 0;
  vi.mocked(open).mockImplementation(async (...args) => {
    const handle = await actual.open(...args);
    active++;
    maximum = Math.max(maximum, active);
    const close = handle.close.bind(handle);
    let released = false;
    handle.close = async () => {
      try { await close(); } finally { if (!released) { released = true; active--; } }
    };
    return handle;
  });
  const files = await scanMedia(root, signal());
  expect(files.size).toBe(5);
  expect(files.get(`media/${album}/limit.mp4`)?.size).toBe(MAX_MEDIA_BYTES);
  expect(maximum).toBe(2);
  expect(active).toBe(0);
});

it.each(['root', 'ancestor', 'album', 'nested', 'file'])('rejects a %s symlink without following it', async kind => {
  const root = await workspace();
  const outside = await workspace();
  await media(outside, 'outside.webp');
  let targetRoot = root;
  if (kind === 'root') { await symlink(outside, join(root, 'link')); targetRoot = join(root, 'link'); }
  if (kind === 'ancestor') { await symlink(outside, join(root, 'link')); targetRoot = join(root, 'link', album); }
  if (kind === 'album') { await rm(join(root, album), { recursive: true }); await symlink(join(outside, album), join(root, album)); }
  if (kind === 'nested') await symlink(join(outside, album), join(root, album, 'nested'));
  if (kind === 'file') await symlink(join(outside, album, 'outside.webp'), join(root, album, 'a.webp'));
  await expect(scanMedia(targetRoot, signal())).rejects.toThrow(/link|链接/i);
  expect(await readFile(join(outside, album, 'outside.webp'), 'utf8')).toBe('abc');
});

it('ignores excluded root symlinks but rejects a selected nonregular file', async () => {
  const root = await workspace();
  await symlink(root, join(root, 'themes'));
  expect((await scanMedia(root, signal())).size).toBe(0);
  execFileSync('mkfifo', [join(root, album, 'fifo.mp4')]);
  await expect(scanMedia(root, signal())).rejects.toThrow(/regular|普通/i);
});

it('rejects missing roots and accepts a legitimate empty media directory', async () => {
  const root = await workspace();
  expect((await scanMedia(root, signal())).size).toBe(0);
  await assertSnapshotUnchanged(root, new Map());
  await expect(scanMedia(join(root, 'missing'), signal())).rejects.toThrow();
});

it.each(['add', 'remove', 'replace', 'parent-link'])('rejects snapshot %s before deletion without rehashing', async action => {
  const root = await workspace();
  const path = await media(root, 'nested/a.webp');
  const files = await scanMedia(root, signal());
  vi.mocked(open).mockClear();
  if (action === 'add') await media(root, 'b.mp4');
  if (action === 'remove') await rm(path);
  if (action === 'replace') { await rename(path, `${path}.old`); await writeFile(path, 'abc'); }
  if (action === 'parent-link') {
    const outside = await workspace();
    await media(outside, 'a.webp');
    await rm(join(root, album, 'nested'), { recursive: true });
    await symlink(join(outside, album), join(root, album, 'nested'));
  }
  await expect(assertSnapshotUnchanged(root, files)).rejects.toThrow();
  expect(open).not.toHaveBeenCalled();
});

it('stops before reading when already cancelled', async () => {
  const root = await workspace();
  await media(root, 'a.webp');
  const controller = new AbortController();
  controller.abort();
  await expect(scanMedia(root, controller.signal)).rejects.toThrow();
  expect(open).not.toHaveBeenCalled();
});

it('rejects changes during hashing and closes every opened handle', async () => {
  const root = await workspace();
  const path = await media(root, 'a.mp4');
  await truncate(path, 4 * 1024 * 1024);
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  let closed = false;
  vi.mocked(open).mockImplementation(async (...args) => {
    const handle = await actual.open(...args);
    const createReadStream = handle.createReadStream.bind(handle);
    handle.createReadStream = options => {
      const stream = createReadStream(options);
      stream.once('data', () => truncateSync(path, 0));
      return stream;
    };
    const close = handle.close.bind(handle);
    handle.close = async () => { try { await close(); } finally { closed = true; } };
    return handle;
  });
  await expect(scanMedia(root, signal())).rejects.toThrow(/changed|变化/i);
  expect(closed).toBe(true);
});

it('cancels an active hash, closes its handle and does not start queued hashes', async () => {
  const root = await workspace();
  for (let index = 0; index < 5; index++) await media(root, `file-${index}.webp`);
  const controller = new AbortController();
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  let active = 0;
  vi.mocked(open).mockImplementation(async (...args) => {
    const handle = await actual.open(...args);
    active++;
    const createReadStream = handle.createReadStream.bind(handle);
    handle.createReadStream = options => {
      const stream = createReadStream(options);
      stream.once('data', () => controller.abort());
      return stream;
    };
    const close = handle.close.bind(handle);
    let released = false;
    handle.close = async () => {
      try { await close(); } finally { if (!released) { released = true; active--; } }
    };
    return handle;
  });
  await expect(scanMedia(root, controller.signal)).rejects.toThrow();
  expect(open).toHaveBeenCalledTimes(2);
  expect(active).toBe(0);
});

it('handles cancellation after the file stat but before the read stream is consumed', async () => {
  const root = await workspace();
  for (let index = 0; index < 5; index++) await media(root, `file-${index}.webp`);
  const controller = new AbortController();
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  let active = 0;
  vi.mocked(open).mockImplementation(async (...args) => {
    const handle = await actual.open(...args);
    active++;
    const stat = handle.stat.bind(handle);
    vi.spyOn(handle, 'stat').mockImplementation(async options => {
      const result = await stat(options);
      controller.abort();
      return result;
    });
    const close = handle.close.bind(handle);
    handle.close = async () => { try { await close(); } finally { active--; } };
    return handle;
  });
  await expect(scanMedia(root, controller.signal)).rejects.toThrow();
  expect(vi.mocked(open).mock.calls.length).toBeLessThanOrEqual(2);
  expect(active).toBe(0);
});
