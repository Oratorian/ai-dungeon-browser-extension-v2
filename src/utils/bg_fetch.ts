import { browser } from "wxt/browser";

// Shared client for fetching cross-origin hosts that a Chrome MV3 content script can't fetch
// directly because they send no CORS headers (Trinetra, Pixabay pages, GitHub release assets). The
// background script does the privileged fetch and streams the body back over a Port, so even a
// 100+ MB download doesn't travel as one oversized message. See src/entrypoints/background.ts.

export class BgFetchError extends Error {
  /** true when the port dropped before any reply, i.e. the background never handled the request. */
  coldStart = false;
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = "BgFetchError";
  }
}

export type BgFetchOptions = {
  /** extra request headers, e.g. an API key. */
  headers?: Record<string, string>;
  /** return a `data:` URI (base64) instead of decoded text, for binary content like images. */
  dataUri?: boolean;
  /** read only the first `maxBytes` (text only), for a cheap head peek. */
  head?: boolean;
  maxBytes?: number;
};

function bgFetchOnce(url: string, opts: BgFetchOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const port = browser.runtime.connect({ name: "bg-fetch" });
    let out = "";
    let settled = false;
    let replied = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      try {
        port.disconnect();
      } catch {
        // already disconnected
      }
      fn();
    };
    port.onMessage.addListener((raw) => {
      replied = true;
      const msg = raw as { type?: string; data?: string; status?: number; error?: string };
      if (msg.type === "chunk") out += msg.data ?? "";
      else if (msg.type === "done") finish(() => resolve(out));
      else if (msg.type === "error")
        finish(() =>
          reject(
            new BgFetchError(
              msg.status ? `Request failed (${msg.status}).` : msg.error ? `Fetch failed: ${msg.error}` : "Request failed.",
              msg.status
            )
          )
        );
    });
    port.onDisconnect.addListener(() =>
      finish(() => {
        const err = new BgFetchError(
          replied ? "Background request disconnected (service worker may have stopped)." : "Background service worker did not respond."
        );
        err.coldStart = !replied;
        reject(err);
      })
    );
    port.postMessage({
      url,
      headers: opts.headers ?? null,
      dataUri: opts.dataUri ?? false,
      head: opts.head ?? false,
      maxBytes: opts.maxBytes ?? null,
    });
  });
}

/** Fetches `url` in the background and resolves with the body as text (or a `data:` URI). */
export async function bgFetch(url: string, opts: BgFetchOptions = {}): Promise<string> {
  try {
    return await bgFetchOnce(url, opts);
  } catch (e) {
    // A cold Chrome MV3 service worker can drop the very first connection before it registers its
    // listener; retry once now that the worker has spun up.
    if (e instanceof BgFetchError && e.coldStart) return bgFetchOnce(url, opts);
    throw e;
  }
}
