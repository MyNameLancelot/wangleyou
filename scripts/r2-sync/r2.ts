import { createHash } from 'node:crypto';
import { constants, type ReadStream } from 'node:fs';
import { open } from 'node:fs/promises';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  DeleteObjectsCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand,
  S3Client, type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { isManagedKey, assertSafeMediaStats } from './local';
import { MAX_MEDIA_BYTES, type FileStamp, type LocalMedia, type R2Store, type RemoteMedia, type SyncFailure } from './types';

const MD5 = /^[a-f0-9]{32}$/;
const SAFE_CODES = new Set([
  'AccessDenied', 'InvalidAccessKeyId', 'SignatureDoesNotMatch', 'ExpiredToken',
  'InvalidToken', 'InvalidArgument', 'InvalidRequest', 'NoSuchBucket', 'NoSuchKey',
  'BadDigest', 'InvalidDigest', 'EntityTooLarge', 'InternalError', 'ServiceUnavailable',
  'SlowDown', 'RequestTimeout', 'RequestTimeoutException', 'TimeoutError',
  'NetworkingError', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'ENOTFOUND',
]);
const TRANSIENT_CODES = new Set([
  'InternalError', 'ServiceUnavailable', 'SlowDown', 'RequestTimeout',
  'RequestTimeoutException', 'TimeoutError', 'NetworkingError', 'ECONNRESET',
  'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'ENOTFOUND',
]);
export const R2_ERROR_CODES: ReadonlySet<string> = new Set([
  ...SAFE_CODES, 'R2RequestFailed', 'R2DeleteFailed', 'InvalidRemotePrefix',
  'InvalidRequestTimeout', 'UnmanagedKey', 'R2Closed', 'R2Interrupted', 'R2Timeout',
  'InvalidListResponse', 'InvalidListObject', 'ConflictingListObject',
  'InvalidContinuationToken', 'InvalidLocalMedia', 'LocalFileChanged',
  'FileReadFailed', 'UploadETagMismatch', 'DuplicateDeleteKey', 'InvalidDeleteResponse', 'InvalidDeleteRequest',
]);

/** Never retain SDK errors: their message/request fields may contain secrets. */
export class R2AdapterError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'R2AdapterError';
  }
}

export function normalizeEtag(value: string): string {
  return value.replace(/^"(.*)"$/, '$1').toLowerCase();
}

function sdkCode(error: unknown): string {
  if (error && typeof error === 'object') {
    const fields = error as { name?: unknown; code?: unknown };
    for (const code of [fields.code, fields.name]) {
      if (typeof code === 'string' && SAFE_CODES.has(code)) return code;
    }
  }
  return 'R2RequestFailed';
}

function retryable(error: unknown): boolean {
  if (error instanceof R2AdapterError) return false;
  if (['AccessDenied', 'InvalidAccessKeyId', 'SignatureDoesNotMatch', 'ExpiredToken',
    'InvalidToken', 'InvalidArgument', 'InvalidRequest', 'NoSuchBucket', 'NoSuchKey',
    'BadDigest', 'InvalidDigest', 'EntityTooLarge'].includes(sdkCode(error))) return false;
  if (TRANSIENT_CODES.has(sdkCode(error))) return true;
  if (error && typeof error === 'object') {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    return status === 429 || (typeof status === 'number' && status >= 500);
  }
  return false;
}

function sameStamp(actual: FileStamp, expected: FileStamp): boolean {
  return actual.size === expected.size && actual.mtimeNs === expected.mtimeNs &&
    actual.ctimeNs === expected.ctimeNs && actual.ino === expected.ino && actual.dev === expected.dev;
}

export type R2StoreOptions = {
  bucket: string;
  endpoint: string;
  credentials: NonNullable<S3ClientConfig['credentials']>;
  /** Programmatic integration-test mapping only; the CLI never sets this. */
  isolatedPrefix?: string;
  /** Programmatic test hooks; production uses the fixed defaults. */
  requestTimeoutMs?: number;
  retryDelayMs?: (attempt: number) => number;
};

type CallContext = { signal: AbortSignal; check: () => void; release: () => void };

