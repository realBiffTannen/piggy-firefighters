/**
 * ANTICIPATION CAMERA — a slow push on the board while a reel is held.
 *
 * When a reel goes into anticipation the board eases IN a few percent and holds there; when the
 * hold resolves it eases back out, faster than it came. The push is deliberately small: the board
 * sits inside a painted timber frame (components/BoardFrame.svelte) and above the HUD, so anything
 * larger crowds both. Everything that draws in board space reads the zoom through
 * `boardLayout().zoomScale / .zoomScaleXY`, so the frame, the symbols, the board FX, the feature
 * drops and the anticipation dressing all push together and cannot drift apart.
 *
 * `boardLayout().scale / .scaleXY` are left ALONE: those are the layout truth that the HUD chip
 * collision (hud.config.ts) and the bonus scene measure against, and they must not breathe.
 *
 * The zoom feeds reactive <Container> props rather than a PIXI object written from a ticker, which
 * is against this game's usual rule. It is allowed here because it is a handful of containers for
 * a couple of seconds on a rare beat, and because writes are quantised (`EPSILON`) so a frame that
 * moves the zoom by less than a tenth of a percent invalidates nothing.
 */
import { boardTicker } from './boardTicker';
import { prefersReducedMotion } from '../fx/timing';
import { isSuperTurbo } from '../stateSpeed.svelte';

/** Peak push. Keep small — see the note about the timber frame above. */
const ZOOM_IN = 1.07;
/** Exponential approach time constants (ms): slow in, quicker out. */
const TAU_IN = 620;
const TAU_OUT = 220;
/** Writes smaller than this are skipped (see the note about reactive props above). */
const EPSILON = 0.0015;

export const anticipationCamera = $state({ zoom: 1 });

let target = 1;
let current = 1;
let running = false;

const stop = () => {
	if (!running) return;
	running = false;
	boardTicker.remove(tick);
};

function tick(dt: number) {
	const tau = target > current ? TAU_IN : TAU_OUT;
	current += (target - current) * (1 - Math.exp(-dt / tau));

	if (target === 1 && Math.abs(current - 1) < EPSILON) {
		current = 1;
		if (anticipationCamera.zoom !== 1) anticipationCamera.zoom = 1;
		stop();
		return;
	}
	if (Math.abs(current - anticipationCamera.zoom) >= EPSILON) anticipationCamera.zoom = current;
}

const start = () => {
	if (running) return;
	running = true;
	boardTicker.add(tick);
};

/** A reel has gone into anticipation: push in. */
export const pushAnticipationCamera = () => {
	// Reduced motion gets no camera move at all; Super Turbo is a cadence-measured path
	// (tools/sec7walk/probe-super-turbo-cadence.mjs) and keeps the board still.
	if (prefersReducedMotion() || isSuperTurbo()) {
		target = 1;
		return;
	}
	target = ZOOM_IN;
	start();
};

/** The hold is over (resolved, slammed, or the round was torn down): ease back out. */
export const releaseAnticipationCamera = () => {
	target = 1;
	if (current !== 1 || anticipationCamera.zoom !== 1) start();
};
