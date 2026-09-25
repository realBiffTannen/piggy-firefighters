/**
 * LUCKY splash — the intro-card deck and every string the splash shows.
 *
 * THE DECK mirrors `static/assets/splash/manifest.json` (same ids, same art file
 * names, same titleKey / bodyKey, same order). The manifest is the art lane's
 * registry; it is NOT fetched at runtime, because a fetch would put a network
 * round-trip in front of the first card on a cold cache. Add a card in both
 * places.
 *
 * COPY. Player-facing, so it follows the same two rules as game/rulesContent.ts:
 *   - it states real rules (each line below cites the rule it is taken from);
 *   - it carries NO cash vocabulary at all, in either the standard or the social
 *     variant, so one wording serves both. The platform, if ever named, is
 *     "Engine".
 * Figures are written once, in RULES below, and interpolated — the maximum win
 * is read from the game config rather than typed.
 *
 * I18N. The splash mounts OUTSIDE <LoadI18n> (it has to paint before
 * authentication resolves), so it cannot use the live Lingui instance. Instead
 * it reads the app's own message catalogue directly: when a key below is added
 * to `src/i18n/messagesMap/<lang>.ts` that text wins, with no code change here.
 * Until then the English table below is the fallback for every language.
 */
import { stateUrlDerived } from 'state-shared';

import config from '../../game/config';
import { FEATURE, GAME_TITLE, MECHANIC, MODE_TITLE, TIER_NAME } from '../../game/names';
import messagesMap from '../../i18n/messagesMap';

export type SplashCard = {
	id: string;
	art: string;
	titleKey: string;
	bodyKey: string;
};

/** Same ids / files / keys / order as static/assets/splash/manifest.json (ART-B's registry). Ids and file names
 *  are internal and keep their donor spelling; ART-B repaints the files in place. `golden_four` is LUCKY's new
 *  card: ART-B supplies `card_golden_four.webp` and its manifest entry — until the file lands the deck skips it
 *  (it only ever turns to a card whose art arrived) and the request 404s once. */
export const SPLASH_DECK: readonly SplashCard[] = [
	{ id: 'hold_build', art: 'card_hold_build.webp', titleKey: 'SPLASH_CARD_HOLD_TITLE', bodyKey: 'SPLASH_CARD_HOLD_BODY' },
	{ id: 'golden_build', art: 'card_golden_build.webp', titleKey: 'SPLASH_CARD_GOLDEN_TITLE', bodyKey: 'SPLASH_CARD_GOLDEN_BODY' },
	{ id: 'expanded', art: 'card_expanded.webp', titleKey: 'SPLASH_CARD_EXPANDED_TITLE', bodyKey: 'SPLASH_CARD_EXPANDED_BODY' },
	{ id: 'golden_expanded', art: 'card_golden_expanded.webp', titleKey: 'SPLASH_CARD_GOLDEN_EXPANDED_TITLE', bodyKey: 'SPLASH_CARD_GOLDEN_EXPANDED_BODY' },
	{ id: 'golden_four', art: 'card_golden_four.webp', titleKey: 'SPLASH_CARD_GOLDEN_FOUR_TITLE', bodyKey: 'SPLASH_CARD_GOLDEN_FOUR_BODY' },
	{ id: 'huff_puff', art: 'card_huff_puff.webp', titleKey: 'SPLASH_CARD_GUST_TITLE', bodyKey: 'SPLASH_CARD_GUST_BODY' },
	{ id: 'streets', art: 'card_streets.webp', titleKey: 'SPLASH_CARD_STREETS_TITLE', bodyKey: 'SPLASH_CARD_STREETS_BODY' },
	{ id: 'max_win', art: 'card_max_win.webp', titleKey: 'SPLASH_CARD_MAX_TITLE', bodyKey: 'SPLASH_CARD_MAX_BODY' },
];

export const SPLASH_SHUTTER = {
	slatsTile: 'shutter_slats_tile.webp',
	bottomBar: 'shutter_bottom_bar.webp',
} as const;

/**
 * Resolve a splash asset against THE PAGE, never the module and never the
 * origin root: the platform serves the bundle from a versioned subpath, so a
 * root-absolute path 404s there and `import.meta.url` points into the hashed
 * chunk directory.
 */
export const splashAssetUrl = (file: string): string =>
	typeof document === 'undefined' ? '' : new URL(`./assets/splash/${file}`, document.baseURI).href;

