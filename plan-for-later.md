# Android app, on hold

Status: Deferred at the user's request. Research only; implementation has not started.

## Idea

Offer a standalone Android app that loads AI Dungeon in an embedded WebView and
adds Dungeon Extension features, including a floating character panel driven by
story keywords. Players would launch this app to play AI Dungeon.

The initial idea was to read the screen and display characters over the official
AI Dungeon Android app. BetterDungeon provides another approach: host the AI
Dungeon website inside our own app and read the story text directly from the DOM.
The character panel would appear inside our app. An overlay over the separately
installed official app would be a different project.

## BetterDungeon reference

Inspected on 2026-09-21: `Oratorian/BetterDungeon`, branch `dev`, commit
`e3e03b9675b412ded1297060219d44cb0a5f3393`.

- `MainActivity.kt` loads `https://play.aidungeon.com` in a main WebView and hosts
  the settings popup in a second WebView.
- `InjectionEngine.kt` injects bundled JavaScript and CSS into AI Dungeon pages.
- `BetterDungeonBridge.kt` connects JavaScript to native storage and other Android
  functionality. A JavaScript compatibility layer adapts extension APIs.
- Gradle collects shared web assets and Android-specific adapters before building.
  `betterdungeon-runtime.json` defines the injection order and included assets.
- `build.ps1 android` runs Gradle tests and `assembleDebug`, then copies the APK
  into `dist/`. Release APKs require signing.

Sources at the inspected revision:

- [Android README](https://github.com/Oratorian/BetterDungeon/blob/e3e03b9675b412ded1297060219d44cb0a5f3393/android/README.md)
- [MainActivity](https://github.com/Oratorian/BetterDungeon/blob/e3e03b9675b412ded1297060219d44cb0a5f3393/android/app/src/main/java/com/computerk/betterdungeon/MainActivity.kt)
- [InjectionEngine](https://github.com/Oratorian/BetterDungeon/blob/e3e03b9675b412ded1297060219d44cb0a5f3393/android/app/src/main/java/com/computerk/betterdungeon/InjectionEngine.kt)
- [Native bridge](https://github.com/Oratorian/BetterDungeon/blob/e3e03b9675b412ded1297060219d44cb0a5f3393/android/app/src/main/java/com/computerk/betterdungeon/BetterDungeonBridge.kt)
- [Gradle asset packaging](https://github.com/Oratorian/BetterDungeon/blob/e3e03b9675b412ded1297060219d44cb0a5f3393/android/app/build.gradle.kts)
- [Build script](https://github.com/Oratorian/BetterDungeon/blob/e3e03b9675b412ded1297060219d44cb0a5f3393/build.ps1)

## Proposed work when resumed

1. Prototype a WebView app and verify AI Dungeon login, navigation and story access
   on a real Android device.
2. Add an Android entry point for our compiled JavaScript/CSS and adapt WXT's
   extension-specific startup. Preserve early injection for the AI Dungeon bridge.
3. Provide adapters for storage, runtime messaging, bundled asset URLs, network
   requests, and Android file import/export. Restrict native bridge access to
   intended content and review navigation handling.
4. Reuse keyword matching and card data to show character images in a movable,
   collapsible panel. Replace hover interactions with touch controls.
5. Port and verify the editor, audio, GitHub imports and updates, export version
   dialog, Trinetra picker, and optional image generation.
6. Add reproducible APK packaging and release signing once the prototype works.

## Questions and validation

- Decide whether a separate app is acceptable or an overlay over the official app
  is a firm requirement before starting implementation.
- Test login redirects, keyboard behavior, back navigation, file picking and
  downloads, audio playback, lifecycle restoration, and performance with large
  card sets.
- Decide how users transfer existing extension data into the Android app.
- Evaluate which shared modules can run unchanged; full feature compatibility
  has not been established.
- Review BetterDungeon's license and retain required notices if reusing its code.

No APK has been built or tested for this extension. Resume this work only when
the user asks to revisit the Android app.
