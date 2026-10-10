import { createHash } from 'node:crypto';
import { constants, type BigIntStats } from 'node:fs';
import { lstat, open, readdir } from 'node:fs/promises';
import { basename, extname, join, parse, relative, resolve, sep } from 'node:path';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { HASH_CONCURRENCY, MAX_MEDIA_BYTES, type FileStamp, type LocalMedia } from './types';

const ALBUM_DIRECTORY = /^\d{4}-(?:0[1-9]|1[0-2])-sequence\d{2}-.+$/;
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.avif': 'image/avif', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp4': 'video/mp4',
};

function safeSegment(value: string): boolean {
  return value !== '' && value !== '.' && value !== '..' && !/[\\\0]/.test(value);
}

/** One boundary for local files and every remote operation, including removed albums. */
export function isManagedKey(key: string): boolean {
  const parts = key.split('/');
  return parts.length >= 3 && parts[0] === 'media' && parts.every(safeSegment)
    && ALBUM_DIRECTORY.test(parts[1]) && Object.hasOwn(CONTENT_TYPES, extname(parts.at(-1)!).toLowerCase());
}

function stamp(stats: BigIntStats): FileStamp {
  return { size: stats.size, mtimeNs: stats.mtimeNs, ctimeNs: stats.ctimeNs, ino: stats.ino, dev: stats.dev };
}

function sameStamp(first: FileStamp, second: FileStamp): boolean {
  return first.size === second.size && first.mtimeNs === second.mtimeNs && first.ctimeNs === second.ctimeNs
    && first.ino === second.ino && first.dev === second.dev;
}

function changed(path: string): Error {
  return new Error(`Local media changed during sync: ${path}`);
}

/** lstat each component: checking only the final file would still follow a linked parent. */
export async function assertSafeMediaStats(path: string, signal?: AbortSignal): Promise<BigIntStats> {
  const absolute = resolve(path);
  const anchor = parse(absolute).root;
  let current = anchor;
  const parts = relative(anchor, absolute).split(sep).filter(Boolean);
  let stats = await lstat(anchor, { bigint: true });
  for (const part of parts) {
    signal?.throwIfAborted();
    if (!stats.isDirectory()) throw new Error(`Media path ancestor is not a directory: ${current}`);
    current = join(current, part);
    stats = await lstat(current, { bigint: true });
    if (stats.isSymbolicLink()) throw new Error(`Media path cannot contain a symbolic link: ${current}`);
  }
  return stats;
}

type Candidate = { key: string; absolutePath: string; stamp: FileStamp };

/** Enumeration is shared with the deletion guard; the latter never opens media or rehashes. */
async function enumerate(root: string, signal?: AbortSignal): Promise<Map<string, Candidate>> {
  signal?.throwIfAborted();
  const directory = resolve(root);
  if (!(await assertSafeMediaStats(directory, signal)).isDirectory()) throw new Error(`Media root is not a directory: ${directory}`);
  const files = new Map<string, Candidate>();

  async function walk(path: string, parts: string[]) {
    signal?.throwIfAborted();
    const stats = await assertSafeMediaStats(path, signal);
    if (!stats.isDirectory()) throw new Error(`Album media directory is not a directory: ${path}`);
    const entries = (await readdir(path)).sort();
    for (const name of entries) {
      signal?.throwIfAborted();
      if (!safeSegment(name)) throw new Error(`Unsafe album media path: ${join(path, name)}`);
      const absolutePath = join(path, name);
      const childParts = [...parts, name];
      const childStats = await assertSafeMediaStats(absolutePath, signal);
      if (childStats.isDirectory()) {
        await walk(absolutePath, childParts);
        continue;
      }
      const key = `media/${childParts.join('/')}`;
      if (!isManagedKey(key)) continue;
      if (!childStats.isFile()) throw new Error(`Selected media must be a regular file: ${absolutePath}`);
      if (childStats.size > BigInt(MAX_MEDIA_BYTES)) throw new Error(`Media exceeds 200 MiB size limit: ${absolutePath}`);
      files.set(key, { key, absolutePath, stamp: stamp(childStats) });
    }
  }

  for (const name of (await readdir(directory)).sort()) {
    signal?.throwIfAborted();
    if (!safeSegment(name) || !ALBUM_DIRECTORY.test(name)) continue;
    await walk(join(directory, name), [name]);
  }
  return files;
}

