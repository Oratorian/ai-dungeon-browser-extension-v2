import { afterEach, expect, it, vi } from "vitest";
import { get } from "svelte/store";
import { Storage } from "@/storage";
import { checkGitHubUpdates, githubUpdates, githubUpdateErrors, githubCheckedVersions, checkingGitHubUpdates, installGitHubUpdate } from "@/media/github_updates";

afterEach(() => vi.unstubAllGlobals());

it.each(["merge", "overwrite"] as const)("%s downloads the reviewed version from a commit when the branch's full response is stale", async mode => {
  Storage.adventures.set({});
  const pack = (version: string, id: string) => JSON.stringify({ version, adventure: { name: "Test Scenario", storyCards: { [id]: { id, name: id, triggers: id } } } });
  const source = { repo: "owner/repo@HEAD", path: "Scenarios/test scen.json", release: false };
  const adventure = Storage.importGitHubAdventure(pack("9.2.2", "local"), source);
  Storage.updateAdventure(adventure.id, { name: "My set", aidScenarioId: "scenario" });
  const sha = "a".repeat(40);
  const requests: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, options: RequestInit) => {
    requests.push(url);
    if (url === "https://api.github.com/repos/owner/repo/commits/HEAD") return Response.json({ sha });
    if (url === `https://raw.githubusercontent.com/owner/repo/${sha}/Scenarios/test%20scen.json`) return new Response(pack("9.3", "remote"));
    if (url.includes("/HEAD/")) {
      // Reproduces GitHub returning different revisions for Range and full requests.
      return new Response(pack(new Headers(options.headers).has("Range") ? "9.3" : "9.2.2", "remote"));
    }
    throw new Error(`Unexpected request: ${url}`);
  }));
  await checkGitHubUpdates(true);
  expect(requests).toHaveLength(1); // Routine checks still need no API request.
  const update = get(githubUpdates)[adventure.id]!;
  expect(update.version).toBe("9.3");
  const installed = await installGitHubUpdate(adventure.id, update, mode);
  expect(installed).toMatchObject({ name: "My set", aidScenarioId: "scenario", githubSource: { version: "9.3" } });
  expect(Object.keys(installed.storyCards).sort()).toEqual(mode === "merge" ? ["local", "remote"] : ["remote"]);
  expect(requests).toHaveLength(3);
  expect(get(githubUpdates)[adventure.id]).toBeUndefined();
});

it("does not install a different remote version published after the review", async () => {
  Storage.adventures.set({});
  const pack = (version: string) => JSON.stringify({ version, adventure: { name: "Pack", storyCards: {} } });
  const adventure = Storage.importGitHubAdventure(pack("9.2.2"), { repo: "owner/repo@feature/cards", path: "pack.json", release: false });
  const sha = "b".repeat(40);
  vi.stubGlobal("fetch", vi.fn(async (url: string, options: RequestInit) => {
    if (url === "https://api.github.com/repos/owner/repo/commits/feature%2Fcards") return Response.json({ sha });
    return new Response(pack(new Headers(options.headers).has("Range") ? "9.3" : "9.4"));
  }));
  await checkGitHubUpdates(true);
  const before = Storage.getAdventureById(adventure.id);
  await expect(installGitHubUpdate(adventure.id, get(githubUpdates)[adventure.id]!, "overwrite")).rejects.toThrow("remote version changed");
  expect(Storage.getAdventureById(adventure.id)).toBe(before);
});

it("checks a saved file on first open and on manual refresh without the importer or GitHub API", async () => {
  Storage.adventures.set({});
  const adventure = Storage.importGitHubAdventure(
    JSON.stringify({ version: 7, adventure: { name: "Test Scenario", storyCards: {} } }),
    { repo: "oratorian/dexv2res-repo@HEAD", path: "Scenarios/test_scen.json", release: false },
  );
  let version = 8;
  const requests: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, options: RequestInit) => {
    requests.push(url);
    expect(url).toContain("https://raw.githubusercontent.com/oratorian/dexv2res-repo/HEAD/Scenarios/test_scen.json?");
    expect(options.headers).toMatchObject({ Range: "bytes=0-16383" });
    return new Response(JSON.stringify({ version, adventure: { name: "Test Scenario", storyCards: {} } }));
  }));
  await checkGitHubUpdates();
  expect(get(githubUpdates)[adventure.id]?.version).toBe("8");
  version = 9;
  await checkGitHubUpdates(true);
  expect(get(githubUpdates)[adventure.id]?.version).toBe("9");
  expect(get(githubCheckedVersions)[adventure.id]?.version).toBe("9");
  expect(requests).toHaveLength(2);
  expect(requests[0]).not.toBe(requests[1]);
  expect(get(githubUpdateErrors)[adventure.id]).toBeUndefined();
  expect(get(checkingGitHubUpdates)).toBe(false);
});

it("shows network failures and allows a manual retry to recover", async () => {
  Storage.adventures.set({});
  const adventure = Storage.importGitHubAdventure(
    JSON.stringify({ version: 1, adventure: { name: "Retry", storyCards: {} } }),
    { repo: "owner/repo@main", path: "retry.json", release: false },
  );
  const fetchMock = vi.fn().mockRejectedValueOnce(new Error("Network unavailable"));
  vi.stubGlobal("fetch", fetchMock);
  await checkGitHubUpdates(true);
  expect(get(githubUpdateErrors)[adventure.id]).toBe("Network unavailable");
  expect(get(checkingGitHubUpdates)).toBe(false);
  fetchMock.mockResolvedValue(new Response('{"version":2,"adventure":{"name":"Retry"}}'));
  await checkGitHubUpdates(true);
  expect(get(githubUpdates)[adventure.id]?.version).toBe("2");
  expect(get(githubUpdateErrors)[adventure.id]).toBeUndefined();
});
