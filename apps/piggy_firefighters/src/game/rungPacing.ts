/**
 * WIN RUNG PACING + LOOK — the pure half of components/WinRungs.svelte (no Svelte, no Pixi, no imports), checked by
 * qa/gate/check_rung_pacing.mjs.
 *
 * THE COUNT is one monotone climb, drawn as a SEGMENT-WEIGHTED LOG RAMP. Segment r shows rung r (0 BIG .. 4 MAX) and
 * climbs from the rung's floor to the next one; inside a segment the figure grows at a steady RATE (linear in log10
 * of the value), and each segment lasts `rungMs + decadeMs x decades climbed`, so every rung gets real time on screen
 * and a long climb (100x -> 20,000x) gets more of it than a short one (30x -> 50x). Ganja's single linear ramp is the
 * wrong model for this title: with floors of 15 / 30 / 50 / 100x and a 20,000x cap it would put every BIG..EPIC
 * crossing in the first ~1% of the count. The old equal split spent ~60% of a max win below 100x and only showed
 * MAX once the figure was already capped.
 *
 *   - the count starts at 2x the base bet (never a few cents under a BIG WIN sign);
 *   - crossings below MAX land exactly on their floor (15 / 30 / 50 / 100x, clamped to the booked amount);
 *   - MAX comes up at a tenth of the cap (2,000x), BEFORE the figure reaches it, then accelerates and slams in on
 *     exactly 20,000x; every other landing eases out into the booked figure;
 *   - `speed` is stateSpeed speedFactor(): 1 normal, 0.5 turbo, 0.3 super turbo. It scales the whole plan.
 *
 * Amounts are BOOKED units (x100 of the base bet), as in game/roundTier.ts; the floors are passed in
 * (RUNG_FLOORS_BOOKED) so this module has no imports and node-run checks can load it directly.
 */

export type Ease = 'lin' | 'in' | 'out';
export type CountSeg = { rung: number; from: number; to: number; startMs: number; endMs: number; ease: Ease };
export type CountPlan = { amount: number; finalIdx: number; segs: CountSeg[]; totalMs: number };

export const RUNG_COUNT = {
	/** every rung's own time on screen, ms at normal speed */
	rungMs: 1050,
	/** extra ms per decade (x10) the figure climbs inside a segment */
	decadeMs: 620,
	/** the landing segment's settle into the booked figure */
	landMs: 650,
	/** MAX's own segment is the longest: the sign is up well before the cap lands */
	maxMs: 1100,
	/** the MAX sign comes up at this share of the cap floor (2,000x of 20,000x) */
	maxRevealShare: 0.1,
	/** the first figure: 2x the base bet (booked 200) */
	startBooked: 200,
} as const;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * The count plan of one climb.
 * @param amount    booked round total (the figure lands exactly here)
 * @param finalIdx  landed rung 0 BIG .. 4 MAX (level - 6)
 * @param floors    RUNG_FLOORS_BOOKED: BIG, HUGE, MEGA, EPIC floors and the cap
 * @param speed     stateSpeed speedFactor(): 1 / 0.5 / 0.3
 */
export const planCount = (amount: number, finalIdx: number, floors: readonly number[], speed = 1): CountPlan => {
	const A = Math.max(1, Math.floor(Number(amount) || 0));
	const last = clamp(Math.round(finalIdx), 0, 4);
	const k = Math.max(0.05, Number(speed) || 1);
	const segs: CountSeg[] = [];
	let from = Math.max(1, Math.min(A, RUNG_COUNT.startBooked));
	let t = 0;
	for (let r = 0; r <= last; r += 1) {
		let to: number;
		if (r === last) to = A;
		else if (r + 1 < 4) to = clamp(floors[r + 1], from, A);
		// the MAX crossing: well above EPIC's floor, well below the cap
		else to = clamp(Math.round(Math.max(floors[3], floors[4] * RUNG_COUNT.maxRevealShare)), from, A);
		const decades = Math.log10(to / from);
		const ms =
			(RUNG_COUNT.rungMs + RUNG_COUNT.decadeMs * decades + (r === last ? RUNG_COUNT.landMs : 0) + (r === 4 ? RUNG_COUNT.maxMs : 0)) * k;
		segs.push({ rung: r, from, to, startMs: t, endMs: t + ms, ease: r === last ? (r === 4 ? 'in' : 'out') : 'lin' });
		t += ms;
		from = to;
	}
	return { amount: A, finalIdx: last, segs, totalMs: t };
};

