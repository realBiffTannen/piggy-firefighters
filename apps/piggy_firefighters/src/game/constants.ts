import type { RawSymbol, SymbolState } from './types';

export const SYMBOL_SIZE = 120;

export const REEL_PADDING = 0.53;

// initial board (padded top and bottom → 5 rows, middle 3 are visible).
// Contract symbols only (docs/GAME_CONTRACT.md §3): H1-H4, L1-L3, W, HAT.
export const INITIAL_BOARD: RawSymbol[][] = [
	[{ name: 'H1' }, { name: 'H1' }, { name: 'L3' }, { name: 'L3' }, { name: 'L2' }],
	[{ name: 'H1' }, { name: 'H1' }, { name: 'L3' }, { name: 'W' }, { name: 'H3' }],
	[{ name: 'L2' }, { name: 'L2' }, { name: 'L1' }, { name: 'L1' }, { name: 'H2' }],
	[{ name: 'L3' }, { name: 'H2' }, { name: 'W' }, { name: 'H4' }, { name: 'H4' }],
	[{ name: 'L3' }, { name: 'H2' }, { name: 'H2' }, { name: 'L2' }, { name: 'L2' }],
];

export const BOARD_DIMENSIONS = { x: INITIAL_BOARD.length, y: INITIAL_BOARD[0].length - 2 };

export const BOARD_SIZES = {
	width: SYMBOL_SIZE * BOARD_DIMENSIONS.x,
	height: SYMBOL_SIZE * BOARD_DIMENSIONS.y,
};

export const BACKGROUND_RATIO = 2039 / 1000;
export const PORTRAIT_BACKGROUND_RATIO = 1242 / 2208;
const PORTRAIT_RATIO = 800 / 1422;
const LANDSCAPE_RATIO = 1600 / 900;
const DESKTOP_RATIO = 1422 / 800;

const DESKTOP_HEIGHT = 800;
const LANDSCAPE_HEIGHT = 900;
const PORTRAIT_HEIGHT = 1422;
export const DESKTOP_MAIN_SIZES = { width: DESKTOP_HEIGHT * DESKTOP_RATIO, height: DESKTOP_HEIGHT };
export const LANDSCAPE_MAIN_SIZES = {
	width: LANDSCAPE_HEIGHT * LANDSCAPE_RATIO,
	height: LANDSCAPE_HEIGHT,
};
export const PORTRAIT_MAIN_SIZES = {
	width: PORTRAIT_HEIGHT * PORTRAIT_RATIO,
	height: PORTRAIT_HEIGHT,
};

export const HIGH_SYMBOLS = ['H1', 'H2', 'H3', 'H4'];

export const INITIAL_SYMBOL_STATE: SymbolState = 'static';

/**
 * SPINNING REELS (game/reels/spinReels.svelte.ts). Distances are in SYMBOLS, speeds in symbols per
 * second, times in ms. One set per speed tier; speed only ever shortens the presentation.
 *
 *   windup     the column kicks BACK (up) by `windupDist` before it lets go
 *   accel      0 -> `speed` at constant acceleration (the wind-up peak has zero velocity: no kink)
 *   startStagger / stopStagger   left-to-right overlap between neighbouring columns
 *   minSpinMs  the least a reel is seen streaming before reel 0 may land
 *   brakeMs    nominal constant-deceleration stop (the planner flexes it a few ms so the landing
 *              arrives exactly on its beat AND exactly on the book's symbols)
 *   overshoot  how far the strip runs past its rest line before the settle spring pulls it back
 *              (the strip brakes through its last ~4 symbols; the run PAST the line is kept under half
 *              a symbol so a row is never momentarily read in the wrong place — raise it here to taste)
 *   settle*    damped spring: `settleHz` oscillation, `settleDamp` 1/s decay, cut after `settleMs`
 *   anticipationMs  extra streaming for a reel held for a possible trigger (information, so the
 *              fast tiers trim it far less than they trim everything else)
 */
export type ReelSpinTier = {
	speed: number;
	windupMs: number;
	windupDist: number;
	accelMs: number;
	startStagger: number;
	minSpinMs: number;
	stopStagger: number;
	brakeMs: number;
	overshoot: number;
	settleMs: number;
	settleHz: number;
	settleDamp: number;
	anticipationMs: number;
};

