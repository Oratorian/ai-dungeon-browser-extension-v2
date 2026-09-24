// Smoke-test the packaged CSP and offscreen runtime using a fresh Chromium test profile.
// Requires: npm run build; node scripts/tts-firefox-prototype.mjs --build-only
import { cp, copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const executable = process.argv[2];
if (!executable) throw new Error('Pass a Chromium/Chrome for Testing executable as the first argument.');
const root = resolve('.output/chrome-tts-smoke-' + Date.now());
const extension = resolve(root, 'extension');
const profile = resolve(root, 'profile');
await cp(resolve('.output/chrome-mv3'), extension, { recursive: true });
await mkdir(profile, { recursive: true });
const probe = (await readdir('.output/tts-firefox-prototype/assets')).find(name => name.startsWith('probe-worker-'));
if (!probe) throw new Error('Build the Firefox prototype first to provide the local ONNX test model.');
await copyFile(resolve('.output/tts-firefox-prototype/assets', probe), resolve(extension, 'assets/thread-probe.js'));
const processHandle = spawn(executable, ['--headless=new', '--no-first-run', '--no-default-browser-check',
  '--disable-background-networking', '--remote-debugging-port=0', '--user-data-dir=' + profile,
  '--disable-extensions-except=' + extension, '--load-extension=' + extension, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let launchError;
processHandle.on('error', error => launchError = error);
const delay = () => new Promise(resolve => setTimeout(resolve, 200));
async function until(get) {
  for (let i = 0; i < 100; i++) {
    if (launchError) throw launchError;
    try { const value = await get(); if (value) return value; } catch {}
    await delay();
  }
  throw new Error('Timed out waiting for the Chromium test context.');
}
const sockets = [];
async function connection(url) {
  const socket = new WebSocket(url); sockets.push(socket);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const data = JSON.parse(event.data); const task = pending.get(data.id);
    if (!task) return;
    clearTimeout(task.timer); pending.delete(data.id);
    data.error ? task.reject(new Error(JSON.stringify(data.error))) : task.resolve(data.result);
  };
  return (method, params = {}) => new Promise((resolve, reject) => {
    const key = ++id;
    const timer = setTimeout(() => { pending.delete(key); reject(new Error(method + ' timed out')); }, 30000);
    pending.set(key, { resolve, reject, timer }); socket.send(JSON.stringify({ id: key, method, params }));
  });
}
try {
  const port = await until(async () => (await readFile(resolve(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]);
  const targets = async () => (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const background = await until(async () => {
    for (const target of (await targets()).filter(target => target.type === 'service_worker' && target.url.startsWith('chrome-extension://'))) {
      const inspect = await connection(target.webSocketDebuggerUrl);
      const manifest = await inspect('Runtime.evaluate', { expression: 'chrome.runtime.getManifest().name', returnByValue: true });
      if (manifest.result?.value === 'Dungeon Extension v2 Resurrected') return target;
    }
  });
  const bg = await connection(background.webSocketDebuggerUrl);
  const creation = await bg('Runtime.evaluate', { expression: `chrome.offscreen.createDocument({url:'tts-offscreen.html',reasons:['WORKERS'],justification:'Local threading smoke test'})`, awaitPromise: true, returnByValue: true });
  if (creation.exceptionDetails) throw new Error(JSON.stringify(creation.exceptionDetails));
  const offscreen = await until(async () => (await targets()).find(target => target.url.endsWith('/tts-offscreen.html')));
  const page = await connection(offscreen.webSocketDebuggerUrl);
  const probeResult = await page('Runtime.evaluate', { expression: `new Promise((resolve,reject)=>{ const worker=new Worker(chrome.runtime.getURL('assets/thread-probe.js')); worker.onmessage=({data})=>{worker.terminate();resolve(data)};worker.onerror=e=>{worker.terminate();reject(new Error(e.message))}; worker.postMessage({type:'capabilities'}); })`, awaitPromise: true, returnByValue: true });
  if (probeResult.exceptionDetails) throw new Error(JSON.stringify(probeResult.exceptionDetails));
  const result = probeResult.result.value;
  console.log(JSON.stringify(result, null, 2));
  await writeFile(resolve('.output/chrome-tts-capabilities.json'), JSON.stringify(result, null, 2));
  if (!result.isolated || !result.sharedMemory || result.ortThreads !== 4 || !result.ortExecutionPassed) throw new Error('Offscreen ONNX threading probe failed.');
  await bg('Runtime.evaluate', { expression: 'chrome.offscreen.closeDocument()', awaitPromise: true });
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const browser = await connection(version.webSocketDebuggerUrl);
  await browser('Browser.close').catch(() => {});
} finally {
  for (const socket of sockets) socket.close();
  processHandle.kill();
}
