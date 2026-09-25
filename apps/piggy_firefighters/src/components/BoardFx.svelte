<script lang="ts" module>
	export type EmitterEventBoardFx = {
		type: 'symbolWinFx';
		symbol: string;
		/** reveal positions (rows are padded by 1, like `winInfo`) */
		positions: { reel: number; row: number }[];
	};
</script>

<script lang="ts">
	// BOARD FX — the life on top of the reels.
	//
	// 1. WIN FX per symbol. A winning symbol does not just wiggle: it sheds something of its own (procedural bursts in
	//    the theme palette — the runtime's own particles per docs/ANIMATION_CONTRACT.md: brass sparks off the truck and
	//    helmet, water off the nozzle and bucket, embers off the axe). Each is a small burst of pooled shapes with gravity, drag and spin,
	//    timed to the symbol's own motion (game/symbolMotion.ts).
	//    THE WILD is a SUBSTITUTE, so a line that pays e.g. H4 names H4, not W: every WILD cell in a paying line
	//    performs as the wild — see 3. The alarms (ALARM / GALARM) pay nothing; their burst is the trigger
	//    celebration (rescueDirector.freeSpinTrigger fires it across the alarm cells as a left-to-right wave).
	// 2. IDLE LIFE. When the reels have been still for a moment a glint travels across one symbol at a
	//    time (top-left to bottom-right, the game's light), so the board is never a dead picture.
	// 3. WILD BANNER. While the WILD sprite plays its punch (game/symbolMotion.ts `W`), its WILD badge is
	//    cropped out of the very texture the reel shows (WILD_BANNER) and laid over it additively: it
	//    flashes gold on the punch and again on the settle (once in turbo), then a gold glint runs along
	//    it. Reduced motion: none of it (the symbol itself only fades).
	//
	// Imperative PIXI on the live container, ONE ticker callback, pooled Graphics (<= 90 live).
	import { onMount } from 'svelte';
	import { Container, PIXI, getContextApp } from 'pixi-svelte';

	import Grab from './scene/Grab.svelte';
	import { getContext } from '../game/context';
	import { REEL_PADDING, SYMBOL_SIZE } from '../game/constants';
	import { sceneTex } from '../game/fx/sceneTextures.svelte';
	import { featureOwnsInput } from '../game/rescue/stateRescue.svelte';
	import { prefersReducedMotion, isTurbo } from '../game/fx/timing';
	import { speedFactor } from '../game/stateSpeed.svelte';
	import { boardTicker } from '../game/reels/boardTicker';
	import {
		WILD_BANNER,
		wildBannerFlash,
		wildBannerGlint,
		wildWinMotion,
		restTransform,
		resetTransform,
	} from '../game/symbolMotion';

	const context = getContext();
	const app = getContextApp();
	let root: PIXI.Container | undefined;

	const S = SYMBOL_SIZE;
	const cellX = (reel: number) => (reel + REEL_PADDING) * S;
	const cellY = (row: number) => (row + 0.5) * S;

	type Shape = 'dust' | 'spark' | 'chip' | 'drop' | 'mark' | 'star' | 'ring';
	type P = { g: PIXI.Graphics; vx: number; vy: number; vr: number; grav: number; drag: number; life: number; max: number; grow: number; shape: Shape };
	const live: P[] = [];
	const pool = new Map<Shape, PIXI.Graphics[]>();
	let layer: PIXI.Container;

	const draw = (shape: Shape, color: number): PIXI.Graphics => {
		const g = pool.get(shape)?.pop() ?? new PIXI.Graphics();
		g.clear();
		if (shape === 'dust') g.circle(0, 0, S * 0.07).fill({ color, alpha: 0.85 }).circle(0, 0, S * 0.07).stroke({ color: 0x5a3d22, width: 1.5, alpha: 0.35 });
		else if (shape === 'spark') g.roundRect(-S * 0.05, -1.6, S * 0.1, 3.2, 1.6).fill(color);
		else if (shape === 'chip') g.roundRect(-S * 0.035, -S * 0.022, S * 0.07, S * 0.044, 2).fill(color).stroke({ color: 0x2a1a10, width: 1.5 });
		else if (shape === 'drop') g.circle(0, 0, S * 0.032).fill(color).stroke({ color: 0x2a1a10, width: 1.5 });
		else if (shape === 'mark') g.moveTo(-S * 0.05, 0).lineTo(S * 0.05, 0).moveTo(-S * 0.05, -4).lineTo(-S * 0.05, 4).moveTo(S * 0.05, -4).lineTo(S * 0.05, 4).stroke({ color, width: 2, cap: 'round' });
		else if (shape === 'star') {
			const r = S * 0.06;
			g.moveTo(0, -r).lineTo(r * 0.28, -r * 0.28).lineTo(r, 0).lineTo(r * 0.28, r * 0.28).lineTo(0, r).lineTo(-r * 0.28, r * 0.28).lineTo(-r, 0).lineTo(-r * 0.28, -r * 0.28).closePath().fill(color);
		} else g.circle(0, 0, S * 0.2).stroke({ color, width: 4 });
		g.alpha = 1;
		g.scale.set(1);
		g.rotation = 0;
		return g;
	};
	const emit = (shape: Shape, color: number, x: number, y: number, o: Partial<P> & { speed?: number; angle?: number; spread?: number }) => {
		if (live.length >= 90) return;
		const a = (o.angle ?? -Math.PI / 2) + ((Math.random() - 0.5) * (o.spread ?? Math.PI));
		const v = (o.speed ?? 1) * S * (0.6 + Math.random() * 0.8);
		const g = draw(shape, color);
		g.position.set(x, y);
		layer.addChild(g);
		const max = o.max ?? 620;
		live.push({ g, shape, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vr: o.vr ?? (Math.random() - 0.5) * 9, grav: o.grav ?? S * 4.5, drag: o.drag ?? 0.9, life: max, max, grow: o.grow ?? 0 });
	};

	const BURSTS: Record<string, (x: number, y: number) => void> = {
		// TRIGGER CELEBRATION: the alarms that won the feature ring out (ring + stars + sparks), GALARM in gold.
		ALARM: (x, y) => {
			emit('ring', 0xff7a1a, x, y, { speed: 0, grav: 0, drag: 0, grow: 2.6, max: 420, vr: 0 });
			for (let i = 0; i < 8; i += 1) emit('star', i % 2 ? 0xffffff : 0xf5d23c, x, y, { angle: (i / 8) * Math.PI * 2, spread: 0.25, speed: 1.35, grav: S * 1.4, drag: 1.5, max: 620 });
			for (let i = 0; i < 5; i += 1) emit('spark', i % 2 ? 0xd7262b : 0xffffff, x, y + S * 0.18, { angle: -Math.PI / 2, spread: 2.2, speed: 1.5, grav: S * 6, drag: 0.6, max: 560 });
		},
		GALARM: (x, y) => {
			emit('ring', 0xfff1c9, x, y, { speed: 0, grav: 0, drag: 0, grow: 3.1, max: 480, vr: 0 });
			emit('ring', 0xe9b23b, x, y, { speed: 0, grav: 0, drag: 0, grow: 2.2, max: 380, vr: 0 });
			for (let i = 0; i < 10; i += 1) emit('star', i % 2 ? 0xffffff : 0xffd75a, x, y, { angle: (i / 10) * Math.PI * 2, spread: 0.2, speed: 1.5, grav: S * 1.2, drag: 1.4, max: 700 });
			for (let i = 0; i < 6; i += 1) emit('spark', i % 2 ? 0xffd75a : 0xff7a1a, x, y + S * 0.18, { angle: -Math.PI / 2, spread: 2.4, speed: 1.7, grav: S * 6, drag: 0.6, max: 600 });
		},
		// H1 Fire Truck: brass sparks and a red flash ring.
		H1: (x, y) => {
			emit('ring', 0xd7262b, x, y, { speed: 0, grav: 0, drag: 0, grow: 1.8, max: 320, vr: 0 });
			for (let i = 0; i < 6; i += 1) emit('chip', i % 2 ? 0xe9b23b : 0xd7262b, x, y + S * 0.1, { angle: -Math.PI / 2, spread: 2.2, speed: 1.0, max: 620 });
			for (let i = 0; i < 6; i += 1) emit('spark', i % 2 ? 0xf5d23c : 0xffffff, x, y + S * 0.05, { angle: -Math.PI / 2, spread: 2.6, speed: 1.4, grav: S * 6, drag: 0.6, max: 420, vr: 0 });
		},
		// H2 Fire Helmet: brass-badge glints.
		H2: (x, y) => {
			for (let i = 0; i < 10; i += 1) emit('spark', i % 3 ? 0xe9b23b : 0xffffff, x, y + S * 0.2, { angle: -Math.PI / 2, spread: 2.6, speed: 1.5, grav: S * 6, drag: 0.6, max: 420, vr: 0 });
			for (let i = 0; i < 4; i += 1) emit('star', i % 2 ? 0xfff1c9 : 0xffffff, x, y, { angle: (i / 4) * Math.PI * 2, spread: 0.5, speed: 0.9, grav: S * 1.2, drag: 1.6, max: 520 });
		},
		// H3 Axe & Halligan: embers off the blade.
		H3: (x, y) => {
			for (let i = 0; i < 7; i += 1) emit('chip', i % 2 ? 0xff7a1a : 0xf5d23c, x + (Math.random() - 0.5) * S * 0.4, y, { angle: -Math.PI / 2, spread: 1.6, speed: 0.8, grav: S * 1.6, drag: 1.4, max: 820 });
		},
		// H4 Extinguisher: a white puff and a ring.
		H4: (x, y) => {
			emit('ring', 0xfff1c9, x, y, { speed: 0, grav: 0, drag: 0, grow: 2.2, max: 360, vr: 0 });
			for (let i = 0; i < 6; i += 1) emit('dust', 0xf4f1ea, x + S * 0.1, y - S * 0.1, { angle: -Math.PI / 4, spread: 1.2, speed: 0.8, grav: -S * 0.3, drag: 2.0, grow: 1.4, max: 700, vr: 0 });
		},
		// L1 Brass Nozzle: a water spray.
		L1: (x, y) => {
			for (let i = 0; i < 8; i += 1) emit('drop', i % 3 ? 0x5ab4f0 : 0xffffff, x + S * 0.1, y - S * 0.05, { angle: -Math.PI / 2 + 0.3, spread: 2.0, speed: 1.1, grav: S * 5, drag: 0.8, max: 620 });
		},
		// L2 Water Bucket: a slosh.
		L2: (x, y) => {
			for (let i = 0; i < 6; i += 1) emit('drop', i % 2 ? 0x3c8fd6 : 0x8ccaf5, x, y - S * 0.1, { angle: -Math.PI / 2, spread: 2.2, speed: 1.0, grav: S * 6, drag: 0.5, max: 560, vr: 0 });
		},
		// L3 Ladder: brass rung glints.
		L3: (x, y) => {
			for (let i = 0; i < 8; i += 1) emit(i % 3 ? 'drop' : 'spark', i % 2 ? 0xe9b23b : 0xfff1c9, x, y + S * 0.15, { angle: -Math.PI / 2, spread: 2.6, speed: 0.9, grav: S * 5, max: 600 });
		},
		// L4 Fire Boots: a stomp of dust.
		L4: (x, y) => {
			for (let i = 0; i < 5; i += 1) emit('dust', 0xc9c2b8, x, y + S * 0.3, { angle: -Math.PI / 2, spread: 2.8, speed: 0.6, grav: S * 0.4, drag: 2.0, grow: 1.2, max: 620, vr: 0 });
		},
		// WILD: a gold ring and a gold / white / engine-red star pop from the badge (the flash and glint themselves are the
		// WILD BANNER overlay below). `y` is the badge's centre (wildBannerOffset).
		W: (x, y) => {
			emit('ring', 0xffe27a, x, y, { speed: 0, grav: 0, drag: 0, grow: 2.4, max: 420, vr: 0 });
			for (let i = 0; i < 8; i += 1) emit('star', [0xffd75a, 0xffffff, 0xd7262b][i % 3], x, y, { angle: (i / 8) * Math.PI * 2, spread: 0.4, speed: 1.3, grav: S * 2, drag: 1.4, max: 640 });
		},
	};

	// ---- idle glint ----------------------------------------------------------------------------
	let glint: PIXI.Sprite | undefined;
	let glintT = -1;
	let glintAt = { x: 0, y: 0 };
	let idleClock = 0;
	let nextGlint = 2600;

	const boardIsStill = () =>
		!featureOwnsInput() &&
		context.stateGame.board.every((reel) => reel.reelState.motion === 'stopped' || reel.reelState.motion === undefined) &&
		context.stateXstateDerived.isIdle();

	const tick = (tk: PIXI.Ticker) => {
		const dt = Math.min(50, tk.deltaMS) * (isTurbo() ? 1.5 : 1);
		for (let i = live.length - 1; i >= 0; i -= 1) {
			const p = live[i];
			p.life -= dt;
			const k = dt / 1000;
			p.vy += p.grav * k;
			const d = Math.max(0, 1 - p.drag * k);
			p.vx *= d;
			p.vy *= p.grav < 0 ? d : 1;
			p.g.x += p.vx * k;
			p.g.y += p.vy * k;
			p.g.rotation += p.vr * k;
			const t = 1 - Math.max(0, p.life) / p.max;
			if (p.grow) p.g.scale.set(1 + p.grow * t);
			p.g.alpha = t < 0.6 ? 1 : Math.max(0, 1 - (t - 0.6) / 0.4);
			if (p.life <= 0) {
				layer.removeChild(p.g);
				(pool.get(p.shape) ?? pool.set(p.shape, []).get(p.shape)!).push(p.g);
				live.splice(i, 1);
			}
		}

		// idle glint
		if (!glint) return;
		if (glintT >= 0) {
			glintT += dt / 620;
			const e = glintT;
			glint.position.set(glintAt.x + (e - 0.5) * S * 0.62, glintAt.y + (e - 0.5) * S * 0.62);
			glint.alpha = Math.sin(Math.PI * Math.min(1, e)) * 0.9;
			glint.rotation = e * 1.6;
			const sc = (0.32 + 0.4 * Math.sin(Math.PI * Math.min(1, e))) * (S / 256);
			glint.scale.set(sc);
			if (e >= 1) {
				glintT = -1;
				glint.visible = false;
			}
		} else if (boardIsStill()) {
			idleClock += dt;
			if (idleClock > nextGlint) {
				idleClock = 0;
				nextGlint = 1800 + Math.random() * 2600;
				glintAt = { x: cellX(Math.floor(Math.random() * 5)), y: cellY(Math.floor(Math.random() * 3)) };
				glintT = 0;
				glint.visible = true;
			}
		} else {
			idleClock = 0;
		}
	};

	// ---- WILD banner overlay ---------------------------------------------------------------------
	type WildAct = {
		root: PIXI.Container; // at the cell, counter-scaled by 1/rowPitch like SymbolSprite's container
		body: PIXI.Container; // carries the WILD's win transform
		banner: PIXI.Sprite;
		glint: PIXI.Sprite | undefined;
		busy: boolean;
		elapsed: number;
		duration: number;
		beats: 1 | 2;
		reel: number;
		row: number;
		geo: { artW: number; artH: number; x: number; y: number; w: number; h: number };
		baseW: number;
		baseH: number;
	};
	const wildActs: WildAct[] = [];
	const bannerTex = new Map<string, PIXI.Texture>();
	const wildT = restTransform();
	const wildMotion = wildWinMotion();
	const DEG = Math.PI / 180;
	/* eslint-disable @typescript-eslint/no-explicit-any */
	const loaded = (key: string): PIXI.Texture | undefined =>
		((app.stateApp.loadedAssets as any)?.[key] as PIXI.Texture | undefined) ?? sceneTex(key);
	/* eslint-enable @typescript-eslint/no-explicit-any */

	const isWildAt = (reel: number, row: number) =>
		context.stateGame.board[reel]?.reelState.symbols[row]?.rawSymbol?.name === 'W';

	/** Which WILD tile the reel is showing right now (mirrors SymbolSprite's pick) and its banner crop. */
	const wildTile = () => {
		const layout = context.stateGameDerived.sceneLayout();
		const tall = layout.stacked ? loaded('symT_W') : undefined;
		const key = tall ? 'symT_W' : 'sym_W';
		const art = tall ?? loaded('sym_W');
		if (!art) return undefined;
		const geo = tall ? WILD_BANNER.tall : WILD_BANNER.square;
		// an art swap that changed the tile's shape would put the crop on the wrong pixels: stay dark
		if (Math.abs(art.height / Math.max(1, art.width) - geo.artH / geo.artW) > 0.03) return undefined;
		let tex = bannerTex.get(key);
		if (!tex) {
			const k = art.width / geo.artW;
			tex = new PIXI.Texture({
				source: art.source,
				frame: new PIXI.Rectangle(art.frame.x + geo.x * k, art.frame.y + geo.y * k, geo.w * k, geo.h * k),
			});
			bannerTex.set(key, tex);
		}
		const baseW = SYMBOL_SIZE; // SYMBOL_INFO_MAP.W is size 1.0
		const baseH = tall ? baseW * Math.min(layout.rowPitch, art.height / Math.max(1, art.width)) : baseW;
		return { tex, geo, baseW, baseH, pitch: layout.rowPitch };
	};

	/** Banner centre below the cell centre, in this layer's (row-stretched) board units. */
	const wildBannerOffset = () => {
		const tile = wildTile();
		if (!tile) return S * 0.08;
		const { geo, baseH, pitch } = tile;
		return ((geo.y + geo.h / 2 - geo.artH / 2) * baseH) / geo.artH / pitch;
	};

	const startWildAct = (reel: number, row: number) => {
		const tile = wildTile();
		if (!tile || !root) return;
		let act = wildActs.find((a) => a.busy && a.reel === reel && a.row === row) ?? wildActs.find((a) => !a.busy);
		if (!act) {
			const r = new PIXI.Container();
			const body = new PIXI.Container();
			const banner = new PIXI.Sprite(tile.tex);
			banner.anchor.set(0.5);
			banner.blendMode = 'add';
			banner.tint = 0xfff0b0;
			body.addChild(banner);
			const gt = loaded('rung_fx_glint_4point');
			let glint: PIXI.Sprite | undefined;
			if (gt) {
				glint = new PIXI.Sprite(gt);
				glint.anchor.set(0.5);
				glint.blendMode = 'add';
				body.addChild(glint);
			}
			r.addChild(body);
			act = { root: r, body, banner, glint, busy: false, elapsed: 0, duration: 1, beats: 2, reel, row, geo: tile.geo, baseW: 0, baseH: 0 };
			wildActs.push(act);
		}
		root.addChild(act.root);
		act.banner.texture = tile.tex;
		act.geo = tile.geo;
		act.baseW = tile.baseW;
		act.baseH = tile.baseH;
		act.root.position.set(cellX(reel), cellY(row - 1));
		act.root.scale.set(1, 1 / tile.pitch);
		act.reel = reel;
		act.row = row;
		act.busy = true;
		act.elapsed = 0;
		// exactly the WILD sprite's own duration (SymbolSprite: durationMs x speedFactor in turbo)
		act.duration = Math.max(1, wildMotion.durationMs * (isTurbo() ? speedFactor() : 1));
		act.beats = isTurbo() ? 1 : 2;
		act.root.visible = false;
		if (wildLog) wildLog.push({ at: Math.round(performance.now()), reel, row, stacked: act.geo === WILD_BANNER.tall, durationMs: act.duration, beats: act.beats, peakFlash: 0, glintFrames: 0, frames: 0, cell: cellRect(act) });
	};

	const endWildAct = (act: WildAct, why: string) => {
		const log = wildLog?.[wildLog.length - 1];
		if (log && log.reel === act.reel && log.row === act.row && !log.ended) log.ended = `${why}@${Math.round((act.elapsed / act.duration) * 100) / 100}`;
		act.busy = false;
		act.root.visible = false;
		act.root.parent?.removeChild(act.root);
	};

	const tickWild = (dt: number) => {
		for (const act of wildActs) {
			if (!act.busy) continue;
			// the symbol's win was cut short (skip / next round): the banner goes with it
			const state = context.stateGame.board[act.reel]?.reelState.symbols[act.row]?.symbolState;
			if (act.elapsed > 0 && state !== 'win') {
				endWildAct(act, `state:${state}`);
				continue;
			}
			act.elapsed += dt;
			const p = Math.min(1, act.elapsed / act.duration);
			if (p >= 1) {
				endWildAct(act, 'done');
				continue;
			}
			resetTransform(wildT);
			wildMotion.sample(p, wildT);
			act.body.position.set(wildT.ox, wildT.oy);
			act.body.rotation = wildT.rot * DEG;
			act.body.scale.set(wildT.sx, wildT.sy);
			const { geo, baseW, baseH } = act;
			const cx = ((geo.x + geo.w / 2 - geo.artW / 2) * baseW) / geo.artW;
			const cy = ((geo.y + geo.h / 2 - geo.artH / 2) * baseH) / geo.artH;
			const bw = (geo.w * baseW) / geo.artW;
			const bh = (geo.h * baseH) / geo.artH;
			const f = wildBannerFlash(p, act.beats);
			act.banner.visible = f > 0.01;
			if (act.banner.visible) {
				act.banner.alpha = 0.85 * f;
				act.banner.position.set(cx, cy);
				const grow = 1 + 0.04 * f; // the lit banner breathes a touch larger than the art
				act.banner.scale.set((bw * grow) / act.banner.texture.width, (bh * grow) / act.banner.texture.height);
			}
			const g = wildBannerGlint(p);
			if (act.glint) {
				act.glint.visible = g >= 0;
				if (g >= 0) {
					const s = Math.sin(Math.PI * g);
					act.glint.position.set(cx + (g - 0.5) * bw * 0.92, cy - bh * 0.18 + bh * 0.3 * g);
					act.glint.rotation = g * 80 * DEG;
					act.glint.alpha = s;
					const size = bh * (0.7 + 0.7 * s);
					act.glint.scale.set(size / act.glint.texture.width, size / act.glint.texture.height);
				}
			}
			act.root.visible = true;
			const log = wildLog?.[wildLog.length - 1];
			if (log && log.reel === act.reel && log.row === act.row) {
				log.frames += 1;
				log.peakFlash = Math.max(log.peakFlash, Math.round(f * 100) / 100);
				if (g >= 0) log.glintFrames += 1;
			}
		}
	};

	// DEV-only QA record of each WILD performance (qa/gate_fixes/wild): never in a production build
	type WildLogEntry = { at: number; reel: number; row: number; stacked: boolean; durationMs: number; beats: number; peakFlash: number; glintFrames: number; frames: number; ended?: string; cell?: { x: number; y: number; w: number; h: number } };
	/** the WILD cell in CSS px of the page, for cropping QA frames */
	const cellRect = (act: WildAct) => {
		const canvas = app.stateApp.pixiApplication?.canvas as HTMLCanvasElement | undefined;
		if (!canvas) return undefined;
		const b = canvas.getBoundingClientRect();
		const kx = b.width / Math.max(1, app.stateApp.pixiApplication!.screen.width);
		const ky = b.height / Math.max(1, app.stateApp.pixiApplication!.screen.height);
		const a = act.root.toGlobal({ x: -act.baseW / 2, y: -act.baseH / 2 });
		const c = act.root.toGlobal({ x: act.baseW / 2, y: act.baseH / 2 });
		return { x: Math.round(b.left + a.x * kx), y: Math.round(b.top + a.y * ky), w: Math.round((c.x - a.x) * kx), h: Math.round((c.y - a.y) * ky) };
	};
	const wildLog: WildLogEntry[] | undefined = import.meta.env.DEV && typeof window !== 'undefined' ? [] : undefined;
	const fxLog: { symbol: string; others: number; wilds: number }[] | undefined = wildLog ? [] : undefined;
	if (wildLog) Object.assign(window, { __pffWildLog: wildLog, __pffFxLog: fxLog });

	context.eventEmitter.subscribeOnMount({
		symbolWinFx: ({ symbol, positions }) => {
			if (!layer || prefersReducedMotion()) return;
			// a WILD cell in a paying way performs as the WILD, whatever symbol the way pays
			const wilds = positions.filter((pos) => isWildAt(pos.reel, pos.row));
			const others = wilds.length ? positions.filter((pos) => !isWildAt(pos.reel, pos.row)) : positions;
			wilds.forEach((pos) => startWildAct(pos.reel, pos.row));
			const burst = symbol in BURSTS ? BURSTS[symbol] : undefined;
			// the win motion peaks about a third of the way in; fire the burst on that beat
			fxLog?.push({ symbol, others: burst ? others.length : 0, wilds: wilds.length });
			setTimeout(() => {
				if (burst) others.forEach((pos) => burst(cellX(pos.reel), cellY(pos.row - 1)));
				const dy = wilds.length ? wildBannerOffset() : 0;
				wilds.forEach((pos) => BURSTS.W(cellX(pos.reel), cellY(pos.row - 1) + dy));
			}, isTurbo() ? 90 : 200);
		},
	});

	onMount(() => {
		if (!root) return;
		layer = new PIXI.Container();
		root.addChild(layer);
		const tex = (app.stateApp.loadedAssets?.['rung_fx_glint_4point'] as PIXI.Texture | undefined) ?? sceneTex('rung_fx_glint_4point');
		if (tex && !prefersReducedMotion()) {
			glint = new PIXI.Sprite(tex);
			glint.anchor.set(0.5);
			glint.blendMode = 'add';
			glint.visible = false;
			root.addChild(glint);
		}
		const ticker = app.stateApp.pixiApplication?.ticker;
		ticker?.add(tick);
		boardTicker.add(tickWild);
		return () => {
			ticker?.remove(tick);
			boardTicker.remove(tickWild);
			wildActs.forEach((act) => act.root.destroy({ children: true }));
			wildActs.length = 0;
			bannerTex.forEach((t) => t.destroy(false)); // the sub-frames only; the symbol art stays
			bannerTex.clear();
			root?.removeChildren().forEach((child: PIXI.ContainerChild) => child.destroy({ children: true }));
			pool.forEach((list) => list.forEach((g) => g.destroy()));
			pool.clear();
			live.length = 0;
		};
	});
</script>

<!-- Same transform as BoardContainer: laid out in board units, masked to nothing (bursts may leave a cell). -->
<Container
	x={context.stateGameDerived.boardLayout().x}
	y={context.stateGameDerived.boardLayout().y}
	scale={context.stateGameDerived.boardLayout().zoomScaleXY}
	pivot={context.stateGameDerived.boardLayout().pivot}
>
	<Grab ongrab={(node) => (root = node)} />
</Container>
