// Throwaway-style static server, kept committed for tests + local play only (not part of the shipped game).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const web = path.join(__dirname, '..');
const publicDir = path.join(web, '..', 'public');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.wav': 'audio/wav' };
http.createServer((q, s) => {
  const u = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  const base = u.startsWith('/assets/') ? publicDir : web;
  const fp = path.normalize(path.join(base, u === '/' ? 'index.html' : u.replace(/^\//, '')));
  if (!fp.startsWith(base)) { s.writeHead(403); return s.end(); }
  fs.readFile(fp, (e, d) => {
    if (e) { s.writeHead(404); return s.end('404'); }
    s.writeHead(200, { 'content-type': mime[path.extname(fp)] || 'application/octet-stream' });
    s.end(d);
  });
}).listen(8642, '127.0.0.1', () => console.log('READY'));
