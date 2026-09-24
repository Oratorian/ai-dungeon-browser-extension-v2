import { browser } from "wxt/browser";
import type { NarrationAudio, NarrationOptions } from "./queue";
import { narrationThreadCount } from "./capabilities";
import { AudioReceiver } from "./audio_wire";
import { FIREFOX_HELPER_INSTALL } from "./firefox_helper";

export class RemoteNarrator {
  private port = browser.runtime.connect({ name: "de-tts-client" });
  private pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private serial: Promise<unknown> = Promise.resolve();
  private ready: Promise<void>;
  private nextId = 0;
  private disposed = false;
  private threads: number | null = null;
  private isolated: boolean | null = null;
  private audio = new Map<number, AudioReceiver>();
  private firefox = import.meta.env.BROWSER === "firefox";
  constructor(progress: (message: string) => void, private failure?: (message: string) => void, private requestedThreads = 2) {
    this.requestedThreads = narrationThreadCount(requestedThreads);
    this.ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail(this.firefox
        ? FIREFOX_HELPER_INSTALL
        : "Chrome TTS engine unavailable. Retry Initialize TTS or turn acceleration off.", this.failure), 20000);
      this.pending.set(0, { resolve, reject, timer });
    });
    void this.ready.catch(() => {});
    this.port.onMessage.addListener(data => {
      if (data.type === "progress") { progress(data.message); return; }
      if (data.type === "fatal") { this.fail(data.message, failure); return; }
      const id = data.type === "connected" ? 0 : data.id;
      const pending = this.pending.get(id);
      if (!pending) return;
      if (["audio-start", "audio-chunk", "audio-end"].includes(data.type)) {
        try {
          let receiver = this.audio.get(id);
          if (!receiver) { receiver = new AudioReceiver(); this.audio.set(id, receiver); }
          const result = receiver.receive(data);
          if (!result) return;
          data = result;
        } catch (error) { data = { type: "error", message: error instanceof Error ? error.message : String(error) }; }
        this.audio.delete(id);
      }
      clearTimeout(pending.timer); this.pending.delete(id);
      if (data.type === "error") pending.reject(new Error(data.message));
      else pending.resolve(data);
    });
    this.port.onDisconnect.addListener(() => {
      if (!this.disposed) this.fail("TTS engine disconnected. Retry Initialize TTS.", failure);
    });
  }
  private fail(message: string, failure?: (message: string) => void) {
    if (this.disposed) return;
    this.disposeWithError(new Error(message));
    failure?.(message);
  }
  private async request(message: object): Promise<any> {
    await this.ready;
    if (this.disposed) throw new Error("Narration stopped.");
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => {
        this.fail("Narration timed out. Retry Initialize TTS.", this.failure);
      }, 15 * 60 * 1000);
      this.pending.set(id, { resolve, reject, timer });
      try { this.port.postMessage({ ...message, id }); }
      catch { this.fail("TTS engine disconnected. Retry Initialize TTS.", this.failure); }
    });
  }
  async cached() { return (await this.request({ type: "status" })).complete === true; }
  async initialize(download: boolean) {
    const result = await this.request({ type: "load", download, threads: this.requestedThreads });
    this.threads = result.threads;
    this.isolated = result.capabilities?.isolated === true;
    if (this.threads !== this.requestedThreads || !this.isolated) throw new Error(`TTS engine could not enable ${this.requestedThreads} threads. Retry Initialize TTS or turn acceleration off.`);
  }
  diagnostics() { return { context: this.firefox ? "Firefox isolated page" : "Chrome offscreen page", threads: this.threads, isolated: this.isolated }; }
  generate(text: string, options: NarrationOptions): Promise<NarrationAudio> {
    const task = this.serial.then(() => this.request({ type: "speak", text, ...options }));
    this.serial = task.catch(() => {});
    return task;
  }
  private disposeWithError(error: Error) {
    this.disposed = true;
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error); }
    this.pending.clear(); this.audio.clear(); this.port.disconnect();
  }
  dispose() { if (!this.disposed) this.disposeWithError(new Error("Narration stopped.")); }
}