/** The rule figures the cards quote — each typed exactly once. */
const RULES = {
	/** rulesContent.ts `symbols` → RED LANTERN: "6 or more anywhere on one spin". */
	triggerHats: 6,
	/** rulesContent.ts `golden`: starting and new buildings are Tier 3 (Courtyard House) or better. */
	goldenFloorTier: 3,
	/** rulesContent.ts `golden`: "Some lanterns are GOLDEN: +2 tiers". */
	goldenHatTiers: 2,
	/** rulesContent.ts LUCKY STREET: a completed row is worth ×2. */
	streetMultiplier: 2,
	/** rulesContent.ts GRAND FESTIVAL: all 15 cells built → ×10. */
	grandOpeningMultiplier: 10,
	/** the 5 × 3 board */
	cells: config.numReels * config.numRows[0],
	/** rulesContent.ts `limits`: the maximum win, read from the mode table. */
	maxWin: config.betModes.base.max_win,
} as const;

const figures: Record<string, string> = {
	lanterns: String(RULES.triggerHats),
	tier: String(RULES.goldenFloorTier),
	plus: String(RULES.goldenHatTiers),
	street: String(RULES.streetMultiplier),
	grand: String(RULES.grandOpeningMultiplier),
	cells: String(RULES.cells),
	max: RULES.maxWin.toLocaleString('en-US'),
};

/** English fallback. `{name}` tokens are filled from `figures`. Feature and mechanic names come from
 *  game/names.ts (theme §5). No price and no buy / bet wording on any card, so every line reads the same in
 *  social mode. */
const FALLBACK: Record<string, string> = {
	SPLASH_ARIA: `${GAME_TITLE} — press anywhere to start`,
	SPLASH_BUMPER: 'A CRASH GALAXY GAME',
	SPLASH_LOADING: 'LIGHTING THE LANTERNS…',
	SPLASH_PRESS: 'PRESS ANYWHERE TO START',

	SPLASH_CARD_HOLD_TITLE: MODE_TITLE.hold_and_build,
	SPLASH_CARD_HOLD_BODY: '{lanterns}+ red lanterns start the build. Every door holds a prize.',

	SPLASH_CARD_GOLDEN_TITLE: MODE_TITLE.golden_build,
	SPLASH_CARD_GOLDEN_BODY: `A Golden Lantern gilds the whole street: buildings start at Tier {tier} (${TIER_NAME[3]}), golden lanterns add +{plus} tiers.`,

	SPLASH_CARD_EXPANDED_TITLE: MODE_TITLE.expanded_hold_and_build,
	SPLASH_CARD_EXPANDED_BODY: 'The city grows: 2 to 4 districts build at once.',
	// expanded_golden_build opens TWO Golden districts, guaranteed (Codex: always two full-value boards).
	SPLASH_CARD_GOLDEN_EXPANDED_TITLE: MODE_TITLE.expanded_golden_build,
	SPLASH_CARD_GOLDEN_EXPANDED_BODY: `${FEATURE.goldenBuild} in 2 full districts, every time.`,
	// golden_four opens FOUR Golden districts, guaranteed, every door at half value (docs/GAME_CONTRACT.md §8).
	SPLASH_CARD_GOLDEN_FOUR_TITLE: MODE_TITLE.golden_four,
	SPLASH_CARD_GOLDEN_FOUR_BODY: `${FEATURE.goldenBuild} in 4 full districts at once, every door at half value.`,

	SPLASH_CARD_GUST_TITLE: MECHANIC.gust.toUpperCase(),
	SPLASH_CARD_GUST_BODY: 'The Golden Dragon can breathe extra lanterns onto the reels.',

	SPLASH_CARD_STREETS_TITLE: `${MECHANIC.street.toUpperCase()} & ${MECHANIC.festival.toUpperCase()}`,
	SPLASH_CARD_STREETS_BODY: 'Finish a row for ×{street}. Fill all {cells} for ×{grand}.',

	SPLASH_CARD_MAX_TITLE: 'MAX WIN',
	SPLASH_CARD_MAX_BODY: 'Win up to {max}× in every mode.',
};

const catalogue = (): Record<string, unknown> => {
	const all = messagesMap as unknown as Record<string, Record<string, unknown> | undefined>;
	let lang = 'en';
	try {
		lang = stateUrlDerived.lang();
	} catch {
		/* no URL to read: English */
	}
	// own-property guard: `?lang=toString` must not resolve to an inherited member
	return (Object.hasOwn(all, lang) ? all[lang] : all.en) ?? {};
};

/** One splash string: the app catalogue if it has the key, else the fallback. */
export const splashText = (key: string): string => {
	const fromApp = catalogue()[key];
	const raw = typeof fromApp === 'string' && fromApp.length > 0 ? fromApp : (FALLBACK[key] ?? '');
	return raw.replace(/\{(\w+)\}/g, (whole, name: string) => figures[name] ?? whole);
};
