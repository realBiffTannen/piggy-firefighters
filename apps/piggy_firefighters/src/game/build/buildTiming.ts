/**
 * Central timing for the Hold & Build / Golden Build scene. Every hold in the
 * director and every tween in HouseView reads its duration through here, so the
 * three presentation modes stay coherent:
 *
 *   - normal:          authored durations (animation guide section 3 / 10)
 *   - turbo:           holds shortened, event ORDER preserved (stateBet.isTurbo)
 *   - reduced motion:  stable poses, brief fades, instant readable tier/prize
 *
 * Durations are in milliseconds. `hold()` is for director pauses; `dur()` scales
 * a tween duration. Reduced motion collapses tweens to a brief fade and holds to
 * near-zero so the round stays readable without motion.
 */
import { stateBet } from 'state-shared';

export const prefersReducedMotion = (): boolean => {
	try {
		return (
			typeof window !== 'undefined' &&
			window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
		);
	} catch {
		return false;
	}
};

export const isTurbo = (): boolean => stateBet.isTurbo === true;

/** Tween duration in ms, scaled for the active mode. `min` is the reduced-motion
 *  fade floor (kept small but non-zero so a change is still perceptible). */
export const dur = (ms: number, { reducedFade = 120 } = {}): number => {
	if (prefersReducedMotion()) return reducedFade;
	if (isTurbo()) return Math.round(ms * 0.45);
	return ms;
};

/** A director hold (a pause between beats) in ms. Reduced motion ~ instant. */
export const hold = (ms: number): number => {
	if (prefersReducedMotion()) return 0;
	if (isTurbo()) return Math.round(ms * 0.4);
	return ms;
};

/** Per-cell reveal stagger so 15 doors stay readable without a long serial wait.
 *  Bounded: shrinks as the door count grows and collapses under turbo / reduced
 *  motion. */
export const doorStagger = (count: number): number => {
	if (prefersReducedMotion()) return 0;
	const base = isTurbo() ? 55 : 180;
	// keep the whole sweep under ~2.4s even at 15 doors
	return Math.min(base, Math.floor((isTurbo() ? 700 : 2400) / Math.max(count, 1)));
};

// Holds for the Hold & Build / Golden Build round. Owner feedback (2026-09-19): the
// bonus felt rushed, so every beat gets room to land — most of all the pause after a
// spin settles and the beats around hats, the extra spin and the door reveals. Turbo
// and reduced motion still scale these through hold() / dur().
export const BONUS_TIMING = {
	introHold: () => hold(1200),
	outroHold: () => hold(1000),
	spinSettle: () => hold(420),
	betweenHats: () => hold(240),
	extraSpinBeat: () => hold(800),
	doorHold: () => hold(480),
	collectHold: () => hold(320),
	grandOpeningHold: () => hold(1700),
	totalHold: () => hold(1700),
};

// DEV ONLY: lets the QA capture driver (qa/tags_0919/bonus_scene/drive.mjs --turbo) switch turbo on
// without hunting for the HUD control. Stripped from production builds.
if (typeof window !== 'undefined' && import.meta.env?.DEV) {
	(window as unknown as { __pwSetTurbo?: (on: boolean) => void }).__pwSetTurbo = (on: boolean) => {
		stateBet.isTurbo = on;
	};
}
