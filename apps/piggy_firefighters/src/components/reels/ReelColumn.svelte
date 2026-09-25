<script lang="ts">
	// One reel's Svelte-rendered column. Its PIXI container is handed to the reel view so the settle
	// spring (and reduced motion's fade) can move / fade the whole column from the board ticker without
	// a reactive prop: the symbols inside keep their own land / win / idle motion on top.
	import { onMount, type Snippet } from 'svelte';
	import { Container } from 'pixi-svelte';

	import Grab from '../scene/Grab.svelte';
	import { registerReelColumn } from '../../game/reels/reelView';

	type Props = { reelIndex: number; children: Snippet };
	const props: Props = $props();

	/* eslint-disable @typescript-eslint/no-explicit-any */
	let node: any;
	onMount(() => (node ? registerReelColumn(props.reelIndex, node) : undefined));
</script>

<Container>
	<Grab ongrab={(grabbed) => (node = grabbed)} />
	{@render props.children()}
</Container>
