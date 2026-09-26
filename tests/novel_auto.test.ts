import { expect, it } from "vitest";
import { novelAutoDelay } from "@/rendering/novel_auto";

it("gives short lines a minimum pause and longer passages proportionate reading time", () => {
  expect(novelAutoDelay("")).toBe(2000);
  expect(novelAutoDelay("Hello there.")).toBe(2000);
  expect(novelAutoDelay(Array(220).fill("word").join(" "))).toBe(60800);
  expect(novelAutoDelay("one\n two   three")).toBe(novelAutoDelay("one two three"));
});
