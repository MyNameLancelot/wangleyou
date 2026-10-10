import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { hostname } from 'node:os';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { validateFiles } from '../validate-content';
import { ConfigError, loadConfig, PROJECT_ROOT, type R2Config } from './config';
import { assertSafeMediaStats, scanMedia } from './local';
import { createR2Store } from './r2';
import { safeCode, synchronize } from './sync';
import type { LocalMedia, R2Store, SyncPlan, SyncResult } from './types';

export async function acquireLock(root: string): Promise<() => Promise<void>> {
  const directory = resolve(root, '.cache/r2-sync');
  await mkdir(directory, { recursive: true });
  const path = resolve(directory, 'run.lock');
  const token = randomUUID();
  let handle;
  try { handle = await open(path, 'wx', 0o600); }
  catch { throw new Error('LOCK_HELD'); }
  try { await handle.writeFile(JSON.stringify({ pid: process.pid, host: hostname(), token })); }
  catch (error) { await handle.close(); await unlink(path); throw error; }
  await handle.close();
  return async () => {
    // Never unlink a successor's lock, even when the lock was manually replaced.
    const owner = JSON.parse(await readFile(path, 'utf8')) as { token?: string };
    if (owner.token === token) await unlink(path);
  };
}

export function buildProject(root: string, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((accept, reject) => {
    const child = spawn('npm', ['run', 'build'], { cwd: root, stdio: 'inherit', detached: process.platform !== 'win32' });
    const kill = (name: NodeJS.Signals) => {
      if (!child.pid) return;
      try {
        if (process.platform === 'win32') child.kill(name);
        else process.kill(-child.pid, name);
      } catch { /* Already exited; the close handler still owns cleanup. */ }
    };
    let groupCleanup: Promise<void> | undefined;
    const abort = () => { kill('SIGTERM'); groupCleanup ??= waitForGroup(); };
    const waitForGroup = async () => {
      if (!child.pid || process.platform === 'win32') return;
      const deadline = performance.now() + 5000;
      while (performance.now() < deadline) {
        try { process.kill(-child.pid, 0); } catch { return; }
        await new Promise(accept => setTimeout(accept, 25));
      }
      // npm can exit before a descendant. Preserve the group cleanup after its close event.
      kill('SIGKILL');
      await new Promise(accept => setTimeout(accept, 100));
    };
    signal.addEventListener('abort', abort, { once: true });
    child.once('error', () => { /* close always follows error; do not release the lock early. */ });
    child.once('close', async code => {
      signal.removeEventListener('abort', abort);
      if (signal.aborted) { await (groupCleanup ?? waitForGroup()); reject(new Error('BUILD_FAILED')); }
      else if (code !== 0) reject(new Error('BUILD_FAILED'));
      else accept();
    });
    if (signal.aborted) abort();
  });
}

export async function writeReport(root: string, report: unknown): Promise<void> {
  const directory = resolve(root, '.cache/r2-sync');
  await mkdir(directory, { recursive: true });
  const temporary = resolve(directory, `report-${randomUUID()}.tmp`);
  try {
    const handle = await open(temporary, 'wx', 0o600);
    try { await handle.writeFile(JSON.stringify(report, null, 2) + '\n'); } finally { await handle.close(); }
    await rename(temporary, resolve(directory, 'latest-report.json'));
  } finally { await unlink(temporary).catch(() => undefined); }
}

export async function validateBuild(root: string): Promise<void> {
  const index = await assertSafeMediaStats(resolve(root, 'dist/index.html'));
  if (!index.isFile() || index.size === 0n) throw new Error('INVALID_BUILD');
  await validateFiles(resolve(root, 'src/content/generated-photo-index.json'), resolve(root, 'dist'));
}

type Dependencies = {
  root?: string; argv?: string[]; nodeVersion?: string; signal?: AbortSignal;
  config?: (root: string) => Promise<R2Config>;
  build?: (root: string, signal: AbortSignal) => Promise<void>;
  validate?: (root: string) => Promise<unknown>;
  scan?: (root: string, signal: AbortSignal) => Promise<Map<string, LocalMedia>>;
  store?: (config: R2Config) => R2Store;
  report?: (root: string, report: unknown) => Promise<void>;
  log?: (message: string) => void;
};

