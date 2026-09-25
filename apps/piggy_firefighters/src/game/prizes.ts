/**
 * Door prize figures PER BET MODE, as multiples of the base bet — for WORDS only (rules sheet, buy cards).
 *
 * Sources: docs/GAME_CONTRACT.md §4 (the full-value tables every mode but one uses) and
 * docs/coordination/codex-math-core.md (LUCKY `golden_four`: the same tables at prizeScale 0.5 —
 * MINOR 50x / MAJOR 625x / GRAND 5,000x, Tier 3/4/5 5–50x / 25–125x / 50–1,250x).
 *
 * The client NEVER multiplies a booked amount by a scale: every door, jackpot, street and total in a
 * book is already the scaled figure, and the scene shows exactly what the book says. This table exists so
 * the copy can state each mode's own figures instead of one global constant.
 */

/**
 * The full-value door tables, tiers 1-5: EVERY value a door of that tier can open on (the approval guideline asks
 * the rules to list all obtainable values of a prize symbol, not a range). Copied from the frozen math,
 * math/games/lucky/game_config.py `prize_tables` (six fixed values per tier), and confirmed in
 * docs/coordination/codex-loop-r1-handoff.md "Exact door values for the copy fixer".
 */
const FULL = {
	tiers: [
		[0.5, 1, 1.5, 2, 3, 5],
		[3, 4, 5, 7, 10, 15],
		[10, 15, 20, 30, 50, 100],
		[50, 70, 100, 150, 200, 250],
		[100, 150, 250, 500, 1000, 2500],
	] as readonly (readonly number[])[],
	minor: 100,
	major: 1250,
	grand: 10000,
} as const;

/** Modes whose doors are scaled. Every other mode is 1. */
// confirmed: docs/GAME_CONTRACT.md §8 + codex-final-math-copy.md (golden_four 0.5-scaled prizes baked into the book)
const PRIZE_SCALE: Record<string, number> = {
	golden_four: 0.5,
};

/** The lowest tier a door can have in a mode. GOLDEN DRAGON CITY x4 plays only Golden boards, which start at Tier 3
 *  and never hold Tier 1 or 2 (codex-loop-r1-handoff.md), so its halved Tier 1/2 figures are not obtainable. */
const FIRST_TIER: Record<string, number> = {
	golden_four: 3,
};

export const prizeScaleOf = (modeKey: string): number => PRIZE_SCALE[modeKey.toLowerCase()] ?? 1;

export type PrizeTable = {
	scale: number;
	/** The lowest obtainable tier in this mode (1-based). */
	firstTier: number;
	/** index 0 = Tier 1: every door value of that tier, low to high, as multiples of the base bet */
	tiers: number[][];
	minor: number;
	major: number;
	grand: number;
};

export const prizesFor = (modeKey = 'base'): PrizeTable => {
	const k = prizeScaleOf(modeKey);
	return {
		scale: k,
		firstTier: FIRST_TIER[modeKey.toLowerCase()] ?? 1,
		tiers: FULL.tiers.map((values) => values.map((v) => v * k)),
		minor: FULL.minor * k,
		major: FULL.major * k,
		grand: FULL.grand * k,
	};
};

/** 1250 -> "1,250×", 0.5 -> "0.5×" */
export const fmtX = (n: number): string => `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}×`;

/** [10, 15, 100] -> "10× · 15× · 100×" (every value, never a range). The space BEFORE each dot is a no-break space,
 *  so a list too wide for a phone row (app.html lets the award value wrap) breaks after a dot, never before one. */
export const fmtValues = (values: readonly number[]): string => values.map(fmtX).join('\u00a0· ');
