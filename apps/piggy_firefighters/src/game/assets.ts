import sceneAssets from './assetsScene';

export default {
	goldFont: {
		type: 'font',
		// interGold: the game's own gold bitmap font built from Inter Black (tools/art/make_inter_gold_font.py).
		// Same family name ('gold') as the template font it replaces, so every usage swaps with no other change.
		src: new URL('../../assets/fonts/interGold/interGold.xml', import.meta.url).href,
	},
	// Piggy Workers cartoon reel symbols (tools/art/derive_symbols.py). One
	// standalone WEBP per symbol, registered as an individual `sprite` asset keyed
	// `sym_<name>` and referenced from constants.ts SYMBOL_INFO_MAP.
	sym_H1: { type: 'sprite', preload: true, src: new URL('../../assets/sprites/symbolsCartoon/h1.webp', import.meta.url).href },
	sym_H2: { type: 'sprite', preload: true, src: new URL('../../assets/sprites/symbolsCartoon/h2.webp', import.meta.url).href },
	sym_H3: { type: 'sprite', preload: true, src: new URL('../../assets/sprites/symbolsCartoon/h3.webp', import.meta.url).href },
	sym_H4: { type: 'sprite', preload: true, src: new URL('../../assets/sprites/symbolsCartoon/h4.webp', import.meta.url).href },
	sym_L1: { type: 'sprite', preload: true, src: new URL('../../assets/sprites/symbolsCartoon/l1.webp', import.meta.url).href },
	sym_L2: { type: 'sprite', preload: true, src: new URL('../../assets/sprites/symbolsCartoon/l2.webp', import.meta.url).href },
	sym_L3: { type: 'sprite', preload: true, src: new URL('../../assets/sprites/symbolsCartoon/l3.webp', import.meta.url).href },
	sym_W: { type: 'sprite', preload: true, src: new URL('../../assets/sprites/symbolsCartoon/w.webp', import.meta.url).href },
	sym_HAT: { type: 'sprite', preload: true, src: new URL('../../assets/sprites/symbolsCartoon/hat.webp', import.meta.url).href },
	sym_GHAT: { type: 'sprite', preload: true, src: new URL('../../assets/sprites/symbolsCartoon/ghat.webp', import.meta.url).href },
	// PORTRAIT tiles (tools/art/derive_symbols_tall.py): the same objects composed 1:1.3 so they fill the
	// taller phone cell (stateGame ROW_PITCH_STACKED). Picked by SymbolSprite / ReelStrips when the layout is
	// stacked; the hats have tall tiles too (ribbon at the foot). Owner ruling 2026-09-19.
	symT_H1: { type: 'sprite', preload: true, src: new URL('../../assets/sprites/symbolsCartoonTall/h1.webp', import.meta.url).href },
	symT_H2: { type: 'sprite', preload: true, src: new URL('../../assets/sprites/symbolsCartoonTall/h2.webp', import.meta.url).href },
	symT_H3: { type: 'sprite', preload: true, src: new URL('../../assets/sprites/symbolsCartoonTall/h3.webp', import.meta.url).href },
	symT_H4: { type: 'sprite', preload: true, src: new URL('../../assets/sprites/symbolsCartoonTall/h4.webp', import.meta.url).href },
	symT_L1: { type: 'sprite', preload: true, src: new URL('../../assets/sprites/symbolsCartoonTall/l1.webp', import.meta.url).href },
	symT_L2: { type: 'sprite', preload: true, src: new URL('../../assets/sprites/symbolsCartoonTall/l2.webp', import.meta.url).href },
	symT_L3: { type: 'sprite', preload: true, src: new URL('../../assets/sprites/symbolsCartoonTall/l3.webp', import.meta.url).href },
	symT_W: { type: 'sprite', preload: true, src: new URL('../../assets/sprites/symbolsCartoonTall/w.webp', import.meta.url).href },
	// the hats' tall tiles (hat above, BONUS ribbon at the foot) — art lane 2026-09-19 20:50
	symT_HAT: { type: 'sprite', preload: true, src: new URL('../../assets/sprites/symbolsCartoonTall/hat.webp', import.meta.url).href },
	symT_GHAT: { type: 'sprite', preload: true, src: new URL('../../assets/sprites/symbolsCartoonTall/ghat.webp', import.meta.url).href },
	// Second KEY POSE of the four high symbols (same 384x384 framing): the win motion cuts to it through a
	// squash and back (game/symbolMotion.ts keyPose). Preloaded, so the cut never waits on a texture.
	sym_H1_b: { type: 'sprite', preload: true, src: new URL('../../assets/sprites/symbolsCartoon/h1_b.webp', import.meta.url).href },
	sym_H2_b: { type: 'sprite', preload: true, src: new URL('../../assets/sprites/symbolsCartoon/h2_b.webp', import.meta.url).href },
	sym_H3_b: { type: 'sprite', preload: true, src: new URL('../../assets/sprites/symbolsCartoon/h3_b.webp', import.meta.url).href },
	sym_H4_b: { type: 'sprite', preload: true, src: new URL('../../assets/sprites/symbolsCartoon/h4_b.webp', import.meta.url).href },
	// Hold & Build / Golden Build house tier textures (tools/art/derive_houses.py).
	// One WEBP per tier; HouseView.svelte swaps these for the animation worker's
	// Spine house rigs later without changing its interface.
	house_t1: { type: 'sprite', preload: true, src: new URL('../../assets/sprites/houses/house_t1.webp', import.meta.url).href },
	house_t2: { type: 'sprite', preload: true, src: new URL('../../assets/sprites/houses/house_t2.webp', import.meta.url).href },
	house_t3: { type: 'sprite', preload: true, src: new URL('../../assets/sprites/houses/house_t3.webp', import.meta.url).href },
	house_t4: { type: 'sprite', preload: true, src: new URL('../../assets/sprites/houses/house_t4.webp', import.meta.url).href },
	house_t5: { type: 'sprite', preload: true, src: new URL('../../assets/sprites/houses/house_t5.webp', import.meta.url).href },
	// GATE LOOP r1 (seats A/B/C): the Master Bao mascot rig (static/assets/spine/pw_pig_worker/, donor file
	// names) is not mounted by any component, so it is no longer registered: registering it at all (even
	// preload:false) made AssetsLoader fetch ~1.1 MB at boot that was never drawn. The runtime export stays
	// on disk for the ANIM lane's hash checks; register it again only together with a component that draws it.
	// Five authored Spine house tiers (art-src/animation/runtime-manifest.json →
	// houseInterface). One project per geometry, IDENTICAL clip/event/anchor names,
	// so HouseView drives every tier through the same imperative handle and the
	// build director never branches on tier. NO `scale` override — each skeleton is
	// authored in 1254-px source units (1 Spine unit = 1 source px); HouseView
	// scales the container by cellPx/1254. The flat `house_t1..t5` webp above stay
	// as the sprite fallback if a rig fails to load.
	pw_house_straw: {
		type: 'spine',
		preload: true,
		src: {
			atlas: new URL('../../assets/spine/pw_house_straw/pw_house_straw.atlas', import.meta.url).href,
			skeleton: new URL('../../assets/spine/pw_house_straw/pw_house_straw.json', import.meta.url).href,
		},
	},
	pw_house_wood: {
		type: 'spine',
		preload: true,
		src: {
			atlas: new URL('../../assets/spine/pw_house_wood/pw_house_wood.atlas', import.meta.url).href,
			skeleton: new URL('../../assets/spine/pw_house_wood/pw_house_wood.json', import.meta.url).href,
		},
	},
	pw_house_brick: {
		type: 'spine',
		preload: true,
		src: {
			atlas: new URL('../../assets/spine/pw_house_brick/pw_house_brick.atlas', import.meta.url).href,
			skeleton: new URL('../../assets/spine/pw_house_brick/pw_house_brick.json', import.meta.url).href,
		},
	},
	pw_house_mansion: {
		type: 'spine',
		preload: true,
		src: {
			atlas: new URL('../../assets/spine/pw_house_mansion/pw_house_mansion.atlas', import.meta.url).href,
			skeleton: new URL('../../assets/spine/pw_house_mansion/pw_house_mansion.json', import.meta.url).href,
		},
	},
	pw_house_palace: {
		type: 'spine',
		preload: true,
		src: {
			atlas: new URL('../../assets/spine/pw_house_palace/pw_house_palace.atlas', import.meta.url).href,
			skeleton: new URL('../../assets/spine/pw_house_palace/pw_house_palace.json', import.meta.url).href,
		},
	},
	// Feature-entry VFX rig (art-src/animation/rigs/pw_fx_transition): work-light
	// rays + welding sparks behind the mode card (`card_idle`), and the dust-blast
	// reveal that replaces the three-haul lift on feature ENTRY (`blast_effect`,
	// the hand-edited take; `blast` is the seed fallback; events impact / white /
	// clear). Effects only, no character.
	// Authored in Spine Professional 4.3.23 and exported DOWN to the 4.2 data
	// format this runtime loads. Atlas packed at 0.5 (~360 KB) so it can preload:
	// SpineProvider logs a console error for a key that is not loaded yet.
	pw_fx_transition: {
		type: 'spine',
		preload: true,
		src: {
			atlas: new URL('../../assets/spine/pw_fx_transition/pw_fx_transition.atlas', import.meta.url).href,
			skeleton: new URL('../../assets/spine/pw_fx_transition/pw_fx_transition.json', import.meta.url).href,
		},
	},
	// Piggy Workers construction-site environments and board furniture
	// (tools/art/gen_art.py -> tools/art/derive_scene.py; gpt-image-2.5-sunburst
	// sources in art-src/generated). Base is the sunny site; the two bonus
	// variants are relight derivatives (Hold & Build = dusk/blue-hour, Golden
	// Build = golden-hour). Landscape + portrait per scene, orientation-picked in
	// Background.svelte. The frame + cell backplate carry genuine alpha.
	env_base_landscape: { type: 'sprite', preload: true, src: new URL('../../assets/environment/base_landscape.webp', import.meta.url).href },
	env_base_portrait: { type: 'sprite', preload: true, src: new URL('../../assets/environment/base_portrait.webp', import.meta.url).href },
	env_hold_landscape: { type: 'sprite', preload: true, src: new URL('../../assets/environment/hold_landscape.webp', import.meta.url).href },
	env_hold_portrait: { type: 'sprite', preload: true, src: new URL('../../assets/environment/hold_portrait.webp', import.meta.url).href },
	env_golden_landscape: { type: 'sprite', preload: true, src: new URL('../../assets/environment/golden_landscape.webp', import.meta.url).href },
	env_golden_portrait: { type: 'sprite', preload: true, src: new URL('../../assets/environment/golden_portrait.webp', import.meta.url).href },
	boardFrame: { type: 'sprite', preload: true, src: new URL('../../assets/environment/board_frame.webp', import.meta.url).href },
	cellBackplate: { type: 'sprite', preload: true, src: new URL('../../assets/environment/cell_backplate.webp', import.meta.url).href },
	coins: {
		type: 'spriteSheet',
		// Piggy Workers' own 3D-tumbling gold coin (art-src/winrungs); the donor coin sheet is gone.
		src: new URL('../../assets/winrungs/pieces/gold_coin_pixi.json', import.meta.url).href,
	},
	// The donor Howler sprite `sound` asset (sounds.json incl. bgm_main) is retired.
	// All audio is the single Web Audio manager in src/game/audio (cues in
	// static/assets/audio/lucky, manifest audio/cues.json), unlocked on the splash.
	// ambient world, shutter, mode cards, 3D hats, gust / delivery art — preloaded behind the splash
	...sceneAssets,
} as const;
