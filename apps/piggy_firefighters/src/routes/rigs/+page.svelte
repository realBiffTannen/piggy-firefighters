<script lang="ts">
	import { dev } from '$app/environment';
</script>

{#if dev}
	{#await import('./RigViewer.svelte') then viewer}
		<viewer.default />
	{/await}
{/if}