const ease = (e: Ease, u: number) => (e === 'in' ? u * u : e === 'out' ? 1 - (1 - u) * (1 - u) : u);

/** The drawn figure (whole booked units, never above the amount) and the rung on show `ms` into the count. */
export const countAt = (plan: CountPlan, ms: number): { value: number; rung: number } => {
	if (!(ms < plan.totalMs)) return { value: plan.amount, rung: plan.finalIdx };
	const t = Math.max(0, ms);
	let seg = plan.segs[0];
	for (const s of plan.segs) {
		if (t >= s.startMs) seg = s;
		else break;
	}
	const span = Math.max(1e-6, seg.endMs - seg.startMs);
	const u = clamp((t - seg.startMs) / span, 0, 1);
	const v = seg.to > seg.from ? seg.from * Math.pow(seg.to / seg.from, ease(seg.ease, u)) : seg.from;
	return { value: Math.min(plan.amount, Math.floor(v + 1e-9)), rung: seg.rung };
};

// ---- the timeline around the count ------------------------------------------------------------------------------------
export type RungTimeline = {
	/** the stage (scene plate, light, rays) fades in */
	enterMs: number;
	/** the first sign drops in on its chains (0 under reduced motion: it fades in with the stage) */
	dropMs: number;
	/** a crossing's board swap: the new board drops / pops in, the old one swells and fades out */
	swapMs: number;
	/** a crossing's flare: shake, plate pop, spark ring, flash */
	flareMs: number;
	/** the landed sign holds (BIG..EPIC) before it leaves */
	holdMs: number;
	/** the landed MAX sign holds before the max-win card */
	maxHoldMs: number;
	cardFadeMs: number;
	cardHoldMs: number;
	/** the exit: a slide up and out, or (reduced motion) a plain fade */
	outMs: number;
	landPulseMs: number;
	ringMs: number;
	/** false under reduced motion: the exit is a plain fade */
	slideOut: boolean;
};

export const rungTimeline = (speed: number, reduced: boolean): RungTimeline => {
	const k = Math.max(0.05, Number(speed) || 1);
	return {
		enterMs: 600 * k,
		dropMs: reduced ? 0 : 480 * k,
		swapMs: 320 * k,
		flareMs: 260 * k,
		holdMs: 1700 * k,
		maxHoldMs: 1500 * k,
		cardFadeMs: 420 * k,
		cardHoldMs: 4200 * k,
		outMs: 420 * k,
		landPulseMs: 420 * k,
		ringMs: 700 * k,
		slideOut: !reduced,
	};
};

/** The ticker's largest step (ms): the presentation clock keeps wall time down to 1000 / cap fps (10 fps). */
export const FRAME_STEP_CAP_MS = 100;

/** Wall-clock ceiling for one climb: the awaited event always resolves, even if the ticker stops (a hidden tab). It
 *  scales WITH the timeline, so a device slow enough that the capped step lags wall time never loses the MAX card. */
export const watchdogMs = (plan: CountPlan, tl: RungTimeline, max: boolean): number =>
	1.6 * (tl.enterMs + tl.dropMs + plan.totalMs + (max ? tl.maxHoldMs + tl.cardFadeMs + tl.cardHoldMs : tl.holdMs) + tl.outMs) + 2000;

// ---- the look per rung --------------------------------------------------------------------------------------------------
export type RungLook = {
	key: 'big' | 'huge' | 'mega' | 'epic' | 'max';
	/** the rung's light: god-rays, sign glow, flash, the spark rim */
	light: number;
	/** the second ray tint (every third wedge) and the small hot core behind the sign */
	accent: number;
	/** the big additive bloom's tint: the light's own CORE, kept near white where the hue would vanish on the plate
	 *  (HUGE's siren red on Station 13's red door) or mix wrong (MEGA's additive blue over red reads magenta) */
	core: number;
	/** the normal-blend light POOL that recolours the plate around the sign in the rung's hue (MEGA turns the red door
	 *  blue before the cool core lights it) */
	pool: number;
	poolAlpha: number;
	/** navy scrim over the scene plate (light: the station stays readable) */
	scrim: number;
	/** additive radial bloom alpha behind the sign (before the mood's gain) */
	bloom: number;
	/** sign scale vs BIG */
	grow: number;
};

