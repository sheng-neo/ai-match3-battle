/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';

/**
 * 本地开发版 /api/taunt：与 Vercel serverless（api/taunt.ts）共用 api/_lib/tauntHandler。
 * 通过 ssrLoadModule 按需编译 TS，key 只存在于 Node 进程，绝不进前端包。
 */
function tauntDevApi(): Plugin {
  return {
    name: 'taunt-dev-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/taunt', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('{"error":"method not allowed"}');
          return;
        }
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', async () => {
          res.setHeader('content-type', 'application/json');
          try {
            const mod = await server.ssrLoadModule('/api/_lib/tauntHandler.ts');
            const out = await mod.handleTauntRequest(JSON.parse(body || '{}'));
            res.end(JSON.stringify(out));
          } catch {
            // 任何失败都返回降级信号，前端无缝走本地台词库
            res.end(JSON.stringify({ line: '', source: 'fallback' }));
          }
        });
      });

      // 见证者计数（dev：内存计数，含一个起始基数方便观察滚动动画）
      let devWitness = 42;
      server.middlewares.use('/api/witness', (req, res) => {
        res.setHeader('content-type', 'application/json');
        if (req.method === 'POST') devWitness += 1;
        res.end(JSON.stringify({ count: devWitness }));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // 把 .env.local 的服务端变量注入 process.env（无 VITE_ 前缀的变量 Vite 不会打进前端）
  const env = loadEnv(mode, process.cwd(), '');
  for (const key of ['OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY', 'TAUNT_MODEL', 'TAUNT_BASE_URL']) {
    if (env[key]) process.env[key] = env[key];
  }

  return {
    base: './', // 相对路径：兼容 GitHub Pages 子路径与任意托管
    plugins: [tauntDevApi()],
    server: { host: true, port: Number(process.env.PORT) || 5173 },
    build: { chunkSizeWarningLimit: 1800 },
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
    },
  };
});
