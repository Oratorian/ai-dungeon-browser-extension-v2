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
    <Field label="Size" info="Customize the size <u>(px)</u> of the inline icons!">
      <Slider bind:value={$settings.iconSize} min={0} max={40} />
    </Field>

    <Field label="Roundness" info="Customize the roundness <u>(%)</u> of the inline icons!">
      <Slider bind:value={$settings.iconRoundness} />
    </Field>

    <Field label="Thickness" info="Customize the thickness <u>(px)</u> of the icon borders!">
      <Slider bind:value={$settings.iconThickness} min={0} max={16} />
    </Field>

    <Field label="Color" info="Customize the color of the text and their icons!">
      <Color bind:value={$settings.iconColor} />
    </Field>
  </Item>

  <Item foldout icon="tooltip" label="Tooltip">
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

<Field label="Other Features">
  <Item foldout icon="markdown" label="Markdown">
    <Field
      label="Enabled"
      info="Toggle whether Markdown formatting is applied, with rules for:<br>- <b>Bold</b>:(`**` or `__`)<br>- <i>Italic</i>: (`*` or `_`)<br>- <s>Strikethrough</s>: (`~~`)<br>- <u>Underline</u>: (`~`)"
    >
      <Switch />
    </Field>
  </Item>

  <Item foldout icon="visibility" label="Focus">
    <Field
      label="Enabled"
      info="Toggle whether the focus feature is active, which:<br>- Allows you to pin <u>Graphics</u><br>- Enables <u>SFX</u> playback"
    >
      <Switch />
    </Field>
  </Item>

  <Item foldout icon="art_track" label="Image Gen">
    <Field label="Enabled" info="">
      <Switch />
    </Field>
  </Item>
</Field>
