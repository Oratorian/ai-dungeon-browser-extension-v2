import { expect, it } from "vitest";
import { VN_CARD_ENTRY } from "@/aid/vn_card";
import { planLynxVnStyle, VN_STYLE_START, VN_STYLE_END } from "@/services/lynxcat_vn_style";

it("adds one managed block and restores the player's exact style on exit", () => {
  const base = "  Write gently.\n\nKeep my spacing.\n";
  const enabled = planLynxVnStyle(base, true);
  expect(enabled).toContain(VN_CARD_ENTRY);
  expect(planLynxVnStyle(enabled, true)).toBe(enabled);
  expect(planLynxVnStyle(enabled, false)).toBe(base);
  expect(planLynxVnStyle(base, false)).toBe(base);
});
it("adopts the exact manually pasted template without duplicating it", () => {
  const enabled = planLynxVnStyle(VN_CARD_ENTRY + "\n\nMy style", true);
  expect(enabled.split(VN_CARD_ENTRY)).toHaveLength(2);
  expect(planLynxVnStyle(enabled, false)).toBe("My style");
});
it("keeps player changes outside the block and replaces only managed instructions", () => {
  const enabled = planLynxVnStyle("Original", true).replace("Original", "Edited while playing");
  expect(planLynxVnStyle(enabled, false)).toBe("Edited while playing");
  const revised = enabled.replace(VN_CARD_ENTRY, "Old managed instructions");
  expect(planLynxVnStyle(revised, true)).toBe(enabled);
});
it("rejects malformed markers and overflow without truncating anything", () => {
  expect(() => planLynxVnStyle(VN_STYLE_START + "broken", false)).toThrow();
  expect(() => planLynxVnStyle(VN_STYLE_END, true)).toThrow();
  expect(() => planLynxVnStyle("x".repeat(4000), true)).toThrow("no room");
  expect(planLynxVnStyle("x".repeat(4000), false)).toHaveLength(4000);
});
