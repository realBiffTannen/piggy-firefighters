/**
 * CELL REELS — every EMPTY plot is a real one-symbol reel during a bonus spin.
 *
 * Owner (verbatim): "Make sure during the hold and build bonus and golden build
 * bonus that the spins on the reels aren't extremely fast, the construction hats
 * should show on the reel as if it is possible for them to land as well as other
 * game symbols in the places where there already isn't a house."
 *
 * This module PLANS a spin (pure, no display objects) and holds the per-board
 * registry the director drives. components/build/CellReels.svelte owns the pooled
 * sprites and plays a plan from the scene's one ticker.
 *
 * Honesty rules (contract 5: the frontend never invents an outcome):
 *   - a reel STOPS on a hat only where the book landed a hat on that empty plot;
 *   - every other reel stops on a regular symbol drawn UNIFORMLY from the regular
 *     set with presentation randomness (never outcome RNG);
 *   - the symbols either side of a stop are never hats, so the strip can not show
 *     a hat "just missing" — a near miss is suggested LESS often than chance;
 *   - hang time depends only on what is already visible on the board (hats that
 *     have stopped, houses that stand), never on what is still to come.
 */
import { BOARD_DIMENSIONS } from '../constants';
import { isTurbo, prefersReducedMotion } from './buildTiming';

// No 'W': these are the DECORATIVE fillers a bonus plot shows when it stops without a hat. The WILD sign is the base
// game's headline symbol and does nothing in Hold & Build, so a plot stopping on it read as a bug or a tease
// (review 2026-09-20, seat A). Seven payers only.
export const REGULAR_SYMBOLS = ['H1', 'H2', 'H3', 'H4', 'L1', 'L2', 'L3'] as const;
export type StripSymbol = (typeof REGULAR_SYMBOLS)[number] | 'HAT' | 'GHAT';
export type ReelHat = null | 'HAT' | 'GHAT';

/** Authored timing at normal speed (ms). One bonus spin reads in ~1.6-2.2 s. */
export const REEL_TIMING = {
	accel: 300, // wind-up kick + run-up
	decel: 640, // eased brake with a natural overshoot (settle bounce)
	firstStop: 1240, // when the first reel comes to rest
	staggerMax: 96, // between consecutive stops (reading order)
	staggerSpan: 620, // the whole left-to-right, top-to-bottom sweep is bounded
	settle: 300, // squash-and-settle after the stop
	hang: [240, 320, 400], // extra hang for the last plots when one hat short
	hangCap: 820,
	blankHold: 300, // a "no build" symbol sits dimmed for a beat…
	blankAway: 420, // …then eases away so the plot is empty again
	speed: 5, // cells per second at cruise — owner 2026-09-19: the spin was still hard to read at 7
};

export type PlannedReel = {
	reel: number;
	row: number;
	/** index 0..14 in reading order (row-major) */
	order: number;
	hat: ReelHat;
	/** ms from spin start until this reel is at rest */
	stopAt: number;
	/** extra hang applied to this reel (already included in stopAt) */
	hang: number;
	/** symbols in travel order; strip[k] is the stop symbol, strip[k+1] the one above it */
	strip: StripSymbol[];
	k: number;
	cruise: number;
	vmax: number; // cells / ms
};

export type ReelPlan = {
	reels: PlannedReel[];
	/** ms until the last reel is at rest (before settle) */
	lastStop: number;
	/** ms until every reel has settled */
	total: number;
	scale: number; // time scale applied (1 normal, 0.5 turbo)
	reduced: boolean;
};

const rnd = (n: number) => Math.floor(Math.random() * n); // presentation randomness only

const filler = (premium: boolean): StripSymbol => {
	const r = Math.random();
	// hats ride the strip often enough to read as "they can land here"
	if (premium && r < 0.07) return 'GHAT';
	if (r < 0.2) return 'HAT';
	return REGULAR_SYMBOLS[rnd(REGULAR_SYMBOLS.length)];
};

export type PlanInput = {
	/** tier per cell (`reel_row`) BEFORE this spin's hats are applied */
	tiers: Record<string, number>;
	/** hats the book landed this spin */
	hats: { reel: number; row: number; golden?: boolean }[];
	premium: boolean;
};

