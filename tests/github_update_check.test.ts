import { expect, it, vi } from "vitest";
import { get } from "svelte/store";
import { Storage } from "@/storage";
import { checkGitHubUpdates, githubUpdates, installGitHubUpdate } from "@/media/github_updates";
import { listJsonFiles, fetchContentVersion, fetchFileText } from "@/media/github";

vi.mock("@/media/github", async importOriginal => ({
  ...await importOriginal<typeof import("@/media/github")>(),
  listJsonFiles: vi.fn(), fetchContentVersion: vi.fn(), fetchFileText: vi.fn(),
}));

it("checks only GitHub imports, shares listings, caches menu checks and applies only approved updates", async () => {
  Storage.adventures.set({});
  const pack = (version: number) => JSON.stringify({ version, adventure: { name: "Pack", storyCards: {} } });
  const first = Storage.importGitHubAdventure(pack(1), { repo: "owner/repo@HEAD", path: "first.json", release: false });
  const second = Storage.importGitHubAdventure(pack(1), { repo: "owner/repo@HEAD", path: "second.json", release: false });
  const local = Storage.importAdventure(pack(1)).adventure!;
  vi.mocked(listJsonFiles).mockResolvedValue({ truncated: false, files: ["first.json", "second.json"].map(path => ({ path, filename: path, size: 1, release: false, rawUrl: `https://raw.githubusercontent.com/owner/repo/main/${path}` })) });
  vi.mocked(fetchContentVersion).mockResolvedValue("2");
  await Promise.all([checkGitHubUpdates(), checkGitHubUpdates()]);
  expect(listJsonFiles).toHaveBeenCalledTimes(1);
  expect(fetchContentVersion).toHaveBeenCalledTimes(2);
  expect(get(githubUpdates)[local.id]).toBeUndefined();
  expect(get(githubUpdates)[second.id]?.version).toBe("2");
  expect(Storage.getAdventureById(first.id)?.githubSource?.version).toBe("1");
  await checkGitHubUpdates();
  expect(fetchContentVersion).toHaveBeenCalledTimes(2);
  vi.mocked(fetchFileText).mockResolvedValue(pack(2));
  await installGitHubUpdate(first.id, get(githubUpdates)[first.id]!, "merge");
  expect(Storage.getAdventureById(first.id)?.githubSource?.version).toBe("2");
  expect(get(githubUpdates)[first.id]).toBeUndefined();
  vi.mocked(fetchFileText).mockResolvedValue(pack(3));
  await expect(installGitHubUpdate(second.id, get(githubUpdates)[second.id]!, "overwrite")).rejects.toThrow("remote version changed");
  expect(Storage.getAdventureById(second.id)?.githubSource?.version).toBe("1");
});
