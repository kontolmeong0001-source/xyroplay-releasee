import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Readable } from 'node:stream';
import handler from '../netlify/functions/api.mjs';
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const port = Number(process.env.PORT || 8888);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('PORT tidak valid');
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      const options = { method: req.method, headers: req.headers };
      if (!['GET','HEAD'].includes(req.method)) Object.assign(options, {body:Readable.toWeb(req), duplex:'half'});
      const out = await handler(new Request(url, options), {ip:req.socket.remoteAddress});
      res.writeHead(out.status, Object.fromEntries(out.headers));
      if (out.body) Readable.fromWeb(out.body).pipe(res); else res.end();
      return;
    }
    if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405); res.end(); return;}
    const name = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).slice(1);
    // Flat public allowlist: no source, secrets, dotfiles, database or traversal.
    const allowed = ['index.html','privacy.html','deletion.html','recovery.html','app.js','account-pages.js','app.css','site.css','brand.svg','config.js','events.js','release.js','spotify.js'];
    if (!allowed.includes(name)) {res.writeHead(404); res.end('Not found'); return;}
    const data = await readFile(path.join(root,name));
    res.writeHead(200, {'Content-Type':types[path.extname(name)] || 'application/octet-stream','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer'});
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {res.writeHead(500, {'Content-Type':'text/plain'}); res.end('Permintaan gagal');}
});
server.listen(port, '127.0.0.1', () => console.log(`Uji lokal saja: http://127.0.0.1:${port}`));
