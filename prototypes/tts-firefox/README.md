# Firefox-first TTS threading prototype

Run from the repository root:

```powershell
npm run build:firefox
node scripts/tts-firefox-prototype.mjs
```

Load `.output/firefox-mv2/manifest.json` in Firefox using `about:debugging`, then open
`http://localhost:4177/` in a **top-level tab**. Reload the prototype page after loading the extension.
The prototype server binds only to loopback and sends COOP/COEP headers. No browser flags or
security preference changes are needed. Stop the server with Ctrl+C.

The worker reports secure context, cross-origin isolation, shared-memory messaging, WASM atomic
instruction support, and logical core count. It also initializes ONNX with four threads and runs
a tiny locally encoded Identity model. These checks need no model downloads.
They prove runtime execution, not a measured TTS speed improvement.

Verified on 2026-09-24 using installed Firefox 156 on Windows, in a fresh headless profile:
all four capability checks passed, ONNX retained four threads, and the Identity output was correct.
See `firefox-capabilities.json`. The full Supertonic benchmark and extension download bridge still
need a run in Firefox with this branch's extension loaded; no TTS speedup has been measured yet.

The benchmark requires the extension download bridge. All model downloads use the existing
background helper and a pinned, allowlisted Supertonic model revision. Files are cached in this
page's origin, separately from the normal extension cache. Initial setup therefore may download
the models again. The server never receives narration text or generated audio.

Press **Run 1 / 2 / 4 benchmark**. Every thread count gets a new worker, one warm-up and three
measured synthesis requests using identical text, voice and steps. Compare the median and the
generation/audio ratio. Model loading is separate; its first measurement includes uncached
downloads. Audio lengths can vary because synthesis is stochastic. Keep the tab in the foreground
and avoid other heavy workloads. Results reject any silent fallback to fewer threads.

**Download results** exports capabilities, configuration and timings, without the narration text.
**Stop** terminates inference immediately; an asset download already underway may finish caching.
Wait for that download to finish before restarting the benchmark.

Normal VN narration still uses the existing iframe and defaults to one thread. This prototype
does not yet route live story narration to the separate page. The loopback content-script bridge
on this experimental branch accepts only the exact prototype origin and known model paths.

Build without starting a server: `node scripts/tts-firefox-prototype.mjs --build-only`.
