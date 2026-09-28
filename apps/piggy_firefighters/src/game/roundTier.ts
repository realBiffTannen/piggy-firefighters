/**
 * ROUND CELEBRATION TIER — docs/GAME_CONTRACT.md §8 "Win-tier rule" (v1.3.1, one table for every round).
 *
 * The client derives the celebration tier of a round from its booked round total `W` and the charged cost `S` of the
 * selected mode. It NEVER reads the SDK `winLevel` fields of `setWin` / `freeSpinEnd` (they are informational only):
 *
 *   1. precedence — the stake check first: W <= S  ->  tier 0 (neutral: meter, line highlights and balance stay, but
 *      no rung, no celebration stinger, no plate). A 2.4x return on a 3x ante spin, or 50x on a 100x Inferno buy,
 *      is tier 0.
 *   2. then the floors, in COST units (W/S) — owner 2026-09-28 "get rid of the display modals for small wins": a win is
 *      celebrated for what it returned on what the player PAID, so a 16x line on a 5x FIVE-ALARM spin (3.2x the stake)
 *      or a 101x total on a 100x Inferno buy is an ordinary win, not a BIG / EPIC sign (v1.2.2 measured the floors in
 *      base-bet units, which raised those signs):
 *        tier 1 ordinary win   S < W < 15S
 *        tier 2 BIG WIN        >= 15S
 *        tier 3 HUGE WIN       >= 30S
 *        tier 4 MEGA WIN       >= 50S
 *        tier 5 EPIC WIN       >= 100S
 *        tier 6 MAX WIN        the 20,000x cap (only on cap evidence: a `wincap` event)
 *      In the base game (S = 1x) this is the same table as before.
 *
 * The numbering 0..6 is the `animBeat winTier` numbering (docs/ANIMATION_CONTRACT.md). Rungs play ONCE per round, on
 * the round total (base finalWin total, freeSpinEnd, backdraftSpinsEnd); per-spin wins inside a bonus get the ordinary
 * win presentation.
 *
 * Amounts here are BOOKED units (integer x100 of the base bet), so B = 100 and a booked amount is only ever COMPARED.
 * This module has no imports so node-run checks (qa/gate/*) can load it directly.
 */

/** The max win, x the base bet (`math/games/piggy_firefighters/game_config.py` wincap; config.ts `max_win`). */
export const WIN_CAP_X = 20000;
/** The max win in BOOKED units (x100 of the base bet): 2,000,000 = 20,000x. Every drawn figure that could pass it
 *  (the WinRungs sign) is drawn as min(figure, WIN_CAP_BOOKED); booked amounts and settlement are never changed. */
export const WIN_CAP_BOOKED = WIN_CAP_X * 100;

/** Booked units of one base bet. */
export const BASE_BET_BOOKED = 100;
/** SMALL WINS SHOW NO FIGURE OVER THE REELS (owner, 2026-09-25: "get rid of small win displays"; 2026-09-28: "get rid of
 *  the display modals for small wins"). A win of 20x the CHARGED COST or less gets no centred amount: the HUD WIN meter
 *  (or the feature's own total) carries it and the line highlight shows where it came from. Above 20x the cost the centred
 *  count-up with the coin shower runs (inside a feature; in the base game anything from 15x is already a win rung). */
export const SMALL_WIN_MAX_X = 20;
/** The 1x-cost threshold in booked units (components/Win.svelte's coin-shower line); the handler uses smallWinMaxBooked. */
export const SMALL_WIN_MAX_BOOKED = SMALL_WIN_MAX_X * 100;
/** The small-win ceiling of a round charged `costX` x the base bet, in booked units (x100 of the base bet). */
export const smallWinMaxBooked = (costX: number): number => SMALL_WIN_MAX_X * costUnits(costX);

/** Tier floors in COST units (contract §8 v1.3.1): BIG, HUGE, MEGA, EPIC at 15 / 30 / 50 / 100 x the charged cost. */
export const TIER_FLOORS_X = [15, 30, 50, 100] as const;

/** One charged cost in booked units: costX x 100. A missing / zero cost reads as the 1x base spin. */
const costUnits = (costX: number): number => (Math.max(0, Number(costX) || 0) || 1) * BASE_BET_BOOKED;

export type WinTier = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const TIER_MAX: WinTier = 6;

/**
 * The celebration tier of a round.
 * @param wBooked  booked round total W (x100 of the base bet)
 * @param costX    the charged cost S of the selected mode, x the base bet (config.betModes[mode].cost)
 * @param capped   the round hit the 20,000x cap (a `wincap` event) — the ONLY way to tier 6
 */
export const roundTier = (wBooked: number, costX: number, capped: boolean): WinTier => {
	const w = Number(wBooked) || 0;
	const s = costUnits(costX);
	if (w <= s) return 0;
	if (capped) return 6;
	const x = w / s;
	if (x >= TIER_FLOORS_X[3]) return 5;
	if (x >= TIER_FLOORS_X[2]) return 4;
	if (x >= TIER_FLOORS_X[1]) return 3;
	if (x >= TIER_FLOORS_X[0]) return 2;
	return 1;
};

/** WinRungs sign level for a tier: 6 BIG, 7 HUGE, 8 MEGA, 9 EPIC, 10 MAX (winLevelMap keys); 0 = no rungs. */
export const rungLevelOfTier = (tier: WinTier): number => (tier >= 2 ? tier + 4 : 0);

/** WinRungs climb floors BIG, HUGE, MEGA, EPIC, MAX in booked units for a round charged `costX`: 15 / 30 / 50 / 100 x
 *  the cost, then the cap. The sign flips at exactly these floors and never passes the landed tier or the booked amount. */
export const rungFloorsBooked = (costX: number): readonly number[] => [...TIER_FLOORS_X.map((x) => x * costUnits(costX)), WIN_CAP_BOOKED];
/** The 1x-cost table (the base spin; qa/gate pacing checks). */
export const RUNG_FLOORS_BOOKED: readonly number[] = rungFloorsBooked(1);

/** WinRungs level 10 = MAX WIN. */
export const MAX_WIN_LEVEL = 10;
