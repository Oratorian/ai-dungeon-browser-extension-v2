export type NarrationOptions = { voice: "M5" | "F5"; steps: number; threads: string };
export type NarrationAudio = { samples: Float32Array; sampleRate: number };

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
    this.wanted = [...new Set(texts.filter(text => text.trim()))].slice(0, 4);
    for (const key of this.cache.keys()) if (!this.wanted.includes(key)) this.cache.delete(key);
    for (const key of this.failed) if (!this.wanted.includes(key)) this.failed.delete(key);
    void this.pump();
  }
  get(text: string) { return this.cache.get(text); }
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
