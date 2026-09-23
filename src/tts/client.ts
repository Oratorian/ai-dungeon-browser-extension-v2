import { browser } from "wxt/browser";
import type { NarrationAudio, NarrationOptions } from "./queue";

export class LocalNarrator {
  private iframe = document.createElement("iframe");
  private channel = new MessageChannel();
  private nextId = 0;
  private pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private ready: Promise<void>;
  private disposed = false;
  constructor(private options: NarrationOptions, progress: (message: string) => void) {
    this.iframe.hidden = true;
    this.iframe.title = "Local narration engine";
    this.iframe.src = browser.runtime.getURL("/tts.html");
    this.ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Narration engine did not start. Reload the extension and retry.")), 30000);
      this.pending.set(0, { resolve, reject, timer });
      this.channel.port1.onmessage = ({ data }) => {
        if (data.type === "progress") { progress(data.message); return; }
        if (data.type === "connected") data.id = 0;
        const pending = this.pending.get(data.id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pending.delete(data.id);
        if (data.type === "error") pending.reject(new Error(data.message));
        else pending.resolve(data);
      };
      this.iframe.onload = () => this.iframe.contentWindow?.postMessage({ type: "de-tts-connect" }, "*", [this.channel.port2]);
      document.body.append(this.iframe);
    }).then(async () => {
      const result = await this.request({ type: "load", threads: options.threads });
      progress(`Narration ready: ${result.threads} CPU thread${result.threads === 1 ? " (browser isolation limit)" : "s"}.`);
    });
    // Loading may fail before the queue's first request attaches its handler.
    void this.ready.catch(() => {});
  }
  private request(message: object): Promise<any> {
    if (this.disposed) return Promise.reject(new Error("Narration stopped."));
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Narration timed out. Turn narration off and on to restart."));
        this.dispose();
      }, 15 * 60 * 1000);
      this.pending.set(id, { resolve, reject, timer });
      this.channel.port1.postMessage({ ...message, id });
    });
  }
  async generate(text: string): Promise<NarrationAudio> {
    await this.ready;
    return this.request({ type: "speak", text, voice: this.options.voice, steps: this.options.steps });
  }
  dispose() {
    this.disposed = true;
    this.iframe.remove();
    this.channel.port1.close();
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Narration stopped."));
    }
    this.pending.clear();
  }
}

export function narrationWav({ samples, sampleRate }: NarrationAudio): Blob {
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
