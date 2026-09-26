export type NarratorVoice = `${"M" | "F"}${1 | 2 | 3 | 4 | 5}`;
export const narratorVoices = (["M", "F"] as const).flatMap(prefix =>
  [1, 2, 3, 4, 5].map(number => ({
    value: `${prefix}${number}` as NarratorVoice,
    label: `${prefix === "M" ? "Male" : "Female"} ${number}`,
  })));
export const voiceAssets = narratorVoices.map(voice => `voice_styles/${voice.value}.json`);
export function isNarratorVoice(value: unknown): value is NarratorVoice {
  return typeof value === "string" && /^[MF][1-5]$/.test(value);
}
export function narratorVoice(value: unknown): NarratorVoice {
  return isNarratorVoice(value) ? value : "M5";
}
