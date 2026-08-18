'use strict';
// Dev-only static server for the site. Zero dependencies.
//   node tools/serve.js [port]
// Serves the repo root (the parent of tools/) at http://localhost:8080/.

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = path.resolve(__dirname, '..');
const PORT = parseInt(process.argv[2] || process.env.PORT || '8080', 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.txt':  'text/plain; charset=utf-8',
  '.md':   'text/plain; charset=utf-8'
};

function send(res, code, type, body) {
  res.writeHead(code, {
    'Content-Type': type,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(url.parse(req.url).pathname || '/');
  } catch (e) {
    return send(res, 400, 'text/plain; charset=utf-8', 'Bad request');
  }
  if (pathname.endsWith('/')) pathname += 'index.html';

  // Resolve inside ROOT only — no traversal out of the repo.
  const target = path.resolve(ROOT, '.' + pathname.replace(/\\/g, '/'));
  if (target !== ROOT && !target.startsWith(ROOT + path.sep))
    return send(res, 403, 'text/plain; charset=utf-8', 'Forbidden');

  fs.stat(target, (err, st) => {
    if (err || !st.isFile()) {
      const nf = path.join(ROOT, '404.html');
      return fs.readFile(nf, (e2, buf) => {
        if (e2) return send(res, 404, 'text/plain; charset=utf-8', 'Not found');
        send(res, 404, MIME['.html'], buf);
      });
    }
    fs.readFile(target, (e3, buf) => {
      if (e3) return send(res, 500, 'text/plain; charset=utf-8', 'Read error');
      send(res, 200, MIME[path.extname(target).toLowerCase()] || 'application/octet-stream', buf);
    });
  });
});

server.listen(PORT, () => {
  console.log('garnet-habits: serving ' + ROOT + ' at http://localhost:' + PORT + '/');
});
