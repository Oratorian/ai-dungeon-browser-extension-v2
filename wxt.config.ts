import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-svelte"],
  // Output zips as DExtV2-Resurrect-<browser>-<version>.zip (e.g. DExtV2-Resurrect-chrome-1.2.0.zip).
  zip: {
    artifactTemplate: "DExtV2-Resurrect-{{browser}}-{{version}}.zip",
    sourcesTemplate: "DExtV2-Resurrect-{{version}}-sources.zip",
  },
  manifest: {
    name: "Dungeon Extension v2 Resurrected",
    description: "Enhance AI Dungeon with visuals, audio effects, and text formatting",
    permissions: ["storage", "unlimitedStorage"],
    // Named hosts for the optional remote-media / remote-import features:
    //  - trinetra.mahesvara.cloud: story-card images (API + downloads)
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
      "https://pixabay.com/*",
      "https://cdn.pixabay.com/*",
      "https://api.github.com/*",
      "https://raw.githubusercontent.com/*",
      "https://github.com/*/releases/download/*",
      "https://release-assets.githubusercontent.com/*",
    ],
    version: "1.2.2",
    web_accessible_resources: [
      {
        resources: ["fonts/*"],
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
