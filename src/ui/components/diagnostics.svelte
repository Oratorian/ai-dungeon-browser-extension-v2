<script lang="ts">
  import { collectDiagnostics, copyText } from "@/shared/diagnostics";

  // "Copy Diagnostics" for support threads: one click gathers the report and puts it on the
  // clipboard, ready to paste into Discord. The report is also shown inline, both so the user can
  // see exactly what they are about to share (it goes into a public thread) and so they can select
  // it by hand if the clipboard is unavailable.

  let report = $state("");
  let status = $state<"idle" | "copied" | "failed">("idle");
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  async function run() {
    report = collectDiagnostics();
    status = (await copyText(report)) ? "copied" : "failed";

    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => (status = "idle"), 4000);
  }
</script>

<div class="flex flex-col gap-3">
  <p class="text-sm text-theme-neutral-700">
    Checks whether AI Dungeon's page still looks the way the extension expects, and whether your own
    settings would hide icons or portraits. Copies a short report you can paste into a support thread.
    It contains counts only, never card names, story text, or image links.
  </p>

  <button
    onclick={run}
    class="flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm
           {status === 'failed'
      ? 'bg-pretty-red/20 text-pretty-red'
      : status === 'copied'
        ? 'bg-pretty-green/20 text-pretty-green'
        : 'bg-pretty-theme/20 hover:bg-pretty-theme/30 text-pretty-theme'}"
  >
    <span class="font-symbol text-base">
      {status === "copied" ? "check" : status === "failed" ? "error" : "stethoscope"}
    </span>
    {status === "copied"
      ? "Copied to clipboard"
      : status === "failed"
        ? "Could not copy, select the text below"
        : "Run & Copy Diagnostics"}
  </button>

  {#if report}
    <!-- readonly rather than disabled: disabled textareas cannot be selected, which is the whole
         point of showing it when the clipboard write failed. -->
    <textarea
      readonly
      value={report}
      rows="16"
      onclick={(e: MouseEvent) => (e.currentTarget as HTMLTextAreaElement).select()}
      class="w-full p-3 rounded-lg bg-theme-neutral-100 border border-theme-neutral-200
             font-mono text-xs whitespace-pre overflow-auto resize-y"
    ></textarea>
  {/if}
</div>
