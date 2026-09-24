import { browser } from "wxt/browser";

type Port = ReturnType<typeof browser.runtime.connect>;
/** One offscreen document, independent engine/request streams for each adventure. */
export function installChromeTtsRelay() {
  const url = browser.runtime.getURL("/tts-offscreen.html" as any);
  const clients = new Map<string, { port: Port; timer: ReturnType<typeof setTimeout> }>();
  let host: Port | undefined;
  let connecting: Promise<void> | undefined;
  let ready: (() => void) | undefined;
  function close(token: string, message?: string) {
    const client = clients.get(token);
    if (!client) return;
    clients.delete(token); clearTimeout(client.timer);
    if (message) { try { client.port.postMessage({ type: "fatal", message }); } catch {} }
    client.port.disconnect();
    try { host?.postMessage({ type: "detach", token }); } catch {}
  }
  function ensureHost() {
    if (host) return Promise.resolve();
    if (!connecting) {
      connecting = (async () => {
        const contexts = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT], documentUrls: [url] });
        if (!contexts.length) await chrome.offscreen.createDocument({ url, reasons: [chrome.offscreen.Reason.WORKERS], justification: "Run local multithreaded TTS workers without opening a browser tab." });
        else await browser.runtime.sendMessage({ type: "de-tts-offscreen-wake" });
        if (!host) await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => { ready = undefined; reject(new Error("Offscreen engine did not connect.")); }, 10000);
          ready = () => { clearTimeout(timer); ready = undefined; resolve(); };
        });
      })().finally(() => { connecting = undefined; });
    }
    return connecting;
  }
  browser.runtime.onConnect.addListener(port => {
    if (port.name === "de-tts-offscreen") {
      if (port.sender?.url !== url || host) { port.disconnect(); return; }
      host = port; ready?.();
      port.onMessage.addListener(data => {
        const client = clients.get(data?.token);
        if (!client || !data.payload) return;
        if (data.payload.type === "connected") clearTimeout(client.timer);
        client.port.postMessage(data.payload);
      });
      port.onDisconnect.addListener(() => {
        if (host !== port) return;
        host = undefined;
        for (const token of clients.keys()) close(token, "Chrome TTS engine disconnected. Retry Initialize TTS.");
      });
    } else if (port.name === "de-tts-client") {
      if (!/^https:\/\/(play|beta|alpha)\.aidungeon\.com\//.test(port.sender?.url ?? "")) { port.disconnect(); return; }
      const token = crypto.randomUUID();
      clients.set(token, { port, timer: setTimeout(() => close(token, "Chrome TTS engine unavailable. Retry Initialize TTS or turn acceleration off."), 18000) });
      port.onDisconnect.addListener(() => close(token));
      port.onMessage.addListener(payload => {
        if (!Number.isSafeInteger(payload?.id) || !["status", "load", "speak"].includes(payload.type)) return;
        try { host?.postMessage({ type: "request", token, payload }); }
        catch { close(token, "Chrome TTS engine disconnected. Retry Initialize TTS."); }
      });
      void ensureHost().then(() => {
        if (clients.has(token)) host?.postMessage({ type: "attach", token });
      }).catch(() => close(token, "Could not start Chrome's offscreen TTS engine. Retry Initialize TTS or turn acceleration off."));
    }
  });
}
