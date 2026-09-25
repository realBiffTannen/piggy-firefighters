<script lang="ts">
	// Insufficient-balance alert cue.
	//
	// The studio HUD raises the insufficient-balance notice through the SDK modal
	// state (`stateModal.modal`), not through an emitter event, so the ONE audio
	// manager has no other way to hear it. The game-owned notice
	// (components/notice/PlayNotice.svelte) takes that slot and empties it on the
	// way in, so the cue watches the notice's own state (plus the SDK error modal,
	// which is still the SDK's) and fires `alert_insufficient` EXACTLY ONCE per
	// alert entry (on the closed/other → insufficient transition), never on every
	// render. It draws nothing.
	import { stateModal } from 'state-shared';
	import { gameSound } from '../game/audio';
	import { stateNotice } from '../game/stateNotice.svelte';

	const isInsufficient = (modal: unknown): boolean => {
		if (!modal || typeof modal !== 'object') return false;
		const m = modal as { name?: string; message?: string; error?: unknown };
		if (m.name === 'autoSpinMessage' && m.message === 'insufficientFunds') return true;
		// Some SDK builds surface it as an error modal.
		if (m.name === 'error') {
			const code = String((m.error as { message?: string } | undefined)?.message ?? m.error ?? '');
			if (code.toLowerCase().includes('insufficient')) return true;
		}
		return false;
	};

	let wasInsufficient = false;
	$effect(() => {
		const now =
			(stateNotice.open && stateNotice.message === 'insufficientFunds') || isInsufficient(stateModal.modal);
		if (now && !wasInsufficient) gameSound.alertInsufficient();
		wasInsufficient = now;
	});
</script>
