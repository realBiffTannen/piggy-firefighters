/**
 * The game-owned play notice (components/notice/PlayNotice.svelte) — its one reactive state.
 *
 * Read by the HUD's spacebar guard (`hud.config.ts` `modalOpen`) and by the alert cue (components/AlertSound.svelte),
 * so neither has to watch the SDK modal slot the notice empties on the way in.
 */
export type NoticeMessage = 'insufficientFunds' | 'lossLimitReached' | 'singleWinLimitReached';

export const stateNotice = $state({
	open: false,
	message: null as NoticeMessage | null,
	/** true only when an autoplay run really stopped (the HUD's `autoStoppedNotice`, or an autoplay limit) */
	autoStopped: false,
	/** social vocabulary at the moment the notice was raised */
	social: false,
});

export const closeNotice = () => {
	stateNotice.open = false;
};
