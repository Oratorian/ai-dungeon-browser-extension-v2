// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { refreshVnCardView } from "@/aid/vn_card_view";

it("refreshes only the current adventure's native queries and deduplicates subscribers", async () => {
  document.body.innerHTML = '<button aria-label="Game settings"></button>';
  const query = (queryName: string, shortId: string) => ({ queryName, variables: { shortId }, refetch: vi.fn(async () => {}) });
  const current = query("GetAdventureState", "story");
  const duplicate = query("GetAdventureState", "story");
  const gameplay = query("GetGameplayAdventure", "story");
  const other = query("GetAdventure", "other");
  const unrelated = query("GetResources", "story");
  (document.querySelector("button") as any).__reactFiber$test = { return: { memoizedProps: { value: { client: {
    getObservableQueries: () => new Map([current, duplicate, gameplay, other, unrelated].map((q, i) => [i, q])),
  } } } } };
  await refreshVnCardView("story");
  expect(current.refetch).not.toHaveBeenCalled();
  expect(duplicate.refetch).toHaveBeenCalledOnce();
  expect(gameplay.refetch).toHaveBeenCalledOnce();
  expect(other.refetch).not.toHaveBeenCalled();
  expect(unrelated.refetch).not.toHaveBeenCalled();
  document.body.innerHTML = "";
  await expect(refreshVnCardView("story")).rejects.toThrow("card view could not refresh");
});
