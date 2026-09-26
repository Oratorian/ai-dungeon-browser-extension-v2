/** Only narrate changed tails, never existing history revealed by scrolling or remounting. */
export function createStoryAutoplay(initial: string[], settleMs = 2000) {
  const normalize = (text: string) => text.replace(/\s+/gu, " ").trim();
  const known = new Set(initial.map(normalize));
  let previous = normalize(initial.at(-1) ?? "");
  let candidate = "";
  let since = 0;
  return (passages: string[], now: number, busy = false): { text: string; replace: boolean } | null => {
    const raw = passages.at(-1) ?? "";
    const latest = normalize(raw);
    if (!latest || known.has(latest)) { candidate = ""; return null; }
    if (latest !== candidate || busy) { candidate = latest; since = now; return null; }
    if (now - since < settleMs) return null;
    known.add(latest);
    if (known.size > 500) known.delete(known.values().next().value!);
    const appended = previous && latest.startsWith(previous);
    const replace = !!previous && !appended && !passages.some(text => normalize(text) === previous);
    const text = appended ? latest.slice(previous.length).trim() : raw;
    previous = latest;
    candidate = "";
    return text ? { text, replace } : null;
  };
}
