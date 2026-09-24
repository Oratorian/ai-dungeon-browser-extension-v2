import { FLOATING_BUTTON_DEFAULT_SIZE } from "@/shared/floating_button";
import type { Adventure, AudioClip, StoryCard } from "@/shared/types";
import { get, writable, type Writable } from "svelte/store";
import { OPENROUTER_DEFAULT_MODEL } from "@/media/openrouter";
import { planAidSync, type IncomingCard } from "@/aid/sync";
import { readAdventures, diffAdventures, adventureKey, LEGACY_ADVENTURES_KEY } from "@/storage/persist";
import { Debug } from "@/shared/debug";
import { untrack } from "svelte";
import { contentVersion, normalizeGitHubSource, newerVersion, applyGitHubUpdate } from "./github_updates";
import { MENTION_CARD_TYPES } from "@/aid/mentions";

const defaultSettings = {
  iconSize: 28,
  iconRoundness: 0,
  iconThickness: 1,
  iconColor: "#f8ae2c",
  textColor: "#000000",

  customTextColor: false,

  highlightBold: false,
  highlightLookback: 0,
  highlightMarkdown: true,
  highlightFocus: false,

  tooltipWidth: 512,
  tooltipHeight: 512,
  tooltipDelay: 200,

  focusHeight: 384,

  // Card presentation on the Adventure tab. The tilt and the cursor-following sheen are the same
  // effect the cards have always had; these just make them adjustable, and switchable off for anyone
  // who finds the movement distracting or is running on a weak GPU.
  cardTiltAngle: 15,
  cardShine: true,

  // Re-encoding limits for images stored inline in a card (see media/compress.ts). Icons render in a
  // small square box and graphics in a tooltip, so neither needs the full resolution of a photo
  // straight off a phone.
  compressionQuality: 85,
  compressionResolutionIcon: 256,
  compressionResolutionGraphic: 768,
  // Re-encode images the moment they are uploaded from a device, so a full-resolution photo never
  // reaches storage in the first place. The cleanup pass then only matters for older images.
  compressOnUpload: true,

  volume: 100,
  // Loop crossfade in milliseconds: how much the next pass overlaps the previous one to hide a
  // clip's fade-out tail at the seam. 0 = plain gapless native loop. See AudioManager.
  audioCrossfade: 1500,

  // Floating quick-access button: a draggable puck that opens the editor without going through
  // AI Dungeon's top menu. It lives in our own shadow root rather than AID's action bar, which
  // other extensions also inject into. The position is the viewport coordinate of its top-left
  // corner; -1 means "never moved", so it parks itself in the bottom-right corner.
  floatingButtonX: -1,
  floatingButtonY: -1,
  // Hovering the button fans out one shortcut per editor tab.
  floatingButtonQuickActions: true,
  floatingButtonCompactLayout: false,
  // Key combination that shows/hides the button while playing (see shared/hotkey.ts); "" = none.
  floatingButtonHotkey: "Ctrl+Shift+F",
  // Drawn size in px, within FLOATING_BUTTON_MIN_SIZE..MAX_SIZE.
  floatingButtonSize: FLOATING_BUTTON_DEFAULT_SIZE,
  // Suggest API story-card names when typing @ in AI Dungeon's action textbox.
  storyCardAutocomplete: true,
  visualNovelMode: false,
  novelTtsEnabled: false,
  novelTtsAccelerated: false,
  novelTtsThreads: 2,
  novelTtsVoice: "M5" as "M5" | "F5",
  novelTtsSteps: 5,
  novelTtsPitch: 0,
  novelTtsQueue: 3,
  storyCardAutocompleteTypes: MENTION_CARD_TYPES.map(type => type.value),

  trinetraApiKey: "",
  // Where the Trinetra picker was last, so the next card opens in the same folder instead of at
  // the root. null is the root.
  trinetraLastFolderId: null as number | null,

  // Image generation through OpenRouter (media/openrouter.ts). The key is the user's own and pays for
  // their own generations. `imageGenUpload` chooses where a result lands: true uploads it to Trinetra
  // and stores only the link, false compresses it into the card like any other local image.
  imageGenProvider: "openrouter" as import("@/media/image_gen").ImageGenProvider,
  imageGenRatio: "1:1",
  imageGenUpload: false,

  // OpenRouter: one call returns the image. Model default matches upstream's stored default rather
  // than the -preview alias, which is the sort of thing that gets retired and breaks first run.
  imageGenKey: "",
  imageGenModel: OPENROUTER_DEFAULT_MODEL,

  // Civitai: asynchronous, priced in Buzz, and addressed by AIR rather than a plain model name.
  civitaiKey: "",
  civitaiModel: "urn:air:sdxl:checkpoint:civitai:101055@128078",
  civitaiNegativePrompt: "blurry, watermark, text, lowres",
  // Used when a model publishes no sample metadata to copy. Civitai exposes no "beta" noise schedule,
  // only plain and Karras variants, so Euler a is as close as its API allows.
  civitaiSteps: 30,
  civitaiCfgScale: 5,
  civitaiScheduler: "eulerA",
  // GitHub repos to browse for shared adventure/scenario exports in the import dialog. Each entry
  // is a "owner/repo" or a github.com URL (optionally a /tree/<branch>/<subpath> URL). See github.ts.
  scenarioRepos: [] as string[],
};