export const planSpin = ({ tiers, hats, premium }: PlanInput): ReelPlan => {
	const reduced = prefersReducedMotion();
	const scale = isTurbo() ? 0.5 : 1;
	const T = REEL_TIMING;
	const hatAt = new Map<string, ReelHat>();
	for (const h of hats) hatAt.set(`${h.reel}_${h.row}`, h.golden ? 'GHAT' : 'HAT');

	// reading order: left to right, top to bottom
	const cells: { reel: number; row: number; order: number }[] = [];
	for (let row = 0; row < BOARD_DIMENSIONS.y; row += 1) {
		for (let reel = 0; reel < BOARD_DIMENSIONS.x; reel += 1) {
			if (!((tiers[`${reel}_${row}`] ?? 0) >= 1)) cells.push({ reel, row, order: row * BOARD_DIMENSIONS.x + reel });
		}
	}
	const n = cells.length;
	const stagger = n > 1 ? Math.min(T.staggerMax, T.staggerSpan / (n - 1)) : 0;

	// what is VISIBLE as the stops sweep across: standing houses + hats already at rest
	const rowFilled: number[] = [];
	for (let row = 0; row < BOARD_DIMENSIONS.y; row += 1) {
		let c = 0;
		for (let reel = 0; reel < BOARD_DIMENSIONS.x; reel += 1) if ((tiers[`${reel}_${row}`] ?? 0) >= 1) c += 1;
		rowFilled.push(c);
	}
	let hatsShown = 0;
	let hangUsed = 0;
	let hangStep = 0;
	let clock = T.firstStop;

	const reels: PlannedReel[] = [];
	for (let i = 0; i < n; i += 1) {
		const c = cells[i];
		const hat = hatAt.get(`${c.reel}_${c.row}`) ?? null;
		// one hat short of +1 SPIN, or this plot is the last one of its street:
		// the last few plots to stop hang a touch longer. Identical whether or not
		// the book lands a hat here — it reads the board, not the outcome.
		const tense = n - i <= 3 && i > 0 && (hatsShown === 1 || rowFilled[c.row] === BOARD_DIMENSIONS.x - 1);
		let hang = 0;
		if (tense && !reduced) {
			hang = Math.min(T.hang[Math.min(hangStep, T.hang.length - 1)], T.hangCap - hangUsed);
			hangStep += 1;
			hangUsed += hang;
		}
		if (i > 0) clock += stagger;
		clock += hang;
		const stopAt = clock;

		// distance is a whole number of symbols so the stop symbol lands dead centre
		const cruise = Math.max(0, stopAt - T.accel - T.decel);
		const per = T.accel / 2 + cruise + T.decel / 4.2; // ms-equivalents of full speed
		const k = Math.max(3, Math.round((T.speed / 1000) * per));
		const vmax = k / per;

		const strip: StripSymbol[] = [];
		for (let s = 0; s <= k + 1; s += 1) strip.push(filler(premium));
		strip[k] = hat ?? REGULAR_SYMBOLS[rnd(REGULAR_SYMBOLS.length)];
		// never a hat either side of the stop: no "just missed" picture, ever
		for (const j of [k - 1, k + 1]) {
			if (strip[j] === 'HAT' || strip[j] === 'GHAT') strip[j] = REGULAR_SYMBOLS[rnd(REGULAR_SYMBOLS.length)];
		}
		// a blank stop next to its own twin reads as a stutter: vary it
		if (!hat && strip[k - 1] === strip[k]) strip[k - 1] = REGULAR_SYMBOLS[(REGULAR_SYMBOLS.indexOf(strip[k] as never) + 3) % REGULAR_SYMBOLS.length];

		reels.push({ reel: c.reel, row: c.row, order: c.order, hat, stopAt, hang, strip, k, cruise, vmax });
		if (hat) {
			hatsShown += 1;
			rowFilled[c.row] += 1;
		}
	}
	const lastStop = n ? reels[n - 1].stopAt : 0;
	return { reels, lastStop: lastStop * scale, total: n ? (lastStop + T.settle) * scale : 0, scale, reduced };
};

// ---- per-board registry ---------------------------------------------------------
export type CellReelsApi = {
	/** Play a plan. `onStop` fires as each reel comes to rest (hat or blank).
	 *  Resolves once EVERY reel has settled; blanks keep easing away on their own. */
	spin: (plan: ReelPlan, onStop?: (r: PlannedReel) => void) => Promise<void>;
	/** The 3D hat has taken over this plot: drop the flat reel hat. */
	release: (reel: number, row: number) => void;
	/** Snap everything away (skip / teardown / next spin). */
	clear: () => void;
};

const registry = new Map<number, CellReelsApi>();
export const registerCellReels = (board: number, api: CellReelsApi) => {
	registry.set(board, api);
	return () => {
		if (registry.get(board) === api) registry.delete(board);
	};
};
export const getCellReels = (board = 0) => registry.get(board);
