<script lang="ts">
	import { getContextBoard } from 'components-shared';

	import Symbol from './Symbol.svelte';
	import SymbolWrap from './SymbolWrap.svelte';
	import { getSymbolX } from '../game/utils';
	import { SYMBOL_SIZE, BOARD_DIMENSIONS } from '../game/constants';
	import type { ReelSymbol } from '../game/stateGame.svelte';

	type Props = {
		reelIndex: number;
		reelSymbol: ReelSymbol;
	};

	const props: Props = $props();
	const boardContext = getContextBoard();
	// padded row 0 sits above the window, rows 1..3 in it, row 4 below
	const y = $derived((props.reelSymbol.row - 0.5) * SYMBOL_SIZE);
	const inWindow = $derived(props.reelSymbol.row >= 1 && props.reelSymbol.row <= BOARD_DIMENSIONS.y);
	// Two boards are stacked (components/Board.svelte). The MASKED one shows every resting symbol —
	// padded rows included, which the reel's wind-up, overshoot and settle slide into view. A WINNING
	// symbol is shown by its twin on the UNMASKED board instead, because a key pose springs a few px
	// past its cell and the top and bottom rows must not be clipped by the reel window. Both twins stay
	// mounted and only swap visibility: mounting component trees on the win beat cost a 30 ms frame.
	const winning = $derived(props.reelSymbol.symbolState === 'win');
	const active = $derived(boardContext.animate ? winning : !winning);
</script>

{#if !boardContext.animate || inWindow}
	<SymbolWrap x={getSymbolX(props.reelIndex)} {y} show={active}>
		<Symbol
			state={props.reelSymbol.symbolState}
			rawSymbol={props.reelSymbol.rawSymbol}
			quiet={!inWindow}
			{active}
			oncomplete={() => {
				if (props.reelSymbol.symbolState === 'win') props.reelSymbol.oncomplete();
				if (props.reelSymbol.symbolState === 'land') props.reelSymbol.symbolState = 'static';
			}}
		/>
	</SymbolWrap>
{/if}
