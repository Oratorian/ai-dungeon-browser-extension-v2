import { get, writable } from "svelte/store";
import { createNovelBookmark } from "./novel_bookmark";
import type { NovelFrame } from "./novel";
import type { NovelCard } from "./novel_cards";
import { createNovelPortraitTracker, novelPortrait, type PortraitChoices, type PortraitMatch } from "./novel_portraits";

/** Current normal-mode display choices, separate from user-owned story-card data. */
export const storyPortraits = writable<Record<string, string>>({});
let manualPicker: ((card: string, portrait: string) => void) | undefined;
export function chooseStoryPortrait(card: string, portrait: string) { manualPicker?.(card, portrait); }
export function registerStoryPortraitPicker(picker: NonNullable<typeof manualPicker>) {
  manualPicker = picker;
  return () => { if (manualPicker === picker) manualPicker = undefined; };
}
export function publishStoryPortraits(pictures: Record<string, string>) {
  const previous = get(storyPortraits);
  if (Object.keys(previous).length !== Object.keys(pictures).length || Object.entries(pictures).some(([id, picture]) => previous[id] !== picture)) {
    storyPortraits.set(pictures);
  }
}

/** Follow the loaded story and keep a style when its trigger scrolls out of the DOM. */
export class StoryPortraitSession {
  private frames: NovelFrame[] = [];
  private cards: NovelCard[] = [];
  private timeline: Record<string, PortraitMatch>[] = [];
  private seed: Record<string, PortraitMatch> = {};
  private manual: PortraitChoices = {};

  update(frames: NovelFrame[], cards: NovelCard[]) {
    if (frames.length && this.frames.length) {
      const first = frames[0]!;
      const start = this.frames.findIndex(frame => frame.text === first.text && frame.paragraph === first.paragraph);
      if (start > 0) this.seed = Object.fromEntries(Object.entries(this.timeline[start - 1] ?? {})
        .map(([id, match]) => [id, { portrait: match.portrait, at: -1 }]));
      else if (start < 0) this.seed = {};
    }
    this.frames = frames; this.cards = cards;
    this.timeline = createNovelPortraitTracker(cards)(frames, this.seed);
    return this.pictures();
  }
  choose(card: string, portrait: string) {
    this.manual[card] = { portrait, locked: false, anchor: createNovelBookmark(this.frames, this.frames.length - 1) };
    return this.pictures();
  }
  private pictures(): Record<string, string> {
    const latest = this.timeline.at(-1) ?? this.seed;
    return Object.fromEntries(this.cards.flatMap(card => {
      const picture = novelPortrait(card, latest[card.id], this.manual[card.id], this.frames).id;
      return picture ? [[card.id, picture]] : [];
    }));
  }
}
