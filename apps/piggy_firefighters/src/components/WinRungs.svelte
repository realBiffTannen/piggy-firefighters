<script lang="ts" module>
	export type WinRungScale = 'standard' | 'endFeature';
	export type EmitterEventWinRungs = {
		type: 'winRungs';
		/** booked amount, integer x100 of the base bet */
		amount: number;
		/** booked winLevel, 6 (big) … 10 (max) */
		level: number;
		/** which math threshold table produced `level` (math/src/config/config.py get_win_level) */
		scale: WinRungScale;
	};

	import { END_FEATURE_FLOORS, STANDARD_FLOORS, WIN_CAP_BOOKED } from '../game/roundTier';

	/** Rung floors BIG, HUGE, MEGA, EPIC, MAX in booked units (x100 of the base bet), derived from the ONE client
	 *  copy of the math's win-level tables (game/roundTier.ts): levels 6-9 from the table, MAX = the 15,000x cap.
	 *  The frontend never shows a rung the booked `winLevel` does not reach; these only pace the climb towards it. */
	const rungFloors = (floors: readonly (readonly [number, number])[]) => [
		...[6, 7, 8, 9].map((level) => floors.find(([l]) => l === level)![1]),
		WIN_CAP_BOOKED,
	];
	const THRESHOLDS: Record<WinRungScale, number[]> = {
		standard: rungFloors(STANDARD_FLOORS),
		endFeature: rungFloors(END_FEATURE_FLOORS),
	};
</script>

