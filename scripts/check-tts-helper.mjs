// Exercises the packaged executable directly, without installing registry entries.
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { once } from 'node:events';
import { request } from 'node:http';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';

const executable = resolve(process.argv[2] ?? '.output/tts-helper/windows-x64/DungeonTtsHelper.exe');
const children = new Set();
function host(extension = 'dungeon-extension-v2@oratorian') {
  const child = spawn(executable, ['test-manifest.json', extension], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  children.add(child);
  let bytes = Buffer.alloc(0);
  const messages = [], waiters = [];
  const exited = once(child, 'exit');
  child.stdout.on('data', chunk => {
    bytes = Buffer.concat([bytes, chunk]);
    while (bytes.length >= 4 && bytes.length >= 4 + bytes.readUInt32LE(0)) {
      const size = bytes.readUInt32LE(0);
      const message = JSON.parse(bytes.subarray(4, 4 + size));
      bytes = bytes.subarray(4 + size);
      if (waiters.length) waiters.shift()(message); else messages.push(message);
    }
  });
  const next = () => messages.length ? Promise.resolve(messages.shift()) : new Promise(resolve => waiters.push(resolve));
  function send(value, fragmented = false) {
    const body = Buffer.from(JSON.stringify(value));
    const prefix = Buffer.alloc(4); prefix.writeUInt32LE(body.length);
    if (fragmented) { child.stdin.write(prefix.subarray(0, 1)); child.stdin.write(prefix.subarray(1)); child.stdin.write(body.subarray(0, 3)); child.stdin.write(body.subarray(3)); }
    else child.stdin.write(Buffer.concat([prefix, body]));
  }
  return { child, send, next, exited };
}
function http(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port: 4177, path, headers: { Host: 'localhost:4177', ...options.headers }, method: options.method ?? 'GET' }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject); req.setTimeout(5000, () => req.destroy(new Error('HTTP timeout'))); req.end();
  });
}
const deadline = setTimeout(() => { for (const child of children) child.kill(); throw new Error('Helper smoke timed out'); }, 30000);
try {
  // Fail rather than interfering with an existing manual or native helper server.
  const vacant = createServer(); vacant.listen(4177, '127.0.0.1'); await once(vacant, 'listening');
  await new Promise(resolve => vacant.close(resolve));
  const app = host(); app.send({ type: 'start', protocol: 1 }, true);
  assert.deepEqual(await app.next(), { type: 'ready', protocol: 1, version: '1.0.0', engineUrl: 'http://localhost:4177/engine.html' });
  const page = await http('/engine.html'); assert.equal(page.status, 200);
  assert.equal(page.headers['cross-origin-opener-policy'], 'same-origin');
  assert.equal(page.headers['cross-origin-embedder-policy'], 'require-corp');
  assert.equal(page.headers['cross-origin-resource-policy'], 'same-origin');
  assert.ok(page.headers['content-security-policy'].includes("'wasm-unsafe-eval'"));
  const asset = page.body.toString().match(/src="([^"]+\.js)"/)[1];
  assert.equal((await http(asset)).status, 200);
  assert.equal((await http('/runtime/ort-wasm-simd-threaded.wasm', { method: 'HEAD' })).status, 200);
  for (const path of ['/../DungeonTtsHelper.exe', '/%2e%2e/DungeonTtsHelper.exe', '/models/vocoder.onnx', '/engine.html?other=1']) assert.equal((await http(path)).status, 404);
  assert.equal((await http('/engine.html', { headers: { Host: 'example.com' } })).status, 403);
  assert.equal((await http('/engine.html', { headers: { Origin: 'https://example.com' } })).status, 403);
  assert.equal((await http('/engine.html', { method: 'POST' })).status, 405);
  const conflict = host(); conflict.send({ type: 'start', protocol: 1 });
  assert.match((await conflict.next()).message, /Port 4177 is busy/); await conflict.exited;
  app.child.stdin.end(); assert.equal((await app.exited)[0], 0);
  await assert.rejects(http('/engine.html'));
  const incompatible = host(); incompatible.send({ type: 'start', protocol: 2 });
  assert.equal((await incompatible.next()).type, 'error'); await incompatible.exited;
  const wrong = host('unrelated@example.org'); assert.equal((await wrong.exited)[0], 1);
  const restart = host('dungeon-extension-betas@oratorian'); restart.send({ type: 'start', protocol: 1 });
  assert.equal((await restart.next()).type, 'ready'); restart.child.stdin.end(); await restart.exited;
  console.log('PASS: native framing, ready handshake, bundled assets, isolation headers, HTTP restrictions, port conflict, EOF shutdown, restart, protocol and extension validation.');
} finally { clearTimeout(deadline); for (const child of children) if (child.exitCode === null) child.kill(); }
