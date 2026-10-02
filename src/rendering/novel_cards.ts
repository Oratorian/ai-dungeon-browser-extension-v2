import type { AidCard } from "@/aid/protocol";
import type { StoryCard } from "@/shared/types";
import { cardImage } from "@/shared/card_images";
import { portraitId } from "@/shared/portrait_variants";

export type NovelPortrait = { id: string; image: string; name: string; triggers: string };
export type NovelCard = Pick<StoryCard, "id" | "name" | "type" | "triggers" | "gender"> & {
  image?: string;
  portraits?: NovelPortrait[];
};

/** Read-only scene cards. Native cards need no import; selected local media wins. */
export function novelCards(local: StoryCard[], native: AidCard[] = []): NovelCard[] {
  const remaining = new Set(native);
  const cards: NovelCard[] = local.map(card => {
    const match = native.find(item => item.id === card.aidId)
      ?? native.find(item => item.name.trim().toLowerCase() === card.name.trim().toLowerCase()
        && item.type.trim().toLowerCase() === card.type.trim().toLowerCase());
    if (match) remaining.delete(match);
    return { id: card.id, name: card.name, type: card.type, triggers: card.triggers,
      gender: card.gender ?? match?.gender,
      portraits: card.graphics.map((image, index) => ({ id: portraitId(image), image,
        name: card.graphicVariants?.[index]?.name || `Picture ${index + 1}`,
        triggers: card.graphicVariants?.[index]?.triggers ?? "" })),
      image: cardImage(match ? { ...card, lynxImageUrl: match.lynxImageUrl } : card) };
  });
  for (const card of remaining) cards.push({ id: card.id, name: card.name, type: card.type,
    triggers: card.triggers, gender: card.gender, image: card.lynxImageUrl || undefined });
  return cards;
}
