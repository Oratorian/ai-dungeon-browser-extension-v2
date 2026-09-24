import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ messages: [] as any[], disconnects: [] as any[], send: vi.fn(), disconnect: vi.fn() }));
vi.mock("wxt/browser", () => ({ browser: { runtime: { connect: () => ({
  onMessage: { addListener: (fn: any) => mock.messages.push(fn) },
  onDisconnect: { addListener: (fn: any) => mock.disconnects.push(fn) },
  postMessage: mock.send, disconnect: mock.disconnect,
}) } } }));
import { RemoteNarrator } from "@/tts/remote";
const reply = (data: any) => mock.messages.forEach(fn => fn(data));
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); mock.messages.length = 0; mock.disconnects.length = 0; });
afterEach(() => vi.useRealTimers());
describe("Firefox isolated narrator", () => {
  it("uses two threads and serializes synthesis across queue changes", async () => {
    const client = new RemoteNarrator(vi.fn()); reply({ type: 'connected' });
    const initialized = client.initialize(false); await flush();
    expect(mock.send).toHaveBeenLastCalledWith({ type: 'load', download: false, threads: 2, id: 1 });
    reply({ type: 'ready', id: 1, threads: 2, capabilities: { isolated: true } }); await initialized;
    const first = client.generate('one', { voice: 'F5', steps: 7 });
    const second = client.generate('two', { voice: 'M5', steps: 5 }); await flush();
    expect(mock.send).toHaveBeenCalledTimes(2);
    reply({ type: 'audio', id: 2, samples: new Float32Array([1]), sampleRate: 44100 }); await first; await flush();
    expect(mock.send).toHaveBeenLastCalledWith(expect.objectContaining({ text: 'two', id: 3 }));
    reply({ type: 'audio', id: 3, samples: new Float32Array([2]), sampleRate: 44100 }); await second;
    expect(client.diagnostics()).toEqual({ context: 'Firefox isolated page', threads: 2, isolated: true });
    client.dispose();
  });
  it("rejects pending requests and reports a disconnected host", async () => {
    const failure = vi.fn(); const client = new RemoteNarrator(vi.fn(), failure);
    reply({ type: 'connected' }); const request = client.cached(); await flush();
    mock.disconnects.forEach(fn => fn());
    await expect(request).rejects.toThrow('disconnected'); expect(failure).toHaveBeenCalled();
  });
  it("fails clearly when the local server never connects", async () => {
    const failure = vi.fn(); const client = new RemoteNarrator(vi.fn(), failure);
    const request = client.cached(); vi.advanceTimersByTime(20000);
    await expect(request).rejects.toThrow('Start node'); expect(failure).toHaveBeenCalled();
  });
});
