import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { root } from './check.mjs';
const base = process.argv.includes('--dist') ? path.join(root, 'dist') : root;
const basePath = '/leonarddacpano';
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
const allowed = new Set(['index.html','blog1.html','blog2.html','blog3.html','admin.html','.nojekyll']);
const server = http.createServer(async (request, response) => {
  try {
    if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
    let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === basePath) { response.writeHead(302, { Location: basePath + '/' }).end(); return; }
    if (pathname.startsWith(basePath + '/')) pathname = pathname.slice(basePath.length);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const relative = pathname.replace(/^\//, '');
    if (!allowed.has(relative) && !/^(assets|pfp|pp|cv)\//.test(relative)) { response.writeHead(404).end('Not found'); return; }
    const target = path.resolve(base, relative);
    if (!target.startsWith(base + path.sep)) { response.writeHead(403).end('Forbidden'); return; }
    const bytes = await fs.readFile(target);
    response.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch { response.writeHead(404).end('Not found'); }
});
const port = Number(process.env.PORT || 4173);
server.listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}/leonarddacpano/ (${process.argv.includes('--dist') ? 'production build' : 'source'})`));
process.on('SIGINT', () => server.close());
process.on('SIGTERM', () => server.close());
