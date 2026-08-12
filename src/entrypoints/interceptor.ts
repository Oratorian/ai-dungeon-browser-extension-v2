import { AID_MSG, sanitizeCards, type AidCard, type AidMessage } from "@/utils/aid_protocol";

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

  // Last capture, kept so a late-loading content script can ask for it (see the request handler).
  let latest: { shortId: string | null; title: string | null; cards: AidCard[] } | null = null;

  function emit(shortId: string | null, title: string | null, cards: AidCard[]) {
    if (!cards.length) return;
    latest = { shortId, title, cards };
    // Handy manual verification hook: type `__deAidCards` in the page console.
    (window as any).__deAidCards = latest;
    window.postMessage({ source: AID_MSG.SOURCE, kind: AID_MSG.UPDATE, shortId, title, cards } as AidMessage, "*");
  }

  // Find adventure.storyCards anywhere in a parsed GraphQL response (single object or batch array).
  function scan(json: any) {
    const items = Array.isArray(json) ? json : [json];
    for (const it of items) {
      const adv =
        it?.data?.adventure ?? it?.data?.updateAdventurePlot?.adventure ?? it?.data?.updateAdventureState?.adventure;
      if (adv && Array.isArray(adv.storyCards)) {
        emit(
          adv.shortId != null ? String(adv.shortId) : null,
          typeof adv.title === "string" ? adv.title : null,
          sanitizeCards(adv.storyCards)
        );
      }
    }
  }

  // --- fetch (initial + refetched adventure loads) ---
  const _fetch = window.fetch.bind(window);
  window.fetch = function (...args: any[]) {
    const p = _fetch(...(args as [any, any]));
    try {
      const input = args[0];
      const url = typeof input === "string" ? input : input?.url;
      if (isGql(url)) p.then((r: Response) => r.clone().json().then(scan).catch(() => {})).catch(() => {});
    } catch {
      /* never let interception break the real request */
    }
    return p;
  };

  // --- graphql-ws WebSocket (live card edits in AID's UI) ---
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
          if (Array.isArray(sc)) emit(latest?.shortId ?? null, latest?.title ?? null, sanitizeCards(sc));
        });
      }
    }
  }
  window.WebSocket = WSProxy as any;

  // Replay the last capture when the content script (which loads after us) asks for it.
  window.addEventListener("message", (ev) => {
    const d = ev.data;
    if (d && d.source === AID_MSG.SOURCE && d.kind === AID_MSG.REQUEST && latest) {
      window.postMessage({ source: AID_MSG.SOURCE, kind: AID_MSG.UPDATE, ...latest } as AidMessage, "*");
    }
  });
});
