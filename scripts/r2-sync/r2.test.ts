import { createHash } from 'node:crypto';
import { mkdtemp, realpath, rename, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createR2Store, type SdkR2Store } from './r2';
import type { LocalMedia, RemoteMedia } from './types';

const album = '2026-10-sequence01-生日';
const key = `media/${album}/嵌套/照片 空格.WEBP`;
const prefix = 'integration-run/media/';
const md5 = '0123456789abcdef0123456789abcdef';
const credentials = { accessKeyId: 'LOCAL_TEST_ACCESS', secretAccessKey: 'LOCAL_TEST_SECRET' };
const xmlEscape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const remote = (mediaKey: string): RemoteMedia => ({ key: mediaKey, size: 3, etag: md5, lastModified: '2026-10-09T00:00:00.000Z' });
function objectXml(mediaKey: string, etag = md5, extra = ''): string {
  return `<Contents><Key>${xmlEscape(mediaKey)}</Key><Size>3</Size><ETag>&quot;${etag}&quot;</ETag><LastModified>2026-10-09T00:00:00Z</LastModified>${extra}</Contents>`;
}
function listXml(contents: string, next?: string): string {
  return `<ListBucketResult><IsTruncated>${Boolean(next)}</IsTruncated>${contents}${next ? `<NextContinuationToken>${xmlEscape(next)}</NextContinuationToken>` : ''}</ListBucketResult>`;
}
function respond(response: ServerResponse, body: string, status = 200): void {
  response.writeHead(status, { 'content-type': 'application/xml' });
  response.end(body);
}
async function readBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

