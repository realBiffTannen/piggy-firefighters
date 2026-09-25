<script lang="ts" module>
	export type EmitterEventPaylines =
		/** light one winning line (1-based `lineIndex`, `positions` = the win's cells, rows PADDED like winInfo) */
		| { type: 'paylineShow'; lineIndex: number; positions: { reel: number; row: number }[]; symbol?: string }
		| { type: 'paylineHide'; lineIndex: number }
		/** every paying line of the spin together for one beat; resolves when the beat is over */
		| { type: 'paylinesAll'; lines: number[] }
		| { type: 'paylinesClear' };
</script>

<script lang="ts">
	// PAYLINES — the 20 fixed lines of contract §3, drawn in BOARD space.
	//
	// A winning line is a glowing path through the CENTRES of its five cells (from `config.paylines[lineIndex - 1]`,
	// rows 0 = top), with its number on a brass plate at the left end and a brighter node on every cell that is part
	// of the win. The path draws on left to right (the direction lines pay), holds while its symbols perform, and
	// fades. `paylinesAll` then shows every paying line together for one beat.
	//
	// Speed tiers only shorten (turbo / Super Turbo / autoplay), reduced motion draws the line at once with no travel.
	// Nothing here ever holds the round: the win's pace is set by the symbols (bookEventHandlerMap winInfo awaits
	// `boardWithAnimateSymbols`, where every winning symbol completes); only `paylinesAll` is awaited, and it is a
	// bounded timer.
	//
	// House style: one Graphics per line, built once and pooled; one ticker callback (boardTicker); redraws only while a
	// line is drawing on or fading.
	import { onMount } from 'svelte';
	import { Container, PIXI } from 'pixi-svelte';

	import Grab from './scene/Grab.svelte';
	import config from '../game/config';
	import { getContext } from '../game/context';
	import { SYMBOL_SIZE, REEL_PADDING, BOARD_SIZES } from '../game/constants';
	import { prefersReducedMotion, isTurbo } from '../game/fx/timing';
	import { isSuperTurbo } from '../game/stateSpeed.svelte';
	import { boardTicker } from '../game/reels/boardTicker';

	const context = getContext();
	const S = SYMBOL_SIZE;
	const LINES = config.paylines as number[][];
	// theme palette, cycled per line so neighbouring lines read apart (flame orange = "something is happening")
	const COLORS = [0xff7a1a, 0xf5d23c, 0xd7262b, 0xe9b23b, 0xfff1c9, 0x5ab4f0, 0xff9f4a, 0xf9e27d];
	const INK = 0x3a2213;

	type LineView = {
		g: PIXI.Graphics;
		plate: PIXI.Container;
		label: PIXI.Text;
		index: number; // 1-based
		cells: Set<number>; // reels that are part of the win
		draw: number; // 0..1 draw-on progress
		alpha: number;
		target: number; // 1 showing, 0 hiding
		dirty: boolean;
	};

	let root: PIXI.Container | undefined;
	const views = new Map<number, LineView>();

	const speed = () => (isSuperTurbo() ? 3.2 : isTurbo() ? 1.8 : 1);
	const cx = (reel: number) => S * (reel + REEL_PADDING);
	const cy = (row: number) => (row + 0.5) * S;

	const pathOf = (lineIndex: number) => {
		const rows = LINES[lineIndex - 1] ?? [1, 1, 1, 1, 1];
		const pts = rows.map((row, reel) => ({ x: cx(reel), y: cy(row) }));
		// run a little past the board on both sides so the line reads as entering and leaving
		const first = pts[0];
		const last = pts[pts.length - 1];
		return [{ x: first.x - S * 0.62, y: first.y }, ...pts, { x: last.x + S * 0.62, y: last.y }];
	};

	const viewFor = (lineIndex: number): LineView | undefined => {
		if (!root) return undefined;
		let v = views.get(lineIndex);
		if (!v) {
			const g = new PIXI.Graphics();
			const plate = new PIXI.Container();
			const disc = new PIXI.Graphics().roundRect(-S * 0.17, -S * 0.13, S * 0.34, S * 0.26, S * 0.07).fill(0xe9b23b).stroke({ width: 3, color: INK });
			const label = new PIXI.Text({
				text: String(lineIndex),
				style: { fontFamily: 'Lilita One, Inter, sans-serif', fontSize: S * 0.19, fill: INK, align: 'center' },
			});
			label.anchor.set(0.5);
			plate.addChild(disc, label);
			const start = pathOf(lineIndex)[0];
			plate.position.set(start.x - S * 0.05, start.y);
			g.visible = false;
			plate.visible = false;
			root.addChild(g, plate);
			v = { g, plate, label, index: lineIndex, cells: new Set(), draw: 0, alpha: 0, target: 0, dirty: true };
			views.set(lineIndex, v);
		}
		return v;
	};

	const redraw = (v: LineView) => {
		const g = v.g;
		g.clear();
		const pts = pathOf(v.index);
		const color = COLORS[(v.index - 1) % COLORS.length];
		// partial path up to `draw`
		const segs = pts.length - 1;
		const upto = v.draw * segs;
		const drawn: { x: number; y: number }[] = [pts[0]];
		for (let i = 0; i < segs; i += 1) {
			if (upto >= i + 1) drawn.push(pts[i + 1]);
			else {
				const f = Math.max(0, upto - i);
				if (f > 0) drawn.push({ x: pts[i].x + (pts[i + 1].x - pts[i].x) * f, y: pts[i].y + (pts[i + 1].y - pts[i].y) * f });
				break;
			}
		}
		const stroke = (width: number, c: number, alpha: number) => {
			g.moveTo(drawn[0].x, drawn[0].y);
			for (let i = 1; i < drawn.length; i += 1) g.lineTo(drawn[i].x, drawn[i].y);
			g.stroke({ width, color: c, alpha, cap: 'round', join: 'round' });
		};
		if (drawn.length > 1) {
			stroke(S * 0.2, color, 0.18); // outer glow
			stroke(S * 0.11, color, 0.35);
			stroke(S * 0.06, INK, 0.9); // ink edge
			stroke(S * 0.04, color, 1); // core
			stroke(S * 0.014, 0xffffff, 0.85); // hot centre
		}
		// nodes on the winning cells that the path has reached
		const rows = LINES[v.index - 1] ?? [];
		rows.forEach((row, reel) => {
			if (!v.cells.has(reel) || v.draw * segs < reel + 1 - 0.001) return;
			g.circle(cx(reel), cy(row), S * 0.075).fill(color).stroke({ width: 3, color: INK });
			g.circle(cx(reel), cy(row), S * 0.03).fill(0xffffff);
		});
		v.dirty = false;
	};

	const show = (lineIndex: number, positions: { reel: number; row: number }[] = []) => {
		const v = viewFor(lineIndex);
		if (!v) return;
		v.cells = new Set(positions.map((p) => p.reel));
		v.target = 1;
		v.draw = prefersReducedMotion() ? 1 : 0;
		v.alpha = prefersReducedMotion() ? 1 : Math.max(v.alpha, 0.2);
		v.g.visible = true;
		v.plate.visible = true;
		v.dirty = true;
	};

	const hide = (lineIndex: number) => {
		const v = views.get(lineIndex);
		if (v) v.target = 0;
	};

	const clearAll = () => {
		views.forEach((v) => {
			v.target = 0;
			v.alpha = 0;
			v.draw = 0;
			v.g.visible = false;
			v.plate.visible = false;
		});
	};

	const tick = (dt: number) => {
		if (!views.size) return;
		const k = speed();
		views.forEach((v) => {
			if (!v.g.visible) return;
			if (v.target > 0) {
				if (v.draw < 1) {
					v.draw = Math.min(1, v.draw + (dt * k) / 260);
					v.dirty = true;
				}
				v.alpha = Math.min(1, v.alpha + (dt * k) / 120);
			} else {
				v.alpha = Math.max(0, v.alpha - (dt * k) / 220);
				if (v.alpha <= 0) {
					v.g.visible = false;
					v.plate.visible = false;
					return;
				}
			}
			if (v.dirty) redraw(v);
			v.g.alpha = v.alpha;
			v.plate.alpha = v.alpha;
			v.plate.scale.set(0.8 + 0.2 * Math.min(1, v.draw * 3));
		});
	};

	const allHoldMs = () => (prefersReducedMotion() ? 600 : isSuperTurbo() ? 220 : isTurbo() ? 450 : 1000);

	context.eventEmitter.subscribeOnMount({
		paylineShow: ({ lineIndex, positions }) => show(lineIndex, positions),
		paylineHide: ({ lineIndex }) => hide(lineIndex),
		paylinesAll: ({ lines }) =>
			new Promise<void>((resolve) => {
				lines.forEach((index) => {
					const v = viewFor(index);
					// keep each line's winning cells from its own beat
					show(index, v ? [...v.cells].map((reel) => ({ reel, row: 0 })) : []);
				});
				setTimeout(() => {
					lines.forEach(hide);
					resolve();
				}, allHoldMs());
			}),
		paylinesClear: () => clearAll(),
	});

	onMount(() => {
		boardTicker.add(tick);
		return () => {
			boardTicker.remove(tick);
			views.forEach((v) => {
				v.g.destroy();
				v.plate.destroy({ children: true });
			});
			views.clear();
		};
	});

	const bl = () => context.stateGameDerived.boardLayout();
</script>

<!-- Same transform as BoardContainer: laid out in square board units; the row pitch comes from zoomScaleXY. -->
<Container x={bl().x} y={bl().y} scale={bl().zoomScaleXY} pivot={{ x: BOARD_SIZES.width / 2, y: BOARD_SIZES.height / 2 }}>
	<Grab ongrab={(node) => (root = node)} />
</Container>
