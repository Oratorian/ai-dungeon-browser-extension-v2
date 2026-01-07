import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-svelte"],
  manifest: {
    name: "Dungeon Extension v2",
    description: "Enhance AI Dungeon with visuals, audio effects, and text formatting",
    permissions: ["storage", "unlimitedStorage"],
    version: "1.0.0",
    web_accessible_resources: [
      {
        resources: ["fonts/*"],
        matches: ["https://play.aidungeon.com/*", "https://beta.aidungeon.com/*", "https://alpha.aidungeon.com/*"],
      },
    ],
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
