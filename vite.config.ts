import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Vite plugin: server-side LLM proxy.
 * Client POSTs to /llm-proxy/… with headers x-llm-base-url and x-llm-key.
 * The middleware forwards the request to the real LLM endpoint server-side,
 * bypassing all browser CORS restrictions.
 */
function llmProxy(): Plugin {
  return {
    name: 'llm-proxy',
    configureServer(server) {
      server.middlewares.use('/llm-proxy', async (req, res) => {
        const baseUrl = (req.headers['x-llm-base-url'] as string || '').replace(/\/$/, '');
        const apiKey = req.headers['x-llm-key'] as string || '';
        const suffix = req.url || '';

        if (!baseUrl) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing x-llm-base-url header' }));
          return;
        }

        const targetUrl = baseUrl + suffix;
        console.log(`[llm-proxy] ${req.method} → ${targetUrl}`);
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', async () => {
          try {
            const t0 = Date.now();
            const upstream = await fetch(targetUrl, {
              method: req.method || 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
              },
              body: chunks.length ? Buffer.concat(chunks) : undefined,
            });
            console.log(`[llm-proxy] ← ${upstream.status} in ${Date.now() - t0}ms`);
            res.writeHead(upstream.status, {
              'Content-Type': upstream.headers.get('content-type') || 'application/json',
            });
            const body = Buffer.from(await upstream.arrayBuffer());
            res.end(body);
          } catch (err: any) {
            console.error('[llm-proxy]', err?.message || err);
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: { message: `Proxy error: ${err?.message}` } }));
          }
        });
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), llmProxy()],
  server: {
    port: 5173,
    strictPort: false,
  },
})
