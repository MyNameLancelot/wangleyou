import { URL } from 'node:url';
// Strict static server for acceptance tests. No SPA fallback or application backend.
import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, relative, extname, isAbsolute } from 'node:path';
import process from 'node:process';
import console from 'node:console';
const base = process.env.SITE_BASE || '/wangleyou/';
if (!base.startsWith('/') || !base.endsWith('/')) throw new Error('SITE_BASE must start and end with /');
const root = await realpath('dist');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.md':'text/plain; charset=utf-8'};
const server = createServer(async (request,response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
    if (!['GET','HEAD'].includes(request.method || '') || !pathname.startsWith(base)) throw new Error('Not found');
    const suffix = pathname.slice(base.length) || 'index.html';
    const file = await realpath(resolve(root,suffix));
    const rel = relative(root,file);
    if (isAbsolute(rel) || rel === '..' || rel.startsWith('../') || !(await stat(file)).isFile()) throw new Error('Not found');
    const data = await readFile(file);
    response.writeHead(200, {'Content-Type': types[extname(file)] || 'application/octet-stream','Cache-Control':'no-store'});
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch {
    response.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'});
    response.end('Not found');
  }
});
server.listen(4173,'127.0.0.1',()=>console.log(`Strict static preview: http://127.0.0.1:4173${base}`));
