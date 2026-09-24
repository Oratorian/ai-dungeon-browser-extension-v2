import { browser } from "wxt/browser";

const engineUrl = "http://localhost:4177/engine.html";
type Port = ReturnType<typeof browser.runtime.connect>;
type Route = { client: Port; owner: number; host?: Port; tab?: number; timer: ReturnType<typeof setTimeout>; closed: boolean };

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
  browser.tabs.onRemoved.addListener(tabId => {
    for (const [token, route] of routes) {
      if (route.owner === tabId) close(token);
      else if (route.tab === tabId) close(token, "Firefox TTS engine closed. Retry Initialize TTS to reconnect.");
    }
  });
  async function openEngine(token: string, route: Route) {
    const owner = await browser.tabs.get(route.owner);
    if (route.closed) return;
    const tab = await browser.tabs.create({ url: engineUrl + "#" + token, active: false,
      windowId: owner.windowId, index: owner.index + 1, openerTabId: route.owner });
    if (route.closed) {
      if (tab.id != null) await browser.tabs.remove(tab.id).catch(() => {});
      return;
    }
    route.tab = tab.id;
    if (tab.id == null || !browser.tabs.group) return;
    try {
      // Re-read membership in case the user moved the story while the engine opened.
      const current = await browser.tabs.get(route.owner);
      if (route.closed) return;
      if (current.groupId != null && current.groupId >= 0) {
        await browser.tabs.group({ groupId: current.groupId, tabIds: [tab.id] });
      } else {
        const group = await browser.tabs.group({ tabIds: [route.owner, tab.id], createProperties: { windowId: current.windowId } });
        if (!route.closed) await browser.tabGroups?.update(group, { title: "AI Dungeon + TTS", color: "orange" });
      }
    } catch {
      // Older Firefox versions or a concurrent tab move must not break narration.
      // Ownership cleanup remains active even if grouping is unavailable.
    }
  }
  browser.runtime.onConnect.addListener(port => {
    if (port.name === "de-tts-client") {
      if (!/^https:\/\/(play|beta|alpha)\.aidungeon\.com\//.test(port.sender?.url ?? "") || port.sender?.tab?.id == null) { port.disconnect(); return; }
      const token = crypto.randomUUID();
      const route: Route = { client: port, owner: port.sender.tab.id, closed: false, timer: setTimeout(() => close(token,
        "Firefox TTS engine unavailable. Start node scripts/tts-firefox-prototype.mjs, then retry Initialize TTS."), 18000) };
      routes.set(token, route);
      port.onDisconnect.addListener(() => close(token));
      port.onMessage.addListener(data => {
        if (!route.host || !Number.isSafeInteger(data?.id) || !["status", "load", "speak"].includes(data.type)) return;
        route.host.postMessage(data);
      });
      void openEngine(token, route).catch(() => close(token, "Could not open Firefox TTS engine tab."));
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
