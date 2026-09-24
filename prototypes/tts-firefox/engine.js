import TtsWorker from '../../src/tts/worker.js?worker';
import { narrationThreadCount } from '../../src/tts/capabilities';
import './style.css';

const status = document.getElementById('status');
const required = ['onnx/tts.json', 'onnx/unicode_indexer.json',
  ...['duration_predictor', 'text_encoder', 'vector_estimator', 'vocoder'].map(name => `onnx/${name}.onnx`),
  'voice_styles/M5.json', 'voice_styles/F5.json'];
const cache = caches.open('de-tts-firefox-benchmark-v1');
const key = path => new URL('/models/' + path, location.origin).href;
const assets = new Map();
let nextAsset = 0;
let request;
let worker;
let allowDownload = false;
let disconnected = false;
const send = payload => window.postMessage({ type: 'de-tts-host-response', payload }, location.origin);
function report(message) { status.textContent = message; send({ type: 'progress', message }); }

function startWorker() {
  worker = new TtsWorker();
  worker.onerror = event => {
    if (request) send({ type: 'error', id: request.id, message: event.message || 'Narration worker failed.' });
    request = undefined;
  };
  worker.onmessage = async ({ data }) => {
    if (data.type === 'asset') {
      try {
        if (!required.includes(data.path)) throw new Error('Invalid model asset.');
        const storage = await cache;
        const hit = await storage.match(key(data.path));
        if (!hit && !allowDownload) throw new Error('Models are missing. Click Initialize TTS.');
        report(`${hit ? 'Loading cached' : 'Downloading'} ${data.path}`);
        const bytes = hit ? await hit.arrayBuffer() : await new Promise((resolve, reject) => {
          const id = ++nextAsset;
          const timer = setTimeout(() => { assets.delete(id); reject(new Error('Model download timed out.')); }, 15 * 60 * 1000);
          assets.set(id, { resolve, reject, timer });
          window.postMessage({ type: 'de-tts-prototype-asset', id, path: data.path }, location.origin);
        });
        if (!hit) {
          try { await storage.put(key(data.path), new Response(bytes)); }
          catch { report('Model cache full; using downloaded files for this session.'); }
        }
        if (!disconnected) worker.postMessage({ type: 'asset', id: data.id, bytes }, [bytes]);
      } catch (error) { if (!disconnected) worker.postMessage({ type: 'asset', id: data.id, error: String(error) }); }
      return;
    }
    if (data.type === 'progress') { report(data.message); return; }
    if (!request) return;
    send({ ...data, id: request.id });
    status.textContent = data.type === 'ready' ? `Ready, ${data.threads} CPU threads.`
      : data.type === 'audio' ? 'Audio generated. Waiting for the next line.' : data.message;
    request = undefined;
  };
}
window.addEventListener('message', async ({ source, origin, data }) => {
  if (source !== window || origin !== location.origin || !data) return;
  if (data.type === 'de-tts-host-disconnected') {
    disconnected = true; worker?.terminate();
    for (const asset of assets.values()) { clearTimeout(asset.timer); asset.reject(new Error('Disconnected.')); }
    assets.clear(); status.textContent = 'Disconnected. Retry Initialize TTS from VN to open a new engine.'; return;
  }
  if (data.type === 'de-tts-prototype-result') {
    const asset = assets.get(data.id);
    if (asset) { clearTimeout(asset.timer); assets.delete(data.id); data.error ? asset.reject(new Error(data.error)) : asset.resolve(data.bytes); }
    return;
  }
  if (data.type !== 'de-tts-host-request' || disconnected) return;
  const command = data.payload;
  if (!Number.isSafeInteger(command?.id) || !['status', 'load', 'speak'].includes(command.type)) return;
  if (request) { send({ type: 'error', id: command.id, message: 'Engine is busy.' }); return; }
  request = command;
  try {
    if (command.type === 'status') {
      const storage = await cache;
      const complete = (await Promise.all(required.map(path => storage.match(key(path))))).every(Boolean);
      send({ type: 'cache', id: command.id, complete }); request = undefined;
    } else {
      if (command.type === 'load') allowDownload = command.download === true;
      if (!worker) startWorker();
      worker.postMessage({ ...command, threads: narrationThreadCount(command.threads) });
    }
  } catch (error) { send({ type: 'error', id: command.id, message: String(error) }); request = undefined; }
});
window.addEventListener('pagehide', () => worker?.terminate());
if (crossOriginIsolated) window.postMessage({ type: 'de-tts-host-ready' }, location.origin);
else status.textContent = 'This page is not isolated. Start the supplied local server and retry Initialize TTS.';
