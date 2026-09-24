# Dungeon Extension Firefox TTS Helper

Windows x64 package. No Node, .NET installation, administrator account, or source
checkout is needed to use the built package.

1. Download **DungeonExtension-TTS-Helper-Setup-windows-x64.exe**.
2. Run the setup wizard. It installs into your local application data folder and
   registers the helper for your Windows account in Firefox.
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

To uninstall, turn TTS off/close its tabs and remove **Dungeon Extension TTS Helper**
from Windows Settings > Apps > Installed apps. The uninstaller removes the files it
installed and its Firefox registration, but leaves browser model caches alone.

Updates: run the new setup executable. Content-versioned install
folders let an existing helper finish without being overwritten. Turn TTS off/on
to launch the new installation. The installed helper and extension must use the
same native protocol and compatible engine assets. This initial build is unsigned.

For maintainers: run `npm run build:tts-helper` after `npm ci`, with a .NET SDK
supporting .NET 8 and Inno Setup 6.7 or newer installed. Set `ISCC_PATH` to the
compiler executable if it is not on PATH or in the default Inno Setup 6 folder.
The installer is written to `.output/DungeonExtension-TTS-Helper-Setup-windows-x64.exe`.
To build only the executable and engine files for testing, run
`powershell -NoProfile -File scripts/build-tts-helper.ps1`.
These are staged in `.output/tts-helper/windows-x64`; distribute the setup executable.

The wizard uses a separate managed installation directory and takes over Firefox's
helper registration from an earlier script-based installation. Old script-installed
files are left untouched. Turn TTS off/on after upgrading. Use the setup wizard for
future updates; the legacy installation scripts are no longer distributed.

Installer regression check (uses a separate test registration and workspace folder):
`powershell -NoProfile -File scripts/check-tts-helper-installer.ps1 -IsccPath "path/to/ISCC.exe"`.

Firefox allows the stable ID `dungeon-extension-v2@oratorian` and the beta ID
`dungeon-extension-betas@oratorian`. Run the updated setup wizard to
enable beta access if you installed an earlier helper.

Build the Firefox beta extension with `npm run build:firefox:beta`. Its Manifest V2
output is `.output/firefox-mv2-beta`, named `Dungeon Extension-beta`, so it can be
installed separately from the stable extension.
