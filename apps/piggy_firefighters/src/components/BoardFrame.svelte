<script lang="ts" module>
	export type EmitterEventBoardFrame =
		| { type: 'boardFrameGlowShow' }
		| { type: 'boardFrameGlowHide' };
</script>

<script lang="ts">
	// THE REEL FRAME — the side of the ladder truck (theme §4: "red panel, chrome rail, brass line-number plates").
	//
	// PLACEHOLDER, drawn procedurally: the frame wraps the BOARD ONLY, with the thicknesses the scene layout
	// reserves for it (stateGame.sceneLayout: `post`, `innerMargin`, `sidePosts`), so the art lane's painted frame
	// can replace these Graphics one-for-one without moving anything else. On phones / tablets (stacked layouts) the
	// reels run edge to edge and only the header beam above and the lower beam below are drawn.
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	import { Container, Graphics } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { BOARD_SIZES, SYMBOL_SIZE } from '../game/constants';
	import { stateScene } from '../game/fx/stateScene.svelte';

	const context = getContext();
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
	const night = $derived(stateScene.mood !== 'base');

	const INK = 0x3a2213;
	const RED = 0xd7262b;
	const RED_DARK = 0x8c141a;
	const CHROME = 0xc9d2dc;
	const CHROME_DARK = 0x7c8aa0;
	const BRASS = 0xe9b23b;
	const YELLOW = 0xf5d23c;
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

	<!-- reel backing panel: deep dusk navy inside the opening so every symbol outline reads -->
	<Graphics
		draw={(g) => {
			const m = S * (sl.innerMargin + sl.post * 0.4);
			const r = S * 0.1;
			g.roundRect(-m, -m, W + 2 * m, H + 2 * m, r).fill({ color: hot ? 0x2a0c0c : night ? 0x0d1226 : 0x1e2a4a, alpha: 0.97 });
			for (let c = 1; c < W / S; c += 1) {
				g.moveTo(c * S, 6).lineTo(c * S, H - 6).stroke({ width: 2, color: hot ? 0x7a2a1a : 0x3a4a78, alpha: 0.5 });
			}
			const rowH = S * sl.rowPitch;
			for (let rr = 1; rr < Math.round(H / rowH); rr += 1) {
				g.moveTo(6, rr * rowH).lineTo(W - 6, rr * rowH).stroke({ width: 2, color: hot ? 0x7a2a1a : 0x3a4a78, alpha: 0.35 });
			}
			g.roundRect(2, 2, W - 4, H - 4, r * 0.7).stroke({ width: 3, color: hot ? 0xff7a1a : 0x7c8aa0, alpha: 0.45 });
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

	<!-- the truck panel: posts (wide layouts only), header beam with a chrome rail, lower beam with a reflective band -->
	<Graphics
		draw={(g) => {
			const p = sl.post * S;
			const m = sl.innerMargin * S;
			const over = sl.sidePosts ? 0 : S * 0.3;
			const x0 = -m - (sl.sidePosts ? p : 0) - over;
			const x1 = W + m + (sl.sidePosts ? p : 0) + over;
			const top = -m - p * 1.17;
			const bottom = H + m;
			const beamH = p * 1.17;
			const lowH = p * 1.2;
			// header beam
			g.roundRect(x0, top, x1 - x0, beamH, p * 0.25).fill(RED).stroke({ width: 4, color: INK });
			g.rect(x0 + 6, top + beamH * 0.16, x1 - x0 - 12, beamH * 0.18).fill(CHROME);
			g.rect(x0 + 6, top + beamH * 0.34, x1 - x0 - 12, beamH * 0.05).fill(CHROME_DARK);
			for (let x = x0 + p * 0.6; x < x1 - p * 0.3; x += p * 1.4) g.circle(x, top + beamH * 0.7, p * 0.09).fill(BRASS).stroke({ width: 2, color: INK });
			// lower beam with a yellow reflective band
			g.roundRect(x0, bottom, x1 - x0, lowH, p * 0.25).fill(RED_DARK).stroke({ width: 4, color: INK });
			g.rect(x0 + 6, bottom + lowH * 0.36, x1 - x0 - 12, lowH * 0.26).fill(YELLOW);
			if (sl.sidePosts) {
				for (const px of [-m - p, W + m]) {
					g.roundRect(px, top + beamH * 0.5, p, bottom - top - beamH * 0.5 + lowH * 0.5, p * 0.2).fill(RED).stroke({ width: 4, color: INK });
					g.rect(px + p * 0.18, top + beamH, p * 0.16, bottom - top - beamH).fill({ color: CHROME, alpha: 0.85 });
					for (let y = top + beamH * 1.3; y < bottom - p * 0.2; y += S * 0.5) g.circle(px + p * 0.66, y, p * 0.08).fill(BRASS).stroke({ width: 2, color: INK });
				}
			}
		}}
	/>
</Container>
