// The Dragon's Breath performer — the Golden Dragon, internally still `wolf` (components/FeatureDrops.svelte drives the choreography).
//
// There is no rig: the wolf is five painted key poses. What makes him act is everything BETWEEN and
// AROUND the keys, all of it written here from the component's single ticker:
//
//   - pose changes are never a cut: the new key dissolves in over the old one in ~5 frames while the
//     choreography covers the swap with a squash / stretch
//   - the body scales non-uniformly about the CHEST (the swell of the inhale), not about the sprite
//   - rotation and shear are SPRINGS chasing the choreography's targets, and the shear also listens to
//     how fast he is travelling — so the head overshoots, the ears lag the lunge and settle with a
//     wobble, and every move has follow-through for free
//   - a breathing bob that never stops, and a tremble the choreography can dial up (cheeks full)
//
// The choreography only ever writes numbers into `m`; nothing here allocates per frame.
import { PIXI } from 'pixi-svelte';

export type WolfPose = 'peek' | 'inhale' | 'huff' | 'blow' | 'defeated';

/** If a key is missing at runtime, the nearest pose stands in (peek / blow were generated last). */
const FALLBACK: Record<WolfPose, WolfPose[]> = {
	peek: ['peek', 'huff', 'inhale'],
	inhale: ['inhale', 'peek', 'huff'],
	huff: ['huff', 'blow', 'inhale'],
	blow: ['blow', 'huff', 'inhale'],
	defeated: ['defeated', 'peek', 'huff'],
};

/** Every key is painted 512 px tall with the body in the same place; these are texture pixels. */
const ART_H = 512;
const CHEST = { x: 176, y: 330 };
// LUCKY: the five keys are the Golden Dragon now (ART-B, same file names, body flush left, one transform for all
// keys); mouth points measured by ART-B on the new art (art-src/ART_B_HANDOFF.md §4). CHEST still fits (~172,350).
export const WOLF_MOUTH: Record<WolfPose, { x: number; y: number }> = {
	peek: { x: 537, y: 325 },
	inhale: { x: 472, y: 260 },
	huff: { x: 558, y: 286 },
	blow: { x: 604, y: 306 },
	defeated: { x: 462, y: 318 },
};

