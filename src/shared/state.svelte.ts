import { Tab } from "@/shared/types";

/** Selected category in the main settings workspace. */
export type SettingsSection = "extension" | "cards" | "novel" | "speech" | "writing" | "audio" | "images" | "libraries" | "diagnostics";

export const extensionState = $state({
  isEditorOpen: false,
  // Page-session only. Refreshing always restores access to the floating menu.
  floatingButtonHidden: false,
  // Temporary return to the native story, without disabling VN instructions.
  novelMinimized: false,
  editorTab: Tab.Adventure,
  focusCardId: null as string | null,
  // Held here rather than inside the Settings component, which unmounts whenever you switch tabs and
  // would otherwise drop you back on the first section every time you came back.
  settingsSection: "extension" as SettingsSection,
});
