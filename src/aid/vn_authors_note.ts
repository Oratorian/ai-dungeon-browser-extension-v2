import { VN_CARD_ENTRY, VN_CARD_MESSAGE, planVnCard } from "./vn_card";
import { refreshVnCardView } from "./vn_card_view";

const START = "[Dungeon Extension: VN instructions]";
const END = "[/Dungeon Extension: VN instructions]";
export function planVnAuthorsNote(note: string | null, enabled: boolean): string | null {
  const text = note ?? "";
  const start = text.indexOf(START), end = text.indexOf(END);
  let base = text;
  if (start >= 0 || end >= 0) {
    if (start < 0 || end < start || text.indexOf(START, start + 1) >= 0 || text.indexOf(END, end + 1) >= 0) {
      throw new Error("The VN block in Author's Note has damaged labels. Check it before retrying.");
    }
    let tail = end + END.length;
    if (text.slice(tail, tail + 2) === "\n\n") tail += 2;
    base = text.slice(0, start) + text.slice(tail);
  }
  if (!enabled) return start < 0 ? note : base;
  const result = `${START}\n${VN_CARD_ENTRY}\n${END}\n\n${base}`;
  if (result.length > 100000) throw new Error("Author's Note has no room for VN instructions. Shorten it and retry; nothing was changed.");
  return result;
}

/** Page-world only. Read fresh notes for every toggle; credentials never leave this closure. */
export function installVnAuthorsNoteWriter(fetchNative: typeof fetch, currentShortId: () => string | null, refreshView = refreshVnCardView) {
  let transport: { url: string; headers: Headers; credentials: RequestCredentials } | undefined;
  let serial = Promise.resolve();
  async function request(query: string, variables: unknown) {
    const response = await fetchNative(transport!.url, {
      method: "POST", headers: transport!.headers, credentials: transport!.credentials,
      signal: AbortSignal.timeout(20000), body: JSON.stringify({ query, variables }),
    });
    const json = await response.json();
    if (!response.ok || json.errors?.length) throw new Error(json.errors?.[0]?.message || "AI Dungeon could not save Author's Note.");
    return json.data;
  }
  window.addEventListener("message", event => {
    const message = event.data;
    if (event.source !== window || event.origin !== location.origin || message?.source !== VN_CARD_MESSAGE
      || message.kind !== "set" || typeof message.id !== "string" || typeof message.enabled !== "boolean" || typeof message.shortId !== "string") return;
    serial = serial.then(async () => {
      let error: string | undefined, waiting = false;
      const guard = () => { if (currentShortId() !== message.shortId) throw new Error("The active adventure changed."); };
      try {
        guard();
        if (!transport) { waiting = true; throw new Error("Waiting for AI Dungeon to load. Open Plot or refresh if this persists."); }
        const data = await request(`query ExtensionVnNote($shortId: String) { adventure(shortId: $shortId) { id shortId authorsNote storyCardSnapshot { storyCards { id title type keys value description isSpoiler isPinned showInStoryCards useForCharacterCreation } } } }`, { shortId: message.shortId });
        guard();
        const adventure = data?.adventure;
        if (!adventure || adventure.shortId !== message.shortId || !(adventure.authorsNote === null || typeof adventure.authorsNote === "string")) throw new Error("AI Dungeon did not return this adventure's Author's Note.");
        const next = planVnAuthorsNote(adventure.authorsNote, message.enabled);
        const field = document.querySelector<HTMLTextAreaElement>('textarea[placeholder^="Influence the AI\'s writing style"]');
        if (field && (document.activeElement === field || field.value !== (adventure.authorsNote ?? ""))) {
          waiting = true; throw new Error("Finish editing Author's Note, then click outside it to let VN update it.");
        }
        // Retire only our exact legacy instruction card, never a player's unrelated card.
        const legacy = adventure.storyCardSnapshot?.storyCards?.filter((card: any) => card.title === "VN Mode" && card.type?.toLowerCase() === "settings" && card.value === VN_CARD_ENTRY && card.keys !== "vnoff") ?? [];
        let changed = false;
        for (const card of legacy) {
          guard();
          const plan = planVnCard([{ ...card, id: String(card.id), name: card.title, triggers: card.keys }], message.shortId, false)!;
          const saved = await request(`mutation ExtensionRetireVnCard($input: UpdateStoryCardInput!) { updateStoryCard(input: $input) { success message } }`, { input: plan.input });
          if (!saved?.updateStoryCard?.success) throw new Error(saved?.updateStoryCard?.message || "Could not disable the old VN Mode story card.");
          changed = true;
        }
        if (next !== adventure.authorsNote) {
          guard();
          const saved = await request(`mutation ExtensionVnNote($input: AdventurePlotInput) { updateAdventurePlot(input: $input) { success message adventure { id authorsNote } } }`, { input: { shortId: message.shortId, authorsNote: next } });
          if (!saved?.updateAdventurePlot?.success || saved.updateAdventurePlot.adventure?.authorsNote !== next) throw new Error(saved?.updateAdventurePlot?.message || "AI Dungeon did not save the VN instructions.");
          changed = true;
        }
        guard();
        if (changed) await refreshView(message.shortId);
      } catch (cause) { error = cause instanceof Error ? cause.message : String(cause); }
      window.postMessage({ source: VN_CARD_MESSAGE, kind: "result", id: message.id, error, waiting }, location.origin);
    });
  });
  return {
    observe(input: RequestInfo | URL, init?: RequestInit) {
      const url = new URL(input instanceof Request ? input.url : String(input), location.href);
      const host = location.hostname.startsWith("alpha.") ? "api-alpha.aidungeon.com" : location.hostname.startsWith("beta.") ? "api-beta.aidungeon.com" : "api.aidungeon.com";
      if (url.protocol !== "https:" || url.hostname !== host || url.pathname !== "/graphql") return;
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      if (!headers.has("authorization")) return;
      headers.set("content-type", "application/json");
      transport = { url: url.href, headers, credentials: init?.credentials ?? (input instanceof Request ? input.credentials : "same-origin") };
    },
  };
}