/** Hose water (BIG), siren red (HUGE), siren blue (MEGA), flame orange (EPIC), gold (MAX: the brightest). */
export const RUNG_LOOK: readonly RungLook[] = [
	{ key: 'big', light: 0x46c8ff, accent: 0xe8fbff, core: 0x78d2ff, pool: 0x0b5aa0, poolAlpha: 0.62, scrim: 0.22, bloom: 0.46, grow: 1.0 },
	{ key: 'huge', light: 0xff2f24, accent: 0xfff0dc, core: 0xffdcb4, pool: 0x7a0c08, poolAlpha: 0.3, scrim: 0.22, bloom: 0.48, grow: 1.03 },
	{ key: 'mega', light: 0x4d74ff, accent: 0xeef2ff, core: 0xa8c0ff, pool: 0x1a3cc8, poolAlpha: 0.78, scrim: 0.21, bloom: 0.5, grow: 1.06 },
	{ key: 'epic', light: 0xff8a1a, accent: 0xffe2a8, core: 0xffb060, pool: 0x8a3206, poolAlpha: 0.4, scrim: 0.2, bloom: 0.54, grow: 1.09 },
	{ key: 'max', light: 0xffcf3a, accent: 0xfff4c8, core: 0xffe39a, pool: 0x8a5a08, poolAlpha: 0.34, scrim: 0.15, bloom: 0.68, grow: 1.17 },
];

// ---- the light per MOOD plate ---------------------------------------------------------------------------------------
// The stage keeps the round's own scene plate (environment/<mood>_<orientation>.webp) under a light scrim. Station 13
// (base) and the blown bay door (backdraft) are BRIGHT plates: a light tuned on the night block vanished on them (judge
// 2026-09-26: +1..+32 luma under the plank vs the edge, ganja +75). Bright plates darken their edges harder (the
// vignette at full strength plus a second pass) and push the bloom and rays; night plates keep the lighter touch.
export type Mood = 'base' | 'backdraft' | 'rescue' | 'inferno';
export const MOODS: readonly Mood[] = ['base', 'backdraft', 'rescue', 'inferno'];

/** Rec.601 luma (0..255) of each plate, measured with Pillow on environment/<mood>_{landscape,portrait}.webp (the
 *  worse orientation): `under` the band under the sign (x 40..60%, y 60..80%), `edge` the screen edge there (x 0..5%). */
export const PLATE_LUM: Record<Mood, { under: number; edge: number }> = {
	base: { under: 74.5, edge: 111.2 },
	backdraft: { under: 150.3, edge: 116.1 },
	rescue: { under: 50.1, edge: 101.0 },
	inferno: { under: 46.6, edge: 103.2 },
};

export type MoodLight = { vignette: number; vignette2: number; bloomGain: number; rayGain: number; poolGain: number };
const BRIGHT_PLATE: MoodLight = { vignette: 1, vignette2: 0.5, bloomGain: 1.32, rayGain: 1.45, poolGain: 1 };
const NIGHT_PLATE: MoodLight = { vignette: 0.9, vignette2: 0.3, bloomGain: 1.1, rayGain: 1.15, poolGain: 0.7 };
export const MOOD_LIGHT: Record<Mood, MoodLight> = { base: BRIGHT_PLATE, backdraft: BRIGHT_PLATE, rescue: NIGHT_PLATE, inferno: NIGHT_PLATE };

/** Texture samples the look rule uses (qa/gate/check_rung_pacing.mjs): the value of each light sprite in the band
 *  just under the plank (1..6% of the height below it) and at the screen edge there, fixed by the sprite geometry in
 *  WinRungs.svelte (LIGHT_SIZE vs the sign; the glow copy's blurred halo reaches under the plank) and calibrated
 *  against 1440 x 900 base_win captures (2026-09-26: measured 170 / 53, 150 / 62, 178 / 58, 183 / 60 luma for
 *  BIG / HUGE / MEGA / EPIC on Station 13; the model gives 162 / 53, 153 / 52, 156 / 53, 170 / 55). */
