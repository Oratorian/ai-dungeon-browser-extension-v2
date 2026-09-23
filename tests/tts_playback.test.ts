import { describe, expect, it } from "vitest";
import { configureNarrationPlayback, narrationWav } from "@/tts/playback";

describe("narrator pitch", () => {
  it.each([-3, 0, 3])("shifts the WAV pitch by %s semitones and compensates duration", async pitch => {
    const sampleRate = 44100;
    const samples = new Float32Array(sampleRate);
    const blob = narrationWav({ samples, sampleRate }, pitch);
    const header = new DataView(await blob.arrayBuffer());
    const shiftedRate = header.getUint32(24, true);
    const player = {} as HTMLAudioElement;
    configureNarrationPlayback(player, sampleRate, pitch, 75);
    expect(shiftedRate).toBe(Math.round(sampleRate * 2 ** (pitch / 12)));
    expect(header.getUint32(28, true)).toBe(shiftedRate * 2);
    expect(player.preservesPitch).toBe(true);
    expect(samples.length / shiftedRate / player.playbackRate).toBeCloseTo(1, 8);
    expect(player.volume).toBe(0.75);
  });
  it("limits imported settings and handles invalid pitch", async () => {
    const pcm = { samples: new Float32Array(1), sampleRate: 44100 };
    for (const [pitch, expected] of [[100, 3], [-100, -3], [NaN, 0]]) {
      const header = new DataView(await narrationWav(pcm, pitch).arrayBuffer());
      expect(header.getUint32(24, true)).toBe(Math.round(44100 * 2 ** (expected! / 12)));
    }
  });
});