export type Settings = typeof defaultSettings;

function ensureArray(value: unknown): string[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value) as string[];
  return [];
}

function normalizeLegacyStoryCard(card: Record<string, unknown>): StoryCard {
  const triggers = Array.isArray(card.triggers) ? card.triggers.join(", ") : "";
  const icons = Array.isArray(card.icons)
    ? card.icons
        .map((i: unknown) => (typeof i === "object" && i !== null && "url" in i ? (i as { url: string }).url : ""))
        .filter(Boolean)
    : [];
  const graphics = Array.isArray(card.graphics)
    ? card.graphics
        .map((g: unknown) => (typeof g === "object" && g !== null && "url" in g ? (g as { url: string }).url : ""))
        .filter(Boolean)
    : [];

  const colorMode = typeof card.colorMode === "string" ? card.colorMode : "shared";
  const restriction = typeof card.restriction === "string" ? card.restriction : "unrestricted";

  let limit = "none";
  if (restriction === "story_only") limit = "story_only";
  else if (restriction === "action_only") limit = "action_only";

  return {
    id: crypto.randomUUID(),
    name: typeof card.name === "string" ? card.name : "Untitled Card",
    triggers,
    type: typeof card.category === "string" ? card.category : "character",
    icons,
    iconIndex: 0,
    graphics,
    graphicIndex: 0,
    useCustomColor: colorMode === "custom",
    color: typeof card.color === "string" ? card.color : "#f8ae2c",
    limit,
    preset: "default",
    audioClips: [],
  };
}

function isLegacyFormat(data: unknown): data is Record<string, unknown>[] {
  return Array.isArray(data) && data.length > 0 && typeof data[0] === "object" && data[0] !== null && "category" in data[0];
}

function normalizeStoryCard(card: unknown): StoryCard | null {
  if (!card || typeof card !== "object") return null;
  const c = card as Record<string, unknown>;
  return {
    id: typeof c.id === "string" ? c.id : crypto.randomUUID(),
    name: typeof c.name === "string" ? c.name : "Untitled Card",
    triggers: typeof c.triggers === "string" ? c.triggers : "",
    type: typeof c.type === "string" ? c.type : "character",
    icons: ensureArray(c.icons),
    iconIndex: typeof c.iconIndex === "number" ? c.iconIndex : 0,
    graphics: ensureArray(c.graphics),
    graphicIndex: typeof c.graphicIndex === "number" ? c.graphicIndex : 0,
    useCustomColor: typeof c.useCustomColor === "boolean" ? c.useCustomColor : false,
    color: typeof c.color === "string" ? c.color : "#f8ae2c",
    limit: typeof c.limit === "string" ? c.limit : "none",
    preset: typeof c.preset === "string" ? c.preset : "default",
    audioClips: ensureArray(c.audioClips),
    aidId: typeof c.aidId === "string" ? c.aidId : undefined,
  };
}

