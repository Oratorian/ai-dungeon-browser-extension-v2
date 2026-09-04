import { AID_MSG, sanitizeCards, type AidCard, type AidMessage, type AidStats } from "@/aid/protocol";

// Page-world (MAIN) script. It is injected as a <script> tag by aid-inject.content.ts at
// document_start, so it patches window.fetch and window.WebSocket before AI Dungeon's own bundle
// runs. It passively reads the adventure's story cards out of AID's GraphQL traffic (the fetch
// GetGameplayAdventure response and the graphql-ws AdventureStoryCardsUpdate subscription) and
// forwards ONLY {id,type,name,triggers} to the content script via window.postMessage.
//
// Everything AID sends passes through untouched: we clone responses to read them and never alter a
// request. If AID restructures its API this simply stops finding cards; nothing breaks.

export default defineUnlistedScript(() => {
  const isGql = (u: unknown) => typeof u === "string" && /graphql/i.test(u);

  // Current adventure's captured cards, keyed by id so live edits upsert instead of replacing the
  // whole set. Kept so a late-loading content script can ask for it (see the request handler).
  let latest: { shortId: string | null; title: string | null; byId: Map<string, AidCard> } | null = null;

  // What the tap has seen this session. Posted even when no cards were found, so the diagnostics
  // report can say whether we saw no traffic, traffic without cards, or cards we failed to read.
  const stats: AidStats = { responses: 0, withStoryCards: 0, holders: 0 };

  function post() {
    const cards = latest ? [...latest.byId.values()] : [];
    // Handy manual verification hook: type `__deAidCards` in the page console.
    if (cards.length) (window as any).__deAidCards = { shortId: latest!.shortId, title: latest!.title, cards };
    window.postMessage(
      {
        source: AID_MSG.SOURCE,
        kind: AID_MSG.UPDATE,
        shortId: latest?.shortId ?? null,
        title: latest?.title ?? null,
        cards,
        stats: { ...stats },
      } as AidMessage,
      "*"
    );
  }

  // Merge a capture into the current adventure's set.
  //  - `full` = an authoritative complete list (a fetch response, which also reflects deletions):
  //    replace the set, but never with an empty list (guards against a stray query wiping a good
  //    capture).
  //  - otherwise the cards are a live WS delta and are upserted, so editing one card in AID does not
  //    wipe the rest.
  // A new shortId resets the set (the user switched adventures).
  function capture(shortId: string | null, title: string | null, cards: AidCard[], full: boolean) {
    if (!cards.length && !full) return;
    if (!latest || (shortId && shortId !== latest.shortId)) {
      latest = { shortId: shortId ?? null, title: title ?? null, byId: new Map() };
    }
    if (shortId) latest.shortId = shortId;
    if (title) latest.title = title;
    if (full) {
      if (cards.length) latest.byId = new Map(cards.map((c) => [c.id, c]));
    } else {
      for (const c of cards) latest.byId.set(c.id, c);
    }
    post();
  }

  /** The adventure shortId in the address bar, used to ignore captures for anything else. */
  const pageShortId = () => location.pathname.match(/adventure\/([^/]+)/)?.[1] ?? null;

  type Holder = { shortId: string | null; title: string | null; cards: AidCard[] };

  // Any object in a parsed GraphQL payload that carries a storyCards array, whatever the path to it.
  //
  // This used to read data.adventure.storyCards directly, and stopped finding anything the day AI
  // Dungeon's app switched from querying `adventure` to `adventureState` (both root fields exist and
  // both carry storyCards). A hardcoded path gives no signal when it stops matching, it just quietly
  // returns nothing, so match on the shape instead and survive the next rename.
  function findHolders(json: any): Holder[] {
    const holders: Holder[] = [];
    const seen = new Set<any>();

    const walk = (node: any, depth: number) => {
      if (!node || typeof node !== "object" || depth > 12 || seen.has(node)) return;
      seen.add(node);

      if (Array.isArray(node)) {
        for (const item of node) walk(item, depth + 1);
        return;
      }

      if (Array.isArray(node.storyCards)) {
        holders.push({
          shortId: node.shortId != null ? String(node.shortId) : null,
          title: typeof node.title === "string" ? node.title : null,
          cards: sanitizeCards(node.storyCards),
        });
      }

      for (const value of Object.values(node)) walk(value, depth + 1);
    };

    walk(json, 0);
    return holders;
  }

  /**
   * The holder that belongs to the adventure on screen. Scanning the whole payload can turn up cards
   * for something else (a scenario the app loaded alongside), and taking those would replace the
   * played adventure's set with a stranger's, so anything carrying a different shortId is dropped.
   */
  function pick(holders: Holder[]): Holder | null {
    const page = pageShortId();
    let best: Holder | null = null;
    for (const holder of holders) {
      if (page && holder.shortId && holder.shortId !== page) continue;
      if (!best || holder.cards.length > best.cards.length) best = holder;
    }
    return best;
  }

  function scan(json: any, full: boolean) {
    const holders = findHolders(json);
    stats.holders += holders.length;
    const holder = pick(holders);
    if (holder) capture(holder.shortId, holder.title, holder.cards, full);
  }

  // --- fetch (initial + refetched adventure loads: authoritative full sets) ---
  const _fetch = window.fetch.bind(window);
  window.fetch = function (...args: any[]) {
    const p = _fetch(...(args as [any, any]));
    try {
      const input = args[0];
      // input may be a string, a Request (has .url), or a URL (String() gives its href).
      const url = typeof input === "string" ? input : (input?.url ?? String(input ?? ""));
      if (isGql(url)) {
        p.then((r: Response) =>
          r
            .clone()
            .text()
            .then((t) => {
              stats.responses++;
              // Cheap pre-filter: only parse responses that actually carry cards, not every
              // action/streaming response during play.
              if (t.includes('"storyCards"')) {
                stats.withStoryCards++;
                try {
                  scan(JSON.parse(t), true);
                } catch {
                  /* not JSON we can use */
                }
              }
              // Post even with nothing found, so the report always has the counts.
              post();
            })
            .catch(() => {})
        ).catch(() => {});
      }
    } catch {
      /* never let interception break the real request */
    }
    return p;
  };

  // --- graphql-ws WebSocket (live card edits in AID's UI: deltas, upserted) ---
  const _WS = window.WebSocket;
  class WSProxy extends _WS {
    constructor(url: string | URL, protocols?: string | string[]) {
      super(url as any, protocols as any);
      if (isGql(String(url)) || /graphql|subscription/i.test(String(url))) {
        this.addEventListener("message", (ev: MessageEvent) => {
          let frame: any;
          try {
            frame = JSON.parse(String(ev.data));
          } catch {
            return;
          }
          if (frame?.type !== "next") return;
          // Same shape-based search as the fetch path, but upserted: a subscription frame carries the
          // cards that just changed, not the whole set.
          scan(frame?.payload?.data, false);
        });
      }
    }
  }
  window.WebSocket = WSProxy as any;

  // Replay the current set when the content script (which loads after us) asks for it.
  window.addEventListener("message", (ev) => {
    const d = ev.data;
    if (d && d.source === AID_MSG.SOURCE && d.kind === AID_MSG.REQUEST) post();
  });
});
