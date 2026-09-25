<script lang="ts">
	import { onMount } from 'svelte';

	/**
	 * THE ANTE CHOOSER CONFIRMS BEFORE IT ARMS (gate loop r1, precheck Finding 1).
	 *
	 * LUCKY offers two `activate` tiers (LUCKY ANTE 3x, DRAGON ANTE 10x), so the HUD's ante chip opens its
	 * CHOOSER, and one press on a tier row armed that cost straight away: the next /wallet/play was
	 * SUPER_ANTE with no confirm or cancel step, and 3x -> 10x was one press too. Stake's reviewers ask
	 * that high-cost modes confirm before activation; the buy sheet already does (ACTIVATE, then ✓ / ✕).
	 *
	 * The chooser lives in the protected HUD package (../crashgalaxy-hud), so the confirmation is added
	 * here, on LUCKY's side of the seam, without editing it: a capture-phase click listener at the window
	 * runs before the HUD's own handler. A press on a tier row that is NOT the active one is held back
	 * and the row is marked `data-lucky-confirm` (its price reads "CONFIRM <price>"); a second press on
	 * the SAME row lets the HUD's handler run and arm it. A press anywhere else, a different row, NO ANTE
	 * or closing the chooser stands the pending row down (the element is gone when the chooser closes,
	 * so a reopened chooser always starts unarmed). Turning the ante OFF (NO ANTE) stays one press: it
	 * lowers what the next round costs. Keyboard activation of a button is a click, so it is covered.
	 */
	const TIER = '.ante-picker__tier[data-ante-tier]';
	const MARK = 'data-lucky-confirm';

	onMount(() => {
		let armed: HTMLElement | null = null;

		const disarm = () => {
			if (!armed) return;
			armed.removeAttribute(MARK);
			armed.removeAttribute('aria-label');
			armed = null;
		};

		const onClick = (event: MouseEvent) => {
			const target = event.target as Element | null;
			const row = target?.closest?.(TIER) as HTMLElement | null;
			if (!row) {
				disarm();
				return;
			}
			if (row.getAttribute('aria-pressed') === 'true' || row.hasAttribute('disabled')) {
				// already the active tier (no cost change) or locked: the HUD decides
				disarm();
				return;
			}
			if (armed === row && row.isConnected) {
				// the confirming press: let the HUD arm it
				disarm();
				return;
			}
			// the first press on a costlier (or different) tier: hold it back and ask for the confirm
			event.preventDefault();
			event.stopImmediatePropagation();
			disarm();
			armed = row;
			row.setAttribute(MARK, 'true');
			const name = row.querySelector('.ante-picker__name')?.textContent?.trim() ?? '';
			const price = row.querySelector('.ante-picker__price')?.textContent?.trim() ?? '';
			row.setAttribute('aria-label', `Confirm ${name} ${price}`.replace(/\s+/g, ' ').trim());
		};

		window.addEventListener('click', onClick, true);
		return () => {
			window.removeEventListener('click', onClick, true);
			disarm();
		};
	});
</script>

<style>
	:global(.ante-picker__tier[data-lucky-confirm]) {
		border-color: rgba(255, 201, 60, 1) !important;
		background: rgba(214, 42, 42, 0.32) !important;
	}
	:global(.ante-picker__tier[data-lucky-confirm] .ante-picker__price::before) {
		content: 'CONFIRM ';
		color: #ffc93c;
	}
</style>
