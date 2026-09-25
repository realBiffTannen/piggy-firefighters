<script lang="ts">
	// CELL REELS for ONE board: fifteen pooled one-symbol reels (two sprites and a
	// window shade each), clipped per ROW (three masks a board, not fifteen), and
	// driven entirely from the scene's one ticker (game/build/motion.ts). Nothing
	// here is a reactive prop at 60 Hz and the step loop allocates nothing.
	//
	// A reel: fades its window in, kicks up a touch (anticipation), runs the strip
	// down at a readable cruise with stretch-and-fade motion blur, brakes on an
	// eased curve that overshoots a few percent and comes back (the settle bounce),
	// then squashes onto its stop. A hat stop keeps the flat hat lit on the reel
	// until the 3D hat takes the plot over; a blank stop dims, sits for a beat and
	// eases away so the plot is empty again before the next spin.
	import { onMount } from 'svelte';

	import { BaseSprite, Container, Graphics } from 'pixi-svelte';

	import { SYMBOL_SIZE, BOARD_SIZES } from '../../game/constants';
	import { getContext } from '../../game/context';
	import { addStepper } from '../../game/build/motion';
	import { registerCellReels, REEL_TIMING as T, type CellReelsApi, type PlannedReel, type ReelPlan, type StripSymbol } from '../../game/build/cellReels';
	import { audioDirector } from '../../game/build/audioDirector';
	import Grab from '../scene/Grab.svelte';

	/* eslint-disable @typescript-eslint/no-explicit-any */
	type Props = { board?: number; premium?: boolean };
	const { board = 0, premium = false }: Props = $props();

	const context = getContext();
	const S = SYMBOL_SIZE;
	const W = BOARD_SIZES.width;
	const ROWS = [0, 1, 2];
	const REELS = [0, 1, 2, 3, 4];
	const FIT_REGULAR = 0.78;
	const FIT_HAT = 0.9; // the 3D rest hat spans 0.90 of the cell: a 2D -> 3D swap must not pop

	const texOf = (sym: StripSymbol): any => (context.stateApp.loadedAssets as any)?.[`sym_${sym}`];
	const placeholder = $derived((context.stateApp.loadedAssets as any)?.sym_L1);

	// ---- pooled runtime records (one per cell, allocated once) ---------------------------
	type Rec = {
		node: any; // cell container
		shade: any;
		a: any;
		b: any;
		glow: any;
		plan: PlannedReel | null;
		phase: 0 | 1 | 2 | 3 | 4 | 5; // idle, spinning, settle, hat-hold, blank-hold, blank-away
		t: number; // authored ms since spin start
		pt: number; // ms inside the current post-stop phase
		crossed: boolean;
		lastPos: number;
		symA: StripSymbol | null;
		symB: StripSymbol | null;
	};
	const recs: Rec[] = [];
	for (let i = 0; i < 15; i += 1) recs.push({ node: null, shade: null, a: null, b: null, glow: null, plan: null, phase: 0, t: 0, pt: 0, crossed: false, lastPos: 0, symA: null, symB: null });
	const rowNodes: any[] = [null, null, null];
	const idx = (reel: number, row: number) => row * 5 + reel;

	const grabCell = (i: number) => (node: any) => {
		recs[i].node = node;
		node.visible = false;
	};
	const grabRow = (row: number) => (node: any) => {
		rowNodes[row] = node;
		node.visible = false;
	};
	const bind = (r: Rec) => {
		if (r.a || !r.node) return !!r.a;
		const kids = r.node.children ?? [];
		// order in the markup: Grab adds nothing; shade, glow, spriteB, spriteA
		r.shade = kids[0];
		r.glow = kids[1];
		r.b = kids[2];
		r.a = kids[3];
		return !!(r.shade && r.a && r.b);
	};

	const setSym = (sp: any, r: Rec, which: 'a' | 'b', sym: StripSymbol) => {
		if ((which === 'a' ? r.symA : r.symB) === sym) return;
		const tex = texOf(sym);
		if (!tex) return;
		sp.texture = tex;
		const fit = (sym === 'HAT' || sym === 'GHAT' ? FIT_HAT : FIT_REGULAR) * S;
		const k = fit / Math.max(1, Math.max(tex.width, tex.height));
		sp.__k = k;
		if (which === 'a') r.symA = sym;
		else r.symB = sym;
	};

	const backOut = (p: number) => {
		const c1 = 1.2;
		const c3 = c1 + 1;
		return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
	};

	/** squash on the stop, springing back: 1 = at rest */
	const squashAt = (pt: number, hat: boolean) => {
		const s = Math.min(1, pt / T.settle);
		return 1 - (hat ? 0.17 : 0.11) * Math.sin(s * Math.PI) * (1 - s) * 1.7;
	};

	// ---- run state ------------------------------------------------------------------------
	let running = false;
	let reducedRun = false;
	let scale = 1;
	let onStopCb: ((r: PlannedReel) => void) | null = null;
	let settleResolve: (() => void) | null = null;
	let pending = 0;

	const showRows = () => {
		for (let row = 0; row < 3; row += 1) {
			let any = false;
			for (let reel = 0; reel < 5; reel += 1) if (recs[idx(reel, row)].phase !== 0) any = true;
			if (rowNodes[row]) rowNodes[row].visible = any;
		}
	};

	const idle = (r: Rec) => {
		r.phase = 0;
		r.plan = null;
		if (r.node) r.node.visible = false;
	};

	const place = (r: Rec, pos: number, vn: number, fade: number, squash: number, dimK: number) => {
		const p = r.plan!;
		const j = Math.max(0, Math.min(p.k, Math.floor(pos)));
		const f = pos - j;
		setSym(r.a, r, 'a', p.strip[j]);
		setSym(r.b, r, 'b', p.strip[Math.min(p.k + 1, j + 1)]);
		// gentler streak and fade at cruise: the symbols stay legible while they travel (owner, 2026-09-19)
		const blurY = 1 + 0.22 * vn;
		const blurA = 1 - 0.16 * vn;
		const ka = r.a.__k ?? 1;
		const kb = r.b.__k ?? 1;
		r.a.position.set(0, f * S);
		r.b.position.set(0, (f - 1) * S);
		r.a.scale.set(ka * (1 + (1 - squash) * 0.6), ka * blurY * squash);
		r.b.scale.set(kb, kb * blurY);
		r.a.alpha = blurA * fade;
		r.b.alpha = blurA * fade;
		// a blank that did not build cools to a slate tint; hats stay hot
		const c = Math.round(255 - dimK * 120);
		r.a.tint = (c << 16) | (Math.round(255 - dimK * 95) << 8) | Math.round(255 - dimK * 70);
		r.shade.alpha = fade * (0.55 + 0.25 * vn);
	};

	const step = (dtMs: number) => {
		if (!running) return;
		let live = 0;
		const dt = dtMs / scale; // authored time
		for (let i = 0; i < 15; i += 1) {
			const r = recs[i];
			if (r.phase === 0 || !r.plan) continue;
			live += 1;
			const p = r.plan;
			if (r.phase === 1) {
				r.t += dt;
				const t = r.t;
				const tCruise = T.accel + p.cruise;
				let pos: number;
				if (t < T.accel) {
					const q = t / T.accel;
					pos = p.vmax * T.accel * 0.5 * q * q - 0.13 * Math.sin(Math.PI * q) * (1 - q);
				} else if (t < tCruise) {
					pos = p.vmax * (T.accel / 2 + (t - T.accel));
				} else {
					const p1 = p.vmax * (T.accel / 2 + p.cruise);
					const u = Math.min(1, (t - tCruise) / T.decel);
					pos = p1 + (p.k - p1) * backOut(u);
				}
				const v = dt > 0 ? Math.abs(pos - r.lastPos) / dt : 0;
				r.lastPos = pos;
				const vn = Math.min(1, v / Math.max(1e-6, p.vmax));
				if (!r.crossed && pos >= p.k) {
					// the symbol hits its mark: the tick lands WITH the picture, and the
					// squash rides the brake's own overshoot (impact, then follow-through)
					r.crossed = true;
					r.pt = 0;
					audioDirector.reelStop?.(p.hat !== null, p.order);
					onStopCb?.(p);
				}
				if (r.crossed) r.pt += dt;
				place(r, pos, vn, Math.min(1, t / 200), r.crossed ? squashAt(r.pt, !!p.hat) : 1, r.crossed && !p.hat ? Math.min(0.5, (r.pt / T.settle) * 0.5) : 0);
				if (r.crossed && r.glow && p.hat) r.glow.alpha = Math.min(0.9, (r.pt / T.settle) * 0.9);
				if (t >= p.stopAt) r.phase = 2;
			} else if (r.phase === 2) {
				r.pt += dt;
				const s = Math.min(1, r.pt / T.settle);
				place(r, p.k, 0, reducedRun ? s : 1, reducedRun ? 1 : squashAt(r.pt, !!p.hat), p.hat ? 0 : s * 0.5);
				if (r.glow) r.glow.alpha = p.hat ? Math.min(0.9, s * 0.9) : 0;
				if (s >= 1) {
					r.phase = p.hat ? 3 : 4;
					r.pt = 0;
					pending -= 1;
					if (pending <= 0 && settleResolve) {
						const done = settleResolve;
						settleResolve = null;
						done();
					}
				}
			} else if (r.phase === 3) {
				// hat at rest on its reel, breathing, until the 3D hat takes the plot
				r.pt += dt;
				if (r.glow) r.glow.alpha = 0.7 + 0.25 * Math.sin(r.pt / 170);
			} else if (r.phase === 4) {
				r.pt += dt;
				const s = Math.min(1, r.pt / T.blankHold);
				place(r, p.k, 0, 1, 1, 0.5 + s * 0.5);
				if (s >= 1) {
					r.phase = 5;
					r.pt = 0;
				}
			} else if (r.phase === 5) {
				// "no build": sink back into the dirt and fade — eased, never a pop
				r.pt += dt;
				const s = Math.min(1, r.pt / T.blankAway);
				const e = s * s * (3 - 2 * s);
				place(r, p.k + e * 0.16, 0, 1 - e, 1 - e * 0.12, 1);
				if (s >= 1) idle(r);
			}
		}
		if (live === 0) {
			running = false;
			showRows();
		}
	};

	const clear = () => {
		for (const r of recs) idle(r);
		running = false;
		showRows();
		const done = settleResolve;
		settleResolve = null;
		pending = 0;
		done?.();
	};

	const api: CellReelsApi = {
		spin: (plan: ReelPlan, onStop) =>
			new Promise<void>((resolve) => {
				clear();
				if (!plan.reels.length) return resolve();
				scale = plan.scale || 1;
				reducedRun = plan.reduced;
				onStopCb = onStop ?? null;
				let bound = 0;
				for (const pr of plan.reels) {
					const r = recs[idx(pr.reel, pr.row)];
					if (!bind(r)) continue;
					bound += 1;
					r.plan = pr;
					r.t = 0;
					r.pt = 0;
					r.crossed = false;
					r.lastPos = 0;
					r.symA = null;
					r.symB = null;
					r.node.visible = true;
					if (r.glow) r.glow.alpha = 0;
					if (plan.reduced) {
						// reduced motion: no travel — the stop symbol simply fades up in place
						r.phase = 2;
						place(r, pr.k, 0, 1, 1, 0);
						audioDirector.reelStop?.(pr.hat !== null, pr.order);
						onStop?.(pr);
					} else {
						r.phase = 1;
						place(r, 0, 0, 0, 1, 0);
					}
				}
				if (!bound) return resolve();
				pending = bound;
				settleResolve = resolve;
				running = true;
				showRows();
			}),
		release: (reel, row) => {
			const r = recs[idx(reel, row)];
			if (r && r.plan?.hat && r.phase >= 2) idle(r);
			showRows();
		},
		clear,
	};

	onMount(() => {
		const offStep = addStepper(step);
		const offReg = registerCellReels(board, api);
		return () => {
			offStep();
			offReg();
			clear();
		};
	});

	const bay = S * 0.455;
