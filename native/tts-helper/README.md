# Dungeon Extension Firefox TTS Helper

Windows x64 package. No Node, .NET installation, administrator account, or source
checkout is needed to use the built package.

1. Extract the entire ZIP to a folder.
2. Double-click **Install.cmd**. It copies the helper into your local application
   data folder and registers it for your Windows account in Firefox.
3. Reload the matching extension version, refresh AI Dungeon, and enable
   **Accelerated TTS**. The extension starts the helper automatically.

The engine still runs in a Firefox tab grouped with the story. Closing the story
or its engine disconnects that reader. After the last reader closes, the extension
disconnects the native helper and its local server stops. Turning TTS off also
releases it. Merely exiting or minimizing VN retains the initialized reader for
re-entry, as before. Closing Firefox stops the helper too.

The helper serves only its bundled engine files at `http://localhost:4177` with
the isolation headers needed for WebAssembly threads. Narration and models stay
in Firefox; model downloads still use the extension's background helper. It is
not a Windows service, does not run at sign-in, and installs no scheduled task.

If port 4177 is busy, stop the old manually started Node server or the other
Firefox profile's helper and retry. This release supports one helper server per
computer at a time. Chrome does not need this helper. Without the helper,
Firefox's single-thread narration still works with acceleration off.

To uninstall, turn TTS off/close its tabs and double-click **Uninstall.cmd** from
the extracted package. This removes the per-user registration and helper files,
including old installed versions, but leaves browser model caches alone.

Updates: extract a new package and run Install.cmd again. Content-versioned install
folders let an existing helper finish without being overwritten. Turn TTS off/on
to launch the new installation. The installed helper and extension must use the
same native protocol and compatible engine assets. This initial build is unsigned.

For maintainers: run `powershell -NoProfile -File scripts/build-tts-helper.ps1`
from the repository after `npm ci`, with a .NET SDK supporting .NET 8 installed.
The ZIP is written to `.output/DungeonExtension-TTS-Helper-windows-x64.zip`.
Firefox allows the stable ID `dungeon-extension-v2@oratorian` and the beta ID
`dungeon-extension-betas@oratorian`. Run Install.cmd from the updated package to
enable beta access if you installed an earlier helper.

Build the Firefox beta extension with `npm run build:firefox:beta`. Its Manifest V2
output is `.output/firefox-mv2-beta`, named `Dungeon Extension-beta`, so it can be
installed separately from the stable extension.
