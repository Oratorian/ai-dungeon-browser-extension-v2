import { mount, unmount } from "svelte";
import { Config } from "@/shared/config";
import Response from "@/ui/components/response.svelte";
import { ResponseType } from "@/shared/types";

export class DOM {
  private static mountedComponents = new Map<HTMLElement, ReturnType<typeof mount>>();

  static injectButton() {
    if (document.getElementById(Config.ID_EDITOR_BUTTON)) return;
    const baseButton = document.querySelector(Config.SELECTOR_EXIT_BUTTON);
    if (!baseButton) return;

    const button = baseButton.cloneNode(true) as HTMLElement;
    button.id = Config.ID_EDITOR_BUTTON;
    (button.querySelector("div > span") as HTMLElement).innerText = "w_wrench";
    (button.querySelector(":scope > span") as HTMLElement).innerText = "Editor";
    button.addEventListener("click", (e) => {
      extensionState.isEditorOpen = true;
    });
    baseButton.parentElement?.insertBefore(button, baseButton);
  }

  // Adds a "DExtV2R" quick-access button to AI Dungeon's input-mode menu (the Do/Say/Story/Guide/See
  // bar) so the editor is reachable without opening the top menu. That bar only exists while the menu
  // is open and AI Dungeon re-renders it constantly, so this runs on every mutation and is defensive:
  //  - it finds the mode buttons by their stable aria-label ("Set to '<mode>' mode"), not by AID's
  //    atomic classes, which churn;
  //  - when the menu is closed (no mode buttons) it removes our button, so it never lingers as an
  //    orphan in a half-rendered bar;
  //  - it clones a live mode button and swaps the icon glyph + label, both detected structure-
  //    agnostically (the icon is a "w_*" font ligature, the label is the other text leaf), so it
  //    survives AID moving things around;
  //  - it copies the icon/label color from the live button, so it matches instead of freezing the
  //    state the clone happened to capture (AID paints these by state via JS).
  static injectActionEditorButton() {
    const modeButtons = Array.from(document.querySelectorAll<HTMLElement>(Config.SELECTOR_MODE_BUTTON));
    const existing = document.getElementById(Config.ID_ACTION_EDITOR_BUTTON);

    // Menu closed: the mode buttons are gone, so drop ours instead of leaving it floating.
    if (modeButtons.length === 0) {
      existing?.remove();
      return;
    }

    const reference = modeButtons[modeButtons.length - 1];
    const row = reference.parentElement;
    if (!row) return;

    // Already present: just make sure AID's re-render didn't detach or reorder it away from the end.
    if (existing) {
      if (existing.parentElement !== row || existing.nextElementSibling) row.appendChild(existing);
      return;
    }

    const button = reference.cloneNode(true) as HTMLElement;
    button.id = Config.ID_ACTION_EDITOR_BUTTON;
    button.setAttribute("aria-label", "Open Dungeon Extension editor");

    // Swap the cloned button's glyph + label by editing its text leaves (not the container), so AID's
    // internal structure/classes stay intact. The icon leaf is a "w_*" ligature; the label is the rest.
    for (const leaf of this.textLeaves(button)) {
      const text = (leaf.textContent ?? "").trim();
      leaf.textContent = this.isIconGlyph(text) ? "w_wrench" : "DExtV2R";
    }
    this.matchButtonColor(button, reference);

    // Stop the click from reaching AI Dungeon's delegated handlers (which would switch input mode).
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      extensionState.isEditorOpen = true;
    });

    row.appendChild(button);
  }

  // Text-bearing leaf elements (no element children) of a button: its icon glyph and its label.
  private static textLeaves(el: HTMLElement): HTMLElement[] {
    return Array.from(el.querySelectorAll<HTMLElement>("*")).filter(
      (n) => n.childElementCount === 0 && (n.textContent ?? "").trim().length > 0
    );
  }

  // AI Dungeon renders icons as "w_*" font ligatures (e.g. "w_run", "w_wrench").
  private static isIconGlyph(text: string): boolean {
    return /^w_[\w-]+$/.test(text.trim());
  }

  // Copy the live icon/label color from a reference mode button onto our clone, matching icon-leaf to
  // icon-leaf and label-leaf to label-leaf. AID paints icon glyphs with -webkit-text-fill-color (which
  // overrides plain `color`, and Firefox honors it too), so we set both to be safe.
  private static matchButtonColor(button: HTMLElement, reference: HTMLElement) {
    const refLeaves = this.textLeaves(reference);
    const refIcon = refLeaves.find((n) => this.isIconGlyph(n.textContent ?? ""));
    const refLabel = refLeaves.find((n) => n !== refIcon);
    for (const leaf of this.textLeaves(button)) {
      const src = this.isIconGlyph(leaf.textContent ?? "") ? refIcon : refLabel;
      if (!src) continue;
      const s = getComputedStyle(src);
      leaf.style.setProperty("color", s.color, "important");
      leaf.style.setProperty("-webkit-text-fill-color", s.webkitTextFillColor || s.color, "important");
    }
  }

  // AI Dungeon doesn't keep the response text in a fixed position: story paragraphs and the last
  // action hold it in the first child, but a player action now leads with an empty spacer <span>
  // and pushes the real text into a later sibling, past layout spacers and an icon glyph. Return the
  // child that actually carries the prose so our render/highlight lands on the right node instead of
  // assuming child-zero. Falls back to the first child so we never mount on nothing.
  private static pickTextHost(container: HTMLElement): HTMLElement | null {
    const first = container.firstElementChild as HTMLElement | null;
    // Common case (story text, last action): the first child already holds the text.
    if (first?.textContent?.trim()) return first;

    // Player-action shape: skip the empty leading span and zero-size layout spacers (no text), and
    // the single icon ligature (AID renders icons as "w_*" tokens, e.g. "w_run"), then take the
    // child with the most prose.
    let best: HTMLElement | null = null;
    let bestLen = 0;
    for (const child of Array.from(container.children) as HTMLElement[]) {
      const text = (child.textContent ?? "").trim();
      if (!text || /^w_[\w-]+$/.test(text)) continue;
      if (text.length > bestLen) {
        best = child;
        bestLen = text.length;
      }
    }
    return best ?? first;
  }

  static mountResponseOn(element: HTMLElement, type: ResponseType) {
    // Check if the elemnt is already altered.
    if (element.hasAttribute(Config.ATTRIBUTE_ALTERED)) return;

    // Handling for the last actions:
    if (type === ResponseType.LastAction) {
      // Usually the first child, but pick the real text host in case AID buries it (see pickTextHost).
      const original = this.pickTextHost(element);

      if (original) {
        if (original.querySelector(".word-fade")) {
          console.warn(
            "[Dungeon Extension v2 Resurrected] Detected text animation... skipping for now... this might cause issues in the future.\n\nTo disable text animations navigate to: Gameplay > Appearance > Accessibility > Text Animation"
          );
          return;
        }

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
      const original = this.pickTextHost(element);
      if (original) {
        // Render into a shallow clone of the text host (same tag + classes) placed where it sits,
        // then hide the original. AID sometimes carries the font size/family/color on the text node
        // itself (player actions) rather than the row container, so mounting into the bare container
        // would drop that styling and shrink the text. Cloning the host preserves its text context.
        const rawHtml = original.innerHTML;
        const host = original.cloneNode(false) as HTMLElement;
        original.style.display = "none";
        original.insertAdjacentElement("beforebegin", host);
        const component = mount(Response, {
          target: host,
          props: { rawHtml, type: type },
        });
        this.mountedComponents.set(element, component);
      }
    }

    element.setAttribute(Config.ATTRIBUTE_ALTERED, "true");
  }

  static prettifyButBetter(gameplayOutput: HTMLElement) {
    // AI Dungeon keeps restructuring the gameplay DOM (extra wrapper divs, per-section wrappers,
    // moved aria-labels...), so we no longer rely on a fixed parent/sibling shape. Every piece of
    // renderable text (story paragraphs, the last action, and player actions) lives in a
    // "span#transition-opacity" element that has an element first child holding the actual text.
    // We simply find all of them anywhere under #gameplay-output and mount on each. mountResponseOn
    // is idempotent (guarded by ATTRIBUTE_ALTERED), so re-running on every mutation is safe and cheap.

    // AI Dungeon virtualizes the story list: older sections get removed from the DOM as you scroll.
    // Drop any component whose element is no longer connected before mounting the current ones.
    this.pruneDetached();

    const containers = gameplayOutput.querySelectorAll<HTMLElement>(Config.SELECTOR_RESPONSE);

    containers.forEach((container) => {
      // Must have an element first child; that inner span is what mountResponseOn hides & renders.
      if (!container.firstElementChild) return;

      const ariaLabel = container.getAttribute("aria-label") ?? "";

      // The newest response is the "Last action:" one. It needs the LastAction type so the <Focus>
      // component renders above it. Everything else (older story paragraphs and player actions)
      // uses the Action type, which is the same non-destructive clone-and-hide mount path.
      const type = ariaLabel.startsWith("Last action:") ? ResponseType.LastAction : ResponseType.Action;

      this.mountResponseOn(container, type);
    });
  }

  // Unmounts and drops any tracked component whose element has been detached from the document
  // (e.g. AI Dungeon virtualized away an old story section). Prevents a session-long memory leak
  // of detached DOM nodes and their Svelte components.
  static pruneDetached() {
    for (const [element, component] of this.mountedComponents.entries()) {
      if (element.isConnected) continue;
      unmount(component);
      // Clear the altered marker so this node is re-mounted cleanly if it ever reconnects.
      element.removeAttribute(Config.ATTRIBUTE_ALTERED);
      this.mountedComponents.delete(element);
    }
  }

  static cleanup() {
    for (const [element, component] of this.mountedComponents.entries()) {
      unmount(component);
    }
    this.mountedComponents.clear();
  }
}
