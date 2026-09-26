/**
 * SCENE asset entries (background plates, bay-door shutter, mode-card art, win rungs, FX sprites, the reel frame and
 * the Rescue block art).
 *
 * `game/assets.ts` spreads ONLY the boot set (`bootSceneAssets`: what the base game draws from the first frame) into
 * its default export, so the AssetsLoader preloads just that behind the splash; every other entry belongs to a lazy
 * set (`LAZY_SETS`) that `game/lazyAssets.ts` fetches when its feature is booked or warms after the gate, and
 * `game/fx/sceneTextures.svelte.ts` lazily loads any single key through the same path. The full `sceneAssets` map is
 * still the default export: its KEYS are the contract with the components.
 *
 * Every file is the art lane's DELIVERED art under static/assets/** (key -> file -> consumer: docs/FRONTEND_NOTES.md
 * §4). Keys are the contract with the components; geometry that the components need comes from the meta JSON beside
 * the art (game/artMeta.ts), never from typed numbers.
 */
// Same served location as game/assets.ts (`../../assets/*` from this module's URL). The base is held in a variable
// on purpose: Vite rewrites the literal `new URL('<template>', import.meta.url)` form into a build-time glob, which
// cannot see the static/ tree and yields `undefined`.
import { LOD_FILES, LOD_SCALE } from './lod.generated';
import { staticTier } from './quality.svelte';

const HERE = import.meta.url;
const u = (path: string) => new URL('../../assets/' + path, HERE).href;
/**
 * Below the 'high' tier the big pictures (environment plates, win-rung signs, max-win and mode cards) come from the
 * 0.625x derivatives under static/assets/lod/ (tools/perf/derive_lod_textures.py, game/lod.generated.ts). The
 * derivative carries LOD_SCALE as its Pixi texture resolution, so `texture.width / height` still report the ORIGINAL
 * size and every consumer (cover fits, signW scaling, explicit sizes) draws exactly as before.
 */
const lodSrc = (path: string) => (staticTier !== 'high' && LOD_FILES.has(path) ? { src: u('lod/' + path), resolution: LOD_SCALE } : { src: u(path) });
export type SceneEntry = { type: 'sprite'; preload: boolean; src: string; resolution?: number };
const sprite = (path: string, preload = true): SceneEntry => ({ type: 'sprite' as const, preload, ...lodSrc(path) });

export type Orientation = 'landscape' | 'portrait';
/** The plate orientation the background draws: components/Background.svelte's rule (canvas height > width x 1.05). */
export const currentOrientation = (): Orientation =>
	typeof window !== 'undefined' && window.innerHeight > window.innerWidth * 1.05 ? 'portrait' : 'landscape';
/** The orientation at import: the boot manifest carries the base plate for this one only. */
export const BOOT_ORIENTATION: Orientation = currentOrientation();

/** Scene moods: base = Station 13 at dusk, backdraft = the bay door blown open (Backdraft Spins), rescue = the
 *  apartment block at night, inferno = the same block under a red sky (theme §4). */
export const SCENE_MOODS = ['base', 'backdraft', 'rescue', 'inferno'] as const;

/** Win-rung signs, one per rung (components/WinRungs.svelte): BIG / HUGE / MEGA / EPIC / MAX (theme §5). */
export const RUNG_SKINS = ['big', 'huge', 'mega', 'epic', 'max'] as const;

/** Tumbling pieces the rungs shed (8 x 3 sheets of 128 px cells, 24 frames; winrungs/pieces/<name>.json). */
export const RUNG_PIECES = ['coin', 'silver_coin', 'ember', 'spark', 'droplet', 'badge', 'helmet', 'boot', 'nozzle', 'hydrant_cap'] as const;
/** Pieces with a 3D turntable sheet under 3d/winrungs/pieces (static/assets/3d, art-src/3d/renders/source-record.json). */
export const RUNG_PIECES_3D: ReadonlySet<string> = new Set(['coin', 'silver_coin', 'badge', 'helmet', 'boot', 'nozzle', 'hydrant_cap']);

