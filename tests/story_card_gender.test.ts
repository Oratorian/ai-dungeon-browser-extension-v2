import { expect, it } from "vitest";
import { Storage } from "@/storage";

it.each(["male", "female", "none"] as const)("preserves %s gender through export and import", gender => {
  const imported = Storage.importAdventure(JSON.stringify({ adventure: {
    id: "gender-test", name: "Test", storyCards: { card: { id: "card", name: "Character", gender } },
  } }));
  expect(imported.success).toBe(true);
  const exported = Storage.exportAdventure(imported.adventure!.id)!;
  const restored = Storage.importAdventure(exported);
  expect(restored.success).toBe(true);
  expect(Object.values(restored.adventure!.storyCards)[0]?.gender).toBe(gender);
});

it.each([undefined, "invalid", null])("defaults missing or invalid gender to None (%s)", gender => {
  const imported = Storage.importAdventure(JSON.stringify({ adventure: {
    name: "Old card set", storyCards: { card: { name: "Character", gender } },
  } }));
  expect(imported.success).toBe(true);
  expect(Object.values(imported.adventure!.storyCards)[0]?.gender).toBe("none");
});
