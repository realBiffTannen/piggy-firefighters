import sceneAssets from './assetsScene';

// Same served location as assetsScene.ts (`../../assets/*` from this module's URL). The base is held in a variable
// on purpose: Vite rewrites the literal template form `new URL(`...${x}`, import.meta.url)` into a build-time glob
// that cannot see static/ and yields `undefined`.
const HERE = import.meta.url;
const u = (path: string) => new URL('../../assets/' + path, HERE).href;

/**
 * PIGGY FIREFIGHTERS asset registry (pixi-svelte AssetsLoader).
 *
 * EVERY picture registered here is a PROCEDURAL PLACEHOLDER (tools/placeholder/make_placeholders.py, Pillow, theme
 * palette) under static/assets/placeholder/. The art lane replaces each FILE at the same path, size and framing;
 * keys never change. Inventory + target sizes: docs/FRONTEND_NOTES.md §Placeholders.
 *
 * Symbols: 384x384 WEBP with a transparent pad (~0.068 of the tile), drawn at SYMBOL_SIZE * sizeRatio in a
 * 120-unit cell (constants.ts SYMBOL_INFO_MAP). No portrait `symT_*` tiles and no pose-B `sym_*_b` keys are
 * registered yet: SymbolSprite falls back to the square tile and the single-pose win.
 */
const sym = (file: string) => ({ type: 'sprite' as const, preload: true, src: u(`placeholder/symbols/${file}.webp`) });

export default {
	goldFont: {
		type: 'font',
		// interGold: the gold bitmap font built from Inter Black (family 'gold'): win numbers, line pops, meters.
		src: new URL('../../assets/fonts/interGold/interGold.xml', import.meta.url).href,
	},
	sym_H1: sym('h1'),
	sym_H2: sym('h2'),
	sym_H3: sym('h3'),
	sym_H4: sym('h4'),
	sym_L1: sym('l1'),
	sym_L2: sym('l2'),
	sym_L3: sym('l3'),
	sym_L4: sym('l4'),
	sym_W: sym('w'),
	/** a W ignited by a Backdraft (contract §4: an ordinary W in the evaluated board, drawn on fire) */
	sym_W_BLAZE: sym('w_blaze'),
	sym_ALARM: sym('alarm'),
	sym_GALARM: sym('galarm'),
	coins: {
		type: 'spriteSheet',
		// tumbling coin for the win fountain (components/WinCoins.svelte), 32 frames of 128 px
		src: u('placeholder/coins/coin_sheet.json'),
	},
	// All audio is the single Web Audio manager in src/game/audio (audio lane); it is not registered here.
	// Background plates, shutter, mode cards, win rungs and FX: game/assetsScene.ts.
	...sceneAssets,
} as const;
