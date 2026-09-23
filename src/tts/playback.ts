import type { NarrationAudio } from "./queue";

function pitchedSampleRate(sampleRate: number, pitch: number): number {
  const semitones = Number.isFinite(pitch) ? Math.max(-3, Math.min(3, pitch)) : 0;
  return Math.round(sampleRate * 2 ** (semitones / 12));
}

/** Shift the PCM playback pitch, then use native pitch-preserving time stretch
 * to restore the original reading speed. At zero, both factors are exactly one. */
export function configureNarrationPlayback(player: HTMLAudioElement, sampleRate: number, pitch: number, volume: number) {
  player.preservesPitch = true;
  player.playbackRate = sampleRate / pitchedSampleRate(sampleRate, pitch);
  player.volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume / 100)) : 1;
}

export function narrationWav({ samples, sampleRate }: NarrationAudio, pitch = 0): Blob {
  sampleRate = pitchedSampleRate(sampleRate, pitch);
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const label = (offset: number, text: string) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  label(0, "RIFF"); view.setUint32(4, buffer.byteLength - 8, true); label(8, "WAVE");
  label(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); label(36, "data"); view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * (sample < 0 ? 32768 : 32767), true));
  return new Blob([buffer], { type: "audio/wav" });
}
