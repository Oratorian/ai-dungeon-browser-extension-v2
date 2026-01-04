export enum Tab {
  Adventure = "Adventure",
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
};

export type Adventure = {
  id: string;
  name: string;
  createdAt: number;
  storyCards: Record<string, StoryCard>;
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
