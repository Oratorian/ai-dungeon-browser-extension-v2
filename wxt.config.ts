import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-svelte"],
  manifest: {
    name: "Dungeon Extension v2 Resurrected",
    description: "Enhance AI Dungeon with visuals, audio effects, and text formatting",
    permissions: ["storage", "unlimitedStorage"],
    // Named hosts for the optional remote-media / remote-import features:
    //  - trinetra.mahesvara.cloud: story-card images (API + downloads)
    //  - pixabay.com: resolve a sound-effect page URL to its direct audio link (JSON-LD)
    //  - cdn.pixabay.com: stream the royalty-free ambient audio
    //  - api.github.com: list the .json files in a configured scenario repo (git tree)
    //  - raw.githubusercontent.com: fetch a scenario/adventure file's contents (and its name head)
    // Declared here (not requested at runtime) because the UI runs in a content script, where
    // Firefox does not allow permissions.request().
    host_permissions: [
      "https://trinetra.mahesvara.cloud/*",
      "https://pixabay.com/*",
      "https://cdn.pixabay.com/*",
      "https://api.github.com/*",
      "https://raw.githubusercontent.com/*",
    ],
    version: "1.2.0",
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
