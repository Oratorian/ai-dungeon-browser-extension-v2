import type { StoryCard } from "@/shared/types";

// Works out how a batch of cards captured from AI Dungeon should be folded into an adventure that
// may already hold some of them. Pure, so it is unit-tested; Storage.importStoryCards applies the
// result.
//
// Importing used to skip any card whose name already existed, which meant that once a set had been
// imported it never followed AI Dungeon again: edit a trigger on the AID side and the extension's
// copy silently kept the old one. Now a card that is already present is updated in place, matched by
// the stable id AI Dungeon gives each card, or by name for cards imported before that id was kept.
// Everything the user added themselves (icons, portraits, audio, colours) stays untouched, because
// only the fields that come from AI Dungeon are ever written.

export type IncomingCard = {
  /** AI Dungeon's own card id. Optional so hand-built batches still work. */
  id?: string;
  name: string;
  type: string;
  triggers: string;
};

export type SyncPlan = {
  /** Cards not present in any form; to be created. */
  additions: { name: string; type: string; triggers: string; aidId?: string }[];
  /** Existing card id to the AID-sourced fields that differ. */
  updates: Record<string, Partial<Pick<StoryCard, "name" | "type" | "triggers" | "aidId">>>;
  /** Incoming cards that matched an existing one and needed no change. */
  unchanged: number;
  /** Incoming cards that could not be used at all (no name, or a duplicate within the batch). */
  dropped: number;
};

export function planAidSync(existing: StoryCard[], incoming: IncomingCard[]): SyncPlan {
  const byAidId = new Map<string, StoryCard>();
  const byName = new Map<string, StoryCard>();
  for (const card of existing) {
    if (card.aidId) byAidId.set(card.aidId, card);
    byName.set(card.name.trim().toLowerCase(), card);
  }

  const plan: SyncPlan = { additions: [], updates: {}, unchanged: 0, dropped: 0 };
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  for (const card of incoming) {
    const name = card.name.trim();
    const key = name.toLowerCase();
    const type = card.type || "character";
    const triggers = card.triggers ?? "";

    // A batch can carry duplicates (AID lists a card once per version it has). Take the first.
    if (!name || (card.id && seenIds.has(card.id)) || seenNames.has(key)) {
      plan.dropped++;
      continue;
    }
    if (card.id) seenIds.add(card.id);
    seenNames.add(key);

    const match = (card.id && byAidId.get(card.id)) || byName.get(key);

    if (!match) {
      plan.additions.push({ name, type, triggers, ...(card.id ? { aidId: card.id } : {}) });
      continue;
    }

    // Only fields that AI Dungeon owns are compared and written. The name is followed only when the
    // match was by id, since a name match means the names already agree apart from case, and the
    // user's casing is as good as AID's.
    const changes: SyncPlan["updates"][string] = {};
    if (card.id && match.aidId === card.id && match.name !== name) changes.name = name;
    if (match.type !== type) changes.type = type;
    if (match.triggers !== triggers) changes.triggers = triggers;
    if (card.id && !match.aidId) changes.aidId = card.id;

    if (Object.keys(changes).length > 0) plan.updates[match.id] = changes;
    else plan.unchanged++;
  }

  return plan;
}
