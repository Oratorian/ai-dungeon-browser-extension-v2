// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { planVnAuthorsNote, installVnAuthorsNoteWriter } from "@/aid/vn_authors_note";
import { VN_CARD_ENTRY, VN_CARD_MESSAGE } from "@/aid/vn_card";

it("preserves notes, creates missing notes, and removes only its marked block", () => {
  for (const original of [null, "", "  My own note.\n\nKeep formatting.\n"]) {
    expect(planVnAuthorsNote(original, false)).toBe(original);
    const enabled = planVnAuthorsNote(original, true)!;
    expect(enabled).toContain(VN_CARD_ENTRY);
    expect(planVnAuthorsNote(enabled, true)).toBe(enabled);
    expect(planVnAuthorsNote(enabled, false)).toBe(original ?? "");
  }
  const edited = planVnAuthorsNote("Original", true)!.replace("Original", "My edit");
  expect(planVnAuthorsNote(edited, false)).toBe("My edit");
  expect(() => planVnAuthorsNote('[Dungeon Extension: VN instructions]broken', false)).toThrow();
});
it("reads fresh notes, saves only authorsNote, retires old cards and rejects stale routes", async () => {
  let route = "story", note: string | null = null;
  let legacy = { id: "card", title: "VN Mode", type: "Settings", keys: ".", value: VN_CARD_ENTRY };
  const requests: any[] = [];
  const native = vi.fn(async (_url, init) => {
    const body = JSON.parse(init.body); requests.push(body);
    const input = body.variables.input;
    let data;
    if (!input) data = { adventure: { id: "1", shortId: route, authorsNote: note, storyCardSnapshot: { storyCards: [legacy] } } };
    else if (body.query.includes('updateStoryCard')) { legacy = { ...legacy, keys: input.keys }; data = { updateStoryCard: { success: true } }; }
    else { note = input.authorsNote; data = { updateAdventurePlot: { success: true, adventure: { authorsNote: note } } }; }
    return { ok: true, json: async () => ({ data }) } as Response;
  });
  const refresh = vi.fn(async () => {});
  const writer = installVnAuthorsNoteWriter(native, () => route, refresh);
  writer.observe("https://api.aidungeon.com/graphql", { headers: { authorization: "test-only" } });
  const send = (enabled: boolean) => new Promise<any>(resolve => {
    const id = crypto.randomUUID();
    const listener = (event: MessageEvent) => { if (event.data?.kind === "result" && event.data.id === id) { window.removeEventListener("message", listener); resolve(event.data); } };
    window.addEventListener("message", listener);
    window.dispatchEvent(new MessageEvent("message", { source: window, origin: location.origin, data: { source: VN_CARD_MESSAGE, kind: "set", id, shortId: "story", enabled } }));
  });
  expect((await send(true)).error).toBeUndefined();
  expect(legacy.keys).toBe("vnoff");
  expect(note).toContain(VN_CARD_ENTRY);
  expect(requests.find(r => r.query.includes('updateAdventurePlot')).variables.input).toEqual({ shortId: "story", authorsNote: note });
  const count = requests.filter(r => r.variables.input).length;
  await send(true);
  expect(requests.filter(r => r.variables.input)).toHaveLength(count);
  note = `${note ?? ""}New player note`;
  expect((await send(false)).error).toBeUndefined();
  expect(note).toBe("New player note");
  expect(refresh).toHaveBeenCalledWith("story");
  route = "other";
  expect((await send(true)).error).toContain("changed");
  expect(requests.every(r => !r.query.includes('createStoryCard'))).toBe(true);
});
