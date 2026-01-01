<script lang="ts">
  type Props = {
    children?: any;
  };

  let { children }: Props = $props();
</script>

<div class="flex flex-1 flex-row justify-between gap-2">
  {@render children?.()}
</div>
