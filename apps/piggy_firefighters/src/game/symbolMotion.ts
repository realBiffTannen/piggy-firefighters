/**
 * PIGGY FIREFIGHTERS — per-symbol reel motion (Fire Truck, Fire Helmet, Axe & Halligan, Extinguisher, Brass
 * Nozzle, Water Bucket, Ladder, Fire Boots, the Chief Hamm WILD, Fire Alarm, Golden Alarm).
 *
 * Three families, all played by components/SymbolSprite.svelte from the board's ONE ticker:
 *
 *   LAND  (0.26–0.34 s; GALARM 0.62 s)  the symbol's answer to the reel's IMPACT. The reel itself
 *         carries the drop, the overshoot and the settle spring (game/reels/spinReels.svelte.ts), so a
 *         landing here starts AT REST and is what the object does when the column hits: it squashes
 *         on its base, then the object speaks in its own way — a heavy piece barely gives, a light
 *         one rebounds, a hanging one swings and follows through. (The per-symbol tables below were
 *         authored for the donor's symbol set; the motions carry over to the Firefighters art in the
 *         same slots and are re-tuned by the animation lane.)
 *   WIN   (0.66–1.0 s)  the pay flourish. The four HIGH symbols cut to a second KEY POSE (`pose: 1`,
 *         art `sym_H1_b` ...) THROUGH a squash, so the cut is never seen:
 *             A squashes (anticipation) -> cut at the bottom of the squash -> B springs out with its
 *             own overshoot and is HELD while the material motion plays (the BoardFx burst lands on
 *             this beat, ~200 ms in) -> B squashes -> cut -> A springs back and settles.
 *         If the pose-B art is missing the symbol keeps its single-pose flourish.
 *         The WILD (Chief Hamm holding the red WILD badge) sinks, PUNCHES out and springs
 *         back to rest. Its banner performance — two gold flashes of the banner (one in turbo) and a
 *         glint along it — is drawn by components/BoardFx.svelte over the same cell, sampled from
 *         the same transform (`WILD_BANNER`, `wildBannerFlash`, `wildBannerGlint` below): the "I
 *         substituted" tell, since the wild pays nothing itself and whenever it wins it stood in.
 *   IDLE  (0.6–1.1 s, 2–4 %)  a micro-reaction — hop, tilt or breathe — so a resting board is alive.
 *
 * Every sampler returns to the resting transform at p = 1 and (land, idle) starts from it at p = 0:
 * nothing pops. Samplers WRITE INTO the caller's transform, so a playing symbol allocates nothing.
 * Turbo / Super Turbo shorten the duration (caller); reduced motion never reaches here (caller fades).
 * Units are design px on the 120 px cell; rotation is degrees.
 */
export type Transform = {
	ox: number;
	oy: number;
	rot: number;
	sx: number;
	sy: number;
	alpha: number;
	/** 0 = resting art, 1 = key pose B */
	pose: 0 | 1;
	/** 0..1 additive flash on SymbolSprite's legacy sign crop; `W` keeps it 0 (the banner flash is BoardFx's) */
	flash: number;
};

export const restTransform = (): Transform => ({ ox: 0, oy: 0, rot: 0, sx: 1, sy: 1, alpha: 1, pose: 0, flash: 0 });

export const resetTransform = (t: Transform) => {
	t.ox = 0;
	t.oy = 0;
	t.rot = 0;
	t.sx = 1;
	t.sy = 1;
	t.alpha = 1;
	t.pose = 0;
	t.flash = 0;
};

export type Sampler = (p: number, out: Transform) => void;
export type Motion = { durationMs: number; sample: Sampler };

// ---- helpers ------------------------------------------------------------------------------------
const TAU = Math.PI * 2;
/** Half the drawn height of a symbol: a squash keeps the BASE planted, so it shifts the centre down. */
const HALF = 55;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOutCubic = (p: number) => 1 - (1 - p) * (1 - p) * (1 - p);
const easeInCubic = (p: number) => p * p * p;
const decay = (p: number) => 1 - p;
const decay2 = (p: number) => (1 - p) * (1 - p);
const osc = (p: number, cycles: number, phase = 0) => Math.sin(p * Math.PI * cycles + phase);

/** Impact squash: 0 at p = 0, deepest ~p = 0.15, one counter-stretch, gone by p = 1. */
const hit = (p: number, depth: number) => depth * Math.exp(-4 * p) * Math.sin(p * Math.PI * 2.5) * (1 - p) * 1.9;

