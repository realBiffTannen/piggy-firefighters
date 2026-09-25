<script lang="ts" module>
	/** A mode card that rides on the shutter while it is down. */
	export type ShutterCard = {
		kind: 'intro' | 'outro';
		premium: boolean;
		title: string;
		subtitle: string;
		/** big figure under the title (outro: the booked feature total) */
		value?: string;
		hint: string;
	};

	export type EmitterEventShutter =
		/** Slam the shutter down over the play area. Resolves once it has SETTLED shut. */
		| { type: 'shutterClose'; card?: ShutterCard | null }
		/** Rattle it back up in three hauls. Resolves once the play area is clear. */
		| { type: 'shutterOpen' }
		/** Teardown: get out of the way immediately (never leave a round covered). */
		| { type: 'shutterReset' };
</script>

<script lang="ts">
	// THE ONE SCENE TRANSITION (scene direction, wave 5).
	//
	// The site's roller shutter (static/assets/splash/shutter_slats_tile.webp +
	// shutter_bottom_bar.webp — the same shutter the splash opens on) slams down
	// with a bounce and a kick of dust, the scene swaps BEHIND it, and it rattles
	// back up in three hauls. No frame of a scene change shows an empty or black
	// play area: the cover is art from the first pixel to the last.
	//
	//   - reusable: any director calls shutterClose / shutterOpen (base -> bonus,
	//     bonus -> base today; any later mode change uses the same two events)
	//   - mode cards RIDE on the shutter (they are children of the door)
	//   - bounded: every animation is a fixed timeline; a closed shutter that is
	//     never told to open lifts by itself after FAILSAFE_MS
	//   - skippable: stop / skip collapses the timeline (x0.3), turbo shortens it
	//   - token-guarded: a newer close/open supersedes an older one, whose promise
	//     resolves at once (a caller can never hang on a stale run)
	//   - reduced motion: no travel, no bounce, no dust — a cross-fade of the same
	//     art over the play area
	//   - LIVING CARDS: a card is looked at for 2-4 s, so it is never a dead picture —
	//     the sign sways on its chains after the slam (a damped pendulum kicked by the
	//     impacts), the art pushes in slowly behind its frame, a soft light sweeps it
	//     every ~2.5 s, a few motes / glints drift in front, the feature total breathes
	//     and the "Tap or press Space" hint pulses. All of it is written from the SAME
	//     ticker callback as the door (`step`), none of it touches the door timeline,
	//     the press gate or any duration, and none of it runs under reduced motion.
	import { onMount } from 'svelte';

	import { BaseSprite, Container, Graphics, SpineProvider, Text, getContextApp } from 'pixi-svelte';
	import { OnHotkey } from 'components-shared';
	import { OnPressFullScreen } from 'components-layout';
	import { holdPressGate } from '@crashgalaxy/hud';

	import { getContext } from '../../game/context';
	import { sceneTex, loadSceneTexMany } from '../../game/build/sceneTextures.svelte';
	import { stateScene } from '../../game/build/stateScene.svelte';
	import { stateBuild } from '../../game/build/stateBuild.svelte';
	import { dismissBuildCard } from '../../game/build/buildDirector';
	import { audioDirector } from '../../game/build/audioDirector';
	import { prefersReducedMotion, isTurbo } from '../../game/build/buildTiming';
	import { drawSignPanel, signTitleStyle, signSubStyle, signHintStyle, signValueStyle, ensureSignFont } from '../../game/build/signPanel';
	import Grab from './Grab.svelte';
	import TransitionFx, { type TransitionFxHandle } from './TransitionFx.svelte';

	/* eslint-disable @typescript-eslint/no-explicit-any */
	const context = getContext();
	const app = getContextApp();
	const FAILSAFE_MS = 12000;
	const TILE = { w: 1024, h: 512 };
	const BAR = { w: 1024, h: 115 };
	const PUFFS = Array.from({ length: 14 }, (_, i) => i);

	const sl = $derived(context.stateGameDerived.sceneLayout());
	const cw = $derived(sl.canvas.width);
	const ch = $derived(sl.canvas.height);
	const portrait = $derived(ch > cw);
	// slats span the full width; on a phone in portrait one tile would make the
	// slats hair-thin, so the tile is drawn at a fixed slat height instead
	const tileScale = $derived(portrait ? Math.max(cw / TILE.w, 0.62) : cw / TILE.w);
	const tileH = $derived(TILE.h * tileScale);
	const tileW = $derived(TILE.w * tileScale);
	const barH = $derived(Math.min(BAR.h * (cw / BAR.w), ch * 0.09));
	const landY = $derived(sl.hudTop + 2); // the bar lands on the HUD's top edge
	const tiles = $derived(Array.from({ length: Math.ceil((landY - barH) / Math.max(1, tileH)) + 1 }, (_, i) => i));
	const travel = $derived(ch + 40);

	let mounted = $state(false); // draw the shutter at all
	let card = $state<ShutterCard | null>(null);
	let cardLive = $state(false); // card is up and the press dismisses it

	// ---- press gate (the dismiss press must never reach the spin path) -------------
	let releaseGate: (() => void) | null = null;
	const openGate = () => {
		if (!releaseGate) releaseGate = holdPressGate();
	};
	const closeGate = () => {
		releaseGate?.();
		releaseGate = null;
	};

	// ---- timeline engine ---------------------------------------------------------------
	type Seg = { to: number; ms: number; ease: (p: number) => number; start?: () => void; end?: () => void };
	const R: Record<string, any> = {};
	const grab = (n: string) => (node: any) => (R[n] = node);
	const easeIn = (p: number) => p * p;
	const easeOut = (p: number) => 1 - (1 - p) * (1 - p);
	const easeOut3 = (p: number) => 1 - Math.pow(1 - p, 3);
	const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

	let pos = 1; // 1 = fully up (open), 0 = shut
	let fade = 0; // reduced-motion cross-fade
	let segs: Seg[] = [];
	let segFrom = 1;
	let segT = 0;
	let run = 0;
	let settle: (() => void) | null = null;
	let shake = 0;
	let rattle = 0;
	let closedAt = 0;
	const puffs = PUFFS.map(() => ({ life: 1, x: 0, vx: 0, vy: 0, s: 1 }));

	// ---- living card (see the header) -----------------------------------------------------
	const MOTES = Array.from({ length: 9 }, (_, i) => i);
	// fixed per-mote character (fractions of the card box, rates in 1/s): nothing is rolled per frame
	const motes = MOTES.map((i) => ({
		x: ((i * 0.377 + 0.11) % 1) - 0.5,
		y: ((i * 0.593 + 0.27) % 1) - 0.5,
		rate: 0.16 + ((i * 0.31) % 1) * 0.14,
		phase: (i * 0.618) % 1,
		size: 0.6 + ((i * 0.47) % 1) * 0.7,
		sway: 0.6 + ((i * 0.23) % 1) * 1.1,
	}));
	const SWEEP_EVERY = 2.5; // s between light sweeps
	const SWEEP_TAKES = 0.95; // s for one sweep to cross
	let cardT = 0; // s since this card was hung
	let swing = 0; // the sign's pendulum angle (rad) and its velocity
	let swingV = 0;
	const alive = (n: any) => n && !n.destroyed;

	const factor = () => (stateBuild.skip ? 0.3 : isTurbo() ? 0.55 : 1);

	const begin = (next: Seg[]) =>
		new Promise<void>((resolve) => {
			settle?.(); // a superseded run never leaves its caller hanging
			run += 1;
			segs = next;
			segFrom = pos;
			segT = 0;
			segs[0]?.start?.();
			settle = () => {
				settle = null;
				resolve();
			};
		});

	const impact = (power: number) => {
		shake = Math.max(shake, 7 * power);
		swingV += (power > 0.6 ? 0.062 : -0.034) * (prefersReducedMotion() ? 0 : 1); // the sign swings on its chains
		if (power > 0.6) audioDirector.shutterSlam?.();
		PUFFS.forEach((i) => {
			const p = puffs[i];
			p.life = 0;
			p.x = ((i + 0.5) / PUFFS.length) * cw + (Math.random() - 0.5) * 40;
			p.vx = (Math.random() - 0.5) * 120 * power;
			p.vy = -(30 + Math.random() * 90) * power;
			p.s = (0.7 + Math.random() * 0.9) * (0.6 + power * 0.5) * Math.max(0.6, Math.min(1.3, cw / 1100));
		});
	};

	const step = (tk: any) => {
		if (!mounted) return;
		const dtMs = Math.min(50, tk?.deltaMS ?? 16.7);
		const dt = dtMs / 1000;

		if (segs.length) {
			const s = segs[0];
			segT += dtMs;
			const d = Math.max(1, s.ms * factor());
			const p = Math.min(1, segT / d);
			pos = segFrom + (s.to - segFrom) * s.ease(p);
			if (p >= 1) {
				pos = s.to;
				s.end?.();
				segs.shift();
				segFrom = pos;
				segT = 0;
				if (segs.length) segs[0].start?.();
				else {
					const done = settle;
					settle = null;
					done?.();
				}
			}
		}

		// failsafe: a closed shutter nobody opens lifts by itself
		if (stateScene.covered && !segs.length && performance.now() - closedAt > FAILSAFE_MS) void open();

		shake *= Math.pow(0.002, dt);
		rattle *= Math.pow(0.004, dt);
		if (R.door) {
			R.door.position.y = -pos * travel + (shake > 0.2 ? Math.sin(performance.now() * 0.09) * shake : 0);
			R.door.position.x = rattle > 0.15 ? Math.sin(performance.now() * 0.13) * rattle : 0;
		}
		if (R.root) R.root.alpha = prefersReducedMotion() ? fade : 1;
		if (R.sill) R.sill.alpha = Math.max(0, Math.min(1, 1 - pos / 0.07));

		PUFFS.forEach((i) => {
			const node = R[`puff${i}`];
			if (!node) return;
			const p = puffs[i];
			if (p.life >= 1) {
				node.visible = false;
				return;
			}
			p.life = Math.min(1, p.life + dt / 0.75);
			p.x += p.vx * dt;
			p.vy += 60 * dt;
			node.visible = true;
			node.position.set(p.x, landY - 6 + p.vy * p.life * 0.5);
			node.scale.set(p.s * (0.5 + p.life * 1.5));
			node.alpha = (1 - p.life) * 0.85;
		});

		if (card) stepCard(dt);
	};

	/** The living card. Only display-object writes; the door's timeline never reads any of this. */
	const stepCard = (dt: number) => {
		if (prefersReducedMotion()) return; // reduced motion: the card is a still sign
		cardT += dt;
		const t = cardT;
		const s = lay.s;
		const W = lay.W * s;
		const H = lay.H * s;

		// the sign on its chains: a damped pendulum about the top of the chains + a breath of idle sway
		swingV += (-12.5 * swing - 1.25 * swingV) * dt;
		swing += swingV * dt;
		if (alive(R.card)) {
			const hang = lay.cy + 40;
			R.card.pivot.set(0, -hang);
			R.card.position.set(0, -hang);
			R.card.rotation = swing + Math.sin(t * 0.85) * 0.0022;
		}

		// the art: a slow eased push-in behind its frame (3.6 %), drifting toward the mascot
		if (alive(R.art)) {
			const k = Math.min(1, t / 4.6);
			const e = 1 - (1 - k) * (1 - k);
			const breathe = Math.sin(t * 0.7) * 0.003;
			R.art.scale.set(1 + 0.036 * e + breathe);
			R.art.position.set(s * 0.035 * e, -s * 0.02 * e);
		}

		// a soft light sweep across the art (intro) / the sign (outro) every ~2.5 s
		if (alive(R.sweep)) {
			const span = lay.intro ? (lay.stackedCard ? 3.5 : 3.0) * s : W;
			const c = (t + SWEEP_EVERY - 0.9) % SWEEP_EVERY; // the first one comes ~0.9 s after the card is hung
			const k = c / SWEEP_TAKES;
			if (k >= 1) R.sweep.visible = false;
			else {
				const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
				R.sweep.visible = true;
				R.sweep.position.x = (e - 0.5) * span * 1.7;
				R.sweep.alpha = Math.sin(Math.PI * k) * (lay.intro ? 0.9 : 0.5);
			}
		}

		// motes and glints drifting up in front of the sign
		for (let i = 0; i < motes.length; i += 1) {
			const node = R[`mote${i}`];
			if (!alive(node)) continue;
			const mo = motes[i];
			const life = (t * mo.rate + mo.phase) % 1;
			node.visible = true;
			node.position.set(mo.x * W * 0.94 + Math.sin(t * mo.sway + i) * s * 0.12, (mo.y + 0.18 - life * 0.36) * H * 0.9);
			node.scale.set(mo.size * s * (0.75 + 0.25 * Math.sin(t * 5.3 + i * 2.1)));
			node.alpha = Math.sin(Math.PI * life) * (0.45 + 0.4 * Math.sin(t * 3.1 + i * 1.7) ** 2);
			node.rotation = t * 0.4 * (i % 2 ? 1 : -1);
		}

		// the feature total breathes; the hint pulses (it is the one thing the player has to do)
		if (alive(R.value)) R.value.scale.set(1 + Math.sin(t * 2.2) * 0.014);
		if (alive(R.hint)) {
			const pulse = 0.5 + 0.5 * Math.sin(t * 3.6);
			R.hint.alpha = 0.62 + 0.38 * pulse;
			R.hint.scale.set(1 + 0.04 * pulse);
		}
	};

	// ---- the two moves ----------------------------------------------------------------------
	const close = async (c: ShutterCard | null | undefined) => {
		card = c ?? null;
		cardLive = false;
		cardT = 0;
		swing = 0;
		swingV = 0;
		mounted = true;
		ensureSignFont();
		openGate();
		await loadSceneTexMany(['scene_shutter_slats', 'scene_shutter_bar', c?.kind === 'intro' ? (c.premium ? 'scene_card_golden' : 'scene_card_hold') : 'scene_shutter_bar']);
		if (prefersReducedMotion()) {
			pos = 0;
			await begin([{ to: 0, ms: 240, ease: (p) => ((fade = p), p) }]);
			fade = 1;
		} else {
			await begin([
				{ to: 0, ms: 400, ease: easeIn, end: () => impact(1) }, // free fall
				{ to: 0.045, ms: 95, ease: easeOut }, // bounce
				{ to: 0, ms: 115, ease: easeIn, end: () => impact(0.45) },
				{ to: 0.013, ms: 60, ease: easeOut },
				{ to: 0, ms: 75, ease: easeIn },
			]);
		}
		stateScene.covered = true;
		closedAt = performance.now();
		cardLive = !!card;
		// work-light rays behind an INTRO card only (never under reduced motion)
		if (card?.kind === 'intro' && !prefersReducedMotion()) raysFx?.rays();
	};

	// ---- feature-entry VFX (pw_fx_transition, effects only) ----------------------------------
	// Two instances of the same rig: `raysFx` rides INSIDE the door behind the mode
	// card; `blastFx` sits in the root, over the door, centred on the play area.
	// Both are decoration. The door's own timeline (`begin`) stays the single
	// authority for `pos` / `covered`: if either handle is missing, unusable or
	// slow, the shutter still opens on its segments, and any non-intro open keeps
	// the three-haul lift exactly as before.
	let raysFx: TransitionFxHandle | null = null;
	let blastFx: TransitionFxHandle | null = null;
	const fxScale = $derived(Math.max(cw, ch) / 1400);
	// SpineProvider logs a console error for a key that is not in loadedAssets, so
	// neither instance is mounted until the rig has really loaded.
	const fxLoaded = $derived(!!(app.stateApp as any)?.loadedAssets?.pw_fx_transition);

	const open = async () => {
		if (!mounted) return;
		const wasIntro = card?.kind === 'intro';
		cardLive = false;
		closedAt = performance.now();
		const haul = (n: number) => () => {
			rattle = 5;
			audioDirector.shutterHaul?.(n);
		};
		const fx = blastFx;
		if (wasIntro && !prefersReducedMotion() && fx && fx.blastSeconds > 0) {
			// BLAST REVEAL (feature entry only). The door holds shut through the
			// vacuum + impact + bloom, vanishes under the white, and the white clears
			// onto the bonus site. Segment lengths mirror the clip; `factor()` scales
			// the segments (turbo / skip) and the clip is played at the same rate.
			const rate = 1 / factor();
			// the rays behind the sign pull in and die at the impact; the blast layer
			// (which sits OVER the sign) shows nothing until then, so no glare on the text
			raysFx?.vacuum(rate);
			const whiteMs = fx.whiteAt * 1000;
			const tailMs = Math.max(60, (fx.blastSeconds - fx.whiteAt) * 1000);
			void fx.blast(rate, () => {
				shake = Math.max(shake, 9);
				audioDirector.blastImpact?.();
			});
			audioDirector.blastStart?.();
			await begin([
				{ to: 0, ms: whiteMs, ease: (p) => p }, // shut: the blast plays over it
				{ to: 1, ms: 1, ease: (p) => p, end: () => audioDirector.blastReveal?.() }, // gone, under full white
				{ to: 1, ms: tailMs, ease: (p) => p }, // white clears onto the scene
			]);
		} else if (prefersReducedMotion()) {
			raysFx?.stop();
			await begin([{ to: 0, ms: 260, ease: (p) => ((fade = 1 - p), p) }]);
			fade = 0;
		} else {
			raysFx?.stop();
			await begin([
				{ to: 0.31, ms: 270, ease: easeOut3, start: haul(1) },
				{ to: 0.285, ms: 85, ease: easeInOut },
				{ to: 0.285, ms: 70, ease: (p) => p },
				{ to: 0.66, ms: 270, ease: easeOut3, start: haul(2) },
				{ to: 0.635, ms: 85, ease: easeInOut },
				{ to: 0.635, ms: 70, ease: (p) => p },
				{ to: 1, ms: 330, ease: easeOut3, start: haul(3) },
			]);
		}
		pos = 1;
		stateScene.covered = false;
		card = null;
		mounted = false;
		closeGate();
	};

	const reset = () => {
		raysFx?.stop();
		blastFx?.stop();
		settle?.();
		settle = null;
		segs = [];
		pos = 1;
		fade = 0;
		stateScene.covered = false;
		card = null;
		cardLive = false;
		mounted = false;
		closeGate();
	};

	context.eventEmitter.subscribeOnMount({
		shutterClose: ({ card: c }) => close(c),
		shutterOpen: () => open(),
		shutterReset: () => reset(),
		stopButtonClick: () => {
			if (cardLive) dismissBuildCard();
		},
	});

	// DEV ONLY: lets the QA capture driver (qa/tags_0919/features/drive.mjs) see when a card is up.
	if (typeof window !== 'undefined' && import.meta.env?.DEV) {
		(window as any).__pwCard = { get live() { return cardLive; }, get kind() { return card?.kind ?? null; }, get premium() { return !!card?.premium; } };
	}

	// Pixi rasterises a Text once: a card drawn before the sign font has arrived
	// would stay in the fallback face for its whole life. Warm the font at boot and
	// re-key the card's text when it lands.
	let fontReady = $state(false);

	onMount(() => {
		ensureSignFont();
		try {
			void (document as any).fonts?.load?.('400 64px LuckySign').then(() => (fontReady = true));
		} catch {
			/* no FontFaceSet: the fallback face stands */
		}
		void loadSceneTexMany(['scene_shutter_slats', 'scene_shutter_bar', 'scene_card_hold', 'scene_card_golden']);
		const ticker = app.stateApp.pixiApplication?.ticker;
		ticker?.add(step);
		return () => {
			ticker?.remove(step);
			closeGate();
		};
	});

	// ---- card layout ------------------------------------------------------------------------
	const cardArt = $derived(card?.kind === 'intro' ? sceneTex(card.premium ? 'scene_card_golden' : 'scene_card_hold') : null);
	const lay = $derived.by(() => {
		const intro = card?.kind === 'intro';
		const stackedCard = portrait;
		const W = intro ? (stackedCard ? 5.4 : 9.2) : 6.6;
		const H = intro ? (stackedCard ? 7.0 : 3.9) : 3.4;
		const s = Math.min((cw * 0.92) / W, ((landY - barH) * 0.84) / H, 132);
		return { W, H, s, stackedCard, intro, cx: cw / 2, cy: (landY - barH) / 2 + 4 };
	});

	// ---- text contrast (WCAG AA/AAA) --------------------------------------------------------
	// signPanel's tan/gold fills are read-only and clear only AA-LARGE on the wood
	// panel (cream 4.08:1, gold 3.58:1) while the hint fails AA outright (3.40:1).
	// We keep the signage look but fix legibility from here, the file we own:
	//   1. brighten every fill toward near-white / bright gold,
	//   2. give each line a dark knockout stroke (crisp glyph edges), and
	//   3. lay a dark "slate" behind each card's text block.
	// Measured: fills vs the slate — cream 8.54:1, gold 7.27:1, hint 8.54:1 (AAA);
	// and fills vs BARE wood stay >=4.54:1 (cream) / 4.12:1 large gold (AA) as a
	// fallback should the slate ever fail to draw. Contrast is not motion, so this
	// applies in reduced-motion too.
	const TXT_CREAM = 0xfff6e8;
	const TXT_GOLD = 0xffda63;
	const TXT_INK = 0x241408;
	const SLATE_ALPHA = 0.46;
	const SLATE_HAIR = 0xf3d9a4;
	// THE TITLE FITS IN TWO LINES (LUCKY 2026-09-23: "GOLDEN DRAGON CITY x4" wrapped to three and ran into the
	// subtitle). A title too wide for one line is split at the word break that balances its two lines, and the
	// size comes down until the longer line fits the column. TITLE_EM is the sign face's capital advance incl.
	// its stroke, measured on the intro card (~0.72-0.75 em).
	const TITLE_EM = 0.75;
	const fitTitle = (title: string, maxW: number, maxSize: number) => {
		const words = title.split(' ');
		let text = title;
		let longest = title.length;
		if (title.length * TITLE_EM * maxSize > maxW && words.length > 1) {
			longest = Infinity;
			for (let i = 1; i < words.length; i += 1) {
				const a = words.slice(0, i).join(' ');
				const b = words.slice(i).join(' ');
				const m = Math.max(a.length, b.length);
				if (m < longest) {
					longest = m;
					text = `${a}\n${b}`;
				}
			}
		}
		return { text, size: Math.min(maxSize, maxW / (Math.max(1, longest) * TITLE_EM)) };
	};
	const titleFix = (u: number, gold: boolean) => ({ fill: gold ? TXT_GOLD : TXT_CREAM, stroke: { color: TXT_INK, width: u * 0.085 } });
	const subFix = (u: number) => ({ fill: TXT_CREAM, stroke: { color: TXT_INK, width: u * 0.045 } });
	const hintFix = (u: number) => ({ fill: TXT_CREAM, stroke: { color: TXT_INK, width: u * 0.035 } });
	const valueFix = (u: number) => ({ fill: TXT_CREAM, stroke: { color: TXT_INK, width: u * 0.1 } });
	// ---- living-card shapes (drawn once per card; stepCard only moves them) -----------------
	/** A soft diagonal band of light: stacked translucent parallelograms, additive. */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const drawSweep = (g: any, w: number, h: number) => {
		const lean = h * 0.28;
		for (let k = 0; k < 6; k += 1) {
			const half = (w * (1 - k / 7)) / 2;
			g.poly([-half + lean / 2, -h / 2, half + lean / 2, -h / 2, half - lean / 2, h / 2, -half - lean / 2, h / 2]).fill({ color: 0xfff6dc, alpha: 0.075 });
		}
	};
	/** A drifting glint (4-point) or a dust mote (soft disc), in units of the card scale. */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const drawMote = (g: any, glint: boolean) => {
		if (glint) {
			g.poly([0, -0.11, 0.018, -0.018, 0.11, 0, 0.018, 0.018, 0, 0.11, -0.018, 0.018, -0.11, 0, -0.018, -0.018]).fill({ color: 0xfff1c0, alpha: 0.95 });
			g.circle(0, 0, 0.03).fill({ color: 0xffffff, alpha: 0.9 });
		} else {
			for (let k = 0; k < 4; k += 1) g.circle(0, 0, 0.05 * (1 - k / 5)).fill({ color: 0xffe9b0, alpha: 0.3 });
		}
	};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const drawSlate = (g: any, x: number, y: number, w: number, h: number, u: number) => {
		g.roundRect(x - w / 2, y - h / 2, w, h, u * 0.14).fill({ color: TXT_INK, alpha: SLATE_ALPHA });
		g.roundRect(x - w / 2, y - h / 2, w, h, u * 0.14).stroke({ width: u * 0.012, color: SLATE_HAIR, alpha: 0.22 });
	};
