/**
 * ONE ticker for the bonus scene's per-frame motion.
 *
 * The expanded reveal, the camera pull-back, the cell reels and the round-total
 * meter all move display objects DIRECTLY from a single ticker callback — never
 * through 60 Hz reactive props. Tween records are pooled and the step loop
 * allocates nothing.
 *
 *   attachMotion(ticker)   bind to the Pixi ticker (idempotent; rAF fallback)
 *   tween(ms, fn, ease)    run fn(easedProgress) every frame; resolves on the last
 *   addStepper(fn)         a raw per-frame callback (dt in ms); returns a remover
 *   finishAllTweens()      skip / teardown: every tween jumps to its final value
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export type Ease = (p: number) => number;

export const ease = {
	linear: (p: number) => p,
	cubicOut: (p: number) => 1 - Math.pow(1 - p, 3),
	cubicIn: (p: number) => p * p * p,
	cubicInOut: (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
	quintOut: (p: number) => 1 - Math.pow(1 - p, 5),
	quadIn: (p: number) => p * p,
	quadOut: (p: number) => 1 - (1 - p) * (1 - p),
	sineInOut: (p: number) => -(Math.cos(Math.PI * p) - 1) / 2,
	backOut: (p: number) => {
		const c1 = 1.70158;
		const c3 = c1 + 1;
		return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
	},
	/** soft overshoot, for heavy things (a board settling on its bolts) */
	backOutSoft: (p: number) => {
		const c1 = 0.9;
		const c3 = c1 + 1;
		return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
	},
	/** a small pull the wrong way first, then a long eased travel (camera pull-back) */
	anticipate: (p: number) => {
		const a = 0.16;
		if (p < a) return -0.035 * Math.sin((p / a) * Math.PI);
		const q = (p - a) / (1 - a);
		return q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2;
	},
	/** a tilt-up wall pulled upright by a cable: a slow, heavy start off the ground, quick
	 *  through the middle, then it eases up to plumb with a soft rock past vertical */
	hinge: (p: number) => {
		const q = p * p * (3 - 2 * p);
		const c1 = 0.9;
		const c3 = c1 + 1;
		return 1 + c3 * Math.pow(q - 1, 3) + c1 * Math.pow(q - 1, 2);
	},
	/** a dropped weight: accelerates, hits, one low rebound */
	drop: (p: number) => {
		if (p < 0.62) {
			const q = p / 0.62;
			return q * q;
		}
		const q = (p - 0.62) / 0.38;
		return 1 - 0.07 * Math.sin(q * Math.PI) * (1 - q);
	},
};

/** decaying spring around 0 (amplitude 1 at t=0): settle / shake follow-through */
export const springDecay = (p: number, cycles = 2.5, damping = 4.2) =>
	Math.cos(p * Math.PI * 2 * cycles) * Math.exp(-damping * p) * (1 - p);

type Tw = {
	live: boolean;
	t: number;
	ms: number;
	fn: (p: number, raw: number) => void;
	ease: Ease;
	done: (() => void) | null;
};

const pool: Tw[] = [];
/**
 * A tween callback that THROWS must never stall the round. A presentation callback can hit a
 * display object that was destroyed under it (Pixi 8 nulls `position` / `scale` on destroy, so
 * `node.scale.set` throws "Cannot read properties of null (reading 'set')"): the first frame
 * runs inside the Promise executor and REJECTS the beat, a later frame throws out of the ticker
 * and the tween never resolves — either way the director's await never returns and the bonus
 * hangs with its spins on the sign (production, 2026-09-19, expandStart). Here the error is
 * logged once and the tween is finished, so the book keeps playing.
 */
let tweenFaults = 0;
const callTween = (tw: Tw, eased: number, raw: number): boolean => {
	try {
		tw.fn(eased, raw);
		return true;
	} catch (err) {
		tweenFaults += 1;
		if (tweenFaults <= 5) console.error('[motion] tween callback threw; finishing the tween so the round continues', err);
		return false;
	}
};

