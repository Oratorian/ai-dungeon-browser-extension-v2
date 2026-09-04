<script lang="ts">
  import { collectDiagnostics, copyText } from "@/shared/diagnostics";

  // "Run & Copy Diagnostics" for support threads: one click gathers the report and puts it on the
  // clipboard, ready to paste into Discord. The report is also shown inline, both so the user can
  // see exactly what they are about to share (it goes into a public thread) and so they can select
  // it by hand if the clipboard is unavailable.

  let report = $state("");
  let status = $state<"idle" | "running" | "copied" | "failed">("idle");
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  // Kept for the hint below: a long report has to be pasted as a file or split across messages.
  const DISCORD_LIMIT = 1900; // 2000, less room for the code fence

  async function run() {
    clearTimeout(resetTimer);
    status = "running";

    try {
      // Collecting is async: it fetches one portrait to prove the images are actually reachable.
      report = await collectDiagnostics();
      status = (await copyText(report)) ? "copied" : "failed";
    } catch (error) {
      report = "Diagnostics failed to run: " + (error instanceof Error ? error.message : String(error));
      status = "failed";
    }

    resetTimer = setTimeout(() => (status = "idle"), 5000);
  }

  const label = $derived(
    status === "running"
      ? "Checking..."
      : status === "copied"
        ? "Copied to clipboard"
        : status === "failed"
          ? "Could not copy, select the text below"
          : "Run & Copy Diagnostics"
  );

  const icon = $derived(
    status === "running" ? "hourglass" : status === "copied" ? "check" : status === "failed" ? "error" : "stethoscope"
  );
</script>

<div class="flex flex-col gap-3">
  <p class="text-sm text-theme-neutral-700">
    Checks whether AI Dungeon's page still looks the way the extension expects, whether your card
    images can actually be loaded, and whether your own settings would hide icons or portraits.
    Copies a report you can paste into a support thread. It contains counts only, never card names,
    story text, or image links.
  </p>

  <button
    onclick={run}
    disabled={status === "running"}
    class="flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm disabled:opacity-60
           {status === 'failed'
      ? 'bg-pretty-red/20 text-pretty-red'
      : status === 'copied'
        ? 'bg-pretty-green/20 text-pretty-green'
        : 'bg-pretty-theme/20 hover:bg-pretty-theme/30 text-pretty-theme'}"
  >
    <span class="font-symbol text-base">{icon}</span>
    {label}
  </button>

  {#if report}
    <!-- readonly rather than disabled: disabled textareas cannot be selected, which is the whole
         point of showing it when the clipboard write failed. -->
    <textarea
      readonly
      value={report}
      rows="18"
      onclick={(e: MouseEvent) => (e.currentTarget as HTMLTextAreaElement).select()}
      class="w-full p-3 rounded-lg bg-theme-neutral-100 border border-theme-neutral-200
             font-mono text-xs whitespace-pre overflow-auto resize-y"
    ></textarea>

    {#if report.length > DISCORD_LIMIT}
      <p class="text-xs text-theme-neutral-700">
        This report is {report.length} characters, which is over Discord's message limit. Paste it as a
        file attachment, or send the Findings block on its own.
      </p>
    {/if}
  {/if}
</div>
