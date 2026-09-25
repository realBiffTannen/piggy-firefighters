/**
 * ROUND-TOTAL CELEBRATION TIER — the one place the client maps a booked round total to a rung LEVEL.
 *
 * The celebration floors live HERE and nowhere else in the client. `components/WinRungs.svelte` derives its count-up
 * pacing tables from END_FEATURE_FLOORS / STANDARD_FLOORS (levels 6-9) plus WIN_CAP_BOOKED for the MAX rung, so the
 * on-screen rung label flips at exactly these floors, never passes the level chosen here, and the win sign never
 * shows more than the booked amount (at most the 25,000x cap). (Before r6 WinRungs held its own copy whose MAX entry
 * was 10000000, the donor's 100,000x cap in booked units: on a capped round the sign counted DOWN from ~$100,000 on a
 * $1 bet to $25,000.)
 *
 * OWNER RULING (2026-09-24): the end-of-feature celebration tier may be DERIVED client-side from the booked round
 * total. The math books `buildEnd.winLevel` / `expandEnd.winLevel` from the FEATURE share only; the plate shows
 * the ROUND total (finalWin / setTotalWin, which also carries any entry win), so ~0.1% of base books (e.g. book
 * 6208: 48x feature = band 5, 52x round = band 6) celebrated one rung low.
 *
 * SOURCE of the table (read-only, not re-tuned here): `math/src/config/config.py` `Config.get_win_level(amount,
 * "endFeature")`, the table the math uses for buildEnd / expandEnd (`math/games/lucky/game_events.py`
 * build_end_event / expand_end_event; `docs/GAME_CONTRACT.md` "winLevel (endFeature table)"), with
 * `wincap = 25000` (`math/games/lucky/game_config.py`). Level numbers are the keys of `winLevelMap.ts`
 * (6 BIG, 7 SUPER, 8 MEGA, 9 EPIC, 10 MAX).
 *
 *   level:      1      2      3       4        5        6         7          8           9           10
 *   x bet:   [0,1)  [1,5)  [5,10)  [10,20)  [20,50)  [50,100)  [100,500)  [500,2000)  [2000,25000)  cap
 *
 * The floors below are written in BOOKED units (integer x100 of the base bet), so a booked amount is only ever
 * COMPARED against them: no arithmetic on a booked amount, and amounts are never changed here.
 * MAX (10) is the 25,000x cap ONLY: it is returned only on cap evidence (a `wincap` event / the math's own
 * level 10), never from an amount alone.
 */
export const MAX_WIN_LEVEL = 10;

/** The max win, x the base bet (`math/games/lucky/game_config.py` wincap). config.ts `betModes[*].max_win` states the
 *  same number for the RGS/HUD; the two client copies are machine-checked equal (every mode) and equal to the math's
 *  wincap by qa/gate_fixes/capdisplay/check_source.mjs. It is a literal (not imported from config.ts) so node-run
 *  checks can import this module directly. */
export const WIN_CAP_X = 25000;
/** The max win in BOOKED units (integer x100 of the base bet): 2,500,000 = 25,000x = $25,000.00 on a $1 bet.
 *  Every DRAWN figure that can pass it is drawn as min(figure, WIN_CAP_BOOKED): the WinRungs sign, the expanded
 *  scene's FEATURE TOTAL / TOTAL meter (BuildScene) and a single board's own TOTAL sign (BuildBoard). Booked
 *  amounts, the plate and settlement are never changed. */
export const WIN_CAP_BOOKED = WIN_CAP_X * 100;

/** [winLevel, inclusive floor in booked units (x100 of the base bet)] for levels 1-9, ascending. */
export const END_FEATURE_FLOORS: readonly (readonly [number, number])[] = [
	[1, 0],
	[2, 100],
	[3, 500],
	[4, 1000],
	[5, 2000],
	[6, 5000],
	[7, 10000],
	[8, 50000],
	[9, 200000],
] as const;

/** Mirrors `Config.get_win_level(amount, "standard")` (the base-game setWin table), levels 1-9, booked units:
 *  x bet [0,0.1) [0.1,1) [1,2) [2,5) [5,15) [15,30) [30,50) [50,100) [100,25000); level 10 = the cap. Only
 *  WinRungs' count-up pacing reads it; the base-game level itself is the math's booked setWin.winLevel. */
export const STANDARD_FLOORS: readonly (readonly [number, number])[] = [
	[1, 0],
	[2, 10],
	[3, 100],
	[4, 200],
	[5, 500],
	[6, 1500],
	[7, 3000],
	[8, 5000],
	[9, 10000],
] as const;

/** The endFeature level of a booked round total (x100 of the base bet). `capped` is the ONLY way to MAX. */
export const endFeatureLevelOf = (bookedAmount: number, capped: boolean): number => {
	if (capped) return MAX_WIN_LEVEL;
	let level = END_FEATURE_FLOORS[0][0];
	for (const [lvl, floor] of END_FEATURE_FLOORS) if (bookedAmount >= floor) level = lvl;
	return level;
};

type TierEvent = { index: number; type: string; amount?: number; winLevel?: unknown };

/**
 * The celebration rung for a feature end, in priority order:
 *  1. a `winLevel` the book puts on its round-total event (last finalWin / setTotalWin after the feature end) —
 *     the math's own round level, when a book ever carries one (0cd027c reader, forward-compatible);
 *  2. otherwise the rung DERIVED from the booked round total with the endFeature table above, applied only
 *     when it differs from the feature-share level (so every book whose feature and round share a band keeps
 *     exactly the math's booked level);
 *  3. with no round-total event in view (an isolated presentation call), the feature-share level unchanged.
 * `roundTotal` is the amount the plate shows (finalRoundAmount); `cappedHint` is the director's wincap state.
 */
export const roundCelebrationLevel = (
	featureEnd: { index: number; winLevel: number },
	bookEvents: readonly TierEvent[],
	roundTotal: number,
	cappedHint = false,
): { level: number; source: 'bookedRound' | 'derived' | 'featureEnd' } => {
	let roundEvent: TierEvent | undefined;
	for (let i = bookEvents.length - 1; i >= 0; i -= 1) {
		const event = bookEvents[i];
		if (event.index <= featureEnd.index || (event.type !== 'finalWin' && event.type !== 'setTotalWin')) continue;
		const level = event.winLevel;
		if (typeof level === 'number' && Number.isFinite(level)) return { level, source: 'bookedRound' };
		roundEvent ??= event;
	}
	if (!roundEvent) return { level: featureEnd.winLevel, source: 'featureEnd' };
	const capped = cappedHint || featureEnd.winLevel === MAX_WIN_LEVEL || bookEvents.some((event) => event.type === 'wincap');
	const derived = endFeatureLevelOf(roundTotal, capped);
	return derived !== featureEnd.winLevel ? { level: derived, source: 'derived' } : { level: featureEnd.winLevel, source: 'featureEnd' };
};