/** Apply a squash amount `q` (positive = flatter) with the base planted. */
const squash = (out: Transform, q: number, widen = 0.6) => {
	out.sy = 1 - q;
	out.sx = 1 + q * widen;
	out.oy += q * HALF;
};

// ---- LAND ---------------------------------------------------------------------------------------
const LAND: Record<string, Motion> = {
	H1: {
		durationMs: 320,
		sample: (p, o) => {
			squash(o, hit(p, 0.1));
			o.ox = 5 * osc(p, 3) * decay2(p);
			o.rot = 2.6 * osc(p, 3, 0.5) * decay2(p) * clamp01(p * 8);
		},
	},
	H2: {
		durationMs: 300,
		sample: (p, o) => {
			squash(o, hit(p, 0.07), 0.4);
			o.oy += 3.5 * osc(p, 7) * decay2(p);
		},
	},
	H3: {
		durationMs: 340,
		sample: (p, o) => {
			// paper: it ripples sideways rather than squashing
			squash(o, hit(p, 0.05), 1.6);
			o.rot = 2.4 * osc(p, 4) * decay(p);
		},
	},
	H4: {
		durationMs: 320,
		sample: (p, o) => {
			squash(o, hit(p, 0.07));
			o.rot = 6 * osc(p, 2.5) * decay2(p);
		},
	},
	L1: {
		durationMs: 300,
		sample: (p, o) => {
			squash(o, hit(p, 0.09));
			o.rot = 4.5 * osc(p, 3.5) * decay2(p);
		},
	},
	L2: { durationMs: 260, sample: (p, o) => squash(o, hit(p, 0.05), 0.3) },
	L3: {
		durationMs: 320,
		sample: (p, o) => {
			squash(o, hit(p, 0.07));
			// the ladder gives one small hop off the line
			const q = clamp01((p - 0.28) / 0.5);
			o.oy -= 5 * Math.sin(q * Math.PI) * (1 - q);
		},
	},
	L4: {
		durationMs: 300,
		sample: (p, o) => {
			// rubber boots: a soft double bounce
			squash(o, hit(p, 0.1), 0.8);
			o.oy -= 3 * Math.abs(osc(p, 2)) * decay2(p);
		},
	},
	ALARM: {
		durationMs: 340,
		sample: (p, o) => {
			squash(o, hit(p, 0.12));
			o.rot = 5 * osc(p, 3) * decay2(p);
		},
	},
	// GOLDEN ALARM: hops, turns once on its vertical axis like a struck coin (sx passes through
	// zero), swells and settles. Longer and bigger than any other landing on purpose.
	GALARM: {
		durationMs: 620,
		sample: (p, o) => {
			const turn = Math.cos(TAU * easeOutCubic(clamp01(p / 0.7)));
			const swell = 1 + 0.24 * Math.sin(Math.PI * clamp01(p * 1.15)) * decay(p);
			o.oy = -16 * Math.sin(Math.PI * clamp01(p * 1.7)) - 5 * osc(p, 1.5) * decay2(p) * clamp01(p * 6);
			o.sx = (p < 0.7 ? turn : 1) * swell;
			o.sy = swell;
		},
	},
	W: {
		durationMs: 320,
		sample: (p, o) => {
			squash(o, hit(p, 0.12));
			o.rot = 2.5 * osc(p, 3) * decay2(p);
		},
	},
};

// An alarm landing that also completes the trigger (3+): a clear, larger pop that reads over the
// ordinary landing, meant to sync with the trigger cue.
const ALARM_TRIGGER: Motion = {
	durationMs: 420,
	sample: (p, o) => {
		const swell = 0.18 * Math.sin(Math.PI * clamp01(p * 1.1)) * decay(p);
		o.oy = -14 * Math.sin(Math.PI * clamp01(p * 1.5)) * decay(p);
		o.rot = 10 * osc(p, 3) * decay2(p);
		o.sx = 1 + swell;
		o.sy = 1 + swell;
	},
};

// ---- WIN: single-pose flourishes ----------------------------------------------------------------
const reboundDrop = (p: number, dropPx: number) => {
	if (p < 0.55) return -dropPx * Math.sin((p / 0.55) * Math.PI * 0.5) * (1 - p / 0.55) * 2;
	const q = (p - 0.55) / 0.45;
	return -Math.sin(q * Math.PI) * dropPx * 0.3 * (1 - q);
};

