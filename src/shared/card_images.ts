import type { StoryCard } from "./types";
import { graphicIds } from "./portrait_variants";

/** Display changes never write picture indexes into the shared card set. */
export function withCardPortrait(card: StoryCard, portrait: string | undefined): StoryCard {
  if (!portrait) return card;
  const index = graphicIds(card.graphics).indexOf(portrait);
  return index < 0 || index === card.graphicIndex ? card : { ...card, graphicIndex: index };
}

export function cardIconIndexes(card: StoryCard): number[] {
  const portrait = graphicIds(card.graphics)[card.graphics[card.graphicIndex] ? card.graphicIndex : 0];
  return card.icons.flatMap((image, index) => image && (!card.iconGraphics?.[index] || card.iconGraphics[index] === portrait) ? [index] : []);
}

/** Website pictures remain separate so local choices always win. */
export function cardImage(card: StoryCard | null | undefined, kind: "icon" | "portrait" = "portrait"): string | undefined {
  if (!card) return undefined;
  const eligible = cardIconIndexes(card);
  const paired = eligible.filter(index => !!card.iconGraphics?.[index]);
  const choices = paired.length ? paired : eligible;
  const icon = card.icons[choices.includes(card.iconIndex) ? card.iconIndex : choices[0] ?? -1];
  const portrait = card.graphics[card.graphicIndex] || card.graphics[0];
  return (kind === "icon" ? icon || portrait : portrait || icon) || card.lynxImageUrl || undefined;
}

export function websiteImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try { const url = new URL(value); return url.protocol === "https:" ? url.href : null; }
  catch { return null; }
}
