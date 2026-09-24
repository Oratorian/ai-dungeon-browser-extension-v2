import { Debug } from "#imports";
import appStyle from "@/app.css?inline";
import contentStyle from "@/content.css?inline";
import Editor from "@/ui/routes/editor.svelte";
import { Events } from "@/shared/events";
import { connectAidBridge } from "@/aid/bridge";
import { autoSelectPlayedAdventure } from "@/aid/adventure";
import { mount, unmount } from "svelte";
import { installErrorCapture } from "@/shared/errors";
import { matchesHotkey } from "@/shared/hotkey";
import { Storage } from "@/storage";
import { get } from "svelte/store";

export default defineContentScript({
  matches: ["https://play.aidungeon.com/*", "https://beta.aidungeon.com/*", "https://alpha.aidungeon.com/*"],
  cssInjectionMode: "ui",
  async main(ctx) {
    // Capture our own uncaught errors from the very start, so the diagnostics report can show
    // what broke even when the failure happens long before anyone opens the editor.
    installErrorCapture();

    // Listen for story cards the page-world interceptor detects, and ask for any already captured.
    connectAidBridge();

    // Inject content styles omitting the base overrides stuff.
    const style = document.createElement("style");
    style.textContent = contentStyle;
    style.id = "de-content";
    document.head.appendChild(style);

    // Do the startup events (loads storage).
    await Events.onStart();

    // Follow the played adventure: auto-select its imported card set as the URL changes (AI Dungeon
    // routes client-side, so poll). Must run after Events.onStart() so storage is loaded first;
    // ctx.setInterval is cleared automatically if the context dies.
    autoSelectPlayedAdventure();
    ctx.setInterval(autoSelectPlayedAdventure, 1000);

    Debug.log("Creating shadow root UI...");
    const ui = await createShadowRootUi(ctx, {
      name: "de-editor-anchor",
      position: "inline",
      anchor: "body",
      css: appStyle,

      onMount(uiContainer) {
        // Inject custom fonts in to the shadow root.
        const plexFont = browser.runtime.getURL("/fonts/plex_sans.ttf");
        const symbolFont = browser.runtime.getURL("/fonts/material_symbols.ttf");
        const fontStyle = document.createElement("style");
        fontStyle.textContent = `
          @font-face {
            font-family: 'Material Symbols';
            src: url('${symbolFont}') format('truetype');
            font-variation-settings: "FILL" 1;
          }
    
          @font-face {
            font-family: 'IBM Plex Sans';
            src: url('${plexFont}') format('truetype');
          }
        `;
        document.head.appendChild(fontStyle);

        // Mount Svelte stuff.
        const app = mount(Editor, { target: uiContainer });
        return app;
      },
      onRemove: (app) => {
        if (app) unmount(app);
      },
    });
    ui.mount();
    Debug.log("Shadow root UI mounted!");

    // The keyboard shortcut is delivered to the background and relayed here (see background.ts).
    browser.runtime.onMessage.addListener((message: unknown) => {
      if ((message as { type?: string } | null)?.type === "de-open-editor") extensionState.isEditorOpen = true;
    });

    // The floating button's show/hide shortcut is our own, matched here on the page rather than
    // through the browser's commands API, so it is set inside the extension's Settings and works
    // for a temporary add-on too. Capture phase, so AI Dungeon's own handlers do not see it first.
    // Skip events inside the editor so Settings can record the same combination without
    // toggling the button. VN and the floating controls share its shadow root, but must
    // still allow the toggle shortcut while playing.
    ctx.addEventListener(
      window,
      "keydown",
      (e: KeyboardEvent) => {
        if (e.repeat) return;
        if (extensionState.isEditorOpen && e.composedPath().some((n) => (n as Element).tagName?.toLowerCase() === "de-editor-anchor")) return;
        const hotkey = get(Storage.settings).floatingButtonHotkey;
        if (!matchesHotkey(e, hotkey)) return;
        e.preventDefault();
        e.stopPropagation();
        Storage.settings.update((s) => ({ ...s, floatingButton: !s.floatingButton }));
      },
      { capture: true }
    );
  },
});