// ---- WILD: scale punch + banner performance -------------------------------------------------------
const W_SINK = 0.14;
const W_PEAK = 0.12;
/** Punch over q in 0..1: eases up to +17 % by W_PEAK, then a damped spring (one soft undershoot) to 0. */
const wildPunch = (q: number) => {
	if (q < W_PEAK) return 0.17 * easeOutCubic(q / W_PEAK);
	const r = q - W_PEAK;
	return (0.17 * Math.exp(-3.2 * r) * Math.cos(TAU * 1.15 * r) * (1 - q)) / (1 - W_PEAK);
};

/**
 * The WILD banner inside each WILD tile, in art px (measured on the shipped webps, 2026-09-23). BoardFx crops
 * this rect out of the SAME texture the reel shows and lays it additively over the banner.
 *   sym_W   384 x 384  (square cell, wide layouts)
 *   symT_W  384 x 500  (1 : 1.3 portrait cell, stacked phone layout)
 */
export const WILD_BANNER = {
	square: { artW: 384, artH: 384, x: 62, y: 204, w: 262, h: 98 },
	tall: { artW: 384, artH: 500, x: 54, y: 167, w: 276, h: 122 },
} as const;

const pulse = (p: number, centre: number, half: number) => {
	const d = Math.abs(p - centre) / half;
	return d >= 1 ? 0 : Math.pow(Math.cos((d * Math.PI) / 2), 1.5);
};

/**
 * 0..1 banner flash at win progress `p`. Two beats — on the punch peak and on the settle — or ONE in
 * turbo, so a single act never flashes more than three times a second. Back-to-back WILD ways in
 * Super Turbo (acts about 275 ms apart, one flash each) can exceed three per second; the flashed
 * banner is small (about 147 x 45 px at 1440x900, 64 x 25 px at 390x844), well under the WCAG 2.3.1
 * general-flash area threshold.
 */
export const wildBannerFlash = (p: number, beats: 1 | 2): number => {
	const a = pulse(p, 0.24, 0.11);
	return beats === 1 ? a : Math.max(a, 0.75 * pulse(p, 0.5, 0.1));
};

/** Gold glint travelling along the banner, left to right, after the flashes: -1 = not showing, else 0..1. */
export const wildBannerGlint = (p: number): number => (p > 0.56 && p < 0.9 ? (p - 0.56) / 0.34 : -1);

/** The WILD's win motion (for an overlay that must follow the symbol exactly). */
export const wildWinMotion = (): Motion => WIN_PLAIN.W;

