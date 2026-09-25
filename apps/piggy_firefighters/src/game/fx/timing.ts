/**
 * Central timing for the feature scenes (Rescue / Inferno / Backdraft Spins / Alarm Call). Every hold in the
 * rescue director and every feature tween reads its duration through here, so the three presentation modes stay
 * coherent:
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

// DEV ONLY: lets a QA capture driver (qa/smoke/port/smoke.mjs) switch turbo on
// without hunting for the HUD control. Stripped from production builds.
if (typeof window !== 'undefined' && import.meta.env?.DEV) {
	(window as unknown as { __pffSetTurbo?: (on: boolean) => void }).__pffSetTurbo = (on: boolean) => {
		stateBet.isTurbo = on;
	};
}
