import { Tab } from "./types";

export const extensionState = $state({
  isEditorOpen: false,
  editorTab: Tab.Adventure,
  focusCardId: null as string | null,
});
