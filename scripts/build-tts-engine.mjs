import { build } from 'vite';
import { mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const root = resolve(repo, 'native/tts-helper/engine');
const output = resolve(repo, '.output/tts-engine');
await build({
  configFile: false, root, publicDir: false,
  resolve: { conditions: ['onnxruntime-web-use-extern-wasm'] },
  build: { outDir: output, emptyOutDir: true, rollupOptions: {
    input: { engine: resolve(root, 'engine.html') },
  } },
});
await mkdir(resolve(output, 'runtime'), { recursive: true });
for (const name of ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs']) {
  await copyFile(resolve(repo, 'node_modules/onnxruntime-web/dist', name), resolve(output, 'runtime', name));
}
