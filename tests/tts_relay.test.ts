import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ connect: [] as any[], create: vi.fn(), remove: vi.fn() }));
vi.mock("wxt/browser", () => ({ browser: {
  runtime: { onConnect: { addListener: (fn: any) => mock.connect.push(fn) } },
  tabs: { create: mock.create, remove: mock.remove },
} }));
import { installTtsRelay } from "@/tts/relay";
function port(name: string, url: string, tab = 1) {
  const messages: any[] = [], disconnects: any[] = [];
  let closed = false;
  return { name, sender: { url, tab: { id: tab } }, postMessage: vi.fn(),
    onMessage: { addListener: (fn: any) => messages.push(fn) },
    onDisconnect: { addListener: (fn: any) => disconnects.push(fn) },
    disconnect: vi.fn(() => { if (!closed) { closed = true; disconnects.forEach(fn => fn()); } }),
    receive: (data: any) => messages.forEach(fn => fn(data)),
  };
}
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); mock.connect.length = 0;
  mock.create.mockResolvedValue({ id: 10 }); mock.remove.mockResolvedValue(undefined); installTtsRelay(); });
afterEach(() => vi.useRealTimers());
describe("Firefox TTS background relay", () => {
  it("pairs only the created engine tab, relays typed audio, and closes it with the owner", async () => {
    const client = port('de-tts-client', 'https://play.aidungeon.com/adventure/test');
    mock.connect[0](client); await flush();
    const url = mock.create.mock.calls[0]![0].url;
    const token = url.split('#')[1];
    const wrong = port('de-tts-host:' + token, url, 99);
    mock.connect[0](wrong); expect(wrong.disconnect).toHaveBeenCalled();
    const host = port('de-tts-host:' + token, url, 10);
    mock.connect[0](host);
    expect(client.postMessage).toHaveBeenCalledWith({ type: 'connected' });
    client.receive({ type: 'speak', id: 7, text: 'hello' });
    expect(host.postMessage).toHaveBeenCalledWith({ type: 'speak', id: 7, text: 'hello' });
    const audio = { type: 'audio', id: 7, samples: new Float32Array([.1]), sampleRate: 44100 };
    host.receive(audio); expect(client.postMessage).toHaveBeenCalledWith(audio);
    client.disconnect(); expect(mock.remove).toHaveBeenCalledWith(10);
  });
  it("reports an unavailable server and rejects unrelated origins", async () => {
    const wrong = port('de-tts-client', 'https://example.com/'); mock.connect[0](wrong);
    expect(wrong.disconnect).toHaveBeenCalled(); expect(mock.create).not.toHaveBeenCalled();
    const client = port('de-tts-client', 'https://alpha.aidungeon.com/adventure/test');
    mock.connect[0](client); await flush(); vi.advanceTimersByTime(18000);
    expect(client.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'fatal', message: expect.stringContaining('Start node') }));
    expect(mock.remove).toHaveBeenCalledWith(10);
  });
  it("reports host loss instead of leaving narration waiting", async () => {
    const client = port('de-tts-client', 'https://play.aidungeon.com/adventure/test');
    mock.connect[0](client); await flush();
    const url = mock.create.mock.calls[0]![0].url;
    const host = port('de-tts-host:' + url.split('#')[1], url, 10);
    mock.connect[0](host); host.disconnect();
    expect(client.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'fatal', message: expect.stringContaining('disconnected') }));
  });
});
