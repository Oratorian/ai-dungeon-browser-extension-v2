import { describe, it, expect, vi, afterEach } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { readAdventures, diffAdventures, adventureKey, LEGACY_ADVENTURES_KEY } from "@/storage/persist";
import { Storage } from "@/storage";
import type { Adventure } from "@/shared/types";

const adventure = (id: string, name = id): Adventure => ({ id, name, createdAt: 1, storyCards: {} });

describe("readAdventures", () => {
  it("collects per-adventure keys", () => {
    const { raw, legacy } = readAdventures({ [adventureKey("a")]: adventure("a"), settings: {} });
    expect(Object.keys(raw)).toEqual(["a"]);
    expect(legacy).toBe(false);
  });

  it("reads the legacy blob and reports that it was there", () => {
    const { raw, legacy } = readAdventures({ [LEGACY_ADVENTURES_KEY]: { a: adventure("a"), b: adventure("b") } });
    expect(Object.keys(raw).sort()).toEqual(["a", "b"]);
    expect(legacy).toBe(true);
  });

  it("lets a per-adventure entry win over the legacy copy of the same id", () => {
    const { raw } = readAdventures({
      [LEGACY_ADVENTURES_KEY]: { a: adventure("a", "old") },
      [adventureKey("a")]: adventure("a", "new"),
    });
    expect((raw.a as Adventure).name).toBe("new");
  });

  it("ignores unrelated keys and non-object junk under an adventure key", () => {
    const { raw } = readAdventures({ [adventureKey("x")]: "corrupt", audioLibrary: [], selectedAdventureId: "a" });
    expect(raw).toEqual({});
  });
});

describe("diffAdventures", () => {
  it("reports nothing when the same objects are present", () => {
    const a = adventure("a");
    expect(diffAdventures({ a }, { a })).toEqual({ changed: [], removed: [] });
  });

  it("reports only the adventure whose object was replaced", () => {
    const a = adventure("a");
    const b = adventure("b");
    const b2 = { ...b, name: "renamed" };
    expect(diffAdventures({ a, b }, { a, b: b2 })).toEqual({ changed: [b2], removed: [] });
  });

  it("reports removed ids and new ones", () => {
    const a = adventure("a");
    const c = adventure("c");
    expect(diffAdventures({ a, b: adventure("b") }, { a, c })).toEqual({ changed: [c], removed: ["b"] });
  });
});

describe("Storage persistence", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("migrates the legacy blob into per-adventure keys and removes it", async () => {
    await fakeBrowser.storage.local.set({ [LEGACY_ADVENTURES_KEY]: { a: adventure("a"), b: adventure("b") } });

    await Storage.load();

    const all = await fakeBrowser.storage.local.get(null);
    expect(all[LEGACY_ADVENTURES_KEY]).toBeUndefined();
    expect(all[adventureKey("a")]).toMatchObject({ id: "a" });
    expect(all[adventureKey("b")]).toMatchObject({ id: "b" });
    expect(Object.keys(Storage.getAdventureById("a") ?? {})).toContain("storyCards");
  });

  it("loads from per-adventure keys when there is no legacy blob", async () => {
    await fakeBrowser.storage.local.set({ [adventureKey("a")]: adventure("a", "Only") });

    await Storage.load();

    expect(Storage.getAdventureById("a")?.name).toBe("Only");
    const all = await fakeBrowser.storage.local.get(null);
    expect(Object.keys(all).filter((k) => k.startsWith("adventure:"))).toEqual([adventureKey("a")]);
  });

  it("writes only the adventure that changed, and removes the key of a deleted one", async () => {
    vi.useFakeTimers();
    await fakeBrowser.storage.local.set({ [adventureKey("a")]: adventure("a"), [adventureKey("b")]: adventure("b") });
    await Storage.load();
    Storage.listen();

    const writes = vi.spyOn(fakeBrowser.storage.local, "set");
    const removes = vi.spyOn(fakeBrowser.storage.local, "remove");

    Storage.updateAdventure("a", { name: "renamed" });
    Storage.deleteAdventure("b");
    await vi.runAllTimersAsync();

    const written = writes.mock.calls.flatMap((c) => Object.keys(c[0] as object));
    expect(written).toEqual([adventureKey("a")]);
    expect(removes).toHaveBeenCalledWith([adventureKey("b")]);

    const all = await fakeBrowser.storage.local.get(null);
    expect((all[adventureKey("a")] as Adventure).name).toBe("renamed");
    expect(all[adventureKey("b")]).toBeUndefined();
  });
});
