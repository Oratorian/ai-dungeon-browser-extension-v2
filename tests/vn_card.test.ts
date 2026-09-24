import { describe, expect, it } from "vitest";
import { planVnCard, VN_CARD_ENTRY } from "@/aid/vn_card";

const card = { id: "123", name: "VN Mode", type: "Settings", triggers: "vnoff", value: "User-edited instructions", description: "Keep these notes" };
describe("native VN mode card", () => {
  it("creates the requested card only when enabled", () => {
    expect(planVnCard([], "story", false)).toBeNull();
    expect(planVnCard([], "story", true)?.input).toMatchObject({
      title: "VN Mode", type: "Settings", keys: ".", value: VN_CARD_ENTRY, shortId: "story", autoGenerate: false,
    });
  });
  it("reuses an existing card and preserves its content when switching triggers", () => {
    expect(planVnCard([card], "story", true)?.input).toMatchObject({ id: "123", shortId: "story", contentType: "adventure", keys: ".", value: card.value, description: card.description });
    expect(planVnCard([{ ...card, triggers: "." }], "story", false)?.input.keys).toBe("vnoff");
    expect(planVnCard([card], "story", false)).toBeNull();
  });
  it("refuses ambiguous cards instead of overwriting an unrelated card", () => {
    expect(() => planVnCard([card, { ...card, id: "456" }], "story", true)).toThrow();
    expect(() => planVnCard([{ ...card, type: "character" }], "story", true)).toThrow();
  });
});
