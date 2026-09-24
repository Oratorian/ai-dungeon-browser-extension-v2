import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ connect: vi.fn() }));
vi.mock("wxt/browser", () => ({ browser: { runtime: { connectNative: mock.connect } } }));
import { FirefoxTtsHelper, FIREFOX_ENGINE_URL } from "@/tts/firefox_helper";
function nativePort() {
  const messages: any[] = [], disconnects: any[] = [];
  let closed = false;
  return { onMessage: { addListener: (fn: any) => messages.push(fn) },
    onDisconnect: { addListener: (fn: any) => disconnects.push(fn) }, postMessage: vi.fn(),
    disconnect: vi.fn(() => { if (!closed) { closed = true; disconnects.forEach(fn => fn()); } }),
    receive: (data: any) => messages.forEach(fn => fn(data)) };
}
beforeEach(() => { vi.useFakeTimers(); vi.resetAllMocks(); });
afterEach(() => vi.useRealTimers());
it("shares one launch, validates readiness, and can restart after shutdown", async () => {
  const port = nativePort(); mock.connect.mockReturnValue(port);
  const failed = vi.fn(); const helper = new FirefoxTtsHelper(failed);
  const first = helper.start(); expect(helper.start()).toBe(first);
  expect(mock.connect).toHaveBeenCalledWith('dungeon_extension.tts_helper');
  expect(port.postMessage).toHaveBeenCalledWith({ type: 'start', protocol: 1 });
  port.receive({ type: 'ready', protocol: 1, engineUrl: FIREFOX_ENGINE_URL }); await first;
  helper.stop(); expect(port.disconnect).toHaveBeenCalledTimes(1); expect(failed).not.toHaveBeenCalled();
  const next = nativePort(); mock.connect.mockReturnValue(next);
  const second = helper.start(); next.receive({ type: 'ready', protocol: 1, engineUrl: FIREFOX_ENGINE_URL });
  await second; helper.stop(); expect(mock.connect).toHaveBeenCalledTimes(2);
});
it("reports installation failure when Firefox cannot find the native application", async () => {
  const port = nativePort(); mock.connect.mockReturnValue(port);
  const failed = vi.fn(); const helper = new FirefoxTtsHelper(failed);
  const pending = expect(helper.start()).rejects.toThrow('Install');
  port.disconnect(); await pending; expect(failed).toHaveBeenCalledWith(expect.stringContaining('setup wizard'));
});
it("rejects incompatible origins and protocol versions", async () => {
  for (const response of [{ type: 'ready', protocol: 2, engineUrl: FIREFOX_ENGINE_URL }, { type: 'ready', protocol: 1, engineUrl: 'https://example.com/engine.html' }]) {
    const port = nativePort(); mock.connect.mockReturnValue(port);
    const helper = new FirefoxTtsHelper(vi.fn());
    const pending = expect(helper.start()).rejects.toThrow('incompatible');
    port.receive(response); await pending; expect(port.disconnect).toHaveBeenCalled();
  }
});
it("reports port conflicts and startup timeouts", async () => {
  const port = nativePort(); mock.connect.mockReturnValue(port);
  const helper = new FirefoxTtsHelper(vi.fn());
  const pending = expect(helper.start()).rejects.toThrow('Port 4177 is busy');
  port.receive({ type: 'error', message: 'Port 4177 is busy' }); await pending;
  const next = nativePort(); mock.connect.mockReturnValue(next);
  const timeout = expect(helper.start()).rejects.toThrow('did not start');
  vi.advanceTimersByTime(12000); await timeout;
});