export const LIGHT_SAMPLES = { bloomAt: 0.5, poolAt: 1, coreAt: 0.05, rayAt: 0.22, rayEdge: 0.1, vigAt: 0.4, glowAt: 0.2 } as const;
/** light sprite sizes, x the sign's texture width at the current rung (WinRungs.svelte) */
export const LIGHT_SIZE = { bloomW: 2.4, bloomH: 1.85, poolW: 1.9, poolH: 1.6, coreW: 1.25, coreH: 0.8 } as const;

export type StageLight = {
	light: number;
	accent: number;
	core: number;
	pool: number;
	scrim: number;
	poolAlpha: number;
	bloom: number;
	coreAlpha: number;
	rayAlpha: number;
	vignette: number;
	vignette2: number;
	/** the sign's additive glow copy (mean of its pulse) */
	glow: number;
};

/** Everything the stage's light draws with for rung `rank` on `mood`'s plate. A phone (`stacked`) is so narrow that
 *  its edges sit inside the light: the second vignette pass runs harder there. */
export const stageLight = (rank: number, mood: Mood, stacked = false): StageLight => {
	const r = clamp(Math.round(rank), 0, 4);
	const look = RUNG_LOOK[r];
	const g = MOOD_LIGHT[mood] ?? NIGHT_PLATE;
	return {
		light: look.light,
		accent: look.accent,
		core: look.core,
		pool: look.pool,
		scrim: look.scrim,
		poolAlpha: Math.min(0.8, look.poolAlpha * g.poolGain),
		bloom: Math.min(1, look.bloom * g.bloomGain),
		coreAlpha: 0.3 + look.bloom * 0.3,
		rayAlpha: Math.min(0.6, (0.22 + 0.04 * r) * g.rayGain),
		vignette: g.vignette,
		vignette2: stacked ? Math.min(1, g.vignette2 + 0.5) : g.vignette2,
		glow: 0.55,
	};
};

// ---- the sign's size and place -----------------------------------------------------------------------------------------
/** The sign's scale vs BIG. Phones (stacked) compress the growth so BIG is already large: the width is the limit there. */
export const signGrow = (rank: number, stacked: boolean): number => {
	const g = RUNG_LOOK[clamp(Math.round(rank), 0, 4)].grow;
	return stacked ? 1 + (g - 1) * 0.5 : g;
};

/**
 * The BIG sign's texture width and the sign's centre, from the VISIBLE view (never the board layout, which shrinks and
 * drops under the Rescue building band): MAX at the top of its breath spans ~74% of a wide screen (ganja ~70%) or ~99%
 * of a phone, and fits the free band between the view's top `y` and the HUD bar `bottom`. Wide layouts centre the
 * sign at 0.48 of that band, phones at 0.52 (the old 0.44 left the lower third of a phone empty).
 * @param aspect the sign texture's height / width
 */
export const signLayout = (v: { y: number; w: number; bottom: number; stacked: boolean; aspect: number; q: Quality }) => {
	const growTop = signGrow(4, v.stacked) * (1 + rungFx(4, v.q, false).breath + 0.02);
	const freeH = Math.max(1, v.bottom - v.y);
	const fitW = v.w * (v.stacked ? 0.99 : 0.74);
	const fitH = freeH * (v.stacked ? 0.7 : 0.9);
	const w0 = Math.max(1, Math.min(fitW / growTop, fitH / (v.aspect * growTop)));
	const half = (v.aspect * w0 * growTop) / 2;
	const centreY = Math.max(v.y + half, Math.min(v.y + freeH * (v.stacked ? 0.52 : 0.48), v.bottom - half - freeH * 0.02));
	return { w0, centreY, growTop };
};

export type Quality = 'high' | 'mid' | 'low';

/** Pieces (tumbling coins + kit) per quality tier: the side rain is a fixed pool and the crossing / landing bursts
 *  have their OWN reserved pools, so a steady stream can never starve a burst. `card` is the MAX card's coin storm
 *  (three depths over the card), which overlaps only the rain: the bursts are spent by then. */
