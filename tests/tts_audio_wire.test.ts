import { describe, expect, it } from "vitest";
import { audioMessages, AudioReceiver } from "@/tts/audio_wire";

describe("Chrome PCM transport", () => {
  it("preserves float samples through JSON across multiple chunks", () => {
    const audio = { samples: Float32Array.from({ length: 40000 }, (_, i) => Math.sin(i)), sampleRate: 44100 };
    const receiver = new AudioReceiver();
    let result;
    const messages = [...audioMessages(audio, 7)];
    expect(messages.length).toBeGreaterThan(3);
    for (const message of messages) result = receiver.receive(JSON.parse(JSON.stringify(message)));
    expect(result?.samples).toEqual(audio.samples);
    expect(result?.sampleRate).toBe(44100);
  });
  it("rejects incomplete and out-of-order audio instead of playing corrupt samples", () => {
    const receiver = new AudioReceiver();
    receiver.receive({ type: "audio-start", bytes: 8, sampleRate: 44100 });
    expect(() => receiver.receive({ type: "audio-end" })).toThrow("Incomplete");
    expect(() => receiver.receive({ type: "audio-chunk", offset: 4, data: "AAAAAA==" })).toThrow("Invalid");
  });
});