const WIN_PLAIN: Record<string, Motion> = {
	H1: { durationMs: 800, sample: (p, o) => ((o.ox = 16 * osc(p, 3) * decay2(p)), (o.rot = 8 * osc(p, 3, 0.3) * decay2(p) * clamp01(p * 10))) },
	H2: {
		durationMs: 760,
		sample: (p, o) => {
			let oy: number;
			if (p < 0.45) oy = 14 * easeOutCubic(p / 0.45);
			else if (p < 0.72) oy = 14 - 20 * easeOutCubic((p - 0.45) / 0.27);
			else oy = -6 * (1 - easeOutCubic((p - 0.72) / 0.28));
			o.oy = oy + 3 * osc(p, 8) * decay2(p);
		},
	},
	H3: {
		durationMs: 860,
		sample: (p, o) => {
			o.rot = 8 * osc(p, 3) * decay(p);
			o.sx = 1 + 0.05 * osc(p, 2) * decay(p);
			o.oy = -4 * osc(p, 2) * decay(p);
		},
	},
	H4: { durationMs: 800, sample: (p, o) => (o.rot = 16 * osc(p, 2.5) * decay2(p)) },
	L1: {
		durationMs: 760,
		sample: (p, o) => {
			// the nozzle hops twice and wobbles; each landing gives a little squash
			const hop = Math.abs(osc(p, 2)) * decay(p);
			o.rot = 9 * osc(p, 3) * decay(p);
			o.oy = -9 * hop;
			squash(o, 0.05 * (1 - clamp01(hop * 4)) * decay(p) * clamp01(p * 6), 0.7);
		},
	},
	L2: {
		durationMs: 660,
		sample: (p, o) => {
			// small lift, then a hard-stop squash pulse: the bucket does not bounce
			o.oy = -9 * Math.sin(Math.PI * clamp01(p * 1.5));
			if (p > 0.62 && p < 0.9) squash(o, 0.09 * Math.sin(((p - 0.62) / 0.28) * Math.PI), 0.4);
		},
	},
	L3: {
		durationMs: 700,
		sample: (p, o) => {
			o.oy = reboundDrop(p, 9);
			if (p > 0.5 && p < 0.72) squash(o, 0.07 * Math.sin(((p - 0.5) / 0.22) * Math.PI));
			o.rot = 2.5 * osc(p, 3) * decay2(p);
		},
	},
	L4: {
		durationMs: 680,
		sample: (p, o) => {
			// boots stomp twice
			const stomp = Math.abs(osc(p, 2)) * decay(p);
			o.oy = -8 * stomp;
			squash(o, 0.06 * (1 - clamp01(stomp * 4)) * decay(p) * clamp01(p * 6), 0.8);
		},
	},
	ALARM: {
		durationMs: 680,
		sample: (p, o) => {
			const s = Math.sin(Math.PI * p);
			o.oy = -8 * s * decay(p);
			o.rot = 6 * osc(p, 2) * decay(p);
			o.sx = 1 + 0.06 * s;
			o.sy = 1 + 0.06 * s;
		},
	},
	// WILD: Chief Hamm sinks onto his base (anticipation), PUNCHES out of it — a quick swell past full
	// size, grown from the base so his feet stay planted — then a damped spring settles him back to rest
	// with a small tilt. `flash` stays 0: the banner flash is drawn over the cell by components/BoardFx
	// (see WILD_BANNER), so the retired pig-sign crop in SymbolSprite never lights up the wrong region.
	W: {
		durationMs: 900,
		sample: (p, o) => {
			if (p < W_SINK) {
				squash(o, 0.12 * easeOutCubic(p / W_SINK), 0.7);
				return;
			}
			const q = (p - W_SINK) / (1 - W_SINK);
			const s = wildPunch(q);
			const release = Math.pow(1 - clamp01(q / 0.1), 2); // the sink lets go over the first beat
			o.sy = 1 + s - 0.12 * release;
			o.sx = 1 + s + 0.084 * release;
			o.oy = (1 - o.sy) * HALF;
			o.rot = 3 * Math.sin(TAU * 1.5 * q) * decay2(q) * clamp01(q * 6);
		},
	},
};

// ---- WIN: key-pose flourishes for the four high symbols --------------------------------------------
const A_IN = 0.18; // A squashes; the cut to B is at the bottom of it
const B_OUT0 = 0.76; // B starts to squash
const B_OUT1 = 0.86; // cut back to A
const B_SCALE = 1.07; // pose B is held a touch larger: it is the loud frame

type Hold = (q: number, out: Transform) => void;

const keyPose =
	(hold: Hold): Sampler =>
	(p, o) => {
		if (p < A_IN) {
			// anticipation: sink onto the base (ease-out, so it reads as a wind-up, not a hit)
			squash(o, 0.26 * easeOutCubic(p / A_IN), 0.7);
			return;
		}
		o.pose = 1;
		if (p < B_OUT0) {
			const q = (p - A_IN) / (B_OUT0 - A_IN);
			// spring out of the squash: starts where A left off, overshoots tall, settles on B_SCALE
			const spring = Math.exp(-7 * q) * Math.cos(TAU * 2.2 * q);
			o.sy = B_SCALE * (1 - 0.3 * spring);
			o.sx = B_SCALE * (1 + 0.2 * spring);
			o.oy = (1 - o.sy) * HALF;
			hold(q, o);
			return;
		}
		if (p < B_OUT1) {
			const q = easeInCubic((p - B_OUT0) / (B_OUT1 - B_OUT0));
			o.sy = B_SCALE * (1 - 0.22 * q);
			o.sx = B_SCALE * (1 + 0.15 * q);
			o.oy = (1 - o.sy) * HALF;
			return;
		}
		o.pose = 0;
		const q = (p - B_OUT1) / (1 - B_OUT1);
		const spring = Math.exp(-5 * q) * Math.cos(TAU * 1.4 * q) * (1 - q);
		o.sy = 1 - 0.17 * spring;
		o.sx = 1 + 0.16 * spring;
		o.oy = (1 - o.sy) * HALF;
	};

