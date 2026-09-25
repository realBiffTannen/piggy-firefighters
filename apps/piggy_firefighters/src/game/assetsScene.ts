/**
 * SCENE asset entries (background plates, bay-door shutter, mode-card art, win rungs, FX sprites).
 *
 * `game/assets.ts` spreads this object into its default export so the AssetsLoader preloads every entry behind the
 * splash; `game/fx/sceneTextures.svelte.ts` lazily loads any key that is still missing from the same URL.
 *
 * Every file is a PROCEDURAL PLACEHOLDER (tools/placeholder/make_placeholders.py) under
 * static/assets/placeholder/. Keys are the contract with the components; the art lane replaces files only.
 */
// Same served location as game/assets.ts (`../../assets/*` from this module's URL). The base is held in a variable
// on purpose: Vite rewrites the literal `new URL('<template>', import.meta.url)` form into a build-time glob, which
// cannot see the static/ tree and yields `undefined`.
const HERE = import.meta.url;
const u = (path: string) => new URL('../../assets/placeholder/' + path, HERE).href;
const sprite = (path: string, preload = true) => ({ type: 'sprite' as const, preload, src: u(path) });

/** Scene moods: base = Station 13 at dusk, rescue = the apartment block at night, inferno = red sky (theme §4). */
export const SCENE_MOODS = ['base', 'rescue', 'inferno'] as const;

/** Win-rung signs, one per rung (components/WinRungs.svelte): BIG / HUGE / MEGA / EPIC / MAX (theme §5). */
export const RUNG_SKINS = ['big', 'huge', 'mega', 'epic', 'max'] as const;

/** Tumbling pieces the rungs shed (8 x 3 sheets of 128 px cells, 24 frames). */
export const RUNG_PIECES = ['coin', 'ember', 'droplet', 'badge'] as const;

const entries: Record<string, ReturnType<typeof sprite>> = {};
for (const mood of SCENE_MOODS)
	for (const orient of ['landscape', 'portrait'] as const) entries[`bg_${mood}_${orient}`] = sprite(`scene/bg_${mood}_${orient}.webp`);
// the bay door (components/scene/SceneShutter.svelte): 1024x512 tileable slats + 1024x115 bottom bar
entries.scene_shutter_slats = sprite('scene/shutter_slats_tile.webp');
entries.scene_shutter_bar = sprite('scene/shutter_bottom_bar.webp');
// mode-card art riding on the shutter (768x768, no text)
entries.scene_card_rescue = sprite('scene/card_rescue.webp');
entries.scene_card_inferno = sprite('scene/card_inferno.webp');
entries.scene_card_backdraft = sprite('scene/card_backdraft.webp');
entries.scene_card_alarm = sprite('scene/card_alarm.webp');
// win rungs: sign per rung (1200x728), fx, piece sheets, max-win card art
for (const k of RUNG_SKINS) entries[`rung_sign_${k}`] = sprite(`rungs/sign_${k}.webp`);
entries.rung_fx_flare_horizontal = sprite('fx/flare_horizontal.webp');
entries.rung_fx_ring_shockwave = sprite('fx/ring_shockwave.webp');
entries.rung_fx_glint_4point = sprite('fx/glint_4point.webp');
for (const k of RUNG_PIECES) entries[`rung_piece_${k}`] = sprite(`rungs/piece_${k}_sheet.webp`);
entries.maxwin_card_landscape = sprite('rungs/maxwin_card_landscape.webp');
entries.maxwin_card_portrait = sprite('rungs/maxwin_card_portrait.webp');
// winning-symbol / anticipation dressing: gold nine-slice cell frame (384 src, 100 px corner)
entries.win_cell_frame = sprite('fx/cell_frame.webp');

export type SceneAssetKey = keyof typeof entries;
export default entries;