/** Rescue room states (features/rescue/rooms.meta.json `files`), one file per room and state. */
export const ROOM_STATES = ['roaring', 'smouldering', 'safe', 'inferno_roaring', 'inferno_smouldering', 'inferno_safe'] as const;

const entries: Record<string, SceneEntry> = {};
// the world behind the reels (components/Background.svelte): environment/<mood>_{landscape 2039x1000, portrait 1242x2208}
for (const mood of SCENE_MOODS)
	for (const orient of ['landscape', 'portrait'] as const) entries[`bg_${mood}_${orient}`] = sprite(`environment/${mood}_${orient}.webp`);
// the bay door (components/scene/SceneShutter.svelte + the splash hand-off): 1024x512 tileable slats + 1024x115 bottom bar
entries.scene_shutter_slats = sprite('splash/shutter_slats_tile.webp');
entries.scene_shutter_bar = sprite('splash/shutter_bottom_bar.webp');
// the wordmark stencilled on the in-game bay door (branding/wordmark_small.webp 683x327; the splash uses wordmark.png)
entries.wordmark_small = sprite('branding/wordmark_small.webp');
// mode-card art riding on the shutter and on the Alarm Call card (no baked text). The intro cards use the splash deck's
// 768x768 paintings; the Inferno card uses the Inferno feature plate (768x512), cover-fitted into its frame.
entries.scene_card_rescue = sprite('splash/card_rescue.webp');
entries.scene_card_inferno = sprite('buycards/inferno.webp');
entries.scene_card_backdraft = sprite('splash/card_backdraft.webp');
entries.scene_card_alarm = sprite('splash/card_alarm.webp');
// win rungs: sign per rung (1200x728, winrungs/signs/flat_manifest.json), fx, piece sheets, max-win card art
for (const k of RUNG_SKINS) entries[`rung_sign_${k}`] = sprite(`winrungs/signs/${k}.webp`);
entries.rung_fx_flare_horizontal = sprite('winrungs/fx/flare_horizontal.webp');
entries.rung_fx_ring_shockwave = sprite('winrungs/fx/ring_shockwave.webp');
entries.rung_fx_glint_4point = sprite('winrungs/fx/glint_4point.webp');
entries.rung_fx_dust_puff = sprite('winrungs/fx/dust_puff.webp');
entries.rung_fx_light_ray_wedge = sprite('winrungs/fx/light_ray_wedge.webp');
// the seven solid pieces are Blender toon turntables of this title's Meshy models (lane E, art-src/3d/render_turntables.py;
// same 8 x 3 / 128 px / 24-frame geometry, true 3D tumble); droplet, ember and spark are FX and stay on the 2D sheets.
for (const k of RUNG_PIECES)
	entries[`rung_piece_${k}`] = sprite(RUNG_PIECES_3D.has(k) ? `3d/winrungs/pieces/${k}_sheet.webp` : `winrungs/pieces/${k}_sheet.webp`);
entries.maxwin_card_landscape = sprite('maxwin/max_win_card_16x9.webp');
entries.maxwin_card_portrait = sprite('maxwin/max_win_card_portrait.webp');
// the reel frame (components/BoardFrame.svelte): the truck panel plate (cut into corners + tiled rails per
// ui_scene/frame.meta.json), the riveted backplate behind the reels and the per-cell frames (nine-slice, cells.meta.json)
entries.board_frame = sprite('ui_scene/board_frame.webp');
entries.cell_backplate = sprite('ui_scene/cell_backplate.webp');
entries.cell_frame_plain = sprite('ui_scene/cell_frame_plain.webp');
entries.cell_frame_locked = sprite('ui_scene/cell_frame_locked.webp');
// winning-symbol / anticipation dressing: the gold nine-slice cell frame (SymbolSprite, Anticipation)
entries.win_cell_frame = sprite('ui_scene/cell_frame_win.webp');
// the brass line-number plate (components/Paylines.svelte)
entries.line_plate = sprite('ui_scene/line_plate.webp');
// the Rescue block (components/rescue/RescueScene.svelte): facade band, five rooms x six states, ladder, hose, water,
// steam, the multiplier badge, the spins plate, the jump sheet (features/rescue/*.meta.json)
entries.rescue_facade = sprite('features/rescue/block_facade.webp');
entries.rescue_facade_inferno = sprite('features/rescue/block_facade_inferno.webp');
for (let r = 0; r < 5; r += 1) for (const s of ROOM_STATES) entries[`rescue_room_${r}_${s}`] = sprite(`features/rescue/room_${r}_${s}.webp`);
entries.rescue_ladder_segment = sprite('features/rescue/ladder_segment.webp');
entries.rescue_ladder_top = sprite('features/rescue/ladder_top.webp');
entries.rescue_hose_segment = sprite('features/rescue/hose_segment.webp');
entries.rescue_hose_nozzle = sprite('features/rescue/hose_nozzle.webp');
entries.rescue_water_jet = sprite('features/rescue/water_jet.webp');
entries.rescue_water_splash = sprite('features/rescue/water_splash.webp');
entries.rescue_steam_puff = sprite('features/rescue/steam_puff.webp');
entries.rescue_badge_blank = sprite('features/rescue/badge_blank.webp');
entries.rescue_spins_plate = sprite('features/rescue/spins_plate_blank.webp');
entries.rescue_jump_sheet = sprite('features/rescue/jump_sheet.webp');

