<script lang="ts">
	import { OnMount } from 'components-shared';

	import { getContext } from '../game/context';
	import { gameSound } from '../game/audio';
	import { pushAnticipationCamera, releaseAnticipationCamera } from '../game/reels/anticipationCamera.svelte';
	import Anticipation from './Anticipation.svelte';

	const context = getContext();
	const hasAnticipation = $derived(
		context.stateGame.board.some((reel) => reel.reelState.anticipating),
	);
</script>

{#if hasAnticipation}
	<OnMount
		onmount={() => {
			// Anticipation drives the tension LAYER over the base bed on the ONE
			// audio manager (no donor Howler loop, no bed swap), and pushes the board
			// camera in (game/reels/anticipationCamera.svelte.ts). Both are owned HERE
			// rather than per reel, so several held reels are one push and one riser,
			// and a torn-down round still lets the camera back out.
			gameSound.anticipationOn();
			pushAnticipationCamera();
			return () => {
				gameSound.anticipationOff();
				releaseAnticipationCamera();
			};
		}}
	/>
{/if}

{#each context.stateGame.board as reel}
	{#if reel.reelState.anticipating}
		<Anticipation {reel} oncomplete={() => (reel.reelState.anticipating = false)} />
	{/if}
{/each}
