import * as ort from 'onnxruntime-web/wasm';
import { threadingCapabilities } from '../../src/tts/capabilities';

// A local one-element Identity model exercises ORT startup without downloading TTS models.
// Encode the small ONNX protobuf directly so the probe needs no extra dependency.
const bytes = (...values) => values.flat();
const number = (field, value) => [field * 8, value];
const message = (field, value) => [field * 8 + 2, value.length, ...value];
const string = (field, value) => message(field, [...new TextEncoder().encode(value)]);
const valueInfo = name => bytes(string(1, name), message(2,
  message(1, bytes(number(1, 1), message(2, message(1, number(1, 1)))))));
const model = new Uint8Array(bytes(number(1, 8),
  message(7, bytes(
    message(1, bytes(string(1, 'x'), string(2, 'y'), string(4, 'Identity'))),
    string(2, 'thread-probe'), message(11, valueInfo('x')), message(12, valueInfo('y')))),
  message(8, number(2, 13))));

self.onmessage = async () => {
  const capabilities = threadingCapabilities();
  let session;
  let input;
  let output;
  try {
    if (!capabilities.isolated || !capabilities.sharedMemory || !capabilities.wasmThreads) throw new Error('Threading prerequisites unavailable.');
    ort.env.wasm.wasmPaths = new URL('/runtime/', self.location.origin).href;
    ort.env.wasm.numThreads = 4;
    session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
    input = new ort.Tensor('float32', new Float32Array([42]), [1]);
    output = await session.run({ x: input });
    self.postMessage({ type: 'capabilities', ...capabilities, ortThreads: ort.env.wasm.numThreads,
      ortExecutionPassed: output.y.data[0] === 42 });
  } catch (error) {
    self.postMessage({ type: 'capabilities', ...capabilities, ortThreads: ort.env.wasm.numThreads,
      ortExecutionPassed: false, probeError: String(error) });
  } finally { input?.dispose(); output?.y.dispose(); await session?.release(); }
};
