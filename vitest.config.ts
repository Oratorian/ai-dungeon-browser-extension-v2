import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing/vitest-plugin";

// Unit tests for the parts of the extension that are pure logic: the trigger parser, the image
// compressor's decisions, Civitai model resolution, storage persistence and the AI Dungeon card
// sync. None of these touch the page, so they run in Node without a browser.
//
// WxtVitest wires up the same path aliases and auto-imports the build uses, and installs
// @webext-core/fake-browser as the `browser` global, so the storage layer can be exercised
// against an in-memory chrome.storage rather than mocked by hand.
//
// Tests live in tests/, outside src/, because WXT scans the src/ auto-import directories for
// exports and there is no reason to have it read test files.
export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
  },
});
