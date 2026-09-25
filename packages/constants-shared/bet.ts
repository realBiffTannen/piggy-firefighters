export const SMALLEST_FIAT_UNIT = 0.01;
export const API_AMOUNT_MULTIPLIER = 1000000; // In API, amount 1000000 is 1 dollar.
export const BOOK_AMOUNT_MULTIPLIER = 100; // In books, amount 100 is 1 dollar.

/** The betting parameters `/authenticate` returns under `config`, in API units.
 *  Every field is optional because operators send different subsets. */
export type RgsBetConfig = {
	betLevels?: number[];
	minBet?: number;
	maxBet?: number;
	stepBet?: number;
	/** The SAME increment as `stepBet`, under the name the published approval
	 *  guidelines use for it. The wire schema (rgs-fetcher/src/schema.ts:211)
	 *  calls the field `stepBet`; the guideline calls it `minStep`. An operator
	 *  sends one or the other, and reading only `stepBet` is what collapsed a
	 *  `minBet`/`maxBet`/`minStep` payload to its two bounds (GT-25). */
	minStep?: number;
	/** The amount the operator wants the game to open on. Read here ONLY as a
	 *  ladder anchor — see `resolveBetLevels`. */
	defaultBetLevel?: number;
};

/** How many levels a synthesised ladder may hold. A pathological
 *  min/max/step (step of one cent across a $10,000 range) would otherwise
 *  build a million-entry array and hang the boot. */
const MAX_SYNTHESISED_LEVELS = 200;

/** How many amounts the bet MENU shows. The grid renders a fixed-size block,
 *  so this is a presentation constant — the full ladder stays selectable
 *  through the +/- stepper regardless. */
export const BET_MENU_OPTION_COUNT = 19;

/** The ladder of selectable bet amounts, in API units.
 *
 *  Order of authority, all of it the RGS's:
 *    1. `betLevels`, if sent — clamped to `minBet`/`maxBet` when those are
 *       also sent, because an operator may narrow a shared ladder per
 *       jurisdiction and the narrower bound wins.
 *    2. otherwise a ladder synthesised from `minBet`/`maxBet`/`stepBet`.
 *    3. otherwise empty, and the caller keeps whatever it had.
 *
 *  Nothing here invents an amount that the RGS did not authorise: a
 *  synthesised ladder only ever contains multiples of `stepBet` inside
 *  [`minBet`, `maxBet`].
 */
/** The bet increment the RGS sent, under EITHER of its two published names.
 *
 *  `stepBet` is the wire schema's spelling and `minStep` the approval
 *  guidelines'. They are the same quantity in the same units, operators send
 *  one or the other, and accepting both costs nothing — whereas accepting only
 *  `stepBet` leaves a `minStep` operator with no ladder at all.
 *  `stepBet` wins when both arrive, because it is the spelling the wire
 *  contract this client is written against actually declares.
 */
export const resolveStepBet = (config: RgsBetConfig): number | undefined => {
	if (Number.isFinite(config.stepBet)) return config.stepBet as number;
	if (Number.isFinite(config.minStep)) return config.minStep as number;
	return undefined;
};

