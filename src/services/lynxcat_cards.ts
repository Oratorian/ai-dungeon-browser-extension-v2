import type { AidCard } from "@/aid/protocol";
/** Import only matching metadata. Native images and story contents never enter the card set. */
export function lynxCards(raw: unknown): AidCard[] {
  if (!Array.isArray(raw)) return [];
  const cards: AidCard[] = [];
  for (const value of raw) {
    if (!value || typeof value !== "object") continue;
    const card = value as Record<string, unknown>;
    if (card.deletedAt || card.enabled === false) continue;
    if (typeof card.id !== "string" || !card.id || typeof card.name !== "string" || !card.name.trim()) continue;
    const nativeType = typeof card.type === "string" ? card.type.trim().toLowerCase() : "other";
    const category = typeof card.category === "string" ? card.category.trim().toLowerCase() : "";
    const type = (!nativeType || nativeType === "other") && ["character", "location"].includes(category) ? category : nativeType || "other";
    const triggers = [...new Set([...(Array.isArray(card.triggers) ? card.triggers : []), ...(Array.isArray(card.aliases) ? card.aliases : [])]
      .filter((v): v is string => typeof v === "string").map(v => v.trim()).filter(Boolean))].join(", ");
    cards.push({ id: `lynxcat:${card.id}`, name: card.name.trim(), type, triggers });
  }
  return cards;
}
