import type { NarrationAudio } from "./queue";

// Chrome runtime messages use JSON. Chunk PCM bytes instead of serializing typed-array objects.
export function* audioMessages(audio: NarrationAudio, id: number) {
  const bytes = new Uint8Array(audio.samples.buffer, audio.samples.byteOffset, audio.samples.byteLength);
  yield { type: "audio-start", id, bytes: bytes.length, sampleRate: audio.sampleRate };
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    const chunk = bytes.subarray(offset, offset + 32768);
    yield { type: "audio-chunk", id, offset, data: btoa(String.fromCharCode(...chunk)) };
  }
  yield { type: "audio-end", id };
}

export class AudioReceiver {
  private buffer?: Uint8Array;
  private offset = 0;
  private sampleRate = 0;
  receive(data: any): NarrationAudio | undefined {
    if (data.type === "audio-start") {
      if (this.buffer || !Number.isSafeInteger(data.bytes) || data.bytes < 0 || data.bytes > 128_000_000
        || data.bytes % 4 || !Number.isFinite(data.sampleRate) || data.sampleRate <= 0) throw new Error("Invalid narration audio header.");
      this.buffer = new Uint8Array(data.bytes); this.sampleRate = data.sampleRate;
    } else if (data.type === "audio-chunk") {
      if (!this.buffer || data.offset !== this.offset || typeof data.data !== "string" || data.data.length > 44000) throw new Error("Invalid narration audio chunk.");
      const bytes = Uint8Array.from(atob(data.data), char => char.charCodeAt(0));
      if (this.offset + bytes.length > this.buffer.length) throw new Error("Narration audio exceeds expected length.");
      this.buffer.set(bytes, this.offset); this.offset += bytes.length;
    } else if (data.type === "audio-end") {
      if (!this.buffer || this.offset !== this.buffer.length) throw new Error("Incomplete narration audio.");
      return { samples: new Float32Array(this.buffer.buffer), sampleRate: this.sampleRate };
    }
  }
}
