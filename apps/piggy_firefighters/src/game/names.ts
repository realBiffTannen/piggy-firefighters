/**
 * LUCKY — the ONE player-facing naming table.
 *
 * The law is docs/LUCKY_THEME.md: §2 characters, §3 symbols, §4 building tiers, §5 features, modes and
 * mechanics. Internal ids (bet-mode keys, symbol ids, book event types, asset keys) never change; only the
 * words the player reads do, and every component takes them from here so a rename is one edit.
 */

export const GAME_TITLE = 'LUCKY';

/** Bet-mode titles (theme §5), keyed by the internal bet-mode key. Used verbatim on buy cards and rules
 *  headings. `golden_four` keeps its lower-case "x4" exactly as the theme bible writes it. */
export const MODE_TITLE = {
	ante: 'LUCKY ANTE',
	super_ante: 'DRAGON ANTE',
	hold_and_build: 'FORTUNE BUILD',
	build_or_bust: 'FORTUNE OR BUST',
	expanded_hold_and_build: 'FORTUNE CITY',
	golden_build: 'GOLDEN DRAGON BUILD',
	expanded_golden_build: 'GOLDEN DRAGON CITY',
	golden_four: 'GOLDEN DRAGON CITY x4',
} as const;

/** The same names in running text (rules sentences, card subtitles, aria text). */
export const FEATURE = {
	ante: 'Lucky Ante',
	superAnte: 'Dragon Ante',
	holdAndBuild: 'Fortune Build',
	buildOrBust: 'Fortune or Bust',
	expandedHoldAndBuild: 'Fortune City',
	goldenBuild: 'Golden Dragon Build',
	goldenExpanded: 'Golden Dragon City',
	goldenFour: 'Golden Dragon City x4',
} as const;

/** Mechanic re-themes (theme §5, second table). */
export const MECHANIC = {
	/** donor "Huff & Puff" gust */
	gust: "Dragon's Breath",
	/** donor "Hard Hat Delivery" */
	delivery: 'Lantern Cart',
	/** donor "SITE PERMIT" count reel */
	decree: 'Imperial Decree',
	/** donor "Street Bonus" / "FULL STREET" */
	street: 'Lucky Street',
	/** donor "Grand Opening" */
	festival: 'Grand Festival',
	/** donor "+1 spin" */
	luckySpin: 'Lucky Spin',
} as const;

/** A board of a multi-board feature is a DISTRICT (theme §5: "2–4 districts (boards) at once"). */
export const DISTRICT = 'DISTRICT';
export const DISTRICTS = 'DISTRICTS';
export const districtsText = (n: number) => `${n} ${n === 1 ? DISTRICT : DISTRICTS}`;

/** Reel symbols (theme §3). */
export const SYMBOL_NAME: Record<string, string> = {
	H1: 'Gold Ingot',
	H2: 'Jade Pendant',
	H3: 'Red Envelope',
	H4: 'Firecrackers',
	L1: 'Paper Fan',
	L2: 'Teapot',
	L3: 'Coin String',
	W: 'Master Bao',
	HAT: 'Red Lantern',
	GHAT: 'Golden Lantern',
};

/** Building tiers (theme §4); index = tier, 0 unused. */
export const TIER_NAME = ['', 'Bamboo Hut', 'Wooden Teahouse', 'Courtyard House', 'Pagoda', 'Imperial Palace'] as const;
