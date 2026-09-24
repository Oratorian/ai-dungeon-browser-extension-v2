import { browser } from "wxt/browser";

export const FIREFOX_ENGINE_URL = "http://localhost:4177/engine.html";
export const FIREFOX_HELPER_INSTALL = "Firefox TTS helper unavailable. Install the TTS Helper using its Windows setup wizard, then retry Initialize TTS. Or turn acceleration off.";
type Port = ReturnType<typeof browser.runtime.connectNative>;
type Connection = {
  port: Port; ready: Promise<void>; resolve: () => void; reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>; started: boolean;
};

/** One native host shared by the adventure routes in this extension instance. */
export class FirefoxTtsHelper {
  private connection?: Connection;
  constructor(private onFailure: (message: string) => void) {}
  start(): Promise<void> {
    if (this.connection) return this.connection.ready;
    let port: Port;
    try { port = browser.runtime.connectNative("dungeon_extension.tts_helper"); }
    catch { return Promise.reject(new Error(FIREFOX_HELPER_INSTALL)); }
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const ready = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
    const connection: Connection = { port, ready, resolve, reject, started: false,
      timer: setTimeout(() => fail("Firefox TTS helper did not start in time. Reinstall the helper and retry Initialize TTS."), 12000) };
    this.connection = connection;
    const fail = (message: string) => {
      if (this.connection !== connection) return;
      this.stop(new Error(message));
      this.onFailure(message);
    };
    port.onMessage.addListener(data => {
      if (this.connection !== connection) return;
      if (data?.type === "error") { fail(`Firefox TTS helper: ${String(data.message).slice(0, 500)}`); return; }
      if (data?.type !== "ready" || data.protocol !== 1 || data.engineUrl !== FIREFOX_ENGINE_URL) {
        fail("Firefox TTS helper is incompatible. Update the helper and extension together."); return;
      }
      clearTimeout(connection.timer); connection.started = true; resolve();
    });
    port.onDisconnect.addListener(() => {
      // Access the error to acknowledge runtime messaging failures, without logging paths.
      void (port as Port & { error?: unknown }).error;
      fail(connection.started ? "Firefox TTS helper disconnected. Retry Initialize TTS." : FIREFOX_HELPER_INSTALL);
    });
    try { port.postMessage({ type: "start", protocol: 1 }); }
    catch { fail(FIREFOX_HELPER_INSTALL); }
    return ready;
  }
  stop(error = new Error("Firefox TTS helper stopped.")) {
    const connection = this.connection;
    if (!connection) return;
    this.connection = undefined;
    clearTimeout(connection.timer);
    connection.reject(error);
    try { connection.port.disconnect(); } catch {}
  }
}
