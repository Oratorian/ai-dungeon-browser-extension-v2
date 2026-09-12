import { fakeBrowser } from "wxt/testing/fake-browser";
import { beforeEach } from "vitest";

// The storage layer talks to `chrome.storage.local`, not `browser.storage.local`. WxtVitest installs
// the fake under `browser`; expose the same object under `chrome` so both names hit one in-memory
// store, and reset it between tests so nothing leaks from one to the next.
(globalThis as any).chrome = fakeBrowser;

beforeEach(() => {
  fakeBrowser.reset();
});
