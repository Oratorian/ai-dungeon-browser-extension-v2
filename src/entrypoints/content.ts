import { Debug } from "#imports";
import appStyle from "@/app.css?inline";
import contentStyle from "@/content.css?inline";
import Editor from "@/routes/editor.svelte";
import { Events } from "@/utils/events";
import { mount, unmount } from "svelte";

export default defineContentScript({
  matches: ["https://play.aidungeon.com/*", "https://beta.aidungeon.com/*", "https://alpha.aidungeon.com/*"],
  cssInjectionMode: "ui",
  async main(ctx) {
    // Inject content styles omitting the base overrides stuff.
    const style = document.createElement("style");
    style.textContent = contentStyle;
    style.id = "de-content";
    document.head.appendChild(style);

    // Do the startup events.
    await Events.onStart();

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
  },
});