export const pieceBudget = (q: Quality) =>
	({
		high: { cap: 64, rain: 32, crossing: 12, landing: 20, card: 30 },
		mid: { cap: 36, rain: 18, crossing: 7, landing: 11, card: 16 },
		low: { cap: 20, rain: 9, crossing: 4, landing: 7, card: 9 },
	})[q];

const DENSITY: Record<Quality, number> = { high: 1, mid: 0.6, low: 0.35 };

export type RungFx = {
	/** god-ray wedges (static under reduced motion) */
	rays: number;
	/** rad / ms (0 under reduced motion) */
	raySpeed: number;
	/** wedge x-scale */
	rayWidth: number;
	rayAlpha: number;
	/** MAX's extra counter-rotating ray set */
	counterRays: boolean;
	embers: number;
	rain: number;
	/** symbol tiles flying in from the screen edges on a crossing */
	volley: number;
	/** 4-point glints on the crossing's expanding ring */
	sparkRing: number;
	/** crossing shake amplitude, px at 1440 wide */
	shakePx: number;
	/** sign breathing: scale 1 <-> 1 + breath over ~2 s */
	breath: number;
	/** chain sway, radians either side */
	sway: number;
	/** the landing shockwave ring's final scale (0 = none) */
	ringScale: number;
	/** ms between shine sweeps across the sign */
	shineEveryMs: number;
};

/** The celebration for rung `rank` (0 BIG .. 4 MAX) at quality `q`; reduced motion keeps only static light. */
export const rungFx = (rank: number, q: Quality, reduced: boolean): RungFx => {
	const r = clamp(Math.round(rank), 0, 4);
	const d = DENSITY[q];
	const budget = pieceBudget(q);
	const n = (v: number) => (reduced ? 0 : Math.max(1, Math.round(v)));
	return {
		rays: { high: 12, mid: 10, low: 8 }[q],
		raySpeed: reduced ? 0 : 0.00006 + 0.000028 * r,
		rayWidth: 1 + 0.12 * r,
		rayAlpha: 0.22 + 0.04 * r,
		counterRays: r === 4 && q !== 'low',
		embers: n((14 + 4 * r) * d),
		rain: reduced ? 0 : Math.min(budget.rain, Math.max(1, Math.round((16 + 5 * r) * d))),
		volley: n((12 + 1.5 * r) * d),
		sparkRing: n((12 + 4 * r) * Math.max(0.5, d)),
		shakePx: reduced ? 0 : 1.4 + 0.8 * r,
		breath: reduced ? 0 : 0.05 + 0.005 * r,
		sway: reduced ? 0 : 0.012 + 0.002 * r,
		ringScale: reduced ? 0 : 2.4 + 0.3 * r,
		shineEveryMs: 2600 - 250 * r,
	};
};

// ---- handovers: never two titles at once ---------------------------------------------------------------------------------

/** A crossing's board swap at progress `p` (0..1 of swapMs). Normal motion: the new board is solid from its first frame
 *  (it drops / pops in) and the old one swells and fades out BEHIND it inside the first third. Reduced motion has no
 *  travel to hide the change behind, so the boards fade in SEQUENCE (out, then in): two titles never share a frame. */
export const boardSwapAlpha = (p: number, reduced: boolean): { board: number; old: number } => {
	const t = clamp(p, 0, 1);
	return reduced ? { board: Math.max(0, 2 * t - 1), old: Math.max(0, 1 - 2 * t) } : { board: 1, old: Math.max(0, 1 - 3 * t) };
};

/** The MAX sign -> max-win card handover, as fractions of cardFadeMs. */
export const CARD_HANDOVER = {
	/** the sign is gone by here */
	signGone: 0.28,
	/** the card enters here, at full alpha within `cardIn` (a frame or two), from its 0.82 landing scale */
	cardAt: 0.24,
	cardIn: 0.08,
	/** the additive flash that covers the change: peak alpha, and where it has faded out */
	flashPeak: 0.26,
	flashEnd: 0.44,
	/** the card's landing overshoot ends here (it keeps the old 1.24x of the fade) */
	landEnd: 1.24,
} as const;

