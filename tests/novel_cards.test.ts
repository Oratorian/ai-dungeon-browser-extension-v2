import { expect, it } from "vitest";
import { novelCards } from "@/rendering/novel_cards";
import { lynxCards } from "@/services/lynxcat_cards";
import { parseNovel } from "@/rendering/novel";
import { createNovelStageTracker } from "@/rendering/novel_stage";
import type { StoryCard } from "@/shared/types";

const native = lynxCards([
  { id: "lyra", name: "Lyra", type: "character", triggers: [], imageUrl: "https://example.com/lyra.png", fields: [{ key: "Gender", value: "Female" }] },
  { id: "grove", name: "The Shattered Grove", type: "location", triggers: ["Shattered Grove"], imageUrl: "https://example.com/grove.png" },
]);
const local = { id: "local-lyra", aidId: "lynxcat:lyra", name: "Lyra", type: "character", triggers: "Lyra", icons: [], graphics: [], iconIndex: 0, graphicIndex: 0 } as unknown as StoryCard;

it("uses native portraits, locations and gender without importing a set", () => {
  const cards = novelCards([], native);
  expect(cards).toHaveLength(2);
  expect(cards[0]).toMatchObject({ id: "lynxcat:lyra", image: "https://example.com/lyra.png", gender: "female" });
  expect(cards[1]).toMatchObject({ type: "location", image: "https://example.com/grove.png" });
  expect(createNovelStageTracker(cards)(parseNovel('Lyra: "Hello."'))[0]).toContain("lynxcat:lyra");
});

it("keeps local choices and IDs while filling missing cards and artwork from live data", () => {
  const custom = { ...local, graphics: ["local-picture"], gender: "none" as const };
  expect(novelCards([custom], native)[0]).toMatchObject({ id: local.id, image: "local-picture", gender: "none" });
  expect(novelCards([local], native)).toHaveLength(2);
  expect(novelCards([local], native)[0]?.image).toBe(native[0]?.lynxImageUrl);
  expect(novelCards([{ ...local, aidId: undefined }], native)).toHaveLength(2);
  expect(local.graphics).toEqual([]);
});

it("does not keep a removed native picture and leaves AID local cards intact", () => {
  const cached = { ...local, lynxImageUrl: "https://example.com/old.png" };
  expect(novelCards([cached], native.map(card => ({ ...card, lynxImageUrl: null })))[0]?.image).toBeUndefined();
  expect(novelCards([cached])[0]?.image).toBe(cached.lynxImageUrl);
});
