import { Tab } from "@/shared/types";

export const extensionState = $state({
  isEditorOpen: false,
  editorTab: Tab.Adventure,
  focusCardId: null as string | null,
});
