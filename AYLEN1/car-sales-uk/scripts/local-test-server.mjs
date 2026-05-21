import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import adminAuth from '../api/admin-auth.js';
import aiAdmin from '../api/ai-admin.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 3340);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  text.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq < 1) return;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  });
}

loadEnvFile(path.join(ROOT, '.env.local'));
loadEnvFile(path.join(ROOT, '.env'));

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(urlPath, res) {
  let rel = urlPath.split('?')[0];
  if (rel === '/' || rel === '') rel = '/index.html';
  const filePath = path.join(ROOT, rel.replace(/^\//, ''));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    const types = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.svg': 'image/svg+xml',
      '.json': 'application/json'
    };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}

function createMockRes(res) {
  return {
    statusCode: 200,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
    },
    json(data) {
      res.writeHead(this.statusCode, {
        'Content-Type': 'application/json',
        ...this.headers
      });
      res.end(JSON.stringify(data));
    }
  };
}

async function runApiHandler(handler, req, res) {
  const body = await readBody(req);
  const mockReq = {
    method: req.method,
    body,
    headers: req.headers,
    socket: { remoteAddress: '127.0.0.1' }
  };
  const mockRes = createMockRes(res);
  try {
    await handler(mockReq, mockRes);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message || 'handler_error' }));
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/api/admin-auth') {
    await runApiHandler(adminAuth, req, res);
    return;
  }
  if (url.pathname === '/api/ai-admin') {
    await runApiHandler(aiAdmin, req, res);
    return;
  }
  serveStatic(url.pathname, res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Local test server http://127.0.0.1:${PORT}/`);
  console.log('ADMIN_PASSWORD configured:', Boolean(process.env.ADMIN_PASSWORD));
  console.log('OPENAI_API_KEY configured:', Boolean(process.env.OPENAI_API_KEY));
});
