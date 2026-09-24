import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ connect: [] as any[], create: vi.fn(), contexts: vi.fn(), wake: vi.fn() }));
vi.mock("wxt/browser", () => ({ browser: { runtime: {
  getURL: (path: string) => "chrome-extension://test" + path,
  onConnect: { addListener: (fn: any) => mock.connect.push(fn) }, sendMessage: mock.wake,
} } }));
import { installChromeTtsRelay } from "@/tts/chrome_relay";
function port(name: string, url: string) {
  const messages: any[] = [], disconnects: any[] = []; let closed = false;
  return { name, sender: { url }, postMessage: vi.fn(),
    onMessage: { addListener: (fn: any) => messages.push(fn) },
    onDisconnect: { addListener: (fn: any) => disconnects.push(fn) },
    disconnect: vi.fn(() => { if (!closed) { closed = true; disconnects.forEach(fn => fn()); } }),
    receive: (data: any) => messages.forEach(fn => fn(data)),
  };
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); mock.connect.length = 0;
  vi.stubGlobal("chrome", { runtime: { getContexts: mock.contexts, ContextType: { OFFSCREEN_DOCUMENT: "OFFSCREEN_DOCUMENT" } },
    offscreen: { createDocument: mock.create, Reason: { WORKERS: "WORKERS" } } });
  mock.contexts.mockResolvedValue([]); mock.create.mockResolvedValue(undefined); mock.wake.mockResolvedValue(true);
  installChromeTtsRelay();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("Chrome offscreen TTS relay", () => {
  it("creates one document for simultaneous readers and isolates their replies", async () => {
    const first = port("de-tts-client", "https://play.aidungeon.com/adventure/a");
    const second = port("de-tts-client", "https://play.aidungeon.com/adventure/b");
    mock.connect[0](first); mock.connect[0](second); await flush();
    expect(mock.create).toHaveBeenCalledTimes(1);
    expect(mock.create).toHaveBeenCalledWith(expect.objectContaining({ reasons: ["WORKERS"] }));
    const host = port("de-tts-offscreen", "chrome-extension://test/tts-offscreen.html");
    mock.connect[0](host); await flush();
    const tokens = host.postMessage.mock.calls.map(call => call[0].token);
    expect(tokens).toHaveLength(2); expect(tokens[0]).not.toBe(tokens[1]);
    host.receive({ token: tokens[0], payload: { type: "connected" } });
    expect(first.postMessage).toHaveBeenCalledWith({ type: "connected" });
    expect(second.postMessage).not.toHaveBeenCalled();
    first.receive({ type: "speak", id: 1, text: "hello" });
    expect(host.postMessage).toHaveBeenLastCalledWith({ type: "request", token: tokens[0], payload: { type: "speak", id: 1, text: "hello" } });
    first.disconnect(); expect(host.postMessage).toHaveBeenLastCalledWith({ type: "detach", token: tokens[0] });
    expect(second.disconnect).not.toHaveBeenCalled(); second.disconnect();
  });
  it("wakes an existing offscreen page and fails cleanly when it cannot connect", async () => {
    mock.contexts.mockResolvedValue([{ documentUrl: "chrome-extension://test/tts-offscreen.html" }]);
    const client = port("de-tts-client", "https://alpha.aidungeon.com/adventure/a");
    mock.connect[0](client); await flush();
    expect(mock.create).not.toHaveBeenCalled(); expect(mock.wake).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10000);
    expect(client.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "fatal" }));
  });
  it("rejects page impostors", () => {
    const host = port("de-tts-offscreen", "https://example.com/");
    mock.connect[0](host); expect(host.disconnect).toHaveBeenCalled();
    const client = port("de-tts-client", "http://localhost:4177/");
    mock.connect[0](client); expect(client.disconnect).toHaveBeenCalled();
    expect(mock.create).not.toHaveBeenCalled();
  });
});