function normalizeAdventure(adventure: unknown): Adventure | null {
  if (!adventure || typeof adventure !== "object") return null;
  const a = adventure as Record<string, unknown>;

  const storyCards: Record<string, StoryCard> = {};
  if (a.storyCards && typeof a.storyCards === "object") {
    for (const [key, value] of Object.entries(a.storyCards as Record<string, unknown>)) {
      const normalized = normalizeStoryCard(value);
      if (normalized) {
        storyCards[key] = normalized;
      }
    }
  }

  return {
    id: typeof a.id === "string" ? a.id : crypto.randomUUID(),
    name: typeof a.name === "string" ? a.name : "Untitled Adventure",
    createdAt: typeof a.createdAt === "number" ? a.createdAt : Date.now(),
    storyCards,
    // Preserve the played-adventure link across reloads (dropping it here made the binding vanish
    // on every F5, so the "Stamp" button kept reappearing).
    aidShortId: typeof a.aidShortId === "string" ? a.aidShortId : undefined,
    aidScenarioId: typeof a.aidScenarioId === "string" ? a.aidScenarioId : undefined,
    contentVersion: contentVersion(a.contentVersion) ?? undefined,
    githubSource: normalizeGitHubSource(a.githubSource),
  };
}

export class Storage {
  public static settings: Writable<Settings> = writable(defaultSettings);
  public static adventures: Writable<Record<string, Adventure>> = writable({});
  public static audioLibrary: Writable<AudioClip[]> = writable([]);
  public static selectedAdventureId: Writable<string | null> = writable(null);
  public static editingStoryCard: Writable<{ adventureId: string; storyCardId: string } | null> = writable(null);
  public static cardMap: Writable<Map<string, StoryCard>> = writable(new Map());

  // What is currently on disk, by adventure, compared by identity to decide which keys to write.
  // Seeded by load() so the first subscriber callback in listen() has nothing to write.
  private static persisted: Record<string, Adventure> = {};

  /**
   * Every adventure as one document, for a backup before something irreversible. The regular
   * import recognises this shape and restores it (see importAdventure), so it is a backup that
   * can actually be put back, not just a download.
   */
  static exportAll(): string {
    return JSON.stringify(
      { version: 1, exportedAt: Date.now(), adventures: Object.values(get(this.adventures)) },
      null,
      2
    );
  }

  static exportAdventure(adventureId: string, exportVersion?: string): string | null {
    const adventure = this.getAdventureById(adventureId);
    if (!adventure) return null;
    const version = exportVersion === undefined ? adventure.contentVersion ?? 1 : contentVersion(exportVersion);
    if (version === null || newerVersion(adventure.contentVersion ?? "1", String(version))) {
      throw new Error("Choose a numeric or dotted version at least as new as the current version.");
    }

    const exportData = {
      version,
      exportedAt: Date.now(),
      adventure: exportVersion === undefined ? adventure : { ...adventure, contentVersion: String(version) },
    };

    return JSON.stringify(exportData, null, 2);
  }

  private static importLegacyAdventure(cards: Record<string, unknown>[]): {
    success: boolean;
    error?: string;
    adventure?: Adventure;
  } {
    const newId = crypto.randomUUID();
    const storyCards: Record<string, StoryCard> = {};

    for (const card of cards) {
      const normalized = normalizeLegacyStoryCard(card);
      storyCards[normalized.id] = normalized;
    }

    const importedAdventure: Adventure = {
      id: newId,
      name: "Legacy Import",
      createdAt: Date.now(),
      storyCards,
    };

    this.adventures.update((adventures) => ({
      ...adventures,
      [newId]: importedAdventure,
    }));

    return { success: true, adventure: importedAdventure };
  }

