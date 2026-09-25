/**
 * LUCKY × `@crashgalaxy/hud` — the ONE seam between this game and the
 * packaged studio HUD. `routes/+layout.svelte` mounts
 * `<CrashGalaxyHud config={hudConfig}>` with this object.
 *
 * The nine bet modes come from `game/generatedConfig.ts` verbatim (docs/GAME_CONTRACT.md §8, LUCKY amendments);
 * the host derives each mode's KIND from the math flags (docs/INTEGRATION.md §5). Player titles (theme §5):
 *   base                     1x, not a buy   → default spin
 *   ante                     3x, not a buy   → "activate" toggle — LUCKY ANTE
 *   super_ante               10x, not a buy  → a SECOND "activate" tier (HUD `features.anteTiers`) — DRAGON ANTE
 *   hold_and_build           50x, isBuyBonus → buy card — FORTUNE BUILD
 *   build_or_bust            100x, isBuyBonus → buy card (five outcomes) — FORTUNE OR BUST
 *   expanded_hold_and_build  250x, isBuyBonus → buy card — FORTUNE CITY
 *   golden_build             500x, isBuyBonus → buy card — GOLDEN DRAGON BUILD
 *   expanded_golden_build    1000x, isBuyBonus → buy card (TWO golden districts guaranteed) — GOLDEN DRAGON CITY
 *   golden_four              1000x, isBuyBonus → buy card (FOUR golden districts, doors at half value) — GOLDEN DRAGON CITY x4
 * Eight cards in the sheet (base is never a card), laid out as two rows of four at every desktop width. The HUD
 * wraps a crowded (8+) roster only below 1400 px wide / 880 px tall; at 1440x900 its one nowrap row left ~170 px
 * columns and broke the top-bet price mid-number ('$100,000.0' / '0'). src/app.html therefore applies the HUD's
 * own crowded dress from 721 px up and keeps the price figure whole (gate loop r1, seat A roster 17). app.html
 * ships inside index.html, so its style block carries no comments; the rationale lives here.
 *
 * Bet-mode copy and the board-fit geometry are wired here; the rules sheet is
 * game/rulesContent.ts (std + social wording, figures from config, game/prizes.ts and the books).
 */
import type { HudConfig, SymbolCss } from '@crashgalaxy/hud';

import { eventEmitter } from './game/eventEmitter';
import { gameAudioSfx, HUD_SFX_CUES } from './game/audio';
import generatedConfig from './game/generatedConfig';
import { rulesSections } from './game/rulesContent';
import { applySpeedTier } from './game/stateSpeed.svelte';
import { makeHudStrings } from './game/socialFloor';
import { hudMoney } from './game/money';
import { stateXstateDerived } from './game/stateXstate';
import { stateBuild } from './game/build/stateBuild.svelte';
import { stateLayoutDerived } from './game/stateLayout';
import { stateGameDerived } from './game/stateGame.svelte';
import { FEATURE, MECHANIC, MODE_TITLE, TIER_NAME } from './game/names';
import { MEASURED } from './game/rulesContent';
import { prizesFor } from './game/prizes';
import { stateNotice } from './game/stateNotice.svelte';

// ---- Ante always starts OFF --------------------------------------------------
// The HUD restores the ante from localStorage at mount, which would re-arm a 3x-cost mode on a reload
// with no confirmation. A mode that changes what a spin costs must be the player's choice in THIS
// session, so the stored flag is dropped before the HUD reads it.
try {
	if (typeof localStorage !== 'undefined') localStorage.removeItem('lucky-ante');
} catch {
	/* storage blocked — the HUD then has nothing to restore either */
}

