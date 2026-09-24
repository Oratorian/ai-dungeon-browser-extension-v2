export type NarrationOptions = { voice: "M5" | "F5"; steps: number };
export type NarrationAudio = { samples: Float32Array; sampleRate: number };

export function narrationQueueSize(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.min(20, Math.round(value))) : 3;
}

/** Debounce each text independently so a streaming tail cannot starve earlier sentences. */
export class StableNarrationWindow {
  private texts: string[] = [];
  private stable = new Set<string>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  constructor(private update: (texts: string[]) => void) {}
  setWindow(texts: string[]) {
    this.texts = texts;
    for (const [text, timer] of this.timers) {
      if (!texts.includes(text)) { clearTimeout(timer); this.timers.delete(text); }
    }
    for (const text of this.stable) if (!texts.includes(text)) this.stable.delete(text);
    for (const text of texts) {
      if (this.stable.has(text) || this.timers.has(text)) continue;
      this.timers.set(text, setTimeout(() => {
        this.timers.delete(text); this.stable.add(text);
        this.update(this.texts.filter(value => this.stable.has(value)));
      }, 500));
    }
    // Retain the current desired window while its new text settles. The inference
    // queue receives only stable text, and removed work is dropped immediately.
    this.update(this.texts.filter(value => this.stable.has(value)));
  }
  dispose() { for (const timer of this.timers.values()) clearTimeout(timer); this.timers.clear(); }
}

/** One inference at a time. Navigation replaces pending work without discarding useful audio. */
export class NarrationQueue {
  private wanted: string[] = [];
  private cache = new Map<string, NarrationAudio>();
  private failed = new Set<string>();
  private running = false;
  private disposed = false;
  constructor(
    private generate: (text: string) => Promise<NarrationAudio>,
    private changed: (text: string, error?: string) => void,
  ) {}

  setWindow(texts: string[]) {
    // The reader supplies the configured window, including the current line.
    this.wanted = [...new Set(texts.filter(text => text.trim()))];
    for (const key of this.cache.keys()) if (!this.wanted.includes(key)) this.cache.delete(key);
    for (const key of this.failed) if (!this.wanted.includes(key)) this.failed.delete(key);
    void this.pump();
  }
  get(text: string) { return this.cache.get(text); }
  hasFailed(text: string) { return this.failed.has(text); }
  diagnostics() {
    return { ready: this.cache.size, total: this.wanted.length, failed: this.failed.size, generating: this.running };
  }
  retry(text: string) { this.failed.delete(text); void this.pump(); }
  dispose() { this.disposed = true; this.wanted = []; this.cache.clear(); this.failed.clear(); }

  private async pump() {
    if (this.running || this.disposed) return;
    this.running = true;
    try {
      while (!this.disposed) {
        const text = this.wanted.find(key => !this.cache.has(key) && !this.failed.has(key));
        if (!text) break;
        try {
          const audio = await this.generate(text);
          if (!this.disposed && this.wanted.includes(text)) {
            this.cache.set(text, audio);
            this.changed(text);
          }
        } catch (error) {
          if (!this.disposed && this.wanted.includes(text)) {
            this.failed.add(text);
            this.changed(text, error instanceof Error ? error.message : String(error));
          }
        }
      }
    } finally { this.running = false; }
  }
}
