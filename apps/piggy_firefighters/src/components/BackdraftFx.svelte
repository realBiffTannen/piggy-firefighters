<script lang="ts" module>
	export type EmitterEventBackdraftFx =
		/** the Backdraft presentation; resolves when every booked cell has ignited (cells are 0-based visible rows) */
		{ type: 'backdraftFx'; cells: { reel: number; row: number }[] };
</script>

<script lang="ts">
	// BACKDRAFT (contract §4, theme §4): the bay door blows open in a flash, a wave of flame rolls across the reels
	// left to right and, as the front passes each booked cell, that cell bursts into a BLAZE WILD (the reel symbol is
	// swapped to W drawn on fire: rescueDirector.igniteCell). Embers drift up afterwards.
	//
	// VFX: pooled Graphics flames and embers in the theme's flame orange / hydrant yellow (procedural particles, the
	// runtime's own FX per docs/ANIMATION_CONTRACT.md). The beat (flash -> sweep -> ignite in reel order -> settle) and
	// the awaited contract are what the directors rely on.
	// The book decides which cells ignite; this component only decides WHEN within the sweep. Speed tiers shorten the
	// sweep; reduced motion ignites every cell at once behind a brief fade; the handler re-applies every ignition after
	// this resolves, so the evaluated board is always the book's even if the picture was skipped.
	import { onMount } from 'svelte';
	import { Container, PIXI } from 'pixi-svelte';

	import Grab from './scene/Grab.svelte';
	import { getContext } from '../game/context';
	import { SYMBOL_SIZE, REEL_PADDING, BOARD_SIZES } from '../game/constants';
	import { prefersReducedMotion, isTurbo } from '../game/fx/timing';
	import { isSuperTurbo } from '../game/stateSpeed.svelte';
	import { boardTicker } from '../game/reels/boardTicker';
	import { igniteCell } from '../game/rescue/rescueDirector';
	import { audioDirector } from '../game/fx/audioDirector';
	import { sceneTex } from '../game/fx/sceneTextures.svelte';
	import { rescueProp } from '../game/artMeta';

	const context = getContext();
	const S = SYMBOL_SIZE;
	const W = BOARD_SIZES.width;
	const H = BOARD_SIZES.height;
	const cellX = (reel: number) => (reel + REEL_PADDING) * S;
	const cellY = (row: number) => (row + 0.5) * S;
	const FLAME = [0xff7a1a, 0xf5d23c, 0xff4a1a, 0xffb347];

	// Backdraft Spins: every Blaze Wild carries a multiplier (contract v1.1 §7). Its badge sits on the cell until the
	// next reveal clears the board (`paylinesClear`): the art lane's blank brass badge (features/rescue/badge_blank.webp),
	// lettered here.
	const badges: PIXI.Container[] = [];
	const BADGE = rescueProp('badge_blank');
	const badge = (c: { reel: number; row: number; mult?: number }) => {
		if (!root || !c.mult) return;
		const node = new PIXI.Container();
		const art = sceneTex('rescue_badge_blank') as PIXI.Texture | undefined;
		let disc: PIXI.Container;
		if (art) {
			const s = new PIXI.Sprite(art);
			s.anchor.set(0.5);
			s.width = S * 0.4;
			s.height = (S * 0.4 * BADGE.h) / BADGE.w;
			disc = s;
		} else disc = new PIXI.Graphics().circle(0, 0, S * 0.17).fill(0xe9b23b).stroke({ width: 4, color: 0x3a2213 });
		const label = new PIXI.Text({
			text: `x${c.mult}`,
			style: { fontFamily: 'StationSign, Lilita One, Inter, sans-serif', fontSize: S * 0.15, fill: 0x3b2313, align: 'center' },
		});
		label.anchor.set(0.5);
		node.addChild(disc, label);
		node.position.set(cellX(c.reel) + S * 0.3, cellY(c.row) - S * 0.3);
		root.addChild(node);
		badges.push(node);
	};
	const clearBadges = () => badges.splice(0).forEach((b) => b.destroy({ children: true }));

	type P = { g: PIXI.Graphics; on: boolean; x: number; y: number; vx: number; vy: number; life: number; max: number; s: number };
	const MAX = 120;
	let root: PIXI.Container | undefined;
	let flash: PIXI.Graphics | undefined;
	const parts: P[] = [];

	type Run = {
		t: number;
		sweepMs: number;
		cells: { reel: number; row: number; at: number; done: boolean }[];
		spawnClock: number;
		resolve: () => void;
		endAt: number;
	};
	let run: Run | undefined;

	const take = (): P | undefined => parts.find((p) => !p.on);

	const spawn = (x: number, y: number, vx: number, vy: number, max: number, s: number) => {
		const p = take();
		if (!p) return;
		p.on = true;
		p.x = x;
		p.y = y;
		p.vx = vx;
		p.vy = vy;
		p.life = 0;
		p.max = max;
		p.s = s;
		p.g.tint = FLAME[Math.floor(Math.random() * FLAME.length)];
		p.g.visible = true;
	};

	const burst = (x: number, y: number) => {
		for (let i = 0; i < 12; i += 1) {
			const a = (i / 12) * Math.PI * 2;
			spawn(x, y, Math.cos(a) * S * 1.4, Math.sin(a) * S * 1.4 - S * 0.6, 520, 0.7 + Math.random() * 0.5);
		}
	};

	const finish = () => {
		const r = run;
		run = undefined;
		if (!r) return;
		r.cells.forEach((c) => {
			if (c.done) return;
			igniteCell(c);
			badge(c);
		});
		if (flash) flash.alpha = 0;
		r.resolve();
	};

	const tick = (dt: number) => {
		// particles
		for (const p of parts) {
			if (!p.on) continue;
			p.life += dt;
			const k = p.life / p.max;
			if (k >= 1) {
				p.on = false;
				p.g.visible = false;
				continue;
			}
			p.vy -= S * 1.6 * (dt / 1000); // flames and embers rise
			p.x += p.vx * (dt / 1000);
			p.y += p.vy * (dt / 1000);
			p.g.position.set(p.x, p.y);
			p.g.scale.set(p.s * (1 - 0.6 * k));
			p.g.alpha = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
		}
		const r = run;
		if (!r) return;
		r.t += dt;
		// the flash: up fast, down slower
		if (flash) flash.alpha = r.t < 90 ? (r.t / 90) * 0.7 : Math.max(0, 0.7 - ((r.t - 90) / 360) * 0.7);
		// the sweep front travels across the board and a little past it
		const front = -S * 0.5 + ((W + S) * Math.min(1, r.t / r.sweepMs));
		if (r.t < r.sweepMs) {
			r.spawnClock += dt;
			while (r.spawnClock > 14) {
				r.spawnClock -= 14;
				spawn(front + (Math.random() - 0.5) * S * 0.4, Math.random() * H, S * 0.9, -S * (0.2 + Math.random() * 0.6), 420 + Math.random() * 260, 0.8 + Math.random() * 0.9);
			}
		}
		r.cells.forEach((c, n) => {
			if (c.done || front < cellX(c.reel)) return;
			c.done = true;
			igniteCell(c);
			badge(c);
			burst(cellX(c.reel), cellY(c.row));
			audioDirector.blazeIgnite(n);
		});
		if (r.t >= r.endAt) finish();
	};

	context.eventEmitter.subscribeOnMount({
		paylinesClear: () => clearBadges(),
		backdraftFx: ({ cells }) =>
			new Promise<void>((resolve) => {
				finish(); // a newer backdraft supersedes an older one (never left hanging)
				const ordered = [...cells].sort((a, b) => a.reel - b.reel || a.row - b.row).map((c) => ({ ...c, at: 0, done: false }));
				if (prefersReducedMotion() || !root) {
					ordered.forEach((c) => {
						igniteCell(c);
						badge(c);
					});
					setTimeout(resolve, 300);
					return;
				}
				const sweepMs = isSuperTurbo() ? 320 : isTurbo() ? 480 : 820;
				run = { t: 0, sweepMs, cells: ordered, spawnClock: 0, resolve, endAt: sweepMs + (isTurbo() ? 160 : 320) };
			}),
	});

	onMount(() => {
		if (root) {
			flash = new PIXI.Graphics().roundRect(-S * 0.2, -S * 0.2, W + S * 0.4, H + S * 0.4, S * 0.15).fill(0xfff1c9);
			flash.alpha = 0;
			flash.blendMode = 'add';
			root.addChild(flash);
			for (let i = 0; i < MAX; i += 1) {
				const g = new PIXI.Graphics();
				// a flame lick: a teardrop pointing up
				g.moveTo(0, -S * 0.16).bezierCurveTo(S * 0.1, -S * 0.02, S * 0.09, S * 0.08, 0, S * 0.09).bezierCurveTo(-S * 0.09, S * 0.08, -S * 0.1, -S * 0.02, 0, -S * 0.16).fill(0xffffff);
				g.visible = false;
				g.blendMode = 'add';
				root.addChild(g);
				parts.push({ g, on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, s: 1 });
			}
		}
		boardTicker.add(tick);
		return () => {
			boardTicker.remove(tick);
			finish();
			clearBadges();
			parts.splice(0).forEach((p) => p.g.destroy());
			flash?.destroy();
			flash = undefined;
		};
	});

	const bl = () => context.stateGameDerived.boardLayout();
</script>

<!-- Same transform as BoardContainer (square board units, the row pitch from zoomScaleXY). -->
<Container x={bl().x} y={bl().y} scale={bl().zoomScaleXY} pivot={{ x: W / 2, y: H / 2 }}>
	<Grab ongrab={(node) => (root = node)} />
</Container>