</script>

{#if mounted}
	<Container zIndex={50}>
		<Grab ongrab={grab('root')} />
		<Container y={-travel}>
			<Grab ongrab={grab('door')} />
			<!-- never a void: a painted steel colour sits under the slats while they decode -->
			<Graphics zIndex={0} draw={(g) => g.rect(-20, -80, cw + 40, landY + 80).fill({ color: 0xe0a400 })} />
			{#if sceneTex('scene_shutter_slats')}
				{#each tiles as i (i)}
					{#each portrait ? [0, 1] : [0] as col (col)}
						<BaseSprite
							zIndex={1}
							texture={sceneTex('scene_shutter_slats')}
							x={portrait ? (col === 0 ? cw / 2 - tileW : cw / 2) : 0}
							y={landY - barH - (i + 1) * tileH + 1}
							width={tileW + 0.5}
							height={tileH + 1}
						/>
					{/each}
				{/each}
			{/if}
			{#if sceneTex('scene_shutter_bar')}
				<BaseSprite zIndex={3} texture={sceneTex('scene_shutter_bar')} x={0} y={landY - barH} width={cw} height={barH} />
			{/if}
			<!-- work-light rays BEHIND the mode card (over the slats and bar, under the
			     card). The visible ray disc is ~675 units across. -->
			<!-- the site goes dark behind an INTRO card so the work-light rays read: yellow
			     rays on the bare yellow door are invisible. Only with the rig loaded and
			     motion allowed; otherwise the door keeps its original look. -->
			{#if fxLoaded && card?.kind === 'intro' && !prefersReducedMotion()}
				<Graphics zIndex={4} draw={(g) => g.rect(-20, -80, cw + 40, landY + 80).fill({ color: 0x0b1020, alpha: 0.58 })} />
			{/if}
			{#if fxLoaded}
				<!-- sized from the card's SHORTER side. The sign is wide in landscape and tall
				     in portrait: a disc sized to the long side covers the whole door and
				     paints the dimming back to yellow (seen in both orientations). -->
				<Container zIndex={5} x={lay.cx} y={lay.cy} scale={(Math.min(lay.W, lay.H) * lay.s * 1.9) / 675}>
					<SpineProvider key="pw_fx_transition">
						<TransitionFx onready={(h) => (raysFx = h)} />
					</SpineProvider>
				</Container>
			{/if}
			{#if card}
				<Container zIndex={6} x={lay.cx} y={lay.cy}>
					<!-- the sign and its chains swing as one about the top of the chains (stepCard) -->
					<Container>
					<Grab ongrab={grab('card')} />
					<!-- chains: the sign hangs off the shutter -->
					<Graphics
						draw={(g) => {
							const s = lay.s;
							for (const sx of [-1, 1]) {
								const x = sx * lay.W * s * 0.36;
								for (let y = -lay.cy - 40; y < (-lay.H * s) / 2 + s * 0.1; y += s * 0.17) {
									g.roundRect(x - s * 0.035, y, s * 0.07, s * 0.13, s * 0.03).stroke({ width: s * 0.03, color: 0x2a1a0d });
								}
							}
						}}
					/>
					<Graphics draw={(g) => drawSignPanel(g as any, { w: lay.W * lay.s, h: lay.H * lay.s, s: lay.s, variant: card?.premium ? 'gold' : card?.kind === 'outro' ? 'win' : 'timber' })} />
					{#key fontReady}
					{#if lay.intro}
						{@const s = lay.s}
						{@const art = lay.stackedCard ? 3.5 * s : 3.0 * s}
						{@const ax = lay.stackedCard ? 0 : -lay.W * s * 0.5 + s * 0.55 + art / 2}
						{@const ay = lay.stackedCard ? -lay.H * s * 0.5 + s * 0.85 + art / 2 : s * 0.12}
						{@const tx = lay.stackedCard ? 0 : ax + art / 2 + (lay.W * s * 0.5 - (ax + art / 2)) / 2 - s * 0.1}
						{@const ty = lay.stackedCard ? ay + art / 2 + s * 0.75 : -s * 0.55}
						{#if cardArt}
							<!-- the art lives behind its frame: clipped, pushed in slowly, swept by a soft light -->
							<Container x={ax} y={ay}>
								<Graphics isMask draw={(g) => g.roundRect(-art / 2, -art / 2, art, art, s * 0.12).fill(0xffffff)} />
								<Container>
									<Grab ongrab={grab('art')} />
									<BaseSprite texture={cardArt} anchor={0.5} width={art} height={art} />
								</Container>
								<Container visible={false}>
									<Grab ongrab={grab('sweep')} />
									<Graphics blendMode="add" draw={(g) => drawSweep(g, art * 0.2, art * 1.5)} />
								</Container>
							</Container>
						{/if}
						<Graphics
							draw={(g) => {
								g.roundRect(ax - art / 2, ay - art / 2, art, art, s * 0.12).stroke({ width: s * 0.09, color: 0x2a1a0d });
								g.roundRect(ax - art / 2 + s * 0.06, ay - art / 2 + s * 0.06, art - s * 0.12, art - s * 0.12, s * 0.09).stroke({ width: s * 0.03, color: card?.premium ? 0xffd34d : 0xf3d9a4, alpha: 0.9 });
							}}
						/>
						<!-- readability slate: dark knockout behind the text column so the light fills clear AAA -->
						<Graphics draw={(g) => drawSlate(g, tx, ty + s * 0.6, s * 5.0, s * 2.76, s)} />
						{@const tt = fitTitle(card.title, s * 4.8, s * 0.6)}
						<Text anchor={0.5} x={tx} y={ty} text={tt.text} style={{ ...signTitleStyle(s, { gold: card.premium }), ...titleFix(s, !!card.premium), fontSize: tt.size, lineHeight: tt.size * 1.03 }} />
						<Text anchor={0.5} x={tx} y={ty + s * 0.98} text={card.subtitle} style={{ ...signSubStyle(s), ...subFix(s), fontSize: s * 0.23, wordWrap: true, wordWrapWidth: s * 4.5, lineHeight: s * 0.3 }} />
						<Container x={tx} y={ty + s * 1.78}>
							<Grab ongrab={grab('hint')} />
							<Text anchor={0.5} text={card.hint} style={{ ...signHintStyle(s), ...hintFix(s) }} />
						</Container>
					{:else}
						{@const s = lay.s}
						<!-- readability slate: dark knockout behind the text so the light fills clear AAA -->
						<Graphics draw={(g) => drawSlate(g, 0, s * 0.11, lay.W * s * 0.9, s * 3.02, s)} />
						<Text anchor={0.5} y={-s * 0.95} text={card.title} style={{ ...signTitleStyle(s, { gold: true }), ...titleFix(s, true), fontSize: s * 0.5 }} />
						<!-- a soft light crosses the sign itself (clipped to the slate) -->
						<Container y={s * 0.11}>
							<Graphics isMask draw={(g) => g.roundRect((-lay.W * s * 0.9) / 2, (-s * 3.02) / 2, lay.W * s * 0.9, s * 3.02, s * 0.14).fill(0xffffff)} />
							<Container visible={false}>
								<Grab ongrab={grab('sweep')} />
								<Graphics blendMode="add" draw={(g) => drawSweep(g, s * 0.7, s * 4.6)} />
							</Container>
						</Container>
						{#if card.value}
							<Container y={s * 0.05}>
								<Grab ongrab={grab('value')} />
								<Text anchor={0.5} text={card.value} style={{ ...signValueStyle(s, 0.95), ...valueFix(s) }} />
							</Container>
						{/if}
						<Text anchor={0.5} y={s * 0.92} text={card.subtitle} style={{ ...signSubStyle(s), ...subFix(s), fontSize: s * 0.2 }} />
						<Container y={s * 1.32}>
							<Grab ongrab={grab('hint')} />
							<Text anchor={0.5} text={card.hint} style={{ ...signHintStyle(s), ...hintFix(s) }} />
						</Container>
					{/if}
					{/key}
					<!-- motes and glints drifting in front of the sign (positions written by stepCard) -->
					{#each MOTES as i (i)}
						<Container visible={false}>
							<Grab ongrab={grab(`mote${i}`)} />
							<Graphics blendMode="add" draw={(g) => drawMote(g, i % 3 === 0)} />
						</Container>
					{/each}
					</Container>
				</Container>
			{/if}
		</Container>

		<!-- soft shade under the (off-screen) housing the door rolls out of -->
		<Graphics
			zIndex={6}
			draw={(g) => {
				for (let i = 0; i < 6; i += 1) g.rect(0, 0, cw, (ch * 0.1 * (6 - i)) / 6).fill({ color: 0x2a1200, alpha: 0.06 });
			}}
		/>

		<!-- the sill the bar lands on: the strip under the landing line (mostly behind
		     the HUD) closes only as the bar arrives, so it never leads the door down -->
		<Container zIndex={7} alpha={0}>
			<Grab ongrab={grab('sill')} />
			<Graphics
				draw={(g) => {
					g.rect(-20, landY - 1, cw + 40, ch - landY + 40).fill({ color: 0x4a2f16 });
					for (let y = landY + 22; y < ch + 40; y += 26) g.rect(-20, y, cw + 40, 3).fill({ color: 0x2a1a0d, alpha: 0.55 });
					g.rect(-20, landY - 1, cw + 40, 4).fill({ color: 0x120a04 });
				}}
			/>
		</Container>

		<!-- dust kicked up where the bar lands -->
		{#each PUFFS as i (i)}
			<Container visible={false} zIndex={8}>
				<Grab ongrab={grab(`puff${i}`)} />
				<Graphics
					draw={(g) => {
						for (let k = 0; k < 6; k += 1) g.circle(0, 0, 34 * (1 - k / 7)).fill({ color: 0xe9d6ae, alpha: 0.16 });
					}}
				/>
			</Container>
		{/each}

		<!-- feature-entry blast reveal: over the door, the shade, the sill and the
		     dust, centred on the play area. Hidden (setup pose, no updates) until
		     open() plays it. -->
		{#if fxLoaded}
			<Container zIndex={9} x={cw / 2} y={landY / 2} scale={fxScale}>
				<SpineProvider key="pw_fx_transition">
					<TransitionFx onready={(h) => (blastFx = h)} />
				</SpineProvider>
			</Container>
		{/if}
	</Container>

	{#if cardLive}
		<!-- Space + pointer both dismiss; the held press-gate stops either from
		     reaching the spin path behind the shutter. -->
		<OnHotkey hotkey="Space" onpress={() => dismissBuildCard()} />
		<OnPressFullScreen onpress={() => dismissBuildCard()} />
	{/if}
{/if}
