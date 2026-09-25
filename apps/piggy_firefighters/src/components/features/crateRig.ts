// The Hard Hat Delivery crate: a weight on a chain (components/FeatureDrops.svelte drives the beats).
//
//   root      sits at the crane TIP, far above the screen, and rotates: the whole load is a pendulum,
//             so the sway moves the crate sideways the way a real hoist does (slower as the chain
//             pays out — the frequency follows the length)
//   chain     drawn links (face-on ring / edge-on bar, alternating, ink outline) in the art's own
//             steel, running from the hook up past the top of the screen; it passes BEHIND the chain
//             painted into the crate art, so the two read as one chain
//   crate     hangs from the hook with its own lagging swing, a vertical spring (the chain takes
//             the weight: overshoot + settle bounce), a rattle, and squash / stretch about the box
//
// Two painted keys: closed and OPEN (lid flying, planks splayed, hats popping). Both are pinned by
// their hook block, and the open key is drawn 1.37x larger than the closed one, which is undone here.
// The choreography writes `m`; springs and the rattle are integrated in `update()` from the one ticker.
import { PIXI } from 'pixi-svelte';

const INK = 0x1c0a0c;
// LUCKY Lantern Cart: the painted line above the hook is a brown ROPE (ART-B handoff §4), so the drawn links
// are rope-coloured. Names kept so every draw call below is untouched.
const STEEL = 0xb07434;
const STEEL_DARK = 0x7a4a1c;
const STEEL_LIGHT = 0xe8b878;

// texture pixels
const CLOSED = { w: 240, h: 384, hookX: 113, hookY: 91, boxW: 218, boxCx: 115, boxCy: 282 };
const OPEN = { w: 349, h: 448, hookX: 171.5, hookY: 88, ratio: 1.37 };
/** where the hats come out of the open crate, in CLOSED-art pixels below the hook */
const BURST_DY = 150;
const LINK_PITCH = 16; // closed-art px between successive links
const LINKS = 96;

const drawChain = (g: PIXI.Graphics, kc: number) => {
	g.clear();
	const u = kc;
	// face-on rings first, the edge-on bars over their ends
	for (let i = 0; i < LINKS; i += 2) {
		const y = -(i * LINK_PITCH + 30) * u;
		g.roundRect(-8 * u, y - 13 * u, 16 * u, 26 * u, 8 * u).stroke({ color: INK, width: 11 * u });
		g.roundRect(-8 * u, y - 13 * u, 16 * u, 26 * u, 8 * u).stroke({ color: STEEL, width: 6.4 * u });
		g.moveTo(-9.6 * u, y - 7 * u)
			.lineTo(-9.6 * u, y + 5 * u)
			.stroke({ color: STEEL_LIGHT, width: 1.8 * u, cap: 'round' });
		g.moveTo(9.4 * u, y - 4 * u)
			.lineTo(9.4 * u, y + 8 * u)
			.stroke({ color: STEEL_DARK, width: 1.8 * u, cap: 'round' });
	}
	for (let i = 1; i < LINKS; i += 2) {
		const y = -(i * LINK_PITCH + 30) * u;
		g.roundRect(-5.2 * u, y - 14 * u, 10.4 * u, 28 * u, 5.2 * u)
			.fill(STEEL)
			.stroke({ color: INK, width: 2.4 * u });
		g.moveTo(-1.8 * u, y - 9 * u)
			.lineTo(-1.8 * u, y + 7 * u)
			.stroke({ color: STEEL_LIGHT, width: 2 * u, cap: 'round' });
		g.moveTo(2.6 * u, y - 8 * u)
			.lineTo(2.6 * u, y + 9 * u)
			.stroke({ color: STEEL_DARK, width: 1.6 * u, cap: 'round' });
	}
};

