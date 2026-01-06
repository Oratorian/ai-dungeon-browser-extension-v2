import { writable, get } from "svelte/store";
import { settings, Storage } from "./storage";
import type { AudioClip } from "./types";

class AudioManagerClass {
  private audioContext: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private bufferCache = new Map<string, AudioBuffer>();
  private volumeUnsubscribe: (() => void) | null = null;

  public currentlyPlaying = writable<string | null>(null);

  constructor() {
    this.volumeUnsubscribe = settings.subscribe((s) => {
      if (this.gainNode) {
        this.gainNode.gain.value = s.volume / 100;
      }
    });
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  private async loadBuffer(clip: AudioClip): Promise<AudioBuffer | null> {
    if (this.bufferCache.has(clip.id)) {
      return this.bufferCache.get(clip.id)!;
    }

    try {
      const response = await fetch(clip.data);
      const arrayBuffer = await response.arrayBuffer();
      const ctx = this.getAudioContext();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      this.bufferCache.set(clip.id, audioBuffer);
      return audioBuffer;
    } catch {
      return null;
    }
  }

  getClipById(id: string): AudioClip | null {
    const clips = get(Storage.audioLibrary);
    return clips.find((c) => c.id === id) ?? null;
  }

  play(clipId: string): boolean {
    const clip = this.getClipById(clipId);
    if (!clip) return false;

    // Prevent playing the same clip 12030123 times
    if (get(this.currentlyPlaying) === clipId && this.sourceNode) {
      return true;
    }

    this.stop();
    this.currentlyPlaying.set(clipId);

    this.loadBuffer(clip).then((buffer) => {
      if (!buffer || get(this.currentlyPlaying) !== clipId) return;

      const ctx = this.getAudioContext();
      if (ctx.state === "suspended") ctx.resume();

      this.gainNode = ctx.createGain();
      this.gainNode.gain.value = get(settings).volume / 100;
      this.gainNode.connect(ctx.destination);

      this.sourceNode = ctx.createBufferSource();
      this.sourceNode.buffer = buffer;
      this.sourceNode.loop = true;
      this.sourceNode.connect(this.gainNode);
      this.sourceNode.start(0);
    });

    return true;
  }

  stop(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
      } catch {
        // Already stopped
      }
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    this.currentlyPlaying.set(null);
  }

  toggle(clipId: string): void {
    if (get(this.currentlyPlaying) === clipId) {
      this.stop();
    } else {
      this.play(clipId);
    }
  }

  isPlaying(clipId: string): boolean {
    return get(this.currentlyPlaying) === clipId;
  }

  validateClipIds(ids: string[]): string[] {
    const clips = get(Storage.audioLibrary);
    const validIds = new Set(clips.map((c) => c.id));
    return ids.filter((id) => validIds.has(id));
  }

  cleanupInvalidReferences(): void {
    const adventures = get(Storage.adventures);
    const clips = get(Storage.audioLibrary);
    const validIds = new Set(clips.map((c) => c.id));

    for (const [adventureId, adventure] of Object.entries(adventures)) {
      for (const [cardId, card] of Object.entries(adventure.storyCards)) {
        if (card.audioClips && card.audioClips.length > 0) {
          const validClips = card.audioClips.filter((id) => validIds.has(id));
          if (validClips.length !== card.audioClips.length) {
            Storage.updateStoryCard(adventureId, cardId, { audioClips: validClips });
          }
        }
      }
    }
  }

  destroy(): void {
    this.stop();
    this.bufferCache.clear();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.volumeUnsubscribe) {
      this.volumeUnsubscribe();
    }
  }
}

export const AudioManager = new AudioManagerClass();
