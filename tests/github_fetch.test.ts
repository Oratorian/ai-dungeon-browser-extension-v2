import { afterEach, expect, it, vi } from "vitest";
import { listJsonFiles, fetchContentVersion, fetchFileText } from "@/media/github";

afterEach(() => vi.unstubAllGlobals());

it("uses different download URLs for changed blobs and bypasses browser caching", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const parsed = { owner: "owner", repo: "repo", branch: "main", subpath: "packs", label: "owner/repo" };
  const tree = (sha: string) => new Response(JSON.stringify({ tree: [{ path: "packs/pack.json", type: "blob", sha, size: 100 }] }));
  fetchMock.mockResolvedValueOnce(tree("old-sha"));
  const first = (await listJsonFiles(parsed)).files[0]!;
  fetchMock.mockResolvedValueOnce(tree("new-sha"));
  const next = (await listJsonFiles(parsed)).files[0]!;
  expect(first.rawUrl).not.toBe(next.rawUrl);
  expect(next.rawUrl).toContain("dext_revision=new-sha");
  fetchMock.mockResolvedValueOnce(new Response('{"version":3,"adventure":{"name":"Pack"}}'));
  expect(await fetchContentVersion(next)).toBe("3");
  fetchMock.mockResolvedValueOnce(new Response('{"version":3,"adventure":{"name":"Pack"}}'));
  expect(JSON.parse(await fetchFileText(next)).version).toBe(3);
  for (const call of fetchMock.mock.calls) expect(call[1]).toMatchObject({ cache: "no-store" });
});
