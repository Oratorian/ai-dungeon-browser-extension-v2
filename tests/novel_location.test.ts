import { describe, expect, it } from "vitest";
import { parseNovel } from "@/rendering/novel";
import { createNovelLocationTracker, retainedLocationSeed } from "@/rendering/novel_location";

const locations = [
  { id: "grove", name: "The Shattered Grove", type: "location", triggers: "Shattered Grove" },
  { id: "cafe", name: "Dragon Cafe", type: "Location", triggers: "cafe" },
];
const track = createNovelLocationTracker(locations);
describe("VN card-based location tracking", () => {
  it("looks up names and triggers in dialogue without requiring movement wording", () => {
    for (const text of ['Lyra: "Shattered Grove."', 'Lyra: "We are in the Shattered Grove."', 'The Shattered Grove stretches before you.']) {
      expect(track(parseNovel(text)).at(-1)).toBe("grove");
    }
  });
  it("ignores character and other card types, even for a matching name or trigger", () => {
    for (const type of ["character", "other"]) {
      const lookup = createNovelLocationTracker([{ ...locations[0]!, type }, locations[1]!]);
      expect(lookup(parseNovel('Shattered Grove.'), "cafe")).toEqual(["cafe"]);
      expect(lookup(parseNovel('Silence.'), "grove")).toEqual([null]);
    }
  });
  it("retains the background and changes to the last mentioned location", () => {
    expect(track(parseNovel('Shattered Grove. Lyra waves. The cafe is nearby.'))).toEqual(["grove", "grove", "cafe"]);
    expect(track(parseNovel('From the cafe to Shattered Grove.'))).toEqual(["grove"]);
  });
  it("does not confuse ambiguous aliases or partial words", () => {
    const ambiguous = createNovelLocationTracker([...locations, { id: "other", name: "Other Cafe", type: "location", triggers: "cafe" }]);
    expect(ambiguous(parseNovel('The cafe.'))).toEqual([null]);
    expect(track(parseNovel('The cafeteria.'))).toEqual([null]);
  });
  it("reconstructs Back/Next and retries without carrying a discarded future", () => {
    expect(track(parseNovel('Shattered Grove. The cafe.'))).toEqual(["grove", "cafe"]);
    expect(track(parseNovel('Shattered Grove. You stay here.'))).toEqual(["grove", "grove"]);
  });
  it("retains context when the opening location scrolls out of the DOM", () => {
    const before = parseNovel('Shattered Grove. Lyra waves. The cafe.');
    const after = before.slice(1);
    const seed = retainedLocationSeed(before, track(before), after, null);
    expect(seed).toBe("grove"); expect(track(after, seed)).toEqual(["grove", "cafe"]);
  });
});
