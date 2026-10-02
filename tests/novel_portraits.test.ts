import { expect, it } from "vitest";
import { createNovelPortraitTracker, novelPortrait, readPortraitChoices } from "@/rendering/novel_portraits";
import { parseNovel } from "@/rendering/novel";
import { novelCards, type NovelCard } from "@/rendering/novel_cards";
import { createNovelBookmark } from "@/rendering/novel_bookmark";
import type { StoryCard } from "@/shared/types";

const worf: NovelCard = { id: "worf", name: "Worf", type: "character", triggers: "Commander Worf", image: "casual",
  portraits: [{ id: "casual", name: "Casual", image: "casual", triggers: "casual clothes" },
    { id: "red", name: "Red uniform", image: "red", triggers: "red uniform, red shirt" }] };
const data: NovelCard = { ...worf, id: "data", name: "Data", triggers: "Mr. Data" };
const cards = [worf, data];

it("changes only the named character and carries the picture across dialogue", () => {
  const frames = parseNovel('Commander Worf wears a red uniform.\nData stands beside Worf.\nWorf: "Ready."');
  const timeline = createNovelPortraitTracker(cards)(frames);
  expect(timeline).toEqual(Array(3).fill({ worf: { portrait: "red", at: 0 } }));
  expect(novelPortrait(worf, timeline[2]?.worf, undefined, frames).image).toBe("red");
  expect(novelPortrait(data, timeline[2]?.data, undefined, frames).image).toBe("casual");
});

it("reconstructs the right picture for Back and Next", () => {
  const frames = parseNovel('Worf wears a red shirt.\nWorf changes into casual clothes.');
  const timeline = createNovelPortraitTracker(cards)(frames);
  expect(novelPortrait(worf, timeline[0]?.worf, undefined, frames).image).toBe("red");
  expect(novelPortrait(worf, timeline[1]?.worf, undefined, frames).image).toBe("casual");
});

it.each([
  'Data: "Worf needs a red uniform."',
  '"Worf wears a red uniform," Data says.',
  'Data watches Worf wearing a red uniform.',
  'Worfson wears a red uniform.',
  'Worf wears a red uniformity badge.',
  'He wears a red uniform.',
  'Worf: "I need casual clothes. Worf wants a red uniform."',
  'Worf: “I need casual clothes. Worf wants a red uniform.”',
  'Worf: "Worf wants a red uniform.',
])("ignores dialogue, ambiguous narration and partial words: %s", text => {
  expect(createNovelPortraitTracker(cards)(parseNovel(text)).at(-1)).toEqual({});
});

it("allows separate named clauses, honors title periods and excludes locations", () => {
  const frames = parseNovel('Worf wears a red shirt; Mr. Data wears casual clothes.');
  expect(createNovelPortraitTracker([...cards, { ...worf, id: "location", type: "location" }])(frames).at(-1))
    .toEqual({ worf: { portrait: "red", at: 0 }, data: { portrait: "casual", at: 0 } });
});

it("can change a picture from narration outside a quote in the same sentence", () => {
  const frames = parseNovel('Worf wears a red shirt and says, "Data wears casual clothes."');
  expect(createNovelPortraitTracker(cards)(frames)[0]).toEqual({ worf: { portrait: "red", at: 0 } });
});

it("does not guess when aliases or picture rules conflict", () => {
  expect(createNovelPortraitTracker([worf, { ...data, triggers: "Worf" }])(parseNovel("Worf wears a red shirt."))[0]).toEqual({});
  const conflict = { ...worf, portraits: worf.portraits!.map(picture => ({ ...picture, triggers: "red shirt" })) };
  expect(createNovelPortraitTracker([conflict])(parseNovel("Worf wears a red shirt."))[0]).toEqual({});
});

it("locks manual choices and yields only to narration after an unlocked choice", () => {
  const frames = parseNovel('Worf wears a red shirt.\nWorf waits.\nWorf puts on a red uniform.');
  const timeline = createNovelPortraitTracker(cards)(frames);
  const choice = { portrait: "casual", locked: true, anchor: createNovelBookmark(frames, 1) };
  expect(novelPortrait(worf, timeline[2]?.worf, choice, frames).image).toBe("casual");
  expect(novelPortrait(worf, timeline[1]?.worf, { ...choice, locked: false }, frames).image).toBe("casual");
  expect(novelPortrait(worf, timeline[2]?.worf, { ...choice, locked: false }, frames).image).toBe("red");
});

it("restores valid choices and discards removed pictures or malformed storage", () => {
  const saved = JSON.parse(JSON.stringify({ worf: { portrait: "red", locked: true }, data: { portrait: "deleted", locked: true } }));
  expect(readPortraitChoices(saved, cards)).toEqual({ worf: { portrait: "red", locked: true, anchor: undefined } });
  expect(readPortraitChoices({ worf: { portrait: "red", locked: "yes" } }, cards)).toEqual({});
  expect(readPortraitChoices(null, cards)).toEqual({});
  expect(novelPortrait(worf, undefined, { portrait: "deleted", locked: true }, []).image).toBe("casual");
});

it("keeps selection identity when pictures move and leaves shared card defaults alone", () => {
  const card = { id: "worf", name: "Worf", type: "character", triggers: "Worf", graphics: ["casual", "red"],
    graphicIndex: 0, icons: [], iconIndex: 0, useCustomColor: false, color: "", limit: "none", preset: "default", audioClips: [] } satisfies StoryCard;
  const scene = novelCards([card])[0]!;
  const choice = { portrait: scene.portraits![1]!.id, locked: true };
  const reordered = novelCards([{ ...card, graphics: ["red", "casual"], graphicIndex: 1 }])[0]!;
  expect(novelPortrait(reordered, undefined, choice, []).image).toBe("red");
  expect(card.graphicIndex).toBe(0);
  expect(scene.image).toBe("casual");
});
