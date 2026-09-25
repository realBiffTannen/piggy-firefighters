<script lang="ts" module>
	import type { NoticeMessage } from '../../game/stateNotice.svelte';

	/**
	 * THE WORDS. Every line is legal in BOTH modes: no bet / funds / deposit vocabulary, so the Stake.US
	 * social table and the normal table are satisfied by the same sentence (qa/final_lucky/jurisdiction_r1.md
	 * blocker). The one line the HUD words per mode (its loss limit, HUD_AUTO_LOSS_LIMIT) follows the HUD.
	 */
	export const NOTICE_COPY = {
		header: { notice: 'NOTICE', autoStopped: 'AUTO PLAY HAS STOPPED' },
		insufficientFunds: 'YOUR BALANCE IS TOO LOW FOR THIS ROUND. PLEASE LOWER THE PLAY AMOUNT.',
		lossLimitReached: { std: 'LOSS LIMIT REACHED.', social: 'SPEND LIMIT REACHED.' },
		singleWinLimitReached: 'SINGLE WIN LIMIT REACHED.',
		ok: 'OK',
	} as const;

	export const noticeBody = (message: NoticeMessage, social: boolean): string => {
		if (message === 'lossLimitReached') return NOTICE_COPY.lossLimitReached[social ? 'social' : 'std'];
		return NOTICE_COPY[message];
	};
</script>

<script lang="ts">
	/**
	 * REPLACES THE SDK'S GENERIC INSUFFICIENT-BALANCE POPUP (HUD docs/INTEGRATION.md §6b).
	 *
	 * The HUD answers an unaffordable press (SPIN, Space, autoplay confirm, feature buy, bet-ladder chip) by
	 * writing `stateModal.modal = { name: 'autoSpinMessage', message: 'insufficientFunds' }` into state-shared;
	 * the SDK autoplay machine writes the same slot when a run runs dry or hits a limit. The stock
	 * ModalAutoSpinMessage drew that as "AUTO PLAY HAS STOPPED DUE TO / INSUFFICIENT FUNDS TO PLACE THIS BET…",
	 * which is cash vocabulary in social mode and a false header after a manual press. It is no longer mounted
	 * (Game.svelte mounts ModalError alone); this notice takes the slot instead:
	 *
	 *  - intercepts the write and empties the SDK slot, so no SDK popup paints and the HUD's own
	 *    `sdkModal.modal` term does not stay set after the notice closes;
	 *  - says "AUTO PLAY HAS STOPPED" only when a run really stopped — the HUD's `autoStoppedNotice` flag
	 *    (false for a manual press, true once a confirmed run started) or an autoplay limit, which only the
	 *    autoplay machine raises;
	 *  - holds the HUD's `modalOpen` guard (hud.config.ts) while open, because a scrim stops the pointer but
	 *    nothing else stops Space from placing a bet behind the dialog.
	 */
	import { untrack } from 'svelte';
	import { stateModal as sdkModal } from 'state-shared';
	import { stateHud } from '@crashgalaxy/hud';

	import { stateNotice, closeNotice } from '../../game/stateNotice.svelte';
	import { isSweepsWallet } from '../../game/socialFloor';

	const isNoticeMessage = (m: unknown): m is NoticeMessage =>
		m === 'insufficientFunds' || m === 'lossLimitReached' || m === 'singleWinLimitReached';

	$effect.pre(() => {
		const m = sdkModal.modal;
		if (m?.name !== 'autoSpinMessage' || !isNoticeMessage(m.message)) return;
		const message = m.message;
		untrack(() => {
			stateNotice.message = message;
			stateNotice.autoStopped = message !== 'insufficientFunds' || stateHud.autoStoppedNotice;
			stateNotice.social = stateHud.social || isSweepsWallet();
			stateNotice.open = true;
			sdkModal.modal = null;
		});
	});

	const onKey = (event: KeyboardEvent) => {
		if (!stateNotice.open) return;
		if (event.key === 'Escape' || event.key === 'Enter') {
			event.preventDefault();
			closeNotice();
		}
	};
</script>

<svelte:window onkeydown={onKey} />

{#if stateNotice.open && stateNotice.message}
	<div class="play-notice" data-test="play-notice">
		<button class="play-notice__scrim" type="button" tabindex="-1" aria-label={NOTICE_COPY.ok} onclick={closeNotice}></button>
		<div class="play-notice__card" role="alertdialog" aria-modal="true" aria-labelledby="play-notice-title" aria-describedby="play-notice-body">
			<h2 id="play-notice-title" class="play-notice__title" data-test="play-notice-title">
				{stateNotice.autoStopped ? NOTICE_COPY.header.autoStopped : NOTICE_COPY.header.notice}
			</h2>
			<p id="play-notice-body" class="play-notice__body" data-test="play-notice-body">
				{noticeBody(stateNotice.message, stateNotice.social)}
			</p>
			<button class="play-notice__ok" type="button" data-test="play-notice-ok" onclick={closeNotice}>{NOTICE_COPY.ok}</button>
		</div>
	</div>
{/if}

<style>
	.play-notice {
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
		font-family: 'Inter', system-ui, sans-serif;
		touch-action: manipulation;
	}
	.play-notice__scrim {
		position: absolute;
		inset: 0;
		border: 0;
		padding: 0;
		margin: 0;
		background: rgba(0, 0, 0, 0.55);
		cursor: default;
	}
	.play-notice__card {
		position: relative;
		box-sizing: border-box;
		width: min(420px, 100%);
		padding: 22px 22px 18px;
		border-radius: 14px;
		border: 1px solid var(--cg-color-gold-40, rgba(245, 197, 25, 0.4));
		background: rgba(12, 8, 6, 0.94);
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
		color: var(--cg-color-white, #fff);
		text-align: center;
	}
	.play-notice__title {
		margin: 0 0 12px;
		font-family: 'Lilita One', 'Inter', system-ui, sans-serif;
		font-weight: 400;
		font-size: 22px;
		letter-spacing: 0.6px;
		color: var(--cg-color-gold, #f5c519);
	}
	.play-notice__body {
		margin: 0 0 18px;
		font-size: 14px;
		font-weight: 700;
		line-height: 1.45;
		letter-spacing: 0.3px;
	}
	.play-notice__ok {
		min-width: 120px;
		padding: 10px 22px;
		border: 0;
		border-radius: 999px;
		background: var(--cg-color-gold, #f5c519);
		color: #1a1206;
		font-family: 'Lilita One', 'Inter', system-ui, sans-serif;
		font-size: 17px;
		letter-spacing: 0.5px;
		cursor: pointer;
	}
</style>