export const createCrate = (getTexture: (key: string) => PIXI.Texture) => {
	const root = new PIXI.Container();
	const chain = new PIXI.Graphics();
	const hang = new PIXI.Container(); // origin = the hook block
	const box = new PIXI.Container(); // squash / stretch about the box centre
	const closed = new PIXI.Sprite();
	const open = new PIXI.Sprite();
	closed.anchor.set(CLOSED.hookX / CLOSED.w, CLOSED.hookY / CLOSED.h);
	open.anchor.set(OPEN.hookX / OPEN.w, OPEN.hookY / OPEN.h);
	box.addChild(closed, open);
	hang.addChild(box);
	root.addChild(chain, hang);
	root.visible = false;
	root.eventMode = 'none';

	/** What the choreography animates: chain paid out (board units), squash, fade. */
	const m = { len: 0, sx: 1, sy: 1, alpha: 1 };

	let kc = 1;
	let chainFor = 0;
	let unit = 120;
	let cx = 0;
	let tipY = 0;
	let reduced = false;
	let th = 0;
	let thV = 0;
	let ph = 0;
	let phV = 0;
	let yb = 0;
	let ybV = 0;
	let rat = 0;
	let t = 0;

	/** Build the chain geometry ahead of time (mount), so nothing is tessellated when a delivery starts. */
	const prepare = (boxW: number) => {
		kc = boxW / CLOSED.boxW;
		if (chainFor !== kc) {
			drawChain(chain, kc);
			chainFor = kc;
		}
	};

	const begin = (o: { cx: number; tipY: number; len: number; boxW: number; unit: number; reduced: boolean }) => {
		kc = o.boxW / CLOSED.boxW;
		unit = o.unit;
		cx = o.cx;
		tipY = o.tipY;
		reduced = o.reduced;
		if (chainFor !== kc) {
			drawChain(chain, kc); // only when the size changes (first use / a resize between rounds)
			chainFor = kc;
		}
		const texClosed = getTexture('feat_delivery_crate');
		const texOpen = getTexture('feat_delivery_crate_open');
		closed.texture = texClosed;
		closed.scale.set(kc * (CLOSED.h / Math.max(1, texClosed.height)));
		// a missing OPEN key falls back to the closed crate (the flash and the splinters still sell it)
		const haveOpen = texOpen !== PIXI.Texture.EMPTY && texOpen.width > 2;
		open.texture = haveOpen ? texOpen : texClosed;
		if (haveOpen) {
			open.anchor.set(OPEN.hookX / OPEN.w, OPEN.hookY / OPEN.h);
			open.scale.set((kc / OPEN.ratio) * (OPEN.h / Math.max(1, texOpen.height)));
		} else {
			open.anchor.copyFrom(closed.anchor);
			open.scale.copyFrom(closed.scale);
		}
		closed.visible = true;
		open.visible = false;
		box.pivot.set((CLOSED.boxCx - CLOSED.hookX) * kc, (CLOSED.boxCy - CLOSED.hookY) * kc);
		box.position.copyFrom(box.pivot);
		m.len = o.len;
		m.sx = m.sy = 1;
		m.alpha = 1;
		th = thV = ph = phV = yb = ybV = rat = t = 0;
		root.position.set(cx, tipY);
		root.visible = true;
		update(0);
	};

	const showOpen = () => {
		closed.visible = false;
		open.visible = true;
	};

	/** Impulses: swing (rad/s), the crate's own swing (rad/s), vertical (units/s, + = down). */
	const kick = (swing: number, tilt: number, drop: number) => {
		thV += swing;
		phV += tilt;
		ybV += drop;
	};
	const setSwing = (angle: number) => {
		th = angle;
	};
	const rattle = (amount: number) => {
		rat = Math.max(rat, amount);
	};

	/** Centre of the box / where the hats leave it, in the parent's (board) space, sway ignored. */
	const boxCentre = (len: number, out: { x: number; y: number }) => {
		out.x = cx + (CLOSED.boxCx - CLOSED.hookX) * kc;
		out.y = tipY + len + (CLOSED.boxCy - CLOSED.hookY) * kc;
		return out;
	};
	const burstPoint = (len: number, out: { x: number; y: number }) => {
		out.x = cx;
		out.y = tipY + len + BURST_DY * kc;
		return out;
	};
	/** closed-art pixels -> board units */
	const px = (n: number) => n * kc;

	const hide = () => {
		root.visible = false;
		rat = 0;
	};

	function update(dt: number) {
		if (!root.visible) return;
		root.alpha = m.alpha;
		if (reduced) {
			root.rotation = 0;
			hang.position.set(0, m.len);
			hang.rotation = 0;
			chain.y = m.len;
			box.scale.set(1, 1);
			return;
		}
		t += dt;
		const step = Math.min(dt, 1 / 30);
		// pendulum: slower the more chain is out
		const w2 = (unit * 190) / Math.max(unit, m.len);
		thV += (-w2 * th - 1.35 * thV) * step;
		th += thV * step;
		// the crate lags the chain, then swings through
		phV += ((-0.7 * th - ph) * 95 - 3.1 * phV) * step;
		ph += phV * step;
		// the chain takes the weight
		ybV += (-260 * yb - 7.2 * ybV) * step;
		yb += ybV * step;
		rat = Math.max(0, rat - rat * 7.5 * step - 0.12 * step);
		const jr = rat ? Math.sin(t * 71) * 0.042 * rat : 0;
		const jx = rat ? Math.sin(t * 93 + 1) * unit * 0.016 * rat : 0;

		root.rotation = th;
		hang.position.set(jx, m.len + yb);
		hang.rotation = ph + jr;
		chain.y = m.len + yb;
		box.scale.set(m.sx, m.sy);
	}

	const warmKeys = () => ['feat_delivery_crate', 'feat_delivery_crate_open'];

	return { root, m, prepare, begin, showOpen, kick, setSwing, rattle, boxCentre, burstPoint, px, hide, update, warmKeys };
};

export type Crate = ReturnType<typeof createCrate>;
