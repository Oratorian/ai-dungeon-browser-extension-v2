// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { installVnCardWriter, VN_CARD_MESSAGE, VN_CARD_ENTRY } from "@/aid/vn_card";

it("waits for a complete capture, creates once, toggles in order and rejects stale routes", async () => {
  let route = "story";
  const requests: any[] = [];
  const fetchNative = vi.fn(async (_url, init) => {
    const body = JSON.parse(init.body);
    requests.push(body);
    const input = body.variables.input;
    const field = body.query.includes("createStoryCard(") ? "createStoryCard" : "updateStoryCard";
    return { ok: true, json: async () => ({ data: { [field]: { success: true, storyCard: {
      ...input, id: input.id, title: "VN Mode", type: "Settings", value: VN_CARD_ENTRY,
    } } } }) } as Response;
  });
  const refresh = vi.fn(async () => {});
  const writer = installVnCardWriter(fetchNative, () => route, refresh);
  writer.observe("https://api.aidungeon.com/graphql", { headers: { authorization: "test-only" } });
  async function send(enabled: boolean) {
    const id = crypto.randomUUID();
    const response = new Promise<any>(resolve => {
      const listener = (event: MessageEvent) => {
        if (event.data?.kind === "result" && event.data.id === id) {
          window.removeEventListener("message", listener); resolve(event.data);
        }
      };
      window.addEventListener("message", listener);
    });
    window.dispatchEvent(new MessageEvent("message", { source: window, origin: location.origin,
      data: { source: VN_CARD_MESSAGE, kind: "set", id, shortId: "story", enabled } }));
    return response;
  }
  expect((await send(true)).waiting).toBe(true);
  expect(fetchNative).not.toHaveBeenCalled();
  writer.capture("story", [], true);
  expect((await send(true)).error).toBeUndefined();
  expect((await send(true)).error).toBeUndefined();
  expect(requests).toHaveLength(1);
  expect((await send(false)).error).toBeUndefined();
  expect(requests[1].variables.input.keys).toBe("vnoff");
  expect(refresh).toHaveBeenLastCalledWith("story");
  expect(requests[1].variables.input.value).toBe(VN_CARD_ENTRY);
  expect(requests[1].variables.input.id).toBe(requests[0].variables.input.id);
  route = "different-story";
  expect((await send(true)).error).toContain("changed");
  expect(requests).toHaveLength(2);
});
