import type { StoryCard } from "./types";

/** Website pictures remain separate so local choices always win. */
export function cardImage(card: StoryCard | null | undefined, kind: "icon" | "portrait" = "portrait"): string | undefined {
  if (!card) return undefined;
  const icon = card.icons[card.iconIndex] || card.icons[0];
  const portrait = card.graphics[card.graphicIndex] || card.graphics[0];
  return (kind === "icon" ? icon || portrait : portrait || icon) || card.lynxImageUrl || undefined;
}

export function websiteImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try { const url = new URL(value); return url.protocol === "https:" ? url.href : null; }
  catch { return null; }
}
