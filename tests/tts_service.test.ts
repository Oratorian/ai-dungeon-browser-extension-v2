import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";
const mock = vi.hoisted(() => ({ cached: vi.fn(), initialize: vi.fn(), dispose: vi.fn(), generate: vi.fn() }));
vi.mock("@/tts/client", () => ({ LocalNarrator: class {
  cached = mock.cached;
  initialize = mock.initialize;
  dispose = mock.dispose;
  generate = mock.generate;
} }));
import { configureTts, generateNarration, initializeTts, ttsState, ttsDiagnostics } from "@/tts/service";
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

beforeEach(() => {
  configureTts(false);
  vi.clearAllMocks();
  mock.cached.mockResolvedValue(false);
  mock.initialize.mockResolvedValue(undefined);
});
afterEach(() => configureTts(false));

describe("TTS availability", () => {
  it("reports pending work and sanitized failures without starting extra synthesis", async () => {
    await initializeTts();
    const before = ttsDiagnostics();
    let reject!: (error: Error) => void;
    mock.generate.mockImplementationOnce(() => new Promise((_, fail) => reject = fail));
    const work = generateNarration("Private story sentence", { voice: "M5", steps: 5 });
    expect(ttsDiagnostics().pending).toBe(1);
    expect(mock.generate).toHaveBeenCalledTimes(1);
    reject(new Error("Private story sentence failed"));
    await expect(work).rejects.toThrow("Private story sentence failed");
    const after = ttsDiagnostics();
    expect(after.pending).toBe(0);
    expect(after.failed).toBe(before.failed + 1);
    expect(JSON.stringify(after)).not.toContain("Private story");
    expect(after.lastFailure).toBe("synthesis: engine error (details omitted for privacy)");
  });
  it.each(['"Careful, Elarion."', '“Careful, Elarion.”', '«Careful, Elarion.»'])("omits speaker labels but preserves spoken names: %s", async dialogue => {
    await initializeTts();
    const options = { voice: "F5" as const, steps: 5 };
    await generateNarration(`Sage Harrow: ${dialogue}`, options);
    expect(mock.generate.mock.calls).toEqual([[dialogue, options]]);
  });
  it("preserves unlabeled narration and labels mentioned inside dialogue", async () => {
    await initializeTts();
    const options = { voice: "F5" as const, steps: 5 };
    for (const text of ['Sage looks up.', '"Sage: that is what the note said."', 'Sage: looks up.']) {
      await generateNarration(text, options);
      expect(mock.generate).toHaveBeenLastCalledWith(text, options);
    }
  });
  it.each(['"Hello!"', '\u201cHello!\u201d', '«Hello!»'])("speaks only the dialogue in a native Say action: %s", async dialogue => {
    await initializeTts();
    const options = { voice: "M5" as const, steps: 5 };
    await generateNarration(`You say, ${dialogue}`, options);
    expect(mock.generate.mock.calls).toEqual([[dialogue, options]]);
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
