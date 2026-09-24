import { createTtsEngine } from "@/tts/engine";

let engine: ReturnType<typeof createTtsEngine> | undefined;
let port: MessagePort | undefined;
window.addEventListener("message", event => {
  if (port || event.source !== parent || !/^https:\/\/(play|beta|alpha)\.aidungeon\.com$/.test(event.origin) || event.data?.type !== "de-tts-connect" || !event.ports[0]) return;
  port = event.ports[0];
  engine = createTtsEngine(data => port?.postMessage(data, data.samples ? [data.samples.buffer] : []));
  port.onmessage = ({ data }) => { void engine?.receive(data); };
  port.postMessage({ type: "connected" });
});
window.addEventListener("pagehide", () => { engine?.dispose(); port?.close(); });
