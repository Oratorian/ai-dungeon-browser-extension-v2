import { isLynxCat, lynxRunId } from "@/services/site";
import { followLynxStory, disconnectLynx } from "@/services/lynxcat";
import { createLynxRenderer } from "@/rendering/lynxcat";
import { Debug } from "#imports";
import appStyle from "@/app.css?inline";
import contentStyle from "@/content.css?inline";
import Editor from "@/ui/routes/editor.svelte";
import { Events } from "@/shared/events";
import { connectAidBridge } from "@/aid/bridge";
import { autoSelectPlayedAdventure, playedAdventureId } from "@/aid/adventure";
import { mount, unmount } from "svelte";
import { installErrorCapture } from "@/shared/errors";
import { matchesHotkey } from "@/shared/hotkey";
import { Storage } from "@/storage";
import { get } from "svelte/store";
import { storyPortraits } from "@/rendering/story_portraits";
import { withCardPortrait } from "@/shared/card_images";
import { startVnCardSession, syncVnCard } from "@/aid/vn_card_sync";

export default defineContentScript({
  matches: ["https://play.aidungeon.com/*", "https://beta.aidungeon.com/*", "https://alpha.aidungeon.com/*", "https://lynxcatai.com/*"],
  cssInjectionMode: "ui",
  async main(ctx) {
    // Capture our own uncaught errors from the very start, so the diagnostics report can show
    // what broke even when the failure happens long before anyone opens the editor.
    installErrorCapture();

    // Listen for story cards the page-world interceptor detects, and ask for any already captured.
    if (!isLynxCat()) connectAidBridge();

    // AI Dungeon's response components render into the page and need these styles.
    // LynxCat's native mentions use scoped decorations; global Tailwind utilities
    // collide with the site's own classes. The floating UI has its own shadow CSS.
    if (!isLynxCat()) {
      const style = document.createElement("style");
      style.textContent = contentStyle;
      style.id = "de-content";
      document.head.appendChild(style);
      ctx.onInvalidated(() => style.remove());
    }

    // Do the startup events (loads storage).
    if (isLynxCat()) {
      await Storage.load();
      Storage.listen();
      startVnCardSession();
      ctx.setInterval(syncVnCard, 2000);
      const stopVnStyleSync = Storage.settings.subscribe(() => syncVnCard());
      ctx.onInvalidated(stopVnStyleSync);
      followLynxStory();
      ctx.setInterval(followLynxStory, 1000);
      ctx.onInvalidated(disconnectLynx);
      let renderer: ReturnType<typeof createLynxRenderer> | undefined;
      let pending: ReturnType<typeof setTimeout> | undefined;
      const observe = () => observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["src", "data-entity-id", "class"] });
      const schedule = () => {
        if (pending !== undefined) return;
        pending = setTimeout(() => {
          pending = undefined;
          observer.disconnect();
          try {
            if (lynxRunId(location.pathname)) {
              renderer ??= createLynxRenderer(document, id => { extensionState.focusCardId = id; });
              const pictures = get(storyPortraits);
              renderer.render(Object.values(Storage.getSelectedAdventure()?.storyCards ?? {})
                .map(card => withCardPortrait(card, pictures[card.id])), get(Storage.settings));
            } else {
              renderer?.destroy();
              renderer = undefined;
            }
          }
          finally { observe(); }
        }, 80);
      };
      const observer = new MutationObserver(records => {
        if (records.some(r => (r.target as Element).closest?.('[aria-label="Story transcript"]') || [...r.addedNodes, ...r.removedNodes].some(n => n instanceof Element && (n.matches('[aria-label="Story transcript"]') || n.querySelector('[aria-label="Story transcript"]'))))) schedule();
      });
      const unsubscribe = [Storage.adventures.subscribe(schedule), Storage.selectedAdventureId.subscribe(() => { extensionState.focusCardId = null; schedule(); }), Storage.settings.subscribe(schedule), storyPortraits.subscribe(schedule), playedAdventureId.subscribe(schedule)];
      observe();
      ctx.onInvalidated(() => { observer.disconnect(); clearTimeout(pending); unsubscribe.forEach(stop => stop()); renderer?.destroy(); });
    } else {
      await Events.onStart();
      startVnCardSession();
      ctx.setInterval(syncVnCard, 2000);
      const stopVnCardSync = Storage.settings.subscribe(() => syncVnCard());
      ctx.onInvalidated(stopVnCardSync);

      // Follow the played adventure: auto-select its imported card set as the URL changes (AI Dungeon
      // routes client-side, so poll). Must run after Events.onStart() so storage is loaded first;
      // ctx.setInterval is cleared automatically if the context dies.
      autoSelectPlayedAdventure();
      ctx.setInterval(autoSelectPlayedAdventure, 1000);
    }

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
        extensionState.floatingButtonHidden = !extensionState.floatingButtonHidden;
      },
      { capture: true }
    );
  },
});
