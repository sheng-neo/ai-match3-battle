/**
 * 生产服务器（红警同款单容器模式）：同端口托管静态构建产物 + /api/taunt + /health。
 * 零 npm 依赖（Node 22 内置 http/fetch），由 Dockerfile 直接启动。
 * 嘴炮核心逻辑复用 api/_lib/tauntHandler.ts（构建期由 esbuild/tsc 转译到 server/tauntHandler.mjs）。
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleTauntRequest } from './tauntHandler.mjs';

const PORT = Number(process.env.PORT || 8080);
const STATIC_DIR = process.env.STATIC_DIR || join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist');

// ---- 见证者计数（持久化到 DATA_DIR；无卷时退化为内存，重启清零但不报错）----
const DATA_DIR = process.env.DATA_DIR || join(fileURLToPath(new URL('.', import.meta.url)), '..', '.data');
const WITNESS_FILE = join(DATA_DIR, 'witness.json');
let witness = { count: 0 };
try {
  mkdirSync(DATA_DIR, { recursive: true });
  if (existsSync(WITNESS_FILE)) {
    const parsed = JSON.parse(readFileSync(WITNESS_FILE, 'utf8'));
    if (parsed && typeof parsed.count === 'number') witness = parsed;
  }
} catch {
  /* 退化为内存计数 */
}
function saveWitness() {
  try {
    writeFileSync(WITNESS_FILE, JSON.stringify(witness));
  } catch {
    /* 忽略：无写权限时仅内存计数 */
  }
}
const witnessSeen = new Set();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

// 简易令牌桶限流（每 IP 每分钟 20 次）
const buckets = new Map();
function rateLimitOk(key) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) {
    b = { tokens: 20, last: now };
    buckets.set(key, b);
  }
  b.tokens = Math.min(20, b.tokens + ((now - b.last) * 20) / 60000);
  b.last = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  if (buckets.size > 5000) buckets.clear();
  return true;
}

function readBody(req, limit = 4096) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => {
      body += c;
      if (body.length > limit) {
        reject(new Error('too_large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname;

  if (path === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{"ok":true}');
    return;
  }

  if (path === '/api/witness') {
    res.setHeader('content-type', 'application/json');
    if (req.method === 'POST') {
      const ip = (req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').toString().split(',')[0].trim();
      if (ip && !witnessSeen.has(ip)) {
        witnessSeen.add(ip);
        witness.count += 1;
        saveWitness();
        if (witnessSeen.size > 100000) witnessSeen.clear();
      }
    }
    res.writeHead(200);
    res.end(JSON.stringify({ count: witness.count }));
    return;
  }

  if (path === '/api/taunt') {
    res.setHeader('content-type', 'application/json');
    if (req.method !== 'POST') {
      res.writeHead(405);
      res.end('{"error":"method not allowed"}');
      return;
    }
    const ip = (req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? 'unknown').toString().split(',')[0].trim();
    if (!rateLimitOk(ip)) {
      res.writeHead(200);
      res.end('{"line":"","source":"fallback"}');
      return;
    }
    try {
      const body = await readBody(req);
      const out = await handleTauntRequest(JSON.parse(body || '{}'));
      res.writeHead(200);
      res.end(JSON.stringify(out));
    } catch {
      res.writeHead(200);
      res.end('{"line":"","source":"fallback"}');
    }
    return;
  }

  // 静态文件（含路径穿越防护）
  try {
    const safe = normalize(path).replace(/^(\.\.[/\\])+/, '');
    let file = join(STATIC_DIR, safe === '/' ? 'index.html' : safe);
    let st = await stat(file).catch(() => null);
    if (!st || st.isDirectory()) {
      file = join(STATIC_DIR, 'index.html'); // 单页兜底
      st = await stat(file);
    }
    const data = await readFile(file);
    const type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
    const cache = file.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
    res.writeHead(200, { 'content-type': type, 'cache-control': cache });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
});

server.listen(PORT, () => {
  console.log(`[ai-match3] serving ${STATIC_DIR} on :${PORT}`);
});
