<script lang="ts">
	// UI FEEDBACK SOUNDS the HUD does not voice itself. The studio HUD only names two button sounds
	// (spin press, everything else), so a bet change, arming the Ante and changing speed all used to
	// produce the same generic click or nothing. This watches the shared state instead and gives each
	// its own designed cue: bet_change pitched by direction, ante_on / ante_off, a rising tick per speed tier.
	import { stateBet } from 'state-shared';

	import { audioManager } from '../game/audio/audioManager';
	import { stateSpeed } from '../game/stateSpeed.svelte';

	let lastBet: number | undefined;
	let lastMode: string | undefined;
	let lastTier: string | undefined;

	$effect(() => {
		const bet = stateBet.betAmount;
		if (lastBet !== undefined && bet !== lastBet && audioManager.isUnlocked) {
			audioManager.playCue('bet_change', { rate: bet > lastBet ? 1.12 : 0.9, family: 'betchange', coalesceMs: 60 });
		}
		lastBet = bet;
	});

	$effect(() => {
		const mode = String(stateBet.activeBetModeKey ?? '').toLowerCase();
		if (lastMode !== undefined && mode !== lastMode && audioManager.isUnlocked) {
			if (mode === 'ante') audioManager.playCue('ante_on');
			else if (lastMode === 'ante') audioManager.playCue('ante_off');
		}
		lastMode = mode;
	});

	$effect(() => {
		const tier = stateSpeed.tier;
		if (lastTier !== undefined && tier !== lastTier && audioManager.isUnlocked) {
			audioManager.playCue('ui_click_2', { rate: tier === 'super' ? 1.5 : tier === 'turbo' ? 1.25 : 1 });
		}
		lastTier = tier;
	});
</script>
