<script lang="ts">
  import Color from "@/components/color.svelte";
  import Field from "@/components/field.svelte";
  import ImageLibrary from "@/components/image_library.svelte";
  import Input from "@/components/input.svelte";
  import Item from "@/components/item.svelte";
  import Row from "@/components/row.svelte";
  import Select from "@/components/select.svelte";
  import Switch from "@/components/switch.svelte";
</script>

<Item foldout icon="edit" label="Basics">
  <Row>
    <Field label="Name">
      <Input />
    </Field>
    <Field label="Type">
      <Select />
    </Field>
  </Row>
  <Field label="Triggers">
    <Input />
  </Field>
</Item>

<Item foldout icon="gradient" label="Color">
  <Field label="Custom Color">
    <Switch />
  </Field>

  <Field label="Custom Color">
    <Color />
  </Field>
</Item>

<Item foldout icon="image" label="Media">
  <Field label="Icons">
    <ImageLibrary label="Icon" maxImages={6} />
  </Field>
  <Field label="Graphics">
    <ImageLibrary label="Graphic" maxImages={4} />
  </Field>
</Item>