// ---- pay-grid art -----------------------------------------------------------
// The rules sheet cuts its pay-grid icons from the game's OWN sprites, so the sheet shows the same
// art the reels do. The files live in static/assets (served next to index.html, not bundled), so the
// URL is resolved at RUNTIME against the page — the same `./assets/…` convention as `buyCardDir`
// below. (`new URL('../assets/…', import.meta.url)` is rewritten by Vite to a file-system path that
// does not exist, which is why the pay grid used to render without any symbols.)
const symbolUrl = (file: string): string =>
	typeof document === 'undefined'
		? `./assets/sprites/symbolsCartoon/${file}.webp`
		: new URL(`./assets/sprites/symbolsCartoon/${file}.webp`, document.baseURI).href;
const SYMBOL_FILE: Record<string, string> = {
	H1: 'h1',
	H2: 'h2',
	H3: 'h3',
	H4: 'h4',
	L1: 'l1',
	L2: 'l2',
	L3: 'l3',
	W: 'w',
	HAT: 'hat',
	GHAT: 'ghat',
};

const symbolCss = (symbolId: string, boxPx: number): SymbolCss | null => {
	const file = SYMBOL_FILE[symbolId];
	if (!file) return null;
	const url = symbolUrl(file);
	return {
		box: `width:${boxPx}px;height:${boxPx}px;`,
		art: `width:100%;height:100%;background-image:url('${url}');background-size:contain;background-repeat:no-repeat;background-position:center;`,
	};
};

// ---- bet-mode card + ante copy ----------------------------------------------
// Named copy (BUY_<KEY>_TITLE / _SPEC / _DESC) wins over the host's generic
// fallback. Titles come from game/names.ts (theme §5); figures come from `copySubs`
// below, never typed into the words. One wording serves std and social: no cash
// vocabulary (bet / pay / buy / cost) appears in any card line.
const stringOverrides = {
	BONUS_NAME: FEATURE.holdAndBuild,
	// the buy dialog's accessible name (the package default is another game's)
	UI_CLASSIFIEDS: 'FEATURE CARDS',

	BUY_BUILD_OR_BUST_TITLE: MODE_TITLE.build_or_bust,
	BUY_BUILD_OR_BUST_SPEC: 'One shot at a feature',
	BUY_BUILD_OR_BUST_DESC: `{holdPct} ${FEATURE.holdAndBuild} · {goldenPct} ${FEATURE.goldenBuild} · {expandedPct} ${FEATURE.expandedHoldAndBuild} · {goldenExpandedPct} ${FEATURE.goldenExpanded} · {bustPct} no feature. The no-feature card wins nothing.`,

	BUY_HOLD_AND_BUILD_TITLE: MODE_TITLE.hold_and_build,
	BUY_HOLD_AND_BUILD_SPEC: '6 spins · every door holds a prize',
	BUY_HOLD_AND_BUILD_DESC: `6–9 buildings, 6 spins. Lanterns build and upgrade; 2+ lanterns on a spin add a ${MECHANIC.luckySpin}. Then every door opens on a prize.`,

	BUY_EXPANDED_HOLD_AND_BUILD_TITLE: MODE_TITLE.expanded_hold_and_build,
	BUY_EXPANDED_HOLD_AND_BUILD_SPEC: '2 to 4 districts · 6 spins each',
	BUY_EXPANDED_HOLD_AND_BUILD_DESC: `The city grows into 2, 3 or 4 full ${FEATURE.holdAndBuild} districts, each with its own spins, doors, ${MECHANIC.street} and ${MECHANIC.festival}. One round total.`,

	BUY_GOLDEN_BUILD_TITLE: MODE_TITLE.golden_build,
	BUY_GOLDEN_BUILD_SPEC: 'Tier 3+ buildings · golden lanterns +2 tiers',
	BUY_GOLDEN_BUILD_DESC: `Buildings open at Tier 3 (${TIER_NAME[3]}) or higher and golden lanterns lift a building two tiers: bigger doors, a better shot at MAJOR and GRAND.`,

	// TWO Golden districts, guaranteed (Codex verifier: golden rounds open at Tier 3-5, golden lanterns only in
	// golden rounds, every district its own spins / doors / Lucky Street / Grand Festival, always two boards).
	BUY_EXPANDED_GOLDEN_BUILD_TITLE: MODE_TITLE.expanded_golden_build,
	BUY_EXPANDED_GOLDEN_BUILD_SPEC: '2 Golden districts · 6 spins each',
	BUY_EXPANDED_GOLDEN_BUILD_DESC: `Always 2 full ${FEATURE.goldenBuild} districts, each with its own spins, doors, ${MECHANIC.street} and ${MECHANIC.festival}. One round total.`,

	// LUCKY's ninth mode (docs/GAME_CONTRACT.md §8): FOUR Golden districts guaranteed, every door and fixed prize at
	// half value. The figures come from game/prizes.ts through copySubs, so the card and the rules sheet agree.
	BUY_GOLDEN_FOUR_TITLE: MODE_TITLE.golden_four,
	BUY_GOLDEN_FOUR_SPEC: '4 Golden districts · 6 spins each',
	BUY_GOLDEN_FOUR_DESC: `Always 4 full ${FEATURE.goldenBuild} districts, every door at half value: MINOR {minor}× · MAJOR {major}× · GRAND {grand}×. One round total.`,

	// Short on purpose: the HUD titles the ante chip with this once, before the social flag is known, so it
	// must read the same in both vocabularies.
	BUY_ANTE_TITLE: MODE_TITLE.ante,
	BUY_ANTE_SPEC: '{chance}× the chance to trigger',
	BUY_ANTE_DESC: `A toggle, not an entry: spins at {cost}× the base amount, {chance}× the chance to trigger ${FEATURE.holdAndBuild} and ${FEATURE.goldenBuild}.`,

	// DRAGON ANTE. The two multipliers are DIFFERENT and both are pinned exactly by the solver: 25x for Fortune
	// Build, 10x for Golden Dragon Build (almost every Golden win is >= 40 x this mode's cost, so Golden cannot
	// scale to 25x inside Stake's tail limit). The copy must never promise 25x "the bonus" without saying which.
	BUY_SUPER_ANTE_TITLE: MODE_TITLE.super_ante,
	BUY_SUPER_ANTE_SPEC: `{chance}× the chance to trigger ${FEATURE.holdAndBuild}`,
	BUY_SUPER_ANTE_DESC: `A toggle, not an entry: spins at {cost}× the base amount, {chance}× the chance to trigger ${FEATURE.holdAndBuild}, {goldChance}× the chance of ${FEATURE.goldenBuild}.`,
};

