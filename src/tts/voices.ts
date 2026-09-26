export type NarratorVoice = `${"M" | "F"}${1 | 2 | 3 | 4 | 5}`;
// Extension nicknames; the upstream identifiers remain unchanged for models and saved settings.
const voiceNames: Record<NarratorVoice, string> = {
  M1: "Felix", M2: "Magnus", M3: "Alistair", M4: "Finn", M5: "Rowan",
  F1: "Selene", F2: "Pippa", F3: "Clara", F4: "Valeria", F5: "Willow",
};
export const narratorVoices = (["M", "F"] as const).flatMap(prefix =>
  [1, 2, 3, 4, 5].map(number => ({
    value: `${prefix}${number}` as NarratorVoice,
    label: `${voiceNames[`${prefix}${number}` as NarratorVoice]} · ${prefix === "M" ? "Male" : "Female"} ${number}`,
  })));
export const voiceAssets = narratorVoices.map(voice => `voice_styles/${voice.value}.json`);
export function isNarratorVoice(value: unknown): value is NarratorVoice {
  return typeof value === "string" && /^[MF][1-5]$/.test(value);
}
export function narratorVoice(value: unknown): NarratorVoice {
  return isNarratorVoice(value) ? value : "M5";
}
