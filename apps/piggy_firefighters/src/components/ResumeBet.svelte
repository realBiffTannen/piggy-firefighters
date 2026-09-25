<script lang="ts">
	import { stateBet, stateReplay } from 'state-shared';
	import { getContext } from '../game/context';
	import { onMount } from 'svelte';

	const context = getContext();

	onMount(() => {
		// REPLAY stands down. In replay mode the HUD renders the START REPLAY
		// pre-roll card and owns the round start; broadcasting `resumeBet` here
		// would play the replayed round out BEHIND that card (the same "one press
		// both dismisses the card and starts a round" class the HUD integration
		// guide warns about). The card's own control is the only thing that may
		// start a replay.
		if (stateReplay.active) return;

		if (stateBet.betToResume?.active && stateBet.betToResume.mode) {
			stateBet.activeBetModeKey = stateBet.betToResume.mode;
		}
		context.eventEmitter.broadcast({ type: 'resumeBet' });
	});
</script>
