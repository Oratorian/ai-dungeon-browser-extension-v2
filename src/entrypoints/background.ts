// Background fetch proxy for cross-origin hosts the content script can't fetch itself.
//
// Chrome MV3 content scripts are subject to CORS; hosts that send no CORS headers (Trinetra,
// Pixabay pages, GitHub release assets on release-assets.githubusercontent.com) are blocked. The
// background (service worker in Chrome, background script in Firefox) can fetch any host in
// host_permissions without CORS in both browsers. The content script asks us to fetch a URL over a
// Port and we stream the body back in chunks, so even a 100+ MB asset doesn't travel as one message.
//
// Protocol (Port name "bg-fetch"):
//   content -> bg: { url, headers?, dataUri?, head?, maxBytes? }
//   bg -> content: { type: "chunk", data } (repeated), then { type: "done" }
//                  or { type: "error", status? }

const HEAD_DEFAULT_BYTES = 16384;
const CHUNK_FLUSH_CHARS = 1_000_000;
// The MV3 service worker's idle timer (~30s) only resets on messages/extension-API calls, not on
// body-stream reads. Ping a cheap API well under 30s so a slow or stalled transfer isn't reaped.
const KEEPALIVE_MS = 20_000;

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + step)));
  }
  return btoa(binary);
}

export default defineBackground(() => {
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== "bg-fetch") return;

    let disconnected = false;
    let keepalive: ReturnType<typeof setInterval> | undefined;
    let activeReader: ReadableStreamDefaultReader<Uint8Array> | undefined;

    // Posting to a disconnected Port throws; guard every send so a mid-transfer cancel is a no-op.
    const send = (msg: unknown) => {
      if (disconnected) return;
      try {
        port.postMessage(msg);
      } catch {
        disconnected = true;
      }
    };
    const stopKeepalive = () => {
      if (keepalive !== undefined) {
        clearInterval(keepalive);
        keepalive = undefined;
      }
    };

    port.onDisconnect.addListener(() => {
      disconnected = true;
      stopKeepalive();
      activeReader?.cancel().catch(() => {});
    });

    port.onMessage.addListener(async (raw) => {
      const req = raw as { url?: unknown; headers?: unknown; dataUri?: unknown; head?: unknown; maxBytes?: unknown };
      if (typeof req.url !== "string") {
        send({ type: "error" });
        return;
      }
      const head = req.head === true;
      const dataUri = req.dataUri === true;
      const maxBytes = typeof req.maxBytes === "number" && req.maxBytes > 0 ? req.maxBytes : HEAD_DEFAULT_BYTES;
      const headers = req.headers && typeof req.headers === "object" ? (req.headers as Record<string, string>) : undefined;

      keepalive = setInterval(() => {
        browser.runtime.getPlatformInfo().catch(() => {});
      }, KEEPALIVE_MS);

      try {
        const reqHeaders = head ? { ...headers, Range: `bytes=0-${maxBytes - 1}` } : headers;
        let res: Response;
        try {
          res = await fetch(req.url, reqHeaders ? { headers: reqHeaders } : undefined);
        } catch {
          send({ type: "error" });
          return;
        }
        if (disconnected) return;
        // A 206 is expected (and fine) for a Range request.
        if (!res.ok && !(head && res.status === 206)) {
          send({ type: "error", status: res.status });
          return;
        }

        // Binary -> data: URI (single message; images are small enough not to need streaming).
        if (dataUri) {
          const buf = await res.arrayBuffer();
          if (disconnected) return;
          const mime = res.headers.get("Content-Type") || "application/octet-stream";
          send({ type: "chunk", data: `data:${mime};base64,${toBase64(buf)}` });
          send({ type: "done" });
          return;
        }

        // Text -> streamed chunks.
        const reader = res.body?.getReader();
        if (!reader) {
          const text = await res.text();
          send({ type: "chunk", data: head ? text.slice(0, maxBytes) : text });
          send({ type: "done" });
          return;
        }
        activeReader = reader;
        const decoder = new TextDecoder();
        let batch = "";
        let received = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (disconnected) return;
          if (done) break;
          received += value.byteLength;
          batch += decoder.decode(value, { stream: true });
          if (batch.length >= CHUNK_FLUSH_CHARS) {
            send({ type: "chunk", data: batch });
            batch = "";
          }
          if (head && received >= maxBytes) {
            reader.cancel().catch(() => {});
            break;
          }
        }
        if (batch) send({ type: "chunk", data: batch });
        send({ type: "done" });
      } catch {
        send({ type: "error" });
      } finally {
        stopKeepalive();
        activeReader = undefined;
      }
    });
  });
});
