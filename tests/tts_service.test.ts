import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";
const mock = vi.hoisted(() => ({ cached: vi.fn(), initialize: vi.fn(), dispose: vi.fn(), generate: vi.fn() }));
vi.mock("@/tts/client", () => ({ LocalNarrator: class {
  cached = mock.cached;
  initialize = mock.initialize;
  dispose = mock.dispose;
  generate = mock.generate;
} }));
import { configureTts, generateNarration, initializeTts, ttsState } from "@/tts/service";
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

beforeEach(() => {
  configureTts(false);
  vi.clearAllMocks();
  mock.cached.mockResolvedValue(false);
  mock.initialize.mockResolvedValue(undefined);
});
afterEach(() => configureTts(false));

describe("TTS availability", () => {
  it.each(['"Hello!"', '\u201cHello!\u201d'])("generates player dialogue separately with a half-second pause: %s", async dialogue => {
    await initializeTts();
    mock.generate.mockResolvedValueOnce({ samples: new Float32Array([1, 2]), sampleRate: 10 });
    mock.generate.mockResolvedValueOnce({ samples: new Float32Array([3, 4]), sampleRate: 10 });
    const options = { voice: "M5" as const, steps: 5 };
    const audio = await generateNarration(`You say, ${dialogue}`, options);
    expect(mock.generate.mock.calls).toEqual([["You say.", options], [dialogue, options]]);
    expect(Array.from(audio.samples)).toEqual([1, 2, 0, 0, 0, 0, 0, 3, 4]);
    expect(audio.sampleRate).toBe(10);
  });
  it("keeps ordinary narration in a single generation", async () => {
    await initializeTts();
    const options = { voice: "F5" as const, steps: 5 };
    await generateNarration("You say, then leave.", options);
    expect(mock.generate.mock.calls).toEqual([["You say, then leave.", options]]);
  });
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