export const createWolf = (getTexture: (key: string) => PIXI.Texture) => {
	const root = new PIXI.Container();
	const body = new PIXI.Container();
	const sprites = [new PIXI.Sprite(), new PIXI.Sprite()];
	for (const s of sprites) {
		s.anchor.set(0, 0.5);
		s.visible = false;
		body.addChild(s);
	}
	root.addChild(body);
	root.visible = false;
	root.eventMode = 'none';

	/** What the choreography animates. Lengths are board units, angles radians. */
	const m = {
		x: 0,
		y: 0,
		sx: 1,
		sy: 1,
		rot: 0,
		skew: 0,
		/** 0..1: the held-breath shake */
		tremble: 0,
		/** 0..1: the idle breathing bob */
		breath: 1,
		alpha: 1,
		/** 0..1: flush of effort on the face while he holds it in */
		flush: 0,
	};

	let k = 1; // texture px -> board units
	let unit = 120;
	let front = 0;
	let xfT = 0;
	let xfD = 0;
	let t = 0;
	let rot = 0;
	let rotV = 0;
	let skew = 0;
	let skewV = 0;
	let lastX = 0;
	let vx = 0;
	let reduced = false;
	let pose: WolfPose = 'peek';

	const has = (tex: PIXI.Texture | undefined) => !!tex && tex !== PIXI.Texture.EMPTY && tex.width > 2;
	const resolve = (p: WolfPose): PIXI.Texture => {
		for (const q of FALLBACK[p]) {
			const tex = getTexture(`feat_wolf_${q}`);
			if (has(tex)) return tex;
		}
		return PIXI.Texture.EMPTY;
	};

	const place = (s: PIXI.Sprite, tex: PIXI.Texture) => {
		s.texture = tex;
		s.scale.set(k * (ART_H / Math.max(1, tex.height)));
	};

	/** Height in board units; resets every spring and shows the first key. */
	const begin = (heightUnits: number, symbolSize: number, first: WolfPose, isReduced: boolean) => {
		k = heightUnits / ART_H;
		unit = symbolSize;
		reduced = isReduced;
		body.pivot.set(CHEST.x * k, (CHEST.y - ART_H / 2) * k);
		body.position.copyFrom(body.pivot);
		m.sx = m.sy = 1;
		m.rot = m.skew = m.tremble = m.flush = 0;
		m.breath = 1;
		m.alpha = 1;
		rot = rotV = skew = skewV = vx = 0;
		t = 0;
		xfD = 0;
		front = 0;
		pose = first;
		place(sprites[0], resolve(first));
		sprites[0].alpha = 1;
		sprites[0].visible = true;
		sprites[0].tint = 0xffffff;
		sprites[1].visible = false;
		root.visible = true;
	};

	/** Call once the first position is written, so the travel-driven shear does not see a jump. */
	const settle = () => {
		lastX = m.x;
		vx = 0;
	};

	/** Dissolve to another key. The old key stays solid underneath until the new one covers it. */
	const setPose = (next: WolfPose, ms: number) => {
		if (next === pose) return;
		pose = next;
		const old = sprites[front];
		front = 1 - front;
		const cur = sprites[front];
		place(cur, resolve(next));
		cur.visible = true;
		cur.tint = old.tint;
		body.addChild(cur); // to the top
		if (ms <= 0) {
			cur.alpha = 1;
			old.visible = false;
			xfD = 0;
			return;
		}
		cur.alpha = 0;
		old.alpha = 1;
		xfT = 0;
		xfD = ms / 1000;
	};

	const mouth = (p: WolfPose, out: { x: number; y: number }) => {
		const a = WOLF_MOUTH[p];
		out.x = m.x + a.x * k;
		out.y = m.y + (a.y - ART_H / 2) * k;
		return out;
	};

	const hide = () => {
		root.visible = false;
		sprites[0].visible = false;
		sprites[1].visible = false;
		xfD = 0;
	};

	const update = (dt: number) => {
		if (!root.visible) return;
		t += dt;

		if (xfD > 0) {
			xfT += dt;
			const p = Math.min(1, xfT / xfD);
			const cur = sprites[front];
			const old = sprites[1 - front];
			cur.alpha = Math.min(1, p / 0.6);
			old.alpha = p < 0.5 ? 1 : 1 - (p - 0.5) / 0.5;
			if (p >= 1) {
				old.visible = false;
				xfD = 0;
			}
		}

		if (reduced) {
			root.position.set(m.x, m.y);
			root.alpha = m.alpha;
			body.scale.set(1, 1);
			body.rotation = 0;
			body.skew.set(0, 0);
			return;
		}

		// how fast is he travelling? (smoothed; board units / s)
		if (dt > 0) {
			const inst = (m.x - lastX) / dt;
			vx += (inst - vx) * Math.min(1, dt * 18);
			lastX = m.x;
		}

		// head: an underdamped spring chasing the choreography (overshoot + settle)
		const step = Math.min(dt, 1 / 30);
		rotV += ((m.rot - rot) * 210 - rotV * 13) * step;
		rot += rotV * step;
		// ears / crown: shear that lags the travel, then wobbles home
		const lean = Math.max(-0.16, Math.min(0.16, vx / (unit * 34)));
		skewV += ((m.skew + lean - skew) * 150 - skewV * 9.5) * step;
		skew += skewV * step;

		const breath = Math.sin(t * 5.4) * m.breath;
		const tr = m.tremble;
		const jx = tr ? (Math.sin(t * 97) + Math.sin(t * 151 + 1.3)) * 0.5 * tr : 0;
		const jy = tr ? (Math.sin(t * 113 + 0.7) + Math.sin(t * 173)) * 0.5 * tr : 0;

		root.position.set(m.x + jx * unit * 0.014, m.y + breath * unit * 0.012 + jy * unit * 0.01);
		root.alpha = m.alpha;
		body.scale.set(m.sx * (1 - breath * 0.006), m.sy * (1 + breath * 0.011));
		body.rotation = rot + jx * 0.008;
		body.skew.set(skew, 0);

		if (m.flush > 0.001 || sprites[front].tint !== 0xffffff) {
			const f = Math.max(0, Math.min(1, m.flush));
			const gb = Math.round(255 - 50 * f);
			const tint = (255 << 16) | (gb << 8) | gb;
			sprites[0].tint = tint;
			sprites[1].tint = tint;
		}
	};

	const warmKeys = () => (Object.keys(FALLBACK) as WolfPose[]).map((p) => `feat_wolf_${p}`);

	return { root, m, begin, settle, setPose, mouth, hide, update, warmKeys, scale: () => k };
};

export type Wolf = ReturnType<typeof createWolf>;
