import { beforeEach, expect, it } from "vitest";
import { Storage } from "@/storage";
import { get } from "svelte/store";
import { contentVersion, newerVersion, normalizeGitHubSource } from "@/storage/github_updates";

const source = { repo: "owner/repo@HEAD", path: "cards.json", release: false };
const card = (id: string, name: string) => ({ id, name, triggers: name });
const pack = (version: unknown, cards = { a: card("a", "Alice") }) => JSON.stringify({ version, adventure: { id: "upstream", name: "Pack", storyCards: cards } });
beforeEach(() => Storage.adventures.set({}));

it("compares numeric versions rather than text and rejects unsupported revisions", () => {
  expect(newerVersion("1.10", "1.9")).toBe(true);
  expect(newerVersion("1", "1.0")).toBe(false);
  expect(newerVersion("2", "10")).toBe(false);
  expect(contentVersion("latest")).toBeNull();
});

it("tracks the GitHub source and keeps stable card IDs for later updates", () => {
  const imported = Storage.importGitHubAdventure(pack(1), source);
  expect(imported.id).not.toBe("upstream");
  expect(imported.storyCards.a?.id).toBe("a");
  expect(normalizeGitHubSource(imported.githubSource)).toEqual({ ...source, version: "1" });
  expect(JSON.parse(Storage.exportAdventure(imported.id)!).version).toBe("1");
});

it("merge preserves local cards, edits and bindings while adding new upstream cards", () => {
  const imported = Storage.importGitHubAdventure(pack(1), source);
  Storage.updateAdventure(imported.id, { name: "My pack", aidShortId: "adventure", aidScenarioId: "scenario", storyCards: { ...imported.storyCards, a: { ...imported.storyCards.a!, name: "Edited" }, local: { ...imported.storyCards.a!, id: "local" } } });
  const next = Storage.importGitHubAdventure(pack(2, { a: card("a", "Changed"), b: card("b", "Bob") } as any), source, imported.id, "merge");
  expect(Object.keys(next.storyCards).sort()).toEqual(["a", "b", "local"]);
  expect(next.storyCards.a?.name).toBe("Edited");
  expect(next).toMatchObject({ id: imported.id, name: "My pack", aidShortId: "adventure", aidScenarioId: "scenario", githubSource: { version: "2" } });
});

it("overwrite removes local cards while retaining set identity and bindings", () => {
  const imported = Storage.importGitHubAdventure(pack(1), source);
  Storage.updateAdventure(imported.id, { aidScenarioId: "scenario" });
  const next = Storage.importGitHubAdventure(pack(2, { b: card("b", "Bob") } as any), source, imported.id, "overwrite");
  expect(Object.keys(next.storyCards)).toEqual(["b"]);
  expect(next.id).toBe(imported.id);
  expect(next.aidScenarioId).toBe("scenario");
});

it("rejects stale, malformed and mismatched updates without changing storage", () => {
  const imported = Storage.importGitHubAdventure(pack(2), source);
  const before = get(Storage.adventures);
  expect(() => Storage.importGitHubAdventure(pack(1), source, imported.id, "overwrite")).toThrow();
  expect(() => Storage.importGitHubAdventure(pack(3), { ...source, path: "other.json" }, imported.id, "merge")).toThrow();
  expect(() => Storage.importGitHubAdventure(pack(3, { a: null } as any), source, imported.id, "overwrite")).toThrow();
  expect(get(Storage.adventures)).toBe(before);
});

it("file imports do not inherit GitHub tracking from exported metadata", () => {
  const original = Storage.importGitHubAdventure(pack(1), source);
  const copy = Storage.importAdventure(Storage.exportAdventure(original.id)!);
  expect(copy.success).toBe(true);
  expect(copy.adventure?.githubSource).toBeUndefined();
});
