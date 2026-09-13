export enum Tab {
  Adventure = "Adventure",
  Import = "Import",
  Settings = "Settings",
  Developer = "Developer",
  StoryCard = "StoryCard",
}

export type AudioClip = {
  id: string;
  name: string;
  size: number;
  duration: number;
  data: string;
};

export type StoryCard = {
  id: string;
  name: string;
  triggers: string;
  type: string;
  icons: string[];
  iconIndex: number;
  graphics: string[];
  graphicIndex: number;
  useCustomColor: boolean;
  color: string;
  limit: string;
  preset: string;
  audioClips: string[];
  /** AI Dungeon's own id for this card, when it was imported. Lets a re-import update the card
   *  in place instead of skipping it by name (see aid/sync.ts). */
  aidId?: string;
};

export type Adventure = {
  id: string;
  name: string;
  createdAt: number;
  storyCards: Record<string, StoryCard>;
  /** AI Dungeon adventure shortId this was imported from; lets the extension auto-select this
   *  card set when that adventure is played (see aid/adventure.ts). */
  aidShortId?: string;
  /** AI Dungeon scenario id this card set follows: it auto-loads for every adventure started or
   *  duplicated from that scenario. An aidShortId match on another set takes precedence, so one
   *  adventure of the scenario can still carry its own set. */
  aidScenarioId?: string;
};

export type TextChunk =
  | { type: "text"; content: string }
  | { type: "bold"; content: string }
  | { type: "italic"; content: string }
  | { type: "underline"; content: string }
  | { type: "strikethrough"; content: string }
  | { type: "card"; card: StoryCard; content: string };

export enum ResponseType {
  LastAction = "LastAction",
  Action = "Action",
  Story = "Story",
}

export enum ContainerType {
  StorySection = "StorySection",
  Action = "Action",
}
