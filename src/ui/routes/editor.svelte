<script lang="ts">
  /* Lib */
  import { BitsConfig } from "bits-ui";

  /* Other */
  import { extensionState } from "@/shared/state.svelte";

  /* Routes */
  import Settings from "./editor/settings.svelte";
  import Tabs from "@/ui/components/tabs.svelte";
  import { Tab } from "@/shared/types";
  import Adventure from "./editor/adventure.svelte";
  import Import from "./editor/import.svelte";
  import ScrollArea from "@/ui/components/scroll_area.svelte";
  import FloatingButton from "@/ui/components/floating_button.svelte";
  import StoryCardAutocomplete from "@/ui/components/story_card_autocomplete.svelte";
  import VisualNovel from "@/ui/components/visual_novel.svelte";
  import GitHubUpdateDialog from "@/ui/components/github_update_dialog.svelte";
  import { versionInfo, checkForUpdate, RELEASES_URL, type VersionInfo } from "@/shared/version";
  import { fade, fly } from "svelte/transition";
  import { untrack } from "svelte";
  import { checkGitHubUpdates } from "@/media/github_updates";

  /* Editor */
  let portal: HTMLElement | undefined = $state();

  /* Version footer: installed version + copyright, plus a GitHub update badge. */
  let vinfo = $state<VersionInfo>({ current: "", latest: null, updateAvailable: false });
  versionInfo.subscribe((v) => (vinfo = v));
  const year = new Date().getFullYear();
  const ORIGINAL_REPO_URL = "https://github.com/clauds-clauds/ai-dungeon-browser-extension-v2";

  // Check GitHub for a newer release the first time the editor is opened (checkForUpdate is
  // self-guarded to run once per session).
  $effect(() => {
    if (extensionState.isEditorOpen) untrack(() => {
      void checkForUpdate();
      void checkGitHubUpdates();
    });
  });
</script>

<FloatingButton />
<StoryCardAutocomplete />
<VisualNovel />
<!-- Mounted outside the editor and hover popover so either picker can review an update. -->
<BitsConfig defaultPortalTo={portal}>
  <GitHubUpdateDialog />
</BitsConfig>

{#if extensionState.isEditorOpen}
  <div
    transition:fade={{ duration: 150 }}
    class="flex fixed w-screen h-screen bg-theme-neutral-0/80 justify-center place-items-center z-1000"
  >
    <div
      transition:fly={{ duration: 200, y: 32 }}
      class="flex flex-col fixed w-[95vw] max-w-160 h-[95vh] bg-theme-neutral-0 rounded-2xl border border-theme-neutral-100 overflow-hidden"
    >
      <Tabs />
      <BitsConfig defaultPortalTo={portal}>
        <ScrollArea>
          {#if extensionState.editorTab === Tab.Adventure}
            <Adventure />
          {/if}

          {#if extensionState.editorTab === Tab.Import}
            <Import />
          {/if}

          {#if extensionState.editorTab === Tab.Settings}
            <Settings />
          {/if}
        </ScrollArea>
      </BitsConfig>

      <!-- Permanent footer: installed version + copyright, always visible below the scrolling tab. -->
      <div
        class="flex items-center justify-between gap-2 shrink-0 px-4 py-2 border-t border-theme-neutral-100 text-theme-neutral-700"
      >
        <span class="flex flex-col min-w-0">
          <span class="text-sm truncate">v{vinfo.current} &middot; &copy; {year} Oratorian &middot; Mahesvara</span>
          <!-- The project began as Claudia's Dungeon Extension v2 (MIT); the shipped copy should say so,
               not only the source tree. Quieter than the line above, but still readable. -->
          <span class="text-xs text-theme-neutral-600 truncate">
            Original source &copy; 2026 by
            <a
              href={ORIGINAL_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              class="text-theme-neutral-700 hover:text-theme-neutral-900 hover:underline"
            >
              Claudia
            </a>
          </span>
        </span>
        {#if vinfo.updateAvailable}
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1 text-sm font-bold text-pretty-green hover:underline shrink-0"
          >
            <span class="font-symbol text-base">arrow_circle_up</span>
            New version{vinfo.latest ? ` v${vinfo.latest}` : ""}
          </a>
        {/if}
      </div>
    </div>
  </div>
{/if}
<div bind:this={portal} class="absolute inset-0 z-10001 pointer-events-none"></div>
