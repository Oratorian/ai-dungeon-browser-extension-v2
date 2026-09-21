import { beforeEach, expect, it } from "vitest";
import { Storage } from "@/storage";
import { nextContentVersion } from "@/storage/github_updates";

beforeEach(() => Storage.adventures.set({}));

it("suggests the next integer or final dotted component without losing precision", () => {
  expect(nextContentVersion(undefined)).toBe("2");
  expect(nextContentVersion("9")).toBe("10");
  expect(nextContentVersion("9.2.1")).toBe("9.2.2");
  expect(nextContentVersion("9.2.999999999999999999")).toBe("9.2.1000000000000000000");
});

it("exports the selected revision first and preserves cards and upstream tracking", () => {
  const adventure = Storage.importGitHubAdventure(
    JSON.stringify({ version: "9.2.1", adventure: { name: "Pack", storyCards: { a: { id: "a", name: "Alice", triggers: "Alice" } } } }),
    { repo: "owner/repo@HEAD", path: "pack.json", release: false },
  );
  const json = Storage.exportAdventure(adventure.id, "9.3")!;
  const exported = JSON.parse(json);
  expect(Object.keys(exported)[0]).toBe("version");
  expect(exported.version).toBe("9.3");
  expect(exported.adventure.contentVersion).toBe("9.3");
  expect(exported.adventure.storyCards).toEqual(adventure.storyCards);
  expect(exported.adventure.githubSource.version).toBe("9.2.1");
  // Preparing the file is pure; the UI remembers it only after initiating the download.
  expect(Storage.getAdventureById(adventure.id)).toBe(adventure);
  expect(Storage.importAdventure(json).adventure?.contentVersion).toBe("9.3");
});

it("keeps the current version for an ordinary export and rejects invalid or older versions", () => {
  const adventure = Storage.createAdventure("Pack");
  expect(JSON.parse(Storage.exportAdventure(adventure.id)!).version).toBe(1);
  Storage.updateAdventure(adventure.id, { contentVersion: "9.2.1" });
  for (const version of ["", "latest", "9.2", "1e3", "-1"]) {
    expect(() => Storage.exportAdventure(adventure.id, version)).toThrow();
  }
  expect(JSON.parse(Storage.exportAdventure(adventure.id)!).version).toBe("9.2.1");
  expect(Storage.getAdventureById(adventure.id)?.contentVersion).toBe("9.2.1");
});
