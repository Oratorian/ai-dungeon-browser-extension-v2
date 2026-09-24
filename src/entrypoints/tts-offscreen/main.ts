import { browser } from "wxt/browser";
import { createTtsEngine } from "@/tts/engine";
import { audioMessages } from "@/tts/audio_wire";

const engines = new Map<string, ReturnType<typeof createTtsEngine>>();
let port: ReturnType<typeof browser.runtime.connect> | undefined;
function connect() {
  if (port) return;
  const connected = browser.runtime.connect({ name: "de-tts-offscreen" });
  port = connected;
  connected.onMessage.addListener(({ type, token, payload }) => {
    if (typeof token !== "string") return;
    if (type === "attach" && !engines.has(token)) {
      engines.set(token, createTtsEngine(data => {
        const messages = data.type === "audio" ? audioMessages(data, data.id) : [data];
        for (const message of messages) connected.postMessage({ token, payload: message });
      }));
      connected.postMessage({ token, payload: { type: "connected" } });
    } else if (type === "detach") { engines.get(token)?.dispose(); engines.delete(token); }
    else if (type === "request") void engines.get(token)?.receive(payload);
  });
  connected.onDisconnect.addListener(() => {
    if (port !== connected) return;
    port = undefined;
    for (const engine of engines.values()) engine.dispose();
    engines.clear();
  });
}
browser.runtime.onMessage.addListener(message => {
  if (message?.type === "de-tts-offscreen-wake") { connect(); return Promise.resolve(true); }
});
// Keep the MV3 relay alive during model initialization and synthesis, including long silent runs.
setInterval(() => { if (engines.size) port?.postMessage({ type: "heartbeat" }); }, 20000);
connect();
