# Firefox-first TTS threading prototype

## Use with VN narration

Firefox uses the original embedded single-threaded engine by default, with no server or extra tab.
Both VN Settings and Extension Settings > Visual Novel Mode have an **Accelerated TTS**
switch. When enabled, a **Threads** selector appears with 2 (default), 4 and 6 as the only choices.
Changing mode or thread count restarts the engine. Chrome uses its embedded engine by default;
its optional acceleration uses a built-in offscreen document without a server or extra tab.

1. Install the Windows [TTS Helper package](../../native/tts-helper/README.md) once using `Install.cmd`.
2. Build with `npm run build:firefox`, reload that extension, and refresh AI Dungeon.
3. Enable TTS and Accelerated TTS in either settings menu. The extension starts the native server and opens an engine tab in the background automatically.
   Keep it open. Existing cached prototype models are reused; otherwise click Initialize TTS.
4. Use VN normally. Voice, steps, pitch, preview and the narration queue keep their existing controls.

Exit VN stops playback and pending queue work, while retaining the loaded engine for re-entry.
An in-progress synthesis may finish. Turning TTS off, closing the owning adventure tab, or reloading
the extension disconnects and closes that engine tab. Turning acceleration off closes the tab and
returns to the embedded engine. Each adventure tab gets a separate engine,
so multiple simultaneous adventures use additional model memory.

If the helper is missing or the engine tab is closed, the TTS status reports the problem.
Install the helper if needed and click Initialize TTS to reconnect. After the last reader closes,
the helper stops automatically. No remote hosting is configured. The standalone developer
benchmark below still uses Node; stop that server before enabling native-helper acceleration.

Diagnostics report the engine context, actual initialized thread count and isolation state.
The background relay accepts only AI Dungeon client tabs and the specific engine tab it opened.
Story text and audio travel through extension messaging, not the local HTTP server. Model downloads
continue through the background helper.

## Standalone benchmark

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
See `firefox-capabilities.json`. Subsequent user benchmarks confirmed working background downloads
and Supertonic execution: at 7 steps, warmed female-voice median generation was 6.00 seconds at
one thread, 3.00 seconds at two, and 2.79 seconds at four, for 8.01 seconds of audio. These are
measurements on one machine, not guaranteed performance elsewhere.

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

The loopback content-script bridge accepts only the exact local origin and known model paths.
The engine page is `/engine.html`; `/` remains the standalone benchmark.

Build without starting a server: `node scripts/tts-firefox-prototype.mjs --build-only`.
