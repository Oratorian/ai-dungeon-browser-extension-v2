import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-svelte"],
  hooks: {
    "build:publicAssets"(_wxt, files) {
      for (const name of ["ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.mjs"]) {
        files.push({ absoluteSrc: resolve("node_modules/onnxruntime-web/dist", name), relativeDest: `runtime/${name}` });
      }
    },
  },
  // Auto-import project symbols (Storage, Config, Debug, DOM, Events, extensionState, ...) from the
  // domain folders. WXT auto-imports from "utils" by default; we moved that code into these folders.
  imports: {
    dirs: ["aid", "storage", "media", "audio", "rendering", "shared"],
  },
  // Output zips as DExtV2-Resurrect-<browser>-<version>.zip (e.g. DExtV2-Resurrect-chrome-1.2.0.zip).
  zip: {
    artifactTemplate: "DExtV2-Resurrect-{{browser}}-{{version}}.zip",
    sourcesTemplate: "DExtV2-Resurrect-{{version}}-sources.zip",
  },
  manifest: {
    content_security_policy: { extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'" },
    cross_origin_embedder_policy: { value: "require-corp" },
    cross_origin_opener_policy: { value: "same-origin" },
    name: "Dungeon Extension v2 Resurrected",
    description: "Enhance AI Dungeon with visuals, audio effects, and text formatting",
    permissions: ["storage", "unlimitedStorage"],
    // Keyboard shortcut to open the editor. The browser delivers it to the background, which
    // relays it to the active tab (see background.ts and content.ts). Users can rebind it in
    // the browser's extension shortcut settings.
    //
    // Ctrl+Shift+L because it is unassigned in Firefox and Chrome on every platform. Nothing more
    // than that: the first choice, Alt+Shift+D, was thought to conflict with something in Firefox
    // when it registered but did not fire in a temporary-add-on session, yet binding the identical
    // combo by hand in "Manage Extension Shortcuts" made it work, so the combo was never at fault.
    // A shortcut loaded through about:debugging can apparently show as registered without a live
    // listener until it is set by hand; a store install binds the default at install time. Test
    // shortcut changes with a real install, not a temporary one.
    commands: {
      "open-editor": {
        suggested_key: { default: "Ctrl+Shift+L" },
        description: "Open the Dungeon Extension editor",
      },
    },
    // Named hosts for the optional remote-media / remote-import features:
    //  - trinetra.mahesvara.cloud: story-card images (API + downloads + generated-image uploads)
    //  - openrouter.ai, civitai.com/api, orchestration(-new).civitai.com: optional image generation
    //    with the user's own key, called from the content script.
    //
    //    Those four were removed once, on the reasoning that each sends permissive CORS (they do,
    //    verified against the live responses) and that a content script's fetch obeys CORS whether
    //    or not a host permission exists. That held on Chrome and failed on Firefox: with the
    //    permissions gone, a plain GET to civitai.com/api from the content script rejected with a
    //    bare network error, while the same build worked on Chrome and the same call had worked on
    //    Firefox with the permissions present. AI Dungeon sends no CSP, so that is not it either.
    //    Whatever Firefox does differently for a content-script request with no matching host
    //    permission, the permission is what makes the request work there. Keep them.
    //  - pixabay.com: resolve a sound-effect page URL to its direct audio link (JSON-LD)
    //  - cdn.pixabay.com: stream the royalty-free ambient audio
    //  - api.github.com: list a scenario repo's .json files (git tree + latest release assets)
    //  - raw.githubusercontent.com: fetch a tree-hosted scenario/adventure file (and its name head)
    //  - github.com/.../releases/download + release-assets.githubusercontent.com: download an
    //    adventure attached to a GitHub release. That CDN sends no CORS headers, so the background
    //    script does the fetch (a content script would be blocked under Chrome MV3).
    // Declared here (not requested at runtime) because the UI runs in a content script, where
    // Firefox does not allow permissions.request().
    host_permissions: [
      "https://huggingface.co/*",
      "https://*.hf.co/*",
      "https://trinetra.mahesvara.cloud/*",
      "https://openrouter.ai/*",
      "https://civitai.com/api/*",
      "https://orchestration.civitai.com/*",
      "https://orchestration-new.civitai.com/*",
      "https://pixabay.com/*",
      "https://cdn.pixabay.com/*",
      "https://api.github.com/*",
      "https://raw.githubusercontent.com/*",
      "https://github.com/*/releases/download/*",
      "https://release-assets.githubusercontent.com/*",
    ],
    // version is intentionally omitted: WXT reads it from package.json, so `npm version <x>` bumps
    // the manifest and tags in one step (no manual edit here).
    web_accessible_resources: [
      {
        // interceptor.js is the page-world GraphQL tap, injected by aid-inject.content.ts.
        // icon/* is the extension icon, shown as the face of the floating button.
        resources: ["fonts/*", "icon/*", "interceptor.js", "tts.html"],
        matches: ["https://play.aidungeon.com/*", "https://beta.aidungeon.com/*", "https://alpha.aidungeon.com/*"],
      },
    ],
    browser_specific_settings: {
      gecko: {
        id: "dungeon-extension-v2@oratorian",
        data_collection_permissions: {
          required: ["none"],
        },
      },
    },
  },
  vite: () => ({
    resolve: { conditions: ["onnxruntime-web-use-extern-wasm"] },
    plugins: [tailwindcss()],
  }),
});
