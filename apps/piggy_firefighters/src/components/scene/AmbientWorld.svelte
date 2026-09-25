<script lang="ts">
	// THE LIVING SITE (docs/AMBIENT_AND_ANTICIPATION_SPEC.md section 1) — an ACTIVE site
	// (owner, 2026-09-19: "much more like an active construction site ... AAA").
	//
	// Layers, back to front: mood plate (day / blue hour / golden hour — the SAME
	// place, cross-faded) -> the dump truck that crosses the near ground strip under
	// the board -> sky layer masked by the plate's own skyline so it sits BEHIND the hills
	// (drifting mood-tinted clouds, golden-hour rays, the tower crane that hoists
	// its load, slews it across and lowers it again, night beacon on its apex) ->
	// the pig worker hammering on the building's top scaffold deck (sparks fly on
	// every hit) -> floodlights that flicker on at blue hour and throw real light,
	// the cabin window that glows -> golden sparkles.
	//
	// Every plate-space element is placed from tools/art/derive_ambient.py's
	// `anchors` (hand-set on the accepted paintings), so the art and the motion
	// cannot drift apart. Portrait carries the crane, clouds, rays and floodlight
	// only: nothing is ever drawn under the board there (owner ruling), the plate's
	// painted foreground is the ground.
	//
	// Motion is written straight onto the live display objects from ONE ticker
	// callback (see Grab.svelte) — no 60 Hz reactive props — and measured: the
	// rolling cost is published on window.__pwScene.ambientMs (budget 1.5 ms).
	// Everything is static while the tab is hidden, and under reduced motion the
	// world holds a still pose and only cross-fades its mood.
	import { onMount } from 'svelte';

	import { BaseSprite, Container, Graphics, Rectangle, getContextApp } from 'pixi-svelte';

	import { getContext } from '../../game/context';
	import { stateScene, type SceneMood } from '../../game/build/stateScene.svelte';
	import { sceneTex, warmSceneTextures } from '../../game/build/sceneTextures.svelte';
	import { prefersReducedMotion } from '../../game/build/buildTiming';
	import manifest from '../../game/build/ambientParts';
	import Grab from './Grab.svelte';

	/* eslint-disable @typescript-eslint/no-explicit-any */
	const context = getContext();
	const app = getContextApp();
	const reduced = prefersReducedMotion();
	const P = (manifest as any).parts as Record<string, any>;
	const ANCHORS = (manifest as any).anchors as Record<'landscape' | 'portrait', any>;

	// ---- geometry ----------------------------------------------------------------
	const sl = $derived(context.stateGameDerived.sceneLayout());
	const portrait = $derived(sl.canvas.height > sl.canvas.width);
	const orient = $derived(portrait ? 'portrait' : 'landscape');
	const A = $derived(ANCHORS[orient as 'landscape' | 'portrait'] ?? {});
	const plateSize = $derived(portrait ? { w: 1024, h: 1536 } : { w: 1536, h: 1024 });
	const OVERSCAN = 1.035; // room for the parallax travel without showing an edge
	const plateScale = $derived(
		Math.max(sl.canvas.width / plateSize.w, sl.canvas.height / plateSize.h) * OVERSCAN,
	);
	// visible window, in plate px
	const vis = $derived({
		x0: plateSize.w / 2 - sl.canvas.width / 2 / plateScale,
		x1: plateSize.w / 2 + sl.canvas.width / 2 / plateScale,
		y0: plateSize.h / 2 - sl.canvas.height / 2 / plateScale,
		y1: plateSize.h / 2 + sl.canvas.height / 2 / plateScale,
	});
	const toPlateY = (sy: number) => plateSize.h / 2 + (sy - sl.canvas.height / 2) / plateScale;

	const skylinePts = $derived(((manifest as any).skyline[orient] as number[][]).map(([u, v]) => [u * plateSize.w, v * plateSize.h]));
	const skylineAt = (px: number) => {
		const pts = skylinePts;
		let best = pts[0][1];
		for (let i = 0; i < pts.length - 1; i += 1) {
			if (px >= pts[i][0] && px <= pts[i + 1][0]) {
				const t = (px - pts[i][0]) / Math.max(1e-6, pts[i + 1][0] - pts[i][0]);
				best = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t;
				break;
			}
		}
		return best;
	};

	// ---- crane placement (plate px) -------------------------------------------------
	// Portrait: open sky above the board, jib pointing right. Desktop / landscape:
	// the board hides the middle of the sky, so the crane stands in the LEFT gutter
	// with its jib pointing OUT (mirrored), load and trolley in clear view.
	const crane = $derived.by(() => {
		const up = P.crane_upper;
		const jibLen = up.w - up.pivot[0]; // cab pivot -> jib tip, part px
		const trolleyDist = up.trolley[0] - up.pivot[0];
		const above = up.pivot[1];
		const towerLen = up.h - up.pivot[1] - 6 + P.crane_tower.h; // cab pivot -> foot
		const top = vis.y0 + 8;
		if (portrait) {
			const boardTop = toPlateY(sl.frame.y);
			const x = vis.x0 + (vis.x1 - vis.x0) * 0.3;
			const foot = skylineAt(x) + 34; // the foot stands behind the hills
			const s = Math.min(((vis.x1 - vis.x0) * 0.62) / jibLen, (foot - top) / (towerLen + above));
			const y = foot - towerLen * s;
			// the load must clear the board's hazard beam
			const hangRoom = (boardTop - 14 - y) / s - (up.trolley[1] - up.pivot[1]) - P.crane_load.h;
			return { x, y, s, mirror: 1, hang: Math.max(34, Math.min(100, hangRoom)) };
		}
		const gutter = (sl.gutter + sl.cell * sl.post * 0.5) / plateScale;
		const x = vis.x0 + gutter * 0.8;
		const foot = skylineAt(x) + 26;
		// the trolley (and its load) must sit inside the gutter; the jib tip may run off
		const s = Math.max(0.18, Math.min((gutter * 0.6) / trolleyDist, (foot - top) / (towerLen + above), 0.7));
		return { x, y: foot - towerLen * s, s, mirror: -1, hang: 84 };
	});

	// ---- prop placement -----------------------------------------------------------------
	// OWNER RULING 2026-09-20: the bunting is REMOVED from every viewport — an unwanted artifact,
	// not just a mobile one (the 2026-09-19 ruling had already taken it off phones as "not necessary
	// nor relevant to the theme"). With it went the last mid-layer prop, so the mid layer and its
	// parallax are gone too. The cement mixer, amber beacon and perching bird were removed earlier.
	// Their manifest geometry stays in ambientParts; no prop is placed and no texture ships.

	// ---- site life placement (plate px, from the manifest anchors) -----------------------
	const sun = $derived(A.sun ?? (portrait ? { x: 512, y: 268 } : { x: 768, y: 330 }));
	const lamps = $derived((A.lamps ?? []) as { x: number; y: number; tx: number; ty: number }[]);
	// OWNER RULING 2026-09-19 (20:15): the hammering pig on the scaffold ("mascot top-right") and the
	// dump truck on the near strip are REMOVED from the ambient world. Do not re-add them; the anchors
	// stay in the manifest, the parts are simply never placed (markup is gated on these being null).
	const worker = $derived.by((): null | { x: number; y: number; s: number; face: number } => null);
	// The dump truck drives the NEAR ground strip between the board's lower beam and the HUD
	// (landscape only): in front of the painted ground, under the reels, never over the world's
	// structures. Measured from the layout, in plate px; too thin a strip -> no truck.
	const road = $derived(null as null | { y: number; h: number }); // owner ruling 2026-09-19: no truck
	const truckScale = $derived(road ? road.h / P.truck.h : 0);

	// ---- textures -----------------------------------------------------------------
	const tex = (k: string) => sceneTex(`amb_${k}`);
	const plateKey = (m: 'base' | 'hold' | 'golden') => `plate_${m}_${orient}`;

	const CLOUDS = [
		{ k: 'cloud_1', y: 0.2, s: 0.74, v: 9, x: 0.08 },
		{ k: 'cloud_2', y: 0.46, s: 0.6, v: 13, x: 0.52 },
		{ k: 'cloud_3', y: 0.7, s: 0.62, v: 7, x: 0.3 },
		{ k: 'cloud_4', y: 0.08, s: 0.5, v: 11, x: 0.78 },
		{ k: 'cloud_5', y: 0.58, s: 0.52, v: 6, x: 0.95 },
	];
	const SPARKS = Array.from({ length: 22 }, (_, i) => i);
	const HITS = Array.from({ length: 10 }, (_, i) => i); // hammer sparks pool
	const PUFFS = Array.from({ length: 6 }, (_, i) => i); // truck dust pool
	const RAYS = 11;

	// ---- live refs ----------------------------------------------------------------
	const R: Record<string, any> = {};
	const grab = (name: string) => (node: any) => (R[name] = node);

	// ---- mood -----------------------------------------------------------------------
	const TINT: Record<SceneMood, { cloud: number; crane: number; prop: number; cloudA: number }> = {
		day: { cloud: 0xffffff, crane: 0xffffff, prop: 0xffffff, cloudA: 1 },
		blue: { cloud: 0x8f7fc4, crane: 0x5a6aa6, prop: 0xa7b0de, cloudA: 0.86 },
		golden: { cloud: 0xffd59a, crane: 0xffc483, prop: 0xffe0aa, cloudA: 0.96 },
	};
	// LUCKY: the golden plate is a golden-dragon NIGHT (ART-B), so the colour under it is night blue, not sunset orange
	const SKY: Record<SceneMood, number> = { day: 0x45bdfd, blue: 0x16266e, golden: 0x1b2150 };
	const mix = { blue: 0, golden: 0 }; // eased plate alphas
	const lerpC = (a: number, b: number, t: number) => {
		const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
		const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
		return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
	};
	const tintFor = (part: 'cloud' | 'crane' | 'prop') =>
		lerpC(lerpC(TINT.day[part], TINT.blue[part], mix.blue), TINT.golden[part], mix.golden);

	// ---- parallax input -------------------------------------------------------------
	const aim = { x: 0, y: 0 };
	const eased = { x: 0, y: 0 };

	// ---- simulation state -----------------------------------------------------------
	const smooth = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
	let t = 0;
	const pend = { a: 0, w: 0, lastX: 0, lastV: 0 };
	// the crane's WORK cycle: wait, hoist the load up, slew it across, lower it, slew back
	const work = { phase: 'idle' as 'idle' | 'hoist' | 'swing' | 'lower' | 'return', t: 0, wait: 3 + Math.random() * 4, hoist: 0, slew: 0, dir: 1 };
	let flood = 0; // 0..1 lamp power
	let floodSeq = -1; // seconds since switch-on (flicker), -1 = settled
	const cloudX: number[] = CLOUDS.map((c) => c.x);
	const sparks = SPARKS.map(() => ({ x: 0, y: 0, life: Math.random(), v: 0, s: 1, ph: Math.random() * 6 }));
	// the worker: hammer up (wind-up), then DOWN (hit) — sparks on every hit
	const hammer = { up: true, t: 0, hold: 0.62, hits: 0, squash: 0 };
	const hits = HITS.map(() => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 0.4, s: 1 }));
	// the dump truck: crosses the ground strip every 22-38 s, alternating direction
	const truck = { on: false, x: 0, dir: 1, until: 9 + Math.random() * 10, t: 0, puffAt: 0 };
	const puffs = PUFFS.map(() => ({ on: false, x: 0, y: 0, life: 0, s: 1 }));
	const cost = { acc: 0, n: 0 };

	const step = (dtMs: number) => {
		if (typeof document !== 'undefined' && document.hidden) return; // static when hidden
		const t0 = performance.now();
		const dt = Math.min(0.05, Math.max(0, dtMs / 1000));
		const mood = stateScene.mood;
		const live = !reduced;
		if (live) t += dt;

		// mood cross-fade (runs under reduced motion too — it is a fade, not motion)
		const k = Math.min(1, dt * 3.2);
		mix.blue += ((mood === 'blue' ? 1 : 0) - mix.blue) * k;
		mix.golden += ((mood === 'golden' ? 1 : 0) - mix.golden) * k;
		if (R.plateHold) R.plateHold.alpha = mix.blue < 0.004 ? 0 : mix.blue;
		if (R.plateGolden) R.plateGolden.alpha = mix.golden < 0.004 ? 0 : mix.golden;
		if (R.plateHold) R.plateHold.visible = mix.blue >= 0.004;
		if (R.plateGolden) R.plateGolden.visible = mix.golden >= 0.004;
		const night = mix.blue;

		// parallax (pointer / gyro), eased; far +-6, mid +-10, near +-14 px
		if (live) {
			eased.x += (aim.x - eased.x) * Math.min(1, dt * 2.4);
			eased.y += (aim.y - eased.y) * Math.min(1, dt * 2.4);
		}
		const cx = sl.canvas.width / 2;
		const cy = sl.canvas.height / 2;
		if (R.far) R.far.position.set(cx - eased.x * 6, cy - eased.y * 4);

		// clouds: drift 6-14 px/s, wrap, mood tinted
		const cloudTint = tintFor('cloud');
		const cloudA = TINT.day.cloudA + (TINT.blue.cloudA - 1) * mix.blue + (TINT.golden.cloudA - 1) * mix.golden;
		const span = vis.x1 - vis.x0 + 520;
		const skyTop = vis.y0 + 8;
		const skyRoom = Math.max(40, Math.min(...skylinePts.map((p) => p[1])) - skyTop - 30);
		CLOUDS.forEach((c, i) => {
			const node = R[`cloud${i}`];
			if (!node) return;
			if (live) cloudX[i] = (cloudX[i] + (c.v / plateScale / span) * dt) % 1;
			node.position.set(vis.x0 - 260 + cloudX[i] * span, skyTop + c.y * skyRoom + Math.sin(t * 0.13 + i) * 3);
			node.tint = cloudTint;
			node.alpha = cloudA;
		});

		// golden hour: a slow fan of rays turns behind the hills
		if (R.rays) {
			R.rays.visible = mix.golden > 0.02;
			R.rays.alpha = mix.golden * (0.42 + 0.08 * Math.sin(t * 0.7));
			R.rays.rotation = t * 0.035;
		}

		// crane: the WORK cycle (day and golden hour; it idles at night), on top of the
		// gentle sway, with the load on a real pendulum that answers every acceleration
		const working = live && night < 0.5;
		if (working) {
			work.t += dt;
			if (work.phase === 'idle' && work.t > work.wait) {
				work.phase = 'hoist';
				work.t = 0;
			} else if (work.phase === 'hoist') {
				work.hoist = smooth(work.t / 3.4);
				if (work.t >= 3.4) {
					work.phase = 'swing';
					work.t = 0;
				}
			} else if (work.phase === 'swing') {
				work.slew = work.dir * 0.1 * smooth(work.t / 4.6);
				if (work.t >= 4.6) {
					work.phase = 'lower';
					work.t = 0;
				}
			} else if (work.phase === 'lower') {
				work.hoist = 1 - smooth(work.t / 3.4);
				if (work.t >= 3.4) {
					work.phase = 'return';
					work.t = 0;
				}
			} else if (work.phase === 'return') {
				work.slew = work.dir * 0.1 * (1 - smooth(work.t / 4.6));
				if (work.t >= 4.6) {
					work.phase = 'idle';
					work.t = 0;
					work.wait = 3 + Math.random() * 5;
					work.dir = -work.dir;
				}
			}
		} else if (work.phase !== 'idle') {
			// night falls mid-lift: the load comes down and the jib settles
			work.hoist = Math.max(0, work.hoist - dt * 0.4);
			work.slew *= Math.max(0, 1 - dt * 0.8);
			if (work.hoist <= 0.001 && Math.abs(work.slew) < 0.002) {
				work.phase = 'idle';
				work.t = 0;
			}
		}
		const swayAmp = (1 - night * 0.85) * (live ? 1 : 0) * (1 - 0.6 * Math.abs(work.slew) / 0.1);
		const sway = Math.sin((t * Math.PI * 2) / 11.5) * swayAmp;
		if (R.craneUpper) {
			R.craneUpper.rotation = sway * 0.042 + work.slew;
			// a jib slewing toward the camera foreshortens
			R.craneUpper.scale.x = 1 - 0.035 * (1 - Math.cos((t * Math.PI * 2) / 11.5)) * swayAmp - 0.8 * Math.abs(work.slew);
		}
		const hang = crane.hang * (1 - 0.62 * work.hoist) + Math.sin(t / 8.5) * 16 * swayAmp * (1 - work.hoist);
		if (R.pend && R.craneUpper) {
			const up = P.crane_upper;
			const px = (up.trolley[0] - up.pivot[0]) * R.craneUpper.scale.x;
			// pivot's horizontal travel (part px) -> drives the swing
			const worldX = px * Math.cos(R.craneUpper.rotation);
			const v = dt > 0 ? (worldX - pend.lastX) / dt : 0;
			const acc = dt > 0 ? (v - pend.lastV) / dt : 0;
			pend.lastX = worldX;
			pend.lastV = v;
			const L = hang + 60;
			const w2 = Math.pow((Math.PI * 2) / 2.6, 2); // ~2.6 s period
			const gust = Math.sin(t * 0.37) * Math.sin(t * 0.11 + 1.3) * 0.9;
			const aa = -w2 * Math.sin(pend.a) - 0.55 * pend.w - (Math.max(-400, Math.min(400, acc)) / L) * 0.9 + gust * 0.25;
			if (live) {
				pend.w += aa * dt;
				pend.a = Math.max(-0.16, Math.min(0.16, pend.a + pend.w * dt));
			}
			R.pend.rotation = pend.a - R.craneUpper.rotation;
			if (R.cable) R.cable.scale.y = hang / P.crane_cable.h;
			if (R.load) R.load.position.y = hang;
		}
		if (R.crane) R.crane.tint = tintFor('crane');
		if (R.craneLight) {
			const on = night > 0.5 && (t % 1.4) < 0.5;
			R.craneLight.alpha = on ? night : 0;
		}

		// the worker: wind up, HIT, sparks; a breather every few hits
		if (R.worker && worker) {
			hammer.t += live ? dt : 0;
			if (hammer.up) {
				const wind = hammer.t > hammer.hold - 0.16 ? (hammer.t - (hammer.hold - 0.16)) / 0.16 : 0;
				if (R.workerUp) R.workerUp.scale.set(1, 1 + 0.03 * wind);
				if (hammer.t >= hammer.hold) {
					hammer.up = false;
					hammer.t = 0;
					hammer.hits += 1;
					hammer.squash = 1;
					// sparks off the hammer head
					const imp = P.worker_down.impact;
					const ix = (imp[0] - P.worker_down.pivot[0]) * worker.s * worker.face;
					const iy = (imp[1] - P.worker_down.pivot[1]) * worker.s;
					let n = 4 + Math.floor(Math.random() * 3);
					for (const h of hits) {
						if (h.on || n <= 0) continue;
						n -= 1;
						h.on = true;
						h.x = ix;
						h.y = iy;
						h.vx = (20 + Math.random() * 120) * worker.face * (Math.random() < 0.25 ? -0.5 : 1);
						h.vy = -(70 + Math.random() * 150);
						h.life = 0;
						h.max = 0.3 + Math.random() * 0.25;
						h.s = 0.5 + Math.random() * 0.7;
					}
				}
			} else {
				hammer.squash = Math.max(0, hammer.squash - dt * 5);
				if (R.workerDown) R.workerDown.scale.set(1 + 0.04 * hammer.squash, 1 - 0.05 * hammer.squash);
				if (hammer.t >= 0.26) {
					hammer.up = true;
					hammer.t = 0;
					if (R.workerUp) R.workerUp.scale.set(1, 1);
					// every fourth blow he straightens up for a breath
					hammer.hold = hammer.hits % 4 === 0 ? 1.9 : 0.55 + Math.random() * 0.2;
				}
			}
			if (R.workerUp) R.workerUp.visible = hammer.up;
			if (R.workerDown) R.workerDown.visible = !hammer.up;
			R.worker.tint = tintFor('prop');
			for (let i = 0; i < hits.length; i += 1) {
				const h = hits[i];
				const node = R[`hit${i}`];
				if (!node) continue;
				node.visible = h.on;
				if (!h.on) continue;
				h.life += dt;
				h.vy += 520 * dt;
				h.x += h.vx * dt;
				h.y += h.vy * dt;
				const u = h.life / h.max;
				node.position.set(h.x, h.y);
				node.alpha = 1 - u * u;
				node.scale.set(h.s * (1.1 - 0.6 * u));
				node.rotation = h.life * 9;
				if (u >= 1) h.on = false;
			}
		}

		// the dump truck: crosses the ground strip under the board
		if (R.truck && road) {
			const quiet = !stateScene.busy && !stateScene.covered;
			if (!truck.on) {
				truck.until -= dt;
				if (live && truck.until <= 0 && quiet) {
					truck.on = true;
					truck.t = 0;
					const w = P.truck.w * truckScale;
					truck.x = truck.dir > 0 ? vis.x0 - w : vis.x1 + w;
				}
			}
			R.truck.visible = truck.on;
			if (truck.on) {
				truck.t += dt;
				truck.x += 150 * truck.dir * dt;
				const w = P.truck.w * truckScale;
				if ((truck.dir > 0 && truck.x > vis.x1 + w) || (truck.dir < 0 && truck.x < vis.x0 - w)) {
					truck.on = false;
					truck.dir = -truck.dir;
					truck.until = 22 + Math.random() * 16;
				}
				// a little engine judder and a nod over the bumps
				R.truck.position.set(truck.x, road.y + Math.sin(t * 57) * 0.8);
				R.truck.rotation = Math.sin(t * 2.3) * 0.012;
				R.truck.scale.set(truckScale * truck.dir, truckScale);
				R.truck.tint = tintFor('prop');
				// dust kicked up behind the rear wheels
				truck.puffAt -= dt;
				if (truck.puffAt <= 0) {
					truck.puffAt = 0.16;
					const p = puffs.find((q) => !q.on);
					if (p) {
						p.on = true;
						p.x = truck.x - truck.dir * w * 0.42;
						p.y = road.y - 3;
						p.life = 0;
						p.s = 0.7 + Math.random() * 0.6;
					}
				}
			}
			for (let i = 0; i < puffs.length; i += 1) {
				const p = puffs[i];
				const node = R[`puff${i}`];
				if (!node) continue;
				node.visible = p.on;
				if (!p.on) continue;
				p.life += dt;
				const u = p.life / 0.75;
				node.position.set(p.x - truck.dir * u * 14, p.y - u * 16);
				node.scale.set(p.s * (0.4 + u * 1.3));
				node.alpha = 0.32 * (1 - u) * (1 - 0.5 * night);
				if (u >= 1) p.on = false;
			}
		}

		// floodlights: flicker ON when blue hour arrives, then hum; the cabin window glows
		if (mood === 'blue' && flood < 1 && floodSeq < 0 && mix.blue > 0.5) floodSeq = 0;
		if (mood !== 'blue') {
			flood = Math.max(0, flood - dt * 3);
			floodSeq = -1;
		} else if (floodSeq >= 0) {
			floodSeq += dt;
			const s = floodSeq;
			flood = reduced ? 1 : s < 0.08 ? 0.7 : s < 0.2 ? 0.1 : s < 0.3 ? 0.85 : s < 0.42 ? 0.25 : s < 0.62 ? 0.9 : 1;
			if (s > 0.9) floodSeq = -2; // settled
		}
		const hum = 0.92 + 0.08 * Math.sin(t * 17) * Math.sin(t * 5.3);
		for (let i = 0; i < lamps.length; i += 1) {
			const node = R[`lamp${i}`];
			if (!node) continue;
			node.alpha = flood * hum;
			node.visible = flood > 0.01;
		}
		if (R.cabin) {
			R.cabin.alpha = flood * (0.8 + 0.2 * Math.sin(t * 1.7));
			R.cabin.visible = flood > 0.01;
		}

		// golden hour: sparkles rise off the field
		if (R.sparks) R.sparks.visible = mix.golden > 0.02;
		if (mix.golden > 0.02) {
			const w = vis.x1 - vis.x0;
			sparks.forEach((sp, i) => {
				const node = R[`spark${i}`];
				if (!node) return;
				if (live) sp.life += dt * sp.v;
				if (sp.life >= 1 || sp.v === 0) {
					sp.life = sp.v === 0 ? Math.random() : 0;
					sp.x = vis.x0 + Math.random() * w;
					sp.y = vis.y0 + (vis.y1 - vis.y0) * (0.45 + Math.random() * 0.5);
					sp.v = 0.16 + Math.random() * 0.2;
					sp.s = 0.5 + Math.random() * 0.9;
				}
				const rise = sp.life * (vis.y1 - vis.y0) * 0.34;
				node.position.set(sp.x + Math.sin(t * 0.9 + sp.ph) * 10, sp.y - rise);
				const tw = 0.6 + 0.4 * Math.sin(t * 5 + sp.ph * 3);
				node.alpha = Math.sin(sp.life * Math.PI) * mix.golden * tw;
				node.scale.set(sp.s * (0.7 + 0.3 * tw));
				node.rotation = t * 0.6 + sp.ph;
			});
		}

		cost.acc += performance.now() - t0;
		cost.n += 1;
		if (cost.n >= 120) {
			const w = window as any;
			if (import.meta.env.DEV) w.__pwScene = { ...(w.__pwScene ?? {}), ambientMs: +(cost.acc / cost.n).toFixed(3) };
			cost.acc = 0;
			cost.n = 0;
		}
	};

	onMount(() => {
		void warmSceneTextures();
		// dev affordance: ?mood=blue|golden previews a time of day without a bonus
		if (import.meta.env.DEV) {
			const m = new URLSearchParams(window.location.search).get('mood');
			if (m === 'blue' || m === 'golden' || m === 'day') stateScene.mood = m;
			(window as any).__pwSceneRefs = R;
		}
		const ticker = app.stateApp.pixiApplication?.ticker;
		const tick = (tk: any) => step(tk?.deltaMS ?? 16.7);
		ticker?.add(tick);

		const onMove = (e: PointerEvent) => {
			if (e.pointerType === 'touch') return;
			aim.x = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
			aim.y = (e.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
		};
		// gyro only where the browser hands it over without a permission prompt
		const onTilt = (e: DeviceOrientationEvent) => {
			if (e.gamma == null || e.beta == null) return;
			aim.x = Math.max(-1, Math.min(1, e.gamma / 25));
			aim.y = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
		};
		if (!reduced) {
			window.addEventListener('pointermove', onMove, { passive: true });
			if (typeof (window as any).DeviceOrientationEvent?.requestPermission !== 'function') {
				window.addEventListener('deviceorientation', onTilt, { passive: true });
			}
		}
		return () => {
			ticker?.remove(tick);
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('deviceorientation', onTilt);
		};
	});

	const star = (g: any, r: number, color: number) => {
		g.poly([0, -r, r * 0.22, -r * 0.22, r, 0, r * 0.22, r * 0.22, 0, r, -r * 0.22, r * 0.22, -r, 0, -r * 0.22, -r * 0.22]).fill({ color });
		g.circle(0, 0, r * 0.9).fill({ color, alpha: 0.12 });
	};
	const softGlow = (g: any, r: number, color: number, a = 0.1, rings = 9) => {
		for (let i = 0; i < rings; i += 1) g.circle(0, 0, r * (1 - i / rings)).fill({ color, alpha: a });
	};
	/** a floodlight beam: a soft cone from the lamp head to where its light falls */
	const beam = (g: any, lamp: { x: number; y: number; tx: number; ty: number }) => {
		const dx = lamp.tx - lamp.x;
		const dy = lamp.ty - lamp.y;
		const len = Math.hypot(dx, dy) * 1.25;
		const dir = Math.atan2(dy, dx);
		for (let i = 0; i < 6; i += 1) {
			const s = 0.3 * (1 - i * 0.13);
			g.poly([0, 0, Math.cos(dir - s) * len, Math.sin(dir - s) * len, Math.cos(dir + s) * len, Math.sin(dir + s) * len]).fill({ color: 0xffd98a, alpha: 0.04 });
		}
		// the pool of light where the beam lands
		for (let i = 0; i < 6; i += 1) g.ellipse(dx, dy, 120 * (1 - i / 6), 44 * (1 - i / 6)).fill({ color: 0xffd98a, alpha: 0.05 });
		softGlow(g, 70, 0xffd98a, 0.06);
		softGlow(g, 22, 0xfff1c4, 0.16);
	};
</script>

<!-- never black: the mood's own sky colour sits under everything -->
<Rectangle {...sl.canvas} backgroundColor={SKY[stateScene.mood]} zIndex={-6} />

<Container zIndex={-5}>
	<!-- FAR: plate + everything painted INTO the world share one parallax so the skyline mask stays exact -->
	<Container>
		<Grab ongrab={grab('far')} />
		<Container scale={plateScale} pivot={{ x: plateSize.w / 2, y: plateSize.h / 2 }}>
			{#if tex(plateKey('base'))}
				<BaseSprite texture={tex(plateKey('base'))} width={plateSize.w} height={plateSize.h} zIndex={0} />
			{/if}
			<!-- NOTE: pixi-svelte appends a node when it MOUNTS, so a sprite that waits
			     for its texture would land on top of everything; explicit zIndex
			     keeps the painted order whatever the load order is. -->
			<Container zIndex={1}>
				<Grab ongrab={grab('plateHold')} />
				{#if tex(plateKey('hold'))}
					<BaseSprite texture={tex(plateKey('hold'))} width={plateSize.w} height={plateSize.h} />
				{/if}
			</Container>
			<Container zIndex={2}>
				<Grab ongrab={grab('plateGolden')} />
				{#if tex(plateKey('golden'))}
					<BaseSprite texture={tex(plateKey('golden'))} width={plateSize.w} height={plateSize.h} />
				{/if}
			</Container>

			<!-- the near ground strip under the board (landscape): the dump truck crosses it, in
			     front of the painted ground and behind the reels' timber -->
			{#if road}
				<Container zIndex={3}>
					<Container visible={false}>
						<Grab ongrab={grab('truck')} />
						{#if tex('truck')}
							<BaseSprite texture={tex('truck')} x={-P.truck.pivot[0]} y={-P.truck.pivot[1]} />
						{/if}
					</Container>
					{#each PUFFS as i (i)}
						<Container visible={false}>
							<Grab ongrab={grab(`puff${i}`)} />
							<Graphics
								draw={(g) => {
									g.circle(0, 0, 9).fill({ color: 0xc9a072, alpha: 0.9 });
									g.circle(6, 3, 7).fill({ color: 0xc9a072, alpha: 0.9 });
									g.circle(-6, 4, 6).fill({ color: 0xb98c5e, alpha: 0.9 });
								}}
							/>
						</Container>
					{/each}
				</Container>
			{/if}

			<!-- SKY LAYER, masked to everything ABOVE the painted skyline -->
			<Container zIndex={4}>
				<Graphics
					isMask
					draw={(g) => {
						const pts: number[] = [-200, -400, plateSize.w + 200, -400];
						for (let i = skylinePts.length - 1; i >= 0; i -= 1) pts.push(skylinePts[i][0], skylinePts[i][1]);
						g.poly(pts).fill({ color: 0xffffff });
					}}
				/>
				<!-- golden hour: rays fan up from behind the hills and turn, slowly -->
				<Container x={sun.x} y={sun.y} visible={false} zIndex={0}>
					<Grab ongrab={grab('rays')} />
					<Graphics
						blendMode="add"
						draw={(g) => {
							const len = Math.max(plateSize.w, plateSize.h) * 1.2;
							for (let i = 0; i < RAYS; i += 1) {
								const a = (i / RAYS) * Math.PI * 2;
								const w = 0.07 + 0.03 * (i % 2);
								g.poly([0, 0, Math.cos(a - w) * len, Math.sin(a - w) * len, Math.cos(a + w) * len, Math.sin(a + w) * len]).fill({ color: 0xffe9a8, alpha: 0.16 + 0.06 * (i % 2) });
							}
						}}
					/>
				</Container>
				{#each CLOUDS as c, i (c.k)}
					<Container scale={c.s} zIndex={1}>
						<Grab ongrab={grab(`cloud${i}`)} />
						{#if tex(c.k)}
							<BaseSprite texture={tex(c.k)} anchor={0.5} />
						{/if}
					</Container>
				{/each}

				<Container x={crane.x} y={crane.y} scale={{ x: crane.s * crane.mirror, y: crane.s }} zIndex={2}>
					<Grab ongrab={grab('crane')} />
					{#if tex('crane_tower')}
						<BaseSprite
							texture={tex('crane_tower')}
							x={-P.crane_tower.top[0]}
							y={P.crane_upper.h - P.crane_upper.pivot[1] - 6}
							zIndex={0}
						/>
					{/if}
					<Container zIndex={1}>
						<Grab ongrab={grab('craneUpper')} />
						<Container zIndex={0} x={P.crane_upper.trolley[0] - P.crane_upper.pivot[0]} y={P.crane_upper.trolley[1] - P.crane_upper.pivot[1]}>
							<Grab ongrab={grab('pend')} />
							<Container zIndex={0}>
								<Grab ongrab={grab('cable')} />
								{#if tex('crane_cable')}
									<BaseSprite texture={tex('crane_cable')} anchor={{ x: 0.5, y: 0 }} />
								{/if}
							</Container>
							<Container zIndex={1}>
								<Grab ongrab={grab('load')} />
								{#if tex('crane_load')}
									<BaseSprite texture={tex('crane_load')} x={-P.crane_load.pivot[0]} y={-P.crane_load.pivot[1]} />
								{/if}
							</Container>
						</Container>
						{#if tex('crane_upper')}
							<BaseSprite texture={tex('crane_upper')} x={-P.crane_upper.pivot[0]} y={-P.crane_upper.pivot[1]} zIndex={1} />
						{/if}
						<Container x={P.crane_upper.apex[0] - P.crane_upper.pivot[0]} y={P.crane_upper.apex[1] - P.crane_upper.pivot[1] - 8} alpha={0} zIndex={2}>
							<Grab ongrab={grab('craneLight')} />
							<Graphics blendMode="add" draw={(g) => softGlow(g, 46, 0xff2a1a, 0.12)} />
							<Graphics draw={(g) => g.circle(0, 0, 7).fill({ color: 0xff5540 })} />
						</Container>
					</Container>
				</Container>
			</Container>

			<!-- the worker on the building's top scaffold deck (landscape): hammer up / hammer down, sparks -->
			{#if worker}
				<Container x={worker.x} y={worker.y} scale={{ x: worker.s * worker.face, y: worker.s }} zIndex={5}>
					<Grab ongrab={grab('worker')} />
					<Container>
						<Grab ongrab={grab('workerUp')} />
						{#if tex('worker_up')}
							<BaseSprite texture={tex('worker_up')} x={-P.worker_up.pivot[0]} y={-P.worker_up.pivot[1]} />
						{/if}
					</Container>
					<Container visible={false}>
						<Grab ongrab={grab('workerDown')} />
						{#if tex('worker_down')}
							<BaseSprite texture={tex('worker_down')} x={-P.worker_down.pivot[0]} y={-P.worker_down.pivot[1]} />
						{/if}
					</Container>
				</Container>
				<Container x={worker.x} y={worker.y} zIndex={6}>
					{#each HITS as i (i)}
						<Container visible={false}>
							<Grab ongrab={grab(`hit${i}`)} />
							<Graphics blendMode="add" draw={(g) => star(g, 6, i % 3 === 0 ? 0xffffff : 0xffd24a)} />
						</Container>
					{/each}
				</Container>
			{/if}

			<!-- blue hour: the painted floodlights actually throw light; the cabin window glows -->
			{#each lamps as lamp, i (i)}
				<Container x={lamp.x} y={lamp.y} alpha={0} visible={false} zIndex={7}>
					<Grab ongrab={grab(`lamp${i}`)} />
					<Graphics blendMode="add" draw={(g) => beam(g, lamp)} />
				</Container>
			{/each}
			{#if A.window}
				<Container x={A.window.x} y={A.window.y} alpha={0} visible={false} zIndex={7}>
					<Grab ongrab={grab('cabin')} />
					<Graphics
						blendMode="add"
						draw={(g) => {
							const w = A.window.w;
							const h = A.window.h;
							for (let i = 0; i < 6; i += 1) {
								const grow = 1 + i * 0.35;
								g.roundRect((-w / 2) * grow, (-h / 2) * grow, w * grow, h * grow, 10 * grow).fill({ color: 0xffd27a, alpha: 0.05 });
							}
						}}
					/>
				</Container>
			{/if}

			<!-- golden hour: sparkles rising off the field -->
			<Container visible={false} zIndex={8}>
				<Grab ongrab={grab('sparks')} />
				{#each SPARKS as i (i)}
					<Container alpha={0}>
						<Grab ongrab={grab(`spark${i}`)} />
						<Graphics blendMode="add" draw={(g) => star(g, 9, i % 3 === 0 ? 0xffffff : 0xffe48a)} />
					</Container>
				{/each}
			</Container>
		</Container>
	</Container>

	<!-- MID: empty. The bunting was the last prop in this layer and was removed at the owner's request
	     (2026-09-20), as the amber beacon, the perching bird and the cement mixer were before it
	     (2026-09-19). Manifest entries remain for geometry; no texture ships. Do not re-add them. -->
</Container>
