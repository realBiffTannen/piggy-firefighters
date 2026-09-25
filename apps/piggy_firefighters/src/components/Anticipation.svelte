<script lang="ts">
	// REEL ANTICIPATION — "the alarm is ringing" (contract §4: after 2 alarms have landed with reels still
	// to stop, the remaining reels slow with the tension cue; never on a spin that cannot trigger).
	//
	// When a reel is held for a possible 3rd alarm the whole column is framed in the SAME gold frame a
	// winning symbol wears (`win_cell_frame`, placeholder static/assets/placeholder/fx/cell_frame.webp,
	// see components/SymbolSprite.svelte `ensureWinDressing`): one border language for "this matters".
	// The frame is a nine-slice so the corners keep the size they have on a single cell while the bars
	// stretch over three rows. Under it: a warm alarm-light wash over the symbols and embers rising up
	// the column (placeholder dressing; the art lane owns the final alarm-light treatment). The longer the reel holds, the hotter the frame and the brighter the wash, and the
	// board itself pushes in (game/reels/anticipationCamera.svelte.ts). When the reel stops it resolves
	// honestly: a gold flash if the bonus was actually reached, a quick neutral fade if not — nothing
	// here ever hints at an outcome the book does not contain.
	//
	// Built imperatively on the live PIXI container (see scene/Grab.svelte) and driven from ONE ticker
	// callback, so there are no 60 Hz reactive props. Reduced motion: a still frame, no sparks.
	import { onMount } from 'svelte';
	import { Container, PIXI, getContextApp } from 'pixi-svelte';

	import Grab from './scene/Grab.svelte';
	import { getContext } from '../game/context';
	import { gameSound } from '../game/audio';
	import type { Reel } from '../game/stateGame.svelte';
	import { BOARD_SIZES, REEL_PADDING, SYMBOL_SIZE, TRIGGER_ALARMS } from '../game/constants';
	import { prefersReducedMotion, isTurbo } from '../game/fx/timing';
	import { sceneTex } from '../game/fx/sceneTextures.svelte';

	type Props = {
		reel: Reel;
		oncomplete: () => void;
	};

	const props: Props = $props();
	const context = getContext();
	const app = getContextApp();

	const AMBER = 0xffb81c;
	const GOLD = 0xffd75a;
	/** the frame at rest — white leaves the gold art its own colour; it heats toward AMBER on tension */
	const FRAME_COOL = 0xffffff;

	const COL_W = SYMBOL_SIZE;
	const COL_H = SYMBOL_SIZE * 3;
	const BORDER = SYMBOL_SIZE * 0.075;
	const RADIUS = SYMBOL_SIZE * 0.1;

	/** cell_frame.webp is 384 square; its corner block is ~100 px of that. */
	const FRAME_SRC = 384;
	const FRAME_CORNER = 100;

	let root: PIXI.Container | undefined;
	let stopped = false;
	const alarmsAtStart = context.stateGame.scatterCounter;
	// Snapshotted the instant THIS reel stops: the reveal handler zeroes the live counter moments later.
	let alarmsAtStop = alarmsAtStart;
	let laterReelAlive = false;

	$effect(() => {
		if (props.reel.reelState.motion === 'stopped' && !stopped) {
			alarmsAtStop = context.stateGame.scatterCounter;
			// is the chance still alive on a later reel? (still moving, or itself held). Also keeps a slam-stop,
			// where several held reels stop together, from resolving once per reel.
			laterReelAlive = context.stateGame.board.some(
				(r) => r.reelIndex > props.reel.reelIndex && (r.reelState.motion !== 'stopped' || r.reelState.anticipating),
			);
			stopped = true;
		}
	});

	// Soft round spark, also generated once.
	const makeSparkTexture = () => {
		const size = 32;
		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext('2d')!;
		const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
		g.addColorStop(0, 'rgba(255,255,255,1)');
		g.addColorStop(0.35, 'rgba(255,215,90,0.9)');
		g.addColorStop(1, 'rgba(255,160,20,0)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, size, size);
		return PIXI.Texture.from(canvas);
	};

	// Vertical alarm-light gradient: hot orange at the foot, gone by the top third.
	const makeWashTexture = () => {
		const canvas = document.createElement('canvas');
		canvas.width = 8;
		canvas.height = 128;
		const ctx = canvas.getContext('2d')!;
		const g = ctx.createLinearGradient(0, 128, 0, 0);
		g.addColorStop(0, 'rgba(255,150,20,1)');
		g.addColorStop(0.45, 'rgba(255,120,10,0.45)');
		g.addColorStop(1, 'rgba(255,100,0,0.08)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 8, 128);
		return PIXI.Texture.from(canvas);
	};

	/** channel-wise blend of two packed RGB colours, `k` of `b` over `a`. */
	const mixTint = (a: number, b: number, k: number) => {
		const t = k < 0 ? 0 : k > 1 ? 1 : k;
		const r = ((a >> 16) & 0xff) + (((b >> 16) & 0xff) - ((a >> 16) & 0xff)) * t;
		const g = ((a >> 8) & 0xff) + (((b >> 8) & 0xff) - ((a >> 8) & 0xff)) * t;
		const bl = (a & 0xff) + ((b & 0xff) - (a & 0xff)) * t;
		return ((r << 16) | (g << 8) | bl) & 0xffffff;
	};

	const ringPath = (g: PIXI.Graphics, grow: number) =>
		g
			.roundRect(-COL_W / 2 - grow, -COL_H / 2 - grow, COL_W + grow * 2, COL_H + grow * 2, RADIUS + grow)
			.fill(0xffffff)
			.roundRect(-COL_W / 2 + BORDER, -COL_H / 2 + BORDER, COL_W - BORDER * 2, COL_H - BORDER * 2, RADIUS * 0.6)
			.cut();

	onMount(() => {
		if (!root) return;
		const reduced = prefersReducedMotion();
		const sparkTexture = makeSparkTexture();

		// alarm-light wash over the symbols: a warm light pooled at the foot of the column, fading up
		// (a flat additive fill reads as grey fog on the navy cells)
		const washTexture = makeWashTexture();
		const wash = new PIXI.Sprite(washTexture);
		wash.anchor.set(0.5);
		wash.width = COL_W - BORDER * 2;
		wash.height = COL_H - BORDER * 2;
		wash.blendMode = 'add';
		wash.alpha = 0;

		// THE GOLD FRAME, the same art a winning cell wears. Nine-slice: the corners are pinned at their
		// source size and only the four bars stretch, so a three-row column keeps a single cell's
		// bolt-and-bracket proportions. Built at texture scale and scaled down as a unit — `plateScale`
		// makes one source width equal one column width, exactly as on a winning symbol.
		const plateScale = COL_W / FRAME_SRC;
		const frameTexture = sceneTex('win_cell_frame');
		const plate = frameTexture
			? new PIXI.NineSliceSprite({
					texture: frameTexture,
					leftWidth: FRAME_CORNER,
					topHeight: FRAME_CORNER,
					rightWidth: FRAME_CORNER,
					bottomHeight: FRAME_CORNER,
				})
			: undefined;
		if (plate) {
			plate.width = FRAME_SRC;
			plate.height = COL_H / plateScale;
			plate.scale.set(plateScale);
			plate.position.set(-COL_W / 2, -COL_H / 2);
			plate.tint = FRAME_COOL;
		}

		// outer glow that breathes with the wash
		const glow = ringPath(new PIXI.Graphics(), SYMBOL_SIZE * 0.05);
		glow.tint = AMBER;
		glow.blendMode = 'add';
		glow.alpha = 0;
		glow.filters = [new PIXI.BlurFilter({ strength: 10, quality: 2 })];

		// resolve flash
		const flash = new PIXI.Graphics().roundRect(-COL_W / 2, -COL_H / 2, COL_W, COL_H, RADIUS).fill(GOLD);
		flash.blendMode = 'add';
		flash.alpha = 0;

		const frame = new PIXI.Container();
		if (plate) frame.addChild(plate);

		const sparks = new PIXI.Container();
		type Spark = { sprite: PIXI.Sprite; vx: number; vy: number; life: number; max: number };
		const pool: Spark[] = [];
		if (!reduced) {
			for (let i = 0; i < 16; i += 1) {
				const sprite = new PIXI.Sprite(sparkTexture);
				sprite.anchor.set(0.5);
				sprite.blendMode = 'add';
				sprite.visible = false;
				sparks.addChild(sprite);
				pool.push({ sprite, vx: 0, vy: 0, life: 0, max: 0 });
			}
		}
		const spawn = (s: Spark) => {
			const side = Math.random() < 0.5 ? -1 : 1;
			s.sprite.x = side * (COL_W / 2 - BORDER * 0.5);
			s.sprite.y = COL_H / 2 - Math.random() * COL_H * 0.25;
			s.vx = -side * (0.01 + Math.random() * 0.03) * SYMBOL_SIZE;
			s.vy = -(0.18 + Math.random() * 0.22) * SYMBOL_SIZE;
			s.max = 700 + Math.random() * 600;
			s.life = s.max;
			s.sprite.visible = true;
		};

		root.addChild(glow, wash, frame, sparks, flash);
		gameSound.anticipationRiser(alarmsAtStart);

		const IN_MS = 240;
		const OUT_HIT_MS = 420;
		const OUT_MISS_MS = 220;
		let age = 0;
		let outAge = -1;
		let hit = false;
		let spawnClock = 0;
		let finished = false;

		const easeOutBack = (p: number) => {
			const c1 = 1.70158;
			const c3 = c1 + 1;
			return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
		};

		const tick = (tk: PIXI.Ticker) => {
			if (finished || !root) return;
			const dt = Math.min(50, tk.deltaMS) * (isTurbo() ? 1.6 : 1);
			age += dt;

			if (stopped && outAge < 0) {
				outAge = 0;
				// HONEST RESOLVE. The anticipation is FOR the bonus, so:
				//   hit   = the trigger is reached (three alarms);
				//   miss  = this was the last live reel and it was not reached: a short neutral release;
				//   carry = a later reel is still live: no resolve at all, the chance has not been decided yet.
				// An alarm that lands still gets its own ring and ladder rung (that is information); what a miss
				// never gets is a victory sting.
				hit = alarmsAtStop >= TRIGGER_ALARMS;
				if (hit || !laterReelAlive) gameSound.anticipationResolve(hit);
			}

			// tension ramps over the hold. Lengthened with the hold itself (owner, 2026-09-20: slower
			// anticipation) so the ramp still peaks near the end of a held reel rather than long before it.
			const tension = Math.min(1, age / 3200);
			const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(age / (170 - tension * 60));

			const pIn = Math.min(1, age / IN_MS);
			let alpha = pIn;
			let scale = reduced ? 1 : 1.14 - 0.14 * easeOutBack(pIn);

			if (outAge >= 0) {
				outAge += dt;
				const outMs = hit ? OUT_HIT_MS : OUT_MISS_MS;
				const pOut = Math.min(1, outAge / outMs);
				alpha = 1 - pOut;
				if (hit) {
					flash.alpha = Math.max(0, 0.75 * (1 - pOut * 1.6));
					if (!reduced) scale = 1 + 0.06 * Math.sin(Math.min(1, pOut * 2) * Math.PI);
				}
				if (pOut >= 1) {
					finished = true;
					props.oncomplete();
					return;
				}
			}

			frame.alpha = alpha;
			frame.scale.set(scale);
			// the frame heats toward amber as the hold runs on, and breathes with the pulse
			if (plate) plate.tint = mixTint(FRAME_COOL, AMBER, (0.25 + 0.4 * tension) * (0.55 + 0.45 * pulse));
			glow.alpha = alpha * (0.35 + 0.35 * pulse + 0.2 * tension);
			glow.scale.set(scale);
			wash.alpha = alpha * (0.22 + 0.16 * pulse + 0.2 * tension);

			if (!reduced) {
				spawnClock -= dt;
				if (outAge < 0 && spawnClock <= 0) {
					const free = pool.find((s) => s.life <= 0);
					if (free) spawn(free);
					spawnClock = 150 - tension * 90;
				}
				for (const s of pool) {
					if (s.life <= 0) continue;
					s.life -= dt;
					const k = Math.max(0, s.life / s.max);
					s.sprite.x += (s.vx * dt) / 1000;
					s.sprite.y += (s.vy * dt) / 1000;
					s.sprite.alpha = alpha * k;
					s.sprite.scale.set((0.35 + 0.5 * k) * (SYMBOL_SIZE / 160));
					if (s.life <= 0) s.sprite.visible = false;
				}
			}
		};

		const ticker = app.stateApp.pixiApplication?.ticker;
		ticker?.add(tick);

		return () => {
			ticker?.remove(tick);
			root?.removeChildren().forEach((child: PIXI.ContainerChild) => child.destroy({ children: true }));
			washTexture.destroy(true);
			sparkTexture.destroy(true);
		};
	});
</script>

<!-- Same transform as BoardContainer, so the frame tracks the fitted board at every viewport size. -->
<Container
	x={context.stateGameDerived.boardLayout().x}
	y={context.stateGameDerived.boardLayout().y}
	scale={context.stateGameDerived.boardLayout().zoomScaleXY}
	pivot={context.stateGameDerived.boardLayout().pivot}
>
	<Container x={(props.reel.reelIndex + REEL_PADDING) * SYMBOL_SIZE} y={BOARD_SIZES.height / 2}>
		<Grab ongrab={(node) => (root = node)} />
	</Container>
</Container>
