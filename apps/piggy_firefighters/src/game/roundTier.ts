/**
 * ROUND CELEBRATION TIER — docs/GAME_CONTRACT.md §8 "Win-tier rule" (v1.2.2, one table for every round).
 *
 * The client derives the celebration tier of a round from its booked round total `W`, the charged cost `S` of the
 * selected mode and the base bet `B`. It NEVER reads the SDK `winLevel` fields of `setWin` / `freeSpinEnd` (they are
 * informational only):
 *
 *   1. precedence — the stake check first: W <= S  ->  tier 0 (neutral: meter, line highlights and balance stay, but
 *      no rung, no celebration stinger, no plate). A 1.2x return on a 1.5x ante spin, or 50x on a 90x Inferno buy,
 *      is tier 0.
 *   2. then the floors, in BASE-BET units (W/B), never in cost units:
 *        tier 1 ordinary win   S < W < 15B
 *        tier 2 BIG WIN        >= 15B
 *        tier 3 HUGE WIN       >= 30B
 *        tier 4 MEGA WIN       >= 50B
 *        tier 5 EPIC WIN       >= 100B
 *        tier 6 MAX WIN        the 15,000x cap (only on cap evidence: a `wincap` event)
 *
 * The numbering 0..6 is the `animBeat winTier` numbering (docs/ANIMATION_CONTRACT.md). Rungs play ONCE per round, on
 * the round total (base finalWin total, freeSpinEnd, backdraftSpinsEnd); per-spin wins inside a bonus get the ordinary
 * win presentation.
 *
 * Amounts here are BOOKED units (integer x100 of the base bet), so B = 100 and a booked amount is only ever COMPARED.
 * This module has no imports so node-run checks (qa/gate/*) can load it directly.
 */

/** The max win, x the base bet (`math/games/piggy_firefighters/game_config.py` wincap; config.ts `max_win`). */
export const WIN_CAP_X = 15000;
/** The max win in BOOKED units (x100 of the base bet): 1,500,000 = 15,000x. Every drawn figure that could pass it
 *  (the WinRungs sign) is drawn as min(figure, WIN_CAP_BOOKED); booked amounts and settlement are never changed. */
export const WIN_CAP_BOOKED = WIN_CAP_X * 100;

/** Booked units of one base bet. */
export const BASE_BET_BOOKED = 100;

/** Tier floors in base-bet units (contract §8): BIG, HUGE, MEGA, EPIC. */
export const TIER_FLOORS_X = [15, 30, 50, 100] as const;

export type WinTier = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const TIER_MAX: WinTier = 6;

/**
 * The celebration tier of a round.
 * @param wBooked  booked round total W (x100 of the base bet)
 * @param costX    the charged cost S of the selected mode, x the base bet (config.betModes[mode].cost)
 * @param capped   the round hit the 15,000x cap (a `wincap` event) — the ONLY way to tier 6
 */
export const roundTier = (wBooked: number, costX: number, capped: boolean): WinTier => {
	const w = Number(wBooked) || 0;
	const s = Math.max(0, Number(costX) || 0) * BASE_BET_BOOKED;
	if (w <= s) return 0;
	if (capped) return 6;
	const x = w / BASE_BET_BOOKED;
	if (x >= TIER_FLOORS_X[3]) return 5;
	if (x >= TIER_FLOORS_X[2]) return 4;
	if (x >= TIER_FLOORS_X[1]) return 3;
	if (x >= TIER_FLOORS_X[0]) return 2;
	return 1;
};

/** WinRungs sign level for a tier: 6 BIG, 7 HUGE, 8 MEGA, 9 EPIC, 10 MAX (winLevelMap keys); 0 = no rungs. */
export const rungLevelOfTier = (tier: WinTier): number => (tier >= 2 ? tier + 4 : 0);

/** WinRungs climb floors BIG, HUGE, MEGA, EPIC, MAX in booked units: 15 / 30 / 50 / 100 x B, then the cap. The sign
 *  flips at exactly these floors and never passes the landed tier or the booked amount. */
export const RUNG_FLOORS_BOOKED: readonly number[] = [...TIER_FLOORS_X.map((x) => x * BASE_BET_BOOKED), WIN_CAP_BOOKED];

/** WinRungs level 10 = MAX WIN. */
export const MAX_WIN_LEVEL = 10;