describe('R2 SDK adapter through a real local S3 HTTP endpoint', () => {
  let directory: string;
  const servers: Server[] = [];
  const stores: SdkR2Store[] = [];
  beforeEach(async () => { directory = await realpath(await mkdtemp(join(tmpdir(), 'r2-sdk-test-'))); });
  afterEach(async () => {
    stores.splice(0).forEach((store) => store.close());
    await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => {
      server.closeAllConnections(); server.close(() => resolve());
    })));
    await rm(directory, { recursive: true, force: true });
  });
  async function storeFor(handler: (request: IncomingMessage, response: ServerResponse) => Promise<void> | void,
    options: { timeout?: number; delay?: number } = {}): Promise<SdkR2Store> {
    const server = createServer((request, response) => {
      Promise.resolve(handler(request, response)).catch(() => { if (!response.writableEnded) respond(response, '<Error><Code>InternalError</Code></Error>', 500); });
    });
    servers.push(server);
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Local server did not bind');
    const store = createR2Store({ bucket: 'test-bucket', endpoint: `http://127.0.0.1:${address.port}`,
      credentials, isolatedPrefix: prefix, requestTimeoutMs: options.timeout ?? 2000,
      retryDelayMs: () => options.delay ?? 0 });
    stores.push(store);
    return store;
  }
  async function file(bytes: Buffer = Buffer.alloc(256 * 1024, 0x61)): Promise<LocalMedia> {
    const absolutePath = join(directory, 'source.webp');
    await writeFile(absolutePath, bytes);
    const stamp = await stat(absolutePath, { bigint: true });
    const md5Hex = createHash('md5').update(bytes).digest('hex');
    return { key, absolutePath, size: bytes.length, stamp, md5Hex,
      md5Base64: Buffer.from(md5Hex, 'hex').toString('base64'), contentType: 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable' };
  }

  it('streams the entire body, signs ContentMD5, writes media headers and verifies the ETag', async () => {
    const source = await file();
    let received: Buffer | undefined;
    let requestPath = '';
    const store = await storeFor(async (request, response) => {
      requestPath = decodeURIComponent(new URL(request.url!, 'http://local').pathname);
      expect(request.method).toBe('PUT');
      expect(request.headers['content-md5']).toBe(source.md5Base64);
      expect(request.headers['content-length']).toBe(String(source.size));
      expect(request.headers['content-type']).toBe('image/webp');
      expect(request.headers['content-disposition']).toBe('inline');
      expect(request.headers['cache-control']).toBe(source.cacheControl);
      expect(request.headers['x-amz-meta-sync-version']).toBe('1');
      expect(request.headers['x-amz-meta-sync-md5']).toBe(source.md5Hex);
      received = await readBody(request);
      response.writeHead(200, { etag: `"${source.md5Hex.toUpperCase()}"` }); response.end();
    });
    expect(await store.put(source, new AbortController().signal)).toBe(source.md5Hex);
    expect(received).toEqual(Buffer.alloc(source.size, 0x61));
    expect(requestPath).toBe(`/test-bucket/${prefix}${key.slice(6)}`);
    expect(store.stats.attempts).toBe(1);
  });

  it('reopens the file for each upload retry and caps retries at three', async () => {
    const source = await file();
    const bodies: Buffer[] = [];
    const store = await storeFor(async (request, response) => {
      bodies.push(await readBody(request));
      if (bodies.length < 3) respond(response, '<Error><Code>InternalError</Code><Message>secret response detail</Message></Error>', 500);
      else { response.writeHead(200, { etag: `"${source.md5Hex}"` }); response.end(); }
    });
    expect(await store.put(source, new AbortController().signal)).toBe(source.md5Hex);
    expect(bodies).toHaveLength(3);
    bodies.forEach((body) => expect(body).toEqual(Buffer.alloc(source.size, 0x61)));
    expect(store.stats.attempts).toBe(3);
    const failing = await storeFor(async (request, response) => {
      await readBody(request); respond(response, '<Error><Code>InternalError</Code><Message>LOCAL_TEST_SECRET</Message></Error>', 500);
    });
    await expect(failing.put(source, new AbortController().signal)).rejects.toMatchObject({ code: 'InternalError', message: 'InternalError' });
    expect(failing.stats.attempts).toBe(3);
  });

  it('never retries authentication failures, digest failures or incorrect upload ETags', async () => {
    const source = await file();
    for (const code of ['AccessDenied', 'BadDigest']) {
      const store = await storeFor(async (request, response) => {
        await readBody(request); respond(response, `<Error><Code>${code}</Code><Message>LOCAL_TEST_SECRET</Message></Error>`, 403);
      });
      await expect(store.put(source, new AbortController().signal)).rejects.toMatchObject({ code, message: code });
      expect(store.stats.attempts).toBe(1);
    }
    const store = await storeFor(async (request, response) => {
      await readBody(request); response.writeHead(200, { etag: '"wrong-2"' }); response.end();
    });
    await expect(store.put(source, new AbortController().signal)).rejects.toMatchObject({ code: 'UploadETagMismatch' });
    expect(store.stats.attempts).toBe(1);
  });

  it('refuses a file changed since hashing without a request', async () => {
    const source = await file();
    let calls = 0;
    const store = await storeFor(() => { calls++; });
    await writeFile(source.absolutePath, 'changed');
    await expect(store.put(source, new AbortController().signal)).rejects.toMatchObject({ code: 'LocalFileChanged' });
    expect(calls).toBe(0);
    expect(store.stats.attempts).toBe(1);
  });

  it('rejects a source path replaced by a symlink, even if it still points at the same inode', async () => {
    const source = await file();
    const moved = join(directory, 'moved.webp');
    await rename(source.absolutePath, moved);
    await symlink(moved, source.absolutePath);
    let calls = 0;
    const store = await storeFor(() => { calls++; });
    await expect(store.put(source, new AbortController().signal)).rejects.toMatchObject({ code: 'FileReadFailed' });
    expect(calls).toBe(0);
  });

  it('detects source changes during upload and never retries that data validation failure', async () => {
    const source = await file();
    let calls = 0;
    const store = await storeFor(async (request, response) => {
      calls++;
      await readBody(request);
      await writeFile(source.absolutePath, Buffer.alloc(source.size, 0x62));
      response.writeHead(200, { etag: `"${source.md5Hex}"` }); response.end();
    });
    await expect(store.put(source, new AbortController().signal)).rejects.toMatchObject({ code: 'LocalFileChanged' });
    expect(calls).toBe(1);
  });

  it('follows short pages through 2501 objects, filters ignored keys and preserves canonical Chinese paths', async () => {
    const canonical = Array.from({ length: 2500 }, (_, index) => `media/${album}/${index}.webp`);
    canonical.push(key);
    const pages = [canonical.slice(0, 1000), canonical.slice(1000, 1017), canonical.slice(1017, 2017), canonical.slice(2017)];
    let calls = 0;
    const store = await storeFor((request, response) => {
      const url = new URL(request.url!, 'http://local');
      expect(url.searchParams.get('prefix')).toBe(prefix);
      expect(url.searchParams.has('delimiter')).toBe(false);
      expect(url.searchParams.get('continuation-token')).toBe(calls ? `page-${calls}` : null);
      const current = pages[calls];
      const ignored = calls === 0 ? objectXml(`${prefix}themes/theme.webp`) + objectXml(`${prefix}${album}/song.mp3`) : '';
      calls++;
      respond(response, listXml(current.map((value) => objectXml(prefix + value.slice(6), md5.toUpperCase())).join('') + ignored,
        calls < pages.length ? `page-${calls}` : undefined));
    });
    const result = await store.list(new AbortController().signal);
    expect(result.size).toBe(2501);
    expect(result.get(key)).toEqual(remote(key));
    expect(store.stats.listPages).toBe(4);
  });

  it('rejects nonprogressing tokens, inconsistent keys and incomplete object schemas', async () => {
    for (const malformed of ['token', 'conflict', 'missing-key', 'missing-size', 'missing-etag', 'missing-date', 'missing-truncated']) {
      let calls = 0;
      const store = await storeFor((_request, response) => {
        calls++;
        const first = objectXml(prefix + key.slice(6));
        if (malformed === 'token') respond(response, listXml(first, 'same-token'));
        else if (malformed === 'conflict') respond(response, listXml(first + objectXml(prefix + key.slice(6), 'abcdef0123456789abcdef0123456789')));
        else if (malformed === 'missing-truncated') respond(response, '<ListBucketResult/>');
        else {
          const tag = { 'missing-key': 'Key', 'missing-size': 'Size', 'missing-etag': 'ETag', 'missing-date': 'LastModified' }[malformed]!;
          respond(response, listXml(first.replace(new RegExp(`<${tag}>.*?</${tag}>`), '')));
        }
      });
      await expect(store.list(new AbortController().signal)).rejects.toMatchObject({ code: malformed === 'token' ? 'InvalidContinuationToken' : malformed === 'conflict' ? 'ConflictingListObject' : malformed === 'missing-truncated' ? 'InvalidListResponse' : 'InvalidListObject' });
      expect(calls).toBe(malformed === 'token' ? 2 : 1);
    }
  });

  it('retries list requests finitely and does not return a partial list after a later page fails', async () => {
    let calls = 0;
    const store = await storeFor((_request, response) => {
      calls++;
      if (calls === 1) respond(response, listXml(objectXml(prefix + key.slice(6)), 'next'));
      else respond(response, '<Error><Code>InternalError</Code></Error>', 500);
    });
    await expect(store.list(new AbortController().signal)).rejects.toMatchObject({ code: 'InternalError' });
    expect(calls).toBe(4);
    expect(store.stats.listPages).toBe(1);
  });

  it('trusts HEAD metadata only when version and the complete MD5 are valid', async () => {
    for (const [version, hash, expected] of [['1', md5.toUpperCase(), md5], ['2', md5, undefined], ['1', 'bad-3', undefined], ['', md5, undefined]]) {
      const store = await storeFor((_request, response) => {
        response.writeHead(200, { 'x-amz-meta-sync-version': version!, 'x-amz-meta-sync-md5': hash! }); response.end();
      });
      expect(await store.headMd5(key, new AbortController().signal)).toBe(expected);
    }
  });

  it('guards all mutations and HEAD, validates the entire deletion set before any batch', async () => {
    let calls = 0;
    const store = await storeFor(() => { calls++; });
    const source = await file();
    const invalid = 'media/themes/theme.webp';
    await expect(store.headMd5(invalid, new AbortController().signal)).rejects.toMatchObject({ code: 'UnmanagedKey' });
    await expect(store.put({ ...source, key: invalid }, new AbortController().signal)).rejects.toMatchObject({ code: 'UnmanagedKey' });
    const valid = Array.from({ length: 1000 }, (_, index) => remote(`media/${album}/${index}.webp`));
    await expect(store.remove([...valid, remote(invalid)], new AbortController().signal)).rejects.toMatchObject({ code: 'UnmanagedKey' });
    expect(calls).toBe(0);
  });

  it('batches deletion by 1000 and reports per-object failures with safe codes', async () => {
    const objects = Array.from({ length: 1001 }, (_, index) => remote(`media/${album}/${index}.webp`));
    const batches: string[] = [];
    const store = await storeFor(async (request, response) => {
      const body = (await readBody(request)).toString();
      expect(request.headers['content-md5']).toBe(createHash('md5').update(body).digest('base64'));
      batches.push(body);
      const failed = prefix + objects[0].key.slice(6);
      const missing = prefix + objects[1].key.slice(6);
      respond(response, batches.length === 1 ? `<DeleteResult><Error><Key>${failed}</Key><Code>AccessDenied</Code><Message>LOCAL_TEST_SECRET</Message></Error><Error><Key>${missing}</Key><Code>NoSuchKey</Code></Error></DeleteResult>` : '<DeleteResult/>');
    });
    expect(await store.remove(objects, new AbortController().signal)).toEqual([{ key: objects[0].key, phase: 'delete', code: 'AccessDenied' }]);
    expect(batches.map((body) => [...body.matchAll(/<Object>/g)].length)).toEqual([1000, 1]);
    expect(batches.every((body) => body.includes(prefix))).toBe(true);
  });

  it('does not expose arbitrary server error codes/messages in request or deletion failures', async () => {
    const store = await storeFor((_request, response) => respond(response,
      '<Error><Code>LOCAL_TEST_SECRET</Code><Message>signed-url?token=secret</Message></Error>', 400));
    await expect(store.list(new AbortController().signal)).rejects.toMatchObject({ code: 'R2RequestFailed', message: 'R2RequestFailed' });
    const deletion = await storeFor(async (request, response) => {
      await readBody(request);
      respond(response, `<DeleteResult><Error><Key>${prefix}${key.slice(6)}</Key><Code>LOCAL_TEST_SECRET</Code><Message>secret</Message></Error></DeleteResult>`);
    });
    expect(await deletion.remove([remote(key)], new AbortController().signal)).toEqual([{ key, phase: 'delete', code: 'R2DeleteFailed' }]);
  });

  it('retains confirmed first-batch deletions when the second batch fails or is aborted, without scheduling a third', async () => {
    const objects = Array.from({ length: 2001 }, (_, index) => remote(`media/${album}/${index}.webp`));
    for (const mode of ['network', 'abort']) {
      let calls = 0;
      const controller = new AbortController();
      const store = await storeFor(async (request, response) => {
        calls++;
        const body = (await readBody(request)).toString();
        if (calls === 1) { respond(response, '<DeleteResult/>'); return; }
        // Retry attempts must stay on batch 2, never scheduling the final key.
        expect(body).toContain(`${prefix}${album}/1000.webp`);
        expect(body).not.toContain(`${prefix}${album}/2000.webp`);
        if (mode === 'network') request.socket.destroy();
        else controller.abort();
      });
      const failures = await store.remove(objects, controller.signal);
      expect(failures).toHaveLength(1001);
      expect(failures.map((failure) => failure.key)).toEqual(objects.slice(1000).map((object) => object.key));
      const expectedCode = mode === 'network' ? 'ECONNRESET' : 'R2Interrupted';
      expect(failures.every((failure) => failure.code === expectedCode && failure.phase === 'delete')).toBe(true);
      expect(objects.length - new Set(failures.map((failure) => failure.key)).size).toBe(1000);
      expect(calls).toBe(mode === 'network' ? 4 : 2);
    }
  });

  it('preserves first-batch per-item failures when a later batch loses its response', async () => {
    const objects = Array.from({ length: 1001 }, (_, index) => remote(`media/${album}/${index}.webp`));
    let calls = 0;
    const store = await storeFor(async (request, response) => {
      calls++;
      await readBody(request);
      if (calls === 1) respond(response, `<DeleteResult><Error><Key>${prefix}${album}/0.webp</Key><Code>AccessDenied</Code></Error></DeleteResult>`);
      else request.socket.destroy();
    });
    expect(await store.remove(objects, new AbortController().signal)).toEqual([
      { key: objects[0].key, phase: 'delete', code: 'AccessDenied' },
      { key: objects[1000].key, phase: 'delete', code: 'ECONNRESET' },
    ]);
    expect(calls).toBe(4);
  });

  it('marks the entire malformed batch and all unscheduled keys unconfirmed', async () => {
    const objects = Array.from({ length: 2001 }, (_, index) => remote(`media/${album}/${index}.webp`));
    let calls = 0;
    const store = await storeFor(async (request, response) => {
      calls++;
      await readBody(request);
      if (calls === 1) { respond(response, '<DeleteResult/>'); return; }
      respond(response, `<DeleteResult><Error><Key>${prefix}${album}/1000.webp</Key><Code>AccessDenied</Code></Error><Error><Key>${prefix}themes/not-requested.webp</Key><Code>AccessDenied</Code></Error></DeleteResult>`);
    });
    const failures = await store.remove(objects, new AbortController().signal);
    expect(failures).toEqual(objects.slice(1000).map((object) => ({ key: object.key, phase: 'delete', code: 'InvalidDeleteResponse' })));
    expect(calls).toBe(2);
  });

  it('cancels hung requests on deadline, on abort, during backoff and when closed', async () => {
    const timeoutStore = await storeFor(() => undefined, { timeout: 30 });
    await expect(timeoutStore.list(new AbortController().signal)).rejects.toMatchObject({ code: 'R2Timeout' });
    expect(timeoutStore.stats.attempts).toBe(1);
    for (const mode of ['abort', 'close', 'backoff']) {
      let requested!: () => void;
      const ready = new Promise<void>((resolve) => { requested = resolve; });
      const store = await storeFor((_request, response) => {
        requested();
        if (mode === 'backoff') respond(response, '<Error><Code>InternalError</Code></Error>', 500);
      }, { delay: 1000 });
      const controller = new AbortController();
      const promise = store.list(controller.signal);
      const assertion = expect(promise).rejects.toMatchObject({ code: 'R2Interrupted' });
      await ready;
      if (mode === 'backoff') await new Promise((resolve) => setTimeout(resolve, 20));
      if (mode === 'close') store.close(); else controller.abort();
      await assertion;
      expect(store.stats.attempts).toBe(1);
    }
  });
});