const steppers: ((dtMs: number) => void)[] = [];
let boundTicker: any = null;
let rafId = 0;
let lastRaf = 0;

const step = (dtMs: number) => {
	const dt = Math.min(50, Math.max(0, dtMs));
	for (let i = 0; i < pool.length; i += 1) {
		const tw = pool[i];
		if (!tw.live) continue;
		tw.t += dt;
		// `let`: the destroyed-node guard below forces the tween to completion on a throw. As a
		// `const` that assignment threw a TypeError inside the ticker (module strict mode), which is
		// the very hang callTween exists to prevent.
		let raw = tw.ms <= 0 ? 1 : Math.min(1, tw.t / tw.ms);
		if (!callTween(tw, tw.ease(raw), raw)) raw = 1;
		if (raw >= 1) {
			tw.live = false;
			const d = tw.done;
			tw.done = null;
			d?.();
		}
	}
	for (let i = 0; i < steppers.length; i += 1) steppers[i](dt);
};

const onTicker = (tk: any) => step(tk?.deltaMS ?? 16.7);

const rafLoop = (now: number) => {
	step(lastRaf ? now - lastRaf : 16.7);
	lastRaf = now;
	rafId = requestAnimationFrame(rafLoop);
};

/** Bind to the Pixi ticker. Returns a detach function. */
export const attachMotion = (ticker: any): (() => void) => {
	if (boundTicker === ticker && ticker) return () => detach(ticker);
	if (boundTicker) boundTicker.remove(onTicker);
	if (rafId) cancelAnimationFrame(rafId);
	rafId = 0;
	boundTicker = ticker ?? null;
	if (boundTicker) boundTicker.add(onTicker);
	else if (typeof requestAnimationFrame !== 'undefined') {
		lastRaf = 0;
		rafId = requestAnimationFrame(rafLoop);
	}
	return () => detach(ticker);
};

const detach = (ticker: any) => {
	if (boundTicker && boundTicker === ticker) {
		boundTicker.remove(onTicker);
		boundTicker = null;
	}
	if (rafId) cancelAnimationFrame(rafId);
	rafId = 0;
	finishAllTweens();
};

/** Run `fn(eased, raw)` each frame for `ms`. Always ends on exactly fn(ease(1), 1). */
export const tween = (ms: number, fn: (p: number, raw: number) => void, easing: Ease = ease.cubicOut): Promise<void> =>
	new Promise<void>((resolve) => {
		if (ms <= 0 || (!boundTicker && !rafId)) {
			fn(easing(1), 1);
			resolve();
			return;
		}
		let tw: Tw | undefined;
		for (let i = 0; i < pool.length; i += 1) {
			if (!pool[i].live) {
				tw = pool[i];
				break;
			}
		}
		if (!tw) {
			tw = { live: false, t: 0, ms: 0, fn, ease: easing, done: null };
			pool.push(tw);
		}
		tw.live = true;
		tw.t = 0;
		tw.ms = ms;
		tw.fn = fn;
		tw.ease = easing;
		tw.done = resolve;
		if (!callTween(tw, easing(0), 0)) {
			// the callback threw on its first frame: the tween is over, the beat goes on
			tw.live = false;
			tw.done = null;
			resolve();
		}
	});

export const addStepper = (fn: (dtMs: number) => void): (() => void) => {
	steppers.push(fn);
	return () => {
		const i = steppers.indexOf(fn);
		if (i >= 0) steppers.splice(i, 1);
	};
};

/** Skip / teardown: every running tween lands on its final value, exactly once. */
export const finishAllTweens = () => {
	for (let i = 0; i < pool.length; i += 1) {
		const tw = pool[i];
		if (!tw.live) continue;
		tw.live = false;
		callTween(tw, tw.ease(1), 1);
		const d = tw.done;
		tw.done = null;
		d?.();
	}
};

export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
