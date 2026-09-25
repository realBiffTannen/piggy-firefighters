<script lang="ts">
	// ONE REEL SYMBOL, drawn and moved imperatively.
	//
	// The display objects are built once on the live PIXI container and every frame of motion is
	// written straight onto them from the board's ONE ticker (game/reels/boardTicker.ts): no reactive
	// prop changes at 60 Hz, no allocation while a motion plays, nothing created or uploaded mid-motion
	// (the win dressing is built the first time THIS symbol wins, before its first moving frame).
	//
	//   land  the material's answer to the reel's impact (game/symbolMotion.ts)
	//   win   gold cell frame + the material flourish + a crossing glint; the four high symbols cut to
	//         their second key pose through a squash; the WILD only punches and settles here: its
	//         banner flash ("I substituted") is drawn over the cell by components/BoardFx.svelte
	//   idle  only while the base board is idle: a 2–4 % hop / tilt / breathe every 3–7 s per symbol,
	//         on its own clock and never starting together with a neighbour
	//
	// Turbo / Super Turbo shorten land and win; reduced motion replaces them with a brief fade and
	// switches idle off.
	import { onMount, untrack } from 'svelte';
	import { Container, PIXI, getContextApp } from 'pixi-svelte';

	import Grab from './scene/Grab.svelte';
	import { getSymbolInfo } from '../game/utils';
	import { getContext } from '../game/context';
	import { SYMBOL_SIZE } from '../game/constants';
	import type { SymbolState } from '../game/types';
	import { prefersReducedMotion, isTurbo } from '../game/fx/timing';
	import { sceneTex } from '../game/fx/sceneTextures.svelte';
	import { cellFrame } from '../game/artMeta';
	import {
		symbolMotion,
		idleMotion,
		poseBKey,
		restTransform,
		resetTransform,
		IDLE_KINDS,
		WILD_BANNER,
		type Motion,
	} from '../game/symbolMotion';
	import { speedFactor } from '../game/stateSpeed.svelte';
	import { boardTicker } from '../game/reels/boardTicker';
	import { boardLife } from '../game/reels/boardLife';

	type Props = {
		x?: number;
		y?: number;
		symbolInfo: ReturnType<typeof getSymbolInfo>;
		oncomplete?: () => void;
		/** The reel-symbol state that drives land / win motion. */
		state?: SymbolState;
		/** Symbol id (H1…L4/ALARM/GALARM/W) — picks the material-specific motion. */
		symbolName?: string;
		/** Extra emphasis on an ALARM landing that helps trigger the feature (3+). */
		emphasis?: boolean;
		/** A row outside the window: it is never seen at rest, so it neither lands nor idles. */
		quiet?: boolean;
		/** false = this instance is the hidden twin on the other board: it does nothing at all */
		active?: boolean;
	};

	const props: Props = $props();
	const app = getContextApp();

	const DEG = Math.PI / 180;
	// The WILD badge crop on the square tile (= symbolMotion WILD_BANNER.square, the art lane's measured rect).
	// Unused while symbolMotion `W` keeps flash = 0: the WILD flashes its badge via BoardFx + WILD_BANNER instead.
	const SIGN = { x: WILD_BANNER.square.x, y: WILD_BANNER.square.y, w: WILD_BANNER.square.w, h: WILD_BANNER.square.h, art: WILD_BANNER.square.artW };
	const IDLE_FIRST_MS = [700, 4200]; // the board comes alive soon after it settles ...
	const IDLE_EVERY_MS = [3000, 7000]; // ... then each symbol reacts every 3–7 s
	const IDLE_MIN_GAP_MS = 240; // no two reactions start together
	const IDLE_MAX_ACTIVE = 3; // of 15 symbols: alive, not fidgeting

	/* eslint-disable @typescript-eslint/no-explicit-any */
	const tex = (key: string | undefined): PIXI.Texture | undefined =>
		key ? ((app.stateApp.loadedAssets as any)?.[key] ?? untrack(() => sceneTex(key))) : undefined;

	let root: PIXI.Container | undefined;
	let body: PIXI.Container | undefined;
	let sprite: PIXI.Sprite | undefined;
	// the gold win frame is a nine-slice (cells.meta.json corner), so a 1:1.3 stacked cell keeps round bolts
	let frame: PIXI.NineSliceSprite | undefined;
	const WIN_FRAME = cellFrame('win');
	let glint: PIXI.Sprite | undefined;
	let flash: PIXI.Sprite | undefined;
	let ring: PIXI.Graphics | undefined;

	let texA: PIXI.Texture | undefined;
	let texB: PIXI.Texture | undefined;
	let shownPose: 0 | 1 = 0;
	let baseW = SYMBOL_SIZE;
	let baseH = SYMBOL_SIZE;

	// PORTRAIT ROW PITCH. BoardContainer stretches the board so rows are `rowPitch` taller than
	// wide (stateGame ROW_PITCH_STACKED); this sprite's own container counter-scales by 1/pitch
	// so the art is never distorted, and the win frame is drawn `pitch` tall to cover the cell.
	const context = getContext();
	const pitch = $derived(context.stateGameDerived.sceneLayout().rowPitch);
	let pitchNow = 1;
	$effect(() => {
		pitchNow = pitch;
	});

	const t = restTransform();
	type Mode = 'rest' | 'land' | 'win' | 'idle' | 'fade';
	let mode: Mode = 'rest';
	let motion: Motion | undefined;
	let elapsed = 0;
	let duration = 0;
	let done: (() => void) | undefined;
	let nextIdleAt = 0;
	let isGolden = false;

	const build = (node: PIXI.Container) => {
		root = node;
		body = new PIXI.Container();
		sprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
		sprite.anchor.set(0.5);
		body.addChild(sprite);
		root.addChild(body);
	};

	const fit = (s: PIXI.Sprite, w: number, h: number) => {
		const tw = s.texture.width || 1;
		const th = s.texture.height || 1;
		s.scale.set(w / tw, h / th);
	};

	const showPose = (pose: 0 | 1) => {
		if (!sprite || pose === shownPose) return;
		const next = pose === 1 ? texB : texA;
		if (!next) return;
		shownPose = pose;
		sprite.texture = next;
		fit(sprite, baseW, baseH);
	};

	/** Built the first time this symbol wins — before its first moving frame, never during one. */
	const ensureWinDressing = (isWild: boolean) => {
		if (!root || !body) return;
		if (!frame) {
			const ft = tex('win_cell_frame');
			if (ft) {
				frame = new PIXI.NineSliceSprite({ texture: ft, leftWidth: WIN_FRAME.corner, topHeight: WIN_FRAME.corner, rightWidth: WIN_FRAME.corner, bottomHeight: WIN_FRAME.corner });
				frame.visible = false;
				root.addChildAt(frame, 0);
			}
		}
		if (!glint) {
			const gt = tex('rung_fx_glint_4point');
			if (gt) {
				glint = new PIXI.Sprite(gt);
				glint.anchor.set(0.5);
				glint.blendMode = 'add';
				glint.visible = false;
				root.addChild(glint);
			}
		}
		if (isWild && !flash && texA && Math.abs(texA.height / Math.max(1, texA.width) - 1) < 0.05) {
			const k = texA.width / SIGN.art;
			const signTex = new PIXI.Texture({
				source: texA.source,
				frame: new PIXI.Rectangle(texA.frame.x + SIGN.x * k, texA.frame.y + SIGN.y * k, SIGN.w * k, SIGN.h * k),
			});
			flash = new PIXI.Sprite(signTex);
			flash.anchor.set(0.5);
			flash.blendMode = 'add';
			flash.tint = 0xfff0b0;
			flash.visible = false;
			body.addChild(flash);
		}
	};

	const ensureRing = () => {
		if (ring || !root) return;
		ring = new PIXI.Graphics();
		ring.circle(0, 0, 50).stroke({ color: 0xffd75a, width: 5 });
		for (let i = 0; i < 8; i += 1) {
			const a = (i / 8) * Math.PI * 2 + 0.2;
			ring
				.moveTo(Math.cos(a) * 60, Math.sin(a) * 60)
				.lineTo(Math.cos(a) * 76, Math.sin(a) * 76)
				.stroke({ color: 0xfff4c2, width: 3.5, cap: 'round' });
		}
		ring.visible = false;
		root.addChildAt(ring, 0);
	};

	const apply = () => {
		if (!body) return;
		body.position.set(t.ox, t.oy);
		body.rotation = t.rot * DEG;
		body.scale.set(t.sx, t.sy);
		body.alpha = t.alpha;
		showPose(t.pose);
		if (flash) {
			const on = t.flash > 0.01;
			flash.visible = on;
			if (on) {
				flash.alpha = t.flash * 0.8;
				flash.position.set(
					((SIGN.x + SIGN.w / 2 - SIGN.art / 2) * baseW) / SIGN.art,
					((SIGN.y + SIGN.h / 2 - SIGN.art / 2) * baseH) / SIGN.art,
				);
				const k = (baseW / SIGN.art) * (1 + 0.05 * t.flash);
				flash.scale.set((SIGN.w * k) / flash.texture.width, (SIGN.h * k) / flash.texture.height);
			}
		}
	};

	const dress = (p: number) => {
		// WIN dressing, same for every payer: a gold cell frame swells in under the symbol and holds
		// while it performs, then a four-point glint crosses it top-left to bottom-right (the game's light).
		if (frame) {
			const live = mode === 'win' && p > 0 && p < 1;
			frame.visible = live;
			if (live) {
				const inP = Math.min(1, p / 0.18);
				const outP = p < 0.82 ? 0 : (p - 0.82) / 0.18;
				const pop = 1 + 0.08 * Math.sin(Math.PI * inP);
				frame.alpha = inP * (1 - outP);
				// built at texture scale (the corner blocks keep their bolts), scaled to the cell as a unit
				const k = (SYMBOL_SIZE * 1.02 * pop) / WIN_FRAME.w;
				frame.width = WIN_FRAME.w;
				frame.height = (WIN_FRAME.w * pitchNow);
				frame.scale.set(k);
				frame.position.set((-WIN_FRAME.w * k) / 2, (-WIN_FRAME.w * pitchNow * k) / 2);
			}
		}
		if (glint) {
			const live = mode === 'win' && p > 0.22 && p < 0.62;
			glint.visible = live;
			if (live) {
				const g = (p - 0.22) / 0.4;
				const s = Math.sin(Math.PI * g);
				glint.position.set((g - 0.5) * baseW * 0.7, (g - 0.5) * baseH * 0.7);
				glint.rotation = g * 90 * DEG;
				glint.alpha = s;
				fit(glint, baseW * (0.35 + 0.4 * s), baseW * (0.35 + 0.4 * s));
			}
		}
		if (ring) {
			// GOLDEN ALARM landing: a gold shock ring and eight glint rays burst from under the hat
			const live = mode === 'land' && isGolden && p > 0 && p < 1;
			ring.visible = live;
			if (live) {
				const e = 1 - Math.pow(1 - p, 3);
				ring.scale.set((baseW / 100) * (0.56 + 1.0 * e));
				ring.alpha = 1 - p;
			}
		}
	};

	const toRest = () => {
		if (mode === 'idle') boardLife.idleActive = Math.max(0, boardLife.idleActive - 1);
		mode = 'rest';
		motion = undefined;
		done = undefined;
		elapsed = 0;
		resetTransform(t);
		apply();
		dress(0);
	};

	const play = (next: Mode, m: Motion, durationMs: number, complete?: () => void) => {
		mode = next;
		motion = m;
		elapsed = 0;
		duration = Math.max(1, durationMs);
		done = complete;
	};

	const FADE: Motion = { durationMs: 130, sample: (p, o) => (o.alpha = 0.45 + 0.55 * p) };

	const rand = (range: number[]) => range[0] + Math.random() * (range[1] - range[0]);

	const update = (dt: number, now: number) => {
		if (props.active === false) return;
		if (mode === 'rest') {
			if (props.quiet || !boardLife.idle) {
				nextIdleAt = 0;
				return;
			}
			if (nextIdleAt === 0) {
				nextIdleAt = now + rand(IDLE_FIRST_MS);
				return;
			}
			if (now < nextIdleAt) return;
			if (now - boardLife.lastIdleStart < IDLE_MIN_GAP_MS || boardLife.idleActive >= IDLE_MAX_ACTIVE) {
				nextIdleAt = now + IDLE_MIN_GAP_MS + Math.random() * 500;
				return;
			}
			boardLife.lastIdleStart = now;
			nextIdleAt = now + rand(IDLE_EVERY_MS);
			const kind = IDLE_KINDS[Math.floor(Math.random() * IDLE_KINDS.length)];
			const m = idleMotion(kind, 0.02 + Math.random() * 0.02, Math.random() < 0.5 ? -1 : 1);
			play('idle', m, m.durationMs);
			boardLife.idleActive += 1;
			return;
		}
		if (!motion) return;
		// an idle reaction never outlives the idle board: it is wound up four times faster
		elapsed += mode === 'idle' && !boardLife.idle ? dt * 4 : dt;
		const p = Math.min(1, elapsed / duration);
		resetTransform(t);
		if (p < 1) motion.sample(p, t);
		apply();
		dress(p);
		if (p >= 1) {
			const complete = done;
			toRest();
			complete?.();
		}
	};

	// art + size follow the symbol (the same component instance shows whatever its reel row holds)
	$effect(() => {
		const key = props.symbolInfo.assetKey;
		const w = SYMBOL_SIZE * props.symbolInfo.sizeRatios.width;
		const h = SYMBOL_SIZE * props.symbolInfo.sizeRatios.height;
		const name = props.symbolName ?? '';
		// stacked layouts show the 1:1.3 portrait tile (`symT_*`, the art lane's tall sheet; game/assets.ts)
		const tallKey = context.stateGameDerived.sceneLayout().stacked ? key.replace(/^sym_/, 'symT_') : '';
		const rowPitch = pitch;
		untrack(() => {
			if (!sprite) return;
			const tall = tallKey ? tex(tallKey) : undefined;
			baseW = w;
			texA = tall ?? tex(key);
			// a tall tile keeps its own aspect, never taller than the cell it stands in
			baseH = tall ? h * Math.min(rowPitch, tall.height / Math.max(1, tall.width)) : h;
			// the pose-B key frame from the SAME sheet as pose A (both tiles share one size, so the cut never resizes)
			texB = tex(poseBKey(name, !!tall));
			isGolden = name === 'GALARM';
			shownPose = 0;
			sprite.texture = texA ?? PIXI.Texture.EMPTY;
			fit(sprite, baseW, baseH);
			if (flash && (name !== 'W' || tall)) {
				const signTex = flash.texture;
				flash.destroy();
				signTex.destroy(false); // the sub-frame only; the symbol art it points into stays
				flash = undefined;
			}
		});
	});

	// One animation per state entry. `static` / `spin` / `postWinStatic` are resting poses: reset and
	// complete at once. `land` and `win` play the material motion, then complete.
	$effect(() => {
		const state = props.state;
		const name = props.symbolName ?? '';
		const emphasis = props.emphasis;
		const complete = props.oncomplete;
		const quiet = props.quiet;
		const active = props.active !== false;

		untrack(() => {
			if (!active) {
				toRest(); // the hidden twin: silent, and it never completes anything
				return;
			}
			if ((state !== 'land' && state !== 'win') || (quiet && state === 'land')) {
				if (mode !== 'idle') toRest();
				complete?.();
				return;
			}
			if (prefersReducedMotion()) {
				toRest();
				play('fade', FADE, state === 'win' ? 150 : 110, complete);
				return;
			}
			if (state === 'win') ensureWinDressing(name === 'W');
			if (state === 'land' && name === 'GALARM') ensureRing();
			const m = symbolMotion(name, state, { emphasis, keyPose: !!texB });
			toRest();
			play(state, m, m.durationMs * (isTurbo() ? speedFactor() : 1), complete);
		});
	});

	onMount(() => {
		boardTicker.add(update);
		return () => {
			boardTicker.remove(update);
			if (mode === 'idle') boardLife.idleActive = Math.max(0, boardLife.idleActive - 1);
			// the pixi-svelte <Container> destroys `root`; its children are ours
			body?.destroy({ children: true });
			frame?.destroy();
			glint?.destroy();
			ring?.destroy();
			body = sprite = frame = glint = flash = ring = undefined;
		};
	});
</script>

<Container x={props.x ?? 0} y={props.y ?? 0} scale={{ x: 1, y: 1 / pitch }}>
	<Grab ongrab={build} />
</Container>
