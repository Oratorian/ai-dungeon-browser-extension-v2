import type { AidCard } from "@/aid/protocol";
import type { StoryCard } from "@/shared/types";
import { cardImage } from "@/shared/card_images";

export type NovelCard = Pick<StoryCard, "id" | "name" | "type" | "triggers" | "gender"> & { image?: string };

/** Read-only scene cards. Native cards need no import; selected local media wins. */
export function novelCards(local: StoryCard[], native: AidCard[] = []): NovelCard[] {
  const remaining = new Set(native);
  const cards = local.map(card => {
    const match = native.find(item => item.id === card.aidId)
      ?? native.find(item => item.name.trim().toLowerCase() === card.name.trim().toLowerCase()
        && item.type.trim().toLowerCase() === card.type.trim().toLowerCase());
    if (match) remaining.delete(match);
    return { id: card.id, name: card.name, type: card.type, triggers: card.triggers,
      gender: card.gender ?? match?.gender,
      image: cardImage(match ? { ...card, lynxImageUrl: match.lynxImageUrl } : card) };
  });
  for (const card of remaining) cards.push({ id: card.id, name: card.name, type: card.type,
    triggers: card.triggers, gender: card.gender, image: card.lynxImageUrl || undefined });
  return cards;
}
