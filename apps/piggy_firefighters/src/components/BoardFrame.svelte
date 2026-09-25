<script lang="ts" module>
	export type EmitterEventBoardFrame =
		| { type: 'boardFrameGlowShow' }
		| { type: 'boardFrameGlowHide' };
</script>

<script lang="ts">
	// THE REEL FRAME — the side of the ladder truck (theme §4: "red panel, chrome rail, brass line-number plates"),
	// built from the art lane's plate `ui_scene/board_frame.webp` (1497x946, opening in frame.meta.json).
	//
	// The plate is drawn as PIECES, not as one stretched picture, so the frame keeps its post thickness at every
	// board size and orientation: four corner blocks (with their brass corner plates), a top rail tiled in whole
	// `rail_period_px` periods (one chrome stud per period), a plain bottom rail, plain post slices tiled down each
	// side with the brass mid plate at the post's middle. Behind the reels: the riveted `cell_backplate` (nine-slice)
	// and a plain navy cell frame on every cell (nine-slice, geometry from cells.meta.json); a Blaze Wild's cell wears
	// the red `cell_frame_locked` until the next spin. The layout reserves exactly the drawn thickness
	// (stateGame.sceneLayout: `post`, FRAME_OUT_*, from the same meta). On phones / tablets (stacked layouts) the
	// reels run edge to edge: the rails span the full width and the posts fall outside the screen.
	import { onMount, untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { Container, Graphics, PIXI, getContextApp } from 'pixi-svelte';

	import Grab from './scene/Grab.svelte';
	import { getContext } from '../game/context';
	import { BOARD_SIZES, BOARD_DIMENSIONS, SYMBOL_SIZE } from '../game/constants';
	import { stateScene } from '../game/fx/stateScene.svelte';
	import { sceneTex } from '../game/fx/sceneTextures.svelte';
	import { BOARD_FRAME, cellFrame } from '../game/artMeta';

	const context = getContext();
	const app = getContextApp();
	const S = SYMBOL_SIZE;
	const W = BOARD_SIZES.width;

	const sl = $derived(context.stateGameDerived.sceneLayout());
	// H follows the portrait row pitch (stateGame ROW_PITCH_STACKED): the frame wraps the STRETCHED reels
	const H = $derived(BOARD_SIZES.height * sl.rowPitch);

	// ---- frame glow (kept emitter contract; a soft gold rim inside the opening) --
	const glow = new Tween(0, { duration: 300, easing: cubicOut });
	context.eventEmitter.subscribeOnMount({
		boardFrameGlowShow: () => void glow.set(1),
		boardFrameGlowHide: () => void glow.set(0),
	});

	const bl = () => context.stateGameDerived.boardLayout();
	const hot = $derived(stateScene.mood === 'inferno');

	// ---- plate pieces (texture px) -----------------------------------------------------------------------------------
	const F = BOARD_FRAME;
	/** corner blocks run from the plate edge to the first rail period (top) / a little past the corner plate (side) */
	const CORNER_W = F.railTileX;
	const CORNER_H = F.top + 47;
	const POST_TILE = { y: F.top + 62, h: 160 }; // a plain slice of the post between the corner plate and the mid plate
	const MID_PLATE = { y: F.top + 232, h: 120 }; // the brass mid plate on each post
	const PLAIN_ALPHA = 0.9;

	const pieceCache = new Map<string, PIXI.Texture>();
	const piece = (src: PIXI.Texture, x: number, y: number, w: number, h: number) => {
		const key = `${x},${y},${w},${h}`;
		let t = pieceCache.get(key);
		if (!t || t.source !== src.source) {
			const k = src.width / F.w; // the served plate may be a different resolution than the meta
			t = new PIXI.Texture({ source: src.source, frame: new PIXI.Rectangle(src.frame.x + x * k, src.frame.y + y * k, w * k, h * k) });
			pieceCache.set(key, t);
		}
		return t;
	};

	let root: PIXI.Container | undefined;
	let frameNode: PIXI.Container | undefined;
	let backNode: PIXI.Container | undefined;
	let cellsNode: PIXI.Container | undefined;
	let blazeNode: PIXI.Container | undefined;

	const clear = (node: PIXI.Container | undefined) => node?.removeChildren().forEach((c: PIXI.ContainerChild) => c.destroy({ children: true }));

	const nine = (tex: PIXI.Texture, corner: number, x: number, y: number, w: number, h: number, scale: number) => {
		const n = new PIXI.NineSliceSprite({ texture: tex, leftWidth: corner, topHeight: corner, rightWidth: corner, bottomHeight: corner });
		// built at texture scale and scaled down as a unit, so the bolt blocks keep the same size on every cell
		n.width = w / scale;
		n.height = h / scale;
		n.scale.set(scale);
		n.position.set(x, y);
		return n;
	};

	/** A rail of `tex` from `from` to `to` along one axis, in whole periods (the last period is scaled to fit). */
	const rail = (parent: PIXI.Container, tex: PIXI.Texture, horizontal: boolean, from: number, to: number, cross: number, thick: number, k: number, periodPx: number) => {
		const len = to - from;
		if (len <= 0) return;
		const natural = periodPx * k;
		const n = Math.max(1, Math.round(len / natural));
		const step = len / n;
		for (let i = 0; i < n; i += 1) {
			const s = new PIXI.Sprite(tex);
			if (horizontal) {
				s.position.set(from + i * step, cross);
				s.width = step + 0.6;
				s.height = thick;
			} else {
				s.position.set(cross, from + i * step);
				s.width = thick;
				s.height = step + 0.6;
			}
			parent.addChild(s);
		}
	};

	type Layout = { post: number; m: number; pitch: number; sidePosts: boolean };

	const rebuild = (layout: Layout, plate: PIXI.Texture | undefined, back: PIXI.Texture | undefined, cell: PIXI.Texture | undefined) => {
		if (!frameNode || !backNode || !cellsNode) return;
		clear(frameNode);
		clear(backNode);
		clear(cellsNode);
		const m = layout.m * S;
		const Hh = BOARD_SIZES.height * layout.pitch;
		const x0 = -m;
		const y0 = -m;
		const x1 = W + m;
		const y1 = Hh + m;

		// the riveted backplate behind the reels, tucked a little under the frame so no seam shows
		if (back) {
			const bleed = Math.max(4, m * 0.5);
			const corner = Math.round(Math.min(back.width, back.height) * 0.07);
			const n = nine(back, corner, x0 - bleed, y0 - bleed, x1 - x0 + 2 * bleed, y1 - y0 + 2 * bleed, 0.5);
			n.tint = hot ? 0xffb8b8 : 0xffffff;
			backNode.addChild(n);
		}
		// a plain cell frame on every cell (nine-slice: the bolt blocks keep their size on a 1:1.3 stacked cell)
		if (cell) {
			const cf = cellFrame('plain');
			const scale = S / cf.w;
			for (let c = 0; c < BOARD_DIMENSIONS.x; c += 1)
				for (let r = 0; r < BOARD_DIMENSIONS.y; r += 1) {
					const n = nine(cell, cf.corner, c * S, r * S * layout.pitch, S, S * layout.pitch, scale);
					n.alpha = PLAIN_ALPHA;
					cellsNode.addChild(n);
				}
		}
		if (!plate) return;
		// board units per plate px: the drawn post is exactly the thickness the layout reserves
		const k = (layout.post * S) / F.left;
		const top = F.top * k;
		const bottom = F.bottom * k;
		const left = F.left * k;
		const right = F.right * k;
		const topTile = piece(plate, F.railTileX, 0, F.railPeriod, F.top);
		const bottomTile = piece(plate, F.railTileX, F.open.y1, F.railPeriod, F.bottom);
		if (layout.sidePosts) {
			const cw = CORNER_W * k;
			const chh = CORNER_H * k;
			const outerL = x0 - left;
			const outerR = x1 + right;
			const outerT = y0 - top;
			const outerB = y1 + bottom;
			// rails between the corner blocks
			rail(frameNode, topTile, true, outerL + cw, outerR - cw, outerT, top, k, F.railPeriod);
			rail(frameNode, bottomTile, true, outerL + cw, outerR - cw, y1, bottom, k, F.railPeriod);
			const leftTile = piece(plate, 0, POST_TILE.y, F.left, POST_TILE.h);
			const rightTile = piece(plate, F.open.x1, POST_TILE.y, F.right, POST_TILE.h);
			rail(frameNode, leftTile, false, outerT + chh, outerB - chh, outerL, left, k, POST_TILE.h);
			rail(frameNode, rightTile, false, outerT + chh, outerB - chh, x1, right, k, POST_TILE.h);
			// the brass mid plates
			const midY = (outerT + chh + outerB - chh) / 2 - (MID_PLATE.h * k) / 2;
			const midL = new PIXI.Sprite(piece(plate, 0, MID_PLATE.y, F.left, MID_PLATE.h));
			midL.position.set(outerL, midY);
			midL.scale.set(k);
			const midR = new PIXI.Sprite(piece(plate, F.open.x1, MID_PLATE.y, F.right, MID_PLATE.h));
			midR.position.set(x1, midY);
			midR.scale.set(k);
			frameNode.addChild(midL, midR);
			// corner blocks last: they cover the rail ends
			const corners: [number, number, number, number][] = [
				[0, 0, outerL, outerT],
				[F.w - CORNER_W, 0, outerR - cw, outerT],
				[0, F.h - CORNER_H, outerL, outerB - chh],
				[F.w - CORNER_W, F.h - CORNER_H, outerR - cw, outerB - chh],
			];
			for (const [px, py, x, y] of corners) {
				const s = new PIXI.Sprite(piece(plate, px, py, CORNER_W, CORNER_H));
				s.position.set(x, y);
				s.scale.set(k);
				frameNode.addChild(s);
			}
		} else {
			// stacked: header beam and lower beam edge to edge (the reels ARE the canvas width; the rails overrun by a post
			// so a resize never shows a bare end)
			rail(frameNode, topTile, true, x0 - left, x1 + right, y0 - top, top, k, F.railPeriod);
			rail(frameNode, bottomTile, true, x0 - left, x1 + right, y1, bottom, k, F.railPeriod);
		}
	};

	// rebuild only when the layout or a texture changes (never per frame)
	$effect(() => {
		const layout: Layout = { post: sl.post, m: sl.innerMargin, pitch: sl.rowPitch, sidePosts: sl.sidePosts };
		const plate = sceneTex('board_frame') as PIXI.Texture | undefined;
		const back = sceneTex('cell_backplate') as PIXI.Texture | undefined;
		const cell = sceneTex('cell_frame_plain') as PIXI.Texture | undefined;
		void hot;
		untrack(() => rebuild(layout, plate, back, cell));
	});

	// Blaze Wild cells wear the red frame until the next spin clears the board
	const blazeCells = $derived(
		context.stateGame.board.flatMap((reel, c) =>
			reel.reelState.symbols.slice(1, 1 + BOARD_DIMENSIONS.y).flatMap((s, r) => (s.rawSymbol.blaze ? [{ c, r }] : [])),
		),
	);
	$effect(() => {
		const cells = blazeCells;
		const tex = sceneTex('cell_frame_locked') as PIXI.Texture | undefined;
		const pitch = sl.rowPitch;
		untrack(() => {
			if (!blazeNode) return;
			clear(blazeNode);
			if (!tex) return;
			const cf = cellFrame('locked');
			for (const { c, r } of cells) blazeNode.addChild(nine(tex, cf.corner, c * S, r * S * pitch, S, S * pitch, S / cf.w));
		});
	});

	const build = (node: PIXI.Container) => {
		root = node;
		backNode = new PIXI.Container();
		cellsNode = new PIXI.Container();
		blazeNode = new PIXI.Container();
		frameNode = new PIXI.Container();
		root.addChild(backNode, cellsNode, blazeNode, frameNode);
	};

	onMount(() => {
		void app;
		return () => {
			clear(frameNode);
			clear(backNode);
			clear(cellsNode);
			clear(blazeNode);
			pieceCache.forEach((t) => t.destroy(false));
			pieceCache.clear();
		};
	});
</script>

<Container x={bl().x} y={bl().y} scale={bl().zoomScale} pivot={{ x: W / 2, y: H / 2 }}>
	<!-- soft contact shadow so the board sits IN the world instead of on top of it -->
	<Graphics
		draw={(g) => {
			const p = sl.post * S;
			for (let i = 0; i < 5; i += 1) {
				const grow = p * (0.5 + i * 0.22);
				g.roundRect(-grow, -grow * 0.6 + p * 0.5, W + 2 * grow, H + 2 * grow * 0.8, p * 1.2).fill({ color: 0x0e0806, alpha: 0.06 });
			}
		}}
	/>

	<!-- backplate, cell frames, Blaze frames, then the truck panel -->
	<Container>
		<Grab ongrab={build} />
	</Container>

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
</Container>
