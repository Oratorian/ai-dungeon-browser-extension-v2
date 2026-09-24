import { bgFetchBytes } from "@/media/bg_fetch";
import { browser } from "wxt/browser";

// Experimental loopback benchmark only. Never accept arbitrary download URLs.
const origin = "http://localhost:4177";
const base = "https://huggingface.co/supertone-oss-archive/supertonic-3/resolve/aafc6e32416a594460b32413efc49d7fe4ce6d46/";
const allowed = /^(onnx\/(tts\.json|unicode_indexer\.json|duration_predictor\.onnx|text_encoder\.onnx|vector_estimator\.onnx|vocoder\.onnx)|voice_styles\/[MF]5\.json)$/;
export default defineContentScript({
  matches: ["http://localhost/*"],
  runAt: "document_start",
  main(ctx) {
    if (location.origin !== origin || !["/", "/engine.html"].includes(location.pathname)) return;
    const controller = new AbortController();
    let busy = false;
    let hostPort: ReturnType<typeof browser.runtime.connect> | undefined;
    ctx.onInvalidated(() => { controller.abort(); hostPort?.disconnect(); });
    ctx.addEventListener(window, "message", async event => {
      const data = event.data;
      if (event.source !== window || event.origin !== origin || !data || typeof data !== "object") return;
      if (location.pathname === "/engine.html" && /^#[\da-f-]{36}$/i.test(location.hash)) {
        if (data.type === "de-tts-host-ready" && !hostPort) {
          hostPort = browser.runtime.connect({ name: "de-tts-host:" + location.hash.slice(1) });
          hostPort.onMessage.addListener(payload => window.postMessage({ type: "de-tts-host-request", payload }, origin));
          hostPort.onDisconnect.addListener(() => window.postMessage({ type: "de-tts-host-disconnected" }, origin));
          return;
        }
        if (data.type === "de-tts-host-response" && hostPort) {
          hostPort.postMessage(data.payload); return;
        }
      }
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
