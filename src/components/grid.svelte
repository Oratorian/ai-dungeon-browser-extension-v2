<script lang="ts">
  type Props = {
    children?: any;
  };

  let { children }: Props = $props();
</script>

<div class="grid grid-cols-2 gap-2 w-full h-fit flex-1 box-border">
  {@render children?.()}
</div>
