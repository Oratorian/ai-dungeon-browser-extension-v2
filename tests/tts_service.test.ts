import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";
const mock = vi.hoisted(() => ({ cached: vi.fn(), initialize: vi.fn(), dispose: vi.fn(), generate: vi.fn() }));
vi.mock("@/tts/client", () => ({ LocalNarrator: class {
  cached = mock.cached;
  initialize = mock.initialize;
  dispose = mock.dispose;
  generate = mock.generate;
} }));
import { configureTts, initializeTts, ttsState } from "@/tts/service";
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

beforeEach(() => {
  configureTts(false);
  vi.clearAllMocks();
  mock.cached.mockResolvedValue(false);
  mock.initialize.mockResolvedValue(undefined);
});
afterEach(() => configureTts(false));

describe("TTS availability", () => {
  it("enables without downloading when models are missing", async () => {
    configureTts(true);
    await flush();
    expect(get(ttsState).phase).toBe("missing");
    expect(mock.initialize).not.toHaveBeenCalled();
    await initializeTts();
    expect(mock.initialize).toHaveBeenCalledWith(true);
    expect(get(ttsState).phase).toBe("ready");
  });
  it("loads verified cached models without enabling network downloads", async () => {
    mock.cached.mockResolvedValue(true);
    configureTts(true);
    await flush();
    expect(mock.initialize).toHaveBeenCalledWith(false);
    expect(get(ttsState).phase).toBe("ready");
    configureTts(true);
    expect(mock.initialize).toHaveBeenCalledTimes(1);
  });
  it("deduplicates initialization and ignores completion after turning off", async () => {
    let finish!: () => void;
    mock.initialize.mockImplementation(() => new Promise<void>(resolve => finish = resolve));
    const first = initializeTts();
    const second = initializeTts();
    expect(first).toBe(second);
    expect(get(ttsState).phase).toBe("loading");
    configureTts(false);
    finish(); await first;
    expect(get(ttsState).phase).toBe("off");
    expect(mock.dispose).toHaveBeenCalledTimes(1);
  });
  it("reports initialization failure and lets the button retry", async () => {
    mock.initialize.mockRejectedValueOnce(new Error("Download failed"));
    await initializeTts();
    expect(get(ttsState)).toEqual({ phase: "error", message: "Download failed" });
    await initializeTts();
    expect(get(ttsState).phase).toBe("ready");
    expect(mock.dispose).toHaveBeenCalledTimes(1);
  });
});
