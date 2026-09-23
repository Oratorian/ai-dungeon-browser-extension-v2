import { describe, expect, it, vi } from "vitest";
import { NarrationQueue, type NarrationAudio } from "@/tts/queue";

const audio: NarrationAudio = { samples: new Float32Array([0, 0.1]), sampleRate: 24000 };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

describe("narration prefetch", () => {
  it("generates serially, caches the next line, and limits lookahead", async () => {
    const generate = vi.fn(async () => audio);
    const queue = new NarrationQueue(generate, vi.fn());
    queue.setWindow(["one", "two", "three", "four", "five"]);
    await flush();
    expect(generate.mock.calls).toHaveLength(4);
    expect(queue.get("two")).toBe(audio);
    queue.setWindow(["two", "three", "four", "five"]);
    await flush();
    expect(generate.mock.calls).toHaveLength(5);
    expect(queue.get("one")).toBeUndefined();
  });

  it("prioritizes navigation and drops stale in-flight results", async () => {
    let finish!: (value: NarrationAudio) => void;
    const generate = vi.fn((text: string) => text === "old" ? new Promise<NarrationAudio>(r => finish = r) : Promise.resolve(audio));
    const changed = vi.fn();
    const queue = new NarrationQueue(generate, changed);
    queue.setWindow(["old", "skipped"]);
    queue.setWindow(["current", "next"]);
    expect(generate).toHaveBeenCalledTimes(1);
    finish(audio);
    await flush();
    expect(generate.mock.calls.map(call => call[0])).toEqual(["old", "current", "next"]);
    expect(queue.get("old")).toBeUndefined();
    expect(changed.mock.calls.map(call => call[0])).toEqual(["current", "next"]);
  });

  it("does not loop on failures and permits explicit retry", async () => {
    const generate = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(audio);
    const changed = vi.fn();
    const queue = new NarrationQueue(generate, changed);
    queue.setWindow(["one", "two"]);
    await flush();
    queue.setWindow(["one", "two"]);
    await flush();
    expect(generate).toHaveBeenCalledTimes(2);
    expect(changed).toHaveBeenCalledWith("one", "offline");
    queue.retry("one");
    await flush();
    expect(queue.get("one")).toBe(audio);
  });

  it("ignores completions after disposal and deduplicates text", async () => {
    let finish!: (value: NarrationAudio) => void;
    const changed = vi.fn();
    const generate = vi.fn(() => new Promise<NarrationAudio>(r => finish = r));
    const queue = new NarrationQueue(generate, changed);
    queue.setWindow(["one", "one", "two"]);
    queue.dispose();
    finish(audio);
    await flush();
    expect(generate).toHaveBeenCalledTimes(1);
    expect(changed).not.toHaveBeenCalled();
    expect(queue.get("one")).toBeUndefined();
  });
});
