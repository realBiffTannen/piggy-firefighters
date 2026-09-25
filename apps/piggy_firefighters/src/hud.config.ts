/**
 * PIGGY FIREFIGHTERS × `@crashgalaxy/hud` — the ONE seam between this game and the packaged studio HUD.
 * `routes/+layout.svelte` mounts `<CrashGalaxyHud config={hudConfig}>` with this object.
 *
 * The six bet modes come from `game/generatedConfig.ts` (docs/GAME_CONTRACT.md §2); the host derives each mode's
 * KIND from the math flags. Player titles (theme §5, game/names.ts):
 *   base              1x, not a buy     -> default spin
 *   ante              1.5x, not a buy   -> "activate" toggle — ALARM BOOST
 *   alarm_call        12x, isBuyBonus   -> buy card — ALARM CALL
 *   rescue            18x, isBuyBonus   -> buy card — RESCUE SPINS
 *   backdraft_spins   50x, isBuyBonus   -> buy card — BACKDRAFT SPINS
 *   inferno           90x, isBuyBonus   -> buy card — INFERNO RESCUE
 * (costs: the frozen math's MODE_COSTS, read from game/config.ts — never from this comment). Four cards in the sheet,
 * cost-ascending (contract v1.2.1 §2: the installed HUD sorts buy cards by price); the ante has its own card too.
 *
 * Bet-mode copy and the board-fit geometry are wired here; the rules sheet is game/rulesContent.ts (std + social
 * wording, figures from config and, once published, the books).
 */
import type { HudConfig, SymbolCss } from '@crashgalaxy/hud';

import { eventEmitter } from './game/eventEmitter';
import { gameAudioSfx, HUD_SFX_CUES } from './game/audio';
import generatedConfig from './game/generatedConfig';
import config from './game/config';
import { rulesSections, CONTRACT } from './game/rulesContent';
import { applySpeedTier } from './game/stateSpeed.svelte';
import { makeHudStrings } from './game/socialFloor';
import { hudMoney } from './game/money';
import { stateXstateDerived } from './game/stateXstate';
import { stateLayoutDerived } from './game/stateLayout';
import { stateGameDerived } from './game/stateGame.svelte';
import { FEATURE, MECHANIC, MODE_TITLE } from './game/names';
import { stateNotice } from './game/stateNotice.svelte';
import { featureOwnsInput, stateAlarmCall } from './game/rescue/stateRescue.svelte';
import { stateScene } from './game/fx/stateScene.svelte';

// ---- Ante always starts OFF --------------------------------------------------
// The HUD restores the ante from localStorage at mount, which would re-arm a 1.5x-cost mode on a reload with no
// confirmation. A mode that changes what a spin costs must be the player's choice in THIS session, so the stored
// flag is dropped before the HUD reads it.
try {
	if (typeof localStorage !== 'undefined') localStorage.removeItem('piggy_firefighters-ante');
} catch {
	/* storage blocked — the HUD then has nothing to restore either */
}

// ---- pay-grid art -----------------------------------------------------------
// The rules sheet shows the game's OWN symbol tiles (the art lane's square sheet, static/assets/sprites/symbolsCartoon,
// the same files the reels draw). The files are served next to index.html, so the URL is resolved at RUNTIME against
// the page (`new URL('../assets/…', import.meta.url)` is rewritten by Vite to a path that does not exist).
const SYMBOL_DIR = './assets/sprites/symbolsCartoon';
const symbolUrl = (file: string): string =>
	typeof document === 'undefined' ? `${SYMBOL_DIR}/${file}.webp` : new URL(`${SYMBOL_DIR}/${file}.webp`, document.baseURI).href;
const SYMBOL_FILE: Record<string, string> = Object.fromEntries(
	['H1', 'H2', 'H3', 'H4', 'L1', 'L2', 'L3', 'L4', 'W', 'ALARM', 'GALARM'].map((id) => [id, `sym_${id}`]),
);

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
// Named copy (BUY_<KEY>_TITLE / _SPEC / _DESC) wins over the host's generic fallback. Titles come from
// game/names.ts (theme §5); figures come from `copySubs` below, never typed into the words. ONE wording serves std
// and social: no cash vocabulary (bet / pay / buy / cost / purchase) appears in any card line.
const stringOverrides = {
	BONUS_NAME: FEATURE.rescue,
	// the buy dialog's accessible name (the package default is another game's)
	UI_CLASSIFIEDS: 'FEATURE CARDS',

	BUY_BACKDRAFT_SPINS_TITLE: MODE_TITLE.backdraft_spins,
	BUY_BACKDRAFT_SPINS_SPEC: '{spins} spins · a Backdraft every spin',
	BUY_BACKDRAFT_SPINS_DESC: `{spins} spins, and every spin gets a ${MECHANIC.backdraft}: {blazeMin}–{blazeMax} cells burst into ${MECHANIC.blazeWild}s carrying {mults} that ADD UP along a line.`,

	BUY_ALARM_CALL_TITLE: MODE_TITLE.alarm_call,
	BUY_ALARM_CALL_SPEC: `${FEATURE.rescue} · ${FEATURE.inferno} · or a ${MECHANIC.falseAlarm}`,
	BUY_ALARM_CALL_DESC: `One call: it turns into ${FEATURE.rescue} or ${FEATURE.inferno} ({infernoPct}), or a ${MECHANIC.falseAlarm} that wins nothing. An awarded feature plays exactly like its own card.`,

	BUY_RESCUE_TITLE: MODE_TITLE.rescue,
	BUY_RESCUE_SPEC: '{spins} spins · five rooms · +1× per rescue',
	BUY_RESCUE_DESC: `{spins} spins under a burning block of five rooms. A WILD on a reel sprays the room above it; every rescue adds +1× to the multiplier and +1 spin, and clearing all five rooms brings the next building and +5 spins.`,

	BUY_INFERNO_TITLE: MODE_TITLE.inferno,
	BUY_INFERNO_SPEC: '{spins} spins · one spray per room · +2× and a prize per rescue',
	BUY_INFERNO_DESC: `${FEATURE.rescue} with rooms that fall in one spray: every rescue adds +2× to the multiplier, +1 spin and an instant prize of {prizes}.`,

	// Short on purpose: the HUD titles the ante chip with this once, before the social flag is known, so it must read
	// the same in both vocabularies.
	BUY_ANTE_TITLE: MODE_TITLE.ante,
	BUY_ANTE_SPEC: '{chance}× the chance to trigger',
	BUY_ANTE_DESC: `A toggle, not an entry: spins at {cost}× the base amount with {chance}× the chance to trigger ${FEATURE.rescue} and ${FEATURE.inferno}.`,
};

