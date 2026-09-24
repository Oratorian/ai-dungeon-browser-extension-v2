import { bgFetchBytes } from "@/media/bg_fetch";

// Experimental loopback benchmark only. Never accept arbitrary download URLs.
const origin = "http://localhost:4177";
const base = "https://huggingface.co/supertone-oss-archive/supertonic-3/resolve/aafc6e32416a594460b32413efc49d7fe4ce6d46/";
const allowed = /^(onnx\/(tts\.json|unicode_indexer\.json|duration_predictor\.onnx|text_encoder\.onnx|vector_estimator\.onnx|vocoder\.onnx)|voice_styles\/[MF]5\.json)$/;
export default defineContentScript({
  matches: ["http://localhost/*"],
  runAt: "document_start",
  main(ctx) {
    if (location.origin !== origin || location.pathname !== "/") return;
    const controller = new AbortController();
    let busy = false;
    ctx.onInvalidated(() => controller.abort());
    ctx.addEventListener(window, "message", async event => {
      const data = event.data;
      if (event.source !== window || event.origin !== origin || !data || typeof data !== "object") return;
      if (data.type === "de-tts-prototype-ping") {
        window.postMessage({ type: "de-tts-prototype-pong" }, origin); return;
      }
      if (data.type !== "de-tts-prototype-asset" || !Number.isSafeInteger(data.id)
        || typeof data.path !== "string" || !allowed.test(data.path)) return;
      if (busy) {
        window.postMessage({ type: "de-tts-prototype-result", id: data.id, error: "Previous model download is still finishing. Retry shortly." }, origin);
        return;
      }
      busy = true;
      try {
        const bytes = await bgFetchBytes(base + data.path, controller.signal);
        window.postMessage({ type: "de-tts-prototype-result", id: data.id, bytes }, origin, [bytes]);
      } catch {
        window.postMessage({ type: "de-tts-prototype-result", id: data.id, error: "Background model download failed." }, origin);
      } finally { busy = false; }
    });
  },
});
