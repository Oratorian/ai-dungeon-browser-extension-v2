import { expect, it } from "vitest";
import { createKonamiCode } from "@/shared/konami";

const code = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
it("unlocks only on the complete code, accepting uppercase letters and extra leading arrows", () => {
  const key = createKonamiCode();
  expect(key("ArrowUp")).toBe(false);
  for (const value of code.slice(0, -1)) expect(key(value)).toBe(false);
  expect(key("A")).toBe(true);
  expect(key("a")).toBe(false);
});
it("resets when typing or using modified keys interrupts the sequence", () => {
  const key = createKonamiCode();
  code.slice(0, 5).forEach(value => key(value));
  key("", true);
  for (const value of code.slice(5)) expect(key(value)).toBe(false);
  expect(code.map(value => key(value)).at(-1)).toBe(true);
});
