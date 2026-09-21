import { afterEach, expect, it, vi } from "vitest";
import { get } from "svelte/store";
import { Storage } from "@/storage";
import { checkGitHubUpdates, githubUpdates, githubUpdateErrors, githubCheckedVersions, checkingGitHubUpdates } from "@/media/github_updates";

afterEach(() => vi.unstubAllGlobals());

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
