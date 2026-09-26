import { expect, it } from "vitest";
import { isNarratorVoice, narratorVoice, narratorVoices, voiceAssets } from "@/tts/voices";

it("offers ten distinct numbered voices with matching download paths", () => {
  expect(narratorVoices.map(voice => voice.label)).toEqual([
    "Felix · Male 1", "Magnus · Male 2", "Alistair · Male 3", "Finn · Male 4", "Rowan · Male 5",
    "Selene · Female 1", "Pippa · Female 2", "Clara · Female 3", "Valeria · Female 4", "Willow · Female 5",
  ]);
  expect(new Set(voiceAssets).size).toBe(10);
  for (const voice of narratorVoices) {
    expect(isNarratorVoice(voice.value)).toBe(true);
    expect(voiceAssets).toContain(`voice_styles/${voice.value}.json`);
    expect(narratorVoice(voice.value)).toBe(voice.value);
  }
});
it.each([undefined, null, "M0", "F6", "M55", "../M1", "M1.json", "m1"])("rejects invalid voice identifiers: %s", value => {
  expect(isNarratorVoice(value)).toBe(false);
  expect(narratorVoice(value)).toBe("M5");
});
