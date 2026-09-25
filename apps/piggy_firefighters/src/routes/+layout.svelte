<script lang="ts">
	/**
	 * Root layout. Two paths:
	 *  - the GAME (every route but /rigs): the whole game shell — publisher bumper, game context,
	 *    Authenticate, HUD, Splash, NoSelect — lives in components/GameShell.svelte and is imported
	 *    LAZILY here, so nothing of it (not even the HUD stylesheet or the bumper's module code) is
	 *    evaluated on the viewer route;
	 *  - the DEV-ONLY /rigs rig viewer (Codex's lane, src/routes/rigs/**): render the route's children
	 *    only. No game canvas, no context, no HUD. tools/build_dist.sh moves src/routes/rigs out of the
	 *    tree before building, so the shipped bundle never carries the viewer route; this branch is then
	 *    dead code in production.
	 */
	import { type Snippet } from 'svelte';
	import { page } from '$app/state';

	type Props = { children: Snippet };
	const props: Props = $props();

	const isRigsViewer = $derived(page.url.pathname.replace(/\/+$/, '').endsWith('/rigs') || page.url.pathname.includes('/rigs/'));
</script>

<svelte:head>
	<title>PIGGY FIREFIGHTERS</title>
</svelte:head>

{#if isRigsViewer}
	{@render props.children()}
{:else}
	{#await import('../components/GameShell.svelte') then { default: GameShell }}
		<GameShell>{@render props.children()}</GameShell>
	{/await}
{/if}
