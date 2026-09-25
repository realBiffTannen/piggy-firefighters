<script lang="ts">
	// The site's timber frame for ONE board of an EXPANDED round. The base board's
	// frame (components/BoardFrame.svelte, another owner's file) wraps the single
	// centred board only; an expanded site needs the same painted timber around
	// every board, at any size and position. This re-assembles the SAME painting
	// (board_frame.webp) from the same measured parts, so the timber keeps its
	// thickness, ink weight and bolts. Geometry constants mirror BoardFrame.svelte.
	import { BaseSprite, Graphics } from 'pixi-svelte';

	import { getContext } from '../../game/context';
	import { BOARD_SIZES, SYMBOL_SIZE } from '../../game/constants';
	import { subTexture } from '../../game/build/pixiKit';

	/* eslint-disable @typescript-eslint/no-explicit-any */
	type Props = { post: number; innerMargin: number; premium?: boolean };
	const { post, innerMargin, premium = false }: Props = $props();

	const context = getContext();
	const S = SYMBOL_SIZE;
	const W = BOARD_SIZES.width;
	const H = BOARD_SIZES.height;

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

	const pieces = $derived.by<Piece[]>(() => {
		const tex = frameTex;
		if (!tex || !tex.source) return [];
		const k = (post * S) / POST_ART; // art px -> board-local units
		const mS = innerMargin * S;
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

</script>

<!-- contact shadow: the board sits ON the yard, with weight -->
<Graphics
	draw={(g) => {
		const p = post * S;
		for (let i = 0; i < 5; i += 1) {
			const grow = p * (0.6 + i * 0.26);
			g.roundRect(-grow, -grow * 0.5 + p * 0.7, W + 2 * grow, H + 2 * grow * 0.8, p * 1.2).fill({ color: 0x05080f, alpha: 0.075 });
		}
	}}
/>
<!-- backing panel under the opening, bleeding a little under the timber -->
<Graphics
	draw={(g) => {
		const m = S * (innerMargin + post * 0.4);
		g.roundRect(-m, -m, W + 2 * m, H + 2 * m, S * 0.1).fill({ color: premium ? 0x23190a : 0x0b2030, alpha: 1 });
	}}
/>
{#each pieces as p (p.id)}
	<BaseSprite texture={p.texture as any} x={p.x} y={p.y} scale={{ x: p.sx, y: p.sy }} />
{/each}