export const resolveBetLevels = (config: RgsBetConfig): number[] => {
	const min = Number.isFinite(config.minBet) ? (config.minBet as number) : undefined;
	const max = Number.isFinite(config.maxBet) ? (config.maxBet as number) : undefined;
	const inBounds = (v: number) =>
		(min === undefined || v >= min) && (max === undefined || v <= max);

	const declared = (config.betLevels ?? []).filter((v) => Number.isFinite(v) && v > 0);
	if (declared.length) {
		const kept = [...new Set(declared.filter(inBounds))].sort((a, b) => a - b);
		// An operator whose bounds exclude every declared level is
		// misconfigured; the declared ladder is the safer of the two readings
		// because it is the one the player can actually be charged for.
		return kept.length ? kept : [...new Set(declared)].sort((a, b) => a - b);
	}

	const step = resolveStepBet(config);
	if (min === undefined || max === undefined || max < min) return [];
	if (!step || step <= 0) return [min, ...(max > min ? [max] : [])];

	const span = Math.floor((max - min) / step);
	const stride = Math.max(1, Math.ceil((span + 1) / MAX_SYNTHESISED_LEVELS));
	const levels: number[] = [];
	for (let i = 0; i <= span; i += stride) levels.push(min + i * step);
	// The ceiling is a legal bet even when it is not on the stride.
	if (levels[levels.length - 1] !== max && inBounds(max)) levels.push(max);

	// ...and so is the operator's OWN default, for exactly the same reason.
	// `stride` thins the ladder so a one-cent step across a $10,000 range cannot
	// build a million entries, and thinning is what threw away the one amount
	// the operator asked the game to open on: `snapToBetLevel` can only choose
	// from what is in here, so a $1.00 default against a 0.01/0.51/1.01 stride
	// opened the session on the wrong stake. Inserted in order rather than
	// appended, and only when it is a whole number of steps above `minBet`
	// inside the bounds — nothing enters the ladder that the RGS did not
	// already authorise.
	const requestedDefault = Number.isFinite(config.defaultBetLevel)
		? (config.defaultBetLevel as number)
		: undefined;
	if (requestedDefault !== undefined && inBounds(requestedDefault) && !levels.includes(requestedDefault)) {
		const steps = (requestedDefault - min) / step;
		if (Math.abs(steps - Math.round(steps)) < 1e-6) {
			const at = levels.findIndex((level) => level > requestedDefault);
			levels.splice(at < 0 ? levels.length : at, 0, requestedDefault);
		}
	}
	return levels;
};

/** Evenly-spaced representatives of `levels`, first and last always included.
 *
 *  Replaces a hardcoded index list (`[0, 2, 5, 7, ... 38]`) that only made
 *  sense for the 39-level ladder it was tuned against: against a 10-level
 *  ladder it showed four amounts and hid the rest, and against a 60-level one
 *  it stopped at index 38 and hid the whole top third. Deriving from the
 *  ladder's own length is the same spread for any length.
 */
export const selectBetMenuOptions = (
	levels: number[],
	count: number = BET_MENU_OPTION_COUNT,
): number[] => {
	if (levels.length <= count || count < 2) return [...levels];
	const picked = new Set<number>();
	for (let i = 0; i < count; i++) {
		picked.add(Math.round((i * (levels.length - 1)) / (count - 1)));
	}
	return [...picked].sort((a, b) => a - b).map((index) => levels[index]);
};

/** The nearest legal amount to `value`, ties going to the lower level so a
 *  clamp can never raise what a player is charged. Returns `undefined` when
 *  there is no ladder to snap to. */
export const snapToBetLevel = (value: number, levels: number[]): number | undefined => {
	if (!levels.length) return undefined;
	if (levels.includes(value)) return value;
	return levels.reduce((best, level) =>
		Math.abs(level - value) < Math.abs(best - value) ? level : best,
	);
};

/** The round `/authenticate` returns alongside the config. */
export type RgsRound = {
	active?: boolean;
	amount?: number;
	mode?: string;
	state?: unknown;
};

/** What a returned round authorises the client to restore.
 *
 *  `/authenticate` returns the last round whether or not it is still open, so
 *  `active` is the only thing separating "resume this" from "this already
 *  finished". Restoring the bet off a FINISHED round is what made a reload
 *  keep the previous stake instead of returning to the operator's default.
 *
 *  The three answers are deliberately not the same test:
 *    * `restoreBet` demands `active === true` — the checklist rule is that an
 *      ACTIVE round's amount replaces `defaultBetLevel`, and nothing else does.
 *    * `resumeState` and `applyMode` only stand down when the round is
 *      EXPLICITLY settled, so an operator that omits `active` keeps the
 *      long-standing resume behaviour rather than losing a live round.
 */
export const resolveRoundResume = (round?: RgsRound | null) => {
	const settled = round?.active === false;
	return {
		restoreBet:
			round?.active === true && Number.isFinite(round?.amount) && (round?.amount as number) > 0,
		resumeState: Boolean(round?.state) && !settled,
		applyMode: Boolean(round?.mode) && !settled,
	};
};
