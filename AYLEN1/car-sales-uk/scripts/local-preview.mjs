#!/usr/bin/env node
/**
 * Local storefront preview: static public/ + proxy /api/* to production.
 * Usage: node scripts/local-preview.mjs [port]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(__dirname, '../public');
const PROXY_ORIGIN = 'https://aylensale.com';
const PORT = Number(process.argv[2]) || 8889;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8'
};

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(err.code === 'ENOENT' ? 404 : 500);
      res.end(err.code === 'ENOENT' ? 'Not found' : 'Server error');
      return;
    }
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

async function proxyApi(req, res) {
  const target = PROXY_ORIGIN + req.url;
  try {
    const upstream = await fetch(target, { method: req.method, headers: { accept: req.headers.accept || '*/*' } });
    const ct = upstream.headers.get('content-type') || 'application/octet-stream';
    const body = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, {
      'Content-Type': ct,
      'Cache-Control': upstream.headers.get('cache-control') || 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(body);
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Proxy failed', detail: String(err.message || err) }));
  }
}

const server = http.createServer((req, res) => {
  const url = req.url || '/';
  if (url.startsWith('/api/')) {
    proxyApi(req, res);
    return;
  }
  let rel = decodeURIComponent(url.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC, rel));
  if (!filePath.startsWith(PUBLIC)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) {
      sendFile(res, filePath);
      return;
    }
    if (rel.endsWith('.html') || !path.extname(rel)) {
      sendFile(res, path.join(PUBLIC, 'index.html'));
      return;
    }
    res.writeHead(404);
    res.end('Not found');
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('AYLENSALE local preview → http://127.0.0.1:' + PORT + '/#products');
  console.log('API proxied to ' + PROXY_ORIGIN);
});