export type SceneAssetKey = keyof typeof entries;
export default entries;

// ---- boot set vs lazy sets (perf sweep A1 / H-01 / F3 / TEX-03 / A10) ------------------------------------------------
/** What the base game draws from its first frame: preloaded behind the splash and GPU-warmed before the press. */
export const BOOT_SCENE_KEYS: readonly string[] = [
	`bg_base_${BOOT_ORIENTATION}`,
	'scene_shutter_slats',
	'scene_shutter_bar',
	'wordmark_small',
	'board_frame',
	'cell_backplate',
	'cell_frame_plain',
	'cell_frame_locked',
	'win_cell_frame',
	'line_plate',
	// 5 small FX sprites: the glint plays on any GALARM land (components/BoardFx.svelte) and in every symbol win
	'rung_fx_flare_horizontal',
	'rung_fx_ring_shockwave',
	'rung_fx_glint_4point',
	'rung_fx_dust_puff',
	'rung_fx_light_ray_wedge',
];
export const bootSceneAssets: Record<string, SceneEntry> = Object.fromEntries(BOOT_SCENE_KEYS.map((k) => [k, entries[k]]));

export type LazyKind = 'winrungs' | 'maxwin' | 'alarm' | 'rescue' | 'backdraft' | 'bg';
export type LazyContext = { orientation: Orientation; mood: (typeof SCENE_MOODS)[number] };
/**
 * The scene keys of each lazy set, resolved for the CURRENT orientation / mood at call time (game/lazyAssets.ts
 * ensureFeatureAssets). Rigs that ride with a set (pf_rookie with 'alarm', pf_rescued with 'rescue') are added there.
 *
 *   winrungs   the five signs + the ten piece sheets: warmed right after the gate, awaited before the first sign drop
 *   maxwin     the two max-win cards
 *   alarm      the mode cards on the door and on the Alarm Call card
 *   rescue     the Rescue block (42) + the rescue / inferno plate for this orientation
 *   backdraft  the Backdraft Spins plate for this orientation
 *   bg         the plate for the current mood and orientation (an orientation change, a mood set without its plate)
 */
export const LAZY_SETS: Record<LazyKind, (ctx: LazyContext) => string[]> = {
	winrungs: () => [...RUNG_SKINS.map((k) => `rung_sign_${k}`), ...RUNG_PIECES.map((k) => `rung_piece_${k}`)],
	maxwin: () => ['maxwin_card_landscape', 'maxwin_card_portrait'],
	alarm: () => ['scene_card_alarm', 'scene_card_rescue', 'scene_card_inferno', 'scene_card_backdraft'],
	rescue: ({ orientation }) => [...Object.keys(entries).filter((k) => k.startsWith('rescue_')), `bg_rescue_${orientation}`, `bg_inferno_${orientation}`],
	backdraft: ({ orientation }) => [`bg_backdraft_${orientation}`],
	bg: ({ orientation, mood }) => [`bg_${mood}_${orientation}`],
};
