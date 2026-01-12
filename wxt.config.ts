import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-svelte"],
  manifest: {
    name: "Dungeon Extension v2",
    description: "Enhance AI Dungeon with visuals, audio effects, and text formatting",
    permissions: ["storage", "unlimitedStorage"],
    version: "1.0.1",
    web_accessible_resources: [
      {
        resources: ["fonts/*"],
        matches: ["https://play.aidungeon.com/*", "https://beta.aidungeon.com/*", "https://alpha.aidungeon.com/*"],
      },
    ],
    browser_specific_settings: {
      gecko: {
        id: "dungeon-extension-v2@clauds-clauds",
        // @ts-expect-error
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
