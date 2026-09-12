import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-svelte"],
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
    name: "Dungeon Extension v2 Resurrected",
    description: "Enhance AI Dungeon with visuals, audio effects, and text formatting",
    permissions: ["storage", "unlimitedStorage"],
    // Keyboard shortcut to open the editor. The browser delivers it to the background, which
    // relays it to the active tab (see background.ts and content.ts). Users can rebind it in
    // the browser's extension shortcut settings.
    commands: {
      "open-editor": {
        suggested_key: { default: "Alt+Shift+D" },
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
        resources: ["fonts/*", "interceptor.js"],
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
    plugins: [tailwindcss()],
  }),
});
