// Pooled particle kit for the base-game feature characters (components/FeatureDrops.svelte).
//
// Every shape is a GraphicsContext built ONCE; every particle is a Graphics that shares one of those
// contexts and lives for the life of the component (visible = false while idle). Nothing is created,
// destroyed or uploaded while an animation runs, and `update()` allocates nothing: a spawn is
// `take(kind)` + plain field writes on the struct it returns.
//
// All lengths are board units (SYMBOL_SIZE = 120), the space FeatureDrops lays everything out in.
import { PIXI } from 'pixi-svelte';

const INK = 0x2a1a10;
const CREAM = 0xfff1c9;

export type FxKind = 'puff' | 'plank' | 'tuft' | 'straw' | 'leaf' | 'streak' | 'curl' | 'ring' | 'flash' | 'spark';

export type Particle = {
	node: PIXI.Graphics;
	on: boolean;
	/** seconds before it appears (lets a whole volley be scheduled up front, in one go) */
	delay: number;
	t: number;
	/** life in seconds */
	d: number;
	x: number;
	y: number;
	vx: number;
	vy: number;
	gravity: number;
	/** velocity damping per second (0 = none) */
	drag: number;
	rot: number;
	vr: number;
	/** uniform scale at birth / at death (eased out) */
	s0: number;
	s1: number;
	/** extra stretch on x, at birth / at death (wind streaks lengthen as they travel) */
	kx0: number;
	kx1: number;
	/** squash on y (an impact ring is a circle seen edge-on) */
	ky: number;
	alpha: number;
	/** fraction of life spent fading in, and the fraction at which the fade-out starts */
	fadeIn: number;
	fadeOut: number;
	/** sideways flutter riding the wind: amplitude, rad/s, phase */
	wobA: number;
	wobF: number;
	wobP: number;
};

const easeOut = (p: number) => 1 - (1 - p) * (1 - p) * (1 - p);

// ---- the shapes ------------------------------------------------------------------------------
const plankA = () =>
	new PIXI.GraphicsContext()
		.poly([-21, -6.5, 13, -6.5, 20, -2, 14, 1.5, 22, 6.5, -21, 6.5])
		.fill(0xd18c3d)
		.stroke({ color: INK, width: 2.6, join: 'round' })
		.moveTo(-17, -3)
		.lineTo(9, -3)
		.stroke({ color: 0xf2b866, width: 1.8, cap: 'round' })
		.moveTo(-15, 2)
		.lineTo(6, 2)
		.stroke({ color: 0x96591f, width: 1.6, cap: 'round' })
		.circle(-15, 0, 1.7)
		.fill(0x4a3a35);
const plankB = () =>
	new PIXI.GraphicsContext()
		.poly([-15, -5, -9, -1, -16, 5, 12, 5, 17, 1, 11, -5])
		.fill(0xe09a48)
		.stroke({ color: INK, width: 2.4, join: 'round' })
		.moveTo(-8, 1)
		.lineTo(8, 1)
		.stroke({ color: 0x96591f, width: 1.5, cap: 'round' });
const plankC = () =>
	new PIXI.GraphicsContext()
		.poly([-24, -3.5, 20, -4.5, 27, 0, 18, 4.5, -24, 3.5, -19, 0])
		.fill(0xba7630)
		.stroke({ color: INK, width: 2.4, join: 'round' })
		.moveTo(-14, -0.5)
		.lineTo(14, -0.5)
		.stroke({ color: 0xe9ad5e, width: 1.5, cap: 'round' });

const tuft = () => {
	const c = new PIXI.GraphicsContext();
	const blades: [number, number, number, number][] = [
		[-16, -13, -6, -10],
		[-7, -19, -2, -11],
		[3, -20, 2, -11],
		[12, -16, 6, -9],
		[18, -8, 9, -5],
	];
	for (const pass of [0, 1]) {
		for (const [ex, ey, cx, cy] of blades) {
			c.moveTo(0, 0).quadraticCurveTo(cx, cy, ex, ey);
			c.stroke(pass === 0 ? { color: 0x7a5516, width: 5.2, cap: 'round' } : { color: 0xf6d469, width: 2.8, cap: 'round' });
		}
	}
	return c;
};
const straw = () =>
	new PIXI.GraphicsContext().roundRect(-11, -2, 22, 4, 2).fill(0xf6d469).stroke({ color: 0x7a5516, width: 1.5 });
