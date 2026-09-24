import { build } from 'vite';
import { createServer } from 'node:http';
import { readFile, mkdir, copyFile, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(repo, '.output/tts-firefox-prototype');
await build({
  configFile: false, root: resolve(repo, 'prototypes/tts-firefox'), publicDir: false,
  resolve: { conditions: ['onnxruntime-web-use-extern-wasm'] },
  build: { outDir: output, emptyOutDir: true, rollupOptions: {
    input: { ...(!process.argv.includes('--engine-only') ? { benchmark: resolve(repo, 'prototypes/tts-firefox/index.html') } : {}), engine: resolve(repo, 'prototypes/tts-firefox/engine.html') },
  } },
});
await mkdir(resolve(output, 'runtime'), { recursive: true });
for (const name of ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs']) {
  await copyFile(resolve(repo, 'node_modules/onnxruntime-web/dist', name), resolve(output, 'runtime', name));
}
if (!process.argv.includes('--build-only')) {
  let probe = null;
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm' };
  const server = createServer(async (req, res) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.headers.host !== 'localhost:4177') { res.writeHead(403).end(); return; }
    if (req.url === '/probe-result') {
      if (req.method === 'POST' && req.headers.origin === 'http://localhost:4177') {
        let body = '';
        for await (const chunk of req) { body += chunk; if (body.length > 8192) { res.writeHead(413).end(); return; } }
        try {
          const value = JSON.parse(body);
          probe = { userAgent: String(value.userAgent).slice(0, 256), isolated: value.isolated === true,
            secure: value.secure === true, sharedMemory: value.sharedMemory === true, wasmThreads: value.wasmThreads === true,
            logicalCores: Number(value.logicalCores) || 1, ortThreads: Number(value.ortThreads) || 0,
            ortExecutionPassed: value.ortExecutionPassed === true };
          await writeFile(resolve(output, 'firefox-capabilities.json'), JSON.stringify(probe, null, 2));
          res.writeHead(204).end();
        } catch { res.writeHead(400).end(); }
      } else if (req.method === 'GET') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(probe)); }
      else res.writeHead(405).end();
      return;
    }
    if (req.method !== 'GET') { res.writeHead(405).end(); return; }
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost:4177').pathname);
      const path = resolve(output, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!path.startsWith(output + sep)) { res.writeHead(403).end(); return; }
      const contents = await readFile(path);
      res.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream');
      res.end(contents);
    } catch { res.writeHead(404).end(); }
  });
  server.listen(4177, '127.0.0.1', () => console.log('Firefox TTS prototype: http://localhost:4177/ (Ctrl+C to stop)'));
}
