<script lang="ts">
  /* Components */
  import Color from "@/components/color.svelte";
  import Field from "@/components/field.svelte";
  import Item from "@/components/item.svelte";
  import Slider from "@/components/slider.svelte";
  import Switch from "@/components/switch.svelte";
  import AudioLibrary from "@/components/audio_library.svelte";

  /* Storage */
  import { settings } from "@/utils/storage";
</script>

<Field label="Icons, Text & Tooltips">
  <Item foldout icon="sticker" label="Icons">
    <Field label="Size" info="This is a placeholder!">
      <Slider bind:value={$settings.iconSize} min={0} max={40} />
    </Field>

    <Field label="Roundness" info="This is a placeholder!">
      <Slider bind:value={$settings.iconRoundness} />
    </Field>

    <Field label="Thickness" info="This is a placeholder!">
      <Slider bind:value={$settings.iconThickness} min={0} max={16} />
    </Field>
  </Item>

  <Item foldout icon="text_fields" label="Text">
    <Field label="Bold Names" info="This is a placeholder!">
      <Switch bind:checked={$settings.highlightBold} />
    </Field>

    <Field label="Markdown Formatting" info="This is a placeholder!">
      <Switch bind:checked={$settings.highlightMarkdown} />
    </Field>

    <Field label="Lookback" info="This is a placeholder!">
      <Slider bind:value={$settings.highlightLookback} min={0} max={32} />
    </Field>

    <Field label="Color" info="This is a placeholder!">
      <Color bind:value={$settings.iconColor} />
    </Field>
  </Item>

  <Item foldout icon="tooltip" label="Tooltip">
    <Field label="Allow Focus" info="This is a placeholder!">
      <Switch bind:checked={$settings.highlightFocus} />
    </Field>

    <Field label="Hide Delay" info="This is a placeholder!">
      <Slider bind:value={$settings.tooltipDelay} min={0} max={2000} step={25} />
    </Field>

    <Field label="Max Width" info="This is a placeholder!">
      <Slider bind:value={$settings.tooltipWidth} min={0} max={1280} step={32} />
    </Field>

    <Field label="Max Height" info="This is a placeholder!">
      <Slider bind:value={$settings.tooltipHeight} min={0} max={1280} step={32} />
    </Field>
  </Item>
</Field>

<Field label="Audio">
  <Item foldout icon="cadence" label="SFX">
    <Field label="Volume">
      <Slider bind:value={$settings.volume} />
    </Field>
    <AudioLibrary />
  </Item>
</Field>
