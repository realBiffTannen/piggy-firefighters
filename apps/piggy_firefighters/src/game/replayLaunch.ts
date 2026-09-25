/**
 * IS THIS SESSION A REPLAY?
 *
 * Read straight off `window.location.search`, not off `stateUrlDerived.replay()`,
 * for one reason: the publisher bumper is mounted from the FIRST statement of
 * `+layout.svelte`'s module body, before any SvelteKit store is a safe read.
 * Both callers (the bumper's `skip`, the splash's auto-hand-off) need the same
 * answer at that moment, so the question is asked of the URL itself.
 *
 * The app is `ssr = false`, so `window` is always there; the guard is for
 * unit/Storybook contexts that import this module without a document.
 *
 * WHY A REPLAY LAUNCHES DIFFERENTLY (owner, 2026-09-20). A replay link is
 * opened to inspect ONE recorded round. The player did not come for the brand
 * bumper, the advert deck or a press-anywhere gate — they came for the round.
 * So a replay session shows no publisher bumper and no loading splash: the
 * board is revealed as soon as it can draw, un-started, and the HUD's replay
 * bar plus its START REPLAY pre-roll card come up over it in the same frame.
 * Normal play is untouched — it keeps the bumper, the splash and the press.
 */
export const isReplayLaunch = (): boolean => {
	try {
		if (typeof window === 'undefined') return false;
		return new URLSearchParams(window.location.search).get('replay') === 'true';
	} catch {
		return false;
	}
};
