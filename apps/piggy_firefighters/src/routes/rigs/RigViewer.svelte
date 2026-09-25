<script lang="ts">
	// Loads the rig index that ships next to the exported rigs, then mounts the stage.
	import { onMount } from 'svelte';
	import { base } from '$app/paths';

	import RigStage from './RigStage.svelte';
	import type { RigIndex } from './types';

	let index = $state<RigIndex | undefined>();
	let failure = $state('');
	let rigId = $state('');

	onMount(async () => {
		try {
			const response = await fetch(`${base}/assets/spine/index.json`, { cache: 'no-store' });
			if (!response.ok) throw new Error(`index.json ${response.status}`);
			index = (await response.json()) as RigIndex;
			const wanted = new URLSearchParams(location.search).get('rig');
			rigId = index.rigs.find((rig) => rig.id === wanted)?.id ?? index.rigs[0].id;
		} catch (error) {
			failure = String(error);
		}
	});
</script>

<div class="rigs-root">
	{#if failure}
		<p class="rigs-fail">Rig preview could not load: {failure}</p>
	{:else if index && rigId}
		{#key rigId}
			<RigStage {index} {rigId} onrig={(id) => (rigId = id)} />
		{/key}
	{/if}
</div>

<style>
	.rigs-root {
		position: fixed;
		inset: 0;
		z-index: 2147483647;
		background: #0c2740;
		color: #f6ead2;
		font: 13px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace;
		overflow: hidden;
	}
	.rigs-fail {
		padding: 24px;
		color: #ffb4a0;
	}
</style>
