<script lang="ts">
	import { getContextApp } from 'pixi-svelte';

	const context = getContextApp();

	// @ts-ignore
	// Pixi devtools hook: dev server only, never a global on a shipped build
	if (import.meta.env.DEV) globalThis.__PIXI_APP__ = context.stateApp.pixiApplication;
</script>
