# Optional TTS acceleration

The **Accelerated TTS** switch is available in both VN Settings and Extension Settings > Visual
Novel Mode. It defaults off. When enabled, the thread selector offers **2, 4, or 6**, defaulting to
two. Changing the mode or thread count restarts the engine. Disabling acceleration restores the
embedded single-threaded engine.

## Chrome

Acceleration runs in a bundled, isolated offscreen extension document. No server, browser tab,
or companion installation is required. Chrome 116 or newer is required by this build.

The extension requests the `offscreen` permission and creates the document with the `WORKERS`
reason. Each adventure owns an independent worker and request stream inside the single document.
Turning TTS off or closing its adventure destroys that worker and releases its models. Exit VN
stops playback and queued generation but keeps the loaded engine available for re-entry. The
empty offscreen document may remain idle; it holds no model workers after all readers disconnect.

Models use the extension's existing cache. Downloads still run through the background fetch helper.
Audio travels as bounded PCM chunks through Chrome's JSON message transport and is reconstructed
as a Float32Array in the reader. The heartbeat runs only while engines are attached, keeping the
MV3 relay available during long synthesis operations.

## Firefox

Acceleration uses a separate isolated local page served by the installed native helper.
On Windows x64, run **DungeonExtension-TTS-Helper-Setup-windows-x64.exe** once and
follow the setup wizard. No Node or .NET installation is needed. Firefox starts the helper automatically
when accelerated narration is requested. See [helper setup and build instructions](../native/tts-helper/README.md).
The engine opens beside its owning story in the same window. Firefox versions with tab-group
support put both tabs in an **AI Dungeon + TTS** group, or reuse the story's existing group.
Closing the group tears down its engines. Closing just the story also closes its engine tab.
Grouping failure does not prevent narration or ownership cleanup. The helper's native
connection is shared across readers and disconnected after the final reader closes.
That closes the local server too. Exiting/minimizing VN retains the loaded reader;
turn TTS off or close its story to release it. Stop any old manual Node server first,
because the helper requires port 4177. Other operating systems use single-thread TTS
until a native-helper package is supplied for them.
The active engine source lives in `native/tts-helper/engine` and is bundled by
`scripts/build-tts-engine.mjs`. Its existing model cache is retained across updates.

## Verification

Both backends report actual initialized threads and isolation in diagnostics. A fallback to fewer
threads is reported as an initialization error; the user can disable acceleration to use the
embedded engine.

Native helper verification (Windows, after building its package):

```powershell
node scripts/check-tts-helper.mjs
```

This launches the packaged executable without installing it and checks native message
framing, its ready handshake, packaged assets, isolation headers, request restrictions,
port conflicts, incompatible protocols/extensions, EOF shutdown, and restart. Port 4177
must be free; the check does not stop an existing server. Registry installation and full
VN narration require a separate end-to-end check in Firefox.

TTS routing and native-helper regression tests:

```powershell
npx vitest run tests/tts_remote.test.ts tests/tts_relay.test.ts tests/tts_firefox_helper.test.ts
```

These tests check message transport and engine lifecycle. Live narration still requires
a browser check. The standalone benchmark and threading-probe tools have been removed.