</script>

{#if placeholder}
	{#each ROWS as row (row)}
		<Container y={(row + 0.5) * S}>
			<Grab ongrab={grabRow(row)} />
			<!-- ONE clip per row: strips travel vertically, so a row band is all a reel needs -->
			<Graphics isMask draw={(g) => g.rect(S * 0.03, -bay, W - S * 0.06, bay * 2).fill({ color: 0xffffff })} />
			{#each REELS as reel (reel)}
				<Container x={(reel + 0.5) * S}>
					<Grab ongrab={grabCell(idx(reel, row))} />
					<!-- window shade: the plot darkens into a reel window while it spins -->
					<Graphics
						alpha={0}
						draw={(g) => {
							g.roundRect(-bay, -bay, bay * 2, bay * 2, S * 0.06).fill({ color: premium ? 0x120c02 : 0x021318, alpha: 0.92 });
							g.rect(-bay, -bay, bay * 2, S * 0.14).fill({ color: 0x000000, alpha: 0.35 });
							g.rect(-bay, bay - S * 0.14, bay * 2, S * 0.14).fill({ color: 0x000000, alpha: 0.35 });
							g.roundRect(-bay, -bay, bay * 2, bay * 2, S * 0.06).stroke({ width: S * 0.02, color: premium ? 0xd9b04a : 0x58b7c6, alpha: 0.5 });
						}}
					/>
					<!-- hat-stop glow (additive), lit only while a hat rests on the reel -->
					<Graphics
						alpha={0}
						blendMode="add"
						draw={(g) => {
							for (let i = 0; i < 5; i += 1) g.circle(0, 0, S * (0.46 - i * 0.07)).fill({ color: premium ? 0xb6ff8a : 0xffd34d, alpha: 0.09 });
						}}
					/>
					<BaseSprite texture={placeholder} anchor={0.5} alpha={0} />
					<BaseSprite texture={placeholder} anchor={0.5} alpha={0} />
				</Container>
			{/each}
		</Container>
	{/each}
{/if}
