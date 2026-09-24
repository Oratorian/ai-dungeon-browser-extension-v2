import { AID_MSG, sanitizeCards, type AidCard, type AidMessage, type AidStats } from "@/aid/protocol";
import { installVnCardWriter } from "@/aid/vn_card";
import { readStoryMetadata } from "@/aid/story_metadata";

// Page-world (MAIN) script. It is injected as a <script> tag by aid-inject.content.ts at
// document_start, so it patches window.fetch and window.WebSocket before AI Dungeon's own bundle
// runs. It passively reads the adventure's story cards out of AID's GraphQL traffic (the fetch
// GetGameplayAdventure response and the graphql-ws AdventureStoryCardsUpdate subscription) and
// forwards ONLY {id,type,name,triggers} to the content script via window.postMessage.
//
// Everything AID sends passes through untouched: we clone responses to read them and never alter a
// request. The separate VN card writer only issues the explicitly requested mode-card updates.

export default defineUnlistedScript(() => {
  const isGql = (u: unknown) => typeof u === "string" && /graphql/i.test(u);

  // Current adventure's captured cards, keyed by id so live edits upsert instead of replacing the
  // whole set. Kept so a late-loading content script can ask for it (see the request handler).
  let latest: {
    shortId: string | null;
    scenarioId: string | null;
    title: string | null;
    scenarioTitle: string | null;
    byId: Map<string, AidCard>;
  } | null = null;

  // What the tap has seen this session. Posted even when no cards were found, so the diagnostics
  // report can say whether we saw no traffic, traffic without cards, or cards we failed to read.
  const stats: AidStats = { responses: 0, withStoryCards: 0, holders: 0 };

  function post() {
    const cards = latest ? [...latest.byId.values()] : [];
    // Handy manual verification hook: type `__deAidCards` in the page console.
    if (cards.length) {
      (window as any).__deAidCards = {
        shortId: latest!.shortId,
        scenarioId: latest!.scenarioId,
        title: latest!.title,
        scenarioTitle: latest!.scenarioTitle,
        cards,
      };
    }
    window.postMessage(
      {
        source: AID_MSG.SOURCE,
        kind: AID_MSG.UPDATE,
        shortId: latest?.shortId ?? null,
        scenarioId: latest?.scenarioId ?? null,
        title: latest?.title ?? null,
        scenarioTitle: latest?.scenarioTitle ?? null,
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
  function capture(holder: Holder, full: boolean) {
    const { shortId, scenarioId, title, scenarioTitle, cards } = holder;
    vnWriter.capture(shortId, cards, full, holder.rawCards);
    if (!cards.length && !full) return;
    if (!latest || (shortId && shortId !== latest.shortId)) {
      latest = { shortId: shortId ?? null, scenarioId: null, title: title ?? null, scenarioTitle: null, byId: new Map() };
    }
    if (shortId) latest.shortId = shortId;
    if (scenarioId) latest.scenarioId = scenarioId;
    if (title) latest.title = title;
    if (scenarioTitle) latest.scenarioTitle = scenarioTitle;
    if (full) {
      if (cards.length) latest.byId = new Map(cards.map((c) => [c.id, c]));
    } else {
      for (const c of cards) latest.byId.set(c.id, c);
    }
    post();
  }

  /** The adventure shortId in the address bar, used to ignore captures for anything else. */
  const pageShortId = () => location.pathname.match(/adventure\/([^/]+)/)?.[1] ?? null;

  type Holder = { shortId: string | null; scenarioId: string | null; title: string | null; scenarioTitle: string | null; cards: AidCard[]; rawCards: any[] };

  /**
   * The scenario an adventure object says it came from. AI Dungeon's Adventure type carries a plain
   * `scenarioId`; some queries ask for the nested `scenario` instead, whose own id is the same
   * number. Either is read, the plain field first so one adventure always yields the same value.
   */
  function scenarioIdOf(node: any): string | null {
    if (node.scenarioId != null && node.scenarioId !== "") return String(node.scenarioId);
    const nested = node.scenario;
    if (nested && typeof nested === "object") {
      if (nested.id != null && nested.id !== "") return String(nested.id);
      if (nested.shortId != null && nested.shortId !== "") return String(nested.shortId);
    }
    return null;
  }

  // Any object in a parsed GraphQL payload that carries a storyCards array, whatever the path to it.
  //
  // This used to read data.adventure.storyCards directly, and stopped finding anything the day AI
  // Dungeon's app switched from querying `adventure` to `adventureState` (both root fields exist and
  // both carry storyCards). A hardcoded path gives no signal when it stops matching, it just quietly
  // returns nothing, so match on the shape instead and survive the next rename.
  function findHolders(json: any): Holder[] {
    const holders: Holder[] = [];
    const seen = new Set<any>();

    // shortId/scenarioId/title are carried down from enclosing objects: whichever object holds
    // storyCards need not be the one naming the adventure, so a holder inherits the nearest one
    // that does.
    const walk = (
      node: any,
      depth: number,
      shortId: string | null,
      scenarioId: string | null,
      title: string | null,
      scenarioTitle: string | null
    ) => {
      if (!node || typeof node !== "object" || depth > 12 || seen.has(node)) return;
      seen.add(node);

      if (Array.isArray(node)) {
        for (const item of node) walk(item, depth + 1, shortId, scenarioId, title, scenarioTitle);
        return;
      }

      const id = node.shortId != null ? String(node.shortId) : shortId;
      const scenario = scenarioIdOf(node) ?? scenarioId;
      const name = typeof node.title === "string" && node.title.trim() ? node.title : title;
      const scenarioName = typeof node.scenario?.title === "string" && node.scenario.title.trim()
        ? node.scenario.title.trim() : scenarioTitle;

      if (Array.isArray(node.storyCards)) {
        holders.push({ shortId: id, scenarioId: scenario, title: name, scenarioTitle: scenarioName, cards: sanitizeCards(node.storyCards), rawCards: node.storyCards });
      }

      for (const [key, value] of Object.entries(node)) {
        // Never descend into the cards themselves: a story card has its own `title`, which would
        // otherwise be inherited as if it were the adventure's name.
        if (key === "storyCards") continue;
        walk(value, depth + 1, id, scenario, name, scenarioName);
      }
    };

    walk(json, 0, null, null, null, null);
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
    if (holder) capture(holder, full);
    // Metadata is often loaded in a separate query with no storyCards field.
    const shortId = pageShortId();
    const metadata = readStoryMetadata(json, shortId);
    if (metadata) {
      if (!latest || latest.shortId !== shortId) {
        latest = { shortId, scenarioId: null, title: null, scenarioTitle: null, byId: new Map() };
      }
      Object.assign(latest, metadata);
      post();
    }
  }

  // --- fetch (initial + refetched adventure loads: authoritative full sets) ---
  const _fetch = window.fetch.bind(window);
  const vnWriter = installVnCardWriter(_fetch, pageShortId);
  window.fetch = function (...args: any[]) {
    const p = _fetch(...(args as [any, any]));
    try {
      const input = args[0];
      // input may be a string, a Request (has .url), or a URL (String() gives its href).
      const url = typeof input === "string" ? input : (input?.url ?? String(input ?? ""));
      if (isGql(url)) {
        vnWriter.observe(input, args[1]);
        p.then((r: Response) =>
          r
            .clone()
            .text()
            .then((t) => {
              stats.responses++;
              if (t.includes('"storyCards"')) stats.withStoryCards++;
              // Include title-only responses rather than tying names to card loading.
              if (t.includes('"storyCards"') || t.includes('"title"')) {
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
