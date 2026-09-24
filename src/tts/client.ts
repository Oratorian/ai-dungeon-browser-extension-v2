import { browser } from "wxt/browser";
import type { NarrationAudio, NarrationOptions } from "./queue";

class EmbeddedNarrator {
  private iframe = document.createElement("iframe");
  private channel = new MessageChannel();
  private nextId = 0;
  private pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private ready: Promise<void>;
  private serial: Promise<unknown> = Promise.resolve();
  private disposed = false;
  constructor(progress: (message: string) => void, _failure?: (message: string) => void, _threads?: number) {
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
  async cached(): Promise<boolean> {
    await this.ready;
    return (await this.request({ type: "status" })).complete === true;
  }
  async initialize(download: boolean): Promise<void> {
    await this.ready;
    await this.request({ type: "load", download });
  }
  generate(text: string, options: NarrationOptions): Promise<NarrationAudio> {
    // A voice/quality change can replace the queue while an old request is still
    // running. Serialize across queues so the worker never silently drops work.
    const task = this.serial.then(async () => {
      await this.ready;
      return this.request({ type: "speak", text, voice: options.voice, steps: options.steps });
    });
    this.serial = task.catch(() => {});
    return task;
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
  diagnostics() { return { context: "Embedded extension page", threads: 1, isolated: null }; }
}

export const LocalNarrator = EmbeddedNarrator;
export type LocalNarrator = EmbeddedNarrator;
