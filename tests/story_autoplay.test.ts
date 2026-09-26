import { expect, it } from "vitest";
import { createStoryAutoplay } from "@/rendering/story_autoplay";

it("waits for streaming to settle and reads a new passage once", () => {
  const poll = createStoryAutoplay(["Old."]);
  expect(poll(["Old."], 0)).toBeNull();
  expect(poll(["Old.", "New"], 100)).toBeNull();
  expect(poll(["Old.", "New words."], 1000)).toBeNull();
  expect(poll(["Old.", "New words."], 2999)).toBeNull();
  expect(poll(["Old.", "New words."], 3000)).toEqual({ text: "New words.", replace: false });
  expect(poll(["Old.", "New words."], 6000)).toBeNull();
});
it("does not replay loaded history or remounted text", () => {
  const poll = createStoryAutoplay(["One.", "Two."]);
  expect(poll(["One."], 0)).toBeNull();
  expect(poll(["One."], 3000)).toBeNull();
  expect(poll(["One.", " Two. "], 6000)).toBeNull();
});
it("reads only appended continuation and identifies retry replacement", () => {
  const poll = createStoryAutoplay(["First."]);
  poll(["First. More."], 0);
  expect(poll(["First. More."], 2000)).toEqual({ text: "More.", replace: false });
  expect(poll([], 2500)).toBeNull();
  poll(["Replacement."], 3000);
  expect(poll(["Replacement."], 5000)).toEqual({ text: "Replacement.", replace: true });
});
it("waits while native controls report generation in progress", () => {
  const poll = createStoryAutoplay([]);
  poll(["Wait."], 0);
  expect(poll(["Wait."], 4000, true)).toBeNull();
  expect(poll(["Wait."], 5000)).toBeNull();
  expect(poll(["Wait."], 6000)).toEqual({ text: "Wait.", replace: false });
});
