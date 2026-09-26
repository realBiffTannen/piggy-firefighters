import { bootSceneAssets } from './assetsScene';
import { rigAssets, rigSources } from './anim/rigRegistry';
import { resolveRigAssetUrl } from './anim/playbackControl';
import type { RigName } from './anim/rigLogic';
import { staticTier } from './quality.svelte';

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
 *
 * BOOT vs LAZY (perf sweep, 2026-09-25): this manifest is what the splash waits for. It carries the base game only:
 * the symbol set(s) the layout needs, the coin sheet, the boot scene set (assetsScene.ts bootSceneAssets) and the two
 * session-long mascot rigs. Feature art and the feature rigs arrive through game/lazyAssets.ts.
 */
const SYM_DIR = 'sprites/symbolsCartoon';
const SYMT_DIR = 'sprites/symbolsCartoonTall';
const sym = (file: string) => ({ type: 'sprite' as const, preload: true, src: u(`${SYM_DIR}/${file}.webp`) });
const symT = (file: string) => ({ type: 'sprite' as const, preload: true, src: u(`${SYMT_DIR}/${file}.webp`) });

const SYMBOL_IDS = ['H1', 'H2', 'H3', 'H4', 'L1', 'L2', 'L3', 'L4', 'W', 'ALARM', 'GALARM'] as const;
/** pose-B (win key pose) tiles: the four high symbols and the WILD (the WILD's win is a punch, symbolMotion, so its
 *  pose B is registered for the art lane's inventory but only the high symbols cut to theirs) */
const POSE_B_IDS = ['H1', 'H2', 'H3', 'H4', 'W'] as const;

export type SymbolSet = 'sym' | 'symT';
/** Every entry of one symbol sheet, keyed `sym_*` / `symT_*` (the keys components/SymbolSprite.svelte reads). */
export const symbolSetEntries = (set: SymbolSet): Record<string, ReturnType<typeof sym>> => {
	const make = set === 'sym' ? sym : symT;
	const out: Record<string, ReturnType<typeof sym>> = {};
	for (const id of SYMBOL_IDS) out[`${set}_${id}`] = make(`${set}_${id}`);
	for (const id of POSE_B_IDS) out[`${set}_${id}_b`] = make(`${set}_${id}_b`);
	/** a W ignited by a Backdraft (contract §4: an ordinary W in the evaluated board, drawn on fire) */
	out[`${set}_W_BLAZE`] = make(`${set}_W_blaze`);
	return out;
};

/**
 * The layout at import, by the SDK's own rule (packages/utils-layout createLayout: `portrait` at width/height <= 0.8,
 * `tablet` below 1.3, both stacked). A wide boot needs only the square sheet; the tall one is fetched by
 * lazyAssets.ensureSymbolSet on the first flip to a stacked layout. A stacked boot keeps BOTH: the tall tiles for the
 * board and the square ones for the reel motion-blur atlas (game/reels/blurAtlas.ts bakes from `sym_*` and must find
 * them the moment the board mounts).
 */
export const BOOT_STACKED = typeof window !== 'undefined' && window.innerWidth / (window.innerHeight || 1) < 1.3;
const symbolEntries: Record<string, ReturnType<typeof sym>> = BOOT_STACKED
	? { ...symbolSetEntries('sym'), ...symbolSetEntries('symT') }
	: symbolSetEntries('sym');

/**
 * Codex's Spine rigs (docs/ANIMATION_CONTRACT.md v1.1; game/anim/rigRegistry.ts is the manifest source). The skeleton
 * is the original export; the atlas is the staged derivative under static/assets/spine-lod/<rig>/ (group e,
 * tools/perf): lossless WebP pages at full size on 'high', half-size pages (1024 max, the atlas `size:` line intact so
 * the region UVs are unchanged) below it. A chief slot is at most ~400 CSS px tall against a 1015 px source region, so
 * the 2048 level is never sampled on a phone or a 1x desktop.
 */
const rigAtlasUrl = (name: RigName) =>
	resolveRigAssetUrl(`spine-lod/${name}/${name}${staticTier === 'high' ? '' : '.half'}.atlas`, HERE, import.meta.env.DEV);
export const rigSrc = (name: RigName) => ({ skeleton: rigSources[name].json, atlas: rigAtlasUrl(name) });

/** Only the session-long mascots boot (Mascots.svelte: mascotLeft / mascotRight). pf_rookie (Alarm Call card, intro
 *  card presenter) and pf_rescued (the Rescue ladder / windows) are loaded by lazyAssets.loadRig with their feature.
 *  An entry exists only where an export exists (rigRegistry's glob), so an absent rig adds no request and no error. */
const BOOT_RIGS = ['pf_chief', 'pf_dog'] as const satisfies readonly RigName[];
const bootRigAssets = Object.fromEntries(
	BOOT_RIGS.filter((name) => Boolean(rigAssets[name])).map((name) => [name, { type: 'spine' as const, src: rigSrc(name) }]),
);

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
		// tumbling coin for the win fountain (components/WinCoins.svelte), 32 frames of 128 px (animation `coin`): the Blender
		// turntable of this title's Meshy coin (lane E); the 2D flip sheet stays at winrungs/coins as the fallback.
		src: u('3d/winrungs/coins/coin_sheet.json'),
	},
	// All audio is the single Web Audio manager in src/game/audio (audio lane); it is not registered here.
	// The boot scene set: base plate (this orientation), shutter, wordmark, reel frame, cell frames, line plate, FX.
	...bootSceneAssets,
	...bootRigAssets,
} as const;
