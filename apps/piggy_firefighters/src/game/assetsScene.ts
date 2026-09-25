/**
 * SCENE asset entries (ambient world, roller shutter, mode-card art, 3D hats).
 *
 * Owned by the scene/presentation worker. `game/assets.ts` (other owner) spreads
 * this object into its default export so the normal AssetsLoader preloads every
 * entry behind the splash:
 *
 *     import sceneAssets from './assetsScene';
 *     export default { ...existing, ...sceneAssets };
 *
 * Until that import lands, `game/build/sceneTextures.svelte.ts` lazily loads any
 * missing key straight from the same URL, so the scene never depends on it.
 *
 * Ambient textures are produced by `tools/art/derive_ambient.py` (823 KB, budget
 * 1.5 MB). Hat sheets are the hat3d pipeline's (static/assets/hat3d/manifest.json).
 */
// Same served location as game/assets.ts (`../../assets/*` from this module's URL).
// The base is held in a variable on purpose: Vite rewrites the literal
// `new URL('<template>', import.meta.url)` form into a build-time glob, which
// cannot see the static/ tree and yields `undefined`.
const HERE = import.meta.url;
const u = (path: string) => new URL('../../assets/' + path, HERE).href;
const sprite = (path: string, preload = true) => ({ type: 'sprite' as const, preload, src: u(path) });

// GATE FIX (crane) 2026-09-23: the ambient tower crane (crane_upper / crane_tower / crane_cable /
// crane_load) is RETIRED — a lattice crane with a hook read as construction imagery in every frame.
// Its four keys are no longer registered, so the runtime never requests them (AmbientWorld's crane
// sprites are gated on the texture and draw nothing); the files ship as blank canvases of the same
// size (art-src/generated/art_b/gate_fix_crane/retire_crane_parts.py). Do not re-add the keys.
const AMBIENT_PARTS = [
	'cloud_1',
	'cloud_2',
	'cloud_3',
	'cloud_4',
	'cloud_5',
	// GATE LOOP r1: the donor worker (two poses) and the dump truck were still registered and preloaded
	// although the owner removed them from the world on 2026-09-19 (AmbientWorld gates their markup on
	// null placements). Their keys and files are gone; do not re-add them.
] as const;

const PLATES = [
	'plate_base_landscape',
	'plate_base_portrait',
	'plate_hold_landscape',
	'plate_hold_portrait',
	'plate_golden_landscape',
	'plate_golden_portrait',
] as const;

const HAT_CLIPS = ['rest', 'land', 'idle_tilt', 'flip', 'slam'] as const;
const HAT_SKINS = ['yellow', 'gold'] as const;
const HAT_FX = ['energy_crack', 'rim_glow', 'glint', 'sunburst', 'gold_sparkles'] as const;

export const RUNG_PIECES = [
	'plank',
	'nail',
	'straw',
	'brick',
	'trowel',
	'blueprint_scrap',
	'stone_block',
	'silver_coin',
	'drill_bit',
	'gold_coin',
	'hard_hat',
	'gem',
	'ribbon',
] as const;

const entries: Record<string, ReturnType<typeof sprite>> = {};
for (const k of AMBIENT_PARTS) entries[`amb_${k}`] = sprite(`ambient/${k}.webp`);
for (const k of PLATES) entries[`amb_${k}`] = sprite(`ambient/${k}.webp`);
// the LOCKED hoarding over an expanded box the book did not unlock (BuildScene lock panels)
entries.build_lock_panel = sprite('build/locked_panel.webp');
// the SITE PERMIT counter housing (components/build/CountReel.svelte)
entries.build_permit_housing = sprite('build/permit_housing.webp');
entries.scene_shutter_slats = sprite('splash/shutter_slats_tile.webp');
entries.scene_shutter_bar = sprite('splash/shutter_bottom_bar.webp');
entries.scene_card_hold = sprite('splash/card_hold_build.webp');
entries.scene_card_golden = sprite('splash/card_golden_build.webp');
for (const skin of HAT_SKINS)
	for (const clip of HAT_CLIPS) entries[`hat3d_${skin}_${clip}`] = sprite(`hat3d/sheets/${skin}_${clip}.webp`);
// Huff & Puff gust and Hard Hat Delivery (components/FeatureDrops.svelte)
for (const k of ['wolf_peek', 'wolf_inhale', 'wolf_huff', 'wolf_blow', 'wolf_defeated', 'delivery_crate', 'delivery_crate_open'] as const)
	entries[`feat_${k}`] = sprite(`features/${k}.webp`);
// Win rungs (components/WinRungs.svelte): one flattened sign per rung, fx, and the tumbling piece sheets
for (const k of ['timber', 'brick', 'stone', 'palace', 'gold'] as const) entries[`rung_sign_${k}`] = sprite(`winrungs/signs/${k}.webp`);
for (const k of ['flare_horizontal', 'ring_shockwave', 'glint_4point'] as const) entries[`rung_fx_${k}`] = sprite(`winrungs/fx/${k}.webp`);
for (const k of RUNG_PIECES) entries[`rung_piece_${k}`] = sprite(`winrungs/pieces/${k}_sheet.webp`);
// winning-symbol dressing (components/SymbolSprite.svelte): gold cell frame under the symbol, glint over it
entries.win_cell_frame = sprite('ui_scene/cell_frame_gold.webp');
entries.maxwin_card_landscape = sprite('maxwin/max_win_card_16x9.webp');
entries.maxwin_card_portrait = sprite('maxwin/max_win_card_portrait.webp');
for (const fx of HAT_FX) entries[`hat3d_fx_${fx}`] = sprite(`hat3d/sheets/fx_${fx}.webp`);

export type SceneAssetKey = keyof typeof entries;
export default entries;
