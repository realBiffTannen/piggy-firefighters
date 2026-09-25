/**
 * SCENE asset entries (background plates, bay-door shutter, mode-card art, win rungs, FX sprites, the reel frame and
 * the Rescue block art).
 *
 * `game/assets.ts` spreads this object into its default export so the AssetsLoader preloads every entry behind the
 * splash; `game/fx/sceneTextures.svelte.ts` lazily loads any key that is still missing from the same URL.
 *
 * Every file is the art lane's DELIVERED art under static/assets/** (key -> file -> consumer: docs/FRONTEND_NOTES.md
 * §4). Keys are the contract with the components; geometry that the components need comes from the meta JSON beside
 * the art (game/artMeta.ts), never from typed numbers.
 */
// Same served location as game/assets.ts (`../../assets/*` from this module's URL). The base is held in a variable
// on purpose: Vite rewrites the literal `new URL('<template>', import.meta.url)` form into a build-time glob, which
// cannot see the static/ tree and yields `undefined`.
const HERE = import.meta.url;
const u = (path: string) => new URL('../../assets/' + path, HERE).href;
const sprite = (path: string, preload = true) => ({ type: 'sprite' as const, preload, src: u(path) });

/** Scene moods: base = Station 13 at dusk, backdraft = the bay door blown open (Backdraft Spins), rescue = the
 *  apartment block at night, inferno = the same block under a red sky (theme §4). */
export const SCENE_MOODS = ['base', 'backdraft', 'rescue', 'inferno'] as const;

/** Win-rung signs, one per rung (components/WinRungs.svelte): BIG / HUGE / MEGA / EPIC / MAX (theme §5). */
export const RUNG_SKINS = ['big', 'huge', 'mega', 'epic', 'max'] as const;

/** Tumbling pieces the rungs shed (8 x 3 sheets of 128 px cells, 24 frames; winrungs/pieces/<name>.json). */
export const RUNG_PIECES = ['coin', 'silver_coin', 'ember', 'spark', 'droplet', 'badge', 'helmet', 'boot', 'nozzle', 'hydrant_cap'] as const;

/** Rescue room states (features/rescue/rooms.meta.json `files`), one file per room and state. */
export const ROOM_STATES = ['roaring', 'smouldering', 'safe', 'inferno_roaring', 'inferno_smouldering', 'inferno_safe'] as const;

const entries: Record<string, ReturnType<typeof sprite>> = {};
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
for (const k of RUNG_PIECES) entries[`rung_piece_${k}`] = sprite(`winrungs/pieces/${k}_sheet.webp`);
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
