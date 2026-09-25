<script lang="ts" module>
	let warmed = false; // the pipeline warm-up below runs once per page, not once per board mount
</script>

<script lang="ts">
	// SPINNING REELS — the picture. (The model is game/reels/spinReels.svelte.ts.)
	//
	// Five strips of pooled sprites inside the masked board. While a reel travels its strip is the only
	// thing drawn in that column: six slots cover the three-row window plus the smear above and below,
	// each slot is TWO sprites — the sharper and the blurrier copy of its symbol — cross-faded by the
	// strip's velocity, with a small velocity stretch on top. The blurred copies are baked once
	// (game/reels/blurAtlas.ts); a moving strip only re-points sprites at resident textures. The window
	// is never empty: from the first frame of the wind-up to the last frame of the brake every slot
	// that touches the window has a symbol in it.
	//
	// At rest the strip is hidden and the Svelte column shows; this component also writes the column's
	// settle offset and (reduced motion) its fade. All of it from the board's ONE ticker.
	import { onMount } from 'svelte';
	import { Container, PIXI, getContextApp } from 'pixi-svelte';

	import { getContext } from '../../game/context';

	import Grab from '../scene/Grab.svelte';
	import { spinReels } from '../../game/stateGame.svelte';
	import { REEL_BLUR, SYMBOL_INFO_MAP, SYMBOL_SIZE } from '../../game/constants';
	import { getSymbolX } from '../../game/utils';
	import { boardTicker } from '../../game/reels/boardTicker';
	import { ensureBlurAtlas, type BlurSet } from '../../game/reels/blurAtlas';
	import { reelColumns } from '../../game/reels/reelView';

	const app = getContextApp();
	const context = getContext();
	const S = SYMBOL_SIZE;
	const SLOTS = 6;

	/* eslint-disable @typescript-eslint/no-explicit-any */
	type Slot = { base: PIXI.Sprite; over: PIXI.Sprite; j: number; version: number; name: string; mode: number };
	type Strip = { node: PIXI.Container; slots: Slot[] };

	let root: PIXI.Container | undefined;
	let strips: Strip[] = [];
	// the board is stretched `rowPitch` tall in portrait (stateGame ROW_PITCH_STACKED); the strip
	// sprites counter-scale so the streaming art stays the shape of the landed art
	let invPitch = 1;
	$effect(() => {
		const sl = context.stateGameDerived.sceneLayout();
		invPitch = 1 / sl.rowPitch;
		// rotating a phone swaps the tile set: rebuild the looks and re-point every slot
		if (blur && sl.stacked !== looksStacked) {
			buildLooks();
			for (const strip of strips) for (const slot of strip.slots) slot.mode = -1;
		}
	});
	let blur: BlurSet | null = null;

	// per symbol: the three textures and the scale that draws each at the symbol's on-board size
	type Look = { tex: PIXI.Texture[]; sx: number[]; sy: number[] };
	const looks: Record<string, Look> = {};

	let looksStacked = false;
	const buildLooks = () => {
		const loaded = (app.stateApp.loadedAssets ?? {}) as Record<string, any>;
		const stacked = context.stateGameDerived.sceneLayout().stacked;
		const rowPitch = context.stateGameDerived.sceneLayout().rowPitch;
		looksStacked = stacked;
		for (const name of Object.keys(SYMBOL_INFO_MAP) as (keyof typeof SYMBOL_INFO_MAP)[]) {
			const info = SYMBOL_INFO_MAP[name].static;
			// stacked layouts stream the 1:1.3 portrait tile where one exists (assets.ts symT_*)
			const tall = stacked ? (loaded[info.assetKey.replace(/^sym_/, 'symT_')] as PIXI.Texture | undefined) : undefined;
			const sharp = tall ?? (loaded[info.assetKey] as PIXI.Texture | undefined);
			if (!sharp) continue;
			const w = S * info.sizeRatios.width;
			const h = S * info.sizeRatios.height * (tall ? Math.min(rowPitch, tall.height / Math.max(1, tall.width)) : 1);
			const set = blur?.textures[name];
			const tex = [sharp, set?.[0] ?? sharp, set?.[1] ?? sharp];
			looks[name] = {
				tex,
				sx: tex.map((t) => w / t.width),
				// a blurred cell is taller than it is wide by the atlas aspect; the art inside keeps its size
				sy: tex.map((t, i) => (i === 0 || !set ? h / t.height : (h * blur!.aspect) / t.height)),
			};
		}
	};

	const smooth = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

	const tick = () => {
		for (let r = 0; r < strips.length; r += 1) {
			const reel = spinReels[r];
			const strip = strips[r];
			if (!reel) continue;
			const rt = reel.rt;
			const show = rt.showStrip;
			if (strip.node.visible !== show) strip.node.visible = show;

			const columns = reelColumns[r];
			const colY = rt.columnOffset * S;
			for (let c = 0; c < columns.length; c += 1) {
				const node = columns[c];
				if (node.visible === show) node.visible = !show;
				if (node.y !== colY) node.y = colY;
				if (node.alpha !== rt.columnAlpha) node.alpha = rt.columnAlpha;
			}
			if (!show) continue;

			// velocity -> which two copies, and how much of the blurrier one
			const k = rt.speed > 0 ? Math.min(1, Math.abs(rt.vel) / rt.speed) : 0;
			let mode = 0;
			let mix = 0;
			if (blur) {
				if (k >= REEL_BLUR.midAt) {
					mode = 1;
					mix = smooth((k - REEL_BLUR.midAt) / (REEL_BLUR.fullAt - REEL_BLUR.midAt));
				} else {
					mix = smooth((k - REEL_BLUR.sharpBelow) / (REEL_BLUR.midAt - REEL_BLUR.sharpBelow));
				}
			}
			const stretch = 1 + REEL_BLUR.stretch * k;
			const baseAlpha = 1 - mix * mix;

			const first = Math.ceil(-rt.pos - 0.95);
			for (let n = 0; n < SLOTS; n += 1) {
				const j = first + n;
				const slot = strip.slots[((j % SLOTS) + SLOTS) % SLOTS];
				if (slot.j !== j || slot.version !== rt.contentVersion) {
					slot.j = j;
					slot.version = rt.contentVersion;
					slot.name = reel.symbolAt(j).name;
					slot.mode = -1;
				}
				const look = looks[slot.name];
				if (!look) continue;
				if (slot.mode !== mode) {
					slot.mode = mode;
					slot.base.texture = look.tex[mode];
					slot.over.texture = look.tex[mode + 1];
				}
				const y = (j - 0.5 + rt.pos) * S;
				slot.base.y = y;
				slot.over.y = y;
				slot.base.scale.set(look.sx[mode], look.sy[mode] * stretch * invPitch);
				slot.over.scale.set(look.sx[mode + 1], look.sy[mode + 1] * stretch * invPitch);
				slot.base.alpha = baseAlpha;
				slot.over.alpha = mix;
				slot.base.visible = baseAlpha > 0.004;
				slot.over.visible = mix > 0.004;
			}
		}
	};

	onMount(() => {
		if (!root) return;
		blur = ensureBlurAtlas(app.stateApp.pixiApplication, app.stateApp.loadedAssets as Record<string, any>);
		buildLooks();
		strips = spinReels.map((_, r) => {
			const node = new PIXI.Container();
			node.x = getSymbolX(r);
			node.visible = false;
			const slots: Slot[] = [];
			for (let n = 0; n < SLOTS; n += 1) {
				const base = new PIXI.Sprite(PIXI.Texture.EMPTY);
				const over = new PIXI.Sprite(PIXI.Texture.EMPTY);
				base.anchor.set(0.5);
				over.anchor.set(0.5);
				node.addChild(base, over);
				slots.push({ base, over, j: Number.NaN, version: -1, name: '', mode: -1 });
			}
			root!.addChild(node);
			return { node, slots };
		});
		boardTicker.add(tick);
		tick();

		// PIPELINE WARM-UP. The first TilingSprite the renderer ever draws compiles its shader on that
		// frame, and on this board that frame is the first reel ANTICIPATION (the hazard-stripe frame),
		// i.e. mid-spin: a measured ~225 ms hitch. One 4 px, all-but-invisible tiling sprite drawn for
		// a few frames while the board first appears (behind the splash shutter) pays that cost here.
		let warm: PIXI.TilingSprite | undefined;
		let warmFrames = 0;
		const sample = looks.L3?.tex[0];
		if (sample && !warmed) {
			warmed = true;
			warm = new PIXI.TilingSprite({ texture: sample, width: 4, height: 4 });
			warm.alpha = 0.02;
			warm.position.set(2, 2);
			root.addChild(warm);
			const drop = () => {
				warmFrames += 1;
				if (warmFrames < 4) return;
				boardTicker.remove(drop);
				warm?.destroy();
				warm = undefined;
			};
			boardTicker.add(drop);
		}
		return () => {
			warm?.destroy();
			warm = undefined;
			boardTicker.remove(tick);
			strips.forEach((strip) => strip.node.destroy({ children: true }));
			strips = [];
		};
	});
</script>

<Container>
	<Grab ongrab={(node) => (root = node)} />
</Container>
