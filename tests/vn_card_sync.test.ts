// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { get, writable } from "svelte/store";

vi.mock("@/storage", () => ({ settings: writable({ visualNovelMode: true, volume: 75 }) }));
vi.mock("@/aid/adventure", () => ({ playedShortId: () => "story" }));
vi.mock("@/aid/bridge", () => ({ aidDetected: writable({ shortId: "story", cards: [{ name: "VN Mode", triggers: "." }] }) }));
import { settings } from "@/storage";
import { startVnCardSession, syncVnCard } from "@/aid/vn_card_sync";
import { VN_CARD_MESSAGE } from "@/aid/vn_card";

it("disables a saved VN session and its stale card before accepting explicit enablement", () => {
  const post = vi.spyOn(window, "postMessage").mockImplementation(() => {});
  startVnCardSession();
  expect(get(settings).visualNovelMode).toBe(false);
  expect(get(settings).volume).toBe(75);
  const request = post.mock.calls[0]![0];
  expect(request).toMatchObject({ source: VN_CARD_MESSAGE, kind: "set", shortId: "story", enabled: false });
  window.dispatchEvent(new MessageEvent("message", { source: window, origin: location.origin,
    data: { source: VN_CARD_MESSAGE, kind: "result", id: request.id } }));
  syncVnCard();
  expect(post).toHaveBeenCalledTimes(1);
  settings.update(value => ({ ...value, visualNovelMode: true }));
  syncVnCard();
  expect(post.mock.calls[1]![0]).toMatchObject({ enabled: true, shortId: "story" });
  function finish(index: number, error?: string) {
    window.dispatchEvent(new MessageEvent("message", { source: window, origin: location.origin,
      data: { source: VN_CARD_MESSAGE, kind: "result", id: post.mock.calls[index]![0].id, error } }));
  }
  // Exit while enabling is still saving must follow immediately, without polling.
  settings.update(value => ({ ...value, visualNovelMode: false }));
  syncVnCard();
  finish(1);
  expect(post.mock.calls[2]![0]).toMatchObject({ enabled: false });
  // A failed exit must not poison future exits after a successful re-entry.
  finish(2, "Temporary save failure");
  settings.update(value => ({ ...value, visualNovelMode: true }));
  syncVnCard();
  finish(3);
  settings.update(value => ({ ...value, visualNovelMode: false }));
  syncVnCard();
  expect(post.mock.calls[4]![0]).toMatchObject({ enabled: false });
  finish(4);
  post.mockRestore();
});
