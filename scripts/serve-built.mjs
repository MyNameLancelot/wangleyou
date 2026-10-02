import { URL } from 'node:url';
// Strict static server for acceptance tests. No SPA fallback or application backend.
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream';
import { realpath, stat } from 'node:fs/promises';
import { resolve, relative, extname, isAbsolute } from 'node:path';
import process from 'node:process';
import console from 'node:console';
const base = process.env.SITE_BASE || '/wangleyou/';
if (!base.startsWith('/') || !base.endsWith('/')) throw new Error('SITE_BASE must start and end with /');
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be an integer from 0 to 65535');
const root = await realpath('dist');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.md':'text/plain; charset=utf-8','.mp4':'video/mp4'};
// 视频进度与结束行为只有在支持 Range 的服务下才可验证；GitHub Pages 与这个测试服务器都返回 Range，
// 因此媒体与页面同源后，E2E 不需要再拦截第三方 CDN。
const parseRange = (header, size) => {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header || '');
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  return start >= 0 && start <= end && start < size ? { start, end } : null;
};
const server = createServer(async (request,response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
    if (!['GET','HEAD'].includes(request.method || '') || !pathname.startsWith(base)) throw new Error('Not found');
    const suffix = pathname.slice(base.length) || 'index.html';
    const file = await realpath(resolve(root,suffix));
    const rel = relative(root,file);
    const info = await stat(file);
    if (isAbsolute(rel) || rel === '..' || rel.startsWith('../') || !info.isFile()) throw new Error('Not found');
    const type = types[extname(file)] || 'application/octet-stream';
    const range = request.headers.range ? parseRange(request.headers.range, info.size) : null;
    if (request.headers.range && !range) {
      response.writeHead(416, {'Content-Type': type, 'Content-Range': `bytes */${info.size}`, 'Accept-Ranges': 'bytes'});
      response.end();
      return;
    }
    const length = range ? range.end - range.start + 1 : info.size;
    const headers = {'Content-Type': type, 'Content-Length': String(length), 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store'};
    if (range) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${info.size}`;
    response.writeHead(range ? 206 : 200, headers);
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    // pipeline 负责读错误、写错误及客户端提前断开的流销毁，不分配整文件 Buffer。
    const stream = createReadStream(file, range || undefined);
    pipeline(stream, response, error => {
      if (error && !response.destroyed) response.destroy(error);
    });
  } catch {
    if (response.headersSent) { response.destroy(); return; }
    response.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'});
    response.end('Not found');
  }
});
server.listen(port,'127.0.0.1',()=>console.log(`Strict static preview: http://127.0.0.1:${server.address().port}${base}`));
