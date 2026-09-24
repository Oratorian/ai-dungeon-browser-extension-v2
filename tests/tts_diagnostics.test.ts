import { describe, expect, it } from "vitest";
import { narrationDiagnostics, registerNarrationDiagnostics, ttsErrorCategory } from "@/tts/diagnostics";

describe("TTS diagnostics privacy and lifecycle", () => {
  it("reports categories without exposing story text or URLs", () => {
    expect(ttsErrorCategory(new Error('Failed to fetch https://private.example/secret?key=123'))).toBe("network or model download");
    expect(ttsErrorCategory(new Error('Could not synthesize: Sage whispered a secret.'))).toBe("engine error (details omitted for privacy)");
    expect(ttsErrorCategory(new Error("Narration timed out."))).toBe("timeout");
  });
  it("does not let an old queue cleanup erase a replacement queue", () => {
    const snapshot = { ready: 2, total: 4, failed: 0, generating: true,
      upcomingReady: 1, upcomingTotal: 3, muted: false, buffering: false, playing: true };
    const old = registerNarrationDiagnostics(() => snapshot);
    const current = registerNarrationDiagnostics(() => ({ ...snapshot, ready: 3 }));
    old();
    expect(narrationDiagnostics()?.ready).toBe(3);
    current();
    expect(narrationDiagnostics()).toBeNull();
  });
});
