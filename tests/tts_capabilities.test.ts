import { describe, expect, it } from "vitest";
import { narrationThreadCount, requestedThreadCount } from "@/tts/capabilities";

describe("experimental TTS thread selection", () => {
  const capable = { isolated: true, sharedMemory: true, wasmThreads: true };
  it("keeps ordinary narration single threaded unless explicitly requested", () => {
    for (const value of [undefined, 0, -1, 8, NaN, "4"]) expect(requestedThreadCount(value, capable)).toBe(1);
    expect(requestedThreadCount(4, capable)).toBe(4);
    expect(requestedThreadCount(2, capable)).toBe(2);
    expect(requestedThreadCount(6, capable)).toBe(6);
  });
  it("limits the accelerated setting to 2, 4 or 6", () => {
    for (const value of [undefined, 1, 3, 8, NaN, "4"]) expect(narrationThreadCount(value)).toBe(2);
    for (const value of [2, 4, 6]) expect(narrationThreadCount(value)).toBe(value);
  });
  it("requires every shared-memory prerequisite", () => {
    for (const key of Object.keys(capable)) expect(requestedThreadCount(4, { ...capable, [key]: false })).toBe(1);
  });
});
