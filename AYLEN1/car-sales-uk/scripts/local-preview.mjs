#!/usr/bin/env node
/**
 * Local storefront preview.
 *   node scripts/local-preview.mjs [port]        — public/ + /api/* → production
 *   node scripts/local-preview.mjs --prod [port] — full mirror of aylensale.com (same as phone)
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(__dirname, '../public');
const PROXY_ORIGIN = 'https://aylensale.com';
const args = process.argv.slice(2).filter((a) => a !== '--prod');
const PROXY_ALL = process.argv.includes('--prod');
const PORT = Number(args[0]) || 8889;

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

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function proxyUpstream(req, res) {
  const target = PROXY_ORIGIN + req.url;
  try {
    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readRequestBody(req);
    const headers = { accept: req.headers.accept || '*/*' };
    if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
    if (req.headers['if-none-match']) headers['if-none-match'] = req.headers['if-none-match'];
    if (req.headers['if-modified-since']) headers['if-modified-since'] = req.headers['if-modified-since'];
    const upstream = await fetch(target, { method: req.method, headers, body });
    const ct = upstream.headers.get('content-type') || 'application/octet-stream';
    const responseBody = Buffer.from(await upstream.arrayBuffer());
    const outHeaders = {
      'Content-Type': ct,
      'Cache-Control': upstream.headers.get('cache-control') || 'no-cache',
      'Access-Control-Allow-Origin': '*'
    };
    const etag = upstream.headers.get('etag');
    if (etag) outHeaders.ETag = etag;
    res.writeHead(upstream.status, outHeaders);
    res.end(responseBody);
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Proxy failed', detail: String(err.message || err) }));
  }
}

const server = http.createServer((req, res) => {
  const url = req.url || '/';
  if (PROXY_ALL || url.startsWith('/api/')) {
    proxyUpstream(req, res);
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
  if (PROXY_ALL) {
    console.log('Mode: full production mirror (same as phone on aylensale.com)');
  } else {
    console.log('Mode: local public/ build · API proxied to ' + PROXY_ORIGIN);
    console.log('Tip: npm run serve:prod — open exact production site locally');
  }
});
