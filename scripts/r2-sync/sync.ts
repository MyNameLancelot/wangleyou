import { performance } from 'node:perf_hooks';
import { assertSnapshotUnchanged, isManagedKey } from './local';
import { R2_ERROR_CODES } from './r2';
import { UPLOAD_CONCURRENCY, type LocalMedia, type R2Store, type RemoteMedia, type SyncPlan, type SyncResult } from './types';

export class SyncError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'SyncError'; }
}

const SAFE_CODES = new Set([
  ...R2_ERROR_CODES,
  'ABORTED', 'UPLOAD_FAILED', 'CHECKSUM_MISMATCH', 'LOCAL_CHANGED', 'REMOTE_CHANGED',
  'REPORT_FAILED', 'OPERATION_FAILED', 'INVALID_REMOTE', 'AccessDenied', 'InvalidAccessKeyId',
  'SignatureDoesNotMatch', 'NoSuchBucket', 'NoSuchKey', 'SlowDown', 'ServiceUnavailable',
  'InternalError', 'RequestTimeout', 'BadDigest', 'InvalidDigest', 'InvalidRequest',
]);
export function safeCode(error: unknown): string {
  if (error instanceof SyncError && SAFE_CODES.has(error.code)) return error.code;
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && SAFE_CODES.has(error.code)) return error.code;
  return 'OPERATION_FAILED';
}

function md5Etag(etag: string): string | undefined {
  const normalized = etag.replace(/^"|"$/g, '').toLowerCase();
  return /^[a-f0-9]{32}$/.test(normalized) ? normalized : undefined;
}

export function createPlan(local: Map<string, LocalMedia>, remote: Map<string, RemoteMedia>, verifiedMd5 = new Map<string, string>()): SyncPlan {
  const plan: SyncPlan = { uploads: [], skipped: [], removals: [] };
  for (const [key, file] of local) {
    if (!isManagedKey(key) || key !== file.key) throw new SyncError('INVALID_REMOTE');
    const object = remote.get(key);
    const md5 = object && md5Etag(object.etag);
    const verified = md5 ?? verifiedMd5.get(key)?.toLowerCase();
    if (object && object.size === file.size && verified === file.md5Hex) plan.skipped.push(key);
    else plan.uploads.push({ file, reason: !object ? 'new' : md5 ? 'changed' : 'unverified' });
  }
  for (const [key, object] of remote) {
    if (!isManagedKey(key) || key !== object.key) throw new SyncError('INVALID_REMOTE');
    if (!local.has(key)) plan.removals.push(object);
  }
  return plan;
}

async function bounded<T>(items: T[], signal: AbortSignal, task: (item: T) => Promise<void>) {
  let next = 0;
  const workers = await Promise.allSettled(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, items.length) }, async () => {
    while (next < items.length) {
      signal.throwIfAborted();
      const item = items[next++];
      await task(item);
    }
  }));
  const failed = workers.find(worker => worker.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
}

function sameObject(a: RemoteMedia, b: RemoteMedia, includeTime = true): boolean {
  return a.size === b.size && a.etag === b.etag && (!includeTime || a.lastModified === b.lastModified);
}

export type SyncHooks = {
  checkpoint: (plan: SyncPlan, result: SyncResult) => Promise<void>;
  onStage?: (stage: string, milliseconds: number) => void;
};

/** Upload errors are collected; all in-flight uploads settle before cleanup can start. */
export async function synchronize(root: string, local: Map<string, LocalMedia>, store: R2Store, signal: AbortSignal, hooks: SyncHooks): Promise<SyncResult> {
  const result: SyncResult = { uploaded: [], deleted: [], skipped: [], failures: [], uploadedBytes: 0 };
  let plan: SyncPlan | undefined;
  const stage = async <T>(name: string, task: () => Promise<T>): Promise<T> => {
    const started = performance.now();
    try { signal.throwIfAborted(); return await task(); }
    finally { hooks.onStage?.(name, performance.now() - started); }
  };
  try {
    const remote = await stage('list', () => store.list(signal));
    const verifiedMd5 = new Map<string, string>();
    await stage('verify', () => bounded([...local.values()].filter(file => {
      const object = remote.get(file.key);
      return object && object.size === file.size && !md5Etag(object.etag);
    }), signal, async file => {
      const md5 = await store.headMd5(file.key, signal);
      if (md5) verifiedMd5.set(file.key, md5);
    }));
    plan = createPlan(local, remote, verifiedMd5);
    result.skipped = plan.skipped;
    try { await hooks.checkpoint(plan, result); } catch { throw new SyncError('REPORT_FAILED'); }
    const uploadedEtags = new Map<string, string>();
    await stage('upload', () => bounded(plan!.uploads, signal, async ({ file }) => {
      try {
        const etag = await store.put(file, signal);
        if (md5Etag(etag) !== file.md5Hex) throw new SyncError('CHECKSUM_MISMATCH');
        uploadedEtags.set(file.key, etag.replace(/^"|"$/g, '').toLowerCase());
        result.uploaded.push(file.key); result.uploadedBytes += file.size;
      } catch (error) { result.failures.push({ key: file.key, phase: 'upload', code: signal.aborted ? 'ABORTED' : safeCode(error) }); }
    }));
    if (result.failures.length) return result;
    await stage('recheck', async () => {
      try { await assertSnapshotUnchanged(root, local); } catch { throw new SyncError('LOCAL_CHANGED'); }
    });
    const beforeDelete = await stage('listBeforeDelete', () => store.list(signal));
    const expected = new Map(remote);
    for (const file of local.values()) {
      if (uploadedEtags.has(file.key)) expected.set(file.key, { key: file.key, size: file.size, etag: uploadedEtags.get(file.key)!, lastModified: '' });
    }
    if (expected.size !== beforeDelete.size) throw new SyncError('REMOTE_CHANGED');
    for (const [key, object] of expected) {
      const actual = beforeDelete.get(key);
      if (!actual || !sameObject(object, actual, !uploadedEtags.has(key))) throw new SyncError('REMOTE_CHANGED');
    }
    await stage('delete', async () => {
      signal.throwIfAborted();
      const failures = await store.remove(plan!.removals, signal);
      const failedKeys = new Set(failures.map(failure => failure.key));
      result.failures.push(...failures.map(failure => ({ ...failure, code: safeCode({ code: failure.code }) })));
      result.deleted.push(...plan!.removals.filter(object => !failedKeys.has(object.key)).map(object => object.key));
    });
    if (!result.failures.length) {
      const final = await stage('listFinal', () => store.list(signal));
      if (final.size !== local.size) throw new SyncError('REMOTE_CHANGED');
      for (const key of local.keys()) {
        const actual = final.get(key), expectedObject = beforeDelete.get(key);
        if (!actual || !expectedObject || !sameObject(actual, expectedObject)) throw new SyncError('REMOTE_CHANGED');
      }
    }
  } catch (error) {
    result.failures.push({ key: '', phase: 'sync', code: signal.aborted ? 'ABORTED' : safeCode(error) });
  } finally {
    if (plan) {
      try { await hooks.checkpoint(plan, result); }
      catch { result.failures.push({ key: '', phase: 'report', code: 'REPORT_FAILED' }); }
    }
  }
  return result;
}
