import * as ort from 'onnxruntime-web/wasm';
import { TextToSpeech, UnicodeProcessor, Style } from './supertonic.js';
import { threadingCapabilities, requestedThreadCount } from './capabilities';
import { isNarratorVoice, narratorVoices } from './voices';

ort.env.wasm.wasmPaths = new URL('/runtime/', self.location.origin).href;
let engine;
const voices = new Map();
let busy = false;
let assetId = 0;
const pendingAssets = new Map();
const report = (message) => self.postMessage({ type: 'progress', message });
async function asset(path) {
  const id = ++assetId;
  const bytes = await new Promise((resolve, reject) => {
    pendingAssets.set(id, { resolve, reject });
    self.postMessage({ type: 'asset', id, path });
  });
  return new Response(bytes);
}

async function initialize(threads) {
  ort.env.wasm.numThreads = requestedThreadCount(threads, threadingCapabilities());
  const cfg = await (await asset('onnx/tts.json')).json();
  const indexer = await (await asset('onnx/unicode_indexer.json')).json();
  const sessions = [];
  try {
    for (const file of ['duration_predictor', 'text_encoder', 'vector_estimator', 'vocoder']) {
      const bytes = await (await asset(`onnx/${file}.onnx`)).arrayBuffer();
      report(`Preparing ${file} on your browser CPU`);
      sessions.push(await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' }));
    }
    engine = new TextToSpeech(cfg, new UnicodeProcessor(indexer), ...sessions);
  } catch (error) {
    await Promise.allSettled(sessions.map(s => s.release()));
    throw error;
  }
}

async function voiceStyle(name) {
  if (!isNarratorVoice(name)) throw new Error('Invalid narrator.');
  if (!voices.has(name)) {
    const data = await (await asset(`voice_styles/${name}.json`)).json();
    voices.set(name, new Style(
      new ort.Tensor('float32', Float32Array.from(data.style_ttl.data.flat(Infinity)), data.style_ttl.dims),
      new ort.Tensor('float32', Float32Array.from(data.style_dp.data.flat(Infinity)), data.style_dp.dims),
    ));
  }
  return voices.get(name);
}

self.onmessage = async ({ data }) => {
  if (data.type === 'capabilities') {
    self.postMessage({ type: 'capabilities', ...threadingCapabilities() });
    return;
  }
  if (data.type === 'asset') {
    const pending = pendingAssets.get(data.id);
    pendingAssets.delete(data.id);
    if (data.error) pending?.reject(new Error(data.error));
    else pending?.resolve(data.bytes);
    return;
  }
  if (busy) return;
  busy = true;
  try {
    if (data.type === 'load') {
      if (!engine) await initialize(data.threads);
      for (const voice of narratorVoices) await voiceStyle(voice.value);
      self.postMessage({ type: 'ready', threads: ort.env.wasm.numThreads, capabilities: threadingCapabilities() });
    } else if (data.type === 'speak') {
      if (!engine) throw new Error('Load the model first.');
      if (typeof data.text !== 'string' || !data.text.trim() || data.text.length > 20000) throw new Error('Enter 1-20,000 characters.');
      if (!Number.isInteger(data.steps) || data.steps < 5 || data.steps > 10) throw new Error('Invalid quality.');
      const style = await voiceStyle(data.voice);
      const started = performance.now();
      const result = await engine.call(data.text, 'en', style, data.steps, 1.05, 0.3,
        (step, total) => report(`Generating on your CPU: step ${step}/${total} (per text chunk)`));
      const samples = Float32Array.from(result.wav);
      self.postMessage({ type: 'audio', samples, sampleRate: engine.sampleRate,
        seconds: (performance.now() - started) / 1000, voice: data.voice }, [samples.buffer]);
    }
  } catch (error) { self.postMessage({ type: 'error', message: error.message || String(error) }); }
  finally { busy = false; }
};
