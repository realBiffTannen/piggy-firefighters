<script lang="ts" module>
	export type DropHat = { reel: number; row: number; golden?: boolean };
	export type EmitterEventFeatureDrops =
		| { type: 'featureGust'; hats: DropHat[]; triggers: boolean; reelHats?: number }
		| { type: 'featureDeliveryCall'; golden: boolean }
		| { type: 'featureDelivery'; hats: DropHat[]; reelHats?: number }
		| { type: 'featureDropsClear'; delayMs?: number }
		/** one ways win is being shown: pop its amount over the winning symbols (rows are reveal rows, padded by 1) */
		| { type: 'wayWinPop'; positions: { reel: number; row: number }[]; amount: number };
</script>

<script lang="ts">
	// HUFF & PUFF GUST and HARD HAT DELIVERY (docs/WOLF_GUST_SPEC.md, docs/HAT_DELIVERY_SPEC.md).
	//
	// Both features add hard hats to the base board AFTER the reels have stopped, and both are
	// entirely book-driven: this component only ever shows the hats a booked `gust` / `hatDelivery`
	// event lists, on the cells it lists. The extra hats are overlay sprites in board space; they stay
	// until the next spin starts or the bonus shutter has covered the board.
	//
	//   gust      wolf leans in from the left -> inhales -> huffs -> wind streaks sweep the board and
	//             the hats ride the gust onto their cells -> a trigger glows gold, a miss gets a shrug
	//   delivery  whistle + sign as the reels start (the spin WILL trigger) -> the crane lowers a crate
	//             -> the crate bursts -> hats arc to their cells, the golden one last
	//
	// Built imperatively on the live PIXI container and driven by ONE ticker callback: the tween kit,
	// the wolf's springs, the crate's pendulum and every particle are stepped from `tick` below.
	// The wolf, the crate, the chain and all particles are built ONCE at mount and pooled
	// (components/features/*): nothing is created, tessellated or uploaded while a feature plays.
	import { onMount } from 'svelte';
	import { Container, PIXI, getContextApp } from 'pixi-svelte';

	import Grab from './scene/Grab.svelte';
	import { getContext } from '../game/context';
	import { BOARD_SIZES, REEL_PADDING, SYMBOL_SIZE } from '../game/constants';
	import { audioManager } from '../game/audio/audioManager';
	import { gameSound } from '../game/audio';
	import { sceneTex } from '../game/build/sceneTextures.svelte';
	import { formatBookAmount } from '../game/money';
	import { prefersReducedMotion, isTurbo } from '../game/build/buildTiming';
	import { isSuperTurbo, stateSpeed } from '../game/stateSpeed.svelte';
	import { createFxPool, type FxPool } from './features/fxPool';
	import { createWolf, type Wolf } from './features/wolfActor';
	import { createCrate, type Crate } from './features/crateRig';
	import { MECHANIC } from '../game/names';
	import { WILD_BANNER } from '../game/symbolMotion';

	const context = getContext();
	/** dropped (gust / delivery) hats landed so far in THIS sequence, and the reel hats they count on from
	 *  (the book's own `reelHats`); both set when a sequence starts */
	let dropLanded = 0;
	let dropBase = 0;
	const app = getContextApp();

	let root: PIXI.Container | undefined;

	const CREAM = 0xfff1c9;
	const GOLD = 0xffd75a;
	const DUST = 0xe9d6ae;
	const INK = 0x2a1a10;
	const S = SYMBOL_SIZE;
	const CRATE_BOX_W = S * 1.38;

	const cellX = (reel: number) => (reel + REEL_PADDING) * SYMBOL_SIZE;
	// rows are `rowPitch` taller than wide on a phone (stateGame ROW_PITCH_STACKED); this layer keeps
	// the board's UNIFORM scale so the wolf / crate art is never stretched, and maps rows itself
	const cellY = (row: number) => (row + 0.5) * SYMBOL_SIZE * context.stateGameDerived.sceneLayout().rowPitch;
	const texture = (key: string): PIXI.Texture =>
		(app.stateApp.loadedAssets?.[key] as PIXI.Texture | undefined) ?? sceneTex(key) ?? PIXI.Texture.EMPTY;
	const cue = (id: string) => {
		try {
			audioManager.playCue(id);
		} catch {
			/* audio is never allowed to break a presentation */
		}
	};
	const rnd = (a: number, b: number) => a + Math.random() * (b - a);

	// DEV ONLY: lets the QA capture driver (qa/tags_0919/features/drive.mjs) key off the real beat
	// instead of sleeping. Stripped from production builds.
	const dev = typeof window !== 'undefined' && import.meta.env?.DEV;
	const beat = { phase: 'idle', step: '' };
	const mark = (phase: string, step = '') => {
		beat.phase = phase;
		beat.step = step;
	};
	if (dev) {
		const w = window as unknown as { __pwFeat?: unknown; __pwSetSuper?: (on: boolean) => void };
		w.__pwFeat = beat;
		w.__pwSetSuper = (on: boolean) => (stateSpeed.tier = on ? 'super' : 'off');
	}

	// ---- tiny ticker-driven tween kit ----------------------------------------------------------
	type Tween = { t: number; d: number; step: (p: number) => void; done: () => void };
	let tweens: Tween[] = [];
	/** Turbo halves every beat, Super Turbo cuts it to 0.3 (the same ladder as game/stateSpeed). */
	const speed = () => (isSuperTurbo() ? 1 / 0.3 : isTurbo() ? 2 : 1);
	const tween = (ms: number, step: (p: number) => void) =>
		new Promise<void>((done) => {
			if (ms <= 0) {
				step(1);
				done();
				return;
			}
			tweens.push({ t: 0, d: ms, step, done });
		});
	const wait = (ms: number) => tween(ms, () => {});
	type Ease = (p: number) => number;
	const easeOut: Ease = (p) => 1 - Math.pow(1 - p, 3);
	const easeIn: Ease = (p) => p * p * p;
	const easeInOut: Ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
	const easeOutBack: Ease = (p) => 1 + 2.70158 * Math.pow(p - 1, 3) + 1.70158 * Math.pow(p - 1, 2);
	const easeInBack: Ease = (p) => 2.4 * p * p * p - 1.4 * p * p;
	/** Tween any numeric fields of a plain object from where they are now. */
	const to = <T extends Record<string, number>>(obj: T, target: Partial<T>, ms: number, ease: Ease = easeInOut) => {
		const keys = Object.keys(target) as (keyof T)[];
		const from = keys.map((key) => obj[key] as number);
		const dest = keys.map((key) => target[key] as number);
		return tween(ms, (p) => {
			const e = ease(p);
			for (let i = 0; i < keys.length; i += 1) (obj[keys[i]] as number) = from[i] + (dest[i] - from[i]) * e;
		});
	};

	// ---- layers -------------------------------------------------------------------------------
	let fxBack: PIXI.Container;
	let hatLayer: PIXI.Container;
	let actorLayer: PIXI.Container;
	let signLayer: PIXI.Container;
	let fxFront: PIXI.Container;
	let popLayer: PIXI.Container;
	let fx: FxPool | undefined;
	let wolf: Wolf | undefined;
	let crate: Crate | undefined;
	let generation = 0;

	const tick = (tk: PIXI.Ticker) => {
		const real = Math.min(50, tk.deltaMS);
		const k = speed();
		if (tweens.length) {
			const list = tweens;
			const dt = real * k;
			const n = list.length;
			let w = 0;
			for (let i = 0; i < n; i += 1) {
				const tw = list[i];
				tw.t += dt;
				const p = Math.min(1, tw.t / tw.d);
				tw.step(p);
				if (p >= 1) tw.done();
				else list[w++] = tw;
			}
			if (list === tweens) {
				for (let i = n; i < list.length; i += 1) list[w++] = list[i]; // started during this pass
				list.length = w;
			}
		}
		const dt = real / 1000;
		wolf?.update(dt);
		crate?.update(dt * Math.min(k, 1.6));
		fx?.update(dt * k);
	};

	const clearAll = () => {
		generation += 1;
		const stale = tweens;
		tweens = [];
		for (const tw of stale) tw.done();
		for (const layer of [hatLayer, signLayer]) {
			layer?.removeChildren().forEach((child: PIXI.ContainerChild) => child.destroy({ children: true }));
		}
		wolf?.hide();
		crate?.hide();
		fx?.clear();
		mark('idle');
	};

	const makeHat = (hat: DropHat) => {
		const sprite = new PIXI.Sprite(texture(hat.golden ? 'sym_GHAT' : 'sym_HAT'));
		sprite.anchor.set(0.5);
		sprite.width = SYMBOL_SIZE;
		sprite.height = SYMBOL_SIZE;
		return sprite;
	};

	const dustRing = (x: number, y: number, color: number) => {
		if (!fx) return;
		const ring = fx.take('ring');
		ring.x = x;
		ring.y = y;
		ring.d = 0.34;
		ring.s0 = 0.5;
		ring.s1 = 1.4;
		ring.fadeIn = 0;
		ring.fadeOut = 0;
		ring.node.tint = color;
	};

	const sparks = (x: number, y: number, count: number, reach: number, color: number) => {
		if (!fx || prefersReducedMotion()) return;
		for (let i = 0; i < count; i += 1) {
			const a = (i / count) * Math.PI * 2 + rnd(-0.3, 0.3);
			const v = reach * rnd(0.7, 1.25);
			const p = fx.take('spark');
			p.x = x;
			p.y = y;
			p.vx = Math.cos(a) * v;
			p.vy = Math.sin(a) * v - reach * 0.3;
			p.gravity = reach * 1.6;
			p.drag = 2.2;
			p.d = rnd(0.45, 0.7);
			p.s0 = rnd(0.7, 1.2);
			p.s1 = 0.15;
			p.vr = rnd(-5, 5);
			p.fadeIn = 0.05;
			p.fadeOut = 0.5;
			p.node.tint = color;
		}
	};

	/** One hat flies from (fromX, fromY) to its cell on an arc, spins, lands with a squash. */
	const flyHat = async (hat: DropHat, fromX: number, fromY: number, ms: number, lift: number) => {
		const gen = generation;
		const sprite = makeHat(hat);
		const baseScaleX = sprite.scale.x;
		const baseScaleY = sprite.scale.y;
		const toX = cellX(hat.reel);
		const toY = cellY(hat.row);
		sprite.position.set(fromX, fromY);
		hatLayer.addChild(sprite);
		const spin = (hat.reel % 2 === 0 ? 1 : -1) * Math.PI * 2;
		if (prefersReducedMotion()) {
			sprite.position.set(toX, toY);
			await tween(180, (p) => (sprite.alpha = p));
		} else {
			await tween(ms, (p) => {
				const e = easeInOut(p);
				sprite.x = fromX + (toX - fromX) * e;
				sprite.y = fromY + (toY - fromY) * e - Math.sin(Math.PI * p) * lift;
				sprite.rotation = spin * (1 - easeOut(p));
				const s = 0.55 + 0.45 * e;
				sprite.scale.set(baseScaleX * s, baseScaleY * s);
			});
		}
		if (gen !== generation) return;
		// COUNT-AWARE landing (2026-09-19). A blown-in / delivered hat used to play a fixed light bonk with
		// no ladder rung, so the hat that COMPLETES the trigger was the least dramatic sound of the round.
		// Its count is the BOOK's `reelHats` plus the dropped hats landed so far, fed to the same escalating
		// landing the reel hats use: the 4th-6th hat gets the heavy pitched bonk and the top rungs, right
		// before the fanfare. (Not stateGame.scatterCounter: the reveal handler zeroes it the moment the
		// reels stop, before a gust or delivery plays, which is why a first attempt always counted from 0.)
		dropLanded += 1;
		try {
			const count = Math.max(1, dropBase + dropLanded);
			if (hat.golden) {
				cue('ghat_land');
				gameSound.goldenHatRung(count);
			} else {
				gameSound.hatLand(count);
			}
		} catch {
			cue(hat.golden ? 'ghat_land' : 'hat_land_1'); // audio is never allowed to break a presentation
		}
		dustRing(toX, toY + SYMBOL_SIZE * 0.2, hat.golden ? GOLD : CREAM);
		if (!prefersReducedMotion()) {
			await tween(260, (p) => {
				const k = Math.sin(Math.PI * p) * (1 - p * 0.4);
				sprite.scale.set(baseScaleX * (1 + 0.16 * k), baseScaleY * (1 - 0.14 * k));
			});
			sprite.scale.set(baseScaleX, baseScaleY);
		}
	};

	/** Gold pulse on every overlay hat: the 6+ trigger is real and it is happening now. */
	const celebrateHats = async () => {
		const hats = hatLayer.children as PIXI.Sprite[];
		const bases = hats.map((h) => ({ x: h.scale.x, y: h.scale.y }));
		await tween(520, (p) => {
			const k = Math.sin(Math.PI * p);
			hats.forEach((h, i) => {
				if (h.destroyed) return;
				h.scale.set(bases[i].x * (1 + 0.24 * k), bases[i].y * (1 + 0.24 * k)); // was 0.12: barely visible
				h.tint = k > 0.35 ? 0xffe27a : 0xffffff;
			});
		});
		hats.forEach((h, i) => {
			if (h.destroyed) return;
			h.scale.set(bases[i].x, bases[i].y);
			h.tint = 0xffffff;
		});
	};

	// ---- per-way win amount ---------------------------------------------------------------------
	// Each ways win names its own amount over its own symbols while they animate, so a multi-way
	// spin reads as "this paid that" instead of one unexplained total.
	// The label never hides a WILD's banner: the banner flash (components/BoardFx.svelte) is the WILD's
	// "I substituted" tell. So the label takes the median NON-WILD cell of the way, and if its box (at the
	// scale-in overshoot, over its whole rise) would still touch the banner of a WILD in the way (the
	// symbolMotion WILD_BANNER crop, over the WILD's sink and punch), it is lifted above that banner.
	const isWildAt = (reel: number, row: number) =>
		context.stateGame.board[reel]?.reelState.symbols[row]?.rawSymbol?.name === 'W';
	const LABEL_RISE = 0.22; // x SYMBOL_SIZE over the label's life
	// symbolMotion W scales the WILD about its planted base: sinks to ~0.88 tall, punches to ~1.2 tall
	// and ~1.25 wide; the banner's band is taken over that whole range
	const WILD_SY = [0.88, 1.2] as const;
	const WILD_SX = 1.25;
	const clearOfWildBanners = (x: number, y: number, label: PIXI.BitmapText, wilds: { reel: number; row: number }[]) => {
		const layout = context.stateGameDerived.sceneLayout();
		const geo = layout.stacked ? WILD_BANNER.tall : WILD_BANNER.square;
		// the WILD tile's height in this layer (BoardFx wildTile: the tall tile, capped at the row pitch)
		const tileH = layout.stacked ? SYMBOL_SIZE * Math.min(layout.rowPitch, geo.artH / geo.artW) : SYMBOL_SIZE;
		const hw = label.width * 0.55; // half the box at the easeOutBack overshoot (~1.1)
		const hh = label.height * 0.55;
		const margin = SYMBOL_SIZE * 0.04;
		// where the reels really draw a row in this layer: `cellY` stretches rows about y = 0, the board
		// stretches them about its pivot (half the board height), so on a phone the two differ
		const reelY = (row: number) => cellY(row) - (BOARD_SIZES.height / 2) * (layout.rowPitch - 1);
		let ly = y;
		for (const w of [...wilds].sort((a, b) => b.row - a.row)) {
			const base = reelY(w.row - 1) + tileH / 2; // the WILD's feet
			const top = base - (1 - geo.y / geo.artH) * tileH * WILD_SY[1];
			const bottom = base - (1 - (geo.y + geo.h) / geo.artH) * tileH * WILD_SY[0];
			const half = (geo.w / geo.artW / 2) * SYMBOL_SIZE * WILD_SX;
			const overlapsX = Math.abs(x - cellX(w.reel)) < hw + half + margin;
			const overlapsY = ly + hh + margin > top && ly - SYMBOL_SIZE * LABEL_RISE - hh - margin < bottom;
			if (overlapsX && overlapsY) ly = top - hh - margin;
		}
		return ly;
	};
	const wayWinPop = (positions: { reel: number; row: number }[], amount: number) => {
		if (!popLayer || !positions.length || amount <= 0) return;
		const wilds = positions.filter((pos) => isWildAt(pos.reel, pos.row));
		const plain = positions.filter((pos) => !isWildAt(pos.reel, pos.row));
		const byReel = [...(plain.length ? plain : positions)].sort((a, b) => a.reel - b.reel);
		const mid = byReel[Math.floor((byReel.length - 1) / 2)];
		const label = new PIXI.BitmapText({
			text: formatBookAmount(amount),
			style: { fontFamily: 'gold', fontSize: SYMBOL_SIZE * 0.4, align: 'center' },
		});
		label.anchor.set(0.5);
		const x = Math.max(SYMBOL_SIZE * 0.7, Math.min(BOARD_SIZES.width - SYMBOL_SIZE * 0.7, cellX(mid.reel)));
		const y0 = cellY(mid.row - 1) + SYMBOL_SIZE * 0.3;
		const y = wilds.length ? clearOfWildBanners(x, y0, label, wilds) : y0;
		label.position.set(x, y);
		popLayer.addChild(label);
		const reduced = prefersReducedMotion();
		void tween(760, (p) => {
			if (label.destroyed) return;
			const pin = Math.min(1, p / 0.22);
			label.scale.set(reduced ? 1 : 0.4 + 0.6 * easeOutBack(pin));
			label.y = y - SYMBOL_SIZE * LABEL_RISE * easeOut(p);
			label.alpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
		}).then(() => !label.destroyed && label.destroy());
	};

	// ---- HUFF & PUFF ---------------------------------------------------------------------------
	// The performance (normal speed; turbo / super turbo run the same beats faster):
	//   peek      leans in off the screen edge (ease-out-back), dust kicked off the edge, ears settle
	//   dip       anticipation: squashes down and forward, the opposite of what comes next
	//   inhale    mouth opens on a stretch, chest swells about the chest, head tips back, air is
	//             sucked toward him, the shake starts
	//   full      cheeks FULL: held for a beat, trembling, reddening, still rearing back
	//   BLOW      snaps forward on a stretch, holds the blow while the gust and the hats leave
	//   exit      trigger: a satisfied recoil and he is gone while the hats are still in the air
	//             miss: deflates into the defeated slump, shrugs, slinks off
	const pt = { x: 0, y: 0 };

	const edgeDust = (x: number, y: number, h: number) => {
		if (!fx) return;
		for (let i = 0; i < 8; i += 1) {
			const p = fx.take('puff');
			p.delay = 0.07 + i * 0.012;
			p.x = x + rnd(0, S * 0.18);
			p.y = y + (i / 7 - 0.5) * h * 0.85;
			p.vx = rnd(S * 0.9, S * 2.4);
			p.vy = rnd(-S * 0.5, S * 0.2);
			p.drag = 3.2;
			p.d = rnd(0.5, 0.75);
			p.s0 = 0.45;
			p.s1 = rnd(1.5, 2.3);
			p.alpha = 0.8;
			p.fadeIn = 0.12;
			p.fadeOut = 0.3;
			p.node.tint = DUST;
		}
	};

	/** Air (and a leaf or two) pulled INTO the open mouth during the inhale. */
	const suction = (mx: number, my: number, seconds: number) => {
		if (!fx) return;
		for (let i = 0; i < 7; i += 1) {
			const leafy = i % 3 === 2;
			const p = fx.take(leafy ? 'leaf' : 'streak');
			const a = rnd(-0.55, 0.55);
			const dist = S * rnd(1.7, 2.6);
			const life = rnd(0.32, 0.42);
			p.delay = (i / 7) * seconds * 0.8;
			p.x = mx + Math.cos(a) * dist;
			p.y = my + Math.sin(a) * dist;
			p.vx = (-Math.cos(a) * dist * 0.92) / life;
			p.vy = (-Math.sin(a) * dist * 0.92) / life;
			p.d = life;
			p.rot = a + Math.PI;
			p.s0 = leafy ? 1.1 : 0.55;
			p.s1 = leafy ? 0.5 : 0.25;
			p.vr = leafy ? rnd(-9, 9) : 0;
			p.alpha = leafy ? 1 : 0.75;
			p.fadeIn = 0.25;
			p.fadeOut = 0.7;
		}
	};

	/** The gust itself: thick tapered streaks fanning out of the mouth, a few curls, leaves and straw riding it. */
	const windVolley = (mx: number, my: number, seconds: number) => {
		if (!fx) return;
		const travel = BOARD_SIZES.width + S * 3;
		const life = 0.56;
		const count = 15;
		for (let i = 0; i < count; i += 1) {
			const curly = i % 5 === 3;
			const p = fx.take(curly ? 'curl' : 'streak');
			const lane = ((i * 7) % count) / (count - 1) - 0.5; // -0.5..0.5, shuffled
			const spread = lane * S * 2.9;
			p.delay = (i / count) * seconds;
			p.x = mx;
			p.y = my + spread * 0.22;
			p.vx = (travel / life) * rnd(0.9, 1.1);
			p.vy = (spread * 0.78) / life;
			p.rot = Math.atan2(p.vy, p.vx);
			p.d = life;
			p.s0 = curly ? 0.75 : rnd(0.85, 1.35);
			p.s1 = p.s0;
			p.kx0 = 0.45;
			p.kx1 = curly ? 1.1 : 1.7;
			p.alpha = 0.92;
			p.fadeIn = 0.14;
			p.fadeOut = 0.5;
			p.wobA = curly ? 0 : rnd(2, 6);
			p.wobF = rnd(9, 14);
			p.wobP = i;
		}
		for (let i = 0; i < 11; i += 1) {
			const p = fx.take(i % 2 ? 'leaf' : 'straw');
			const lane = rnd(-0.5, 0.5);
			const lifeB = rnd(0.62, 0.85);
			p.delay = rnd(0, seconds);
			p.x = mx;
			p.y = my + lane * S * 0.5;
			p.vx = (travel / lifeB) * rnd(0.85, 1);
			p.vy = (lane * S * 2.6) / lifeB;
			p.d = lifeB;
			p.rot = rnd(0, 6);
			p.vr = rnd(8, 16) * (i % 3 ? 1 : -1);
			p.s0 = rnd(0.9, 1.35);
			p.s1 = p.s0;
			p.fadeIn = 0.08;
			p.fadeOut = 0.75;
			p.wobA = rnd(8, 18);
			p.wobF = rnd(10, 16);
			p.wobP = i * 1.7;
		}
	};

	const gust = async (hats: DropHat[], triggers: boolean, reelHats = 0) => {
		dropLanded = 0;
		dropBase = Math.max(0, Math.round(reelHats) || 0);
		clearAll();
		if (!wolf) return;
		const gen = generation;
		const alive = () => gen === generation;
		const reduced = prefersReducedMotion();
		mark('gust', 'peek');

		// The wolf art is a lean-in from a left edge (his paws grip it), so he enters from the SCREEN's
		// left edge: beside the board and over its first columns on desktop / landscape, from the open
		// sky above the board in portrait. He withdraws while the hats are still in the air, so he
		// never sits on a cell a hat is landing on.
		const sl = context.stateGameDerived.sceneLayout();
		const stacked = sl.stacked;
		const pxPerUnit = Math.max(0.01, sl.cell / SYMBOL_SIZE);
		const screenLeft = -sl.reel.x / pxPerUnit; // the viewport's left edge, in board units
		const wolfH = stacked ? S * 2.1 : S * 2.5;
		const k = wolfH / 512;
		const restX = screenLeft - S * 0.14; // the art's cut edge always stays off screen
		const restY = stacked ? -wolfH * 0.5 : BOARD_SIZES.height * 0.45;
		const offX = restX - 900 * k - S * 0.4;
		const m = wolf.m;
		wolf.begin(wolfH, S, 'peek', reduced);
		m.y = restY;

		// where the blow leaves his lips once he has snapped forward (pose 'blow', held)
		const blowX = restX + S * 0.05;
		// the Golden Dragon's blow-key mouth (ART-B handoff §4: blow 604,306; the donor wolf's was 700 / 26)
		const mouthX = blowX + (176 + (604 - 176) * 1.05) * k;
		const mouthY = restY + 70 * k;

		if (reduced) {
			// no travel, no squash, no wind: he fades in, the keys dissolve, the hats fade onto their cells
			m.x = restX;
			m.alpha = 0;
			wolf.settle();
			cue('wolf_peek');
			await to(m, { alpha: 1 }, 180, easeOut);
			if (!alive()) return;
			cue(isTurbo() ? 'wolf_inhale_turbo' : 'wolf_inhale');
			wolf.setPose('inhale', 160);
			await wait(260);
			if (!alive()) return;
			wolf.setPose('blow', 160);
			cue(isTurbo() ? 'wolf_huff_turbo' : 'wolf_huff');
			cue('gust_sweep');
		} else {
			// PEEK
			m.x = offX;
			m.rot = 0.12;
			wolf.settle();
			cue('wolf_peek');
			edgeDust(screenLeft, restY, wolfH);
			void to(m, { rot: -0.035 }, 420, easeOut);
			await to(m, { x: restX }, 420, easeOutBack);
			if (!alive()) return;
			// the sly beat: a small nod while the ears finish settling
			await to(m, { rot: 0.04, sx: 1.025, sy: 0.98 }, 210, easeInOut);
			if (!alive()) return;

			// DIP (anticipation)
			mark('gust', 'dip');
			await to(m, { x: restX + S * 0.04, sx: 1.07, sy: 0.92, rot: 0.085 }, 150, easeInOut);
			if (!alive()) return;

			// INHALE
			mark('gust', 'inhale');
			cue(isTurbo() ? 'wolf_inhale_turbo' : 'wolf_inhale');
			wolf.setPose('inhale', 85);
			wolf.mouth('inhale', pt);
			suction(pt.x - S * 0.15, pt.y, 0.5);
			await to(m, { sx: 0.95, sy: 1.1, rot: 0 }, 90, easeOut); // the mouth opens on a stretch
			if (!alive()) return;
			void to(m, { tremble: 0.4 }, 470, easeIn);
			await to(m, { sx: 1.1, sy: 1.13, x: restX - S * 0.2, rot: -0.115, skew: -0.035 }, 470, easeInOut);
			if (!alive()) return;

			// CHEEKS FULL
			mark('gust', 'full');
			wolf.setPose('huff', 80);
			await to(m, { sx: 1.18, sy: 1.01 }, 80, easeOut); // the mouth shuts on a squash
			if (!alive()) return;
			await to(m, { sx: 1.13, sy: 1.09, x: restX - S * 0.27, rot: -0.14, tremble: 1, flush: 1 }, 250, easeOut);
			if (!alive()) return;

			// BLOW
			mark('gust', 'blow');
			cue(isTurbo() ? 'wolf_huff_turbo' : 'wolf_huff');
			cue('gust_sweep');
			wolf.setPose('blow', 60);
			windVolley(mouthX, mouthY, Math.max(0, hats.length - 1) * 0.17 + 0.42); // particle time already runs at turbo speed
			await to(m, { x: blowX + S * 0.03, sx: 1.22, sy: 0.87, rot: 0.08, skew: 0, tremble: 0.55, flush: 0.4 }, 105, easeOut);
			if (!alive()) return;
			void to(m, { x: blowX, sx: 1.05, sy: 0.97, rot: 0.045, tremble: 0.32, flush: 0 }, 260, easeOutBack);
		}

		/** trigger: spent, satisfied, gone. miss: slinks off in the pose he is in. */
		const leave = async (ms: number, smug: boolean) => {
			if (reduced) {
				await to(m, { alpha: 0 }, 160, easeIn);
			} else {
				if (smug) {
					wolf?.setPose('peek', 120);
					await to(m, { x: restX - S * 0.06, sx: 0.97, sy: 1.035, rot: -0.06, tremble: 0 }, 130, easeOut);
					if (!alive()) return;
				}
				void to(m, { rot: 0.1, sx: 1, sy: 1 }, ms, easeInOut);
				await to(m, { x: offX }, ms, easeInBack);
			}
			if (alive()) wolf?.hide();
		};

		await wait(140);
		if (!alive()) return;
		mark('gust', 'hats');
		const flights = Promise.all(
			hats.map((hat, i) => wait(i * 170).then(() => (alive() ? flyHat(hat, mouthX, mouthY, 560, SYMBOL_SIZE * 0.9) : undefined))),
		);
		if (triggers) {
			// job done: he holds the blow until the last hat has left his lips, then ducks out while
			// the hats are still riding the gust
			await wait(Math.max(380, (hats.length - 1) * 170 + 90));
			if (!alive()) return;
			void leave(420, true);
			await flights;
			if (!alive()) return;
			mark('gust', 'celebrate');
			cue('trigger_fanfare');
			await celebrateHats();
		} else {
			await flights;
			if (!alive()) return;
			mark('gust', 'defeated');
			cue('wolf_defeated');
			if (reduced) {
				wolf.setPose('defeated', 160);
				await wait(620);
			} else {
				// deflate -> slump -> shrug (620 ms, the length of the old held still)
				wolf.setPose('defeated', 110);
				void to(m, { tremble: 0 }, 90);
				await to(m, { sx: 1.1, sy: 0.85, rot: 0.02 }, 90, easeOut);
				if (!alive()) return;
				await to(m, { sx: 1, sy: 1, rot: 0.13, y: restY + S * 0.1, x: restX - S * 0.05 }, 260, easeOutBack);
				if (!alive()) return;
				await to(m, { sx: 0.97, sy: 1.065, rot: 0.06, y: restY + S * 0.03 }, 130, easeOut);
				if (!alive()) return;
				await to(m, { sx: 1, sy: 1, rot: 0.14, y: restY + S * 0.11 }, 140, easeInOut);
			}
			if (!alive()) return;
			await leave(360, false);
		}
		if (alive()) mark('idle');
	};

	// ---- LANTERN CART (donor: HARD HAT DELIVERY) -----------------------------------------------
	let callSign: PIXI.Container | undefined;
	const deliveryCall = async (golden: boolean) => {
		clearAll();
		const gen = generation;
		cue(golden ? 'delivery_whistle_gold' : 'delivery_whistle');

		// site sign: hazard plank with the call-out in the game's gold sign font
		const sign = new PIXI.Container();
		const label = new PIXI.BitmapText({
			text: MECHANIC.delivery.toUpperCase(), // donor "HARD HAT DELIVERY" (theme §5)
			style: { fontFamily: 'gold', fontSize: SYMBOL_SIZE * 0.36, align: 'center' },
		});
		label.anchor.set(0.5);
		const padX = SYMBOL_SIZE * 0.34;
		const w = label.width + padX * 2;
		const h = SYMBOL_SIZE * 0.68;
		const plank = new PIXI.Graphics()
			.roundRect(-w / 2, -h / 2, w, h, h * 0.22)
			.fill(golden ? 0x8a5a12 : 0x5b3716)
			.stroke({ color: INK, width: 7, alignment: 0 })
			.roundRect(-w / 2 + 9, -h / 2 + 9, w - 18, h - 18, h * 0.16)
			.stroke({ color: golden ? GOLD : 0xffb81c, width: 4 });
		sign.addChild(plank, label);
		sign.position.set(BOARD_SIZES.width / 2, -SYMBOL_SIZE * 1.4);
		signLayer.addChild(sign);
		callSign = sign;
		const restY = SYMBOL_SIZE * 0.34;
		await tween(prefersReducedMotion() ? 0 : 420, (p) => (sign.y = -SYMBOL_SIZE * 1.4 + (restY + SYMBOL_SIZE * 1.4) * easeOutBack(p)));
		if (gen !== generation) return;
		// a slow sway while the reels run
		void tween(6000, (p) => {
			if (gen === generation && !sign.destroyed) sign.rotation = Math.sin(p * Math.PI * 10) * 0.025;
		});
	};

	// The delivery (normal speed):
	//   descent   the load comes down swinging on its chain and arrives with speed: the chain takes
	//             the weight (overshoot + settle bounce), the sway decays, dust shakes off the crate
	//   rattle    two beats — something inside wants out — the second one bigger
	//   burst     closed -> squash -> the OPEN key on a stretch, with a flash, outlined plank splinters
	//             (spin + gravity), straw tufts and dust; the recoil kicks the chain
	//   hats      arc out exactly as before, the golden one last with its own gold pop
	//   hoist     the broken crate dips, then is hauled away while the hats are still in the air
	const crateImpact = (x: number, y: number, w: number) => {
		if (!fx) return;
		const ring = fx.take('ring');
		ring.x = x;
		ring.y = y;
		ring.d = 0.42;
		ring.s0 = 0.6;
		ring.s1 = (w / 80) * 1.9;
		ring.ky = 0.24;
		ring.alpha = 0.55;
		ring.fadeIn = 0;
		ring.fadeOut = 0.1;
		ring.node.tint = DUST;
		for (let i = 0; i < 7; i += 1) {
			const side = i / 6 - 0.5;
			const p = fx.take('puff');
			p.x = x + side * w * 0.9;
			p.y = y - rnd(0, S * 0.06);
			p.vx = side * S * 2.2;
			p.vy = rnd(S * 0.2, S * 0.7);
			p.drag = 2.6;
			p.d = rnd(0.45, 0.65);
			p.s0 = 0.3;
			p.s1 = rnd(0.7, 1.05);
			p.alpha = 0.5;
			p.fadeIn = 0.1;
			p.fadeOut = 0.3;
			p.node.tint = DUST;
		}
		for (let i = 0; i < 4; i += 1) {
			const p = fx.take('straw');
			p.x = x + rnd(-w * 0.4, w * 0.4);
			p.y = y;
			p.vx = rnd(-S * 0.6, S * 0.6);
			p.vy = rnd(0, S * 0.5);
			p.gravity = S * 6;
			p.vr = rnd(-8, 8);
			p.rot = rnd(0, 3);
			p.d = 0.6;
			p.fadeOut = 0.6;
		}
	};

	const crateShake = (x: number, y: number, w: number, amount: number) => {
		if (!fx) return;
		for (let i = 0; i < 3; i += 1) {
			const p = fx.take('puff');
			p.x = x + rnd(-w * 0.5, w * 0.5);
			p.y = y + rnd(-w * 0.35, w * 0.35);
			p.vx = rnd(-S, S) * amount;
			p.vy = rnd(-S * 0.6, S * 0.2);
			p.drag = 3;
			p.d = 0.4;
			p.s0 = 0.3;
			p.s1 = 0.9 * amount;
			p.alpha = 0.7;
			p.fadeOut = 0.3;
			p.node.tint = DUST;
		}
	};

	const crateBurst = (x: number, y: number) => {
		if (!fx) return;
		const flash = fx.take('flash');
		flash.x = x;
		flash.y = y;
		flash.d = 0.3;
		flash.s0 = 0.5;
		flash.s1 = 2.5;
		flash.vr = 1.4;
		flash.fadeIn = 0.04;
		flash.fadeOut = 0.22;
		const ring = fx.take('ring');
		ring.x = x;
		ring.y = y;
		ring.d = 0.4;
		ring.s0 = 0.7;
		ring.s1 = 3.4;
		ring.fadeIn = 0;
		ring.fadeOut = 0;
		ring.node.tint = CREAM;
		// outlined plank splinters: thrown hard, spinning, pulled down
		for (let i = 0; i < 13; i += 1) {
			const a = (i / 13) * Math.PI * 2 + rnd(-0.2, 0.2);
			const v = S * rnd(3.4, 6.6);
			const p = fx.take('plank');
			p.x = x + Math.cos(a) * S * 0.3;
			p.y = y + Math.sin(a) * S * 0.25;
			p.vx = Math.cos(a) * v;
			p.vy = Math.sin(a) * v * 0.8 - S * 2.6;
			p.gravity = S * 15;
			p.drag = 1.1;
			p.rot = a;
			p.vr = rnd(7, 17) * (i % 2 ? 1 : -1);
			p.d = rnd(0.7, 0.95);
			p.s0 = rnd(0.85, 1.4);
			p.s1 = p.s0 * 0.85;
			p.fadeIn = 0;
			p.fadeOut = 0.72;
		}
		for (let i = 0; i < 9; i += 1) {
			const a = -Math.PI / 2 + rnd(-1.5, 1.5);
			const v = S * rnd(1.6, 3.6);
			const p = fx.take('tuft');
			p.x = x + rnd(-S * 0.35, S * 0.35);
			p.y = y + rnd(-S * 0.15, S * 0.2);
			p.vx = Math.cos(a) * v;
			p.vy = Math.sin(a) * v;
			p.gravity = S * 4.2;
			p.drag = 2.4;
			p.rot = rnd(-0.8, 0.8);
			p.vr = rnd(-4, 4);
			p.d = rnd(0.7, 1.0);
			p.s0 = rnd(0.5, 0.85);
			p.s1 = p.s0 * 1.15;
			p.fadeIn = 0;
			p.fadeOut = 0.6;
			p.wobA = 4;
			p.wobF = 9;
			p.wobP = i;
		}
		for (let i = 0; i < 9; i += 1) {
			const a = rnd(0, Math.PI * 2);
			const p = fx.take(i < 6 ? 'puff' : 'straw');
			p.x = x;
			p.y = y;
			p.vx = Math.cos(a) * S * rnd(1.5, 3.2);
			p.vy = Math.sin(a) * S * rnd(1, 2.4) - S * 0.6;
			p.drag = i < 6 ? 3.4 : 1.4;
			p.gravity = i < 6 ? 0 : S * 8;
			p.vr = i < 6 ? 0 : rnd(-12, 12);
			p.d = rnd(0.5, 0.75);
			p.s0 = i < 6 ? 0.6 : 1;
			p.s1 = i < 6 ? rnd(1.8, 2.6) : 1;
			p.alpha = i < 6 ? 0.8 : 1;
			p.fadeIn = 0.05;
			p.fadeOut = 0.3;
			if (i < 6) p.node.tint = 0xf3e2b8;
		}
	};

	const delivery = async (hats: DropHat[], reelHats = 0) => {
		dropLanded = 0;
		dropBase = Math.max(0, Math.round(reelHats) || 0);
		// keep the call sign if it is up; drop everything else
		if (!crate) return;
		const gen = generation;
		const alive = () => gen === generation;
		const reduced = prefersReducedMotion();
		mark('delivery', 'descent');
		if (callSign && !callSign.destroyed) {
			const sign = callSign;
			const y0 = sign.y;
			void tween(300, (p) => {
				if (!sign.destroyed) {
					sign.y = y0 - SYMBOL_SIZE * 1.9 * easeInOut(p);
					sign.alpha = 1 - p;
				}
			}).then(() => !sign.destroyed && sign.destroy({ children: true }));
		}

		// Desktop / landscape boards fill the screen's height, so the load hangs IN FRONT of the top
		// of the board; in portrait there is sky above the board and it stops just over the frame.
		const sl = context.stateGameDerived.sceneLayout();
		const pxPerUnit = Math.max(0.01, sl.cell / SYMBOL_SIZE);
		const screenTop = -sl.reel.y / pxPerUnit;
		const hookToBox = crate.px(282 - 91);
		const hookToBottom = crate.px(384 - 91);
		const boxCy = sl.stacked ? Math.max(screenTop + S * 1.9, -S * 0.95) : S * 1.2;
		const hookStop = boxCy - hookToBox;
		const hookStart = screenTop - hookToBottom - S * 0.25;
		const tipY = hookStart - S * 1.4;
		const len0 = hookStart - tipY;
		const len1 = hookStop - tipY;
		const cm = crate.m;
		crate.begin({ cx: BOARD_SIZES.width / 2, tipY, len: reduced ? len1 : len0, boxW: CRATE_BOX_W, unit: S, reduced });
		crate.boxCentre(len1, pt);
		const boxX = pt.x;
		const boxY = pt.y;
		crate.burstPoint(len1, pt);
		const burstX = pt.x;
		const burstY = pt.y;

		cue('crane_swing');
		cue(isTurbo() ? 'delivery_drum_build_turbo' : 'delivery_drum_build');
		if (reduced) {
			cm.alpha = 0;
			await to(cm, { alpha: 1 }, 180, easeOut);
			if (!alive()) return;
			cue('crate_stop');
			await wait(260);
			if (!alive()) return;
			mark('delivery', 'burst');
			cue('crate_burst');
			await to(cm, { alpha: 0.2 }, 90, easeIn);
			if (!alive()) return;
			crate.showOpen();
			void to(cm, { alpha: 1 }, 110, easeOut);
		} else {
			// DESCENT: arrives with speed (the ease keeps half its velocity to the end) and swinging
			crate.setSwing(0.085);
			const drop = len1 - len0;
			const arrive = (p: number) => 0.5 * p + 0.5 * easeOut(p);
			await tween(900, (p) => (cm.len = len0 + drop * arrive(p)));
			if (!alive()) return;
			// STOP: the chain takes the weight — overshoot, settle bounce, a kick of swing
			mark('delivery', 'stop');
			cue('crate_stop');
			crate.kick(0.16, 1.1, Math.min(S * 2.4, (drop * 0.5) / 0.9));
			void to(cm, { sx: 1.07, sy: 0.93 }, 90, easeOut).then(() => (alive() ? to(cm, { sx: 1, sy: 1 }, 240, easeOutBack) : undefined));
			crateImpact(boxX, boxY + crate.px(88), CRATE_BOX_W);
			await wait(330);
			if (!alive()) return;
			// RATTLE x2
			mark('delivery', 'rattle');
			crate.rattle(1);
			crateShake(boxX, boxY, CRATE_BOX_W, 0.8);
			await to(cm, { sx: 1.05, sy: 0.955 }, 60, easeOut);
			await to(cm, { sx: 1, sy: 1 }, 80, easeInOut);
			await wait(110);
			if (!alive()) return;
			crate.rattle(1.7);
			crate.kick(0, -0.9, -S * 0.5);
			crateShake(boxX, boxY, CRATE_BOX_W, 1.2);
			await to(cm, { sx: 0.94, sy: 1.1 }, 70, easeOut); // the lid bulges
			await to(cm, { sx: 1, sy: 1 }, 80, easeInOut);
			if (!alive()) return;
			// BURST: closed -> squash -> OPEN on a stretch
			mark('delivery', 'burst');
			await to(cm, { sx: 1.2, sy: 0.78 }, 85, easeIn);
			if (!alive()) return;
			cue('crate_burst');
			crate.showOpen();
			cm.sx = 0.86;
			cm.sy = 1.3;
			crate.kick(-0.1, 1.5, -S * 1.7);
			crateBurst(burstX, burstY);
			void to(cm, { sx: 1, sy: 1 }, 320, easeOutBack);
		}

		// plain hats first, the golden one last so it owns its moment
		const ordered = [...hats].sort((a, b) => Number(!!a.golden) - Number(!!b.golden));
		const launchAt = (hat: DropHat, i: number) => i * 110 + (hat.golden ? 260 : 0);
		const lastLaunch = ordered.reduce((acc, hat, i) => Math.max(acc, launchAt(hat, i)), 0);
		mark('delivery', 'hats');
		const flights = Promise.all(
			ordered.map((hat, i) =>
				wait(launchAt(hat, i)).then(() => {
					if (!alive()) return;
					if (hat.golden) sparks(burstX, burstY, 12, S * 3.2, GOLD);
					return flyHat(hat, burstX, burstY, 520, SYMBOL_SIZE * 0.7);
				}),
			),
		);
		// HOIST: once the last hat is out, the wreck dips and is hauled away
		void wait(lastLaunch + 170).then(async () => {
			if (!alive()) return;
			mark('delivery', 'hoist');
			if (reduced) {
				await to(cm, { alpha: 0 }, 160, easeIn);
			} else {
				await to(cm, { len: len1 + S * 0.07 }, 130, easeInOut);
				if (!alive()) return;
				await to(cm, { len: len0 - S * 0.4 }, 460, easeIn);
			}
			if (alive()) crate?.hide();
		});
		await flights;
		if (!alive()) return;
		mark('delivery', 'celebrate');
		cue('trigger_fanfare');
		await celebrateHats();
		if (alive()) mark('idle');
	};

	context.eventEmitter.subscribeOnMount({
		featureGust: async ({ hats, triggers, reelHats }) => {
			if (root) await gust(hats, triggers, reelHats);
		},
		featureDeliveryCall: ({ golden }) => {
			if (root) void deliveryCall(golden);
		},
		featureDelivery: async ({ hats, reelHats }) => {
			if (root) await delivery(hats, reelHats);
		},
		wayWinPop: ({ positions, amount }) => wayWinPop(positions, amount),
		featureDropsClear: ({ delayMs }) => {
			const gen = generation;
			if (!delayMs) clearAll();
			else setTimeout(() => gen === generation && clearAll(), delayMs);
		},
	});

	/** Put every key pose on the GPU ahead of time, so no pose change ever uploads mid-performance. */
	let warmed = false;
	const warm = () => {
		if (warmed || !wolf || !crate) return;
		const renderer = app.stateApp.pixiApplication?.renderer as unknown as
			| { texture?: { initSource?: (source: unknown) => void } }
			| undefined;
		let all = true;
		for (const key of [...wolf.warmKeys(), ...crate.warmKeys()]) {
			const tex = texture(key);
			if (tex === PIXI.Texture.EMPTY) {
				all = false;
				continue;
			}
			try {
				renderer?.texture?.initSource?.(tex.source);
			} catch {
				/* the first draw uploads it instead */
			}
		}
		warmed = all;
	};

	onMount(() => {
		if (!root) return;
		fxBack = new PIXI.Container();
		hatLayer = new PIXI.Container();
		actorLayer = new PIXI.Container();
		signLayer = new PIXI.Container();
		fxFront = new PIXI.Container();
		popLayer = new PIXI.Container();
		fx = createFxPool(fxBack, fxFront);
		wolf = createWolf(texture);
		crate = createCrate(texture);
		crate.prepare(CRATE_BOX_W);
		actorLayer.addChild(signLayer, crate.root, wolf.root);
		root.addChild(fxBack, hatLayer, actorLayer, fxFront, popLayer);
		warm();
		const warmTimer = setInterval(() => (warmed ? clearInterval(warmTimer) : warm()), 1500);
		const ticker = app.stateApp.pixiApplication?.ticker;
		ticker?.add(tick);
		return () => {
			clearInterval(warmTimer);
			ticker?.remove(tick);
			clearAll();
			fx?.destroy();
			wolf?.root.destroy({ children: true });
			crate?.root.destroy({ children: true });
			fx = undefined;
			wolf = undefined;
			crate = undefined;
		};
	});
</script>

<!-- Same transform as BoardContainer: everything here is laid out in board units. -->
<Container
	x={context.stateGameDerived.boardLayout().x}
	y={context.stateGameDerived.boardLayout().y}
	scale={context.stateGameDerived.boardLayout().zoomScale}
	pivot={context.stateGameDerived.boardLayout().pivot}
>
	<Grab ongrab={(node) => (root = node)} />
</Container>