const copySubs = (modeKey: string): Record<string, string | number> => {
	switch (modeKey.toLowerCase()) {
		case 'ante':
			return { cost: 3, chance: 5 };
		case 'super_ante':
			// pinned in math/games/lucky/game_weights.py MODE_PARAMS["super_ante"] (25x hold, 10x golden)
			return { cost: 10, chance: 25, goldChance: 10 };
		case 'build_or_bust':
			// ONE source with the rules sheet: rulesContent MEASURED (production-measured, provenance on each line there)
			return {
				goldenPct: MEASURED.bobGolden,
				holdPct: MEASURED.bobHold,
				expandedPct: MEASURED.bobExpanded,
				goldenExpandedPct: MEASURED.bobGoldenExpanded,
				bustPct: MEASURED.bobBust,
			};
		case 'golden_four': {
			// the half-value fixed prizes (game/prizes.ts, Codex codex-math-core.md): 50 / 625 / 5,000
			const p = prizesFor('golden_four');
			return { minor: p.minor.toLocaleString('en-US'), major: p.major.toLocaleString('en-US'), grand: p.grand.toLocaleString('en-US') };
		}
		default:
			return {};
	}
};

// ---- board geometry (HUD ante-chip collision) -------------------------------
// The board is fit large and lifted above the bar in game/stateGame.svelte.ts;
// the HUD reads the SAME rect back so it can stand the ante chip down into the
// burger menu when the enlarged board would sit under it (phone widths).
const boardGeometry = () => {
	const main = stateLayoutDerived.mainLayout();
	const bl = stateGameDerived.boardLayout();
	return {
		main: { scale: main.scale, height: main.height },
		// height carries the portrait row pitch so the chip collision sees the real reel rect
		board: { x: bl.x, y: bl.y, width: bl.width, height: bl.height * bl.rowPitch, scale: bl.scale },
	};
};

