import { Config } from "./config";
import { Debug } from "./debug";
import { DOM } from "./dom";
import { Storage } from "./storage";

export class Events {
  private static _observer: MutationObserver;

  static async onStart() {
    Debug.log("Loading storage...");
    await Storage.load();
    Storage.listen();
    Debug.log("Storage loaded!");

    Storage.selectedAdventureId.subscribe((adventureId) => {
      extensionState.focusCardId = null;
    });

    Debug.log("Creating observers...");
    this._observer = new MutationObserver((mutations) => {
      this.onMutate(mutations);
    });
    Debug.log("Observers created!");

    Debug.log("Starting observer...");
    this._observer.observe(document.body, { childList: true, subtree: true });
    Debug.log("Observer started!");
  }

  static onMutate(mutations: MutationRecord[]) {
    if (!Debug.getAdventureId() || Debug.getAdventureId() === "") {
      this.onInvalidate();
      return;
    }

    DOM.injectButton();

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;

        const responses =
          node.id === Config.ID_RESPONSE
            ? [node]
            : (Array.from(node.querySelectorAll(Config.SELECTOR_RESPONSE)) as HTMLElement[]);

        if (responses.length > 0) DOM.prettify(responses);
      }
    }
  }

  static onInvalidate() {
    AudioManager.stop();
    focusAudioState.reset();
    extensionState.focusCardId = null;
    DOM.cleanup();
  }
}