export const REEL_SPIN_NORMAL: ReelSpinTier = {
	speed: 24,
	windupMs: 120,
	windupDist: 0.22,
	accelMs: 210,
	startStagger: 65,
	minSpinMs: 760,
	stopStagger: 200,
	brakeMs: 310,
	overshoot: 0.45,
	settleMs: 420,
	settleHz: 3.6,
	settleDamp: 13,
	anticipationMs: 2600,
};

export const REEL_SPIN_TURBO: ReelSpinTier = {
	speed: 30,
	windupMs: 80,
	windupDist: 0.1,
	accelMs: 150,
	startStagger: 30,
	minSpinMs: 330,
	stopStagger: 85,
	brakeMs: 210,
	overshoot: 0.28,
	settleMs: 280,
	settleHz: 4.6,
	settleDamp: 17,
	anticipationMs: 1800,
};

// Super Turbo: the shortest honest spin — no wind-up, a token stagger, a token bounce. The reels
// still stream (the window is never empty) and still land left to right.
export const REEL_SPIN_SUPER: ReelSpinTier = {
	speed: 38,
	windupMs: 0,
	windupDist: 0,
	accelMs: 90,
	startStagger: 0,
	minSpinMs: 370, // a dead Super Turbo round measures ~0.8 s press-to-idle (the tier's target cadence)
	stopStagger: 26,
	brakeMs: 140,
	overshoot: 0.16,
	settleMs: 170,
	settleHz: 6,
	settleDamp: 24,
	anticipationMs: 1000,
};

/** Slam-stop (second press): every reel that may stop does so at once, in a quick ripple. */
export const REEL_SLAM = { brakeMs: 150, stagger: 32, overshoot: 0.3 };

/** Reduced motion: no travel — the old board dims, the new one fades up column by column. */
export const REEL_REDUCED = { dimAlpha: 0.3, dimMs: 120, fadeMs: 160, stagger: 70, holdMs: 220 };

/**
 * Motion blur. Two pre-blurred copies of every symbol are baked ONCE at board mount (vertical box
 * blur, lengths in symbols) and cross-faded by strip velocity (fractions of the tier's cruise speed),
 * with a small velocity stretch on top. Nothing is filtered or uploaded while a reel moves.
 */
export const REEL_BLUR = { lengths: [0.2, 0.62], sharpBelow: 0.12, midAt: 0.42, fullAt: 0.85, stretch: 0.1 };

export const zIndexes = {
	background: {
		backdrop: -3,
		normal: -2,
		feature: -1,
	},
};

/**
 * SYMBOL RENDER MAP. Cartoon sprites (one WEBP each, tools/art/derive_symbols.py). Every state points
 * at the same resting sprite; land / win / idle MOTION is game/symbolMotion.ts played by
 * components/SymbolSprite.svelte, and the four high symbols cut to a second key pose (`sym_H1_b` ...)
 * inside their win motion. Keeping each symbol's five states defined means the ways spin/win pipeline
 * never asks for a missing state.
 */
const spriteInfo = (symbol: string, size = 0.92) => {
	const s = {
		type: 'sprite',
		assetKey: `sym_${symbol}`,
		sizeRatios: { width: size, height: size },
	} as const;
	return { static: s, spin: s, land: s, win: s, postWinStatic: s } as const;
};

export const SYMBOL_INFO_MAP = {
	H1: spriteInfo('H1'),
	H2: spriteInfo('H2'),
	H3: spriteInfo('H3'),
	H4: spriteInfo('H4'),
	L1: spriteInfo('L1'),
	L2: spriteInfo('L2'),
	L3: spriteInfo('L3'),
	W: spriteInfo('W', 1.0),
	HAT: spriteInfo('HAT', 1.0),
	GHAT: spriteInfo('GHAT', 1.0),
} as const;

// The donor SCATTER_LAND_SOUND_MAP (Howler `sfx_scatter_stop_*`) is retired; the
// hat-land ladder now round-robins the three hat_land_* cues on the ONE audio
// manager (see src/game/audio gameSound.hatLand).
