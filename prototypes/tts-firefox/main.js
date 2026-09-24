import WorkerEngine from '../../src/tts/worker.js?worker';
import ProbeWorker from './probe-worker.js?worker';
import { narrationWav } from '../../src/tts/playback';
import './style.css';

const $ = id => document.getElementById(id);
const pendingAssets = new Map();
let assetId = 0;
let bridge = false;
let capabilities;
let active;
let running = false;
let audioUrl;
let results = [];
let benchmarkConfig;
const cache = caches.open('de-tts-firefox-benchmark-v1');
window.addEventListener('message', ({ source, origin, data }) => {
  if (source !== window || origin !== location.origin || !data) return;
  if (data.type === 'de-tts-prototype-pong') {
    bridge = true; $('bridge').textContent = 'Extension background download helper connected.'; updateButton();
  }
  if (data.type === 'de-tts-prototype-result') {
    const pending = pendingAssets.get(data.id);
    if (!pending) return;
    pendingAssets.delete(data.id); clearTimeout(pending.timer);
    data.error ? pending.reject(new Error(data.error)) : pending.resolve(data.bytes);
  }
});
function updateButton() {
  $('run').disabled = running || !bridge || !capabilities?.isolated || !capabilities?.sharedMemory || !capabilities?.wasmThreads || !capabilities?.ortExecutionPassed;
}
async function asset(path) {
  const storage = await cache;
  const key = new URL('/models/' + path, location.origin).href;
  const hit = await storage.match(key);
  if (hit) return hit.arrayBuffer();
  $('status').textContent = 'Downloading through background helper: ' + path;
  const id = ++assetId;
  const bytes = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pendingAssets.delete(id); reject(new Error('Model download timed out.')); }, 15 * 60 * 1000);
    pendingAssets.set(id, { resolve, reject, timer });
    window.postMessage({ type: 'de-tts-prototype-asset', id, path }, location.origin);
  });
  await storage.put(key, new Response(bytes));
  return bytes;
}
function engine(WorkerType = WorkerEngine) {
  const worker = new WorkerType();
  let pending;
  let disposed = false;
  worker.onmessage = async ({ data }) => {
    if (data.type === 'asset') {
      try {
        const bytes = await asset(data.path);
        if (!disposed) worker.postMessage({ type: 'asset', id: data.id, bytes }, [bytes]);
      } catch (error) { if (!disposed) worker.postMessage({ type: 'asset', id: data.id, error: String(error) }); }
      return;
    }
    if (data.type === 'progress') { $('status').textContent = data.message; return; }
    if (!pending) return;
    clearTimeout(pending.timer);
    data.type === 'error' ? pending.reject(new Error(data.message)) : pending.resolve(data);
    pending = undefined;
  };
  worker.onerror = event => {
    if (pending) { clearTimeout(pending.timer); pending.reject(new Error(event.message)); pending = undefined; }
  };
  return {
    request(message) {
      return new Promise((resolve, reject) => {
        if (disposed || pending) { reject(new Error('Engine unavailable.')); return; }
        const timer = setTimeout(() => { pending = undefined; reject(new Error('Engine request timed out.')); }, 15 * 60 * 1000);
        pending = { resolve, reject, timer }; worker.postMessage(message);
      });
    },
    dispose() { disposed = true; worker.terminate(); if (pending) { clearTimeout(pending.timer); pending.reject(new Error('Stopped.')); pending = undefined; } },
  };
}

async function probe() {
  const instance = engine(ProbeWorker);
  try {
    capabilities = await instance.request({ type: 'capabilities' });
    $('capabilities').textContent = JSON.stringify(capabilities, null, 2);
    // Read-only capability evidence collected by the loopback test server.
    await fetch('/probe-result', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userAgent: navigator.userAgent, ...capabilities }) });
  } catch (error) { $('capabilities').textContent = String(error); }
  finally { instance.dispose(); updateButton(); }
}
void probe();
window.postMessage({ type: 'de-tts-prototype-ping' }, location.origin);
setTimeout(() => {
  if (!bridge) { $('bridge').textContent = 'Load the Firefox build from this branch, then refresh this page.'; window.postMessage({ type: 'de-tts-prototype-ping' }, location.origin); }
}, 2000);

$('stop').onclick = () => { active?.dispose(); };
$('run').onclick = async () => {
  const text = $('text').value.trim();
  if (!text || text.length > 20000) { $('status').textContent = 'Enter 1-20,000 characters.'; return; }
  running = true; results = []; $('results').replaceChildren(); updateButton();
  $('settings').disabled = true; $('stop').disabled = false;
  benchmarkConfig = { voice: $('voice').value, steps: Number($('steps').value), characters: text.length };
  const speak = { type: 'speak', text, voice: benchmarkConfig.voice, steps: benchmarkConfig.steps };
  try {
    for (const threads of [1, 2, 4]) {
      active = engine();
      const start = performance.now();
      const ready = await active.request({ type: 'load', threads });
      const loadSeconds = (performance.now() - start) / 1000;
      if (ready.threads !== threads) throw new Error(`Requested ${threads} threads but runtime selected ${ready.threads}.`);
      await active.request(speak); // Warm up independently of model loading and measured runs.
      const times = [];
      let audio;
      for (let run = 0; run < 3; run++) {
        audio = await active.request(speak);
        times.push(audio.seconds);
      }
      const median = [...times].sort((a,b) => a-b)[1];
      const duration = audio.samples.length / audio.sampleRate;
      const speedup = results.length ? results[0].median / median : 1;
      const result = { requested: threads, effective: ready.threads, loadSeconds, runs: times, median, audioSeconds: duration, realTimeFactor: median / duration, speedup };
      results.push(result);
      const row = document.createElement('tr');
      for (const value of [`${threads} / ${ready.threads}`, loadSeconds.toFixed(2), median.toFixed(2), duration.toFixed(2), result.realTimeFactor.toFixed(2), speedup.toFixed(2) + 'x']) {
        const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
      }
      $('results').append(row);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      audioUrl = URL.createObjectURL(narrationWav(audio)); $('audio').src = audioUrl;
      active.dispose(); active = undefined;
    }
    $('status').textContent = 'Benchmark complete. A generation/audio ratio below 1 means faster than real time.';
  } catch (error) { $('status').textContent = String(error); }
  finally { active?.dispose(); active = undefined; running = false; $('settings').disabled = false; $('stop').disabled = true; updateButton(); }
};
$('export').onclick = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ userAgent: navigator.userAgent, capabilities, config: benchmarkConfig, results }, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'firefox-tts-benchmark.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
