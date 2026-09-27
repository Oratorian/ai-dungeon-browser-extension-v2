import { describe, expect, it } from "vitest";
import { parseNovel } from "@/rendering/novel";
import { createNovelLocationTracker, retainedLocationSeed } from "@/rendering/novel_location";

const locations = [{ id: "cafe", name: "Dragon Cafe", triggers: "cafe" }, { id: "kitchen", name: "Kitchen", triggers: "" }, { id: "quarter", name: "Old Quarter", triggers: "quarter" }];
const track = createNovelLocationTracker(locations);
describe("VN location tracking", () => {
  it("recognizes the live Lynx location answer and carries it into narration", () => {
    const grove = createNovelLocationTracker([{ id: "grove", name: "The Shattered Grove", triggers: "Shattered Grove" }]);
    const frames = parseNovel(`Lyra: "We're in the Shattered Grove. It's difficult to explain."\nShe pauses, her gaze drifting across the crystalline shards.`);
    expect(grove(frames)).toEqual(frames.map(() => "grove"));
    expect(track(parseNovel('Sage: “We’re currently in the kitchen.”'), "cafe")).toEqual(["kitchen"]);
    expect(track(parseNovel('"You are at the Old Quarter"'), "cafe")).toEqual(["quarter"]);
  });
  it("does not mistake questions, plans, memories or incomplete location statements for arrivals", () => {
    for (const text of ['"We’re in the kitchen?"', '"We were in the kitchen."', '"We will be in the kitchen."', '"If we are in the kitchen, hide."', '"I remember we are in the kitchen."', '"We’re not in the kitchen."', '"We’re in the kitchen', '"The kitchen is lovely."']) {
      expect(track(parseNovel(text), "cafe").at(-1)).toBe("cafe");
    }
  });
  it("carries a setting across paragraphs and switches on explicit player movement", () => {
    expect(track(parseNovel('You enter the Dragon Cafe. Sage waves.\nYou walk into the kitchen. Pots rattle.'))).toEqual(["cafe", "cafe", "kitchen", "kitchen"]);
  });
  it("ignores dialogue, plans, negation, memories, and other characters moving", () => {
    for (const text of ['"You enter the kitchen," she says.', 'You plan to enter the kitchen.', 'You will enter the kitchen.', "You do not enter the kitchen.", 'You remember the Old Quarter.', 'You remember you entered the kitchen.', 'If you enter the kitchen, be careful.', 'Sage enters the kitchen.', 'You hear about the Old Quarter.', '"You enter the kitchen']) {
      expect(track(parseNovel(text), "cafe").at(-1)).toBe("cafe");
    }
  });
  it("clears the old setting on departure and supports explicit scene openings", () => {
    expect(track(parseNovel('Inside the Dragon Cafe, lamps glow. You leave the cafe. You arrive at the Old Quarter.'))).toEqual(["cafe", null, "quarter"]);
    expect(track(parseNovel('The Dragon Cafe hums with conversation.'))).toEqual(["cafe"]);
    expect(track(parseNovel('You leave the cafe and enter the kitchen.'), "cafe")).toEqual(["kitchen"]);
  });
  it("does not confuse ambiguous aliases or partial words", () => {
    const ambiguous = createNovelLocationTracker([...locations, { id: "other", name: "Other Cafe", triggers: "cafe" }]);
    expect(ambiguous(parseNovel('You enter the cafe.'))).toEqual([null]);
    expect(track(parseNovel('You enter the cafeteria.'))).toEqual([null]);
  });
  it("reconstructs Back/Next and retried scenes without carrying a discarded future", () => {
    expect(track(parseNovel('You enter the cafe. You enter the kitchen.'))).toEqual(["cafe", "kitchen"]);
    expect(track(parseNovel('You enter the cafe. You stay here.'))).toEqual(["cafe", "cafe"]);
  });
  it("retains context when the opening location scrolls out of the DOM", () => {
    const before = parseNovel('You enter the cafe. Sage waves. You enter the kitchen.');
    const after = before.slice(1);
    const seed = retainedLocationSeed(before, track(before), after, null);
    expect(seed).toBe("cafe"); expect(track(after, seed)).toEqual(["cafe", "kitchen"]);
  });
});