  static importAdventure(jsonString: string): { success: boolean; error?: string; adventure?: Adventure } {
    let data: any;
    try {
      data = JSON.parse(jsonString);
    } catch {
      // Report length + start so a truncated download (huge release asset cut short) or a wrong
      // payload (HTML error page, LFS pointer) is obvious instead of a bare "invalid JSON".
      const snippet = jsonString.slice(0, 60).replace(/\s+/g, " ").trim();
      return { success: false, error: `Not valid JSON (${jsonString.length} chars${snippet ? `, starts "${snippet}..."` : ""}).` };
    }

    try {
      if (isLegacyFormat(data)) {
        return this.importLegacyAdventure(data);
      }

      if (data && Array.isArray(data.adventures)) {
        // A full backup from exportAll. Ids are kept, so links and AI Dungeon bindings survive, and
        // an adventure with the same id is overwritten, because putting things back is what a
        // restore means.
        const restored: Adventure[] = [];
        for (const raw of data.adventures) {
          const normalized = normalizeAdventure(raw);
          if (normalized) restored.push(normalized);
        }
        if (restored.length === 0) return { success: false, error: "The backup holds no adventures." };
        this.adventures.update((all) => ({ ...all, ...Object.fromEntries(restored.map((a) => [a.id, a])) }));
        return { success: true, adventure: restored[0] };
      }

      if (!data || typeof data !== "object" || !data.adventure || typeof data.adventure !== "object") {
        return { success: false, error: "No 'adventure' object found in the file." };
      }

      const normalized = normalizeAdventure(data.adventure);
      if (!normalized) {
        return { success: false, error: "Failed to parse adventure" };
      }

      const newId = crypto.randomUUID();
      const importedAdventure: Adventure = {
        ...normalized,
        id: newId,
        name: `${normalized.name} (Imported)`,
        createdAt: Date.now(),
        contentVersion: contentVersion(data.version) ?? undefined,
        githubSource: undefined,
      };

      const newStoryCards: Record<string, StoryCard> = {};
      for (const card of Object.values(normalized.storyCards)) {
        const newCardId = crypto.randomUUID();
        newStoryCards[newCardId] = { ...card, id: newCardId };
      }
      importedAdventure.storyCards = newStoryCards;

      this.adventures.update((adventures) => ({
        ...adventures,
        [newId]: importedAdventure,
      }));

      return { success: true, adventure: importedAdventure };
    } catch (e) {
      return { success: false, error: `Import failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  static getAdventureById(adventureId: string): Adventure | null {
    return get(this.adventures)[adventureId] ?? null;
  }

  static importGitHubAdventure(text: string, source: Omit<NonNullable<Adventure["githubSource"]>, "version">, targetId?: string, mode?: "merge" | "overwrite"): Adventure {
    const data = JSON.parse(text);
    const version = contentVersion(data?.version);
    if (!version || !data?.adventure?.storyCards || typeof data.adventure.storyCards !== "object" || Array.isArray(data.adventure.storyCards)) {
      throw new Error("GitHub updates require a single adventure export with a numeric or dotted version.");
    }
    const incoming = normalizeAdventure(data.adventure);
    if (!incoming || Object.keys(incoming.storyCards).length !== Object.keys(data.adventure.storyCards).length) throw new Error("The export contains invalid cards.");
    const ids = Object.entries(incoming.storyCards);
    if (ids.some(([id, card]) => id !== card.id)) throw new Error("Card IDs must match their keys for GitHub updates.");
    const provenance = { ...source, version };
    let result: Adventure;
    if (targetId) {
      const local = this.getAdventureById(targetId);
      if (!local || !mode || local.githubSource?.repo !== source.repo || local.githubSource.path !== source.path || local.githubSource.release !== source.release) throw new Error("The imported source no longer matches this set.");
      if (!newerVersion(version, local.githubSource.version)) throw new Error("This file no longer has a newer version. Refresh the repository.");
      result = applyGitHubUpdate(local, incoming, provenance, mode);
    } else {
      result = { ...incoming, id: crypto.randomUUID(), name: `${incoming.name} (Imported)`, createdAt: Date.now(), contentVersion: version, githubSource: provenance };
    }
    this.adventures.update(all => ({ ...all, [result.id]: result }));
    return result;
  }

  static getSelectedAdventure(): Adventure | null {
    const id = get(this.selectedAdventureId);
    if (!id) return null;
    return this.getAdventureById(id);
  }

  static getStoryCard(adventureId: string, storyCardId: string): StoryCard | null {
    const adventure = this.getAdventureById(adventureId);
    if (!adventure) return null;
    return adventure.storyCards[storyCardId] ?? null;
  }

  static createAdventure(name: string): Adventure {
    const id = crypto.randomUUID();
    const adventure: Adventure = {
      id,
      name: name.trim() || "Untitled Adventure",
      createdAt: Date.now(),
      storyCards: {},
    };

    this.adventures.update((adventures) => ({
      ...adventures,
      [id]: adventure,
    }));

    return adventure;
  }

  static updateAdventure(adventureId: string, updates: Partial<Omit<Adventure, "id">>): boolean {
    const adventure = this.getAdventureById(adventureId);
    if (!adventure) return false;

    this.adventures.update((adventures) => ({
      ...adventures,
      [adventureId]: { ...adventure, ...updates },
    }));

    return true;
  }

  static deleteAdventure(adventureId: string): boolean {
    const adventure = this.getAdventureById(adventureId);
    if (!adventure) return false;

    this.adventures.update((adventures) => {
      const { [adventureId]: _, ...rest } = adventures;
      return rest;
    });

    if (get(this.selectedAdventureId) === adventureId) {
      this.selectedAdventureId.set(null);
    }

    const editing = get(this.editingStoryCard);
    if (editing?.adventureId === adventureId) {
      this.editingStoryCard.set(null);
    }

    return true;
  }

  static selectAdventure(adventureId: string | null): void {
    if (adventureId === null || this.getAdventureById(adventureId)) {
      this.selectedAdventureId.set(adventureId);
    }
  }

  /**
   * The card set that belongs to an AI Dungeon adventure: the one stamped with its shortId, or
   * failing that the one stamped with the scenario it was started from. The adventure binding wins
   * so a single adventure of a scenario can carry a set of its own. Null when nothing is bound.
   */
  static findAdventureForAid(shortId: string | null, scenarioId: string | null): Adventure | null {
    const all = Object.values(get(this.adventures));
    if (shortId) {
      const byAdventure = all.find((a) => a.aidShortId === shortId);
      if (byAdventure) return byAdventure;
    }
    if (scenarioId) {
      const byScenario = all.find((a) => a.aidScenarioId === scenarioId);
      if (byScenario) return byScenario;
    }
    return null;
  }

  /**
   * Selects the card set bound to the given AI Dungeon adventure (by shortId, else by the scenario
   * it came from), so its story cards (and highlighting) apply automatically. Non-destructive: if
   * nothing matches, the current selection is left untouched. Returns whether a match was selected.
   */
  static selectAdventureByAidId(shortId: string | null, scenarioId: string | null = null): boolean {
    const match = this.findAdventureForAid(shortId, scenarioId);
    if (!match) return false;
    if (get(this.selectedAdventureId) !== match.id) this.selectAdventure(match.id);
    return true;
  }

  /**
   * Binds an adventure to an AI Dungeon shortId (or clears it with null). Keeps the binding unique:
   * any other adventure carrying the same shortId is unbound, so findAdventureForAid is
   * deterministic.
   */
  static setAidShortId(adventureId: string, shortId: string | null): void {
    this.setAidLink(adventureId, "aidShortId", shortId);
  }

  /**
   * Binds an adventure to an AI Dungeon scenario id (or clears it with null), so it auto-loads for
   * every adventure started or duplicated from that scenario. Unique per scenario, like the shortId.
   */
  static setAidScenarioId(adventureId: string, scenarioId: string | null): void {
    this.setAidLink(adventureId, "aidScenarioId", scenarioId);
  }

  private static setAidLink(adventureId: string, field: "aidShortId" | "aidScenarioId", value: string | null): void {
    this.adventures.update((advs) => {
      const target = advs[adventureId];
      if (!target) return advs;
      const next: Record<string, Adventure> = { ...advs };
      if (value) {
        for (const [id, a] of Object.entries(next)) {
          if (id !== adventureId && a[field] === value) next[id] = { ...a, [field]: undefined };
        }
      }
      next[adventureId] = { ...target, [field]: value ?? undefined };
      return next;
    });
  }

  /** The cosmetic/default field block shared by every newly created or imported story card. */
  private static defaultStoryCardFields(): Omit<StoryCard, "id" | "name" | "type" | "triggers"> {
    return {
      icons: [],
      iconIndex: 0,
      graphics: [],
      graphicIndex: 0,
      useCustomColor: false,
      color: "#f8ae2c",
      limit: "none",
      preset: "default",
      audioClips: [],
    };
  }

  static createStoryCard(adventureId: string, name: string): StoryCard | null {
    const adventure = this.getAdventureById(adventureId);
    if (!adventure) return null;

    const id = crypto.randomUUID();
    const storyCard: StoryCard = {
      id,
      name: name.trim() || "Untitled Card",
      triggers: "",
      type: "character",
      ...this.defaultStoryCardFields(),
    };

    this.adventures.update((adventures) => ({
      ...adventures,
      [adventureId]: {
        ...adventure,
        storyCards: {
          ...adventure.storyCards,
          [id]: storyCard,
        },
      },
    }));

    return storyCard;
  }

  /**
   * Folds story cards captured from AI Dungeon into an adventure. New cards are created with the
   * usual defaults; cards already present are updated in place, matched by AI Dungeon's id or by
   * name, touching only the fields AI Dungeon owns (name, type, triggers) so icons, portraits, audio
   * and colours survive a re-import. See aid/sync.ts for the rules. Returns what happened, for the
   * Import tab to report.
   */
  static importStoryCards(
    adventureId: string,
    cards: IncomingCard[]
  ): { imported: number; updated: number; skipped: number } {
    const adventure = this.getAdventureById(adventureId);
    if (!adventure) return { imported: 0, updated: 0, skipped: 0 };

    const plan = planAidSync(Object.values(adventure.storyCards), cards);

    const next: Record<string, StoryCard> = { ...adventure.storyCards };
    for (const [id, changes] of Object.entries(plan.updates)) {
      const current = next[id];
      if (current) next[id] = { ...current, ...changes };
    }
    for (const addition of plan.additions) {
      const id = crypto.randomUUID();
      next[id] = { id, ...addition, ...this.defaultStoryCardFields() };
    }

    const updated = Object.keys(plan.updates).length;
    if (plan.additions.length > 0 || updated > 0) {
      this.adventures.update((adventures) => {
        const adv = adventures[adventureId];
        if (!adv) return adventures;
        return { ...adventures, [adventureId]: { ...adv, storyCards: next } };
      });
    }

    return { imported: plan.additions.length, updated, skipped: plan.unchanged + plan.dropped };
  }

  static updateStoryCard(adventureId: string, storyCardId: string, updates: Partial<Omit<StoryCard, "id">>): boolean {
    const adventure = this.getAdventureById(adventureId);
    if (!adventure) return false;

    const storyCard = adventure.storyCards[storyCardId];
    if (!storyCard) return false;

    this.adventures.update((adventures) => ({
      ...adventures,
      [adventureId]: {
        ...adventure,
        storyCards: {
          ...adventure.storyCards,
          [storyCardId]: { ...storyCard, ...updates },
        },
      },
    }));

    return true;
  }

  static deleteStoryCard(adventureId: string, storyCardId: string): boolean {
    const adventure = this.getAdventureById(adventureId);
    if (!adventure || !adventure.storyCards[storyCardId]) return false;

    this.adventures.update((adventures) => {
      const { [storyCardId]: _, ...restCards } = adventure.storyCards;
      return {
        ...adventures,
        [adventureId]: {
          ...adventure,
          storyCards: restCards,
        },
      };
    });

    const editing = get(this.editingStoryCard);
    if (editing?.adventureId === adventureId && editing?.storyCardId === storyCardId) {
      this.editingStoryCard.set(null);
    }

    return true;
  }

  static openStoryCardEditor(adventureId: string, storyCardId: string): void {
    this.editingStoryCard.set({ adventureId, storyCardId });
  }

  static closeStoryCardEditor(): void {
    this.editingStoryCard.set(null);
  }

  private static mapCards() {
    const update = () => {
      const adventure = this.getSelectedAdventure();
      if (adventure) {
        this.cardMap.set(buildCardMap(adventure.storyCards));
      } else {
        this.cardMap.set(new Map());
      }
    };

    this.selectedAdventureId.subscribe(() => update());
    this.adventures.subscribe(() => update());
  }

  static async load() {
    try {
      // One read of everything: settings, audio, selection, and however adventures are stored.
      const all = await chrome.storage.local.get(null);
      if (all.settings) this.settings.set({ ...get(this.settings), ...all.settings });

      const { raw, legacy } = readAdventures(all);
      const normalizedAdventures: Record<string, Adventure> = {};
      for (const [key, value] of Object.entries(raw)) {
        const normalized = normalizeAdventure(value);
        if (normalized) normalizedAdventures[key] = normalized;
      }
      this.adventures.set(normalizedAdventures);
      // The same objects the store now holds, so nothing counts as changed until something is.
      this.persisted = normalizedAdventures;

      if (legacy) {
        // One-time migration from the single blob to a key per adventure. New keys are written
        // before the blob is removed, so a crash in between loses nothing: the next load reads both
        // and the per-adventure copy wins.
        const split: Record<string, Adventure> = {};
        for (const adventure of Object.values(normalizedAdventures)) split[adventureKey(adventure.id)] = adventure;
        await chrome.storage.local.set(JSON.parse(JSON.stringify(split)));
        await chrome.storage.local.remove(LEGACY_ADVENTURES_KEY);
        Debug.log("Migrated " + Object.keys(split).length + " adventure(s) to per-adventure storage.");
      }

      if (Array.isArray(all.audioLibrary)) this.audioLibrary.set(all.audioLibrary);
      if (all.selectedAdventureId && typeof all.selectedAdventureId === "string")
        this.selectedAdventureId.set(all.selectedAdventureId);

      this.mapCards();
    } catch (error) {
      Debug.log("ERROR: " + error);
    }
  }

  static async listen() {
    this.settings.subscribe((value) => {
      chrome.storage.local.set({ settings: JSON.parse(JSON.stringify(value)) });
    });

    let adventureTimeout: ReturnType<typeof setTimeout>;
    this.adventures.subscribe((value) => {
      clearTimeout(adventureTimeout);
      adventureTimeout = setTimeout(() => {
        // Only the adventures whose object changed are serialised and written, and only the keys
        // of deleted ones are removed. Everything else on disk is left exactly as it is.
        const { changed, removed } = diffAdventures(this.persisted, value);
        if (changed.length > 0) {
          const writes: Record<string, unknown> = {};
          for (const adventure of changed) writes[adventureKey(adventure.id)] = JSON.parse(JSON.stringify(adventure));
          chrome.storage.local.set(writes);
        }
        if (removed.length > 0) chrome.storage.local.remove(removed.map(adventureKey));
        this.persisted = value;
      }, 200);
    });

    this.audioLibrary.subscribe((value) => {
      chrome.storage.local.set({ audioLibrary: JSON.parse(JSON.stringify(value)) });
    });

    this.selectedAdventureId.subscribe((value) => {
      chrome.storage.local.set({ selectedAdventureId: value });
    });
  }
}

export const settings = Storage.settings;
export const adventures = Storage.adventures;
