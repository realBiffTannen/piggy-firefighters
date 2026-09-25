<script lang="ts" module>
	export type EmitterEventLinePop =
		/** one line win is being shown: pop its amount over the line (rows PADDED by 1, like winInfo) */
		| {
				type: 'linePop';
				lineIndex: number;
				positions: { reel: number; row: number }[];
				amount: number;
				/** the multiplier this win was paid at (Rescue global x Blaze Wild sum), if above x1 */
				multiplier?: number;
		  };
</script>

<script lang="ts">
	// LINE POP — the amount of ONE line win, popped over the middle of its winning cells (the donor's way-win pop,
	// moved here as a LINE pop). Gold bitmap font, grows in with a small overshoot, rises and fades in ~760 ms
	// (shorter in turbo). Inside Rescue Spins a win paid at a multiplier carries a small "×N" tag so the player
	// sees why the figure is bigger. Presentation only: never awaited, never holds the round.
	import { onMount } from 'svelte';
	import { Container, PIXI } from 'pixi-svelte';

	import Grab from './scene/Grab.svelte';
	import { getContext } from '../game/context';
	import { SYMBOL_SIZE, REEL_PADDING, BOARD_SIZES } from '../game/constants';
	import { formatBookAmount } from '../game/money';
	import { prefersReducedMotion, isTurbo } from '../game/fx/timing';
	import { boardTicker } from '../game/reels/boardTicker';

	const context = getContext();
	const S = SYMBOL_SIZE;
	const RISE = 0.28; // cells
	const cellX = (reel: number) => (reel + REEL_PADDING) * S;
	const cellY = (paddedRow: number) => (paddedRow - 0.5) * S;

	type Pop = { node: PIXI.Container; t: number; d: number; y: number };
	let root: PIXI.Container | undefined;
	const pops: Pop[] = [];

	const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
	const easeOutBack = (p: number) => 1 + 2.70158 * Math.pow(p - 1, 3) + 1.70158 * Math.pow(p - 1, 2);

	const pop = (positions: { reel: number; row: number }[], amount: number, multiplier?: number) => {
		if (!root || !positions.length || amount <= 0) return;
		// DEV ONLY (stripped from production builds): the QA capture driver waits for a line pop
		if (import.meta.env.DEV && typeof window !== 'undefined') {
			const w = window as unknown as { __pffLinePops?: number };
			w.__pffLinePops = (w.__pffLinePops ?? 0) + 1;
		}
		const byReel = [...positions].sort((a, b) => a.reel - b.reel);
		const mid = byReel[Math.floor((byReel.length - 1) / 2)];
		const node = new PIXI.Container();
		const label = new PIXI.BitmapText({ text: formatBookAmount(amount), style: { fontFamily: 'gold', fontSize: S * 0.4, align: 'center' } });
		label.anchor.set(0.5);
		node.addChild(label);
		if (multiplier && multiplier > 1) {
			const tag = new PIXI.BitmapText({ text: `×${multiplier}`, style: { fontFamily: 'gold', fontSize: S * 0.24, align: 'center' } });
			tag.anchor.set(0, 0.5);
			tag.position.set(label.width / 2 + S * 0.05, -S * 0.06);
			tag.tint = 0xff9f4a;
			node.addChild(tag);
		}
		const x = Math.max(S * 0.7, Math.min(BOARD_SIZES.width - S * 0.7, cellX(mid.reel)));
		const y = (cellY(mid.row) + S * 0.3) * bl().rowPitch;
		node.position.set(x, y);
		root.addChild(node);
		pops.push({ node, t: 0, d: isTurbo() ? 480 : 760, y });
	};

	const clear = () => {
		pops.splice(0).forEach((p) => p.node.destroy({ children: true }));
	};

	const tick = (dt: number) => {
		const reduced = prefersReducedMotion();
		for (let i = pops.length - 1; i >= 0; i -= 1) {
			const p = pops[i];
			p.t += dt;
			const k = Math.min(1, p.t / p.d);
			const pin = Math.min(1, k / 0.22);
			p.node.scale.set(reduced ? 1 : 0.4 + 0.6 * easeOutBack(pin));
			p.node.y = p.y - S * RISE * (reduced ? 0 : easeOut(k));
			p.node.alpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
			if (k >= 1) {
				p.node.destroy({ children: true });
				pops.splice(i, 1);
			}
		}
	};

	context.eventEmitter.subscribeOnMount({
		linePop: ({ positions, amount, multiplier }) => pop(positions, amount, multiplier),
		paylinesClear: () => clear(),
	});

	onMount(() => {
		boardTicker.add(tick);
		return () => {
			boardTicker.remove(tick);
			clear();
		};
	});

	const bl = () => context.stateGameDerived.boardLayout();
</script>

<!-- Same transform as BoardContainer, but uniform (the figure is never stretched by the portrait row pitch). -->
<Container x={bl().x} y={bl().y} scale={bl().zoomScale} pivot={{ x: BOARD_SIZES.width / 2, y: (BOARD_SIZES.height * bl().rowPitch) / 2 }}>
	<Grab ongrab={(node) => (root = node)} />
</Container>
