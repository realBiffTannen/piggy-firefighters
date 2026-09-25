<script lang="ts">
	import type { Snippet } from 'svelte';

	import { Container } from 'pixi-svelte';

	type Props = {
		x: number;
		y: number;
		/** which of the two stacked boards is showing this symbol right now (see ReelSymbol.svelte) */
		show: boolean;
		children: Snippet;
	};

	const props: Props = $props();
</script>

<Container x={props.x} y={props.y} visible={props.show}>
	{@render props.children()}
</Container>