// LUCKY: the Dragon's Breath carries red paper flecks, not green leaves (ART-B handoff §4); the gold `straw`
// blade already reads as gold paper. Same shape, so the pool and its motion are unchanged.
const leaf = () =>
	new PIXI.GraphicsContext()
		.moveTo(-11, 0)
		.quadraticCurveTo(-1, -10, 13, 0)
		.quadraticCurveTo(-1, 10, -11, 0)
		.fill(0xd62828)
		.stroke({ color: 0x5a0e0e, width: 2.2, join: 'round' })
		.moveTo(-8, 0)
		.lineTo(9, 0)
		.stroke({ color: 0xf6d469, width: 1.5, cap: 'round' });

/** Soft dust: stacked translucent discs (the same trick the shutter's dust uses), tintable. */
const puff = () => {
	const c = new PIXI.GraphicsContext();
	for (let k = 0; k < 6; k += 1) c.circle(0, 0, 22 * (1 - k / 7)).fill({ color: 0xffffff, alpha: 0.17 });
	return c;
};

/** A gust streak: a lens that is fat at the leading (right) end and tapers to nothing behind it. */
const streak = () => {
	const c = new PIXI.GraphicsContext();
	const lens = (len: number, h: number, alpha: number, color: number) =>
		c
			.moveTo(-len, 0)
			.bezierCurveTo(-len * 0.45, -h * 0.55, -len * 0.06, -h, 0, 0)
			.bezierCurveTo(-len * 0.06, h, -len * 0.45, h * 0.55, -len, 0)
			.fill({ color, alpha });
	lens(150, 11, 0.34, CREAM);
	lens(132, 6.5, 0.6, 0xfffaea);
	lens(96, 3, 0.95, 0xffffff);
	return c;
};
/** The cartoon gust: a long tapering line that ends in a curl. */
const curl = () => {
	const c = new PIXI.GraphicsContext();
	const path = () =>
		c
			.moveTo(-170, 6)
			.bezierCurveTo(-110, -2, -50, -4, -8, -2)
			.bezierCurveTo(22, 0, 30, -30, 6, -32)
			.bezierCurveTo(-14, -33, -16, -10, 2, -12);
	path().stroke({ color: CREAM, width: 9, cap: 'round', join: 'round', alpha: 0.4 });
	path().stroke({ color: 0xffffff, width: 4.2, cap: 'round', join: 'round', alpha: 0.95 });
	return c;
};

const ring = () =>
	new PIXI.GraphicsContext()
		.circle(0, 0, 40)
		.stroke({ color: 0xffffff, width: 7, alpha: 0.9 })
		.circle(0, 0, 33)
		.stroke({ color: 0xffffff, width: 2.5, alpha: 0.45 });

/** The burst flash: a hot core and eight tapered rays (drawn additive). */
const flash = () => {
	const c = new PIXI.GraphicsContext();
	for (let i = 0; i < 8; i += 1) {
		const a = (i / 8) * Math.PI * 2 + 0.2;
		const len = i % 2 ? 78 : 118;
		const w = 0.13;
		c.poly([
			Math.cos(a - w) * 16,
			Math.sin(a - w) * 16,
			Math.cos(a) * len,
			Math.sin(a) * len,
			Math.cos(a + w) * 16,
			Math.sin(a + w) * 16,
		]).fill({ color: 0xfff3c0, alpha: 0.75 });
	}
	for (let k = 0; k < 5; k += 1) c.circle(0, 0, 58 * (1 - k / 6)).fill({ color: 0xfff6d8, alpha: 0.26 });
	return c;
};
const spark = () =>
	new PIXI.GraphicsContext()
		.poly([0, -13, 2.6, -2.6, 13, 0, 2.6, 2.6, 0, 13, -2.6, 2.6, -13, 0, -2.6, -2.6])
		.fill(0xffffff)
		.circle(0, 0, 3)
		.fill({ color: 0xffffff, alpha: 0.9 });

type Spec = { count: number; front: boolean; add?: boolean; make: (() => PIXI.GraphicsContext)[] };
const SPECS: Record<FxKind, Spec> = {
	streak: { count: 12, front: false, make: [streak] },
	curl: { count: 4, front: false, make: [curl] },
	leaf: { count: 8, front: false, make: [leaf] },
	straw: { count: 14, front: true, make: [straw] },
	ring: { count: 10, front: false, make: [ring] },
	puff: { count: 20, front: true, make: [puff] },
	plank: { count: 15, front: true, make: [plankA, plankB, plankC] },
	tuft: { count: 10, front: true, make: [tuft] },
	flash: { count: 2, front: true, add: true, make: [flash] },
	spark: { count: 14, front: true, add: true, make: [spark] },
};

