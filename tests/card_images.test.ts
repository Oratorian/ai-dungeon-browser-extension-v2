import { expect, it } from "vitest";
import { cardImage, cardIconIndexes, withCardPortrait } from "@/shared/card_images";
import { graphicIds, readIconGraphics, remapIconGraphics } from "@/shared/portrait_variants";
import { Storage } from "@/storage";
import type { StoryCard } from "@/shared/types";

const ids = graphicIds(["casual", "armor"]);
const card: StoryCard = { id: "worf", name: "Worf", type: "character", triggers: "Worf", graphics: ["casual", "armor"],
  graphicIndex: 0, icons: ["casual-icon", "armor-icon", "shared-icon"], iconIndex: 0,
  iconGraphics: [ids[0]!, ids[1]!, null], useCustomColor: false, color: "", limit: "none", preset: "default", audioClips: [] };

it("uses the icon paired with the active picture and filters incompatible choices", () => {
  const armored = withCardPortrait(card, ids[1]);
  expect(cardImage(armored)).toBe("armor");
  expect(cardImage(armored, "icon")).toBe("armor-icon");
  expect(cardIconIndexes(armored)).toEqual([1, 2]);
  expect(card.graphicIndex).toBe(0);
  expect(card.iconIndex).toBe(0);
});

it("uses a shared icon or the picture itself when no paired icon exists", () => {
  const changed = { ...card, graphics: [...card.graphics, "third"], graphicIndex: 2 };
  expect(cardImage(changed, "icon")).toBe("shared-icon");
  expect(cardImage({ ...changed, icons: card.icons.slice(0, 2) }, "icon")).toBe("third");
  expect(cardImage({ ...card, iconGraphics: undefined, iconIndex: 1 }, "icon")).toBe("armor-icon");
});

it("prefers a matching icon over a default shared icon", () => {
  expect(cardImage({ ...card, iconIndex: 2 }, "icon")).toBe("casual-icon");
});

it("keeps links on reorder and clears a link when its picture is removed", () => {
  expect(readIconGraphics(card.iconGraphics, 3, ["armor", "casual"])).toEqual(card.iconGraphics);
  expect(readIconGraphics(card.iconGraphics, 3, ["armor"])).toEqual([null, ids[1], null]);
  expect(remapIconGraphics(card.icons, ["armor-icon", "new", "casual-icon"], card.iconGraphics)).toEqual([ids[1], null, ids[0]]);
});

it("validates and round trips icon links through import and export", () => {
  const imported = Storage.importAdventure(JSON.stringify({ adventure: { name: "Pairs", storyCards: { worf: card } } }));
  const restored = Storage.importAdventure(Storage.exportAdventure(imported.adventure!.id)!);
  expect(Object.values(restored.adventure!.storyCards)[0]?.iconGraphics).toEqual(card.iconGraphics);
  expect(readIconGraphics([123, "removed"], 2, card.graphics)).toEqual([null, null]);
});
