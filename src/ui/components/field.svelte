<script lang="ts">
  import { Tooltip } from "bits-ui";
  import DOMPurify from "dompurify";

  // A labelled row. When `info` is given the label carries the explanation, and only the label opens
  // it.
  //
  // The whole field used to be the tooltip trigger, which had two problems. The tooltip opened when
  // you hovered the control itself and then covered it, so a text input became unusable while you
  // were pointing at the thing you wanted to type in. And bits-ui renders a trigger as a <button>,
  // so every input, slider and switch was nested inside one, which is invalid and swallows clicks.
  //
  // Now the trigger wraps only the label, and the children sit outside it.

  type Props = {
    label: string;
    info?: string;
    children?: any;
  };

  let { label, info, children }: Props = $props();

  // `info` is developer-authored and may contain simple formatting HTML (<b>, <br>, <code>...).
  // Sanitize before rendering so this {@html} sink stays safe if `info` ever becomes dynamic.
  let safeInfo = $derived(info ? DOMPurify.sanitize(info) : "");
</script>

<div class="flex flex-col w-full h-fit gap-2">
  {#if info}
    <Tooltip.Provider>
      <Tooltip.Root delayDuration={200}>
        <Tooltip.Trigger
          class="flex items-center gap-1 place-self-start ml-4 text-theme-neutral-800 uppercase font-bold text-xs cursor-help"
        >
          {label}
          <!-- Without this there is nothing to say the explanation exists, since the label no longer
               covers the whole row. -->
          <span class="font-symbol text-sm opacity-60">info</span>
        </Tooltip.Trigger>

        <Tooltip.Content
          side="top"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          class="animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--bits-tooltip-content-transform-origin) z-50"
        >
          <div
            class="bg-theme-neutral-100 shadow-popover outline-hidden block text-start p-4 text-sm font-medium rounded-xl max-w-80"
          >
            {@html safeInfo}
          </div>
        </Tooltip.Content>
      </Tooltip.Root>
    </Tooltip.Provider>
  {:else}
    <span class="place-self-start text-theme-neutral-800 uppercase ml-4 font-bold text-xs">{label}</span>
  {/if}

  {@render children?.()}
</div>
