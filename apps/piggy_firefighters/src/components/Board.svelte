<script lang="ts" module>
	import type { RawSymbol, Position } from '../game/types';

	export type EmitterEventBoard =
		| { type: 'boardSettle'; board: RawSymbol[][] }
		| { type: 'boardShow' }
		| { type: 'boardHide' }
		| {
				type: 'boardWithAnimateSymbols';
				symbolPositions: Position[];
		  };
</script>

<script lang="ts">
	import { waitForResolve } from 'utils-shared/wait';
	import { BoardContext } from 'components-shared';

	import { getContext } from '../game/context';
	import BoardContainer from './BoardContainer.svelte';
	import BoardMask from './BoardMask.svelte';
	import BoardBase from './BoardBase.svelte';
	import ReelStrips from './reels/ReelStrips.svelte';
	import { stateBuild } from '../game/build/stateBuild.svelte';
	import { boardLife } from '../game/reels/boardLife';

	const context = getContext();

	// Idle life (components/SymbolSprite.svelte) runs only while NOTHING is happening: the round machine
	// is idle, every reel is at rest and no bonus scene is up. Mirrored into a plain flag so the symbols'
	// ticker never touches the reactive graph.
	$effect(() => {
		boardLife.idle =
			show &&
			!stateBuild.active &&
			context.stateXstateDerived.isIdle() &&
			context.stateGame.board.every((reel) => reel.reelState.motion === 'stopped');
		return () => (boardLife.idle = false);
	});

	let show = $state(true);

	context.eventEmitter.subscribeOnMount({
		stopButtonClick: () => context.stateGameDerived.enhancedBoard.stop(),
		boardSettle: ({ board }) => context.stateGameDerived.enhancedBoard.settle(board),
		boardShow: () => (show = true),
		boardHide: () => {
			show = false;
			// reels still streaming with no book (a bought round has no `reveal`) stop under the cover
			context.stateGameDerived.enhancedBoard.park();
		},
		boardWithAnimateSymbols: async ({ symbolPositions }) => {
			const getPromises = () =>
				symbolPositions.map(async (position) => {
					const reelSymbol = context.stateGame.board[position.reel].reelState.symbols[position.row];
					reelSymbol.symbolState = 'win';
					await waitForResolve((resolve) => (reelSymbol.oncomplete = resolve));
					reelSymbol.symbolState = 'postWinStatic';
				});

			await Promise.all(getPromises());
		},
	});

	context.stateGameDerived.enhancedBoard.readyToSpinEffect();
</script>

{#if show}
	<BoardContext animate={false}>
		<BoardContainer>
			<BoardMask />
			<BoardBase />
			<!-- the travelling strips (pooled sprites, baked motion blur); hidden whenever a reel rests -->
			<ReelStrips />
		</BoardContainer>
	</BoardContext>

	<BoardContext animate={true}>
		<BoardContainer>
			<BoardBase />
		</BoardContainer>
	</BoardContext>
{/if}
