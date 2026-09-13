import { Config } from "@/shared/config";
import { Debug } from "@/shared/debug";
import { DOM } from "@/rendering/dom";
import { Storage } from "@/storage";
import { recordError } from "@/shared/errors";

export class Events {
  private static _observer: MutationObserver;
  private static _gameplayOutput: HTMLElement | null = null;

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
      // A throw in here is invisible: MutationObserver swallows it and keeps firing, so the
      // extension renders nothing while the page looks perfectly normal. Record it instead, so the
      // diagnostics report can show what actually broke.
      try {
        this.onMutate(mutations);
      } catch (error) {
        recordError(error, "observer");
      }
    });
    Debug.log("Observers created!");

    Debug.log("Starting observer...");
    this._observer.observe(document.body, { childList: true, subtree: true });
    Debug.log("Observer started!");
  }

  static onMutate(mutations: MutationRecord[]) {
    if (Debug.getAdventureId() === "") {
      this.onInvalidate();
      return;
    }

    if (this._gameplayOutput) {
      DOM.prettifyButBetter(this._gameplayOutput);
      return;
    }

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          if (node.matches(Config.SELECTOR_OUTPUT)) {
            this._gameplayOutput = node;
            Debug.log("Gameplay output found!");
            break;
          }

          const foundElement = node.querySelector(Config.SELECTOR_OUTPUT);
          if (foundElement instanceof HTMLElement) {
            this._gameplayOutput = foundElement;
            Debug.log("Gameplay output found!");
            break;
          }
        }
      }
    }

    /*
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;

        const responses =
          node.id === Config.ID_RESPONSE
            ? [node]
            : (Array.from(node.querySelectorAll(Config.SELECTOR_RESPONSE)) as HTMLElement[]);

        if (responses.length > 0) DOM.prettify(responses);
      }
    }*/
  }

  static onInvalidate() {
    this._gameplayOutput = null;
    AudioManager.stop();
    focusAudioState.reset();
    extensionState.focusCardId = null;
    DOM.cleanup();
  }
}
