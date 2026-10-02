import { expect, it } from "vitest";
import { Storage } from "@/storage";
import { portraitId, remapGraphicVariants } from "@/shared/portrait_variants";

it("keeps rules with their picture when removing or reordering graphics", () => {
  const rules = [{ name: "Original", triggers: "casual clothes" }, { name: "Armor", triggers: "wearing armor" }];
  expect(remapGraphicVariants(["a", "b"], ["b", "new", "a"], rules)).toEqual([
    rules[1], { name: "", triggers: "" }, rules[0],
  ]);
  expect(portraitId("b")).not.toBe(portraitId("a"));
});

it("round trips picture rules through card-set export and import, and reads old sets", () => {
  const result = Storage.importAdventure(JSON.stringify({ adventure: { name: "Variants", storyCards: {
    worf: { name: "Worf", graphics: ["a", "b"], graphicVariants: [null, { name: "Red shirt", triggers: "red shirt" }] },
  } } }));
  expect(result.success).toBe(true);
  const restored = Storage.importAdventure(Storage.exportAdventure(result.adventure!.id)!);
  const card = Object.values(restored.adventure!.storyCards)[0];
  expect(card?.graphicVariants).toEqual([{ name: "", triggers: "" }, { name: "Red shirt", triggers: "red shirt" }]);
  expect(remapGraphicVariants(["a"], ["a", "b"], undefined)).toEqual([{ name: "", triggers: "" }, { name: "", triggers: "" }]);
});
