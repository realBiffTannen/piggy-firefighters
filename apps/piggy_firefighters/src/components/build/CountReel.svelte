<script lang="ts" module>
	export type EmitterEventCountReel = {
		/** SITE PERMIT: the booked board count is drawn on the counter reel before the site opens.
		 *  `boards` IS the book's number (2-4); the spin is presentation of that number, never a decision.
		 *  Resolves when the beat is done (or at once under `instant`). */
		type: 'expandCountReel';
		boards: number;
		golden: boolean;
		instant: boolean;
	};
</script>

<script lang="ts">
	// THE SITE PERMIT COUNTER (owner, 2026-09-19: "a random spinning reel that shows how many expanded
	// build columns will be awarded ... 2 to 4"). One vertical drum in a timber-and-steel housing
	// (static/assets/build/permit_housing.webp, gpt-image-2.5-sunburst, keyed + measured by tools/art;
	// the drum window and brass plaque rects come from permit_housing.meta.json). The three faces are
	// live LuckySign text, never baked numerals, so they stay crisp at every size.
	//
	// The drum has real reel physics: spin-up, a blurred cruise, a long ease-down whose last full turn
	// carries the booked face across the window ONCE (the near-miss the player feels), an overshoot
	// and spring settle, a steel latch that slides home, then the red "N SITES" stamp. Everything is
	// written straight onto display objects from game/build/motion.ts tweens (fault-tolerant); nodes
	// are read live so a re-mount can never strand a beat. Turbo compresses through dur()/hold();
	// reduced motion shows the final face and fades. NOT Spine: three rigid parts (drum, latch, stamp)
	// move on plain transforms — a skeleton would add a runtime load for no deformation.
	import { onMount } from 'svelte';

	import { BaseSprite, Container, Graphics, Text } from 'pixi-svelte';

	import { getContext } from '../../game/context';
	import { stateBuild } from '../../game/build/stateBuild.svelte';
	import { dur, hold, prefersReducedMotion } from '../../game/build/buildTiming';
	import { sceneTex } from '../../game/build/sceneTextures.svelte';
	import { tween, ease, springDecay } from '../../game/build/motion';
	import { ensureSignFont } from '../../game/build/signPanel';
	import { audioDirector } from '../../game/build/audioDirector';
	import Grab from '../scene/Grab.svelte';
	import { MECHANIC, districtsText } from '../../game/names';

	const DECREE = MECHANIC.decree.toUpperCase();

	/* eslint-disable @typescript-eslint/no-explicit-any */
	type Band = { x: number; y: number; w: number; h: number };
	type Props = { band: Band; premium: boolean };
	const props: Props = $props();
	const context = getContext();

	// ---- the housing, in its own texture px (640 x 699) --------------------------------------------
	const HW = 640;
	const HH = 699;
	// measured on the keyed painting (permit_housing.meta.json): drum window + brass plaque, fractions
	const WIN = { x0: 0.1707, y0: 0.2611, x1: 0.717, y1: 0.5484 };
	const PLQ = { x0: 0.2115, y0: 0.622, x1: 0.6795, y1: 0.7087 };
	const win = {
		x: (WIN.x0 - 0.5) * HW,
		y: (WIN.y0 - 0.5) * HH,
		w: (WIN.x1 - WIN.x0) * HW,
		h: (WIN.y1 - WIN.y0) * HH,
	};
	const winC = { x: win.x + win.w / 2, y: win.y + win.h / 2 };
	const plq = { x: (PLQ.x0 + PLQ.x1 - 1) * 0.5 * HW, y: (PLQ.y0 + PLQ.y1 - 1) * 0.5 * HH, w: (PLQ.x1 - PLQ.x0) * HW, h: (PLQ.y1 - PLQ.y0) * HH };
	// the text span between the plaque's two painted bolts (see the plaque <Text> below)
	const DECREE_LS = 1;
	const decreeSpan = plq.w * (1 - 2 * 0.13) - 8;
	const decreeFont = Math.floor(Math.min(plq.h * 0.58, (decreeSpan - DECREE_LS * DECREE.length) / (DECREE.length * 0.7)));
	const FACES = [2, 3, 4];
	const PITCH = win.h * 0.92; // one face, drum px
	const FACE_SIZE = Math.round(win.h * 0.74);

	const tex = $derived(sceneTex('build_permit_housing'));
	const premium = $derived(props.premium);

	// ---- placement: centred in the band, sized for the viewport --------------------------------------
	const sl = $derived(context.stateGameDerived.sceneLayout());
	const place = $derived.by(() => {
		const b = props.band;
		const stacked = sl.stacked;
		const width = Math.min(b.w * (stacked ? 0.74 : 0.42), b.h * 0.64 * (HW / HH));
		return { x: b.x + b.w / 2, y: b.y + b.h * 0.5, s: width / HW };
	});

	// ---- live nodes ---------------------------------------------------------------------------------
	const N: Record<string, any> = {};
	const grab = (k: string, hidden = false) => (node: any) => {
		N[k] = node;
		if (hidden) node.visible = false;
		node.once?.('destroyed', () => {
			if (N[k] === node) delete N[k];
		});
	};

	let pos = 0; // drum position in faces (continuous); face i is centred when pos ≡ i (mod 3)
	let blur = 0; // 0..1 streaming blur
	let running = false;

	/** paint the drum for the current `pos` / `blur` */
	const render = () => {
		for (let i = 0; i < FACES.length; i += 1) {
			const n = N[`face${i}`];
			if (!n) continue;
			// signed distance from the window centre, in faces, wrapped to (-1.5, 1.5]
			let d = ((i - pos) % 3 + 3) % 3;
			if (d > 1.5) d -= 3;
			const y = d * PITCH;
			const a = (d / 1.5) * (Math.PI / 2); // cylinder foreshortening toward the window's top/bottom
			const sq = Math.max(0.08, Math.cos(a));
			n.visible = Math.abs(d) < 1.45;
			n.position.set(0, y);
			// a readable blur: the faces streak a little and dim a little, never to a smear
			n.scale.set(1, sq * (1 + 0.45 * blur));
			n.alpha = Math.max(0, 1 - 0.3 * blur) * (0.35 + 0.65 * sq);
		}
	};

	// stop-press / skip: the director's `fast` path plus BuildScene's finishAllTweens end every tween on
	// its final frame, so each callback below is written to be correct at p = 1
	const isFast = () => stateBuild.skip;

	// Every await below re-checks this token: when the director moves on (its bound expired under
	// load, or a skip), finishNow() bumps it and the reel leaves the screen instead of finishing a
	// slow sequence over the opened site (seen on the production dist under a 40+ load average).
	let runGen = 0;
	const finishNow = () => {
		if (!running) return;
		runGen += 1;
		running = false;
		audioDirector.permitReelTick?.(false);
		const r = N.root;
		if (r) {
			r.visible = false;
			r.alpha = 0;
		}
	};
	const run = async (boards: number, golden: boolean, instant: boolean) => {
		if (running) return;
		running = true;
		const my = ++runGen;
		ensureSignFont();
		const root = N.root;
		const target = Math.max(2, Math.min(4, Math.round(boards)));
		const targetFace = FACES.indexOf(target); // 0..2
		const reduced = prefersReducedMotion();
		const stampNode = () => N.stamp;
		const latchNode = () => N.latch;
		const setStamp = (visible: boolean, k = 1, rot = -0.1) => {
			const s = stampNode();
			if (!s) return;
			s.visible = visible;
			s.scale.set(k);
			s.rotation = rot;
		};
		const setLatch = (t: number) => {
			// 0 = withdrawn (off the window's right edge), 1 = home
			const l = latchNode();
			if (!l) return;
			l.visible = t > 0.001;
			l.position.set(win.x + win.w + 8 - t * win.w * 0.36, win.y + win.h - 26);
		};
		if (!root) {
			running = false;
			return;
		}
		root.visible = true;
		root.alpha = 0;
		root.scale.set(place.s * 0.7);
		setStamp(false);
		setLatch(0);
		blur = 0;

		if (instant || reduced || isFast()) {
			// the final number, plainly: no travel, one fade
			pos = targetFace;
			render();
			setLatch(1);
			// QA seam, dev builds only: a shipped page must not publish round state on the global object
			if (import.meta.env.DEV) (globalThis as any).__pwPermit = { booked: target, landed: FACES[targetFace], golden, instant: true };
			setStamp(true, 1, -0.1);
			const stampText = N.stampText?.children?.[0];
			if (stampText) stampText.text = districtsText(target);
			root.scale.set(place.s);
			if (my !== runGen) return;
			await tween(reduced ? 120 : dur(160), (p) => {
				const r = N.root;
				if (r) r.alpha = p;
			}, ease.cubicOut);
			if (my !== runGen) return;
			await new Promise<void>((res) => setTimeout(res, instant ? 220 : hold(700)));
			if (my !== runGen) return;
			await tween(reduced ? 120 : dur(160), (p) => {
				const r = N.root;
				if (r) r.alpha = 1 - p;
			}, ease.cubicIn);
			if (N.root) N.root.visible = false;
			running = false;
			return;
		}

		const stampText = N.stampText?.children?.[0]; // the Text inside the grabbed wrap
		if (stampText) stampText.text = districtsText(target);

		// ---- 1. the counter comes up -----------------------------------------------------------
		audioDirector.permitReelStart?.();
		if (my !== runGen) return;
		await tween(dur(380), (p, raw) => {
			const r = N.root;
			if (!r) return;
			r.alpha = Math.min(1, raw * 3);
			r.scale.set(place.s * (0.7 + 0.3 * p));
		}, ease.backOutSoft);

		// ---- 2-4. the drum: spin-up, cruise, ease-down, and the last slow turn ------------------
		// travel is laid out backwards from the booked face: the final slow turn is exactly one
		// rotation (3 faces) that ends ON the target, so the target crosses the window once, slowly,
		// before it comes round again and stops
		const spinStart = pos;
		const cruiseFaces = 12;
		const easeFaces = 6;
		const lastTurn = 3;
		// the end must be ≡ targetFace (mod 3) — pad the cruise so the arithmetic lands
		let total = cruiseFaces + easeFaces + lastTurn;
		const rem = (((spinStart + total) % 3) + 3) % 3;
		total += (targetFace - rem + 3) % 3;
		const endPos = spinStart + total;
		const p1 = spinStart + (total - easeFaces - lastTurn); // end of cruise
		const p2 = endPos - lastTurn; // end of ease-down
		let lastClickFace = Math.floor(pos);
		const click = () => {
			const f = Math.floor(pos);
			if (f !== lastClickFace) {
				lastClickFace = f;
				audioDirector.permitReelSlow?.();
			}
		};
		audioDirector.permitReelTick?.(true);
		if (my !== runGen) return;
		await tween(dur(1300), (p) => {
			pos = spinStart + (p1 - spinStart) * p;
			blur = Math.min(1, p * 2.2);
			render();
		}, ease.cubicIn);
		audioDirector.permitReelTick?.(false);
		if (my !== runGen) return;
		await tween(dur(1050), (p) => {
			pos = p1 + (p2 - p1) * p;
			blur = 1 - p;
			render();
			click();
		}, ease.cubicOut);
		// the last turn: slow, and slowing — the booked face goes past, then comes home
		if (my !== runGen) return;
		await tween(dur(1750), (p) => {
			pos = p2 + lastTurn * p;
			blur = 0;
			render();
			click();
		}, ease.cubicOut);
		pos = endPos;
		render();

		// ---- 5. overshoot + spring, latch home -----------------------------------------------------
		audioDirector.permitReelStop?.(golden);
		if (my !== runGen) return;
		await tween(dur(560), (_p, raw) => {
			const w = springDecay(raw, 2, 4.5);
			pos = endPos + 0.22 * w;
			render();
			setLatch(Math.min(1, raw * 3));
			const r = N.root;
			if (r) r.scale.set(place.s * (1 + 0.025 * w), place.s * (1 - 0.03 * w));
		}, ease.linear);
		pos = endPos;
		render();
		setLatch(1);
		if (N.root) N.root.scale.set(place.s);
		// QA seam, dev builds only: what the drum shows vs what the book says (probes assert they agree).
		// A shipped page must not publish round state on the global object.
		if (import.meta.env.DEV) (globalThis as any).__pwPermit = { booked: target, landed: FACES[(((Math.round(pos) % 3) + 3) % 3)], golden };

		// ---- 6. the stamp ----------------------------------------------------------------------------
		if (my !== runGen) return;
		await new Promise<void>((res) => setTimeout(res, hold(140)));
		audioDirector.permitStamp?.(golden);
		setStamp(true, 1.7, -0.22);
		if (my !== runGen) return;
		await tween(dur(360), (p, raw) => {
			const k = 1.7 - 0.7 * ease.backOut(p);
			setStamp(true, k, -0.22 + 0.12 * p);
			const r = N.root;
			// the housing takes the hit
			if (r && raw > 0.5) r.scale.set(place.s * (1 - 0.02 * springDecay((raw - 0.5) * 2, 1.5, 5)));
		}, ease.linear);
		setStamp(true, 1, -0.1);
		if (N.root) N.root.scale.set(place.s);
		if (my !== runGen) return;
		await new Promise<void>((res) => setTimeout(res, hold(1000)));

		// ---- 7. away -------------------------------------------------------------------------------
		if (my !== runGen) return;
		await tween(dur(320), (p) => {
			const r = N.root;
			if (!r) return;
			r.alpha = 1 - p;
			r.scale.set(place.s * (1 - 0.15 * p));
		}, ease.cubicIn);
		if (N.root) N.root.visible = false;
		running = false;
	};

	context.eventEmitter.subscribeOnMount({
		expandCountReel: ({ boards, golden, instant }) => run(boards, golden, instant),
		// the site is opening: whatever the reel is still doing, it is over
		expandPullBack: () => finishNow(),
		expandSnap: () => finishNow(),
	});

	onMount(() => {
		ensureSignFont();
		return () => {
			running = false;
		};
	});

	const ink = $derived(premium ? 0xb8860b : 0xd63a28);
	const faceFill = $derived(premium ? 0xffe9a0 : 0xfff4d6);
