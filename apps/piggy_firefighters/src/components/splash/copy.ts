/**
 * PIGGY FIREFIGHTERS splash — the intro-card deck and every string the splash shows.
 *
 * THE DECK mirrors `static/assets/placeholder/splash/manifest.json` (same ids, same art file names, same titleKey /
 * bodyKey, same order). The manifest is the art lane's registry; it is NOT fetched at runtime, because a fetch would
 * put a network round-trip in front of the first card on a cold cache. Add a card in both places.
 *
 * COPY. Player-facing, so it follows the same two rules as game/rulesContent.ts:
 *   - it states real rules (each figure below cites the contract rule it is taken from);
 *   - it carries NO cash vocabulary at all, in either the standard or the social variant, so one wording serves
 *     both. The platform, if ever named, is "Engine".
 * Figures are written once, in RULES below, from `config` / the contract, and interpolated — never typed twice.
 *
 * I18N. The splash mounts OUTSIDE <LoadI18n> (it has to paint before authentication resolves), so it cannot use the
 * live Lingui instance. Instead it reads the app's own message catalogue directly: when a key below is added to
 * `src/i18n/messagesMap/<lang>.ts` that text wins, with no code change here. Until then the English table below is
 * the fallback for every language.
 */
import { stateUrlDerived } from 'state-shared';

import config from '../../game/config';
import { FEATURE, GAME_TITLE, MECHANIC, MODE_TITLE, SYMBOL_NAME } from '../../game/names';
import { CONTRACT } from '../../game/rulesContent';
import messagesMap from '../../i18n/messagesMap';

export type SplashCard = {
	id: string;
	art: string;
	titleKey: string;
	bodyKey: string;
};

/** Same ids / files / keys / order as static/assets/placeholder/splash/manifest.json. The art files are PLACEHOLDERS
 *  (tools/placeholder/make_placeholders.py) until the art lane repaints them in place (768x768, no text). */
export const SPLASH_DECK: readonly SplashCard[] = [
	{ id: 'chief', art: 'card_chief.webp', titleKey: 'SPLASH_CARD_CHIEF_TITLE', bodyKey: 'SPLASH_CARD_CHIEF_BODY' },
	{ id: 'lines', art: 'card_lines.webp', titleKey: 'SPLASH_CARD_LINES_TITLE', bodyKey: 'SPLASH_CARD_LINES_BODY' },
	{ id: 'backdraft', art: 'card_backdraft.webp', titleKey: 'SPLASH_CARD_BACKDRAFT_TITLE', bodyKey: 'SPLASH_CARD_BACKDRAFT_BODY' },
	{ id: 'alarm', art: 'card_alarm.webp', titleKey: 'SPLASH_CARD_ALARM_TITLE', bodyKey: 'SPLASH_CARD_ALARM_BODY' },
	{ id: 'rescue', art: 'card_rescue.webp', titleKey: 'SPLASH_CARD_RESCUE_TITLE', bodyKey: 'SPLASH_CARD_RESCUE_BODY' },
	{ id: 'maxwin', art: 'card_maxwin.webp', titleKey: 'SPLASH_CARD_MAX_TITLE', bodyKey: 'SPLASH_CARD_MAX_BODY' },
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
	typeof document === 'undefined' ? '' : new URL(`./assets/placeholder/splash/${file}`, document.baseURI).href;

/** The rule figures the cards quote — each typed exactly once (contract §3-§6 via rulesContent CONTRACT, config). */
const RULES = {
	/** contract §3: 20 fixed lines */
	lines: (config.paylines as number[][]).length,
	/** contract §4: 3 alarms start Rescue Spins with 10 spins */
	triggerAlarms: CONTRACT.trigger[0][0],
	triggerSpins: CONTRACT.trigger[0][1],
	/** contract §4: 2-5 cells ignite */
	blazeMin: CONTRACT.backdraftCells[0],
	blazeMax: CONTRACT.backdraftCells[1],
	/** contract §5: five rooms, +1 multiplier per rescue */
	rooms: CONTRACT.rooms,
	step: CONTRACT.rescueStep,
	/** rulesContent.ts `limits`: the maximum win, read from the mode table. */
	maxWin: config.betModes.base.max_win,
} as const;

const figures: Record<string, string> = {
	lines: String(RULES.lines),
	alarms: String(RULES.triggerAlarms),
	spins: String(RULES.triggerSpins),
	blazeMin: String(RULES.blazeMin),
	blazeMax: String(RULES.blazeMax),
	rooms: String(RULES.rooms),
	step: String(RULES.step),
	max: RULES.maxWin.toLocaleString('en-US'),
};

/** English fallback. `{name}` tokens are filled from `figures`. Feature and mechanic names come from game/names.ts
 *  (theme §5). No price and no buy / bet wording on any card, so every line reads the same in social mode. */
const FALLBACK: Record<string, string> = {
	SPLASH_ARIA: `${GAME_TITLE} — press anywhere to start`,
	SPLASH_BUMPER: 'A CRASH GALAXY GAME',
	SPLASH_LOADING: 'SOUNDING THE ALARM…',
	SPLASH_PRESS: 'PRESS ANYWHERE TO START',

	SPLASH_CARD_CHIEF_TITLE: SYMBOL_NAME.W.toUpperCase(),
	SPLASH_CARD_CHIEF_BODY: 'The chief of Station 13 is WILD: he stands in for every paying symbol on the line.',

	SPLASH_CARD_LINES_TITLE: '{lines} LINES',
	SPLASH_CARD_LINES_BODY: '{lines} fixed lines, left to right. The best win on each line counts.',

	SPLASH_CARD_BACKDRAFT_TITLE: MECHANIC.backdraft.toUpperCase(),
	SPLASH_CARD_BACKDRAFT_BODY: `A flash of flame can turn {blazeMin} to {blazeMax} cells into ${MECHANIC.blazeWild}s.`,

	SPLASH_CARD_ALARM_TITLE: SYMBOL_NAME.ALARM.toUpperCase(),
	SPLASH_CARD_ALARM_BODY: `{alarms} alarms start ${FEATURE.rescue}. A ${SYMBOL_NAME.GALARM} among them starts ${FEATURE.inferno}.`,

	SPLASH_CARD_RESCUE_TITLE: MODE_TITLE.rescue,
	SPLASH_CARD_RESCUE_BODY: 'Hose down {rooms} burning rooms: every rescue adds +{step}× to the multiplier and a spin.',

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
