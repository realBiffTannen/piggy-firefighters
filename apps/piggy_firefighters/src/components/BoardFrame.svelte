<script lang="ts" module>
	export type EmitterEventBoardFrame =
		| { type: 'boardFrameGlowShow' }
		| { type: 'boardFrameGlowHide' };
</script>

<script lang="ts">
	// The timber frame wraps the BOARD ONLY (scene direction, wave 5). The accepted
	// frame painting (static/assets/environment/board_frame.webp) has a fixed
	// timber-to-opening ratio — drawn whole it needs ~46% extra width and ~69%
	// extra height around the reels, which is what made it run full-bleed and hide
	// the world. Here the SAME painting is re-assembled from its own parts (four
	// braced corners, the hazard-striped top beam, the lower beam, the two posts
	// and their mid brackets) as sub-rectangles of the one texture, so the timber
	// keeps its painted thickness, ink weight and bolts at ANY board size while
	// the beams and posts simply run longer. No new art, no stretching.
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	import { BaseSprite, Container, Graphics } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { BOARD_SIZES, SYMBOL_SIZE } from '../game/constants';
	import { subTexture } from '../game/build/pixiKit';
	import { stateScene } from '../game/build/stateScene.svelte';

	const context = getContext();
	const S = SYMBOL_SIZE;
	const W = BOARD_SIZES.width;
	// H follows the portrait row pitch (stateGame ROW_PITCH_STACKED): the timber wraps the
	// STRETCHED reels, drawn here at the board's uniform scale so no tile is ever distorted

	// ---- the painting, in art px (measured on board_frame.webp 1497x946) --------
	const OPEN = { x0: 212, x1: 1279, y0: 178, y1: 761 };
	const POST_ART = 150; // painted post thickness
	const CORNER = {
		tl: [0, 0, 272, 312],
		tr: [1225, 0, 272, 312],
		bl: [0, 618, 272, 328],
		br: [1225, 618, 272, 328],
	} as const;
	// three hazard-stripe periods, cut yellow-edge to yellow-edge so it repeats
	const TOP_TILE = [340, 36, 487, 154] as const;
	const BOTTOM_TILE = [300, 752, 900, 162] as const;
	const POST_L = [28, 312, 192, 106] as const;
	const POST_R = [1283, 312, 192, 106] as const;
	const BRACKET_L = [22, 412, 200, 116] as const;
	const BRACKET_R = [1272, 412, 200, 116] as const;

	type Piece = { id: string; texture: unknown; x: number; y: number; sx: number; sy: number };

	const frameTex = $derived(context.stateApp.loadedAssets?.boardFrame as any);
	const sl = $derived(context.stateGameDerived.sceneLayout());
	const H = $derived(BOARD_SIZES.height * sl.rowPitch);

	const pieces = $derived.by<Piece[]>(() => {
		const tex = frameTex;
		if (!tex || !tex.source) return [];
		const k = (sl.post * S) / POST_ART; // art px -> board-local units
		const mS = sl.innerMargin * S;
		// art (ax, ay) -> local, anchored on the opening's top-left / bottom-right
		const lx = (ax: number) => -mS + (ax - OPEN.x0) * k;
		const rx = (ax: number) => W + mS + (ax - OPEN.x1) * k;
		const ty = (ay: number) => -mS + (ay - OPEN.y0) * k;
		const by = (ay: number) => H + mS + (ay - OPEN.y1) * k;
		const out: Piece[] = [];
		const eps = 0.6 * k; // overlap so no hairline shows between tiles

		// beams: repeat the tile left -> right, cropping the last one
		const runX = (id: string, tile: readonly number[], yLocal: number, from: number, to: number, mirror: boolean) => {
			let x = from;
			let i = 0;
			while (x < to - 0.01 && i < 40) {
				const wLocal = Math.min(tile[2] * k, to - x);
				const wArt = wLocal / k;
				const flip = mirror && i % 2 === 1;
				const t = subTexture(tex, flip ? tile[0] + tile[2] - wArt : tile[0], tile[1], wArt, tile[3]);
				out.push({ id: `${id}${i}`, texture: t, x: flip ? x + wLocal + eps : x - eps, y: yLocal, sx: (flip ? -1 : 1) * (k + (2 * eps) / wArt), sy: k });
				x += wLocal;
				i += 1;
			}
		};
		// posts: repeat the tile top -> bottom, alternately mirrored (wood grain)
		const runY = (id: string, tile: readonly number[], xLocal: number, from: number, to: number) => {
			let y = from;
			let i = 0;
			while (y < to - 0.01 && i < 60) {
				const hLocal = Math.min(tile[3] * k, to - y);
				const hArt = hLocal / k;
				const flip = i % 2 === 1;
				const t = subTexture(tex, tile[0], flip ? tile[1] + tile[3] - hArt : tile[1], tile[2], hArt);
				out.push({ id: `${id}${i}`, texture: t, x: xLocal, y: flip ? y + hLocal + eps : y - eps, sx: k, sy: (flip ? -1 : 1) * (k + (2 * eps) / hArt) });
				y += hLocal;
				i += 1;
			}
		};

		if (!sl.sidePosts) {
			// phone / tablet: no vertical timber at all — the two beams run the full reel width
			// (a little past it, so the canvas edge never shows a beam end) and nothing else is drawn
			const over = S * 0.3;
			runX('bt', TOP_TILE, ty(TOP_TILE[1]), -mS - over, W + mS + over, false);
			runX('bb', BOTTOM_TILE, by(BOTTOM_TILE[1]), -mS - over, W + mS + over, true);
			return out;
		}
		const yTopOfPosts = ty(CORNER.tl[1] + CORNER.tl[3]);
		const yBottomOfPosts = by(CORNER.bl[1]);
		runY('pl', POST_L, lx(POST_L[0]), yTopOfPosts, yBottomOfPosts);
		runY('pr', POST_R, rx(POST_R[0]), yTopOfPosts, yBottomOfPosts);
		runX('bt', TOP_TILE, ty(TOP_TILE[1]), lx(CORNER.tl[0] + CORNER.tl[2]), rx(CORNER.tr[0]), false);
		runX('bb', BOTTOM_TILE, by(BOTTOM_TILE[1]), lx(CORNER.bl[0] + CORNER.bl[2]), rx(CORNER.br[0]), true);

		const whole = (id: string, r: readonly number[], x: number, y: number) =>
			out.push({ id, texture: subTexture(tex, r[0], r[1], r[2], r[3]), x, y, sx: k, sy: k });
		const midY = H / 2 - (BRACKET_L[3] * k) / 2;
		whole('kl', BRACKET_L, lx(BRACKET_L[0]), midY);
		whole('kr', BRACKET_R, rx(BRACKET_R[0]), midY);
		whole('ctl', CORNER.tl, lx(CORNER.tl[0]), ty(CORNER.tl[1]));
		whole('ctr', CORNER.tr, rx(CORNER.tr[0]), ty(CORNER.tr[1]));
		whole('cbl', CORNER.bl, lx(CORNER.bl[0]), by(CORNER.bl[1]));
		whole('cbr', CORNER.br, rx(CORNER.br[0]), by(CORNER.br[1]));
		return out;
	});

	// ---- frame glow (kept emitter contract; a soft gold rim inside the opening) --
	const glow = new Tween(0, { duration: 300, easing: cubicOut });
	context.eventEmitter.subscribeOnMount({
		boardFrameGlowShow: () => void glow.set(1),
		boardFrameGlowHide: () => void glow.set(0),
	});

	const bl = () => context.stateGameDerived.boardLayout();
	const premium = $derived(stateScene.mood === 'golden');
