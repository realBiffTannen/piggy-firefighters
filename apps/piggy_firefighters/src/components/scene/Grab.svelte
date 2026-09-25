<script lang="ts">
	// Hands the enclosing pixi-svelte <Container>'s live PIXI.Container to the
	// caller, so per-frame motion can be written straight onto the display object
	// from ONE ticker callback instead of through 60 Hz reactive props.
	import { getContextParent } from 'pixi-svelte';

	type Props = { ongrab: (node: any) => void };
	const { ongrab }: Props = $props();
	ongrab(getContextParent().parent);
</script>