const copySubs = (modeKey: string): Record<string, string | number> => {
	switch (modeKey.toLowerCase()) {
		case 'ante':
			return { cost: config.betModes.ante.cost, chance: CONTRACT.anteChance };
		case 'backdraft_spins':
			return { spins: CONTRACT.backdraftSpins, blazeMin: CONTRACT.backdraftSpinsBlaze[0], blazeMax: CONTRACT.backdraftSpinsBlaze[1], mults: CONTRACT.backdraftSpinsMultText };
		case 'alarm_call':
			return { infernoPct: CONTRACT.alarmCallInferno };
		case 'rescue':
			return { spins: CONTRACT.boughtSpins };
		case 'inferno':
			return { spins: CONTRACT.boughtSpins, prizes: CONTRACT.infernoPrizes };
		default:
			return {};
	}
};

// ---- board geometry (HUD ante-chip collision) -------------------------------
// The board is fit large and lifted above the bar in game/stateGame.svelte.ts; the HUD reads the SAME rect back so it
// can stand the ante chip down into the burger menu when the board would sit under it (phone widths).
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
	gameId: 'piggy_firefighters',
	betModes: generatedConfig.betModes,
	emitter: eventEmitter,
	isIdle: () => stateXstateDerived.isIdle(),

	// One ante (ALARM BOOST): no tier chooser. The buy plates are painted art, drawn smooth.
	features: { anteTiers: false, smoothCardArt: true },

	// Feature-card art: one 768x512 webp per mode, no baked text (the HUD draws title, price and rules over it), the
	// art lane's plates under static/assets/buycards (tools/art/derive_cards.py); basenames are kebab-case.
	assets: { buyCardDir: './assets/buycards', buyCardExt: 'webp' },
	betModeArt: {
		ante: 'ante',
		backdraft_spins: 'backdraft-spins',
		alarm_call: 'alarm-call',
		rescue: 'rescue',
		inferno: 'inferno',
	},

	// A feature scene (Rescue / Inferno / Backdraft Spins / the Alarm Call card) owns input while it plays, and so
	// does the bay door while it covers the play area: the spin square / spacebar cannot place a round behind it.
	ownsInput: () => featureOwnsInput() || stateScene.covered,

	// The game's own notice (components/notice/PlayNotice.svelte) replaces the SDK's insufficient-balance popup; while
	// it (or the Alarm Call card) is up, Space must not place a round behind it.
	modalOpen: () => stateNotice.open || stateAlarmCall.active,

	// Rules sheet — game/rulesContent.ts (paytable + lines from config, measured figures from the books).
	rules: rulesSections,

	// Honest, figure-driven bet-mode copy — built through the sweeps-wallet social floor (game/socialFloor.ts) — and
	// ONE money law for the bar and the board (game/money.ts).
	strings: makeHudStrings(stringOverrides),
	money: hudMoney,
	copySubs,

	// The board's DRAWN rect, for the ante-chip collision guard.
	boardGeometry,

	// The pay grid shows the game's own symbol tiles.
	rulesSymbolCss: symbolCss,
	rulesAtlasReady: () => true,

	// Three speed rungs (off / turbo / super-turbo); the tier is mirrored into game/stateSpeed so the reels and win
	// beats have a real Super Turbo cadence.
	speed: { rungs: 3, onApply: (tier) => applySpeedTier(tier) },

	// Audio — the ONE game manager (game/audio, audio lane). `sfx` binds the burger master/music/sfx sliders + M-key
	// mute to this game's Web Audio buses; `sfxCues` renames the HUD's own button broadcasts to real cue ids.
	sfx: gameAudioSfx,
	sfxCues: HUD_SFX_CUES,

	// Feature-scene win seams are wired in game/rescue/rescueDirector.ts:
	//   rescueStart          -> claimWin('rescue') + setFeatureSpins(spins)
	//   douse / updateFree.. -> setFeatureSpins(spinsLeft)
	//   freeSpinEnd (outro)  -> releaseWin('rescue') + setFeatureSpins(null)
	//   backdraftSpinsStart  -> claimWin('backdraftSpins') + setFeatureSpins(5); backdraftSpinsEnd releases both
	// The intro/outro cards ride on the bay door and hold their own holdPressGate (components/scene/SceneShutter),
	// as does the Alarm Call card (components/AlarmCallCard.svelte), so no HUD-drawn modal is owed here.
};

export default hudConfig;