</script>

<Container x={bl().x} y={bl().y} scale={bl().zoomScale} pivot={{ x: W / 2, y: H / 2 }}>
	<!-- soft contact shadow so the board sits IN the world instead of on top of it -->
	<Graphics
		draw={(g) => {
			const p = sl.post * S;
			for (let i = 0; i < 5; i += 1) {
				const grow = p * (0.5 + i * 0.22);
				g.roundRect(-grow, -grow * 0.6 + p * 0.5, W + 2 * grow, H + 2 * grow * 0.8, p * 1.2).fill({ color: 0x1a0e05, alpha: 0.05 });
			}
		}}
	/>

	<!-- Reel backing panel: deep blueprint teal INSIDE the opening so every symbol
	     outline reads against the bright grass/sky. It bleeds a little under the
	     timber so no world shows through the inner margin. -->
	<Graphics
		draw={(g) => {
			const m = S * (sl.innerMargin + sl.post * 0.4);
			const r = S * 0.1;
			g.roundRect(-m, -m, W + 2 * m, H + 2 * m, r).fill({ color: premium ? 0x23190a : 0x0b2030, alpha: 0.96 });
			g.roundRect(-m, -m, W + 2 * m, H + 2 * m, r).fill({ color: premium ? 0x5a4312 : 0x123a52, alpha: 0.42 });
			// faint blueprint grid: one divider per column / row
			for (let c = 1; c < W / S; c += 1) {
				g.moveTo(c * S, 6).lineTo(c * S, H - 6).stroke({ width: 2, color: premium ? 0xa88432 : 0x2f6f92, alpha: 0.28 });
			}
			const rowH = S * sl.rowPitch;
			for (let rr = 1; rr < Math.round(H / rowH); rr += 1) {
				g.moveTo(6, rr * rowH).lineTo(W - 6, rr * rowH).stroke({ width: 2, color: premium ? 0xa88432 : 0x2f6f92, alpha: 0.28 });
			}
			// recessed inner edge
			g.roundRect(2, 2, W - 4, H - 4, r * 0.7).stroke({ width: 3, color: premium ? 0xd9a93c : 0x3f7fae, alpha: 0.38 });
		}}
	/>

	{#if glow.current > 0.01}
		<Graphics
			alpha={glow.current}
			draw={(g) => {
				for (let i = 0; i < 4; i += 1) {
					g.roundRect(-i * 3, -i * 3, W + i * 6, H + i * 6, S * 0.1).stroke({ width: 6, color: 0xffd34d, alpha: 0.22 - i * 0.045 });
				}
			}}
		/>
	{/if}

	{#each pieces as p (p.id)}
		<BaseSprite texture={p.texture as any} x={p.x} y={p.y} scale={{ x: p.sx, y: p.sy }} />
	{/each}
</Container>
