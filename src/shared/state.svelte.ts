import { Tab } from "@/shared/types";

/** Which half of the Settings tab is showing. See ui/routes/editor/settings.svelte. */
export type SettingsSection = "extension" | "cards";

export const extensionState = $state({
  isEditorOpen: false,
  editorTab: Tab.Adventure,
  focusCardId: null as string | null,
  // Held here rather than inside the Settings component, which unmounts whenever you switch tabs and
  // would otherwise drop you back on the first section every time you came back.
  settingsSection: "extension" as SettingsSection,
});
