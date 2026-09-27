import type { Adventure } from "@/shared/types";
export function isSupportedStoryUrl(value: string): boolean {
  try { return ["https://play.aidungeon.com", "https://beta.aidungeon.com", "https://alpha.aidungeon.com", "https://lynxcatai.com"].includes(new URL(value).origin); }
  catch { return false; }
}
export const isLynxCat = () => typeof location !== "undefined" && location.hostname === "lynxcatai.com";
export const siteName = () => isLynxCat() ? "LynxCatAI" : "AI Dungeon";
export function lynxRunId(pathname: string): string | null {
  return /^\/plays\/(play-[a-zA-Z0-9-]+)\/?$/.exec(pathname)?.[1] ?? null;
}
export const runLinkField = () => isLynxCat() ? "lynxRunId" as const : "aidShortId" as const;
export const storyLinkField = () => isLynxCat() ? "lynxStoryId" as const : "aidScenarioId" as const;
export const linkedRun = (adventure: Adventure | null | undefined) => adventure?.[runLinkField()];
export const linkedStory = (adventure: Adventure | null | undefined) => adventure?.[storyLinkField()];
