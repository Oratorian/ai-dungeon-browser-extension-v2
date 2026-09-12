import { describe, it, expect } from "vitest";
import { planAidSync } from "@/aid/sync";
import type { StoryCard } from "@/shared/types";

const existing = (over: Partial<StoryCard> & { name: string }): StoryCard => ({
  id: "local-" + over.name,
  triggers: "",
  type: "character",
  icons: ["data:image/png;base64,x"],
  iconIndex: 0,
  graphics: ["https://trinetra.mahesvara.cloud/i/abc"],
  graphicIndex: 0,
  useCustomColor: true,
  color: "#123456",
  limit: "none",
  preset: "default",
  audioClips: ["clip-1"],
  ...over,
});

describe("planAidSync", () => {
  it("creates cards that exist nowhere yet, carrying the AID id", () => {
    const plan = planAidSync([], [{ id: "aid-1", name: "Elara", type: "character", triggers: "elara, ranger" }]);
    expect(plan.additions).toEqual([{ name: "Elara", type: "character", triggers: "elara, ranger", aidId: "aid-1" }]);
    expect(plan.updates).toEqual({});
  });

  it("updates triggers in place when matched by AID id, and nothing else", () => {
    const card = existing({ name: "Elara", aidId: "aid-1", triggers: "elara" });
    const plan = planAidSync([card], [{ id: "aid-1", name: "Elara", type: "character", triggers: "elara, ranger" }]);
    expect(plan.additions).toEqual([]);
    expect(plan.updates).toEqual({ [card.id]: { triggers: "elara, ranger" } });
  });

  it("follows a rename when matched by AID id", () => {
    const card = existing({ name: "Elara", aidId: "aid-1" });
    const plan = planAidSync([card], [{ id: "aid-1", name: "Elara Moonwhisper", type: "character", triggers: "" }]);
    expect(plan.updates[card.id]).toEqual({ name: "Elara Moonwhisper" });
  });

  it("adopts the AID id onto a card imported before ids were kept, matching by name", () => {
    const card = existing({ name: "Elara", triggers: "elara" });
    const plan = planAidSync([card], [{ id: "aid-1", name: "elara", type: "character", triggers: "elara" }]);
    expect(plan.updates[card.id]).toEqual({ aidId: "aid-1" });
  });

  it("does not rewrite the user's casing of a name when matching by name", () => {
    const card = existing({ name: "ELARA", triggers: "" });
    const plan = planAidSync([card], [{ name: "Elara", type: "character", triggers: "" }]);
    expect(plan.updates).toEqual({});
    expect(plan.unchanged).toBe(1);
  });

  it("counts an identical card as unchanged rather than as an update", () => {
    const card = existing({ name: "Elara", aidId: "aid-1", triggers: "elara", type: "character" });
    const plan = planAidSync([card], [{ id: "aid-1", name: "Elara", type: "character", triggers: "elara" }]);
    expect(plan.unchanged).toBe(1);
    expect(plan.updates).toEqual({});
  });

  it("never touches icons, portraits, audio or colours, which AI Dungeon does not own", () => {
    const card = existing({ name: "Elara", aidId: "aid-1" });
    const plan = planAidSync([card], [{ id: "aid-1", name: "Elara", type: "location", triggers: "x" }]);
    const written = Object.keys(plan.updates[card.id] ?? {});
    expect(written.sort()).toEqual(["triggers", "type"]);
  });

  it("prefers the id match over a name match when both would apply to different cards", () => {
    const byId = existing({ name: "Old Name", aidId: "aid-1" });
    const byName = existing({ name: "Elara" });
    const plan = planAidSync([byId, byName], [{ id: "aid-1", name: "Elara", type: "character", triggers: "" }]);
    expect(plan.updates[byId.id]).toEqual({ name: "Elara" });
    expect(plan.updates[byName.id]).toBeUndefined();
  });

  it("drops nameless cards and in-batch duplicates, by id and by name", () => {
    const plan = planAidSync([], [
      { id: "a", name: "Elara", type: "character", triggers: "" },
      { id: "a", name: "Elara", type: "character", triggers: "" },
      { id: "b", name: "elara", type: "character", triggers: "" },
      { name: "   ", type: "character", triggers: "" },
    ]);
    expect(plan.additions).toHaveLength(1);
    expect(plan.dropped).toBe(3);
  });

  it("defaults a missing type to character", () => {
    const plan = planAidSync([], [{ name: "Thing", type: "", triggers: "" }]);
    expect(plan.additions[0]?.type).toBe("character");
  });
});
