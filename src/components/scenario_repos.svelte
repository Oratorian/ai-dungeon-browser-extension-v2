<script lang="ts">
  import { Tooltip } from "bits-ui";
  import { settings } from "@/utils/storage";
  import { parseRepo } from "@/utils/github";

  let repoValue = $state("");
  let error = $state("");

  function labelFor(entry: string): string {
    return parseRepo(entry)?.label ?? entry;
  }

  function urlFor(entry: string): string {
    const p = parseRepo(entry);
    if (!p) return "#";
    let url = `https://github.com/${p.owner}/${p.repo}`;
    if (p.branch) url += `/tree/${p.branch}${p.subpath ? `/${p.subpath}` : ""}`;
    return url;
  }

  function addRepo() {
    const parsed = parseRepo(repoValue);
    if (!parsed) {
      error = "Enter owner/repo or a github.com URL.";
      return;
    }
    const exists = $settings.scenarioRepos.some((r) => parseRepo(r)?.label === parsed.label);
    if (exists) {
      error = "That repo is already in the list.";
      return;
    }
    $settings.scenarioRepos = [...$settings.scenarioRepos, repoValue.trim()];
    repoValue = "";
    error = "";
  }

  function removeRepo(entry: string) {
    $settings.scenarioRepos = $settings.scenarioRepos.filter((r) => r !== entry);
  }
</script>

<div class="flex flex-col gap-2 w-full">
  <span class="text-xs text-theme-neutral-700 px-1">
    Public GitHub repos holding exported adventures (<code>.json</code>). Browse and import them from the
    adventure picker's Import dialog. Accepts <code>owner/repo</code> or a github.com URL (a
    <code>/tree/branch/folder</code> link scopes it to that folder).
  </span>

  <div class="flex gap-2">
    <input
      bind:value={repoValue}
      onkeydown={(e) => {
        if (e.key === "Enter") addRepo();
      }}
      oninput={() => (error = "")}
      placeholder="owner/repo or a github.com URL"
      class="flex-1 min-w-0 bg-theme-neutral-100 h-9 px-3 rounded-lg outline-0 text-sm"
    />
    <button
      onclick={addRepo}
      disabled={!repoValue.trim()}
      class="flex items-center gap-1 px-3 py-1.5 bg-pretty-theme/20 hover:bg-pretty-theme/30 disabled:opacity-50 text-pretty-theme rounded-lg transition-colors text-sm"
    >
      <span class="font-symbol text-base">add</span>
      Add
    </button>
  </div>

  {#if error}
    <span class="text-xs text-pretty-red px-1">{error}</span>
  {/if}

  {#if $settings.scenarioRepos.length === 0}
    <div class="flex flex-col items-center justify-center py-6 text-theme-neutral-700">
      <span class="font-symbol text-3xl mb-2">folder_open</span>
      <span class="text-sm">No repos yet</span>
      <span class="text-xs opacity-60">Add a public GitHub repo to import shared scenarios from it</span>
    </div>
  {:else}
    <div class="flex flex-col gap-1">
      {#each $settings.scenarioRepos as entry (entry)}
        <div
          class="flex items-center gap-2 p-2 bg-theme-neutral-300 hover:bg-theme-neutral-400 rounded-lg transition-colors group"
        >
          <span class="font-symbol text-lg text-theme-neutral-700 shrink-0">folder</span>
          <a
            href={urlFor(entry)}
            target="_blank"
            rel="noopener noreferrer"
            class="flex-1 min-w-0 text-sm truncate hover:text-pretty-theme hover:underline"
            title={entry}
          >
            {labelFor(entry)}
          </a>
          <Tooltip.Provider>
            <Tooltip.Root delayDuration={300}>
              <Tooltip.Trigger>
                <button
                  onclick={() => removeRepo(entry)}
                  class="flex items-center justify-center size-8 rounded-md opacity-0 group-hover:opacity-100 hover:bg-pretty-red hover:text-shadow-theme-neutral-900 transition-all"
                >
                  <span class="font-symbol text-lg">delete</span>
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content sideOffset={4} class="bg-theme-neutral-100 px-2 py-1 rounded-md text-xs shadow-popover z-50">
                Remove
              </Tooltip.Content>
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>
      {/each}
    </div>
  {/if}
</div>
