import { mount, unmount } from "svelte";
import { Config } from "./config";
import Response from "@/components/response.svelte";

export class DOM {
  private static mountedComponents = new Map<HTMLElement, ReturnType<typeof mount>>();

  static injectButton() {
    if (document.getElementById(Config.ID_EDITOR_BUTTON)) return;
    const baseButton = document.querySelector(Config.SELECTOR_EXIT_BUTTON);
    if (!baseButton) return;

    const button = baseButton.cloneNode(true) as HTMLElement;
    button.id = Config.ID_EDITOR_BUTTON;
    (button.querySelector("p") as HTMLElement).innerText = "w_wrench";
    (button.querySelector("span") as HTMLElement).innerText = "Editor";
    button.addEventListener("click", (e) => {
      extensionState.isEditorOpen = true;
    });
    baseButton.parentElement?.insertBefore(button, baseButton);
  }

  static prettify(responses: HTMLElement[]) {
    for (const response of responses) {
      if (response.hasAttribute(Config.ATTRIBUTE_ALTERED)) continue;
      const label = response.getAttribute("aria-label") || "";
      if (label && label.startsWith("Last action:")) {
        Debug.log("Response HTML: " + response.getHTML());

        const original = response.firstElementChild as HTMLElement;
        if (original) {
          Debug.log("Original Response HTML: " + original.innerHTML);
          original.style.display = "none";

          const existing = this.mountedComponents.get(response);
          if (existing) {
            unmount(existing);
            this.mountedComponents.delete(response);
          }

          const component = mount(Response, {
            target: response,
            anchor: response.firstChild ?? undefined,
            props: { rawHtml: original.innerHTML },
          });

          this.mountedComponents.set(response, component);
          response.setAttribute(Config.ATTRIBUTE_ALTERED, "true");
        }
      }
    }
  }

  static cleanup() {
    for (const [element, component] of this.mountedComponents.entries()) {
      unmount(component);
    }
    this.mountedComponents.clear();
  }
}