const WIN_KEYPOSE: Record<string, Motion> = {
	// fire truck: pose B revs — a fast vertical pump that dies away
	H1: {
		durationMs: 1000,
		sample: keyPose((q, o) => {
			const env = decay2(q) * clamp01(q * 7);
			o.oy += 5 * Math.abs(Math.sin(TAU * 7 * q)) * env;
			o.ox += 2.5 * Math.sin(TAU * 14 * q) * env;
			o.rot = 2 * Math.sin(TAU * 7 * q + 0.4) * env;
		}),
	},
	// helmet: a hard, fast judder that dies away
	H2: {
		durationMs: 960,
		sample: keyPose((q, o) => {
			const env = decay(q) * clamp01(q * 9);
			o.oy += 4.5 * Math.sin(TAU * 10 * q) * env;
			o.ox += 1.6 * Math.sin(TAU * 13 * q) * env;
		}),
	},
	// axe & halligan: a gleaming flutter
	H3: {
		durationMs: 1000,
		sample: keyPose((q, o) => {
			const env = decay(q) * clamp01(q * 6);
			o.rot = 5 * Math.sin(TAU * 2 * q) * env;
			o.sx *= 1 + 0.04 * Math.sin(TAU * 3 * q) * env;
			o.oy += -4 * Math.sin(Math.PI * q) * env;
		}),
	},
	// extinguisher: it rings on its base
	H4: {
		durationMs: 960,
		sample: keyPose((q, o) => {
			const env = decay2(q) * clamp01(q * 8);
			o.rot = 13 * Math.sin(TAU * 2.75 * q) * env;
		}),
	},
};

// ---- IDLE -----------------------------------------------------------------------------------------
export type IdleKind = 'hop' | 'tilt' | 'breathe';
export const IDLE_KINDS: readonly IdleKind[] = ['hop', 'tilt', 'breathe'];

/** `amp` is the size of the reaction as a fraction of the symbol (0.02–0.04); `dir` is -1 / +1. */
export const idleMotion = (kind: IdleKind, amp: number, dir: number): Motion => {
	if (kind === 'hop') {
		return {
			durationMs: 640,
			sample: (p, o) => {
				if (p < 0.24) {
					squash(o, amp * 0.9 * Math.sin((p / 0.24) * Math.PI));
				} else if (p < 0.78) {
					const v = Math.sin(((p - 0.24) / 0.54) * Math.PI);
					o.oy = -amp * 120 * 1.15 * v;
					o.sy = 1 + amp * 0.5 * v;
					o.sx = 1 - amp * 0.3 * v;
				} else {
					squash(o, amp * 0.8 * Math.sin(((p - 0.78) / 0.22) * Math.PI));
				}
			},
		};
	}
	if (kind === 'tilt') {
		return {
			durationMs: 920,
			sample: (p, o) => {
				const env = Math.sin(Math.PI * p);
				o.rot = dir * amp * 95 * Math.sin(TAU * p) * env;
				o.ox = dir * amp * 40 * Math.sin(TAU * p) * env;
			},
		};
	}
	return {
		durationMs: 1100,
		sample: (p, o) => {
			const s = amp * Math.sin(Math.PI * p) * Math.sin(Math.PI * p);
			o.sx = 1 + s * 0.85;
			o.sy = 1 + s * 1.15;
			o.oy = -s * 1.15 * HALF; // grows up from its base
		},
	};
};

const FALLBACK_LAND = LAND.L2;
const FALLBACK_WIN = WIN_PLAIN.L2;

/**
 * Pick the motion for one symbol + state. `emphasis` upgrades an ALARM landing to the trigger pop;
 * `keyPose` (the pose-B art is loaded) selects the two-pose win for the high symbols.
 */
export const symbolMotion = (
	symbolName: string,
	state: 'land' | 'win',
	opts: { emphasis?: boolean; keyPose?: boolean } = {},
): Motion => {
	if (state === 'land') {
		if (symbolName === 'ALARM' && opts.emphasis) return ALARM_TRIGGER;
		// the golden alarm always plays its own landing (it is already the biggest on the board)
		return LAND[symbolName] ?? FALLBACK_LAND;
	}
	if (opts.keyPose && WIN_KEYPOSE[symbolName]) return WIN_KEYPOSE[symbolName];
	return WIN_PLAIN[symbolName] ?? FALLBACK_WIN;
};

/** Pose-B asset key for a symbol, if the game ships one (see game/assets.ts). */
export const poseBKey = (symbolName: string): string | undefined =>
	WIN_KEYPOSE[symbolName] ? `sym_${symbolName}_b` : undefined;
