<script lang="ts" module>
	export type EmitterEventWinRungs = {
		type: 'winRungs';
		/** booked round total, integer x100 of the base bet */
		amount: number;
		/** the rung the climb lands on: 6 BIG … 10 MAX (game/roundTier.ts rungLevelOfTier) */
		level: number;
		/** contract §8 round tier (2..6), the `animBeat winTier` numbering */
		tier?: number;
	};

	import { RUNG_FLOORS_BOOKED } from '../game/roundTier';

	/** Rung floors BIG, HUGE, MEGA, EPIC, MAX in booked units: 15 / 30 / 50 / 100 x the base bet and the 20,000x cap
	 *  (contract §8, game/roundTier.ts — the ONE table for every round). The climb never passes the landed level or
	 *  the booked amount; these only pace it (game/rungPacing.ts). */
	const THRESHOLDS: readonly number[] = RUNG_FLOORS_BOOKED;
</script>

<script lang="ts">
	// WIN RUNGS — the climbing sign. BIG -> HUGE -> MEGA -> EPIC -> MAX (theme §5), staged like a poster moment:
	//
	//   STAGE   the round's own scene plate (environment/<mood>_<orientation>) covers the reels, under a LIGHT navy scrim
	//           and a vignette, so Station 13 (or the burning block) stays readable and nothing on the board competes
	//           with the sign. Behind the sign: a normal-blend light pool that recolours the plate in the rung's hue, an
	//           additive radial bloom in the light's core colour and rotating god-rays (light_ray_wedge) in the rung's
	//           light — hose-water blue, siren red on a warm-white core, a true siren blue, flame orange, and MAX the
	//           brightest gold — with flame-orange embers drifting up through it. The light is tuned PER MOOD PLATE
	//           (game/rungPacing.ts stageLight): Station 13's bright plate darkens its edges harder and pushes the bloom,
	//           so the light always gathers at the sign. The sign is sized and centred from the visible view.
	//   SIGN    one sign hanging on its chains. It breathes, sways about its chain tops, carries a pulsing glow copy of
	//           itself (its blurred silhouette, additive) and a shine sweep masked to the title board; it grows a
	//           little per rung and MAX is clearly the biggest. A crossing SWAPS boards (the new one drops / pops in,
	//           the old one swells and fades) inside a flare: a small shake, a +6% plate pop, a spark ring of 4-point
	//           glints, a flash, a burst of tumbling coins and kit from the sign's rim and a volley of the game's own
	//           symbol tiles in from the screen edges.
	//   PIECES  tumbling coins (the 32-frame turntable) and this rung's kit rain down the two SIDES, in a back layer
	//           (behind the sign) and a front layer (never over the title or the amount); on a phone, whose gutters are a
	//           few px wide, the front rain and the bursts spill off the plank's foot into the band under it. The rain and
	//           each burst have their OWN pools (game/rungPacing.ts pieceBudget), so a stream can never starve a crossing
	//           or a landing.
	//   AMOUNT  the brass interGold figure on the plank, laid out with tabular digits and a size solved ONCE from the
	//           settled figure (it never reflows or jitters mid-count), hidden until it is non-zero, popping +9% on each
	//           crossing. The count is a segment-weighted log ramp (game/rungPacing.ts): every rung gets real time,
	//           MAX shows its sign BEFORE the figure reaches the cap and lands exactly on it. Speed tiers scale it by
	//           stateSpeed speedFactor() (0.5 turbo, 0.3 super), the max-win card fade included.
	//
	// MAX ends on the max win card, which stays alive over its hold: a coin storm at three depths and glint pops (never
	// over its title / 20,000x band), the embers, a shine across its plank every ~2 s, a slow breath, and the MAX rays
	// turning around its edges. The desktop plate chief stands clear of the ALARM BOOST chip and leaves with the sign.
	// Reduced motion: static light, no shake, no expanding ring, no travel, no slide-out; boards fade out then in (never
	// two titles in one frame), the stage fades in and out, the sign fades out before the card fades in, the card is still. One press skips to the landed total (one flare), a second leaves.
	// Contract §8: this only ever runs for a tier 2..6 round (game/roundTier.ts; nothing at or below the cost).
	//
	// Imperative PIXI on the live container, ONE ticker callback, every display object pooled at the start of a climb
	// and destroyed with the stage at its end; every count scales with the quality tier (game/quality.svelte).
	import { onMount } from 'svelte';
	import { Container, PIXI, getContextApp } from 'pixi-svelte';
	import { MainContainer, OnPressFullScreen } from 'components-layout';
	import { OnHotkey } from 'components-shared';

	import Grab from './scene/Grab.svelte';
	import { getContext } from '../game/context';
	import { formatBookAmount } from '../game/money';
	import { audioManager } from '../game/audio/audioManager';
	import { sceneTex } from '../game/fx/sceneTextures.svelte';
	import { prefersReducedMotion } from '../game/fx/timing';
	import { stateScene } from '../game/fx/stateScene.svelte';
	import { speedFactor } from '../game/stateSpeed.svelte';
	import { ensureSignFont } from '../game/fx/signPanel';
	import { winLevelMap } from '../game/winLevelMap';
	import config from '../game/config';
	import { fmtX } from '../game/format';
	import { RUNG_SKINS, type RUNG_PIECES } from '../game/assetsScene';
	import { rungSign, MAXWIN_CARD } from '../game/artMeta';
	import { signsMeta } from '../game/artMeta.generated';
	import { animBeats } from '../game/fx/animBeats';
	import type { WinRungTier } from '../game/anim/rigLogic';
	import { quality, qv } from '../game/quality.svelte';
	import { ensureFeatureAssets } from '../game/lazyAssets';
	import {
		planCount,
		countAt,
		rungTimeline,
		rungFx,
		pieceBudget,
		watchdogMs,
		signLayout,
		signGrow,
		stageLight,
		FRAME_STEP_CAP_MS,
		LIGHT_SIZE,
		boardSwapAlpha,
		cardHandover,
		volleyKey,
		volleyLaunch,
		type StageLight,
	} from '../game/rungPacing';

	const context = getContext();
	const app = getContextApp();

	type PieceName = (typeof RUNG_PIECES)[number];
	type SymbolId = 'H1' | 'H2' | 'H3' | 'H4' | 'L1' | 'L2' | 'L3' | 'L4' | 'W';
	type Rung = {
		key: 'big' | 'huge' | 'mega' | 'epic' | 'max';
		/** sign art key suffix: `rung_sign_<skin>` (game/assetsScene.ts RUNG_SKINS) */
		skin: (typeof RUNG_SKINS)[number];
		pieces: PieceName[];
		burstCue: string;
		/** the symbol tiles this rung's crossing volley throws in from the screen edges (low kit up to the truck + Wild) */
		volley: SymbolId[];
	};
	// The art lane's signs (winrungs/signs/<skin>.webp, geometry in flat_manifest.json) and tumbling pieces
	// (winrungs/pieces/<name>_sheet.webp): water for BIG, embers for HUGE, the brass kit from MEGA up, everything at MAX.
	// Coins (the 32-frame turntable) ride along at every rung.
	const PIECES: Record<Rung['key'], PieceName[]> = {
		big: ['droplet', 'coin', 'droplet'],
		huge: ['ember', 'spark', 'coin'],
		mega: ['badge', 'helmet', 'coin', 'ember'],
		epic: ['coin', 'silver_coin', 'badge', 'nozzle', 'ember'],
		max: ['coin', 'silver_coin', 'badge', 'helmet', 'hydrant_cap', 'boot', 'ember', 'droplet'],
	};
	const RUNGS: Rung[] = [
		{ key: 'big', skin: 'big', pieces: PIECES.big, burstCue: 'burst_water', volley: ['L1', 'L2', 'L3', 'L4'] },
		{ key: 'huge', skin: 'huge', pieces: PIECES.huge, burstCue: 'burst_embers', volley: ['L1', 'L2', 'L3', 'L4', 'H4'] },
		{ key: 'mega', skin: 'mega', pieces: PIECES.mega, burstCue: 'burst_badges', volley: ['L3', 'L4', 'H4', 'H3', 'H2'] },
		{ key: 'epic', skin: 'epic', pieces: PIECES.epic, burstCue: 'burst_coins', volley: ['H4', 'H3', 'H2', 'H1'] },
		{ key: 'max', skin: 'max', pieces: PIECES.max, burstCue: 'burst_gold', volley: ['H1', 'H2', 'W', 'H3', 'H1', 'W'] },
	];
	// sign texture geometry (winrungs/signs/flat_manifest.json: every rung shares one plate layout; the amount sits on
	// the plank; the title board's body runs from 2 x title centre - bottom to the bottom, EPIC / MAX carry a crest)
	const SIGN_META = rungSign('big');
	// the figure fits 0.74 of the plank and sits a touch right of centre, off the plank's gloss highlight at its left end
	const SIGN = { w: SIGN_META.w, h: SIGN_META.h, boardY: SIGN_META.boardY, plankY: SIGN_META.plankY, plankW: SIGN_META.plankW * 0.74, plankH: SIGN_META.plankH };
	const AMOUNT_NUDGE_X = SIGN_META.plankW * 0.022;
	const BOARD = { w: signsMeta.big.board[2], bottom: signsMeta.big.board[1] + signsMeta.big.board[3] / 2 };
	const titleBody = (skin: Rung['skin']) => {
		const tc = signsMeta[skin].title_centre[1];
		const top = Math.max(0, 2 * tc - BOARD.bottom);
		return { top, bottom: BOARD.bottom, h: BOARD.bottom - top, cy: (top + BOARD.bottom) / 2 };
	};
	/** the sign's light and rays centre, texture y (between the title and the plank) */
	const LIGHT_Y = 420;
	/** the gold bitmap font's ink centre, as a fraction of fontSize below the anchor */
	const GOLD_INK_DY = 0.1;
	const FONT_SIZE = 132;
	/** every piece sheet is 8 x 3 cells of 128 px, 24 frames (winrungs/pieces/<name>.json); the coin sheet is 32 x 128 */
	const PIECE_GRID = { frames: 24, cols: 8 };
	const CELL = 128;

	let root: PIXI.Container | undefined;
	let active = $state(false);
	let press: () => void = () => {};
	const tex = (key: string): PIXI.Texture =>
		(app.stateApp.loadedAssets?.[key] as PIXI.Texture | undefined) ?? sceneTex(key) ?? PIXI.Texture.EMPTY;
	const cue = (id: string) => {
		try {
			audioManager.playCue(id);
		} catch {
			/* audio never breaks a presentation */
		}
	};

	const frameCache = new Map<string, PIXI.Texture[]>();
	const pieceFrames = (name: string): PIXI.Texture[] => {
		const hit = frameCache.get(name);
		if (hit) return hit;
		const sheet = tex(`rung_piece_${name}`);
		if (sheet === PIXI.Texture.EMPTY) return [];
		const grid = PIECE_GRID;
		const frames: PIXI.Texture[] = [];
		for (let i = 0; i < grid.frames; i += 1) {
			frames.push(
				new PIXI.Texture({
					source: sheet.source,
					frame: new PIXI.Rectangle((i % grid.cols) * CELL, Math.floor(i / grid.cols) * CELL, CELL, CELL),
				}),
			);
		}
		frameCache.set(name, frames);
		return frames;
	};
	/** the tumbling coin: the boot coin sheet's 32 turntable frames (loadedAssets 'coins', a Texture[] in sheet order) */
	const coinFrames = (): PIXI.Texture[] => {
		const c = app.stateApp.loadedAssets?.coins as unknown;
		if (Array.isArray(c) && c.length) return c as PIXI.Texture[];
		return pieceFrames('coin');
	};

	const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
	const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
	const easeOutBack = (p: number) => 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2);
	const lerpColor = (a: number, b: number, t: number) => {
		const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
		const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
		return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
	};
	const frac = (v: number) => v - Math.floor(v);

	// one run at a time; everything the ticker needs lives here
	type Run = { step: (dt: number) => void };
	let run: Run | undefined;
	let presenting = false;

	const present = async (amount: number, level: number, tier: WinRungTier) => {
		const finalIdx = Math.max(0, Math.min(4, level - 6));
		// The signs, pieces, stage light and (MAX) the card are lazy (game/lazyAssets: memoised, instant once warm), and
		// so is the BIG bed: both are resident BEFORE the first drop, so a 500x on the first spin after the gate never
		// shows Texture.EMPTY or a silent sign. Only the FIRST rung's bed is waited on (AUD-5b); the higher rungs decode
		// one after another in the background below, so BIG never queues behind MAX. Nothing here can hold the round.
		const firstBed = `rung_bed_${RUNGS[0].key}`;
		try {
			await Promise.all([ensureFeatureAssets('winrungs'), finalIdx === 4 ? ensureFeatureAssets('maxwin') : undefined, audioManager.ensureDecoded([firstBed])]);
		} catch {
			/* a missing asset or decode never holds the round: the sign shows whatever is resident */
		}
		return new Promise<void>((resolve) => {
			if (!root) return resolve();
			const stage = root;
			const reduced = prefersReducedMotion();
			const speed = speedFactor();
			const tl = rungTimeline(speed, reduced);
			const plan = planCount(amount, finalIdx, THRESHOLDS, speed);
			const q = quality.tier;
			const budget = pieceBudget(q);
			const fxTop = rungFx(finalIdx, q, reduced);
			let fx = rungFx(0, q, reduced);
			// 'low' tumbles its pieces at half rate (each frame index change is a texture swap on a batched sprite)
			const pieceFpsK = qv({ high: 1, mid: 1, low: 0.5 });

			// ---- geometry (main units: the MainContainer this stage lives in) ----
			const main = context.stateLayoutDerived.mainLayout();
			const bl = context.stateGameDerived.boardLayout();
			const sl = context.stateGameDerived.sceneLayout();
			const phone = sl.stacked;
			const cs = context.stateLayoutDerived.canvasSizes();
			const c0 = stage.toLocal(new PIXI.Point(0, 0));
			const c1 = stage.toLocal(new PIXI.Point(cs.width, cs.height));
			const view = { x: Math.min(c0.x, c1.x), y: Math.min(c0.y, c1.y), w: Math.abs(c1.x - c0.x), h: Math.abs(c1.y - c0.y) };
			const hudTop = Math.min(view.y + view.h, sl.toMainY(sl.hudBarTop));
			// The sign is sized and centred from the VISIBLE view, never the board layout (which shrinks and drops under
			// the Rescue building band): MAX at the top of its breath spans ~74% of a wide screen (ganja's banner ~70%) or
			// ~99% of a phone, centred in the free band above the HUD bar (game/rungPacing.ts signLayout).
			const cx = view.x + view.w / 2;
			const fit = signLayout({ y: view.y, w: view.w, bottom: hudTop, stacked: phone, aspect: SIGN.h / SIGN.w, q });
			const signW0 = fit.w0;
			const centreY = fit.centreY;
			const k0 = signW0 / SIGN.w;
			const grow = (rank: number) => signGrow(rank, phone);
			const mood = stateScene.mood;
			// rig beat: the win-rung plate is in (docs/ANIMATION_CONTRACT.md bigWinStart, tier 2..6)
			animBeats.emit({ beat: 'bigWinStart', tier, amount: amount / 100 });

			// ---- display tree ----
			const shakeBox = new PIXI.Container();
			const backdrop = new PIXI.Container();
			backdrop.alpha = 0;
			// the round's own scene plate, cover-fitted over the canvas (a little over, so a shake never shows an edge)
			const portraitCanvas = cs.height > cs.width * 1.05;
			const plateTex = tex(`bg_${stateScene.mood}_${portraitCanvas ? 'portrait' : 'landscape'}`);
			if (plateTex !== PIXI.Texture.EMPTY) {
				const plate = new PIXI.Sprite(plateTex);
				plate.anchor.set(0.5);
				const s = Math.max((view.w * 1.03) / Math.max(1, plateTex.width), (view.h * 1.03) / Math.max(1, plateTex.height));
				plate.scale.set(s);
				plate.position.set(view.x + view.w / 2, view.y + view.h / 2);
				backdrop.addChild(plate);
			}
			const pad = Math.max(view.w, view.h) * 0.03;
			const scrim = new PIXI.Graphics().rect(view.x - pad, view.y - pad, view.w + pad * 2, view.h + pad * 2).fill(0x0b1226);
			// the light per rung AND per mood plate (game/rungPacing.ts stageLight): Station 13's bright plate darkens its
			// edges harder (full vignette + a second pass) and pushes the bloom and rays, so the light gathers at the sign
			let sLight: StageLight = stageLight(0, mood, phone);
			scrim.alpha = plateTex !== PIXI.Texture.EMPTY ? sLight.scrim : 0.45;
			const vignettes = [0, 1].map(() => {
				const v = new PIXI.Sprite(tex('rung_fx_vignette'));
				v.position.set(view.x - pad, view.y - pad);
				v.width = view.w + pad * 2;
				v.height = view.h + pad * 2;
				v.tint = 0x05070f;
				return v;
			});
			vignettes[0].alpha = sLight.vignette;
			vignettes[1].alpha = sLight.vignette2;
			vignettes[1].visible = sLight.vignette2 > 0;
			// light: a normal-blend POOL that recolours the plate in the rung's hue, the additive bloom (the light's core
			// colour), god-rays turning around the sign and a small hot core behind it
			const lightY = () => centreY + (LIGHT_Y - SIGN.h / 2) * kg;
			const lightBox = new PIXI.Container();
			const pool = new PIXI.Sprite(tex('rung_fx_light_pool'));
			pool.anchor.set(0.5);
			const bloom = new PIXI.Sprite(tex('rung_fx_radial_bloom'));
			bloom.anchor.set(0.5);
			bloom.blendMode = 'add';
			const core = new PIXI.Sprite(tex('rung_fx_radial_bloom'));
			core.anchor.set(0.5);
			core.blendMode = 'add';
			const rayBox = new PIXI.Container();
			const rayBox2 = new PIXI.Container();
			const rayTex = tex('rung_fx_light_ray_wedge');
			const rayLen = Math.hypot(view.w, view.h) * 0.8;
			const rays: PIXI.Sprite[] = [];
			const addRays = (box: PIXI.Container, n: number, list: PIXI.Sprite[]) => {
				for (let i = 0; i < n; i += 1) {
					const r = new PIXI.Sprite(rayTex);
					r.anchor.set(0.5, 0.02);
					r.blendMode = 'add';
					r.rotation = (i / n) * Math.PI * 2;
					box.addChild(r);
					list.push(r);
				}
			};
			addRays(rayBox, fx.rays, rays);
			const rays2: PIXI.Sprite[] = [];
			if (fxTop.counterRays) addRays(rayBox2, Math.round(fx.rays / 2), rays2);
			rayBox2.visible = false;
			lightBox.addChild(pool, bloom, rayBox, rayBox2, core);
			const emberLayer = new PIXI.Container();
			const backLayer = new PIXI.Container();
			backdrop.addChild(scrim, ...vignettes, lightBox, emberLayer);

			// the sign: signPivot hangs at the chain tops (sway), signBody breathes / pops about the title board's centre
			const signPivot = new PIXI.Container();
			const signBody = new PIXI.Container();
			signBody.pivot.set(0, SIGN.boardY);
			const glow = new PIXI.Sprite(tex(`rung_fx_glow_${RUNGS[0].skin}`));
			glow.anchor.set(0.5);
			glow.position.set(0, SIGN.h / 2);
			// the glow copy is the sign's blurred silhouette at quarter scale with symmetric padding: x4 lands it on the sign
			glow.scale.set(4 * 1.03);
			glow.blendMode = 'add';
			const oldBoard = new PIXI.Sprite(PIXI.Texture.EMPTY);
			oldBoard.anchor.set(0.5, SIGN.boardY / SIGN.h);
			oldBoard.position.set(0, SIGN.boardY);
			oldBoard.visible = false;
			const boardHolder = new PIXI.Container();
			boardHolder.position.set(0, SIGN.boardY);
			const board = new PIXI.Sprite(tex(`rung_sign_${RUNGS[0].skin}`));
			board.anchor.set(0.5, SIGN.boardY / SIGN.h);
			// the shine: an additive band swept across the title board, stencil-masked to the board's body (no filter)
			const shineMask = new PIXI.Graphics();
			const shine = new PIXI.Sprite(tex('rung_fx_shine_band'));
			shine.anchor.set(0.5);
			shine.blendMode = 'add';
			shine.rotation = 0.32;
			shine.alpha = 0;
			shine.mask = shineMask;
			const dressShine = (skin: Rung['skin']) => {
				const b = titleBody(skin);
				shineMask.clear().roundRect(-BOARD.w / 2 + 12, b.top - SIGN.boardY + 8, BOARD.w - 24, b.h - 16, b.h * 0.14).fill(0xffffff);
				shine.height = b.h * 1.7;
				shine.width = b.h * 0.62;
				shine.y = b.cy - SIGN.boardY;
			};
			dressShine(RUNGS[0].skin);
			boardHolder.addChild(board, shineMask, shine);
			// the figure: tabular brass glyphs on the plank
			const amountBox = new PIXI.Container();
			amountBox.position.set(AMOUNT_NUDGE_X, SIGN.plankY - FONT_SIZE * GOLD_INK_DY);
			amountBox.visible = false;
			signBody.addChild(glow, oldBoard, boardHolder, amountBox);
			signPivot.addChild(signBody);

			const frontLayer = new PIXI.Container();
			const sparkLayer = new PIXI.Container();
			const volleyLayer = new PIXI.Container();
			const flash = new PIXI.Graphics().rect(view.x - pad, view.y - pad, view.w + pad * 2, view.h + pad * 2).fill(0xffffff);
			flash.blendMode = 'add';
			flash.alpha = 0;
			const ring = new PIXI.Sprite(tex('rung_fx_ring_shockwave'));
			ring.anchor.set(0.5);
			ring.blendMode = 'add';
			ring.alpha = 0;
			const card = new PIXI.Sprite(PIXI.Texture.EMPTY);
			card.anchor.set(0.5);
			// THE MAX WIN CARD IS A CARD, NOT A PICTURE (owner, 2026-09-20: "a unique presentation card for the max win
			// hit"). `cardBox` carries the art behind rounded corners, a gold frame, the MAX WIN title and the 20,000x
			// multiple on a plank (never a currency figure: owner ruling, see dressCard). Everything is a child of
			// `cardBox`, so `finish()` destroys it with the rest of the stage.
			const cardBox = new PIXI.Container();
			cardBox.alpha = 0;
			cardBox.addChild(card);
			// the MAX card stays ALIVE over its hold (judge 2026-09-26: a frozen poster): a coin storm at three depths and
			// pops of 4-point glints ride above it (never over the title / 20,000x band), a shine sweeps its plank and it
			// breathes; the MAX rays keep turning around its edges
			const cardFx = new PIXI.Container();
			cardFx.alpha = 0;
			// the landing ring expands BEHIND the sign (it washed the figure out on its reveal frame); only the glint
			// spark ring rides in front
			shakeBox.addChild(backdrop, backLayer, volleyLayer, ring, signPivot, frontLayer, sparkLayer, flash, cardBox, cardFx);
			stage.addChild(shakeBox);

			// ---- the figure: tabular glyphs, sized once from the settled amount ----
			const glyphStyle = { fontFamily: 'gold', fontSize: FONT_SIZE, align: 'center' as const };
			const advance = new Map<string, number>();
			const adv = (ch: string) => {
				let w = advance.get(ch);
				if (w === undefined) {
					const probe = new PIXI.BitmapText({ text: ch, style: glyphStyle });
					w = probe.width;
					probe.destroy();
					advance.set(ch, w);
				}
				return w;
			};
			const digitW = Math.max(...'0123456789'.split('').map(adv));
			const cellW = (ch: string) => (ch >= '0' && ch <= '9' ? digitW : adv(ch));
			const glyphs: PIXI.BitmapText[] = [];
			const widthOf = (text: string) => [...text].reduce((a, ch) => a + cellW(ch), 0);
			const finalText = formatBookAmount(amount);
			const amountFit = Math.min(1, SIGN.plankW / Math.max(1, widthOf(finalText)));
			let shownText = '';
			const setAmount = (value: number) => {
				amountBox.visible = value > 0;
				if (value <= 0) return;
				const text = formatBookAmount(value);
				if (text === shownText) return;
				shownText = text;
				const chars = [...text];
				let x = -widthOf(text) / 2;
				chars.forEach((ch, i) => {
					let g = glyphs[i];
					if (!g) {
						g = new PIXI.BitmapText({ text: ch, style: glyphStyle });
						g.anchor.set(0.5);
						glyphs.push(g);
						amountBox.addChild(g);
					} else if (g.text !== ch) g.text = ch;
					const w = cellW(ch);
					g.x = x + w / 2;
					g.visible = true;
					x += w;
				});
				for (let i = chars.length; i < glyphs.length; i += 1) glyphs[i].visible = false;
			};

			// ---- pieces: side rain (fixed pool) + crossing / landing bursts (their own pools) ----
			type Mote = { s: PIXI.Sprite; frames: PIXI.Texture[]; f: number; fi: number; fps: number };
			const tumble = (m: Mote, dt: number) => {
				if (!m.frames.length) return;
				m.f = (m.f + (m.fps * dt) / 1000) % m.frames.length;
				const fi = Math.floor(m.f);
				if (fi !== m.fi) {
					m.fi = fi;
					m.s.texture = m.frames[fi];
				}
			};
			let pick = 0;
			/** coins most of the time, this rung's kit otherwise */
			const framesFor = (rung: number): PIXI.Texture[] => {
				pick += 1;
				const kit = RUNGS[rung].pieces;
				if (pick % 5 < 3) {
					const c = coinFrames();
					if (c.length) return c;
				}
				return pieceFrames(kit[pick % kit.length]);
			};
			type Drop = Mote & { front: boolean; side: number; phase: number; periodMs: number; band: number; wob: number; size: number; on: boolean };
			const rain: Drop[] = [];
			const dress = (m: Mote & { size: number }, rung: number, size: number) => {
				m.frames = framesFor(rung);
				m.f = Math.random() * Math.max(1, m.frames.length);
				m.fi = -1;
				m.fps = (20 + Math.random() * 12) * pieceFpsK;
				m.size = size;
				m.s.scale.set(size / CELL);
				tumble(m, 0);
			};
			for (let i = 0; i < (reduced ? 0 : budget.rain); i += 1) {
				const front = i % 3 === 0;
				const s = new PIXI.Sprite(PIXI.Texture.EMPTY);
				s.anchor.set(0.5);
				s.visible = false;
				if (!front) s.tint = 0xcfc6b6;
				(front ? frontLayer : backLayer).addChild(s);
				rain.push({ s, frames: [], f: 0, fi: -1, fps: 0, front, side: i % 2 ? 1 : -1, phase: frac(i * 0.618), periodMs: 1, band: frac(i * 0.382 + 0.1), wob: i * 1.7, size: 0, on: false });
			}
			const rainSize = (d: Drop) => signW0 * (d.front ? 0.1 : 0.068) * (0.85 + 0.3 * frac(d.wob * 7.3));
			const rainPeriod = (d: Drop, rank: number) => (4300 - 320 * rank) * (d.front ? 0.78 : 1.15) * (0.9 + 0.25 * frac(d.wob * 3.1));
			/** a phone's front rain falls only the band under the plank: its period shrinks with that distance */
			const spillK = (d: Drop) => (phone && d.front ? Math.max(0.25, (hudTop - plankBottom()) / Math.max(1, view.h)) : 1);

			/** `wait` holds a piece unborn (ms) and `fadeIn` fades it in: a phone's landing spill cascades off the plank's foot */
			type Burst = Mote & { size: number; front: boolean; vx: number; vy: number; vr: number; life: number; alive: boolean; gk: number; wait: number; age: number; fadeIn: number };
			const burstPool = (n: number): Burst[] => {
				const out: Burst[] = [];
				for (let i = 0; i < (reduced ? 0 : n); i += 1) {
					const front = i % 2 === 0;
					const s = new PIXI.Sprite(PIXI.Texture.EMPTY);
					s.anchor.set(0.5);
					s.visible = false;
					if (!front) s.tint = 0xd6cdbd;
					(front ? frontLayer : backLayer).addChild(s);
					out.push({ s, frames: [], f: 0, fi: -1, fps: 0, size: 0, front, vx: 0, vy: 0, vr: 0, life: 0, alive: false, gk: 1, wait: 0, age: 0, fadeIn: 0 });
				}
				return out;
			};
			const crossPool = burstPool(budget.crossing);
			const landPool = burstPool(budget.landing);
			let crossCursor = 0;
			const signHalf = () => (SIGN.w / 2) * kg * 0.97;
			const boardCy = () => centreY + (SIGN.boardY - SIGN.h / 2) * kg;
			/** the plank's bottom edge (the sign texture's foot) as drawn right now: breath, pops and the landing pulse */
			const plankBottom = () => restTop() + SIGN.boardY * kg + (SIGN.h - SIGN.boardY) * Math.max(kg, signBody.scale.y);
			/** tumbling coins and kit launched from the sign's rim: front pieces leave sideways (never across the title
			 *  or the figure), back pieces fan over the top. On a phone the gutters beside the sign are a few px wide, so
			 *  the front pieces spill off the plank's foot into the band under it instead (never up over the figure). */
			const emitBurst = (pool: Burst[], rung: number, power: number) => {
				const n = pool.length;
				for (let i = 0; i < n; i += 1) {
					const b = pool === crossPool ? pool[crossCursor++ % n] : pool[i];
					const u = n <= 1 ? 0.5 : i / (n - 1);
					const side = i % 4 < 2 ? -1 : 1;
					const size = signW0 * (b.front ? 0.11 : 0.075) * (0.8 + 0.4 * frac(u * 5.7));
					dress(b, rung, size);
					b.gk = 1;
					b.wait = 0;
					b.age = 0;
					b.fadeIn = 0;
					if (phone && b.front) {
						// born wholly under the plank (clear of the landing pulse's +10%) and never thrown upward. The births are
						// staggered in depth, time and speed and each piece fades in, so the spill leaves the plank's foot as a
						// cascade (judge: one row of coins at one y read as a string of beads for ~150 ms)
						const w = SIGN_META.plankW * kg * 0.9;
						const along = frac(u * 0.618 * n + 0.13) - 0.5;
						b.s.position.set(cx + along * w, plankBottom() + (SIGN.h - SIGN.boardY) * kg * 0.12 + size * 0.6 + size * 1.5 * frac(u * 7.1));
						b.vx = along * 2.2 * signW0 * (0.55 + 0.45 * frac(u * 3.7)) * power;
						b.vy = signW0 * (0.1 + 0.5 * frac(u * 2.9)) * power;
						b.gk = 0.5;
						b.wait = 140 * frac(u * 4.3 + 0.37);
						b.fadeIn = 80;
					} else {
						const a = b.front ? (side > 0 ? -0.95 + 1.25 * frac(u * 2.3) : Math.PI + 0.95 - 1.25 * frac(u * 2.3)) : -Math.PI / 2 + (u - 0.5) * Math.PI * 1.35;
						b.s.position.set(cx + Math.cos(a) * signHalf() * 0.95, boardCy() + Math.sin(a) * (BOARD.bottom - SIGN.boardY) * kg * 1.1);
						const v = (0.85 + 0.55 * frac(u * 3.3 + 0.2)) * power * signW0;
						b.vx = Math.cos(a) * v;
						b.vy = Math.sin(a) * v - signW0 * 0.45;
					}
					b.vr = (frac(u * 9.1) - 0.5) * 4;
					b.s.rotation = 0;
					b.life = 1450 + 350 * frac(u * 4.9);
					b.alive = true;
					b.s.visible = true;
					b.s.alpha = b.wait > 0 || b.fadeIn > 0 ? 0 : 1;
				}
			};
			const stepBursts = (pool: Burst[], dt: number) => {
				const g = signW0 * 2.5;
				for (const b of pool) {
					if (!b.alive) continue;
					if (b.wait > 0) {
						b.wait -= dt;
						if (b.wait > 0) continue;
					}
					b.age += dt;
					b.life -= dt;
					b.vy += (g * b.gk * dt) / 1000;
					b.s.x += (b.vx * dt) / 1000;
					b.s.y += (b.vy * dt) / 1000;
					b.s.rotation += (b.vr * dt) / 1000;
					tumble(b, dt);
					b.s.alpha = Math.min(1, b.life / 350) * (b.fadeIn > 0 ? Math.min(1, b.age / b.fadeIn) : 1);
					if (b.life <= 0 || b.s.y > view.y + view.h + b.size) {
						b.alive = false;
						b.s.visible = false;
					}
				}
			};

			// ---- embers: flame-orange sparks drifting up through the light ----
			type Ember = { s: PIXI.Sprite; vy: number; wob: number; base: number; on: boolean };
			const embers: Ember[] = [];
			const emberTex = tex('rung_fx_ember_dot');
			const emberTints = [0xff7a1a, 0xffa12e, 0xffc75a, 0xff5a14];
			const EMBER_CAP = rungFx(4, q, reduced).embers;
			const unit = Math.max(view.w, view.h);
			for (let i = 0; i < EMBER_CAP; i += 1) {
				const s = new PIXI.Sprite(emberTex);
				s.anchor.set(0.5);
				s.blendMode = 'add';
				s.tint = emberTints[i % emberTints.length];
				const size = unit * (0.006 + 0.01 * frac(i * 0.37));
				s.scale.set(size / 64);
				s.position.set(view.x + view.w * frac(i * 0.618 + 0.05), view.y + view.h * frac(i * 0.414 + 0.3));
				s.visible = false;
				emberLayer.addChild(s);
				embers.push({ s, vy: view.h * (0.05 + 0.07 * frac(i * 0.73)), wob: i * 2.3, base: s.x, on: false });
			}

			// ---- the crossing's spark ring (4-point glints) and the symbol volley ----
			const glintTex = tex('rung_fx_glint_4point');
			const sparks: PIXI.Sprite[] = [];
			for (let i = 0; i < rungFx(4, q, reduced).sparkRing; i += 1) {
				const s = new PIXI.Sprite(glintTex);
				s.anchor.set(0.5);
				s.blendMode = 'add';
				s.visible = false;
				sparkLayer.addChild(s);
				sparks.push(s);
			}
			let sparkT = -1;
			let sparkN = 0;
			type Tile = { s: PIXI.Sprite; vx: number; vy: number; vr: number; life: number; age: number; alive: boolean };
			const tiles: Tile[] = [];
			for (let i = 0; i < rungFx(4, q, reduced).volley; i += 1) {
				const s = new PIXI.Sprite(PIXI.Texture.EMPTY);
				s.anchor.set(0.5);
				s.visible = false;
				volleyLayer.addChild(s);
				tiles.push({ s, vx: 0, vy: 0, vr: 0, life: 0, age: 0, alive: false });
			}
			/** rotates each crossing volley's symbols (rungPacing volleyKey) */
			let volleyN = 0;
			/** the game's own symbol tiles fly in from the four screen edges (firefighter confetti). Along each edge the symbol
			 *  steps through the rung's keys (never one tile repeated down an edge), and every tile's launch point, swirl and
			 *  speed are jittered so the tiles from one edge FAN out instead of stacking on parallel paths. */
			const emitVolley = (rung: number) => {
				const n = Math.min(tiles.length, rungFx(rung, q, reduced).volley);
				const keys = RUNGS[rung].volley;
				volleyN += 1;
				for (let i = 0; i < n; i += 1) {
					const t = tiles[i];
					const texture = tex(`sym_${keys[volleyKey(i, keys.length, volleyN)]}`);
					if (texture === PIXI.Texture.EMPTY) continue;
					t.s.texture = texture;
					const size = Math.min(signW0 * 0.16, view.w * 0.1) * (i % 3 === 2 ? 0.62 : 1) * (0.9 + 0.2 * Math.random());
					t.s.scale.set(size / Math.max(1, texture.width));
					// launch ON a screen edge, aimed at the sign (rungPacing volleyLaunch, gated): the tile is placed there, so no
					// volley is born at the stage origin or where the last one died
					const l = volleyLaunch(i, n, view, cx, centreY, size, rung, Math.random(), Math.random(), Math.random());
					t.s.position.set(l.x0, l.y0);
					t.vx = l.vx;
					t.vy = l.vy;
					t.age = 0;
					t.vr = (i % 2 ? 1 : -1) * (2.2 + 0.4 * rung) * (0.75 + 0.5 * Math.random());
					t.s.rotation = Math.atan2(t.vy, t.vx) * 0.3;
					t.life = 1450 + 300 * Math.random();
					t.alive = true;
					t.s.visible = true;
				}
			};
			const stepTiles = (dt: number) => {
				const drag = Math.exp((-1.7 * dt) / 1000);
				const g = view.h * 0.5;
				for (const t of tiles) {
					if (!t.alive) continue;
					t.life -= dt;
					t.age += dt;
					t.vx *= drag;
					t.vy = t.vy * drag + (g * dt) / 1000;
					t.s.x += (t.vx * dt) / 1000;
					t.s.y += (t.vy * dt) / 1000;
					t.s.rotation += (t.vr * dt) / 1000;
					// a short fade-in (no tile pops in at full alpha) and the fade-out over its last 500 ms
					t.s.alpha = Math.max(0, Math.min(1, t.life / 500, t.age / 80));
					if (t.life <= 0) {
						t.alive = false;
						t.s.visible = false;
					}
				}
			};

			// ---- timeline state ----
			let idx = 0;
			let phase: 'enter' | 'count' | 'landed' | 'card' | 'out' = 'enter';
			let phaseT = 0;
			let clock = 0;
			let kg = k0 * grow(0);
			let kgFrom = kg;
			let kgTo = kg;
			let swapT = -1; // >= 0 while a board swap plays
			let flareT = -1; // >= 0 while a crossing flare plays
			let landT = -1; // >= 0 while the landing pulse plays
			// the light eases from one rung's StageLight to the next (colours and strengths together)
			let lightFrom: StageLight = sLight;
			let lightTo: StageLight = sLight;
			let lightT = 1;
			let shineT = -1;
			let shineClock = 600;
			let tickClock = 0;
			let cardShown = false;
			let cardClock = 0;
			/** the additive flash that covers the MAX sign -> card handover (rungPacing cardHandover) */
			let cardFlash = 0;
			let swayIn = 0;
			let done = false;
			let bed: string | undefined;
			const restTop = () => centreY - (SIGN.h / 2) * kg;
			// DEV ONLY (stripped from production builds): the capture driver reads the plank's foot to measure the light
			if (import.meta.env.DEV && typeof window !== 'undefined')
				(window as unknown as { __pffRungGeom?: () => unknown }).__pffRungGeom = () => {
					const foot = stage.toGlobal(new PIXI.Point(cx, plankBottom()));
					const left = stage.toGlobal(new PIXI.Point(cx - (BOARD.w / 2) * kg, restTop()));
					return { cx: foot.x, plankBottom: foot.y, boardLeft: left.x, signTop: left.y, rung: idx, phase, mood };
				};
			const startTop = view.y - SIGN.h * k0 - view.h * 0.1;
			signPivot.position.set(cx, reduced ? restTop() : startTop);
			if (reduced) signPivot.alpha = 0;
			const shakeAmp = (view.w / 1440) * (phone ? 1.6 : 1);

			// ONE bed at a time: the rung bed replaces whatever the scene was playing (grid-aligned
			// crossfade) and the scene's own bed comes back at the end — never two beds stacked.
			const sceneBed = audioManager.currentBed;
			// the higher rung beds, sequentially, so each lands before its crossing without contending with the first
			void (async () => {
				for (const r of RUNGS.slice(1, finalIdx + 1)) await audioManager.ensureDecoded([`rung_bed_${r.key}`]);
			})().catch(() => {});
			const setBed = (next: string | undefined) => {
				if (bed === next) return;
				try {
					const to = next ?? sceneBed ?? 'base_loop_a';
					audioManager.crossfadeToBed(to, next ? 260 : 700);
				} catch {
					/* ignore */
				}
				bed = next;
			};

			const mixLight = (a: StageLight, b: StageLight, t: number): StageLight => {
				const n = (x: number, y: number) => x + (y - x) * t;
				return {
					light: lerpColor(a.light, b.light, t),
					accent: lerpColor(a.accent, b.accent, t),
					core: lerpColor(a.core, b.core, t),
					pool: lerpColor(a.pool, b.pool, t),
					scrim: n(a.scrim, b.scrim),
					poolAlpha: n(a.poolAlpha, b.poolAlpha),
					bloom: n(a.bloom, b.bloom),
					coreAlpha: n(a.coreAlpha, b.coreAlpha),
					rayAlpha: n(a.rayAlpha, b.rayAlpha),
					vignette: n(a.vignette, b.vignette),
					vignette2: n(a.vignette2, b.vignette2),
					glow: n(a.glow, b.glow),
				};
			};
			const paintLight = () => {
				pool.tint = sLight.pool;
				bloom.tint = sLight.core;
				core.tint = sLight.accent;
				glow.tint = sLight.light;
				flash.tint = sLight.light;
				ring.tint = sLight.accent;
				rays.forEach((r, i) => (r.tint = i % 3 === 2 ? sLight.accent : sLight.light));
				rays2.forEach((r) => (r.tint = sLight.accent));
				if (plateTex !== PIXI.Texture.EMPTY) scrim.alpha = sLight.scrim;
				vignettes[0].alpha = sLight.vignette;
				vignettes[1].alpha = sLight.vignette2;
			};
			paintLight();

			/** a burst of sparks, pieces and tiles for the rung now showing (the first drop's landing and each crossing) */
			const celebrate = (rung: number, withFlare: boolean) => {
				if (reduced) return;
				emitBurst(crossPool, rung, 1.1);
				emitVolley(rung);
				sparkN = Math.min(sparks.length, rungFx(rung, q, reduced).sparkRing);
				sparkT = 0;
				sparks.forEach((s, i) => {
					s.visible = i < sparkN;
					s.tint = i % 2 ? 0xfff3b6 : 0xffd24b;
				});
				if (withFlare) flareT = 0;
				shineT = 0;
			};

			/** a crossing: the next board drops / pops in, the old one swells and fades, inside the flare */
			const swapTo = (to: number) => {
				if (to === idx) return;
				oldBoard.texture = board.texture;
				oldBoard.visible = true;
				oldBoard.alpha = 1;
				oldBoard.scale.set(1);
				idx = to;
				fx = rungFx(idx, q, reduced);
				board.texture = tex(`rung_sign_${RUNGS[idx].skin}`);
				glow.texture = tex(`rung_fx_glow_${RUNGS[idx].skin}`);
				dressShine(RUNGS[idx].skin);
				swapT = 0;
				kgFrom = kg;
				kgTo = k0 * grow(idx);
				lightFrom = sLight;
				lightTo = stageLight(idx, mood, phone);
				lightT = 0;
				rayBox2.visible = idx === 4 && rays2.length > 0;
				cue('rung_flare');
				cue(`rung_hit_${RUNGS[idx].key}`);
				cue(`sign_impact_${RUNGS[idx].skin}`);
				cue(RUNGS[idx].burstCue);
				setBed(`rung_bed_${RUNGS[idx].key}`);
				celebrate(idx, true);
			};

			const land = () => {
				if (phase === 'enter') {
					// a press during the drop: the sign is seated at once
					signPivot.position.set(cx, restTop());
					signPivot.rotation = 0;
					signPivot.alpha = 1;
					backdrop.alpha = 1;
				}
				phase = 'landed';
				phaseT = 0;
				// the landed rung is seen and heard even when the count never crossed to it (a skip press): one flare
				swapTo(finalIdx);
				setAmount(amount);
				cue('rung_land');
				cue(RUNGS[idx].burstCue);
				landT = 0;
				if (!reduced) {
					emitBurst(landPool, idx, 1.3);
					ring.alpha = 0.6;
					ring.scale.set(0.2 * (signW0 / 512));
				}
			};

			const finish = () => {
				if (done) return;
				done = true;
				clearTimeout(watchdog);
				setBed(undefined);
				stage.removeChildren().forEach((child: PIXI.ContainerChild) => child.destroy({ children: true }));
				if (import.meta.env.DEV && typeof window !== 'undefined') delete (window as unknown as { __pffRungGeom?: unknown }).__pffRungGeom;
				run = undefined;
				active = false;
				animBeats.emit({ beat: 'bigWinEnd', tier, amount: amount / 100 });
				resolve();
			};
			// a hidden tab stops the ticker: the awaited event still resolves (game/rungPacing.ts watchdogMs)
			const watchdog = setTimeout(finish, watchdogMs(plan, tl, finalIdx === 4));

			const startOut = () => {
				phase = 'out';
				phaseT = 0;
				cue('rung_out');
			};

			press = () => {
				if (phase === 'enter' || phase === 'count') land();
				else if (phase === 'landed' && phaseT > 250) {
					if (finalIdx === 4 && !cardShown) showCard();
					else startOut();
				} else if (phase === 'card' && phaseT > Math.min(400, tl.cardFadeMs + 80)) startOut();
			};

			const showCard = () => {
				phase = 'card';
				phaseT = 0;
				cardShown = true;
				const texture = tex(portraitCanvas ? 'maxwin_card_portrait' : 'maxwin_card_landscape');
				card.texture = texture;
				const ms = main.scale || 1;
				const fit = Math.min((cs.width / ms) * 0.9 / Math.max(1, texture.width), (cs.height / ms) * 0.8 / Math.max(1, texture.height));
				card.scale.set(fit);
				// portrait rides higher: at the landscape offset its foot sat under the HUD's ante chip (measured 390x844)
				cardBox.position.set(bl.x, main.height / 2 - (cs.height / ms) * (portraitCanvas ? 0.085 : 0.04));
				try {
					dressCard(texture.width * fit, texture.height * fit);
				} catch (error) {
					// presentation only: a failed dress still shows the art and can never hold the round
					console.warn('[WinRungs] max win card dress failed', error);
				}
				layoutStorm(texture.width * fit, texture.height * fit);
				// the embers keep drifting up OVER the card (never through its title band: stepEmbers)
				shakeBox.addChild(emberLayer);
				cue('win_max');
			};

			// ---- the MAX card's life: a coin storm at three depths, glint pops, a plank shine, a breath ----
			type StormCoin = Mote & { size: number; depth: number; x: number; y0: number; y1: number; phase: number; periodMs: number; wob: number; sway: number };
			const storm: StormCoin[] = [];
			type CardGlint = { s: PIXI.Sprite; t: number; life: number; wait: number; size: number };
			const cardGlints: CardGlint[] = [];
			if (finalIdx === 4 && !reduced) {
				// back coins first, so the three depths draw back to front
				for (let depth = 0; depth < 3; depth += 1) {
					for (let i = depth; i < budget.card; i += 3) {
						const s = new PIXI.Sprite(PIXI.Texture.EMPTY);
						s.anchor.set(0.5);
						s.visible = false;
						if (depth === 0) s.tint = 0xd9c79a;
						cardFx.addChild(s);
						storm.push({ s, frames: [], f: 0, fi: -1, fps: 0, size: 0, depth, x: 0, y0: 0, y1: 0, phase: frac(i * 0.618 + 0.21), periodMs: 1, wob: i * 1.37, sway: 0 });
					}
				}
				for (let i = 0; i < qv({ high: 8, mid: 5, low: 3 }); i += 1) {
					const s = new PIXI.Sprite(glintTex);
					s.anchor.set(0.5);
					s.blendMode = 'add';
					s.visible = false;
					s.tint = i % 2 ? 0xfff3c4 : 0xffd65a;
					cardFx.addChild(s);
					cardGlints.push({ s, t: 0, life: 650, wait: 180 + i * 240, size: 0 });
				}
			}
			/** the additive shine swept across the card's 20,000x plank (dressCard), and the plank's x span in cardBox units */
			let cardShine: PIXI.Sprite | undefined;
			let cardShineSpan: { x0: number; x1: number } | undefined;
			/** the card's no-coin zone (the title and the 20,000x plank), stage units; set by layoutStorm */
			let cardSafe = { x0: 0, y0: 0, x1: 0, y1: 0 };
			/** where storm coins and glints may go: the card's art beside / under the title band, plus the margins */
			let stormArea = { x0: 0, y0: 0, x1: 0, y1: 0 };
			const inSafe = (x: number, y: number, r = 0) => x > cardSafe.x0 - r && x < cardSafe.x1 + r && y > cardSafe.y0 - r && y < cardSafe.y1 + r;
			const layoutStorm = (w: number, h: number) => {
				const ox = cardBox.x, oy = cardBox.y;
				const safe = MAXWIN_CARD.titleSafeArea[portraitCanvas ? 'portrait' : 'landscape'];
				cardSafe = { x0: ox - w / 2 + safe.x * w, y0: oy - h / 2 + safe.y * h, x1: ox - w / 2 + (safe.x + safe.w) * w, y1: oy - h / 2 + (safe.y + safe.h) * h };
				// landscape: the art right of the title band; portrait: the art under it
				stormArea = portraitCanvas
					? { x0: ox - w / 2, y0: cardSafe.y1, x1: ox + w / 2, y1: oy + h / 2 }
					: { x0: cardSafe.x1, y0: oy - h / 2, x1: ox + w / 2, y1: oy + h / 2 };
				const u = Math.min(w, h);
				const sizes = [0.055, 0.08, 0.115];
				const periods = [3600, 2800, 2100];
				const marginL = ox - w / 2 - view.x, marginR = view.x + view.w - (ox + w / 2);
				storm.forEach((c, i) => {
					c.size = u * sizes[c.depth] * (0.85 + 0.3 * frac(c.wob * 3.3));
					// one coin in five falls in the screen margins beside the card (where the MAX rays turn)
					const inMargin = i % 5 === 4 && Math.max(marginL, marginR) > c.size;
					if (inMargin) {
						const right = (i % 2 === 0 && marginR > c.size) || marginL <= c.size;
						c.x = right ? ox + w / 2 + marginR * (0.3 + 0.4 * frac(c.wob)) : view.x + marginL * (0.3 + 0.4 * frac(c.wob));
						c.y0 = view.y - c.size;
						c.y1 = view.y + view.h + c.size;
					} else {
						c.x = stormArea.x0 + c.size + (stormArea.x1 - stormArea.x0 - c.size * 2) * frac(c.wob * 0.618 + 0.07);
						c.y0 = stormArea.y0 - (portraitCanvas ? 0 : c.size);
						c.y1 = stormArea.y1 + c.size;
					}
					c.periodMs = periods[c.depth] * ((c.y1 - c.y0) / Math.max(1, h)) * (0.85 + 0.3 * frac(c.wob * 5.1));
					c.sway = c.size * (0.4 + 0.6 * frac(c.wob * 2.2));
					c.frames = coinFrames();
					c.f = Math.random() * Math.max(1, c.frames.length);
					c.fi = -1;
					c.fps = (18 + 12 * frac(c.wob * 7.7)) * pieceFpsK;
					c.s.scale.set(c.size / CELL);
					c.s.alpha = c.depth === 0 ? 0.8 : 1;
					c.s.visible = c.frames.length > 0;
					tumble(c, 0);
				});
				cardGlints.forEach((g) => (g.size = u * (0.06 + 0.03 * frac(g.wait * 0.013))));
			};
			const stepCard = (dt: number) => {
				for (const c of storm) {
					if (!c.s.visible) continue;
					c.phase += dt / Math.max(1, c.periodMs);
					if (c.phase >= 1) c.phase -= 1;
					c.s.x = c.x + Math.sin(c.phase * Math.PI * 2 + c.wob) * c.sway;
					c.s.y = c.y0 + (c.y1 - c.y0) * c.phase;
					c.s.rotation = 0.3 * Math.sin(c.phase * Math.PI * 3 + c.wob);
					// portrait coins are born under the title band: they fade in there, never pop
					const fadeIn = portraitCanvas ? Math.min(1, c.phase * 8) : 1;
					c.s.alpha = (c.depth === 0 ? 0.8 : 1) * fadeIn * (inSafe(c.s.x, c.s.y, c.size * 0.5) ? 0 : 1);
					tumble(c, dt);
				}
				for (const g of cardGlints) {
					if (g.wait > 0) {
						g.wait -= dt;
						if (g.wait <= 0) {
							// pop somewhere on the art, clear of the title band
							const x = stormArea.x0 + (stormArea.x1 - stormArea.x0) * Math.random();
							const y = stormArea.y0 + (stormArea.y1 - stormArea.y0) * Math.random();
							g.s.position.set(x, y);
							g.t = 0;
							g.s.visible = !inSafe(x, y, g.size * 0.5);
						}
						continue;
					}
					g.t += dt;
					const p = Math.min(1, g.t / g.life);
					g.s.scale.set((g.size / 256) * Math.sin(Math.PI * p));
					g.s.rotation = p * 1.4;
					g.s.alpha = Math.sin(Math.PI * p);
					if (p >= 1) {
						g.s.visible = false;
						g.wait = 250 + 900 * Math.random();
					}
				}
				// the shine crosses the 20,000x plank every ~2 s
				if (cardShine && cardShineSpan) {
					const period = 2100;
					const t = (cardClock % period) / 700;
					if (t < 1) {
						const sp = cardShineSpan;
						cardShine.x = sp.x0 - cardShine.width + (sp.x1 - sp.x0 + cardShine.width * 2) * easeInOut(t);
						cardShine.alpha = 0.8 * Math.sin(Math.PI * t);
					} else cardShine.alpha = 0;
				}
			};

			/** frame, rounded corners, title and the multiple, laid out on a card of w x h px */
			const dressCard = (w: number, h: number) => {
				ensureSignFont();
				const u = Math.min(w, h);
				const rad = u * 0.04;
				const mask = new PIXI.Graphics().roundRect(-w / 2, -h / 2, w, h, rad).fill(0xffffff);
				cardBox.addChild(mask);
				card.mask = mask;

				const fw = Math.max(4, u * 0.018);
				const frame = new PIXI.Graphics();
				frame.roundRect(-w / 2 - fw * 0.6, -h / 2 - fw * 0.6, w + fw * 1.2, h + fw * 1.2, rad + fw * 0.6).stroke({ width: fw * 2.2, color: 0x2a1405 });
				frame.roundRect(-w / 2, -h / 2, w, h, rad).stroke({ width: fw, color: 0xffc53a });
				frame.roundRect(-w / 2 + fw, -h / 2 + fw, w - fw * 2, h - fw * 2, rad * 0.8).stroke({ width: Math.max(1, fw * 0.3), color: 0xfff1c9, alpha: 0.9 });
				cardBox.addChild(frame);

				// The art keeps a clear sky for the words (maxwin/manifest.json titleSafeArea, fractions of the card).
				// Landscape: the left third, title stacked over the multiple. Portrait: the band above the hero, title and
				// multiple on two lines.
				const title = winLevelMap[10].text;
				const face = (size: number, fill: number) => ({
					fontFamily: 'StationSign, Inter, sans-serif',
					fontSize: size,
					fill,
					align: 'center' as const,
					lineHeight: size * 1.0,
					stroke: { color: 0x2a1405, width: size * 0.17, join: 'round' as const },
					dropShadow: { color: 0xc77a00, distance: size * 0.07, angle: Math.PI / 2, blur: 0, alpha: 1 },
				});
				const safe = MAXWIN_CARD.titleSafeArea[portraitCanvas ? 'portrait' : 'landscape'];
				const band = { cx: -w / 2 + (safe.x + safe.w / 2) * w, top: -h / 2 + safe.y * h, w: safe.w * w, h: safe.h * h };
				const lines = portraitCanvas ? title : title.replace(' ', '\n');
				const longest = Math.max(...lines.split('\n').map((l) => l.length));
				const rows = lines.split('\n').length;
				const titleSize = Math.min((band.h * (portraitCanvas ? 0.5 : 0.56)) / rows, band.w / (longest * 0.74));
				const titleText = new PIXI.Text({ text: lines, style: face(titleSize, 0xfff1c9) });
				titleText.anchor.set(0.5);
				titleText.position.set(band.cx, band.top + (titleSize * rows) / 2 + band.h * 0.02);
				cardBox.addChild(titleText);

				// THE CARD CARRIES THE MULTIPLE, NEVER A CURRENCY FIGURE (owner, 2026-09-20: "the card should only be framed
				// with the x multiple ... we don't know what the user's bet will be"). The rung sign before it has already
				// counted up the player's real booked amount; the card is the moment's poster, and the one number that is
				// true at every stake is the multiple: 20,000x in every mode, read from the mode table (never typed).
				const multText = fmtX(Number(config.betModes.base.max_win));
				const plankH = portraitCanvas ? band.h * 0.44 : band.h * 0.27;
				const plankMaxW = band.w * (portraitCanvas ? 0.86 : 0.98);
				const plankY = band.top + band.h * 0.78;
				const multSize = Math.min(plankH * 0.74, (plankMaxW * 0.88) / (multText.length * 0.7));
				const mult = new PIXI.Text({ text: multText, style: face(multSize, 0xffd34d) });
				mult.anchor.set(0.5);
				mult.position.set(band.cx, plankY - multSize * 0.04);
				// the plank hugs the figure: a short line on a full-width plank read as an empty bar on a phone
				const hugW = Math.min(plankMaxW, mult.width + plankH * 1.1);
				const plank = new PIXI.Graphics();
				plank.roundRect(band.cx - hugW / 2, plankY - plankH / 2, hugW, plankH, plankH * 0.28).fill({ color: 0x2a1405, alpha: 0.9 });
				plank.roundRect(band.cx - hugW / 2, plankY - plankH / 2, hugW, plankH, plankH * 0.28).stroke({ width: Math.max(2, plankH * 0.07), color: 0xffc53a });
				cardBox.addChild(plank, mult);
				// a shine sweeps the plank every ~2 s (stepCard): an additive band stencil-masked to the plank (no filter);
				// reduced motion keeps the static card
				if (!reduced) {
					const plankMask = new PIXI.Graphics().roundRect(band.cx - hugW / 2, plankY - plankH / 2, hugW, plankH, plankH * 0.28).fill(0xffffff);
					const sh = new PIXI.Sprite(tex('rung_fx_shine_band'));
					sh.anchor.set(0.5);
					sh.blendMode = 'add';
					sh.rotation = 0.32;
					sh.height = plankH * 1.9;
					sh.width = plankH * 0.75;
					sh.y = plankY;
					sh.alpha = 0;
					sh.tint = 0xfff1c9;
					sh.mask = plankMask;
					cardBox.addChild(plankMask, sh);
					cardShine = sh;
					cardShineSpan = { x0: band.cx - hugW / 2, x1: band.cx + hugW / 2 };
				}
			};

			cue(`sign_impact_${RUNGS[0].skin}`);
			cue('rung_hit_big');
			setBed('rung_bed_big');

			run = {
				step: (dtRaw) => {
					if (done) return;
					// capped (a stall never jumps the timeline), yet high enough that the clock keeps wall time down to 10 fps
					const dt = Math.min(FRAME_STEP_CAP_MS, dtRaw);
					phaseT += dt;
					clock += dt;

					// ---- phases ----
					if (phase === 'enter') {
						backdrop.alpha = Math.min(1, phaseT / tl.enterMs);
						backLayer.alpha = frontLayer.alpha = backdrop.alpha;
						if (reduced) signPivot.alpha = backdrop.alpha;
						const p = tl.dropMs <= 0 ? 1 : Math.min(1, phaseT / tl.dropMs);
						signPivot.y = startTop + (restTop() - startTop) * easeOutBack(p);
						signPivot.rotation = reduced ? 0 : Math.sin(p * Math.PI * 2) * 0.035 * (1 - p);
						if (p >= 1 && (tl.dropMs > 0 || phaseT >= tl.enterMs * 0.5)) {
							phase = 'count';
							phaseT = 0;
							cue(RUNGS[0].burstCue);
							celebrate(0, false);
						}
					} else if (phase === 'count') {
						backdrop.alpha = Math.min(1, backdrop.alpha + dt / tl.enterMs);
						backLayer.alpha = frontLayer.alpha = backdrop.alpha;
						signPivot.alpha = Math.min(1, signPivot.alpha + dt / tl.enterMs);
						const { value, rung } = countAt(plan, phaseT);
						setAmount(value);
						if (rung > idx) swapTo(rung);
						// rising ticker (silent once the figure has reached the booked amount and only the rung is moving)
						tickClock -= dt;
						if (tickClock <= 0 && value < amount) {
							const n = 1 + Math.min(11, Math.floor((phaseT / plan.totalMs) * 12));
							cue(`count_ticker_${n}`);
							tickClock = 150;
						}
						if (phaseT >= plan.totalMs) land();
					} else if (phase === 'landed') {
						if (phaseT > (finalIdx === 4 ? tl.maxHoldMs : tl.holdMs)) {
							if (finalIdx === 4) showCard();
							else startOut();
						}
					} else if (phase === 'card') {
						// never a cross-dissolve (judge: 'WIN' beside 'MAX WIN', '$20,000.00' over '20,000x'): the sign clears
						// under an additive flash and the card LANDS at full alpha with a short overshoot, then breathes
						// 1.0 <-> 1.015. Reduced motion: the sign fades out, then the card fades in, still (rungPacing cardHandover)
						const h = cardHandover(phaseT, tl.cardFadeMs, reduced);
						cardBox.alpha = h.card;
						cardFx.alpha = h.card;
						const landK = reduced ? 1 : 0.82 + 0.18 * easeOutBack(h.land);
						const breatheK = reduced ? 1 : 1 + 0.0075 * (1 - Math.cos((cardClock / 2600) * Math.PI * 2));
						cardBox.scale.set(landK * breatheK);
						signPivot.alpha = h.sign;
						frontLayer.alpha = 1 - Math.min(1, phaseT / tl.cardFadeMs);
						cardFlash = h.flash;
						if (phaseT > tl.cardHoldMs) startOut();
					} else if (phase === 'out') {
						const p = Math.min(1, phaseT / tl.outMs);
						if (tl.slideOut) signPivot.y -= dt * 1.6 * (0.4 + p) * (main.height / 900);
						shakeBox.alpha = 1 - p;
						if (p >= 1) return finish();
					}

					if (cardShown) {
						cardClock += dt;
						stepCard(dt);
					}

					// ---- the sign: grow, breathe, sway, swap, pops ----
					if (swapT >= 0) {
						swapT += dt;
						const p = Math.min(1, swapT / tl.swapMs);
						kg = reduced ? kgTo : kgFrom + (kgTo - kgFrom) * easeOutBack(p);
						// two titles never mix (rungPacing boardSwapAlpha): the new board is solid from its first frame (the
						// entrance is the drop + pop, never a fade) while the old one swells and fades BEHIND it; reduced motion
						// has no travel, so the old board fades out and THEN the new one fades in
						const sa = boardSwapAlpha(p, reduced);
						board.alpha = sa.board;
						oldBoard.alpha = sa.old;
						if (!reduced) {
							boardHolder.scale.set(0.84 + 0.16 * easeOutBack(p));
							boardHolder.y = SIGN.boardY - (1 - easeOut(p)) * SIGN.h * 0.1;
							oldBoard.scale.set(1 + 0.18 * p);
						}
						if (p >= 1) {
							swapT = -1;
							oldBoard.visible = false;
							boardHolder.scale.set(1);
							boardHolder.y = SIGN.boardY;
							board.alpha = 1;
						}
					}
					if (lightT < 1) {
						lightT = Math.min(1, lightT + dt / Math.max(1, tl.swapMs));
						sLight = mixLight(lightFrom, lightTo, lightT);
						paintLight();
					}
					let pop = 0;
					let amountPop = 0;
					if (flareT >= 0) {
						flareT += dt;
						const ft = Math.min(1, flareT / tl.flareMs);
						const env = Math.sin(Math.PI * ft);
						pop = 0.06 * env;
						amountPop = 0.09 * Math.sin(Math.PI * Math.min(1, flareT / (tl.flareMs * 1.3)));
						const a = fx.shakePx * shakeAmp * (1 - ft);
						shakeBox.position.set(Math.sin(ft * 8 * Math.PI) * a, Math.cos(ft * 6 * Math.PI) * a * 0.6);
						flash.alpha = ft < 0.4 ? 0.1 * (1 - ft / 0.4) : 0;
						if (flareT >= tl.flareMs * 1.3) {
							flareT = -1;
							shakeBox.position.set(0, 0);
							flash.alpha = 0;
						}
					}
					// the MAX card's entrance flash (cardHandover; 0 under reduced motion) rides over any flare still playing
					if (phase === 'card') flash.alpha = Math.max(flareT >= 0 ? flash.alpha : 0, cardFlash);
					let pulse = 0;
					if (landT >= 0) {
						landT += dt;
						const p = Math.min(1, landT / tl.landPulseMs);
						pulse = reduced ? 0 : 0.1 * Math.sin(Math.PI * p) * (1 - p * 0.5);
						if (!reduced) {
							const rp = Math.min(1, landT / tl.ringMs);
							ring.position.set(cx, lightY());
							ring.alpha = Math.max(0, 0.6 * (1 - rp));
							ring.scale.set((0.2 + fx.ringScale * easeOut(rp)) * (signW0 / 512));
						}
						if (landT >= Math.max(tl.landPulseMs, tl.ringMs)) landT = -1;
					}
					const breath = 1 + fx.breath * 0.5 * (1 - Math.cos((clock / 2000) * Math.PI * 2));
					if (phase !== 'enter') {
						// the chains take up their sway after the drop settles (no jump from the drop's wobble)
						swayIn = Math.min(1, swayIn + dt / 900);
						signPivot.rotation = fx.sway * swayIn * Math.sin((clock / 3400) * Math.PI * 2);
						if (phase !== 'out') signPivot.y = restTop();
					}
					signBody.position.set(0, SIGN.boardY * kg);
					signBody.scale.set(kg * breath * (1 + pop + pulse));
					// the figure rides the board holder, so during a swap it stays on the NEW board's plank as it drops in
					const hs = boardHolder.scale.y;
					amountBox.position.set(AMOUNT_NUDGE_X * hs, boardHolder.y + (SIGN.plankY - FONT_SIZE * GOLD_INK_DY - SIGN.boardY) * hs);
					amountBox.scale.set(amountFit * hs * (1 + amountPop));
					// the glow copy follows its sign: through a reduced-motion swap's dip it dims with the boards (a lone white
					// halo read as a blank light box between the titles)
					glow.alpha = reduced
						? sLight.glow * (swapT >= 0 ? Math.max(board.alpha, oldBoard.alpha) : 1)
						: Math.min(1, sLight.glow + 0.3 * Math.sin((clock / 1600) * Math.PI * 2) + (swapT >= 0 ? 0.5 * (1 - swapT / tl.swapMs) : 0));

					// shine sweep across the title board
					if (!reduced) {
						shineClock -= dt;
						if (shineClock <= 0 && shineT < 0) shineT = 0;
						if (shineT >= 0) {
							shineT += dt;
							const p = Math.min(1, shineT / 700);
							shine.x = -BOARD.w / 2 - shine.width + (BOARD.w + shine.width * 2) * easeInOut(p);
							shine.alpha = 0.75 * Math.sin(Math.PI * p);
							shine.tint = sLight.accent;
							if (p >= 1) {
								shineT = -1;
								shine.alpha = 0;
								shineClock = fx.shineEveryMs;
							}
						}
					}

					// ---- light ----
					const ly = lightY();
					// under the MAX card the light slides to the card's centre and the rays brighten, so they keep turning
					// around its edges
					const cardK = cardShown ? Math.min(1, cardClock / Math.max(1, tl.cardFadeMs)) : 0;
					lightBox.position.set(cx + (cardBox.x - cx) * cardK, ly + (cardBox.y - ly) * cardK);
					const lw = signW0 * grow(idx);
					// reduced motion: the stage light dips with whatever covers it (the boards through a swap, sign or card through
					// the MAX handover), so no white-hot light shows through the gap as a flash
					const cover = !reduced ? 1 : swapT >= 0 ? Math.max(board.alpha, oldBoard.alpha) : cardShown ? Math.max(signPivot.alpha, cardBox.alpha) : 1;
					// a phone's sign spans the screen: the light keeps its falloff INSIDE the view there, so the edges stay dim
					const wMax = (k: number) => (phone ? Math.min(lw * k, view.w * (k / LIGHT_SIZE.bloomW) * 1.2) : lw * k);
					pool.width = wMax(LIGHT_SIZE.poolW);
					pool.height = lw * LIGHT_SIZE.poolH;
					pool.alpha = sLight.poolAlpha * cover;
					bloom.width = wMax(LIGHT_SIZE.bloomW);
					bloom.height = lw * LIGHT_SIZE.bloomH;
					bloom.alpha = (sLight.bloom * (1 + (reduced ? 0 : 0.12 * Math.sin((clock / 2000) * Math.PI * 2))) + (flareT >= 0 ? 0.2 * (1 - flareT / (tl.flareMs * 1.3)) : 0)) * cover;
					core.width = lw * LIGHT_SIZE.coreW;
					core.height = lw * LIGHT_SIZE.coreH;
					core.alpha = sLight.coreAlpha * cover;
					const rw = fx.rayWidth;
					const rayA = Math.min(0.75, sLight.rayAlpha * (1 + (reduced ? 0 : 0.4 * cardK)) * cover);
					for (const r of rays) {
						r.scale.set((rayLen / 512) * 0.74 * rw, rayLen / 512);
						r.alpha = rayA;
					}
					for (const r of rays2) {
						r.scale.set((rayLen / 512) * 0.4 * rw, rayLen / 512);
						r.alpha = rayA * 0.7;
					}
					rayBox.rotation += fx.raySpeed * dt;
					rayBox2.rotation -= fx.raySpeed * 0.7 * dt;

					// ---- embers ----
					for (let i = 0; i < embers.length; i += 1) {
						const e = embers[i];
						const want = i < fx.embers;
						if (!want) {
							e.s.visible = false;
							continue;
						}
						if (!e.on) {
							e.on = true;
							e.s.visible = true;
						}
						e.s.y -= (e.vy * dt) / 1000;
						e.s.x = e.base + Math.sin(clock * 0.0011 + e.wob) * view.w * 0.02;
						const hgt = (e.s.y - view.y) / view.h;
						e.s.alpha = (0.55 + 0.45 * Math.sin(clock * 0.012 + e.wob * 5)) * Math.min(1, hgt * 3) * Math.min(1, (1 - hgt) * 4);
						// over the MAX card the embers never cross its title / 20,000x band
						if (cardShown && inSafe(e.s.x, e.s.y, 6)) e.s.alpha = 0;
						if (e.s.y < view.y - 10) {
							e.s.y = view.y + view.h + 10;
							e.base = view.x + view.w * frac(e.base * 0.001 + e.wob * 0.618);
						}
					}

					// ---- side rain ----
					const half = signHalf();
					for (let i = 0; i < rain.length; i += 1) {
						const d = rain[i];
						if (i >= fx.rain) {
							d.s.visible = false;
							continue;
						}
						if (!d.on) {
							d.on = true;
							d.periodMs = rainPeriod(d, idx) * spillK(d);
							dress(d, idx, rainSize(d));
						}
						d.phase += dt / d.periodMs;
						if (d.phase >= 1) {
							d.phase -= 1;
							d.periodMs = rainPeriod(d, idx) * spillK(d);
							dress(d, idx, rainSize(d));
						}
						if (phone && d.front) {
							// phones: the gutters beside the sign are a few px wide, so the front rain spills off the plank's
							// foot and falls through the band under it, across the whole width
							const top = plankBottom();
							const bot = hudTop + d.size * 0.5;
							if (bot - top < d.size * 2.5) {
								d.s.visible = false;
								continue;
							}
							d.s.visible = true;
							d.s.x = cx + d.side * (view.w / 2 - d.size * 0.6) * Math.min(1, 0.06 + 0.88 * d.band + 0.05 * Math.sin(d.phase * Math.PI * 2 + d.wob));
							d.s.y = top + (bot - top) * d.phase;
							d.s.rotation = d.side * 0.25 * Math.sin(d.phase * Math.PI * 3 + d.wob);
							d.s.alpha = Math.min(1, d.phase * 6) * Math.min(1, (1 - d.phase) * 5);
							tumble(d, dt);
							continue;
						}
						const room = d.side > 0 ? view.x + view.w - cx : cx - view.x;
						const inner = d.front ? half * 0.93 + d.size * 0.5 : half * 0.3;
						const outer = room - d.size * 0.4;
						if (outer <= inner) {
							d.s.visible = false;
							continue;
						}
						const off = inner + (outer - inner) * Math.min(1, Math.max(0, 0.12 + 0.76 * d.band + 0.1 * Math.sin(d.phase * Math.PI * 2 + d.wob)));
						d.s.visible = true;
						d.s.x = cx + d.side * off;
						d.s.y = view.y - d.size + (view.h + d.size * 2) * d.phase;
						d.s.rotation = d.side * 0.25 * Math.sin(d.phase * Math.PI * 3 + d.wob);
						d.s.alpha = Math.min(1, Math.sin(d.phase * Math.PI) * 1.8) * (d.front ? 1 : 0.85);
						tumble(d, dt);
					}
					stepBursts(crossPool, dt);
					stepBursts(landPool, dt);
					stepTiles(dt);

					// ---- spark ring ----
					if (sparkT >= 0) {
						sparkT += dt;
						const t = Math.min(1, sparkT / 520);
						const r = half * (0.55 + 0.85 * easeOut(t));
						const gs = (signW0 * 0.09) / 256;
						for (let i = 0; i < sparkN; i += 1) {
							const s = sparks[i];
							const a = (i / sparkN) * Math.PI * 2 + clock * 0.0004;
							s.position.set(cx + Math.cos(a) * r, ly + Math.sin(a) * r * 0.62);
							s.scale.set(gs * (1 - 0.6 * t) * (i % 2 ? 1 : 0.7));
							s.alpha = Math.pow(1 - t, 1.2);
							s.rotation = t * 1.2;
						}
						if (t >= 1) {
							sparkT = -1;
							sparks.forEach((s) => (s.visible = false));
						}
					}
				},
			};
		});
	};

	context.eventEmitter.subscribeOnMount({
		winRungs: async ({ amount, level, tier }) => {
			// DEV ONLY (stripped from production builds): the smoke driver (qa/smoke/port/smoke.mjs) records every climb
			if (import.meta.env.DEV && typeof window !== 'undefined') ((window as unknown as { __pffRungs?: unknown[] }).__pffRungs ??= []).push({ amount, level });
			if (!root || run || presenting) return;
			active = true;
			presenting = true;
			// the rung tier for the rig beats: 2 BIG … 6 MAX (rungLevelOfTier: level = tier + 4)
			const rungTier = Math.max(2, Math.min(6, tier ?? level - 4)) as WinRungTier;
			try {
				await present(amount, level, rungTier);
			} finally {
				presenting = false;
				active = false;
			}
		},
	});

	onMount(() => {
		const ticker = app.stateApp.pixiApplication?.ticker;
		const tick = (tk: PIXI.Ticker) => run?.step(tk.deltaMS);
		ticker?.add(tick);
		return () => {
			ticker?.remove(tick);
			frameCache.forEach((frames) => frames.forEach((f) => f.destroy(false)));
			frameCache.clear();
		};
	});
</script>

<!-- Above the base board AND the bonus scene (whose containers join the stage later than this one),
     below the roller shutter (zIndex 50). -->
<Container zIndex={40}>
	<MainContainer>
		<Container>
			<Grab ongrab={(node) => (root = node)} />
		</Container>
	</MainContainer>
</Container>

{#if active}
	<OnHotkey hotkey="Space" onpress={() => press()} />
	<OnPressFullScreen onpress={() => press()} />
{/if}