export class SdkR2Store implements R2Store {
  readonly stats = { listPages: 0, attempts: 0 };
  private readonly client: S3Client;
  private readonly prefix: string;
  private readonly timeout: number;
  private readonly delay: (attempt: number) => number;
  private readonly controllers = new Set<AbortController>();
  private readonly streams = new Set<ReadStream>();
  private closed = false;

  constructor(private readonly options: R2StoreOptions) {
    this.prefix = options.isolatedPrefix ?? 'media/';
    if (!this.prefix.endsWith('/') || this.prefix.startsWith('/') ||
        this.prefix.includes('\\') || this.prefix.slice(0, -1).split('/').some((part) => !part || part === '.' || part === '..')) {
      throw new R2AdapterError('InvalidRemotePrefix');
    }
    this.timeout = options.requestTimeoutMs ?? 10 * 60 * 1000;
    if (!Number.isFinite(this.timeout) || this.timeout <= 0) throw new R2AdapterError('InvalidRequestTimeout');
    this.delay = options.retryDelayMs ?? ((attempt) => 250 * 2 ** (attempt - 1) * (0.75 + Math.random() * 0.5));
    this.client = new S3Client({
      region: 'auto', endpoint: options.endpoint, credentials: options.credentials,
      forcePathStyle: true, maxAttempts: 1,
      // ContentMD5 is the integrity contract; avoid implicit streaming checksum encoding.
      requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  private remoteKey(key: string): string {
    if (!isManagedKey(key)) throw new R2AdapterError('UnmanagedKey');
    return this.prefix + key.slice('media/'.length);
  }

  private context(parent: AbortSignal): CallContext {
    if (this.closed) throw new R2AdapterError('R2Closed');
    if (parent.aborted) throw new R2AdapterError('R2Interrupted');
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    parent.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, this.timeout);
    timer.unref();
    this.controllers.add(controller);
    return {
      signal: controller.signal,
      check: () => {
        if (timedOut) throw new R2AdapterError('R2Timeout');
        if (controller.signal.aborted) throw new R2AdapterError('R2Interrupted');
      },
      release: () => {
        clearTimeout(timer);
        parent.removeEventListener('abort', abort);
        this.controllers.delete(controller);
      },
    };
  }

  private async pause(attempt: number, context: CallContext): Promise<void> {
    context.check();
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(new R2AdapterError('R2Interrupted')); };
      const timer = setTimeout(() => { context.signal.removeEventListener('abort', abort); resolve(); }, this.delay(attempt));
      context.signal.addEventListener('abort', abort, { once: true });
    }).catch(() => context.check());
    context.check();
  }

  private async retry<T>(signal: AbortSignal, operation: (context: CallContext) => Promise<T>): Promise<T> {
    const context = this.context(signal);
    try {
      for (let attempt = 1; attempt <= 3; attempt++) {
        context.check();
        this.stats.attempts++;
        try {
          const result = await operation(context);
          context.check();
          return result;
        } catch (error) {
          context.check();
          if (attempt === 3 || !retryable(error)) {
            throw error instanceof R2AdapterError ? error : new R2AdapterError(sdkCode(error));
          }
          await this.pause(attempt, context);
        }
      }
      throw new R2AdapterError('R2RequestFailed');
    } finally { context.release(); }
  }

  async list(signal: AbortSignal): Promise<Map<string, RemoteMedia>> {
    const result = new Map<string, RemoteMedia>();
    const tokens = new Set<string>();
    let token: string | undefined;
    do {
      const page = await this.retry(signal, (context) => this.client.send(new ListObjectsV2Command({
        Bucket: this.options.bucket, Prefix: this.prefix, ContinuationToken: token,
      }), { abortSignal: context.signal }));
      this.stats.listPages++;
      if (typeof page.IsTruncated !== 'boolean') throw new R2AdapterError('InvalidListResponse');
      for (const object of page.Contents ?? []) {
        if (typeof object.Key !== 'string' || !object.Key.startsWith(this.prefix) ||
            !Number.isSafeInteger(object.Size) || object.Size! < 0 ||
            typeof object.ETag !== 'string' || !object.ETag ||
            !(object.LastModified instanceof Date) || !Number.isFinite(object.LastModified.getTime())) {
          throw new R2AdapterError('InvalidListObject');
        }
        const key = 'media/' + object.Key.slice(this.prefix.length);
        if (!isManagedKey(key)) continue;
        const remote = { key, size: object.Size!, etag: normalizeEtag(object.ETag), lastModified: object.LastModified.toISOString() };
        const previous = result.get(key);
        if (previous && (previous.size !== remote.size || previous.etag !== remote.etag || previous.lastModified !== remote.lastModified)) {
          throw new R2AdapterError('ConflictingListObject');
        }
        result.set(key, remote);
      }
      const next = page.NextContinuationToken;
      if (page.IsTruncated) {
        if (!next || tokens.has(next) || next === token) throw new R2AdapterError('InvalidContinuationToken');
        tokens.add(next);
        token = next;
      } else {
        if (next) throw new R2AdapterError('InvalidContinuationToken');
        token = undefined;
      }
    } while (token);
    return result;
  }

  async headMd5(key: string, signal: AbortSignal): Promise<string | undefined> {
    const remoteKey = this.remoteKey(key);
    const result = await this.retry(signal, (context) => this.client.send(new HeadObjectCommand({
      Bucket: this.options.bucket, Key: remoteKey,
    }), { abortSignal: context.signal }));
    const md5 = result.Metadata?.['sync-md5']?.toLowerCase();
    return result.Metadata?.['sync-version'] === '1' && md5 && MD5.test(md5) ? md5 : undefined;
  }

  async put(file: LocalMedia, signal: AbortSignal): Promise<string> {
    const key = this.remoteKey(file.key);
    if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > MAX_MEDIA_BYTES ||
        !MD5.test(file.md5Hex) || Buffer.from(file.md5Hex, 'hex').toString('base64') !== file.md5Base64) {
      throw new R2AdapterError('InvalidLocalMedia');
    }
    return this.retry(signal, async (context) => {
      try {
        const before = await assertSafeMediaStats(file.absolutePath, context.signal);
        if (!before.isFile() || !sameStamp(before, file.stamp)) throw new R2AdapterError('LocalFileChanged');
      } catch (error) { throw error instanceof R2AdapterError ? error : new R2AdapterError('FileReadFailed'); }
      context.check();
      let handle;
      try {
        handle = await open(file.absolutePath, constants.O_RDONLY | constants.O_NOFOLLOW);
        const opened = await handle.stat({ bigint: true });
        if (!opened.isFile() || !sameStamp(opened, file.stamp)) throw new R2AdapterError('LocalFileChanged');
      } catch (error) {
        await handle?.close();
        throw error instanceof R2AdapterError ? error : new R2AdapterError('FileReadFailed');
      }
      const stream = handle.createReadStream({ autoClose: false });
      const hash = createHash('md5');
      let bytes = 0;
      const body = new Transform({ transform(chunk: Buffer, _encoding, callback) {
        hash.update(chunk);
        bytes += chunk.length;
        if (bytes > file.size) { callback(new R2AdapterError('LocalFileChanged')); return; }
        callback(null, chunk);
      } });
      // Install completion handling before handing the stream to the SDK.
      const completion = pipeline(stream, body).catch(() => { throw new R2AdapterError('FileReadFailed'); });
      void completion.catch(() => undefined);
      const abort = () => stream.destroy(new R2AdapterError('R2Interrupted'));
      context.signal.addEventListener('abort', abort, { once: true });
      this.streams.add(stream);
      try {
        const response = await this.client.send(new PutObjectCommand({
          Bucket: this.options.bucket, Key: key, Body: body, ContentLength: file.size,
          ContentMD5: file.md5Base64, ContentType: file.contentType,
          ContentDisposition: 'inline', CacheControl: file.cacheControl,
          Metadata: { 'sync-version': '1', 'sync-md5': file.md5Hex },
        }), { abortSignal: context.signal });
        await completion;
        let after;
        let openedAfter;
        try {
          after = await assertSafeMediaStats(file.absolutePath, context.signal);
          openedAfter = await handle.stat({ bigint: true });
        }
        catch { throw new R2AdapterError('FileReadFailed'); }
        if (bytes !== file.size || hash.digest('hex') !== file.md5Hex ||
            !after.isFile() || !sameStamp(after, file.stamp) || !sameStamp(openedAfter, file.stamp)) {
          throw new R2AdapterError('LocalFileChanged');
        }
        const etag = normalizeEtag(response.ETag ?? '');
        if (!MD5.test(etag) || etag !== file.md5Hex) throw new R2AdapterError('UploadETagMismatch');
        return etag;
      } catch (error) {
        if (stream.errored instanceof R2AdapterError) throw stream.errored;
        const readCode = (stream.errored as NodeJS.ErrnoException | null)?.code;
        if (readCode && ['ENOENT', 'EACCES', 'EPERM', 'EISDIR', 'EIO', 'EBADF', 'ELOOP', 'ENOTDIR'].includes(readCode)) {
          throw new R2AdapterError('FileReadFailed');
        }
        throw error;
      } finally {
        context.signal.removeEventListener('abort', abort);
        stream.destroy();
        body.destroy();
        this.streams.delete(stream);
        await completion.catch(() => undefined);
        await handle.close();
      }
    });
  }

  async remove(objects: RemoteMedia[], signal: AbortSignal): Promise<SyncFailure[]> {
    // Validate every requested key before the first mutation, including later batches.
    const canonicalKeys = objects.map((object) => object.key);
    const keys = canonicalKeys.map((key) => this.remoteKey(key));
    if (new Set(keys).size !== keys.length) throw new R2AdapterError('DuplicateDeleteKey');
    const failures: SyncFailure[] = [];
    for (let offset = 0; offset < keys.length; offset += 1000) {
      const batch = keys.slice(offset, offset + 1000);
      try {
        const command = new DeleteObjectsCommand({
          Bucket: this.options.bucket, Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
        });
        command.middlewareStack.add((next) => async (args) => {
          const request = args.request as { body?: string | Uint8Array; headers?: Record<string, string> };
          if (!request?.headers || (typeof request.body !== 'string' && !(request.body instanceof Uint8Array))) {
            throw new R2AdapterError('InvalidDeleteRequest');
          }
          request.headers['content-md5'] = createHash('md5').update(request.body).digest('base64');
          return next(args);
        }, { step: 'build', name: 'r2DeleteContentMd5', priority: 'high' });
        const response = await this.retry(signal, (context) => this.client.send(command, { abortSignal: context.signal }));
        // Commit per-item outcomes only after validating the complete batch response.
        const batchFailures: SyncFailure[] = [];
        const described = new Set<string>();
        for (const error of response.Errors ?? []) {
          if (!error.Key || !batch.includes(error.Key) || !error.Code || described.has(error.Key)) {
            throw new R2AdapterError('InvalidDeleteResponse');
          }
          described.add(error.Key);
          if (error.Code === 'NoSuchKey') continue;
          batchFailures.push({
            key: 'media/' + error.Key.slice(this.prefix.length), phase: 'delete',
            code: SAFE_CODES.has(error.Code) ? error.Code : 'R2DeleteFailed',
          });
        }
        for (const deleted of response.Deleted ?? []) {
          if (!deleted.Key || !batch.includes(deleted.Key) || described.has(deleted.Key)) {
            throw new R2AdapterError('InvalidDeleteResponse');
          }
          described.add(deleted.Key);
        }
        failures.push(...batchFailures);
      } catch (error) {
        const code = error instanceof R2AdapterError && R2_ERROR_CODES.has(error.code) ? error.code : 'R2DeleteFailed';
        // A lost/invalid response cannot confirm any current-batch deletion. Preserve
        // prior acknowledged results while marking this and every unscheduled key.
        for (const key of canonicalKeys.slice(offset)) failures.push({ key, phase: 'delete', code });
        return failures;
      }
    }
    return failures;
  }

  close(): void {
    this.closed = true;
    for (const controller of this.controllers) controller.abort();
    for (const stream of this.streams) stream.destroy(new R2AdapterError('R2Interrupted'));
    this.client.destroy();
  }
}

export function createR2Store(options: R2StoreOptions): SdkR2Store {
  return new SdkR2Store(options);
}