export const hudConfig: HudConfig = {
	gameId: 'lucky',
	betModes: generatedConfig.betModes,
	emitter: eventEmitter,
	isIdle: () => stateXstateDerived.isIdle(),

	// SUPER ANTE needs a second `activate` tier. The shared HUD offers one only when a game opts in; every other game
	// leaves this off and keeps its single ante exactly as before.
	features: { anteTiers: true },

	// Feature-buy card art. One 768x512 webp per buy mode under
	// static/assets/buycards (tools/art: gpt-image-2.5-sunburst sources in
	// art-src/generated, cropped by derive_scene / the buycards step). No text is
	// baked in — the HUD draws the title, price and rules over the plate.
	assets: { buyCardDir: './assets/buycards', buyCardExt: 'webp' },
	betModeArt: {
		ante: 'ante',
		super_ante: 'super-ante',
		build_or_bust: 'build-or-bust',
		hold_and_build: 'hold-and-build',
		expanded_hold_and_build: 'expanded-hold-and-build',
		golden_build: 'golden-build',
		expanded_golden_build: 'expanded-golden-build',
		// ART-B supplies static/assets/buycards/golden-four.webp (768x512, no baked text). Until it lands the HUD
		// requests a missing file and the card draws without its plate.
		golden_four: 'golden-four',
	},

	// The Fortune Build / Golden Dragon Build scene owns the whole surface while it plays:
	// the game (not the HUD) owns input, so the spin square / spacebar cannot
	// place a bet behind the bonus.
	ownsInput: () => stateBuild.active,

	// The game's own notice (components/notice/PlayNotice.svelte) replaces the SDK's insufficient-balance popup and
	// empties the SDK modal slot on the way in; while it is up, Space must not place a bet behind it (§6b).
	modalOpen: () => stateNotice.open,

	// Rules sheet — game/rulesContent.ts (paytable from config, frequencies from the books).
	rules: rulesSections,

	// Honest, figure-driven bet-mode copy — built through the sweeps-wallet social floor
	// (game/socialFloor.ts) — and ONE money law for the bar and the board (game/money.ts).
	strings: makeHudStrings(stringOverrides),
	money: hudMoney,
	copySubs,

	// The board's DRAWN rect, for the ante-chip collision guard.
	boardGeometry,

	// The pay grid shows the game's own cartoon sprites.
	rulesSymbolCss: symbolCss,
	rulesAtlasReady: () => true,

	// Three speed rungs (off / turbo / super-turbo); the tier is mirrored into game/stateSpeed so the
	// reels and win beats have a real Super Turbo cadence, not Turbo under another name.
	speed: { rungs: 3, onApply: (tier) => applySpeedTier(tier) },

	// Audio — the ONE game manager (game/audio). `sfx` binds the burger
	// master/music/sfx sliders + M-key mute to this game's Web Audio buses (the
	// player gains sit OUTSIDE automated ducking). `sfxCues` renames the HUD's
	// own button broadcasts to real LUCKY cue ids, since our sprite does
	// not carry the donor's `sfx_btn_spin` / `sfx_btn_general`.
	sfx: gameAudioSfx,
	sfxCues: HUD_SFX_CUES,

	// Feature-scene win seams are wired in game/build/buildDirector.ts:
	//   buildStart -> claimWin('buildFeature') + setFeatureSpins(spins)
	//   buildSpin  -> setFeatureSpins(spinsLeft)
	//   buildEnd   -> releaseWin('buildFeature') + setFeatureSpins(null)
	// The bonus intro/outro cards run inside the Pixi scene and hold their own
	// holdPressGate (components/build/BuildBonusCard.svelte), so no HUD-drawn
	// modal is owed here.
};

export default hudConfig;
