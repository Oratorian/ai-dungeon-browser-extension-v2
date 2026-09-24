import { browser } from "wxt/browser";

const engineUrl = "http://localhost:4177/engine.html";
type Port = ReturnType<typeof browser.runtime.connect>;
type Route = { client: Port; host?: Port; tab?: number; timer: ReturnType<typeof setTimeout>; closed: boolean };

/** Each adventure tab owns its own engine tab and request stream. */
export function installTtsRelay() {
  const routes = new Map<string, Route>();
  function close(token: string, reason?: string) {
    const route = routes.get(token);
    if (!route || route.closed) return;
    route.closed = true; routes.delete(token); clearTimeout(route.timer);
    if (reason) { try { route.client.postMessage({ type: "fatal", message: reason }); } catch {} }
    route.client.disconnect(); route.host?.disconnect();
    if (route.tab != null) void browser.tabs.remove(route.tab).catch(() => {});
  }
  browser.runtime.onConnect.addListener(port => {
    if (port.name === "de-tts-client") {
      if (!/^https:\/\/(play|beta|alpha)\.aidungeon\.com\//.test(port.sender?.url ?? "")) { port.disconnect(); return; }
      const token = crypto.randomUUID();
      const route: Route = { client: port, closed: false, timer: setTimeout(() => close(token,
        "Firefox TTS engine unavailable. Start node scripts/tts-firefox-prototype.mjs, then retry Initialize TTS."), 18000) };
      routes.set(token, route);
      port.onDisconnect.addListener(() => close(token));
      port.onMessage.addListener(data => {
        if (!route.host || !Number.isSafeInteger(data?.id) || !["status", "load", "speak"].includes(data.type)) return;
        route.host.postMessage(data);
      });
      void browser.tabs.create({ url: engineUrl + "#" + token, active: false }).then(tab => {
        if (route.closed && tab.id != null) void browser.tabs.remove(tab.id).catch(() => {});
        else route.tab = tab.id;
      }).catch(() => close(token, "Could not open Firefox TTS engine tab."));
    } else if (port.name.startsWith("de-tts-host:")) {
      const token = port.name.slice("de-tts-host:".length);
      const route = routes.get(token);
      if (!route || route.host || port.sender?.url !== engineUrl + "#" + token
        || (route.tab != null && port.sender?.tab?.id !== route.tab)) { port.disconnect(); return; }
      route.host = port; route.tab = port.sender?.tab?.id;
      clearTimeout(route.timer);
      port.onMessage.addListener(data => { if (!route.closed) route.client.postMessage(data); });
      port.onDisconnect.addListener(() => close(token, "Firefox TTS engine disconnected. Retry Initialize TTS to reconnect."));
      route.client.postMessage({ type: "connected" });
    }
  });
}
