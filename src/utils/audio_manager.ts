import { writable, get } from "svelte/store";
import { settings, Storage } from "./storage";
import type { AudioClip } from "./types";

// Below this we don't bother crossfading (curve automation gets fiddly on tiny buffers); such a
// short clip just loops natively. The crossfade length itself is a user setting (audioCrossfade,
// in ms); it's capped at 40% of the clip here so a long overlap can never swallow a short loop.
// Kept above SCHEDULE_MARGIN / 0.6 so the smallest possible pass spacing stays > SCHEDULE_MARGIN.
const MIN_LOOP_DURATION = 0.5;
// How far ahead of a seam we wake up to schedule the next overlapping pass. The pass itself is
// started on the exact audio clock, so timer jitter under this margin never causes a gap.
const SCHEDULE_MARGIN = 0.25;

type ActiveVoice = { src: AudioBufferSourceNode; gain: GainNode };

class AudioManagerClass {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeVoices: ActiveVoice[] = [];
  private scheduleTimer: ReturnType<typeof setTimeout> | null = null;
  private bufferCache = new Map<string, AudioBuffer>();
  private volumeUnsubscribe: (() => void) | null = null;
  // Bumped on every play()/stop(); pending loads and scheduled seams check it so a stale one bails.
  private playToken = 0;
  // Equal-power crossfade shapes (sin/cos) so the summed loudness stays roughly constant across a
  // seam, instead of the ~6dB dip you'd get from linear ramps on two uncorrelated signals.
  private readonly fadeInCurve: Float32Array;
  private readonly fadeOutCurve: Float32Array;

  public currentlyPlaying = writable<string | null>(null);

  constructor() {
    const n = 65;
    this.fadeInCurve = new Float32Array(n);
    this.fadeOutCurve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1); // 0..1
      this.fadeInCurve[i] = Math.sin((Math.PI / 2) * t); // 0 -> 1
      this.fadeOutCurve[i] = Math.cos((Math.PI / 2) * t); // 1 -> 0
    }

    this.volumeUnsubscribe = settings.subscribe((s) => {
      if (this.masterGain) {
        this.masterGain.gain.value = s.volume / 100;
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
    if (get(this.currentlyPlaying) === clipId && this.activeVoices.length > 0) {
      return true;
    }

    this.stop();
    const token = ++this.playToken;
    this.currentlyPlaying.set(clipId);

    this.loadBuffer(clip).then((buffer) => {
      // Bail if we were stopped, switched clips, or replaced by a newer play() while decoding.
      if (!buffer || token !== this.playToken || get(this.currentlyPlaying) !== clipId) return;
      this.startSeamlessLoop(buffer, token);
    });

    return true;
  }

  // Plays `buffer` forever by chaining overlapping copies: each pass fades out over its final
  // crossfade window while the next pass, started early, fades in over the same window. This hides
  // the fade-to-silence tail (and hard attack) that a plain buffer loop would expose at every seam.
  private startSeamlessLoop(buffer: AudioBuffer, token: number): void {
    const ctx = this.getAudioContext();
    if (ctx.state === "suspended") ctx.resume();

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = get(settings).volume / 100;
    this.masterGain.connect(ctx.destination);

    const duration = buffer.duration;
    // `|| 0` guards a transient NaN from an empty number input; a NaN would later throw in
    // setValueCurveAtTime. 0 (or any non-positive value) falls through to the native loop below.
    const maxCrossfade = Math.max(0, (get(settings).audioCrossfade || 0) / 1000);

    // No crossfade requested (setting at 0), or a clip too short to overlap cleanly: plain gapless
    // native loop, i.e. the tight seam that's ideal for clips already built to loop.
    if (maxCrossfade <= 0 || duration < MIN_LOOP_DURATION) {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const gain = ctx.createGain();
      src.connect(gain);
      gain.connect(this.masterGain);
      const voice: ActiveVoice = { src, gain };
      this.activeVoices.push(voice);
      src.start();
      return;
    }

    const crossfade = Math.min(maxCrossfade, duration * 0.4);
    const period = duration - crossfade; // spacing between successive pass starts
    let nextStart = ctx.currentTime + 0.06;

    const schedulePass = () => {
      if (token !== this.playToken || !this.masterGain) return;

      const start = nextStart;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      src.connect(gain);
      gain.connect(this.masterGain);

      // Fade in over the first `crossfade`, hold at 1, fade out over the last `crossfade`.
      gain.gain.setValueCurveAtTime(this.fadeInCurve, start, crossfade);
      gain.gain.setValueCurveAtTime(this.fadeOutCurve, start + duration - crossfade, crossfade);

      src.start(start);
      src.stop(start + duration + 0.02);

      const voice: ActiveVoice = { src, gain };
      this.activeVoices.push(voice);
      src.onended = () => {
        try {
          gain.disconnect();
          src.disconnect();
        } catch {
          // already torn down
        }
        this.activeVoices = this.activeVoices.filter((v) => v !== voice);
      };

      nextStart = start + period;

      // Wake up a little before the next seam, measured against the audio clock (not a fixed
      // `period - margin`) so scheduling self-corrects and can never run ahead of real time and
      // pile up a backlog of passes. The pass is started on the exact clock above, so the overlap
      // stays sample-accurate as long as this fires before `nextStart`.
      const delayMs = Math.max(0, (nextStart - SCHEDULE_MARGIN - ctx.currentTime) * 1000);
      this.scheduleTimer = setTimeout(schedulePass, delayMs);
    };

    schedulePass();
  }

  stop(): void {
    // Invalidate any in-flight decode or scheduled seam.
    this.playToken++;

    if (this.scheduleTimer !== null) {
      clearTimeout(this.scheduleTimer);
      this.scheduleTimer = null;
    }

    for (const { src, gain } of this.activeVoices) {
      try {
        src.onended = null;
        src.stop();
      } catch {
        // Already stopped
      }
      src.disconnect();
      gain.disconnect();
    }
    this.activeVoices = [];

    if (this.masterGain) {
      this.masterGain.disconnect();
      this.masterGain = null;
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
