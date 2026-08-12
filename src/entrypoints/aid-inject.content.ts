// Injects the page-world interceptor (src/entrypoints/interceptor.ts) as early as possible, so it
// patches fetch/WebSocket before AI Dungeon's app makes its first GraphQL calls. This runs in the
// isolated world at document_start; all interception happens in the injected MAIN-world script.
//
// We inject a <script> tag (rather than relying on a manifest `world: "MAIN"` content script)
// because the Firefox build is MV2, where that flag is not supported. Script-tag injection works
// the same on Chrome MV3 and Firefox MV2, and AI Dungeon sends no CSP so nothing blocks it.
export default defineContentScript({
  matches: ["https://play.aidungeon.com/*", "https://beta.aidungeon.com/*", "https://alpha.aidungeon.com/*"],
  runAt: "document_start",
  main() {
    try {
      const el = document.createElement("script");
      // interceptor.js is a generated unlisted script, not a static public/ asset, so it isn't in
      // WXT's PublicPath union; the runtime URL resolves fine.
      el.src = browser.runtime.getURL("/interceptor.js" as any);
      el.onload = () => el.remove();
      (document.head || document.documentElement).appendChild(el);
    } catch {
      /* a failed inject just means no passive import; the rest of the extension is unaffected */
    }
  },
});
