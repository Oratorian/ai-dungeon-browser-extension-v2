// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { insertMention, mentionAtCaret } from "@/aid/mentions";

it("updates a controlled textarea through its native setter and emits input without submitting", () => {
  const input = document.createElement("textarea");
  input.value = "Ask @Sa about it.";
  document.body.append(input);
  input.setSelectionRange(7, 7);
  // Simulate React's value tracker: the instance setter must not be used for the fallback.
  const instanceSetter = vi.fn();
  Object.defineProperty(input, "value", {
    configurable: true,
    get: () => Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.get!.call(input),
    set: instanceSetter,
  });
  const changed = vi.fn(), submitted = vi.fn();
  input.addEventListener("input", changed);
  input.addEventListener("submit", submitted);
  insertMention(input, mentionAtCaret(input.value, 7)!, "Sage Harrow");
  expect(input.value).toBe("Ask Sage Harrow about it.");
  expect(input.selectionStart).toBe(15);
  expect(input.selectionEnd).toBe(15);
  expect(document.activeElement).toBe(input);
  expect(instanceSetter).not.toHaveBeenCalled();
  expect(changed).toHaveBeenCalledOnce();
  expect(submitted).not.toHaveBeenCalled();
  input.remove();
});
