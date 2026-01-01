import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-svelte"],
  manifest: {
    name: "Dungeon Extension v2",
    permissions: ["storage", "unlimitedStorage"],
    version: "1.0.0",
    web_accessible_resources: [{ resources: ["fonts/*"], matches: ["*://*.play.aidungeon.com/*"] }],
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
