import sceneAssets from './assetsScene';
import { rigAssets } from './anim/rigRegistry';

// Same served location as assetsScene.ts (`../../assets/*` from this module's URL). The base is held in a variable
// on purpose: Vite rewrites the literal template form `new URL(`...${x}`, import.meta.url)` into a build-time glob
// that cannot see static/ and yields `undefined`.
const HERE = import.meta.url;
const u = (path: string) => new URL('../../assets/' + path, HERE).href;

/**
 * PIGGY FIREFIGHTERS asset registry (pixi-svelte AssetsLoader).
 *
 * Every picture is the art lane's DELIVERED file (docs/FRONTEND_NOTES.md §4 "delivered asset map"). Symbols come in
 * two sheets (tools/art/derive_symbols*.py): square 384x384 tiles (`sym_*`, wide layouts) and 384x500 portrait tiles
 * (`symT_*`, stacked layouts), each with a pose-B key frame for the four high symbols and the WILD (`*_b`) and the
 * Blaze Wild (`*_W_BLAZE`). SymbolSprite picks the tall tile on stacked layouts and cuts to pose B inside the
 * high-symbol win motion (game/symbolMotion.ts).
 */
const SYM_DIR = 'sprites/symbolsCartoon';
const SYMT_DIR = 'sprites/symbolsCartoonTall';
const sym = (file: string) => ({ type: 'sprite' as const, preload: true, src: u(`${SYM_DIR}/${file}.webp`) });
const symT = (file: string) => ({ type: 'sprite' as const, preload: true, src: u(`${SYMT_DIR}/${file}.webp`) });

const SYMBOL_IDS = ['H1', 'H2', 'H3', 'H4', 'L1', 'L2', 'L3', 'L4', 'W', 'ALARM', 'GALARM'] as const;
/** pose-B (win key pose) tiles: the four high symbols and the WILD (the WILD's win is a punch, symbolMotion, so its
 *  pose B is registered for the art lane's inventory but only the high symbols cut to theirs) */
const POSE_B_IDS = ['H1', 'H2', 'H3', 'H4', 'W'] as const;

const symbolEntries: Record<string, ReturnType<typeof sym>> = {};
for (const id of SYMBOL_IDS) {
	symbolEntries[`sym_${id}`] = sym(`sym_${id}`);
	symbolEntries[`symT_${id}`] = symT(`symT_${id}`);
}
for (const id of POSE_B_IDS) {
	symbolEntries[`sym_${id}_b`] = sym(`sym_${id}_b`);
	symbolEntries[`symT_${id}_b`] = symT(`symT_${id}_b`);
}
/** a W ignited by a Backdraft (contract §4: an ordinary W in the evaluated board, drawn on fire) */
symbolEntries.sym_W_BLAZE = sym('sym_W_blaze');
symbolEntries.symT_W_BLAZE = symT('symT_W_blaze');

export default {
	goldFont: {
		type: 'font',
		// interGold: this title's brass bitmap font built from Inter Black (tools/art/make_inter_gold_font.py, family
		// 'gold'): win numbers, line pops, meters.
		src: new URL('../../assets/fonts/interGold/interGold.xml', import.meta.url).href,
	},
	...symbolEntries,
	coins: {
		type: 'spriteSheet',
		// tumbling coin for the win fountain (components/WinCoins.svelte), 32 frames of 128 px (animation `coin`)
		src: u('winrungs/coins/coin_sheet.json'),
	},
	// All audio is the single Web Audio manager in src/game/audio (audio lane); it is not registered here.
	// Background plates, shutter, mode cards, win rungs, FX, the reel frame and the Rescue block: game/assetsScene.ts.
	...sceneAssets,
	// Codex's Spine rigs (docs/ANIMATION_CONTRACT.md v1.1): an entry exists only where an export exists under
	// static/assets/spine/<rig>/, so absent rigs add no request and no error (game/anim/rigRegistry.ts).
	...rigAssets,
} as const;
