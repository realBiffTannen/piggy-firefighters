<script lang="ts">
  import { onMount } from 'svelte';
  import { PIXI, getContextParent } from 'pixi-svelte';
  const props: { width: number; height: number } = $props();
  const parent = getContextParent().parent;
  const mask = new PIXI.Graphics();
  $effect(() => {
    mask.clear().rect(0, 0, Math.max(0, props.width), Math.max(0, props.height)).fill(0xffffff);
  });
  onMount(() => {
    parent.addChild(mask);
    parent.mask = mask;
    return () => {
      if (!parent.destroyed) parent.mask = null;
      if (!mask.destroyed) mask.destroy();
    };
  });
</script>
