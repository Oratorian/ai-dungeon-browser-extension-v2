// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { installKonamiCode } from "@/shared/konami";

const keys = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
let dispose: (() => void) | undefined;
afterEach(() => { dispose?.(); document.body.replaceChildren(); });
function enter(target: Element) {
  for (const key of keys) target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, composed: true, cancelable: true }));
}
it("unlocks inside a shadow-root VN that stops key propagation, and removes its listener", () => {
  const host = document.createElement("div"); document.body.append(host);
  const root = host.attachShadow({ mode: "open" });
  const scene = document.createElement("div"); root.append(scene);
  scene.addEventListener("keydown", event => event.stopPropagation());
  const unlock = vi.fn(); dispose = installKonamiCode(window, unlock);
  enter(scene);
  expect(unlock).toHaveBeenCalledTimes(1);
  dispose(); enter(scene);
  expect(unlock).toHaveBeenCalledTimes(1);
});
it("ignores typing inside shadow-root inputs and leaves gameplay key defaults intact", () => {
  const host = document.createElement("div"); document.body.append(host);
  const root = host.attachShadow({ mode: "open" });
  const input = document.createElement("textarea"); root.append(input);
  const unlock = vi.fn(); dispose = installKonamiCode(window, unlock);
  enter(input); expect(unlock).not.toHaveBeenCalled();
  enter(host); expect(unlock).toHaveBeenCalledTimes(1);
  const event = new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true });
  host.dispatchEvent(event); expect(event.defaultPrevented).toBe(false);
});
