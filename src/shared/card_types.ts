// The story-card type vocabulary, shared by the card editor's type picker and the Adventure tab's
// grouping so the two can never disagree about a label or an icon.
//
// The order here is the display order: it is the order the editor offers and the order the Adventure
// tab stacks its groups in, which is deliberately not alphabetical (characters and locations are the
// common cases and belong at the top).

export type StoryCardType = {
  value: string;
  label: string;
  /** Material Symbols ligature. */
  icon: string;
};

export const STORY_CARD_TYPES: StoryCardType[] = [
  { value: "character", label: "Character", icon: "sentiment_excited" },
  { value: "location", label: "Location", icon: "explore" },
  { value: "race", label: "Race", icon: "skull" },
  { value: "item", label: "Item", icon: "apparel" },
  { value: "faction", label: "Faction", icon: "sword_rose" },
  { value: "event", label: "Event", icon: "domino_mask" },
];

const BY_VALUE = new Map(STORY_CARD_TYPES.map((t) => [t.value, t]));

/**
 * Label and icon for a card type. Cards imported from AI Dungeon (or carried over from the old
 * extension) can hold any string, so an unknown type falls back to its own name rather than being
 * hidden or lumped into "other", which would make those cards hard to find.
 */
export function cardTypeMeta(type: string): StoryCardType {
  return BY_VALUE.get(type) ?? { value: type, label: type || "Untyped", icon: "help" };
}

/** Sort key placing known types in vocabulary order and unknown ones after, alphabetically. */
export function cardTypeOrder(type: string): number {
  const index = STORY_CARD_TYPES.findIndex((t) => t.value === type);
  return index === -1 ? STORY_CARD_TYPES.length : index;
}
