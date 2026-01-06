import { Adventure, AudioClip, StoryCard } from "./types";
import { get, writable, Writable } from "svelte/store";
import { Debug } from "./debug";

const defaultSettings = {
  iconSize: 28,
  iconRoundness: 0,
  iconThickness: 1,
  iconColor: "#f8ae2c",

  highlightBold: false,
  highlightLookback: 0,
  highlightMarkdown: true,
  highlightFocus: false,

  tooltipWidth: 512,
  tooltipHeight: 512,
  tooltipDelay: 200,

  volume: 100,
};

export type Settings = typeof defaultSettings;

function ensureArray(value: unknown): string[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value) as string[];
  return [];
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
  };
}

export class Storage {
  public static settings: Writable<Settings> = writable(defaultSettings);
  public static adventures: Writable<Record<string, Adventure>> = writable({});
  public static audioLibrary: Writable<AudioClip[]> = writable([]);
  public static selectedAdventureId: Writable<string | null> = writable(null);
  public static editingStoryCard: Writable<{ adventureId: string; storyCardId: string } | null> = writable(null);
  public static cardMap: Writable<Map<string, StoryCard>> = writable(new Map());

  static getAdventureById(adventureId: string): Adventure | null {
    return get(this.adventures)[adventureId] ?? null;
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

  static createStoryCard(adventureId: string, name: string): StoryCard | null {
    const adventure = this.getAdventureById(adventureId);
    if (!adventure) return null;

    const id = crypto.randomUUID();
    const storyCard: StoryCard = {
      id,
      name: name.trim() || "Untitled Card",
      triggers: "",
      type: "character",
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
      const result = await chrome.storage.local.get(["settings", "adventures", "audioLibrary", "selectedAdventureId"]);
      if (result.settings) this.settings.set({ ...get(this.settings), ...result.settings });

      if (result.adventures && typeof result.adventures === "object") {
        const normalizedAdventures: Record<string, Adventure> = {};
        for (const [key, value] of Object.entries(result.adventures)) {
          const normalized = normalizeAdventure(value);
          if (normalized) {
            normalizedAdventures[key] = normalized;
          }
        }
        this.adventures.set(normalizedAdventures);
      }

      if (Array.isArray(result.audioLibrary)) this.audioLibrary.set(result.audioLibrary);
      if (result.selectedAdventureId && typeof result.selectedAdventureId === "string")
        this.selectedAdventureId.set(result.selectedAdventureId);

      this.mapCards();
    } catch (error) {
      Debug.log("ERROR: " + error);
    }
  }

  static async listen() {
    this.settings.subscribe((value) => {
      chrome.storage.local.set({ settings: value });
    });

    let adventureTimeout: ReturnType<typeof setTimeout>;
    this.adventures.subscribe((value) => {
      clearTimeout(adventureTimeout);
      adventureTimeout = setTimeout(() => {
        chrome.storage.local.set({ adventures: value });
      }, 200);
    });

    this.audioLibrary.subscribe((value) => {
      chrome.storage.local.set({ audioLibrary: value });
    });

    this.selectedAdventureId.subscribe((value) => {
      chrome.storage.local.set({ selectedAdventureId: value });
    });
  }
}

export const settings = Storage.settings;
export const adventures = Storage.adventures;
