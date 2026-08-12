import { AID_MSG, sanitizeCards, type AidCard, type AidMessage } from "@/aid/protocol";

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

  function post() {
    if (!latest) return;
    const cards = [...latest.byId.values()];
    if (!cards.length) return;
    // Handy manual verification hook: type `__deAidCards` in the page console.
    (window as any).__deAidCards = { shortId: latest.shortId, title: latest.title, cards };
    window.postMessage(
      { source: AID_MSG.SOURCE, kind: AID_MSG.UPDATE, shortId: latest.shortId, title: latest.title, cards } as AidMessage,
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

  // Find adventure.storyCards anywhere in a parsed GraphQL response (single object or batch array).
  function scan(json: any) {
    const items = Array.isArray(json) ? json : [json];
    for (const it of items) {
      const adv =
        it?.data?.adventure ?? it?.data?.updateAdventurePlot?.adventure ?? it?.data?.updateAdventureState?.adventure;
      if (adv && Array.isArray(adv.storyCards)) {
        capture(
          adv.shortId != null ? String(adv.shortId) : null,
          typeof adv.title === "string" ? adv.title : null,
          sanitizeCards(adv.storyCards),
          true
        );
      }
    }
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
              // Cheap pre-filter: only parse responses that actually carry cards, not every
              // action/streaming response during play.
              if (t.includes('"storyCards"')) {
                try {
                  scan(JSON.parse(t));
                } catch {
                  /* not JSON we can use */
                }
              }
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
          const data = frame?.payload?.data;
          const sc = data?.adventureStoryCardsUpdate?.storyCards ?? data?.adventure?.storyCards;
          if (Array.isArray(sc)) capture(latest?.shortId ?? null, latest?.title ?? null, sanitizeCards(sc), false);
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
