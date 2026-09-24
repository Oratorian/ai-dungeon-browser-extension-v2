/** Refresh AI Dungeon's own observable queries after a native card save.
 * A fetch mutation alone does not update its Apollo cache or open card editor. */
export async function refreshVnCardView(shortId: string) {
  const anchor = document.querySelector('[aria-label="Game settings"]') ?? document.querySelector('[aria-label="Story"]');
  const fiberKey = anchor && Object.keys(anchor).find(key => key.startsWith("__reactFiber$"));
  let fiber = anchor && fiberKey ? (anchor as any)[fiberKey] : null;
  for (let depth = 0; fiber && depth < 150; depth++, fiber = fiber.return) {
    const client = fiber.memoizedProps?.value?.client;
    if (typeof client?.getObservableQueries !== "function") continue;
    const names = new Set(["GetGameplayAdventure", "GetAdventure", "GetAdventureState"]);
    const queries = new Map<string, any>();
    for (const query of client.getObservableQueries("active").values()) {
      if (names.has(query.queryName) && query.variables?.shortId === shortId) {
        queries.set(JSON.stringify([query.queryName, query.variables]), query);
      }
    }
    if (!queries.size) break;
    await Promise.all([...queries.values()].map(query => query.refetch()));
    return;
  }
  throw new Error("The VN Mode card was saved, but AI Dungeon's card view could not refresh. Retry or refresh the page.");
}
