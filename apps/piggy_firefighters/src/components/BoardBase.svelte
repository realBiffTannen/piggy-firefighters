<script lang="ts">
	import ReelSymbol from './ReelSymbol.svelte';
	import ReelColumn from './reels/ReelColumn.svelte';
	import { getContext } from '../game/context';

	const context = getContext();
</script>

{#each context.stateGame.board as reel, reelIndex (reelIndex)}
	<ReelColumn {reelIndex}>
		{#each reel.reelState.symbols as reelSymbol (reelSymbol.row)}
			<ReelSymbol {reelIndex} {reelSymbol} />
		{/each}
	</ReelColumn>
{/each}