export const createFxPool = (back: PIXI.Container, front: PIXI.Container) => {
	const contexts: PIXI.GraphicsContext[] = [];
	const pools = {} as Record<FxKind, Particle[]>;
	const cursor = {} as Record<FxKind, number>;
	const all: Particle[] = [];

	for (const kind of Object.keys(SPECS) as FxKind[]) {
		const spec = SPECS[kind];
		const ctxs = spec.make.map((m) => m());
		contexts.push(...ctxs);
		pools[kind] = [];
		cursor[kind] = 0;
		for (let i = 0; i < spec.count; i += 1) {
			const node = new PIXI.Graphics(ctxs[i % ctxs.length]);
			node.visible = false;
			node.eventMode = 'none';
			if (spec.add) node.blendMode = 'add';
			(spec.front ? front : back).addChild(node);
			const p: Particle = {
				node, on: false, delay: 0, t: 0, d: 1, x: 0, y: 0, vx: 0, vy: 0, gravity: 0, drag: 0, rot: 0, vr: 0,
				s0: 1, s1: 1, kx0: 1, kx1: 1, ky: 1, alpha: 1, fadeIn: 0.1, fadeOut: 0.6, wobA: 0, wobF: 0, wobP: 0,
			};
			pools[kind].push(p);
			all.push(p);
		}
	}

	let live = 0;

	/** Next particle of a kind, reset to defaults (round robin: the oldest is recycled when all are busy). */
	const take = (kind: FxKind): Particle => {
		const pool = pools[kind];
		let p = pool[cursor[kind] % pool.length];
		for (let i = 0; i < pool.length; i += 1) {
			const c = pool[(cursor[kind] + i) % pool.length];
			if (!c.on) {
				p = c;
				cursor[kind] = (cursor[kind] + i) % pool.length;
				break;
			}
		}
		cursor[kind] = (cursor[kind] + 1) % pool.length;
		live = 1;
		p.on = true;
		p.delay = 0;
		p.t = 0;
		p.d = 0.5;
		p.x = p.y = p.vx = p.vy = p.gravity = p.drag = p.rot = p.vr = 0;
		p.s0 = p.s1 = p.kx0 = p.kx1 = p.ky = 1;
		p.alpha = 1;
		p.fadeIn = 0.1;
		p.fadeOut = 0.6;
		p.wobA = p.wobF = p.wobP = 0;
		p.node.tint = 0xffffff;
		p.node.visible = false;
		return p;
	};

	const update = (dt: number) => {
		if (!live) return;
		live = 0;
		for (let i = 0; i < all.length; i += 1) {
			const p = all[i];
			if (!p.on) continue;
			live += 1;
			if (p.delay > 0) {
				p.delay -= dt;
				continue;
			}
			p.t += dt;
			const k = p.t / p.d;
			if (k >= 1) {
				p.on = false;
				p.node.visible = false;
				continue;
			}
			if (p.drag) {
				const f = Math.max(0, 1 - p.drag * dt);
				p.vx *= f;
				p.vy *= f;
			}
			p.vy += p.gravity * dt;
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.rot += p.vr * dt;
			const e = easeOut(k);
			const s = p.s0 + (p.s1 - p.s0) * e;
			const kx = p.kx0 + (p.kx1 - p.kx0) * e;
			const node = p.node;
			node.visible = true;
			node.position.set(p.x, p.y + (p.wobA ? Math.sin(p.t * p.wobF + p.wobP) * p.wobA : 0));
			node.rotation = p.rot;
			node.scale.set(s * kx, s * p.ky);
			const fin = p.fadeIn > 0 ? Math.min(1, k / p.fadeIn) : 1;
			const fout = k > p.fadeOut ? 1 - (k - p.fadeOut) / (1 - p.fadeOut) : 1;
			node.alpha = p.alpha * fin * fout;
		}
	};

	const clear = () => {
		for (const p of all) {
			p.on = false;
			p.node.visible = false;
		}
		live = 0;
	};

	const destroy = () => {
		for (const p of all) p.node.destroy();
		for (const c of contexts) c.destroy();
		all.length = 0;
	};

	return { take, update, clear, destroy };
};

export type FxPool = ReturnType<typeof createFxPool>;
