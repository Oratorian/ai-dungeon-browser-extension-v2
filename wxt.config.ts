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
  manifest: ({ browser }) => ({
    name: "Dungeon Extension v2 Resurrected",
    description: "Enhance AI Dungeon with visuals, audio effects, and text formatting",
    permissions: ["storage", "unlimitedStorage"],
    // Named hosts for the optional remote-media / remote-import features:
    //  - trinetra.mahesvara.cloud: story-card images (API + downloads)
    //  - pixabay.com: resolve a sound-effect page URL to its direct audio link (JSON-LD)
    //  - cdn.pixabay.com: stream the royalty-free ambient audio
    //  - api.github.com: list a scenario repo's .json files (git tree + latest release assets)
    //  - raw.githubusercontent.com: fetch a scenario/adventure file's contents (and its name head)
    // Declared here (not requested at runtime) because the UI runs in a content script, where
    // Firefox does not allow permissions.request().
    host_permissions: [
      "https://trinetra.mahesvara.cloud/*",
      "https://pixabay.com/*",
      "https://cdn.pixabay.com/*",
      "https://api.github.com/*",
      "https://raw.githubusercontent.com/*",
      // Firefox only: importing an adventure attached to a GitHub release downloads it from these
      // hosts, which send no CORS headers, so it only works where the content script has
      // host-permission privilege (Firefox MV2), not in Chrome MV3. Omitted on Chrome so we don't
      // request a permission the build can't use.
      ...(browser === "firefox"
        ? ["https://github.com/*/releases/download/*", "https://release-assets.githubusercontent.com/*"]
        : []),
    ],
    version: "1.2.1",
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
  }),
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
