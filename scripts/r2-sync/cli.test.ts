import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { afterEach, expect, it, vi } from 'vitest';
import { buildProject, runCLI, writeReport } from './cli';
import { ConfigError, type R2Config } from './config';
import { scanMedia } from './local';
import type { LocalMedia, R2Store, RemoteMedia } from './types';

const temporary: string[] = [];
const album = '2026-10-sequence01-测试 中文';
const photoKey = `media/${album}/a.webp`;
const oldKey = `media/2025-01-sequence00-已删相册/old.mp4`;
const secret = 'TEST_SECRET_DO_NOT_LOG';
const config: R2Config = {
  bucket: 'fixture-bucket', endpoint: `https://${'a'.repeat(32)}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: `${secret}_ACCESS`, secretAccessKey: `${secret}_SECRET` },
};

afterEach(async () => {
  await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(accept => { resolve = accept; });
  return { promise, resolve };
}

function leakedError() {
  return Object.assign(new Error(`${secret} message with signed URL`), {
    name: `${secret}_NAME`, code: `${secret}_CODE`, requestId: secret, credentials: config.credentials,
    $metadata: { requestId: secret }, cause: new Error(secret),
  });
}

async function fixture() {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'r2-cli-'));
  temporary.push(root);
  await mkdir(join(root, 'dist/media', album), { recursive: true });
  await mkdir(join(root, 'src/content'), { recursive: true });
  await writeFile(join(root, 'dist/index.html'), '<!doctype html><title>fixture</title>');
  await writeFile(join(root, 'dist', photoKey), 'abc');
  await writeFile(join(root, 'src/content/generated-photo-index.json'), JSON.stringify({
    content: { site: { title: '测试', subtitle: '家庭相册' }, albums: [{ id: 'fixture', title: '测试', media: [{ id: 'a', type: 'photo', src: photoKey }] }] },
  }));
  const remote = new Map<string, RemoteMedia>();
  const store: R2Store = {
    list: vi.fn(async () => new Map([...remote].map(([key, object]) => [key, { ...object }]))),
    headMd5: vi.fn(async () => undefined),
    put: vi.fn(async (file: LocalMedia) => {
      remote.set(file.key, { key: file.key, size: file.size, etag: file.md5Hex, lastModified: '2026-10-09T00:00:00.000Z' });
      return file.md5Hex;
    }),
    remove: vi.fn(async (objects: RemoteMedia[]) => { objects.forEach(object => remote.delete(object.key)); return []; }),
    close: vi.fn(),
  };
  const deps = {
    root, argv: [], nodeVersion: '24.18.0', config: vi.fn(async () => config),
    build: vi.fn<(root: string, signal: AbortSignal) => Promise<void>>(async () => undefined),
    scan: vi.fn(scanMedia), store: vi.fn(() => store), log: vi.fn<(message: string) => void>(),
  };
  return { root, remote, store, deps, lock: join(root, '.cache/r2-sync/run.lock'), report: join(root, '.cache/r2-sync/latest-report.json') };
}

async function missing(path: string) {
  await expect(readFile(path)).rejects.toMatchObject({ code: 'ENOENT' });
}

it('waits for successful build and real validation/scanning before creating any remote store', async () => {
  const space = await fixture();
  const entered = deferred<void>();
  const complete = deferred<void>();
  space.deps.build.mockImplementation(async () => { entered.resolve(); await complete.promise; });
  const running = runCLI(space.deps);
  await entered.promise;
  expect(space.deps.scan).not.toHaveBeenCalled();
  expect(space.deps.store).not.toHaveBeenCalled();
  expect(space.store.list).not.toHaveBeenCalled();
  complete.resolve();
  expect(await running).toBe(0);
  expect(space.deps.build).toHaveBeenCalledWith(space.root, expect.any(AbortSignal));
  expect(space.deps.scan).toHaveBeenCalledWith(join(space.root, 'dist/media'), expect.any(AbortSignal));
  expect(space.remote.get(photoKey)?.etag).toBe('900150983cd24fb0d6963f7d28e17f72');
  expect(space.store.close).toHaveBeenCalledTimes(1);
  await missing(space.lock);
  const report = JSON.parse(await readFile(space.report, 'utf8'));
  expect(report.result).toMatchObject({ uploaded: [photoKey], failures: [] });
  expect(report.timings).toHaveProperty('build');
  expect(JSON.stringify(report)).not.toContain(secret);
});

it.each(['build', 'validation', 'scan'])('does not create or call remote storage after failed %s', async phase => {
  const space = await fixture();
  if (phase === 'build') space.deps.build.mockRejectedValue(leakedError());
  if (phase === 'validation') await rm(join(space.root, 'dist', photoKey));
  if (phase === 'scan') {
    const external = join(space.root, 'external.webp');
    await writeFile(external, 'outside');
    await symlink(external, join(space.root, 'dist/media', album, 'linked.webp'));
  }
  expect(await runCLI(space.deps)).toBe(1);
  expect(space.deps.store).not.toHaveBeenCalled();
  expect(space.store.list).not.toHaveBeenCalled();
  expect(space.store.put).not.toHaveBeenCalled();
  expect(space.store.remove).not.toHaveBeenCalled();
  expect(space.deps.log.mock.calls.flat().join('\n')).not.toContain(secret);
  await missing(space.lock);
});

it.each(['missing', 'empty'])('rejects a %s build index before scanning or remote storage', async state => {
  const space = await fixture();
  const index = join(space.root, 'dist/index.html');
  if (state === 'missing') await rm(index);
  else await writeFile(index, '');
  expect(await runCLI(space.deps)).toBe(1);
  expect(space.deps.build).toHaveBeenCalledTimes(1);
  expect(space.deps.scan).not.toHaveBeenCalled();
  expect(space.deps.store).not.toHaveBeenCalled();
  expect(space.store.list).not.toHaveBeenCalled();
  expect(space.store.put).not.toHaveBeenCalled();
  expect(space.store.remove).not.toHaveBeenCalled();
  await missing(space.lock);
});

it.each([
  { argv: ['--dry-run'], nodeVersion: '24.18.0' },
  { argv: [], nodeVersion: '22.12.0' },
  { argv: [], nodeVersion: '25.0.0' },
])('returns usage code 2 before configuration/build for %j', async invalid => {
  const space = await fixture();
  expect(await runCLI({ ...space.deps, ...invalid })).toBe(2);
  expect(space.deps.config).not.toHaveBeenCalled();
  expect(space.deps.build).not.toHaveBeenCalled();
  expect(space.deps.store).not.toHaveBeenCalled();
  await missing(space.lock);
});

it('explains the actual runtime and nvm fix before any side effects', async () => {
  const space = await fixture();
  expect(await runCLI({ ...space.deps, nodeVersion: '26.8.2' })).toBe(2);
  const output = space.deps.log.mock.calls.flat().join('\n');
  expect(output).toContain('26.8.2');
  expect(output).toContain(process.execPath);
  expect(output).toContain('nvm use');
  expect(output).not.toContain('不接受额外参数');
  expect(space.deps.config).not.toHaveBeenCalled();
  expect(space.deps.build).not.toHaveBeenCalled();
  expect(space.deps.store).not.toHaveBeenCalled();
  await missing(space.lock);
});

it('explains extra arguments separately from the Node version', async () => {
  const space = await fixture();
  expect(await runCLI({ ...space.deps, argv: ['--apply'] })).toBe(2);
  const output = space.deps.log.mock.calls.flat().join('\n');
  expect(output).toContain('不接受额外参数');
  expect(output).not.toContain('nvm use');
  expect(space.deps.config).not.toHaveBeenCalled();
  expect(space.deps.build).not.toHaveBeenCalled();
  expect(space.deps.store).not.toHaveBeenCalled();
});

it('returns configuration code 2 without building, locking or revealing credentials', async () => {
  const space = await fixture();
  space.deps.config.mockRejectedValue(new ConfigError('fixture invalid config'));
  expect(await runCLI(space.deps)).toBe(2);
  expect(space.deps.build).not.toHaveBeenCalled();
  expect(space.deps.store).not.toHaveBeenCalled();
  expect(space.deps.log.mock.calls.flat().join('\n')).not.toContain(secret);
  await missing(space.lock);
});

it.each(['active', 'stale'])('refuses an existing %s wx lock with manual recovery instructions', async owner => {
  const space = await fixture();
  await mkdir(join(space.root, '.cache/r2-sync'), { recursive: true });
  const contents = JSON.stringify({ pid: owner === 'active' ? process.pid : 2147483647, host: 'fixture-host', token: 'existing-owner' });
  await writeFile(space.lock, contents);
  expect(await runCLI(space.deps)).toBe(1);
  expect(space.deps.build).not.toHaveBeenCalled();
  expect(space.deps.store).not.toHaveBeenCalled();
  expect(await readFile(space.lock, 'utf8')).toBe(contents);
  expect(space.deps.log.mock.calls.flat().join('\n')).toMatch(/手动.*遗留锁/);
});

it('holds the real exclusive lock until an unfinished build completes', async () => {
  const space = await fixture();
  const entered = deferred<void>();
  const complete = deferred<void>();
  space.deps.build.mockImplementation(async () => { entered.resolve(); await complete.promise; });
  const running = runCLI(space.deps);
  await entered.promise;
  const blockedBuild = vi.fn(async () => undefined);
  expect(await runCLI({ ...space.deps, build: blockedBuild })).toBe(1);
  expect(blockedBuild).not.toHaveBeenCalled();
  expect(space.deps.store).not.toHaveBeenCalled();
  complete.resolve();
  expect(await running).toBe(0);
  await missing(space.lock);
});

it('preserves a successor lock when its ownership token changed during the build', async () => {
  const space = await fixture();
  const successor = JSON.stringify({ pid: process.pid, token: 'successor-owner' });
  space.deps.build.mockImplementation(async () => { await writeFile(space.lock, successor); });
  expect(await runCLI(space.deps)).toBe(0);
  expect(await readFile(space.lock, 'utf8')).toBe(successor);
  expect(space.store.close).toHaveBeenCalledTimes(1);
});

it('returns 130 for cancellation while building and removes its own lock', async () => {
  const space = await fixture();
  const controller = new AbortController();
  space.deps.build.mockImplementation(async (_root, signal) => {
    controller.abort();
    signal.throwIfAborted();
  });
  expect(await runCLI({ ...space.deps, signal: controller.signal })).toBe(130);
  expect(space.deps.store).not.toHaveBeenCalled();
  await missing(space.lock);
});

it('returns 130 for active upload cancellation, closes the store and skips deletion', async () => {
  const space = await fixture();
  const controller = new AbortController();
  space.remote.set(oldKey, { key: oldKey, size: 3, etag: 'b'.repeat(32), lastModified: '2026-01-01T00:00:00.000Z' });
  vi.mocked(space.store.put).mockImplementation(async (_file, signal) => {
    expect(signal).toBe(controller.signal);
    controller.abort();
    throw leakedError();
  });
  expect(await runCLI({ ...space.deps, signal: controller.signal })).toBe(130);
  expect(space.store.close).toHaveBeenCalledTimes(1);
  expect(space.store.remove).not.toHaveBeenCalled();
  expect(space.remote.has(oldKey)).toBe(true);
  await missing(space.lock);
  const contents = await readFile(space.report, 'utf8');
  expect(contents).toContain('ABORTED');
  expect(contents).not.toContain(secret);
  expect(space.deps.log.mock.calls.flat().join('\n')).not.toContain(secret);
});

it('restores process signal listener counts after the default controller completes', async () => {
  const space = await fixture();
  const before = { interrupt: process.listenerCount('SIGINT'), terminate: process.listenerCount('SIGTERM') };
  expect(await runCLI(space.deps)).toBe(0);
  expect(process.listenerCount('SIGINT')).toBe(before.interrupt);
  expect(process.listenerCount('SIGTERM')).toBe(before.terminate);
});

it('fails before remote writes when the initial report cannot be written', async () => {
  const space = await fixture();
  space.remote.set(oldKey, { key: oldKey, size: 3, etag: 'b'.repeat(32), lastModified: '2026-01-01T00:00:00.000Z' });
  let calls = 0;
  const report = vi.fn(async (root: string, value: unknown) => {
    if (++calls === 1) throw leakedError();
    await writeReport(root, value);
  });
  expect(await runCLI({ ...space.deps, report })).toBe(1);
  expect(space.store.list).toHaveBeenCalledTimes(1);
  expect(space.store.put).not.toHaveBeenCalled();
  expect(space.store.remove).not.toHaveBeenCalled();
  expect(space.store.close).toHaveBeenCalledTimes(1);
  expect(space.remote.has(oldKey)).toBe(true);
  const contents = await readFile(space.report, 'utf8');
  expect(contents).toContain('REPORT_FAILED');
  expect(contents).not.toContain(secret);
  expect(space.deps.log.mock.calls.flat().join('\n')).not.toContain(secret);
  await missing(space.lock);
});

it('returns nonzero after a final report failure even when remote writes completed', async () => {
  const space = await fixture();
  let calls = 0;
  const report = vi.fn(async (root: string, value: unknown) => {
    if (++calls > 1) throw leakedError();
    await writeReport(root, value);
  });
  expect(await runCLI({ ...space.deps, report })).toBe(1);
  expect(space.remote.has(photoKey)).toBe(true);
  expect(space.store.put).toHaveBeenCalledTimes(1);
  expect(space.store.close).toHaveBeenCalledTimes(1);
  expect(space.deps.log.mock.calls.flat().join('\n')).toContain('REPORT_FAILED');
  expect(space.deps.log.mock.calls.flat().join('\n')).not.toContain(secret);
  expect(await readFile(space.report, 'utf8')).not.toContain(secret);
  await missing(space.lock);
});

it('retains successful uploads, skips removal, and redacts arbitrary SDK error fields on upload failure', async () => {
  const space = await fixture();
  const otherKey = `media/${album}/b.mp4`;
  await writeFile(join(space.root, 'dist', otherKey), 'video');
  space.remote.set(oldKey, { key: oldKey, size: 3, etag: 'b'.repeat(32), lastModified: '2026-01-01T00:00:00.000Z' });
  vi.mocked(space.store.put).mockImplementation(async (file, signal) => {
    if (file.key === otherKey) throw leakedError();
    // The successful path is a real Map mutation, not a successful call count.
    space.remote.set(file.key, { key: file.key, size: file.size, etag: file.md5Hex, lastModified: '2026-10-09T00:00:00.000Z' });
    expect(signal.aborted).toBe(false);
    return file.md5Hex;
  });
  expect(await runCLI(space.deps)).toBe(1);
  expect(space.remote.has(photoKey)).toBe(true);
  expect(space.remote.has(otherKey)).toBe(false);
  expect(space.remote.has(oldKey)).toBe(true);
  expect(space.store.remove).not.toHaveBeenCalled();
  const report = JSON.parse(await readFile(space.report, 'utf8'));
  expect(report.result.failures).toEqual([{ key: otherKey, phase: 'upload', code: 'OPERATION_FAILED' }]);
  expect(JSON.stringify(report)).not.toContain(secret);
  expect(space.deps.log.mock.calls.flat().join('\n')).not.toContain(secret);
  expect(space.store.close).toHaveBeenCalledTimes(1);
  await missing(space.lock);
});

it('automatically mirrors a build-validated empty media collection to an empty remote collection', async () => {
  const space = await fixture();
  await rm(join(space.root, 'dist', photoKey));
  await writeFile(join(space.root, 'src/content/generated-photo-index.json'), JSON.stringify({
    content: { site: { title: '测试', subtitle: '空相册' }, albums: [] },
  }));
  space.remote.set(oldKey, { key: oldKey, size: 3, etag: 'b'.repeat(32), lastModified: '2026-01-01T00:00:00.000Z' });
  expect(await runCLI(space.deps)).toBe(0);
  expect(space.store.put).not.toHaveBeenCalled();
  expect(space.remote.size).toBe(0);
  const report = JSON.parse(await readFile(space.report, 'utf8'));
  expect(report.result.deleted).toEqual([oldKey]);
  expect(report.result.failures).toEqual([]);
  await missing(space.lock);
});

it.skipIf(process.platform === 'win32')('waits for a stubborn real build descendant to die before rejecting cancellation', async () => {
  const space = await fixture();
  await writeFile(join(space.root, 'package.json'), JSON.stringify({ private: true, scripts: { build: 'node parent.mjs' } }));
  await writeFile(join(space.root, 'parent.mjs'), [
    "import { spawn } from 'node:child_process';",
    "spawn(process.execPath, ['descendant.mjs'], { stdio: 'ignore' });",
    'setInterval(() => {}, 1000);',
  ].join('\n'));
  await writeFile(join(space.root, 'descendant.mjs'), [
    "import { writeFileSync } from 'node:fs';",
    "process.on('SIGTERM', () => {});",
    "writeFileSync('descendant-ready.json', JSON.stringify({ pid: process.pid }));",
    'setInterval(() => {}, 1000);',
  ].join('\n'));
  const controller = new AbortController();
  // Attach rejection handling immediately; cancellation must not produce an unhandled rejection.
  const outcome = buildProject(space.root, controller.signal).then(() => undefined, error => error);
  let descendantPid: number | undefined;
  const alive = (pid: number) => {
    try { process.kill(pid, 0); return true; } catch { return false; }
  };
  try {
    await vi.waitFor(async () => {
      descendantPid = JSON.parse(await readFile(join(space.root, 'descendant-ready.json'), 'utf8')).pid;
      expect(descendantPid).toBeTypeOf('number');
      expect(alive(descendantPid!)).toBe(true);
    }, { timeout: 3000, interval: 25 });
    const abortedAt = performance.now();
    controller.abort();
    expect(await outcome).toMatchObject({ message: 'BUILD_FAILED' });
    // TERM kills npm/parent first. The ignoring descendant requires the delayed group KILL.
    expect(performance.now() - abortedAt).toBeGreaterThanOrEqual(4500);
    expect(alive(descendantPid!)).toBe(false);
  } finally {
    controller.abort();
    await outcome;
    if (descendantPid && alive(descendantPid)) {
      try { process.kill(descendantPid, 'SIGKILL'); } catch { /* Already gone. */ }
    }
  }
}, 10000);
