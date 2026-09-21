<script module lang="ts">
  import { get, writable } from "svelte/store";
  import type { Adventure } from "@/shared/types";
  import { githubUpdates, installGitHubUpdate, type GitHubUpdate } from "@/media/github_updates";

  const target = writable<{ id: string; name: string; update: GitHubUpdate } | null>(null);

  export function reviewUpdate(adventure: Adventure) {
    const update = get(githubUpdates)[adventure.id];
    if (update) target.set({ id: adventure.id, name: adventure.name, update });
  }
</script>

<script lang="ts">
  import { Dialog } from "bits-ui";

  let updateBusy = $state(false);
  let updateError = $state("");
  $effect(() => { if ($target) updateError = ""; });

  async function applyUpdate(mode: "merge" | "overwrite") {
    const selected = $target;
    if (!selected || updateBusy) return;
    updateBusy = true;
    try {
      await installGitHubUpdate(selected.id, selected.update, mode);
      target.set(null);
    } catch (error) { updateError = error instanceof Error ? error.message : "Update failed."; }
    finally { updateBusy = false; }
  }
</script>

<Dialog.Root open={$target !== null} onOpenChange={(open) => { if (!open && !updateBusy) target.set(null); }}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 bg-black/60 z-50" />
    <Dialog.Content class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-md bg-theme-neutral-200 rounded-xl p-6 shadow-popover">
      <Dialog.Title class="text-lg font-bold">Update {$target?.name}</Dialog.Title>
      <Dialog.Description class="text-sm mt-2">
        Version {$target?.update.installed} → {$target?.update.version}.
        Merge adds new cards and keeps existing local cards and edits. Overwrite replaces the entire card collection, including local additions and edits. Your set name and adventure/scenario bindings stay.
      </Dialog.Description>
      {#if updateError}<p role="alert" class="text-sm text-pretty-red mt-3">{updateError}</p>{/if}
      <div class="flex justify-end gap-2 mt-4">
        <button disabled={updateBusy} onclick={() => target.set(null)} class="p-2 rounded-lg hover:bg-theme-neutral-300">Later</button>
        <button disabled={updateBusy} onclick={() => applyUpdate("merge")} class="p-2 rounded-lg bg-pretty-theme/20 text-pretty-theme">{updateBusy ? "Updating…" : "Merge"}</button>
        <button disabled={updateBusy} onclick={() => applyUpdate("overwrite")} class="p-2 rounded-lg bg-pretty-red/20 text-pretty-red">Overwrite</button>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