/** The MAX sign -> max-win card handover, `ms` into the card phase of `fadeMs`. Normal motion: the sign clears in its
 *  first ~28% under an additive flash and the card LANDS at full alpha from 24% with its overshoot (`land` is that
 *  overshoot's 0..1 progress), so the sign's MAX WIN / amount and the card's title are never legible together (a
 *  sub-0.12 trace for a frame or two, under the flash). Reduced motion: a plain sequenced fade (the sign out, then the
 *  card in), no flash, no overshoot. */
export const cardHandover = (ms: number, fadeMs: number, reduced: boolean): { sign: number; card: number; flash: number; land: number } => {
	const u = Math.max(0, ms) / Math.max(1, fadeMs);
	const p = Math.min(1, u);
	if (reduced) return { sign: Math.max(0, 1 - 2 * p), card: Math.max(0, 2 * p - 1), flash: 0, land: 1 };
	const H = CARD_HANDOVER;
	return {
		sign: Math.max(0, 1 - p / H.signGone),
		card: clamp((p - H.cardAt) / H.cardIn, 0, 1),
		flash: p < H.flashEnd ? H.flashPeak * Math.sin(Math.PI * (p / H.flashEnd)) : 0,
		land: clamp((u - H.cardAt) / (H.landEnd - H.cardAt), 0, 1),
	};
};

// ---- the crossing volley ---------------------------------------------------------------------------------------------------

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

/** Which of `n` symbol keys tile `i` of a crossing volley shows. Tiles go round the four screen edges (edge = i % 4); along
 *  each edge the key steps by a stride coprime with `n`, so no edge throws one symbol twice before it has shown them all
 *  (keys[i % n] with 4 keys gave every tile from one edge the same symbol). `offset` rotates the set per volley. */
export const volleyKey = (i: number, n: number, offset = 0): number => {
	if (!(n > 1)) return 0;
	const stride = [3, 1, 5, 7, 9, 11, 13].find((s) => gcd(4 + s, n) === 1) ?? 1;
	return (((i + stride * Math.floor(i / 4) + offset) % n) + n) % n;
};

/**
 * One crossing-volley tile's launch: a point on one of the four screen edges (tile i uses edge i % 4, stepping along it so
 * one edge's tiles fan out), and a velocity aimed at the sign centre (cx, cy) with a swirl. r1..r3 in [0, 1) are the
 * caller's randomness (along-edge jitter, swirl jitter, speed), so the maths stays testable.
 */
export const volleyLaunch = (
	i: number,
	n: number,
	view: { x: number; y: number; w: number; h: number },
	cx: number,
	cy: number,
	size: number,
	rung: number,
	r1: number,
	r2: number,
	r3: number,
): { x0: number; y0: number; vx: number; vy: number } => {
	const fr = (v: number) => v - Math.floor(v);
	const perEdge = Math.max(1, Math.ceil(n / 4));
	const edge = i % 4;
	const along = Math.max(0.02, Math.min(0.98, (Math.floor(i / 4) + 0.5) / perEdge + (r1 - 0.5) * 0.24));
	const x0 = edge === 0 ? view.x - size * 0.5 : edge === 1 ? view.x + view.w + size * 0.5 : view.x + view.w * (0.12 + 0.76 * along);
	const y0 = edge === 2 ? view.y - size * 0.5 : edge === 3 ? view.y + view.h + size * 0.5 : view.y + view.h * (0.1 + 0.6 * along);
	const span = edge < 2 ? view.w : view.h;
	const dx = cx - x0;
	const dy = cy - y0;
	const d = Math.max(1, Math.hypot(dx, dy));
	const swirl = (fr(i * 0.618) - 0.5) * 1.1 + (r2 - 0.5) * 0.5;
	const c = Math.cos(swirl);
	const s = Math.sin(swirl);
	const v = (0.5 + 0.05 * rung) * span * (0.8 + 0.4 * r3);
	return { x0, y0, vx: ((dx * c - dy * s) / d) * v, vy: ((dx * s + dy * c) / d) * v - (edge === 3 ? span * 0.25 : 0) };
};
