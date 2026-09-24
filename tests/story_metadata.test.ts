import { expect, it } from "vitest";
import { readStoryMetadata } from "@/aid/story_metadata";

it("reads scenario and adventure names without story cards", () => {
  // Shape captured from AI Dungeon's batched GetAdventure response.
  expect(readStoryMetadata([{ data: { adventure: { shortId: "active", title: "addon_test", scenario: { id: "scenario-id", shortId: "scenario-short-id", title: "The Dragon Cafe" } } } }], "active"))
    .toEqual({ title: "addon_test", scenarioTitle: "The Dragon Cafe" });
});
it("ignores unrelated adventures and story-card titles", () => {
  expect(readStoryMetadata({ data: { adventure: { shortId: "other", title: "Wrong", storyCards: [{ shortId: "active", title: "Card" }] } } }, "active"))
    .toBeUndefined();
});
it("keeps supplied names when another matching object omits them", () => {
  expect(readStoryMetadata([{ shortId: "active", scenario: { title: "Scenario" } }, { shortId: "active", title: "Run" }], "active"))
    .toEqual({ title: "Run", scenarioTitle: "Scenario" });
  expect(readStoryMetadata({ shortId: "active", title: "Run" }, null)).toBeUndefined();
});
