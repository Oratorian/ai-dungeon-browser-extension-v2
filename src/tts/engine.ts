import { bgFetchBytes } from "@/media/bg_fetch";
import TtsWorker from "./worker.js?worker";

const base = "https://huggingface.co/supertone-oss-archive/supertonic-3/resolve/aafc6e32416a594460b32413efc49d7fe4ce6d46/";
const assets = ["onnx/tts.json", "onnx/unicode_indexer.json",
  ...["duration_predictor", "text_encoder", "vector_estimator", "vocoder"].map(name => `onnx/${name}.onnx`),
  "voice_styles/M5.json", "voice_styles/F5.json"];

/** A worker and request stream per reader, sharing only the extension's model cache. */
export function createTtsEngine(send: (data: any) => void) {
  const worker = new TtsWorker();
  const controller = new AbortController();
  const cache = caches.open("supertonic3-aafc6e32-v1").catch(() => undefined);
  let download = false;
  let request: { id: number } | undefined;
  let disposed = false;
  const reply = (data: any) => { if (!disposed) send(data); };
  worker.onerror = event => {
    if (request) reply({ type: "error", id: request.id, message: event.message || "Narration worker failed." });
    request = undefined;
  };
  worker.onmessage = async ({ data }) => {
    if (data.type !== "asset") {
      if (request) reply({ ...data, id: request.id });
      if (data.type !== "progress") request = undefined;
      return;
    }
    try {
      if (!assets.includes(data.path)) throw new Error("Invalid model asset.");
      const url = base + data.path;
      const storage = await cache;
      const hit = await storage?.match(url);
      if (!hit && !download) throw new Error("Model files are missing. Click Initialize TTS to download them.");
      reply({ type: "progress", message: `${hit ? "Loading cached" : "Downloading"} ${data.path}` });
      const bytes = hit ? await hit.arrayBuffer() : await bgFetchBytes(url, controller.signal);
      if (!hit && storage) {
        try { await storage.put(url, new Response(bytes)); }
        catch { reply({ type: "progress", message: "Model cache is full; using downloaded files for this session." }); }
      }
      if (!disposed) worker.postMessage({ type: "asset", id: data.id, bytes }, [bytes]);
    } catch (error) { if (!disposed) worker.postMessage({ type: "asset", id: data.id, error: String(error) }); }
  };
  return {
    async receive(data: any) {
      if (disposed || !Number.isSafeInteger(data?.id) || !["status", "load", "speak"].includes(data.type)) return;
      if (request) { reply({ type: "error", id: data.id, message: "Narration engine is busy." }); return; }
      request = data;
      if (data.type === "status") {
        try {
          const storage = await cache;
          const complete = !!storage && (await Promise.all(assets.map(path => storage.match(base + path)))).every(Boolean);
          reply({ type: "cache", id: data.id, complete });
        } catch (error) { reply({ type: "error", id: data.id, message: String(error) }); }
        request = undefined;
      } else {
        if (data.type === "load") download = data.download === true;
        worker.postMessage(data);
      }
    },
    dispose() { disposed = true; controller.abort(); worker.terminate(); request = undefined; },
  };
}
