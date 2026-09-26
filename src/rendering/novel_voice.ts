import type { NarratorVoice } from "@/tts/voices";

export function novelDialogueVoice(gender: unknown, narration: "M5" | "F5", male: string, female: string): NarratorVoice {
  if (gender === "male") return /^M[1-4]$/.test(male) ? male as NarratorVoice : "M1";
  if (gender === "female") return /^F[1-4]$/.test(female) ? female as NarratorVoice : "F1";
  return narration;
}

/** Voice is part of the cache identity: identical words may belong to different speakers. */
export function novelSpeechKey(text: string, voice: NarratorVoice): string {
  return JSON.stringify([text, voice]);
}

export function readNovelSpeechKey(key: string): { text: string; voice: NarratorVoice } {
  const [text, voice] = JSON.parse(key) as [string, NarratorVoice];
  return { text, voice };
}
