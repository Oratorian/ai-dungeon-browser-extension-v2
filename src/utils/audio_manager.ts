import { writable, get } from "svelte/store";
import { settings, Storage } from "./storage";
import type { AudioClip } from "./types";

class AudioManagerClass {
  private audioElement: HTMLAudioElement | null = null;
  private volumeUnsubscribe: (() => void) | null = null;

  public currentlyPlaying = writable<string | null>(null);

  constructor() {
    this.volumeUnsubscribe = settings.subscribe((s) => {
      if (this.audioElement) {
        this.audioElement.volume = s.volume / 100;
      }
    });
  }

  getClipById(id: string): AudioClip | null {
    const clips = get(Storage.audioLibrary);
    return clips.find((c) => c.id === id) ?? null;
  }

  play(clipId: string): boolean {
    const clip = this.getClipById(clipId);
    if (!clip) return false;

    this.stop();

    this.audioElement = new Audio(clip.data);
    this.audioElement.volume = get(settings).volume / 100;
    this.audioElement.onended = () => {
      this.currentlyPlaying.set(null);
    };
    this.audioElement.onerror = () => {
      this.currentlyPlaying.set(null);
    };
    this.audioElement.play();
    this.currentlyPlaying.set(clipId);
    return true;
  }

  stop(): void {
    if (this.audioElement) {
      this.audioElement.onended = null;
      this.audioElement.onerror = null;

      this.audioElement.pause();
      this.audioElement.src = "";
      this.audioElement = null;
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
    if (this.volumeUnsubscribe) {
      this.volumeUnsubscribe();
    }
  }
}

export const AudioManager = new AudioManagerClass();
