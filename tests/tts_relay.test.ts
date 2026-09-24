import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ connect: [] as any[], removed: [] as any[], create: vi.fn(), remove: vi.fn(), get: vi.fn(), group: vi.fn(), update: vi.fn(), start: vi.fn(), stop: vi.fn(), failed: undefined as ((message: string) => void) | undefined }));
vi.mock("@/tts/firefox_helper", () => ({
  FIREFOX_ENGINE_URL: 'http://localhost:4177/engine.html',
  FirefoxTtsHelper: class {
    constructor(failed: (message: string) => void) { mock.failed = failed; }
    start = mock.start;
    stop = mock.stop;
  },
}));
vi.mock("wxt/browser", () => ({ browser: {
  runtime: { onConnect: { addListener: (fn: any) => mock.connect.push(fn) } },
  tabs: { create: mock.create, remove: mock.remove, get: mock.get, group: mock.group, onRemoved: { addListener: (fn: any) => mock.removed.push(fn) } },
  tabGroups: { update: mock.update },
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
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
beforeEach(() => { vi.useFakeTimers(); vi.resetAllMocks(); mock.connect.length = 0; mock.removed.length = 0;
  mock.start.mockResolvedValue(undefined);
  mock.get.mockResolvedValue({ id: 1, windowId: 7, index: 3, groupId: -1 });
  mock.group.mockResolvedValue(20); mock.update.mockResolvedValue(undefined);
  mock.create.mockResolvedValue({ id: 10 }); mock.remove.mockResolvedValue(undefined); installTtsRelay(); });
afterEach(() => vi.useRealTimers());
describe("Firefox TTS background relay", () => {
  it("groups the story and engine in the owner's window and closes the engine when the story closes", async () => {
    const client = port('de-tts-client', 'https://play.aidungeon.com/adventure/test');
    mock.connect[0](client); await flush();
    expect(mock.create).toHaveBeenCalledWith(expect.objectContaining({ windowId: 7, index: 4, openerTabId: 1, active: false }));
    expect(mock.group).toHaveBeenCalledWith({ tabIds: [1, 10], createProperties: { windowId: 7 } });
    expect(mock.update).toHaveBeenCalledWith(20, { title: 'AI Dungeon + TTS', color: 'orange' });
    mock.removed[0](1);
    expect(client.disconnect).toHaveBeenCalled();
    expect(mock.remove).toHaveBeenCalledWith(10);
  });
  it("reuses an existing group without renaming it", async () => {
    mock.get.mockResolvedValue({ id: 1, windowId: 7, index: 3, groupId: 42 });
    mock.connect[0](port('de-tts-client', 'https://play.aidungeon.com/adventure/test')); await flush();
    expect(mock.group).toHaveBeenCalledWith({ groupId: 42, tabIds: [10] });
    expect(mock.update).not.toHaveBeenCalled();
  });
  it("keeps ownership cleanup when grouping fails", async () => {
    mock.group.mockRejectedValue(new Error('Unavailable'));
    const client = port('de-tts-client', 'https://play.aidungeon.com/adventure/test');
    mock.connect[0](client); await flush();
    expect(client.disconnect).not.toHaveBeenCalled();
    mock.removed[0](10);
    expect(client.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'fatal' }));
  });
  it("removes a late-created engine when its owner closes during creation", async () => {
    let finish!: (tab: any) => void;
    mock.create.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    mock.connect[0](port('de-tts-client', 'https://play.aidungeon.com/adventure/test')); await flush();
    mock.removed[0](1); finish({ id: 10 }); await flush();
    expect(mock.remove).toHaveBeenCalledWith(10);
    expect(mock.group).not.toHaveBeenCalled();
  });
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
    expect(client.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'fatal', message: expect.stringContaining('TTS Helper') }));
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
  it("waits for native readiness and stops the helper only after the last reader closes", async () => {
    let ready!: () => void;
    mock.start.mockImplementation(() => new Promise<void>(resolve => { ready = resolve; }));
    const one = port('de-tts-client', 'https://play.aidungeon.com/adventure/one', 1);
    mock.connect[0](one); await flush();
    expect(mock.create).not.toHaveBeenCalled();
    ready(); await flush();
    mock.start.mockResolvedValue(undefined);
    mock.create.mockResolvedValue({ id: 11 });
    const two = port('de-tts-client', 'https://play.aidungeon.com/adventure/two', 2);
    mock.connect[0](two); await flush();
    one.disconnect(); expect(mock.stop).not.toHaveBeenCalled();
    two.disconnect(); expect(mock.stop).toHaveBeenCalledTimes(1);
  });
  it("does not open an orphan tab if the reader closes while its helper is starting", async () => {
    let ready!: () => void;
    mock.start.mockImplementation(() => new Promise<void>(resolve => { ready = resolve; }));
    const client = port('de-tts-client', 'https://play.aidungeon.com/adventure/one');
    mock.connect[0](client); client.disconnect(); ready(); await flush();
    expect(mock.stop).toHaveBeenCalled(); expect(mock.create).not.toHaveBeenCalled();
  });
  it("tears down every engine when the native helper fails", async () => {
    const client = port('de-tts-client', 'https://play.aidungeon.com/adventure/one');
    mock.connect[0](client); await flush();
    mock.failed?.('Helper failed');
    expect(mock.remove).toHaveBeenCalledWith(10);
    expect(client.postMessage).toHaveBeenCalledWith({ type: 'fatal', message: 'Helper failed' });
    expect(mock.stop).toHaveBeenCalled();
  });
});
