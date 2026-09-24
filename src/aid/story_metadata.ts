/** Read only metadata explicitly attached to the adventure currently on screen. */
export function readStoryMetadata(payload: unknown, shortId: string | null) {
  let result: { title?: string; scenarioTitle?: string } | undefined;
  if (!shortId) return result;
  const seen = new Set<object>();
  const title = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;
  function walk(node: any, depth: number) {
    if (!node || typeof node !== "object" || depth > 12 || seen.has(node)) return;
    seen.add(node);
    if (!Array.isArray(node) && String(node.shortId ?? "") === shortId) {
      const name = title(node.title);
      const scenarioTitle = title(node.scenario?.title);
      if (name || scenarioTitle) result = { ...result, ...(name ? { title: name } : {}), ...(scenarioTitle ? { scenarioTitle } : {}) };
    }
    for (const [key, value] of Object.entries(node)) {
      if (!["storyCards", "actions", "history"].includes(key)) walk(value, depth + 1);
    }
  }
  walk(payload, 0);
  return result;
}