export async function runCLI(deps: Dependencies = {}): Promise<number> {
  const log = deps.log ?? console.log;
  const nodeVersion = deps.nodeVersion ?? process.versions.node;
  if (!nodeVersion.startsWith('24.')) {
    log(`当前 Node ${nodeVersion}（${process.execPath}），项目要求 Node 24。`);
    log('请在项目根目录执行 nvm use，再运行 node -v 确认 v24，然后执行 npm run r2:sync。');
    return 2;
  }
  if ((deps.argv ?? process.argv.slice(2)).length) {
    log('npm run r2:sync 不接受额外参数，请直接运行该命令。'); return 2;
  }
  const root = deps.root ?? PROJECT_ROOT;
  const controller = new AbortController();
  const signal = deps.signal ?? controller.signal;
  const abort = () => controller.abort();
  if (!deps.signal) { process.once('SIGINT', abort); process.once('SIGTERM', abort); }
  let release: (() => Promise<void>) | undefined, store: R2Store | undefined;
  let exitCode = 1;
  const timings: Record<string, number> = {};
  const started = performance.now();
  const stage = async <T>(name: string, action: () => Promise<T>): Promise<T> => {
    const beginning = performance.now();
    try { signal.throwIfAborted(); return await action(); }
    finally { timings[name] = Math.round(performance.now() - beginning); }
  };
  try {
    const config = await (deps.config ?? loadConfig)(root);
    release = await acquireLock(root);
    log('R2 同步：重新构建工程…');
    await stage('build', () => (deps.build ?? buildProject)(root, signal));
    await stage('validate', () => (deps.validate ?? validateBuild)(root));
    const mediaRoot = resolve(root, 'dist/media');
    const local = await stage('scan', () => (deps.scan ?? scanMedia)(mediaRoot, signal));
    signal.throwIfAborted();
    store = (deps.store ?? createR2Store)(config);
    log(`R2 同步：本地 ${local.size} 个相册媒体，比较并同步…`);
    const activeStore = store;
    let firstReport = true;
    const checkpoint = async (plan: SyncPlan, result: SyncResult) => {
      await (deps.report ?? writeReport)(root, {
        version: 1, bucket: config.bucket, startedAt: new Date(Date.now() - (performance.now() - started)).toISOString(),
        timings: { ...timings, total: Math.round(performance.now() - started) },
        memory: process.memoryUsage(),
        requests: 'stats' in activeStore ? (() => {
          const stats = activeStore.stats as { listPages?: number; attempts?: number };
          return { listPages: stats.listPages, attempts: stats.attempts };
        })() : undefined,
        plan: { uploads: plan.uploads.map(({ file, reason }) => ({ key: file.key, size: file.size, reason })),
          skipped: plan.skipped, removals: plan.removals.map(object => ({ key: object.key, size: object.size })),
          uploadBytes: plan.uploads.reduce((total, item) => total + item.file.size, 0) },
        result,
      });
      if (firstReport) {
        log(`同步计划：新增 ${plan.uploads.filter(item => item.reason === 'new').length}，更新 ${plan.uploads.filter(item => item.reason !== 'new').length}，跳过 ${plan.skipped.length}，待删除 ${plan.removals.length}。`);
        firstReport = false;
      }
    };
    const result = await synchronize(mediaRoot, local, store, signal, { checkpoint, onStage: (name, milliseconds) => { timings[name] = Math.round(milliseconds); } });
    log(`R2 同步：上传 ${result.uploaded.length}，跳过 ${result.skipped.length}，删除 ${result.deleted.length}，失败 ${result.failures.length}；${Math.round(performance.now() - started)} ms`);
    for (const failure of result.failures.slice(0, 20)) log(`${failure.phase}: ${failure.key} ${failure.code}`);
    log(result.failures.some(failure => failure.code === 'REPORT_FAILED')
      ? '报告写入失败，.cache/r2-sync/latest-report.json 可能是旧记录；远端可能已部分更新。'
      : firstReport ? '本轮未生成同步报告；已有报告可能属于上次运行。' : '完整报告：.cache/r2-sync/latest-report.json');
    exitCode = signal.aborted ? 130 : result.failures.length ? 1 : 0;
  } catch (error) {
    if (error instanceof ConfigError) { log(error.message); exitCode = 2; }
    else if (error instanceof Error && error.message === 'LOCK_HELD') {
      log('已有同步锁 .cache/r2-sync/run.lock；确认记录的本机 PID 已退出后才能手动移除遗留锁。');
    } else log(`R2 同步未完成：${signal.aborted ? 'ABORTED' : safeCode(error)}；远端可能已部分更新，请修正后重跑。`);
    if (signal.aborted) exitCode = 130;
  } finally {
    if (!deps.signal) { process.removeListener('SIGINT', abort); process.removeListener('SIGTERM', abort); }
    store?.close();
    if (release) {
      try { await release(); } catch { log('本轮锁未能释放，请检查 .cache/r2-sync/run.lock。'); if (!exitCode) exitCode = 1; }
    }
  }
  return exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void runCLI().then(code => { process.exitCode = code; });
}
