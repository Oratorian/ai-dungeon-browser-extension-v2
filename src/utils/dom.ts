import { mount, unmount } from "svelte";
import { Config } from "./config";
import Response from "@/components/response.svelte";
import { Debug } from "./debug";
import { ResponseType } from "./types";

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

  static mountResponseOn(element: HTMLElement, type: ResponseType) {
    // Check if the elemnt is already altered.
    if (element.hasAttribute(Config.ATTRIBUTE_ALTERED)) return;

    // Handling for the last actions:
    if (type === ResponseType.LastAction) {
      // The last action always has a span inside it with the actual text.
      const original = element.firstElementChild as HTMLElement;

      if (original) {
        // Clone the original first before hiding it.
        const originalClone = original.cloneNode(true) as HTMLElement;
        original.style.display = "none";

        // Then we can mount our Svelte component.
        const component = mount(Response, {
          target: element,
          anchor: original,
          props: { rawHtml: originalClone.innerHTML, type: type },
        });

        this.mountedComponents.set(element, component);
      }
    }

    // Story response types are very tricky. You can't simply hide the first child elements because they do not have any. They're just spans with text inside.
    if (type === ResponseType.Story) {
      const originalHtml = element.innerHTML; // Grab the inner HTML directly.
      element.innerHTML = ""; // Clear the old unstyled stuff.
      const component = mount(Response, {
        target: element,
        props: { rawHtml: originalHtml, type: type },
      });
      this.mountedComponents.set(element, component);
    }

    if (type === ResponseType.Action) {
      const original = element.firstElementChild as HTMLElement;
      if (original) {
        // Clone the original first before hiding it.
        const originalClone = original.cloneNode(true) as HTMLElement;
        original.style.display = "none";
        const component = mount(Response, {
          target: element,
          anchor: original,
          props: { rawHtml: originalClone.innerHTML, type: type },
        });
        this.mountedComponents.set(element, component);
      }
    }

    element.setAttribute(Config.ATTRIBUTE_ALTERED, "true");
  }

  static isStoryContainer(element: HTMLElement): boolean {
    return element instanceof HTMLSpanElement && element.getAttribute("aria-label")?.startsWith("Story section:") === true;
  }

  static isAction(element: HTMLElement): boolean {
    if (element.id !== "transition-opacity") return false;
    const childSpan = element.querySelector("span[aria-label]") as HTMLElement;
    return childSpan?.getAttribute("aria-label")?.startsWith("Action") === true;
  }

  static prettifyButBetter(gameplayOutput: HTMLElement) {
    // Grab the last child element, which is like often the most recent response.
    const lastChild = gameplayOutput.lastElementChild;

    // Return if there is no last child.
    if (!lastChild) return;

    // Okay, so I am gonna put some detailed comments here because my mind hurts with every AI Dungeon site update. Apparently there are now 3 distinct types of children, you either have the "Story Sections", "Actions", and sometimes the "Last Action" is outside of those two and other times it's inside a "Story Section". Really fun stuff.

    // The "Story Section" are spans with an aria-label that starts with "Story section:", they contain multiple paragraphs and possibly the last action.
    if (lastChild instanceof HTMLSpanElement && lastChild.getAttribute("aria-label")?.startsWith("Story section:")) {
      Debug.log("Last child is a story section!");

      // Now, sometimes the last action is inside this story section, so we need to find it.
      const lastAction = lastChild.querySelector(Config.SELECTOR_LAST_ACTION) as HTMLElement;
      if (lastAction) this.mountResponseOn(lastAction, ResponseType.LastAction);

      // Besides last actions you also have previous story containers, which are spans inside the same section but they do not have a span child or any aria-label. Their ID is also: transition-opacity.
      const storyContainers = lastChild.querySelectorAll("span#transition-opacity:not([aria-label]):not(:has(span))");

      // Also paint those extra story containers.
      storyContainers.forEach((container) => {
        this.mountResponseOn(container as HTMLElement, ResponseType.Story);
      });

      // For the other rules, let's just paint the action before this story section if it exists.
      const previousSibling = lastChild?.previousElementSibling as HTMLElement;
      if (previousSibling) {
        Debug.log("The previous sibling is: " + previousSibling.outerHTML);

        // Paint the previous action, if there is one.
        if (this.isAction(previousSibling)) {
          // If it is an action then there is a third span with an aria-label starting with "Action".
          const actionSpan = previousSibling.querySelector('span[aria-label^="Action"]') as HTMLElement;

          if (actionSpan) this.mountResponseOn(actionSpan, ResponseType.Action);
        }
      }

      // Now also check the second last child, in case there is another story section before this one.
      const secondLastChild = previousSibling.previousElementSibling as HTMLElement;
      if (secondLastChild && this.isStoryContainer(secondLastChild)) {
        Debug.log("Second last child is also a story section!");
        const storyContainers = secondLastChild.querySelectorAll("span#transition-opacity:not([aria-label]):not(:has(span))");

        // Also paint those extra story containers.
        storyContainers.forEach((container) => {
          this.mountResponseOn(container as HTMLElement, ResponseType.Story);
        });
      }
    }

    // Debug.log("Last Child HTML: " + lastChild.outerHTML);
  }

  static cleanup() {
    for (const [element, component] of this.mountedComponents.entries()) {
      unmount(component);
    }
    this.mountedComponents.clear();
  }
}
