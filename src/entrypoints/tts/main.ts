import { bgFetchBytes } from "@/media/bg_fetch";
import TtsWorker from "../../tts/worker.js?worker";

const base = "https://huggingface.co/supertone-oss-archive/supertonic-3/resolve/aafc6e32416a594460b32413efc49d7fe4ce6d46/";
const allowed = /^(onnx\/(tts\.json|unicode_indexer\.json|duration_predictor\.onnx|text_encoder\.onnx|vector_estimator\.onnx|vocoder\.onnx)|voice_styles\/[MF]5\.json)$/;
const controller = new AbortController();
let worker: Worker | undefined;
let port: MessagePort | undefined;
let requestId = 0;
const cache = caches.open("supertonic3-aafc6e32-v1").catch(() => undefined);

window.addEventListener("message", event => {
  if (port || event.source !== parent || !/^https:\/\/(play|beta|alpha)\.aidungeon\.com$/.test(event.origin) || event.data?.type !== "de-tts-connect" || !event.ports[0]) return;
  port = event.ports[0];
  worker = new TtsWorker();
  worker.onerror = event => port?.postMessage({ type: "error", id: requestId, message: event.message || "Narration worker failed." });
  worker.onmessage = async ({ data }) => {
    if (data.type !== "asset") {
      port?.postMessage({ ...data, id: requestId }, data.samples ? [data.samples.buffer] : []);
      return;
    }
    try {
      if (!allowed.test(data.path)) throw new Error("Invalid model asset.");
      const url = base + data.path;
      const storage = await cache;
      const hit = await storage?.match(url);
      port?.postMessage({ type: "progress", message: `${hit ? "Loading cached" : "Downloading"} ${data.path}` });
      const bytes = hit ? await hit.arrayBuffer() : await bgFetchBytes(url, controller.signal);
      if (!hit && storage) {
        try { await storage.put(url, new Response(bytes)); }
        catch { port?.postMessage({ type: "progress", message: "Model cache is full; using downloaded files for this session." }); }
      }
      worker?.postMessage({ type: "asset", id: data.id, bytes }, [bytes]);
    } catch (error) {
      worker?.postMessage({ type: "asset", id: data.id, error: String(error) });
    }
  };
  port.onmessage = ({ data }) => {
    if (data.type !== "load" && data.type !== "speak") return;
    requestId = data.id;
    worker?.postMessage(data);
  };
  port.postMessage({ type: "connected" });
});
window.addEventListener("pagehide", () => { controller.abort(); worker?.terminate(); port?.close(); });