<script lang="ts">
	// WIN RUNGS — the climbing sign. BIG -> HUGE -> MEGA -> EPIC -> MAX (theme §5). The
	// count runs continuously; each time it crosses a rung the sign flips over to the next
	// rung's plate inside a horizontal flare, the wash changes colour and a fresh burst of that rung's
	// pieces tumbles out with gravity. The amount is always the clearest thing on screen. MAX ends on
	// the max win card. One press skips to the landed total, a second press leaves.
	//
	// Imperative PIXI on the live container, ONE ticker callback, pooled pieces (<= 60 live).
	import { onMount } from 'svelte';
	import { Container, PIXI, getContextApp } from 'pixi-svelte';
	import { MainContainer, OnPressFullScreen } from 'components-layout';
	import { OnHotkey } from 'components-shared';

	import Grab from './scene/Grab.svelte';
	import { getContext } from '../game/context';
	import { formatBookAmount } from '../game/money';
	import { audioManager } from '../game/audio/audioManager';
	import { sceneTex } from '../game/fx/sceneTextures.svelte';
	import { prefersReducedMotion, isTurbo } from '../game/fx/timing';
	import { ensureSignFont } from '../game/fx/signPanel';
	import { winLevelMap } from '../game/winLevelMap';
	import config from '../game/config';
	import { fmtX } from '../game/format';
	import { RUNG_SKINS } from '../game/assetsScene';

	const context = getContext();
	const app = getContextApp();

	type Rung = {
		key: 'big' | 'huge' | 'mega' | 'epic' | 'max';
		/** sign art key suffix: `rung_sign_<skin>` (game/assetsScene.ts RUNG_SKINS) */
		skin: (typeof RUNG_SKINS)[number];
		wash: number;
		pieces: string[];
		burstCue: string;
	};
	const RUNGS: Rung[] = [
		// PLACEHOLDER skins / pieces (static/assets/placeholder/rungs): the art lane re-skins BIG -> HUGE -> MEGA -> EPIC
		// -> MAX in firefighting art (theme §5); keys and thresholds stay.
		{ key: 'big', skin: 'big', wash: 0x1e2a4a, pieces: ['droplet', 'coin'], burstCue: 'burst_water' },
		{ key: 'huge', skin: 'huge', wash: 0x7c1016, pieces: ['ember', 'coin'], burstCue: 'burst_embers' },
		{ key: 'mega', skin: 'mega', wash: 0x4b2f7d, pieces: ['ember', 'badge', 'coin'], burstCue: 'burst_badges' },
		{ key: 'epic', skin: 'epic', wash: 0x8f1c27, pieces: ['coin', 'badge', 'ember'], burstCue: 'burst_coins' },
		{ key: 'max', skin: 'max', wash: 0x171105, pieces: ['coin', 'badge', 'ember', 'droplet'], burstCue: 'burst_gold' },
	];
	// sign texture geometry (placeholder static/assets/placeholder/rungs/sign_<skin>.webp, 1200x728)
	const SIGN = { w: 1200, h: 728, boardY: 338, plankY: 634, plankW: 820 };
	/** the gold bitmap font's ink centre, as a fraction of fontSize below the anchor (see build()) */
	const GOLD_INK_DY = 0.1;
	const PIECE_GRID: Record<string, { frames: number; cols: number }> = {
		coin: { frames: 24, cols: 8 },
		ember: { frames: 24, cols: 8 },
		droplet: { frames: 24, cols: 8 },
		badge: { frames: 24, cols: 8 },
	};
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
		const grid = PIECE_GRID[name] ?? { frames: 32, cols: 8 };
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

	const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
	const easeOutBack = (p: number) => 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2);
	const lerpColor = (a: number, b: number, t: number) => {
		const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
		const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
		return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
	};

	// one run at a time; everything the ticker needs lives here
	type Piece = { s: PIXI.Sprite; frames: PIXI.Texture[]; f: number; fps: number; vx: number; vy: number; vr: number; life: number };
	type Run = { step: (dt: number) => void };
	let run: Run | undefined;

	const present = (amount: number, level: number, scale: WinRungScale) =>
		new Promise<void>((resolve) => {
			if (!root) return resolve();
			const stage = root;
			const reduced = prefersReducedMotion();
			const fast = isTurbo() ? 2 : 1;
			const finalIdx = Math.max(0, Math.min(4, level - 6));
			const thresholds = THRESHOLDS[scale];

			const main = context.stateLayoutDerived.mainLayout();
			const bl = context.stateGameDerived.boardLayout();
			const portrait = context.stateGameDerived.sceneLayout().stacked;
			const signW = Math.min(bl.width * bl.scale * (portrait ? 1.0 : 0.92), main.width * 0.94);
			const k = signW / SIGN.w;
			// the sign's pivot is its title-board centre; this centres the WHOLE sign (board + amount plank) on the reels
			const restY = bl.y - 26 * k;
			const startY = -SIGN.h * k - main.height * 0.35;

			// ---- display tree ----
			const wash = new PIXI.Graphics().rect(-6000, -6000, 12000, 12000).fill(0xffffff);
			wash.tint = RUNGS[0].wash;
			wash.alpha = 0;
			const pieceLayer = new PIXI.Container();
			const sign = new PIXI.Container();
			const board = new PIXI.Sprite(tex(`rung_sign_${RUNGS[0].skin}`));
			board.anchor.set(0.5, 0);
			const label = new PIXI.BitmapText({ text: '', style: { fontFamily: 'gold', fontSize: 132, align: 'center' } });
			label.anchor.set(0.5);
			// Pixi 8 anchors a BitmapText on its line box, not its ink: measured on the live build, the
			// gold digits' ink centre sits ~0.10 x fontSize BELOW the anchor (interGold: lineHeight 266,
			// base 194, digit ink rows 42-224). Lift it so the figure is centred on the plank (owner,
			// 2026-09-19: "this needs to get aligned vertically").
			label.position.set(0, SIGN.plankY - 132 * GOLD_INK_DY);
			sign.addChild(board, label);
			sign.pivot.set(0, SIGN.boardY);
			sign.scale.set(k);
			sign.position.set(bl.x, startY);
			const flare = new PIXI.Sprite(tex('rung_fx_flare_horizontal'));
			flare.anchor.set(0.5);
			flare.blendMode = 'add';
			flare.alpha = 0;
			flare.position.set(bl.x, 0);
			const ring = new PIXI.Sprite(tex('rung_fx_ring_shockwave'));
			ring.anchor.set(0.5);
			ring.blendMode = 'add';
			ring.alpha = 0;
			const card = new PIXI.Sprite(PIXI.Texture.EMPTY);
			card.anchor.set(0.5);
			// THE MAX WIN CARD IS A CARD, NOT A PICTURE (owner, 2026-09-20: "a unique presentation card for the max win
			// hit"). The art was always unique to this moment and title-free by design, but
			// the runtime half was never written: it came up as a bare hard-edged rectangle with an empty sky where the
			// title belongs. `cardBox` carries the art behind rounded corners, a gold frame, the MAX WIN title and the
			// 15,000x multiple on a plank (never a currency figure: owner ruling, see dressCard). Everything is a child of `cardBox`, so `finish()` destroys it
			// with the rest of the stage.
			const cardBox = new PIXI.Container();
			cardBox.alpha = 0;
			cardBox.addChild(card);
			stage.addChild(wash, pieceLayer, ring, sign, flare, cardBox);

			const setAmount = (value: number) => {
				label.text = formatBookAmount(value);
				label.scale.set(1);
				const fit = Math.min(1, SIGN.plankW / Math.max(1, label.width));
				label.scale.set(fit);
			};
			setAmount(0);

			// ---- pieces ----
			const pieces: Piece[] = [];
			const spawn = (rung: Rung, count: number, power: number) => {
				if (reduced) return;
				for (let i = 0; i < count && pieces.length < 60; i += 1) {
					const name = rung.pieces[Math.floor(Math.random() * rung.pieces.length)];
					const frames = pieceFrames(name);
					if (!frames.length) continue;
					const s = new PIXI.Sprite(frames[0]);
					s.anchor.set(0.5);
					const size = (0.6 + Math.random() * 0.8) * signW * 0.115;
					s.scale.set(size / CELL);
					s.position.set(bl.x + (Math.random() - 0.5) * signW * 0.7, sign.y);
					const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.1;
					const v = (0.55 + Math.random() * 0.65) * power * signW;
					pieces.push({
						s,
						frames,
						f: Math.random() * frames.length,
						fps: 18 + Math.random() * 16,
						vx: Math.cos(ang) * v,
						vy: Math.sin(ang) * v,
						vr: (Math.random() - 0.5) * 3,
						life: 2600,
					});
					pieceLayer.addChild(s);
				}
			};

			// ---- timeline state ----
			const segMs = (reduced ? 500 : 1500) / fast;
			const dropMs = (reduced ? 0 : 480) / fast;
			const countMs = segMs * (finalIdx + 1) + 600 / fast;
			let idx = 0;
			let phase: 'drop' | 'count' | 'landed' | 'card' | 'out' = 'drop';
			let phaseT = 0;
			let flipT = -1; // >= 0 while the sign is flipping
			let flipTo = 0;
			let washFrom = RUNGS[0].wash;
			let washT = 1;
			let tickClock = 0;
			let trickle = 0;
			let bed: string | undefined;

			// ONE bed at a time: the rung bed replaces whatever the scene was playing (grid-aligned
			// crossfade) and the scene's own bed comes back at the end — never two beds stacked.
			const sceneBed = audioManager.currentBed;
			void audioManager.ensureDecoded(RUNGS.slice(0, finalIdx + 1).map((r) => `rung_bed_${r.key}`));
			const setBed = (next: string | undefined) => {
				if (bed === next) return;
				try {
					const to = next ?? sceneBed ?? 'base_loop';
					audioManager.crossfadeToBed(to, next ? 260 : 700);
				} catch {
					/* ignore */
				}
				bed = next;
			};

			// value as a function of count time: equal time per rung, so the climb is evenly paced. The figure only
			// ever counts UP and never shows more than the booked amount: every bound is clamped to `amount`, so a
			// segment whose floor sits at/above the booked amount (the MAX segment of a capped round, whose floor IS
			// the cap) holds the landed figure while its rung flips, instead of starting above it.
			const valueAt = (ms: number) => {
				const p = Math.min(1, ms / countMs);
				const seg = Math.min(finalIdx, Math.floor(p * (finalIdx + 1)));
				const local = p * (finalIdx + 1) - seg;
				// rung `i` starts at thresholds[i]; the first segment counts up from zero
				const lo = seg === 0 ? 0 : Math.min(amount, thresholds[seg]);
				const hi = seg === finalIdx ? amount : Math.min(amount, thresholds[seg + 1]);
				return p >= 1 ? amount : Math.min(amount, Math.floor(lo + (hi - lo) * Math.min(1, local)));
			};
			// MAX (rung 4) flips exactly when the figure reaches the cap: thresholds[4] is WIN_CAP_BOOKED.
			const rungAt = (value: number) => {
				let r = 0;
				for (let i = 1; i <= finalIdx; i += 1) if (value >= thresholds[i]) r = i;
				return r;
			};

			const startFlip = (to: number) => {
				flipTo = to;
				flipT = 0;
				washFrom = RUNGS[idx].wash;
				washT = 0;
				flare.alpha = 0;
				cue('rung_flare');
			};

			const land = () => {
				phase = 'landed';
				phaseT = 0;
				if (idx !== finalIdx) {
					idx = finalIdx;
					board.texture = tex(`rung_sign_${RUNGS[idx].skin}`);
					wash.tint = RUNGS[idx].wash;
					washT = 1;
					// the landed rung is heard even when the count never flipped to it (a skip press, or one long
					// frame past countMs): its hit + bed fire here, once — the flip path above did not fire them
					cue(`rung_hit_${RUNGS[idx].key}`);
					cue(`sign_impact_${RUNGS[idx].skin}`);
					setBed(`rung_bed_${RUNGS[idx].key}`);
				}
				flipT = -1;
				sign.scale.set(k);
				setAmount(amount);
				cue('rung_land');
				cue(RUNGS[idx].burstCue);
				spawn(RUNGS[idx], 22, 1.25);
				ring.position.set(bl.x, sign.y + (SIGN.plankY - SIGN.boardY) * k);
				ring.alpha = 0.9;
				ring.scale.set(0.2);
			};

			const finish = () => {
				setBed(undefined);
				stage.removeChildren().forEach((child: PIXI.ContainerChild) => child.destroy({ children: true }));
				run = undefined;
				active = false;
				resolve();
			};

			press = () => {
				if (phase === 'drop' || phase === 'count') land();
				else if (phase === 'landed' && phaseT > 250) {
					if (finalIdx === 4 && card.texture === PIXI.Texture.EMPTY) showCard();
					else {
						phase = 'out';
						phaseT = 0;
						cue('rung_out');
					}
				} else if (phase === 'card' && phaseT > 400) {
					phase = 'out';
					phaseT = 0;
					cue('rung_out');
				}
			};

			const showCard = () => {
				phase = 'card';
				phaseT = 0;
				const texture = tex(portrait ? 'maxwin_card_portrait' : 'maxwin_card_landscape');
				card.texture = texture;
				const cs = context.stateLayoutDerived.canvasSizes();
				const ms = main.scale || 1;
				const fit = Math.min((cs.width / ms) * 0.9 / Math.max(1, texture.width), (cs.height / ms) * 0.8 / Math.max(1, texture.height));
				card.scale.set(fit);
				// portrait rides higher: at the landscape offset its foot sat under the HUD's ante chip (measured 390x844)
				cardBox.position.set(bl.x, main.height / 2 - (cs.height / ms) * (portrait ? 0.085 : 0.04));
				try {
					dressCard(texture.width * fit, texture.height * fit);
				} catch (error) {
					// presentation only: a failed dress still shows the art and can never hold the round
					console.warn('[WinRungs] max win card dress failed', error);
				}
				cue('win_max');
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

				// The art keeps a clear sky for the words. Landscape: the left half, title stacked over the multiple.
				// Portrait: the band above the hero, title and multiple on two lines.
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
				const band = portrait
					? { cx: 0, top: -h / 2 + h * 0.035, w: w * 0.88, h: h * 0.2 }
					: { cx: -w / 2 + w * 0.27, top: -h / 2 + h * 0.2, w: w * 0.44, h: h * 0.6 };
				const lines = portrait ? title : title.replace(' ', '\n');
				const longest = Math.max(...lines.split('\n').map((l) => l.length));
				const rows = lines.split('\n').length;
				const titleSize = Math.min((band.h * (portrait ? 0.5 : 0.56)) / rows, band.w / (longest * 0.74));
				const titleText = new PIXI.Text({ text: lines, style: face(titleSize, 0xfff1c9) });
				titleText.anchor.set(0.5);
				titleText.position.set(band.cx, band.top + (titleSize * rows) / 2 + band.h * 0.02);
				cardBox.addChild(titleText);

				// THE CARD CARRIES THE MULTIPLE, NEVER A CURRENCY FIGURE (owner, 2026-09-20: "the card should only be framed
				// with the x multiple ... we don't know what the user's bet will be"). The rung sign before it has already
				// counted up the player's real booked amount; the card is the moment's poster, and the one number that is
				// true at every stake is the multiple: 15,000x in every mode, read from the mode table (never typed).
				const multText = fmtX(Number(config.betModes.base.max_win));
				const plankH = portrait ? band.h * 0.44 : band.h * 0.27;
				const plankMaxW = band.w * (portrait ? 0.86 : 0.98);
				const plankY = portrait ? band.top + band.h * 0.78 : band.top + band.h * 0.78;
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
			};

			cue(`sign_impact_${RUNGS[0].skin}`);
			cue('rung_hit_big');
			setBed('rung_bed_big');

			run = {
				step: (dtRaw) => {
					const dt = Math.min(50, dtRaw);
					phaseT += dt;

					// wash
					wash.alpha = Math.min(0.8, wash.alpha + dt / 300);
					if (washT < 1) {
						washT = Math.min(1, washT + dt / (320 / fast));
						wash.tint = lerpColor(washFrom, RUNGS[flipTo].wash, washT);
					}

					if (phase === 'drop') {
						const p = dropMs <= 0 ? 1 : Math.min(1, phaseT / dropMs);
						sign.y = startY + (restY - startY) * easeOutBack(p);
						sign.rotation = Math.sin(p * Math.PI * 2) * 0.03 * (1 - p);
						if (p >= 1) {
							phase = 'count';
							phaseT = 0;
							spawn(RUNGS[0], 20, 1.05);
							cue(RUNGS[0].burstCue);
						}
					} else if (phase === 'count') {
						const value = valueAt(phaseT);
						setAmount(value);
						const want = rungAt(value);
						if (want > idx && flipT < 0) startFlip(idx + 1);
						// rising ticker (silent once the figure has reached the booked amount and only the rung is moving)
						tickClock -= dt;
						if (tickClock <= 0 && value < amount) {
							const n = 1 + Math.min(11, Math.floor((phaseT / countMs) * 12));
							cue(`count_ticker_${n}`);
							tickClock = 150;
						}
						trickle -= dt;
						if (trickle <= 0) {
							spawn(RUNGS[idx], 3, 0.9);
							trickle = 120;
						}
						if (phaseT >= countMs) land();
					} else if (phase === 'landed') {
						const p = Math.min(1, phaseT / 420);
						const pulse = 1 + 0.16 * Math.sin(Math.PI * p) * (1 - p * 0.5);
						sign.scale.set(k * (reduced ? 1 : pulse));
						ring.alpha = Math.max(0, 0.9 * (1 - phaseT / 700));
						ring.scale.set((0.2 + 2.4 * easeOut(Math.min(1, phaseT / 700))) * (signW / 512));
						if (phaseT > (finalIdx === 4 ? 1500 : 1700) / fast) {
							if (finalIdx === 4) showCard();
							else {
								phase = 'out';
								phaseT = 0;
								cue('rung_out');
							}
						}
					} else if (phase === 'card') {
						const p = Math.min(1, phaseT / 420);
						cardBox.alpha = p;
						// the card LANDS: a short overshoot, not a cross-fade (reduced motion keeps the plain fade)
						cardBox.scale.set(reduced ? 1 : 0.82 + 0.18 * easeOutBack(Math.min(1, phaseT / 520)));
						sign.alpha = 1 - p;
						if (phaseT > 4200 / fast) {
							phase = 'out';
							phaseT = 0;
							cue('rung_out');
						}
					} else if (phase === 'out') {
						const p = Math.min(1, phaseT / (380 / fast));
						sign.y -= dt * 1.6 * (0.4 + p) * (main.height / 900);
						sign.alpha = Math.min(sign.alpha, 1 - p);
						cardBox.alpha = Math.min(cardBox.alpha, 1 - p);
						wash.alpha = 0.8 * (1 - p);
						pieceLayer.alpha = 1 - p;
						if (p >= 1) return finish();
					}

					// sign flip (never pauses the count)
					if (flipT >= 0) {
						flipT += dt;
						const outMs = 130 / fast;
						const inMs = 190 / fast;
						if (flipT < outMs) {
							sign.scale.y = k * (reduced ? 1 : 1 - flipT / outMs);
						} else {
							if (idx !== flipTo) {
								idx = flipTo;
								board.texture = tex(`rung_sign_${RUNGS[idx].skin}`);
								cue(`rung_hit_${RUNGS[idx].key}`);
								cue(`sign_impact_${RUNGS[idx].skin}`);
								cue(RUNGS[idx].burstCue);
								setBed(`rung_bed_${RUNGS[idx].key}`);
								spawn(RUNGS[idx], 26, 1.2);
							}
							const p = Math.min(1, (flipT - outMs) / inMs);
							sign.scale.y = k * (reduced ? 1 : easeOutBack(p));
							if (p >= 1) flipT = -1;
						}
						const fp = Math.min(1, flipT / (outMs + inMs));
						flare.position.y = sign.y;
						flare.alpha = reduced ? 0 : Math.sin(Math.PI * fp) * 0.95;
						flare.scale.set((0.6 + 2.2 * fp) * (signW / 512), 0.9 * (signW / 512));
					} else {
						flare.alpha = 0;
					}

					// pieces
					const g = signW * 2.6;
					for (let i = pieces.length - 1; i >= 0; i -= 1) {
						const pc = pieces[i];
						pc.life -= dt;
						pc.vy += (g * dt) / 1000;
						pc.s.x += (pc.vx * dt) / 1000;
						pc.s.y += (pc.vy * dt) / 1000;
						pc.s.rotation += (pc.vr * dt) / 1000;
						pc.f = (pc.f + (pc.fps * dt) / 1000) % pc.frames.length;
						pc.s.texture = pc.frames[Math.floor(pc.f)];
						if (pc.life < 400) pc.s.alpha = Math.max(0, pc.life / 400);
						if (pc.life <= 0 || pc.s.y > main.height + 300) {
							pc.s.destroy();
							pieces.splice(i, 1);
						}
					}
				},
			};
		});

	context.eventEmitter.subscribeOnMount({
		winRungs: async ({ amount, level, scale }) => {
			if (!root || run) return;
			active = true;
			await present(amount, level, scale);
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
