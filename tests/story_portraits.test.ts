import { expect, it } from "vitest";
import { StoryPortraitSession } from "@/rendering/story_portraits";
import { parseNovel } from "@/rendering/novel";
import { novelCards } from "@/rendering/novel_cards";
import { withCardPortrait, cardImage } from "@/shared/card_images";
import { graphicIds } from "@/shared/portrait_variants";
import type { StoryCard } from "@/shared/types";

const ids = graphicIds(["casual", "red"]);
const card: StoryCard = { id: "worf", name: "Worf", type: "character", triggers: "Worf", graphics: ["casual", "red"],
  graphicIndex: 0, icons: ["casual-icon", "red-icon"], iconIndex: 0, iconGraphics: [ids[0]!, ids[1]!],
  graphicVariants: [{ name: "Casual", triggers: "casual clothes" }, { name: "Red", triggers: "red uniform" }],
  useCustomColor: false, color: "", limit: "none", preset: "default", audioClips: [] };
const cards = novelCards([card]);

it("applies the same normal-mode picture and icon while keeping shared card data untouched", () => {
  const session = new StoryPortraitSession();
  const pictures = session.update(parseNovel('Worf wears a red uniform.\nWorf: "Ready."'), cards);
  const display = withCardPortrait(card, pictures.worf);
  expect(cardImage(display)).toBe("red");
  expect(cardImage(display, "icon")).toBe("red-icon");
  expect(card.graphicIndex).toBe(0);
});

it("does not follow costume descriptions inside spoken words", () => {
  const session = new StoryPortraitSession();
  expect(session.update(parseNovel('Worf: "Worf needs a red uniform. Worf wears casual clothes."'), cards).worf).toBe(ids[0]);
});

it("keeps the style after earlier story text is virtualized and changes it on a later trigger", () => {
  const session = new StoryPortraitSession();
  session.update(parseNovel('Worf wears a red uniform.\nWorf waits.'), cards);
  expect(session.update(parseNovel('Worf waits.'), cards).worf).toBe(ids[1]);
  expect(session.update(parseNovel('Worf waits.\nWorf puts on casual clothes.'), cards).worf).toBe(ids[0]);
});

it("re-evaluates edited or retried text and isolates different story sessions", () => {
  const session = new StoryPortraitSession();
  session.update(parseNovel('Worf wears a red uniform.\nWorf waits.'), cards);
  expect(session.update(parseNovel('Worf waits.\nWorf smiles.'), cards).worf).toBe(ids[1]);
  expect(new StoryPortraitSession().update(parseNovel('Worf waits.'), cards).worf).toBe(ids[0]);
  const edit = new StoryPortraitSession();
  edit.update(parseNovel('Worf wears a red uniform.'), cards);
  expect(edit.update(parseNovel('Worf waits.'), cards).worf).toBe(ids[0]);
});

it("keeps a manually cycled preview until new narration changes its style", () => {
  const session = new StoryPortraitSession();
  const frames = parseNovel('Worf wears a red uniform.\nWorf waits.');
  session.update(frames, cards);
  expect(session.choose("worf", ids[0]!).worf).toBe(ids[0]);
  expect(session.update(frames, cards).worf).toBe(ids[0]);
  expect(session.update(parseNovel('Worf wears a red uniform.\nWorf waits.\nWorf is wearing a red uniform.'), cards).worf).toBe(ids[1]);
});
