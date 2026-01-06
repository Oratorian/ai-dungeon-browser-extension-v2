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
    <Field label="Size" info="Icon size in pixels">
      <Slider bind:value={$settings.iconSize} min={0} max={40} />
    </Field>

    <Field label="Roundness" info="Icon roundness percentage">
      <Slider bind:value={$settings.iconRoundness} />
    </Field>

    <Field label="Thickness" info="Icon border thickness in pixels">
      <Slider bind:value={$settings.iconThickness} min={0} max={16} />
    </Field>
  </Item>

  <Item foldout icon="text_fields" label="Text">
    <Field label="Bold Names" info="Whether highlighted names <b>are bold</b>">
      <Switch bind:checked={$settings.highlightBold} />
    </Field>

    <Field
      label="Markdown Formatting"
      info="Whether custom formatting is applied, with rules for:<br>- <b>Bold</b> <code>(**)</code><br>- <b>Italic</b> <code>(*)</code><br>- <b>Underline</b> <code>(~)</code><br>- <b>Strikethrough</b> <code>(~~)</code>"
    >
      <Switch bind:checked={$settings.highlightMarkdown} />
    </Field>

    <Field label="Color" info="Default color value for new cards">
      <Color bind:value={$settings.iconColor} />
    </Field>
  </Item>

  <Item foldout icon="tooltip" label="Tooltip">
    <Field label="Hide Delay" info="Amount of milliseconds after which the tooltip hides itself">
      <Slider bind:value={$settings.tooltipDelay} min={0} max={2000} step={25} />
    </Field>

    <Field label="Max Width" info="Maximum width of the tooltip">
      <Slider bind:value={$settings.tooltipWidth} min={0} max={1280} step={32} />
    </Field>

    <Field label="Max Height" info="Maximum height of the tooltip">
      <Slider bind:value={$settings.tooltipHeight} min={0} max={1280} step={32} />
    </Field>
  </Item>
</Field>

<Item foldout icon="eye_tracking" label="Focus">
  <Field
    label="Allow Focus"
    info="Whether to enable the focus system which allows you to:<br>- Hover over a highlighted text thingy<br>- See the <span class='de-icon-tip'>eye_tracking</span> in the upper right corner<br>- Click it to pin its graphic to the last response<br>- <em>Also enables the SFX feature for ambience</em>"
  >
    <Switch bind:checked={$settings.highlightFocus} />
  </Field>

  <Field label="Max Height" info="Maximum height of the focus container">
    <Slider bind:value={$settings.focusHeight} max={1280} />
  </Field>
</Item>

<Field label="Audio">
  <Item foldout icon="cadence" label="SFX">
    <Field label="Volume">
      <Slider bind:value={$settings.volume} />
    </Field>
    <AudioLibrary />
  </Item>
</Field>
