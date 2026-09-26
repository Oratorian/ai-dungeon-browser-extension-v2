import { expect, it, vi } from "vitest";
import { novelDialogueVoice, novelSpeechKey, readNovelSpeechKey } from "@/rendering/novel_voice";
import { NarrationQueue } from "@/tts/queue";

it("routes gendered dialogue and leaves narration or unspecified cards on the narrator", () => {
  expect(novelDialogueVoice("male", "F5", "M3", "F4")).toBe("M3");
  expect(novelDialogueVoice("female", "M5", "M3", "F4")).toBe("F4");
  for (const gender of [undefined, "none", "invalid"]) {
    expect(novelDialogueVoice(gender, "F5", "M3", "F4")).toBe("F5");
  }
  expect(novelDialogueVoice("male", "F5", "F3", "F4")).toBe("M1");
  expect(novelDialogueVoice("female", "M5", "M3", "M4")).toBe("F1");
});

it("queues identical dialogue in separate voices without reusing the wrong audio", async () => {
  const keys = [novelSpeechKey('"Hello."', "M2"), novelSpeechKey('"Hello."', "F3")];
  const generate = vi.fn(async (key: string) => ({ samples: new Float32Array([readNovelSpeechKey(key).voice === "M2" ? 1 : 2]), sampleRate: 44100 }));
  const queue = new NarrationQueue(generate, vi.fn());
  queue.setWindow(keys);
  await vi.waitFor(() => expect(queue.diagnostics().ready).toBe(2));
  expect(generate).toHaveBeenCalledTimes(2);
  expect(queue.get(keys[0]!)?.samples[0]).toBe(1);
  expect(queue.get(keys[1]!)?.samples[0]).toBe(2);
  expect(readNovelSpeechKey(keys[0]!)).toEqual({ text: '"Hello."', voice: "M2" });
  queue.dispose();
});
