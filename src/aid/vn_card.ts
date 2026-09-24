import type { AidCard } from "./protocol";
import { refreshVnCardView } from "./vn_card_view";

export const VN_CARD_MESSAGE = "de-vn-story-card";
export const VN_CARD_ENTRY = `IMPORTANT:
- This is a Visual Novel, narration and dialog must be in a structured order
- Names beside their spoken words:
<name>: "<spoken words>"
- Use this exact format for EVERY spoken utterance, including whispers, murmurs, muttering, yelling, shouting, screaming, hushing, and any other way of speaking. Never replace the name label with a speech verb or put delivery directions inside the label.
- Describe tone, volume, and delivery in separate narration on a new line. For example:
Sage: "Stay quiet."
Sage whispers a warning.
- Narration after in a new line
- Never use he or she for <name>
narration must include <name> where appropriate instead of he or she.`;

export type VnCard = AidCard & { value?: string; description?: string; isSpoiler?: boolean; isPinned?: boolean; showInStoryCards?: boolean; useForCharacterCreation?: boolean };
export function planVnCard(cards: VnCard[], shortId: string, enabled: boolean) {
  const matches = cards.filter(card => card.name === "VN Mode");
  if (matches.length > 1 || matches.some(card => card.type.toLowerCase() !== "settings")) {
    throw new Error('Resolve conflicting "VN Mode" cards in AI Dungeon before retrying.');
  }
  const card = matches[0];
  const keys = enabled ? "." : "vnoff";
  if (!card && !enabled || card?.triggers === keys) return null;
  if (card && typeof card.value !== "string") throw new Error("Waiting for the VN Mode card entry. Refresh the page before retrying.");
  if (card) return { field: "updateStoryCard", inputType: "UpdateStoryCardInput", input: {
    id: card.id, shortId, contentType: "adventure", keys, type: card.type, title: card.name,
    value: card.value, description: card.description ?? "", isSpoiler: card.isSpoiler ?? false,
    isPinned: card.isPinned ?? false, showInStoryCards: card.showInStoryCards ?? true,
    useForCharacterCreation: card.useForCharacterCreation ?? false,
  } };
  return { field: "createStoryCard", inputType: "CreateStoryCardInput", input: {
    shortId, contentType: "adventure", type: "Settings", title: "VN Mode", keys, value: VN_CARD_ENTRY,
    description: "", isSpoiler: false, isPinned: false, showInStoryCards: true,
    autoGenerate: false, useForCharacterCreation: false, instructions: "", storyInformation: "",
    temperature: 1, includeStorySummary: false,
  } };
}

/** Page-world only. Credentials stay in this closure, never in messages or storage. */
export function installVnCardWriter(fetchNative: typeof fetch, currentShortId: () => string | null, refreshView = refreshVnCardView) {
  let transport: { url: string; headers: Headers; credentials: RequestCredentials } | undefined;
  let snapshot: { shortId: string; cards: VnCard[] } | undefined;
  let serial = Promise.resolve();
  const createIds = new Map<string, string>();
  window.addEventListener("message", event => {
    const message = event.data;
    if (event.source !== window || event.origin !== location.origin || message?.source !== VN_CARD_MESSAGE
      || message.kind !== "set" || typeof message.id !== "string" || typeof message.enabled !== "boolean"
      || typeof message.shortId !== "string") return;
    serial = serial.then(async () => {
      let error: string | undefined;
      let waiting = false;
      try {
        if (currentShortId() !== message.shortId) throw new Error("The active adventure changed.");
        if (!transport || !snapshot || snapshot.shortId !== message.shortId) {
          waiting = true;
          throw new Error("Waiting for AI Dungeon to load story cards. Refresh the page if this persists.");
        }
        const plan = planVnCard(snapshot.cards, message.shortId, message.enabled);
        if (plan) {
          const input: Record<string, unknown> = { ...plan.input };
          if (plan.field === "createStoryCard") {
            // Reuse the same ID if a network interruption leaves creation uncertain.
            if (!createIds.has(message.shortId)) createIds.set(message.shortId, String(Math.floor(Math.random() * 1e9)));
            input.id = createIds.get(message.shortId);
          }
          const response = await fetchNative(transport.url, {
            method: "POST", headers: transport.headers, credentials: transport.credentials,
            signal: AbortSignal.timeout(20000),
            body: JSON.stringify({ operationName: "ExtensionVnModeCard", variables: { input },
              query: `mutation ExtensionVnModeCard($input: ${plan.inputType}!) { ${plan.field}(input: $input) { success message storyCard { id type title keys value description isSpoiler isPinned showInStoryCards useForCharacterCreation } } }` }),
          });
          const json = await response.json();
          const result = json.data?.[plan.field];
          if (!response.ok || !result?.success || !result.storyCard) throw new Error(result?.message || json.errors?.[0]?.message || "AI Dungeon could not save the VN Mode card.");
          const card = result.storyCard;
          if (snapshot && snapshot.shortId === message.shortId) snapshot.cards = [
            ...snapshot.cards.filter(value => value.id !== String(card.id)),
            { ...card, id: String(card.id), name: card.title, type: card.type, triggers: card.keys },
          ];
        }
        if (currentShortId() === message.shortId && snapshot?.cards.some(card => card.name === "VN Mode")) {
          await refreshView(message.shortId);
        }
      } catch (cause) { error = cause instanceof Error ? cause.message : String(cause); }
      window.postMessage({ source: VN_CARD_MESSAGE, kind: "result", id: message.id, error, waiting }, location.origin);
    });
  });
  return {
    observe(input: RequestInfo | URL, init?: RequestInit) {
      const url = new URL(input instanceof Request ? input.url : String(input), location.href);
      const expectedHost = location.hostname.startsWith("alpha.") ? "api-alpha.aidungeon.com"
        : location.hostname.startsWith("beta.") ? "api-beta.aidungeon.com" : "api.aidungeon.com";
      if (url.protocol !== "https:" || url.hostname !== expectedHost || url.pathname !== "/graphql") return;
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      if (!headers.has("authorization")) return;
      headers.set("content-type", "application/json");
      transport = { url: url.href, headers, credentials: init?.credentials ?? (input instanceof Request ? input.credentials : "same-origin") };
    },
    capture(shortId: string | null, skeletons: AidCard[], full: boolean, rawCards: any[] = []) {
      if (!shortId || shortId !== currentShortId()) return;
      // Only this managed card's entry stays in the page-world closure.
      const cards: VnCard[] = skeletons.map(card => {
        const raw = card.name === "VN Mode" ? rawCards.find(raw => String(raw.id) === card.id) : undefined;
        return raw ? { ...card, value: raw.value, description: raw.description, isSpoiler: raw.isSpoiler,
          isPinned: raw.isPinned, showInStoryCards: raw.showInStoryCards, useForCharacterCreation: raw.useForCharacterCreation } : card;
      });
      if (full) snapshot = { shortId, cards: [...cards] };
      else if (snapshot?.shortId === shortId) {
        const merged = new Map(snapshot.cards.map(card => [card.id, card]));
        for (const card of cards) merged.set(card.id, card);
        snapshot.cards = [...merged.values()];
      }
    },
  };
}