function cacheControl(path: string): string {
  const name = basename(path);
  // Exact forms emitted by generate-media.ts: 12 lowercase SHA-256 chars,
  // a positive canonical WebP width, or an MP4 extension retaining source case.
  const immutable = /^.+\.[a-f0-9]{12}\.[1-9]\d*\.webp$/.test(name) || /^.+\.[a-f0-9]{12}\.[mM][pP]4$/.test(name);
  return immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate';
}

async function hashMedia(file: Candidate, signal: AbortSignal): Promise<LocalMedia> {
  signal.throwIfAborted();
  const pathStats = await assertSafeMediaStats(file.absolutePath, signal);
  if (!pathStats.isFile() || !sameStamp(file.stamp, stamp(pathStats))) throw changed(file.absolutePath);
  // O_NOFOLLOW protects the final component against replacement between lstat and open.
  const handle = await open(file.absolutePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    signal.throwIfAborted();
    const before = await handle.stat({ bigint: true });
    signal.throwIfAborted();
    if (!before.isFile() || !sameStamp(file.stamp, stamp(before))) throw changed(file.absolutePath);
    const hash = createHash('md5');
    const stream = handle.createReadStream({ autoClose: false, signal });
    let bytes = 0;
    // Pipeline owns stream errors and destruction even if cancellation races with creation.
    await pipeline(stream, new Writable({
      write(chunk, _encoding, callback) {
        try {
          signal.throwIfAborted();
          bytes += chunk.length;
          if (bytes > MAX_MEDIA_BYTES || BigInt(bytes) > file.stamp.size) throw changed(file.absolutePath);
          hash.update(chunk);
          callback();
        } catch (error) { callback(error instanceof Error ? error : new Error('HASH_FAILED')); }
      },
    }), { signal });
    signal.throwIfAborted();
    const after = await handle.stat({ bigint: true });
    const finalPathStats = await assertSafeMediaStats(file.absolutePath, signal);
    if (BigInt(bytes) !== file.stamp.size || !sameStamp(file.stamp, stamp(after))
      || !finalPathStats.isFile() || !sameStamp(file.stamp, stamp(finalPathStats))) throw changed(file.absolutePath);
    const digest = hash.digest();
    return {
      ...file, size: Number(file.stamp.size), md5Hex: digest.toString('hex'), md5Base64: digest.toString('base64'),
      contentType: CONTENT_TYPES[extname(file.absolutePath).toLowerCase()], cacheControl: cacheControl(file.absolutePath),
    };
  } finally {
    if (handle.fd !== -1) await handle.close();
  }
}

export async function scanMedia(root: string, signal: AbortSignal): Promise<Map<string, LocalMedia>> {
  const candidates = [...(await enumerate(root, signal)).values()];
  const controller = new AbortController();
  const combined = AbortSignal.any([signal, controller.signal]);
  const results = new Map<string, LocalMedia>();
  let next = 0;
  let failure: unknown;
  async function worker() {
    try {
      while (next < candidates.length) {
        combined.throwIfAborted();
        const candidate = candidates[next++];
        const file = await hashMedia(candidate, combined);
        results.set(file.key, file);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        failure = error;
        controller.abort(error);
      }
      throw error;
    }
  }
  // Await every worker even after one fails, so all read streams and handles close.
  await Promise.allSettled(Array.from({ length: Math.min(HASH_CONCURRENCY, candidates.length) }, worker));
  if (controller.signal.aborted) throw failure;
  signal.throwIfAborted();
  return new Map(candidates.map(file => [file.key, results.get(file.key)!]));
}

export async function assertSnapshotUnchanged(root: string, files: Map<string, LocalMedia>): Promise<void> {
  const current = await enumerate(root);
  if (current.size !== files.size) throw changed(resolve(root));
  for (const [key, file] of files) {
    const candidate = current.get(key);
    if (!candidate || file.absolutePath !== candidate.absolutePath || !sameStamp(file.stamp, candidate.stamp)) throw changed(file.absolutePath);
  }
}
