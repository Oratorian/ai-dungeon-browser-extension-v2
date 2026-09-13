import { describe, it, expect, beforeEach } from "vitest";
import { get } from "svelte/store";
import { Storage } from "@/storage";

// How a card set is tied to what is being played: by the adventure's own id, or by the scenario it
// was started from, so a set stamped once follows every duplicate or restart of that scenario.

describe("AI Dungeon bindings", () => {
  let a: string;
  let b: string;

  beforeEach(async () => {
    await Storage.load();
    a = Storage.createAdventure("A").id;
    b = Storage.createAdventure("B").id;
  });

  it("finds a set by the adventure shortId", () => {
    Storage.setAidShortId(a, "adv-1");
    expect(Storage.findAdventureForAid("adv-1", null)?.id).toBe(a);
    expect(Storage.findAdventureForAid("adv-2", null)).toBeNull();
  });

  it("falls back to the scenario when no set carries the adventure id", () => {
    Storage.setAidScenarioId(a, "scn-1");
    expect(Storage.findAdventureForAid("adv-duplicate", "scn-1")?.id).toBe(a);
    expect(Storage.findAdventureForAid("adv-duplicate", "scn-9")).toBeNull();
    expect(Storage.findAdventureForAid("adv-duplicate", null)).toBeNull();
  });

  it("lets an adventure stamp override the scenario stamp of another set", () => {
    Storage.setAidScenarioId(a, "scn-1");
    Storage.setAidShortId(b, "adv-1");
    expect(Storage.findAdventureForAid("adv-1", "scn-1")?.id).toBe(b);
    expect(Storage.findAdventureForAid("adv-other", "scn-1")?.id).toBe(a);
  });

  it("keeps a scenario stamp unique, moving it off the set that had it", () => {
    Storage.setAidScenarioId(a, "scn-1");
    Storage.setAidScenarioId(b, "scn-1");
    const all = get(Storage.adventures);
    expect(all[a]?.aidScenarioId).toBeUndefined();
    expect(all[b]?.aidScenarioId).toBe("scn-1");
  });

  it("clears one stamp without touching the other", () => {
    Storage.setAidShortId(a, "adv-1");
    Storage.setAidScenarioId(a, "scn-1");
    Storage.setAidShortId(a, null);
    const set = get(Storage.adventures)[a];
    expect(set?.aidShortId).toBeUndefined();
    expect(set?.aidScenarioId).toBe("scn-1");
  });

  it("selects the bound set and reports it, leaving the selection alone otherwise", () => {
    Storage.setAidScenarioId(a, "scn-1");
    Storage.selectAdventure(b);
    expect(Storage.selectAdventureByAidId("adv-x", "scn-none")).toBe(false);
    expect(get(Storage.selectedAdventureId)).toBe(b);
    expect(Storage.selectAdventureByAidId("adv-x", "scn-1")).toBe(true);
    expect(get(Storage.selectedAdventureId)).toBe(a);
  });
});