</script>

<!-- screen-px space, like the rest of the wide site; hidden until the director calls the beat -->
<Container x={place.x} y={place.y} scale={place.s} zIndex={30}>
	<Grab ongrab={grab('root', true)} />
	<!-- shadow on the yard -->
	<Graphics
		draw={(g) => {
			g.ellipse(0, HH * 0.5, HW * 0.5, HH * 0.06).fill({ color: 0x000000, alpha: 0.32 });
		}}
	/>
	<!-- the housing painting (its window is painted opaque navy: the drum is drawn OVER it, clipped) -->
	{#if tex}
		<BaseSprite texture={tex} anchor={0.5} width={HW} height={HH} tint={premium ? 0xffe4b8 : 0xffffff} />
	{/if}
	<!-- the drum, over the housing's window, clipped to it -->
	<Container x={winC.x} y={winC.y}>
		<Graphics
			draw={(g) => {
				// cylinder: a lit cream drum face, darker toward the top and bottom of the window
				g.roundRect(-win.w / 2 + 3, -win.h / 2 + 3, win.w - 6, win.h - 6, 8).fill({ color: premium ? 0xfff1c9 : 0xf6f0e3 });
				const bands = 10;
				for (let i = 0; i < bands; i += 1) {
					const t = i / (bands - 1);
					const d = Math.abs(t - 0.5) * 2;
					g.rect(-win.w / 2, -win.h / 2 + t * win.h - win.h / bands / 2, win.w, win.h / bands + 1).fill({ color: 0x1c1208, alpha: 0.42 * d * d });
				}
				g.rect(-win.w / 2, -win.h / 2, win.w, win.h * 0.06).fill({ color: 0x000000, alpha: 0.35 });
				g.rect(-win.w / 2, win.h / 2 - win.h * 0.06, win.w, win.h * 0.06).fill({ color: 0x000000, alpha: 0.35 });
			}}
		/>
		<Container>
			<!-- clip to the window (mask) -->
			<Graphics isMask draw={(g) => g.roundRect(-win.w / 2 + 3, -win.h / 2 + 3, win.w - 6, win.h - 6, 8).fill({ color: 0xffffff })} />
			{#each FACES as f, i (f)}
				<Container>
					<Grab ongrab={grab(`face${i}`)} />
					<Text anchor={0.5} text={String(f)} style={{ fontFamily: 'LuckySign, Inter, sans-serif', fontSize: FACE_SIZE, fill: 0x1c1208, stroke: { color: premium ? 0xd9a300 : 0xffc400, width: Math.round(FACE_SIZE * 0.06) } }} />
				</Container>
			{/each}
			<!-- the glass: a reflection band across the middle -->
			<Graphics
				draw={(g) => {
					g.rect(-win.w / 2, -win.h * 0.08, win.w, win.h * 0.05).fill({ color: 0xffffff, alpha: 0.12 });
					g.rect(-win.w / 2, -win.h * 0.5, win.w, win.h * 0.5).fill({ color: 0xffffff, alpha: 0.05 });
				}}
			/>
		</Container>
	</Container>
	<!-- steel latch that slides home on the stop -->
	<Container>
		<Grab ongrab={grab('latch', true)} />
		<Graphics
			draw={(g) => {
				g.roundRect(0, -9, win.w * 0.36, 18, 6).fill({ color: 0x1c1208 });
				g.roundRect(2, -7, win.w * 0.36 - 4, 14, 5).fill({ color: 0x9aa3ad });
				g.roundRect(2, -7, win.w * 0.36 - 4, 5, 3).fill({ color: 0xffffff, alpha: 0.35 });
				g.circle(win.w * 0.36 - 12, 0, 4).fill({ color: 0x4a5560 });
			}}
		/>
	</Container>
	<!-- brass plaque: the machine's name (theme §5: the donor SITE PERMIT is the IMPERIAL DECREE), fitted to the plaque -->
	<!-- GATE LOOP r1 (seat C): the lettering ran under the plaque's corner bolts at 1440x900 (first I and last
	     E covered) because the fit ignored the bolts and the letter spacing. The painted bolts sit ~13 % of
	     the plaque width in from each end (measured on permit_housing.webp: plaque x 128-440, bolt inner
	     edges x 163 / 403), so the text now fits the span between them: advance 0.70 em per glyph
	     (Alfa Slab One = LuckySign, measured 10.46 em for IMPERIAL DECREE) plus letterSpacing per glyph. -->
	<Text anchor={0.5} x={plq.x} y={plq.y - 1} text={DECREE} style={{ fontFamily: 'LuckySign, Inter, sans-serif', fontSize: decreeFont, fill: 0x3a2308, letterSpacing: DECREE_LS }} />
	<!-- the red-ink stamp -->
	<Container x={0} y={HH * 0.22}>
		<Grab ongrab={grab('stamp', true)} />
		<Graphics
			draw={(g) => {
				g.roundRect(-HW * 0.34, -HH * 0.085, HW * 0.68, HH * 0.17, 14).stroke({ width: 7, color: ink, alpha: 0.9 });
				g.roundRect(-HW * 0.34 + 11, -HH * 0.085 + 11, HW * 0.68 - 22, HH * 0.17 - 22, 9).stroke({ width: 3, color: ink, alpha: 0.75 });
				g.roundRect(-HW * 0.34, -HH * 0.085, HW * 0.68, HH * 0.17, 14).fill({ color: ink, alpha: 0.08 });
			}}
		/>
		<Container>
			<Grab ongrab={grab('stampText')} />
			<!-- "4 DISTRICTS" is wider than the donor's "4 SITES": sized so the longest face fits inside the stamp's frame -->
			<Text anchor={0.5} text={districtsText(2)} style={{ fontFamily: 'LuckySign, Inter, sans-serif', fontSize: Math.round(HH * 0.068), fill: ink, letterSpacing: 4, alpha: 0.92 }} />
		</Container>
	</Container>
	<!-- hidden: the face fill colour is read by the drum plate above -->
	<Container visible={false}><Graphics draw={(g) => g.rect(0, 0, 1, 1).fill({ color: faceFill })} /></Container>
</Container>
