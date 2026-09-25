/**
 * The two ambient beats of docs/ANIMATION_CONTRACT.md that no book event fires: `idle {seconds}` every 10 s of a
 * resting board (ambient loops) and `reducedMotion {on}` when the OS setting changes. Started once by Game.svelte.
 */
import { boardLife } from '../reels/boardLife';
import { featureOwnsInput } from '../rescue/stateRescue.svelte';
import { animBeats } from './animBeats';

const IDLE_EVERY_MS = 10000;

export const startBeatClock = (): (() => void) => {
	if (typeof window === 'undefined') return () => {};
	let idleMs = 0;
	let last = performance.now();
	const timer = setInterval(() => {
		const now = performance.now();
		const dt = now - last;
		last = now;
		if (boardLife.idle && !featureOwnsInput()) {
			idleMs += dt;
			if (idleMs >= IDLE_EVERY_MS) {
				idleMs -= IDLE_EVERY_MS;
				animBeats.emit({ beat: 'idle', seconds: IDLE_EVERY_MS / 1000 });
			}
		} else idleMs = 0;
	}, 1000);

	let media: MediaQueryList | undefined;
	const onChange = (e: MediaQueryListEvent) => animBeats.emit({ beat: 'reducedMotion', on: e.matches });
	try {
		media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
		media?.addEventListener?.('change', onChange);
	} catch {
		/* no matchMedia: the setting never changes */
	}
	return () => {
		clearInterval(timer);
		media?.removeEventListener?.('change', onChange);
	};
};
