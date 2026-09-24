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
  post.mockRestore();
});
