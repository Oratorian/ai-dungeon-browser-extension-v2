import { Debug } from "#imports";
import appCss from "@/app.css?inline";
import highlightCss from "@/content.css?inline";
import Editor from "@/routes/editor.svelte";
import { Events } from "@/utils/events";
import { mount, unmount } from "svelte";

export default defineContentScript({
  matches: ["*://*.play.aidungeon.com/*"],
  cssInjectionMode: "ui",
  async main(ctx) {
    const style = document.createElement("style");
    style.textContent = highlightCss;
    style.id = "de-content";
    document.head.appendChild(style);

    await Events.onStart();
    Debug.log("Creating shadow root UI...");
    const ui = await createShadowRootUi(ctx, {
      name: "de-editor-anchor",
      position: "inline",
      anchor: "body",
      css: appCss,

      onMount(uiContainer) {
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
