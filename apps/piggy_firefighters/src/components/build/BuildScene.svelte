<script lang="ts" module>
	import type { EmitterEventBuildEffects } from './BuildEffects.svelte';
	import type { EmitterEventBuildBoard } from './BuildBoard.svelte';
	import type { EmitterEventShutter } from '../scene/SceneShutter.svelte';
	import type { EmitterEventCountReel } from './CountReel.svelte';
	import type { BuildOrBustOutcome } from '../../game/typesBookEvent';

	export type EmitterEventBuildScene =
		| { type: 'buildTotalPresent'; amount: number; winLevel: number; capped: boolean }
		| { type: 'buildTotalHide' }
		| { type: 'buildOrBustOutcome'; outcome: BuildOrBustOutcome }
		// ---- EXPANDED HOLD & BUILD reveal (contract 7.2) — all resolve when the beat is done
		/** camera pull-back: the layout makes room for `count` boards */
		| { type: 'expandPullBack'; count: number }
		/** one booked board is craned / hinged in, lands, and is bolted down */
		| { type: 'expandBoardIn'; board: number }
		/** the count beat: identical held breath, then (final) the sign stamps the booked count */
		| { type: 'expandCount'; count: number; final: boolean }
		/** end of the round: the shared meter (already holding every door prize) is sealed with one beat */
		| { type: 'expandTotalSeal' }
		/** skip / stale / resume: everything at its final layout, no motion */
		| { type: 'expandSnap' };

	export type EmitterEventBuild = EmitterEventBuildScene | EmitterEventBuildBoard | EmitterEventBuildEffects | EmitterEventShutter | EmitterEventCountReel;
</script>

<script lang="ts">
	// THE BUILD SITE. One board component (BuildBoard.svelte) instantiated from
	// per-board state:
	//
	//   - Hold & Build / Golden Build: ONE board, drawn inside the base timber frame
	//     exactly as before (the bonus is the same board at a different hour).
	//   - EXPANDED HOLD & BUILD / GOLDEN EXPANDED: the site OPENS UP into the booked
	//     2-4 boards. The player first sees one board; then the camera pulls back,
	//     the scaffold slides apart and each extra board is craned or hinged in with
	//     weight, dust and a bolt-down beat — one beat per board, and only ever for
	//     a board that is in the book.
	//
	// All reveal motion is written straight onto display objects from the scene's
	// ONE ticker (game/build/motion.ts); nothing here is a 60 Hz reactive prop.
	import { Tween } from 'svelte/motion';
	import { cubicOut, backOut } from 'svelte/easing';
	import { onMount } from 'svelte';

	import { BaseSprite, Container, Graphics, Text, getContextApp } from 'pixi-svelte';
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { waitForTimeout } from 'utils-shared/wait';

	import { SYMBOL_SIZE, BOARD_SIZES } from '../../game/constants';
	import { getContext } from '../../game/context';
	import { formatBookMultiple } from '../../game/money';
	import { WIN_CAP_BOOKED } from '../../game/roundTier';
	import { stateBuild } from '../../game/build/stateBuild.svelte';
	import { stateScene } from '../../game/build/stateScene.svelte';
	import { dur, hold, prefersReducedMotion } from '../../game/build/buildTiming';
	import { winLevelMap, type WinLevel } from '../../game/winLevelMap';
	import { drawSignPanel, signTitleStyle, signValueStyle, ensureSignFont, SIGN } from '../../game/build/signPanel';
	import { sceneTex } from '../../game/build/sceneTextures.svelte';
	import { attachMotion, tween, ease, springDecay, finishAllTweens, lerp } from '../../game/build/motion';
	import { expandLayout, boardBox, type ExpandLayout } from '../../game/build/expandLayout';
	import { audioDirector } from '../../game/build/audioDirector';
	import { getCellReels } from '../../game/build/cellReels';
	import { expandedTitle } from '../../game/build/expandDirector';
	import { districtsText } from '../../game/names';
	import BuildBoard from './BuildBoard.svelte';
	import CountReel from './CountReel.svelte';
	import Grab from '../scene/Grab.svelte';

	/* eslint-disable @typescript-eslint/no-explicit-any */
	const context = getContext();
	const app = getContextApp();
	const S = SYMBOL_SIZE;
	const W = BOARD_SIZES.width;
	const H = BOARD_SIZES.height;

	const sl = $derived(context.stateGameDerived.sceneLayout());
	const boardLayout = () => context.stateGameDerived.boardLayout();
	const premium = $derived(stateBuild.premium);
	const expanded = $derived(stateBuild.expanded);

	onMount(() => attachMotion(app.stateApp.pixiApplication?.ticker));

	// ---- total plate (single-board and expanded rounds below BIG WIN) ---------------------
	let showTotalPlate = $state(false);
	let totalAmount = $state(0);
	let totalWinLevel = $state(0);
	let totalCapped = $state(false);
	const totalA = new Tween(0, { duration: 0, easing: backOut });

	const winText = $derived(winLevelMap[(totalWinLevel || 1) as WinLevel]?.text ?? null);

	// =========================================================================================
	// EXPANDED: layout
	// =========================================================================================
	// the same post thickness (in cells) as the base frame: the expanded boards' timber must read as
	// the same border, not a thinner one (owner, 2026-09-19: "the border is inconsistent")
	const POST = $derived(sl.post);
	const MARGIN = $derived(sl.innerMargin);

	/** the band the boards may use, in SCREEN px: under the top edge, above the HUD and the ante chip */
	const band = $derived.by(() => {
		const cw = sl.canvas.width;
		const ch = sl.canvas.height;
		const mini = ch < 320;
		let bottom = sl.hudTop - (mini ? 2 : 6);
		if (!mini && typeof document !== 'undefined') {
			const chip = document.querySelector<HTMLElement>('.ante-chip');
			if (chip) {
				const r = chip.getBoundingClientRect();
				const shown = r.width > 0 && r.height > 0 && getComputedStyle(chip).visibility !== 'hidden';
				if (shown && r.top < sl.hudTop && r.top > ch * 0.4) bottom = Math.min(bottom, r.top - 8);
			}
		}
		const top = Math.max(3, ch * 0.012);
		const side = Math.max(3, cw * 0.008);
		return { x: side, y: top, w: cw - 2 * side, h: Math.max(40, bottom - top) };
	});
	const headerH = $derived(Math.max(20, Math.min(66, sl.canvas.height * 0.08)));
	const layoutFor = (count: number): ExpandLayout => expandLayout(count, band, POST, MARGIN, headerH);
	// the grid is chosen for the BOOKED count as soon as the site opens (2 -> a row, 3/4 -> the 2x2),
	// so boxes never re-flow as boards arrive; only the solo opening board is laid out alone
	const gridCount = $derived(stateBuild.layoutCount <= 1 ? 1 : Math.max(2, stateBuild.boardCount));
	const layoutNow = $derived(layoutFor(gridCount));
	const box = $derived(boardBox(POST, MARGIN));

	// ---- live nodes + rigs --------------------------------------------------------------------
	const N: Record<string, any> = {};
	// grabbed nodes are driven from the ticker: they carry NO reactive props (pixi-svelte
	// re-applies every prop when one changes, which would fight the ticker)
	const grab = (k: string, hidden = false) => (node: any) => {
		N[k] = node;
		if (hidden) node.visible = false;
		// Pixi 8 nulls `position` / `scale` on destroy: a beat that still holds this reference
		// after the block re-mounted would throw `null.set` from a tween. Drop it with the node.
		node.once?.('destroyed', () => {
			if (N[k] === node) delete N[k];
		});
	};
	type Rig = { x: number; y: number; s: number; ox: number; oy: number; sx: number; sy: number; rot: number; alpha: number; on: boolean };
	const rigs: Rig[] = [0, 1, 2, 3].map(() => ({ x: 0, y: 0, s: 1, ox: 0, oy: 0, sx: 1, sy: 1, rot: 0, alpha: 1, on: false }));
	// dev-only QA seam: the rigs and grabbed nodes, for probes (statically false in a production build)
	if (import.meta.env.DEV && typeof window !== 'undefined') (window as any).__pwRigs = { rigs, N };
	const POLES = [0, 1, 2, 3, 4];
	const poleX = [0, 0, 0, 0, 0];
	const poleA = [0, 0, 0, 0, 0];
	const rail = { x0: 0, x1: 0, y: 0, a: 0 };
	let zoom = 1;
	let animating = false;
	/** which layout slot each board stands in. With the preferred grids (2 in a row, 2+1,
	 *  2x2) every board keeps its slot and only the newcomer's is new. Where a viewport
	 *  picks a row for 3 and a 2x2 for 4, the boards already standing re-flow along the
	 *  SHORTEST paths (none crosses another) and the newcomer takes the slot left over,
	 *  entering from that slot's side. Boards are all identical while they re-flow (no
	 *  house has been placed on a board that is still to move), so nothing is mislaid. */
	let slotOf = [0, 1, 2, 3];
	const assignSlots = (count: number, to: ExpandLayout) => {
		const old = count - 1;
		let best: number[] | null = null;
		let bestCost = Infinity;
		const used = [false, false, false, false];
		const pick: number[] = [];
		const walk = (i: number, cost: number) => {
			if (cost >= bestCost) return;
			if (i === old) {
				bestCost = cost;
				best = [...pick];
				return;
			}
			for (let sIdx = 0; sIdx < count; sIdx += 1) {
				if (used[sIdx]) continue;
				used[sIdx] = true;
				pick[i] = sIdx;
				const dx = to.slots[sIdx].x - rigs[i].x;
				const dy = to.slots[sIdx].y - rigs[i].y;
				// shortest paths first; on a near-tie a board keeps its reading-order slot
				const keep = (sIdx - i) * to.cell * 4.5;
				walk(i + 1, cost + dx * dx + dy * dy + keep * keep);
				used[sIdx] = false;
			}
		};
		walk(0, 0);
		const out = [0, 1, 2, 3];
		const b = (best ?? []) as number[];
		const taken = new Set<number>(b);
		for (let i = 0; i < old; i += 1) out[i] = b[i] ?? i;
		for (let sIdx = 0; sIdx < count; sIdx += 1) if (!taken.has(sIdx)) out[old] = sIdx;
		return out;
	};
	let countShown = $state(0);
	let countFinal = $state(false);

	const ZOOM = [1.16, 1.16, 1.08, 1.035, 1.0]; // backdrop zoom per layout count: the camera pulls BACK

	// ---- LOCKED boxes (owner ruling 2026-09-19) ---------------------------------------------------
	// The opened site is always four boxes (expandLayout EXPANDED_BOXES). A box whose board the book
	// did not unlock wears the LOCKED hoarding for the whole round; the box a board is about to
	// arrive in wears it too, and the hoarding drops away as that board is craned in.
	const LOCKS = [0, 1, 2, 3];
	const LOCK_W = 1000; // the hoarding sprite is drawn LOCK_W units wide
	const lockA = [0, 0, 0, 0];
	let arriving = -1; // the box whose board is on its way (still locked until boardIn)
	const lockTex = $derived(sceneTex('build_lock_panel'));
	const lockAspect = $derived(lockTex ? lockTex.height / Math.max(1, lockTex.width) : 0.7);
	// hoardings exist only on the 2x2 (a booked 3 or 4): the box still to fill, and the box that stays shut
	const lockedBox = (i: number) => stateBuild.boardCount >= 3 && stateBuild.layoutCount >= 2 && (i >= stateBuild.layoutCount || i === arriving);
	/** place every hoarding on the CURRENT layout; `fade` sets the alpha of the locked ones */
	const applyLocks = (fade?: number) => {
		const lay = layoutNow;
		for (const i of LOCKS) {
			const n = N[`lock${i}`];
			if (!n) continue;
			const on = lockedBox(i) && i < lay.slots.length;
			if (!on) {
				lockA[i] = 0;
				n.visible = false;
				continue;
			}
			if (fade !== undefined) lockA[i] = fade;
			else if (lockA[i] <= 0.01) lockA[i] = 1;
			const slot = lay.slots[i];
			const cell = slot.cell;
			n.visible = lockA[i] > 0.01;
			n.position.set(slot.x + 2.5 * cell, slot.y + 1.5 * cell);
			n.scale.set((box.w * cell * 0.9) / LOCK_W);
			n.rotation = 0;
			n.alpha = lockA[i];
		}
	};
	/** the hoarding on box `i` swells, tears loose and drops away — the board lands behind it */
	const lockAway = async (i: number) => {
		const n = N[`lock${i}`];
		arriving = -1;
		if (!n || !n.visible || lockA[i] <= 0.01) return;
		audioDirector.boardUnlock?.();
		if (prefersReducedMotion()) {
			lockA[i] = 0;
			n.visible = false;
			return;
		}
		const cell = rigs[i].s * S;
		const y0 = n.position.y;
		const s0 = n.scale.x;
		await tween(dur(460), (_p, raw) => {
			const m = N[`lock${i}`];
			if (!m) return;
			const swell = raw < 0.3 ? 1 + 0.08 * Math.sin((raw / 0.3) * Math.PI) : 1;
			const drop = raw < 0.3 ? 0 : ease.cubicIn((raw - 0.3) / 0.7);
			m.scale.set(s0 * swell * (1 - 0.1 * drop));
			m.position.y = y0 + drop * cell * 1.2;
			m.rotation = -0.08 * drop;
			m.alpha = 1 - drop;
		}, ease.linear);
		lockA[i] = 0;
		n.visible = false;
		n.rotation = 0;
	};

	const applyRig = (i: number) => {
		const r = rigs[i];
		const n = N[`rig${i}`];
		if (!n) return;
		n.visible = r.on && r.alpha > 0.001;
		n.position.set(r.x + (W / 2) * r.s + r.ox, r.y + r.oy + H * r.s * (1 - r.sy));
		n.scale.set(r.s * r.sx, r.s * r.sy);
		n.rotation = r.rot;
		n.alpha = r.alpha;
	};

	const applyScaffold = () => {
		return; // owner ruling 2026-09-19: no gantry in the expanded scene (markup removed)
		const bottom = band.y + band.h;
		for (const i of POLES) {
			const n = N[`pole${i}`];
			if (!n) continue;
			n.visible = poleA[i] > 0.01;
			n.alpha = poleA[i];
			n.position.set(poleX[i], rail.y);
			n.scale.set(Math.max(4, layoutNow.cell * 0.13), Math.max(1, bottom - rail.y) / 100);
		}
		if (N.rail) {
			N.rail.visible = rail.a > 0.01;
			N.rail.alpha = rail.a;
			N.rail.position.set(rail.x0, rail.y);
			N.rail.scale.set(Math.max(1, rail.x1 - rail.x0) / 100, Math.max(5, layoutNow.cell * 0.16) / 10);
		}
	};

	const applyZoom = () => {
		if (N.bg) N.bg.scale.set(zoom);
	};

	/** where the scaffold stands for a layout: outer posts + one in every column gap */
	const scaffoldFor = (lay: ExpandLayout) => {
		const xs: number[] = [];
		const firstRow = lay.slots.slice(0, lay.cols);
		const left = firstRow[0].x - box.left * lay.cell;
		const right = firstRow[firstRow.length - 1].x + (5 + box.left) * lay.cell;
		xs.push(left + lay.cell * 0.02);
		for (let c = 1; c < firstRow.length; c += 1) xs.push((firstRow[c - 1].x + 5 * lay.cell + firstRow[c].x) / 2);
		xs.push(right - lay.cell * 0.02);
		return { xs, y: lay.slots[0].y - box.top * lay.cell + lay.cell * 0.04, x0: left - lay.cell * 0.1, x1: right + lay.cell * 0.1 };
	};

	/** everything at rest on the CURRENT layout (mount, resize, skip, resume) */
	const snapAll = () => {
		const lay = layoutNow;
		if (stateBuild.layoutCount <= 1) slotOf = [0, 1, 2, 3];
		for (let i = 0; i < 4; i += 1) {
			const r = rigs[i];
			if (slotOf[i] >= lay.slots.length && i < lay.slots.length) slotOf = [0, 1, 2, 3];
			const slot = lay.slots[Math.min(slotOf[i], lay.slots.length - 1)];
			r.x = slot.x;
			r.y = slot.y;
			r.s = slot.cell / S;
			r.ox = 0;
			r.oy = 0;
			r.sx = 1;
			r.sy = 1;
			r.rot = 0;
			r.alpha = 1;
			r.on = i < lay.slots.length && stateBuild.boards[i]?.status !== 'hidden' && !!stateBuild.boards[i];
			applyRig(i);
		}
		const sc = scaffoldFor(lay);
		const open = stateBuild.layoutCount > 1;
		for (const i of POLES) {
			poleX[i] = sc.xs[Math.min(i, sc.xs.length - 1)];
			poleA[i] = open && i < sc.xs.length ? 1 : 0;
		}
		rail.x0 = sc.x0;
		rail.x1 = sc.x1;
		rail.y = sc.y;
		rail.a = open ? 1 : 0;
		applyScaffold();
		zoom = ZOOM[Math.min(4, stateBuild.layoutCount)];
		applyZoom();
		arriving = -1;
		applyLocks(1);
		if (N.cable) N.cable.visible = false;
		if (N.dust) N.dust.visible = false;
		if (N.bolts) N.bolts.visible = false;
	};

	$effect(() => {
		// re-rest on resize / mount; a running reveal reads the live layout itself
		void layoutNow;
		void stateBuild.boards.length;
		if (expanded && stateScene.staged && !animating) queueMicrotask(snapAll);
	});

	// ---- pooled dust + bolts ----------------------------------------------------------------------
	const PUFFS = Array.from({ length: 16 }, (_, i) => i);
	const puff = PUFFS.map((i) => ({ x: 0, y: 0, vx: 0, vy: 0, r: 1, k: ((i * 37) % 16) / 16, j: ((i * 11) % 16) / 16 }));
	const dustBurst = (cx: number, y: number, width: number, cell: number, power = 1) => {
		const d = N.dust;
		if (!d || prefersReducedMotion()) return;
		d.visible = true;
		d.position.set(cx, y);
		for (const i of PUFFS) {
			const side = i % 2 === 0 ? -1 : 1;
			// clumps kicked out sideways from under the footing: big slow ones low, small fast ones high
			puff[i].x = side * width * (0.04 + 0.46 * puff[i].k);
			puff[i].y = cell * (0.16 * puff[i].j - 0.05);
			puff[i].vx = side * cell * (0.35 + puff[i].k * 1.3 + puff[i].j * 0.5) * power;
			puff[i].vy = -cell * (0.1 + (1 - puff[i].j) * 0.95) * power;
			puff[i].r = cell * (0.08 + puff[i].j * 0.3);
		}
		void tween(dur(760), (p) => {
			const kids = d.children;
			for (const i of PUFFS) {
				const g = kids[i];
				if (!g) continue;
				g.position.set(puff[i].x + puff[i].vx * p, puff[i].y + puff[i].vy * p * (1.7 - p));
				g.scale.set(puff[i].r * (0.5 + p * 1.2));
				g.alpha = (0.35 + 0.4 * puff[i].j) * (1 - p) * (1 - p);
			}
		}, ease.cubicOut).then(() => {
			d.visible = false;
		});
	};

	const BOLTS = [0, 1, 2, 3];
	const boltDown = async (i: number) => {
		const b = N.bolts;
		const r = rigs[i];
		const cell = r.s * S;
		if (!b || prefersReducedMotion()) {
			audioDirector.boardUnlock?.();
			return;
		}
		b.visible = true;
		const m = (MARGIN + POST * 0.7) * cell;
		const corners = [
			[r.x - m, r.y - m],
			[r.x + 5 * cell + m, r.y - m],
			[r.x - m, r.y + 3 * cell + m],
			[r.x + 5 * cell + m, r.y + 3 * cell + m],
		];
		for (const k of BOLTS) {
			const g = b.children[k];
			if (!g) continue;
			g.position.set(corners[k][0], corners[k][1]);
			g.alpha = 0;
		}
		audioDirector.boardUnlock?.();
		// four bolts driven home in a quick run; the board takes each hit
		await Promise.all(
			BOLTS.map(async (k) => {
				await waitForTimeout(dur(85) * k);
				const g = b.children[k];
				if (!g) return;
				await tween(dur(360), (p, raw) => {
					g.alpha = raw < 0.25 ? raw * 4 : 1 - (raw - 0.25) / 0.75;
					g.scale.set(cell * (0.1 + 0.34 * p));
					g.rotation = p * 1.2;
					r.oy = cell * 0.018 * springDecay(raw, 1.5, 5);
					applyRig(i);
				}, ease.cubicOut);
			}),
		);
		r.oy = 0;
		applyRig(i);
		b.visible = false;
	};

	const landImpact = (i: number, power = 1) => {
		const r = rigs[i];
		const cell = r.s * S;
		audioDirector.boardLand?.();
		dustBurst(r.x + 2.5 * cell, r.y + (3 + box.bottom * 0.55) * cell, box.w * cell, cell, power);
		// follow-through: the board squashes onto its footing and springs back; the
		// boards already standing feel the hit
		return tween(dur(520), (_p, raw) => {
			const w = springDecay(raw, 2, 4.5);
			r.sy = 1 - 0.05 * power * w;
			r.sx = 1 + 0.022 * power * w;
			applyRig(i);
			for (let j = 0; j < 4; j += 1) {
				if (j === i || !rigs[j].on) continue;
				rigs[j].oy = cell * 0.02 * power * w;
				applyRig(j);
			}
		}, ease.linear).then(() => {
			for (let j = 0; j < 4; j += 1) {
				rigs[j].oy = 0;
				rigs[j].sx = 1;
				rigs[j].sy = 1;
				applyRig(j);
			}
		});
	};

	/** the hoist's bamboo beam sits on the board's TOP edge — wherever that edge is now
	 *  (a hinged board's top edge climbs as the wall comes up) */
	const cableTo = (i: number) => {
		const c = N.cable;
		const r = rigs[i];
		if (!c) return;
		const cell = r.s * S;
		c.visible = true;
		c.position.set(r.x + 2.5 * cell + r.ox, r.y + r.oy + H * r.s * (1 - r.sy) - (MARGIN + POST * 1.1) * cell * r.sy);
		c.scale.set(cell / 100);
		c.rotation = r.rot * 0.6;
	};

	/** the red ropes let go and the beam runs back up out of frame */
	const cablesAway = async () => {
		const c = N.cable;
		if (!c || !c.visible) return;
		const y0 = c.position.y;
		await tween(dur(420), (p) => {
			c.position.y = y0 - p * (y0 + sl.canvas.height * 0.2);
			c.alpha = 1 - p * 0.6;
		}, ease.cubicIn);
		c.visible = false;
		c.alpha = 1;
	};

	// the hoist art (units: 100 = one cell; y = 0 is the board's top edge). Two red ropes run down out of
	// the sky and wrap a golden bamboo beam that rides just above the board, where the old rig's bar rode
	// (-24..-14): the band between a board's top edge and the board above it in a stacked column is only
	// ~30 units tall (desktop 2x2) / ~37 (phone column), so everything the hoist shows below its ropes -- beam,
	// knotted drops, tassels -- fits in -26..-2 and reads in that gap as well as on open sky. From the beam a
	// short knotted red rope drops to the board at each rope; a small red silk tassel on a gold bead hangs
	// under each end of the beam and stops above the board's top timber (~-1.5).
	const ROPE = { red: 0xc0141f, dark: 0x6a0810, lite: 0xf0515a };
	const BAMBOO = { body: 0xd9a31e, lite: 0xffe27a, shade: 0xa5700c, node: 0x7a4c08, cut: 0xf4d68c, line: 0x3b2405 };
	const BEAM_Y = -25; // top of the beam
	const BEAM_T = 11; // beam thickness
	const drawHoist: import('svelte').ComponentProps<typeof Graphics>['draw'] = (g) => {
		const rope = (x: number, y0: number, y1: number) => {
			g.rect(x - 3.5, y0, 7, y1 - y0).fill({ color: ROPE.red });
			g.rect(x + 1.2, y0, 2.3, y1 - y0).fill({ color: ROPE.dark, alpha: 0.55 });
			g.rect(x - 2.6, y0, 1.3, y1 - y0).fill({ color: ROPE.lite, alpha: 0.7 });
			// the lay of the twist: short dark diagonals down the rope
			for (let y = y1 - 10; y > y0; y -= 11) g.poly([x - 3.5, y + 4, x + 3.5, y - 1.5, x + 3.5, y + 0.5, x - 3.5, y + 6]).fill({ color: ROPE.dark, alpha: 0.5 });
		};
		const knot = (x: number, y: number, r: number) => {
			g.ellipse(x, y, r * 1.15, r).fill({ color: ROPE.red }).stroke({ width: 1.4, color: ROPE.dark });
			g.ellipse(x - r * 0.35, y - r * 0.35, r * 0.35, r * 0.25).fill({ color: ROPE.lite, alpha: 0.8 });
		};
		const top = BEAM_Y;
		const bot = BEAM_Y + BEAM_T;
		for (const sx of [-1, 1]) {
			const x = sx * 170;
			rope(x, -4000, top);
			rope(x, bot, -2);
		}
		// the bamboo beam: rounded pole, lit top, shaded belly, a joint every 75, cut faces at the ends
		g.roundRect(-212, top, 424, BEAM_T, 5).fill({ color: BAMBOO.body }).stroke({ width: 2.2, color: BAMBOO.line });
		g.roundRect(-206, top + 1.8, 412, 3, 1.5).fill({ color: BAMBOO.lite, alpha: 0.9 });
		g.rect(-206, top + 7.8, 412, 1.6).fill({ color: BAMBOO.shade, alpha: 0.6 });
		for (const nx of [-150, -75, 0, 75, 150]) {
			g.rect(nx - 2, top + 1, 4, BEAM_T - 2).fill({ color: BAMBOO.node });
			g.rect(nx + 2, top + 1, 1.5, BEAM_T - 2).fill({ color: BAMBOO.lite, alpha: 0.75 });
		}
		for (const sx of [-1, 1]) {
			g.ellipse(sx * 211, top + BEAM_T / 2, 3, BEAM_T / 2).fill({ color: BAMBOO.cut }).stroke({ width: 1.4, color: BAMBOO.line });
			// the rope's wrap around the beam (two turns), then a knot on the drop to the board
			const x = sx * 170;
			for (const dx of [-4.5, 4.5]) g.poly([x + dx - 3, top - 1, x + dx + 3, top - 1, x + dx + 1.5, bot + 1, x + dx - 4.5, bot + 1]).fill({ color: ROPE.red }).stroke({ width: 1.1, color: ROPE.dark });
			knot(x, bot + 4.5, 4);
			// small silk tassel under the beam end: cord, gold bead, red fringe (ends at -2.5)
			const tx = sx * 199;
			g.rect(tx - 0.9, bot - 1, 1.8, 2.5).fill({ color: ROPE.red });
			g.poly([tx - 3.2, bot + 6.6, tx + 3.2, bot + 6.6, tx + 5.8, -2.5, tx - 5.8, -2.5]).fill({ color: ROPE.red }).stroke({ width: 0.9, color: ROPE.dark });
			for (const fx of [-2, 0, 2]) g.rect(tx + fx * 1.3 - 0.35, bot + 8.2, 0.7, 2.8).fill({ color: ROPE.dark, alpha: 0.55 });
			g.circle(tx, bot + 4.4, 3.4).fill({ color: 0xffc94a }).stroke({ width: 0.9, color: BAMBOO.line });
		}
	};

	// ---- the beats the expand director calls ------------------------------------------------------
	const pullBack = async (count: number) => {
		animating = true;
		arriving = count - 1;
		const to = layoutFor(Math.max(count, stateBuild.boardCount));
		// READING ORDER, always: board i stands in box i (top-left, top-right, bottom-left, bottom-right).
		// The book awards the doors board by board (0, 1, 2, 3), so the eye follows left -> right on
		// both rows — never left -> right then right -> left (owner ruling 2026-09-19). The 2x2 grid is
		// fixed from the second board on, so no board ever needs to re-flow (assignSlots is retired).
		slotOf = [0, 1, 2, 3];
		void assignSlots;
		const from = rigs.map((r) => ({ x: r.x, y: r.y, s: r.s }));
		const z0 = zoom;
		const z1 = ZOOM[Math.min(4, count)];
		const sc = scaffoldFor(to);
		const p0 = [...poleX];
		const a0 = [...poleA];
		const r0 = { ...rail };
		// the scaffold starts tucked behind the boards already standing and slides apart
		const firstOpen = rail.a < 0.01;
		if (firstOpen) {
			const solo = rigs[0];
			const cx = solo.x + 2.5 * solo.s * S;
			for (const i of POLES) p0[i] = cx + (i % 2 === 0 ? -1 : 1) * 2.2 * solo.s * S;
			r0.x0 = cx - 2.4 * solo.s * S;
			r0.x1 = cx + 2.4 * solo.s * S;
			r0.y = solo.y - box.top * solo.s * S;
		} else {
			// posts that did not exist yet grow out of the nearest standing post
			for (const i of POLES) if (a0[i] < 0.01) p0[i] = p0[Math.max(0, i - 1)];
		}
		const reduced = prefersReducedMotion();
		const ms = reduced ? 160 : dur(1150);
		// the standing boards leave one after another (a short stagger), so the eye follows
		// them in turn instead of watching every board jump at once
		const stagger = reduced ? 0 : 0.08;
		const span = 1 - stagger * Math.max(0, count - 2);
		const boardEase = reduced ? ease.cubicOut : ease.anticipate;
		{
			// the incoming board's slot, stated up front: boardIn() may start before this tween ends
			const slot = to.slots[slotOf[count - 1]];
			const r = rigs[count - 1];
			r.x = slot.x;
			r.y = slot.y;
			r.s = slot.cell / S;
		}
		await tween(ms, (p, raw) => {
			for (let i = 0; i < count - 1; i += 1) {
				const slot = to.slots[slotOf[i]];
				const r = rigs[i];
				const q = boardEase(Math.max(0, Math.min(1, (raw - stagger * i) / span)));
				r.x = lerp(from[i].x, slot.x, q);
				r.y = lerp(from[i].y, slot.y, q);
				r.s = lerp(from[i].s, slot.cell / S, q);
				applyRig(i);
			}
			zoom = lerp(z0, z1, p);
			applyZoom();
			// secondary action: the scaffold trails the camera by a few frames
			const q = ease.cubicOut(Math.max(0, Math.min(1, (raw - 0.12) / 0.88)));
			for (const i of POLES) {
				const target = sc.xs[Math.min(i, sc.xs.length - 1)];
				poleX[i] = lerp(p0[i], target, q);
				poleA[i] = lerp(a0[i], i < sc.xs.length ? 1 : 0, q);
			}
			rail.x0 = lerp(r0.x0, sc.x0, q);
			rail.x1 = lerp(r0.x1, sc.x1, q);
			rail.y = lerp(r0.y, sc.y, q);
			rail.a = lerp(r0.a, 1, Math.min(1, q * 2.5));
			applyScaffold();
			applyLocks(Math.min(1, q * 2.5));
		}, reduced ? ease.cubicOut : ease.anticipate);
		// the incoming board's slot is ready (still unseen). Under a heavy load the director's 4 s
		// bound on this beat can expire while the tween is still running, and boardIn() has then
		// ALREADY switched the board on — so the slot is only re-stated here, and the board is
		// hidden only while the director still lists it as hidden (seen: a 2-board round whose
		// second board stayed invisible for the whole round, 2026-09-19).
		const slot = to.slots[slotOf[count - 1]];
		const r = rigs[count - 1];
		if (!r.on) {
			r.x = slot.x;
			r.y = slot.y;
			r.s = slot.cell / S;
		}
		if (stateBuild.boards[count - 1]?.status === 'hidden') r.on = false;
		applyRig(count - 1);
	};

	const boardIn = async (i: number) => {
		const r = rigs[i];
		animating = true;
		const cell = r.s * S;
		const cw = sl.canvas.width;
		await lockAway(i);
		r.on = true;
		// THE HEADER NEVER TRAILS THE SITE (review 2026-09-20, seats A and B: a still frame read "2 SITES" over three
		// boards). The number used to move only in `countBeat`, which runs AFTER this board has bolted down, so for the
		// whole arrival the header was one short of what was on screen. It now steps the moment the board appears;
		// `countBeat` still plays the stamp on the same number, and only the final one turns it to "N SITES OPEN".
		if (i + 1 > countShown) {
			countShown = i + 1;
			countFinal = false;
		}
		r.ox = 0;
		r.oy = 0;
		r.sx = 1;
		r.sy = 1;
		r.rot = 0;
		if (prefersReducedMotion()) {
			await tween(220, (p) => {
				r.alpha = p;
				applyRig(i);
			}, ease.cubicOut);
			audioDirector.boardUnlock?.();
		} else if (i === 2) {
			// TILT-UP WALL: the board lies flat on the ground, the crane takes its top edge
			// and pulls it upright. Seen from the front a wall at angle a stands sin(a) tall,
			// so the rise is fast off the ground and slows to plumb (a hinge, not a stretch);
			// its face reads a touch wider while it lies flat. Scrape, rise, rock, thud.
			r.alpha = 0;
			r.sy = 0.03;
			applyRig(i);
			cableTo(i);
			dustBurst(r.x + 2.5 * cell, r.y + (3 + box.bottom * 0.55) * cell, box.w * cell, cell, 0.6);
			await tween(dur(1120), (p, raw) => {
				const a = (0.05 + 0.95 * p) * (Math.PI / 2);
				r.alpha = Math.min(1, raw * 6);
				r.sy = Math.max(0.03, Math.sin(a));
				r.sx = 1 + 0.045 * (1 - Math.min(1, p));
				applyRig(i);
				cableTo(i);
			}, ease.hinge);
			r.sx = 1;
			r.sy = 1;
			applyRig(i);
			cableTo(i);
			await landImpact(i, 0.75);
			await boltDown(i);
			await cablesAway();
		} else {
			// CRANED IN on two cables: board 2 straight down, board 4 swung in from the side
			// of the site its slot is on
			const swing = i === 3;
			const fromY = -(r.y + box.h * cell + 40);
			const side = r.x + 2.5 * cell > cw / 2 ? 1 : -1;
			const fromX = swing ? side * cw * 0.3 : 0;
			r.alpha = 1;
			let hit = false;
			let settle: Promise<void> | null = null;
			await tween(dur(swing ? 1150 : 980), (p, raw) => {
				// the load sways on its cables and the sway dies as it nears the ground
				r.oy = fromY * (1 - Math.min(1, p));
				r.ox = fromX * (1 - ease.cubicOut(Math.min(1, raw / 0.7)));
				r.rot = (swing ? 0.065 : 0.035) * Math.sin(raw * Math.PI * (swing ? 2.4 : 2.2)) * (1 - raw) * (1 - raw);
				if (!hit && raw >= 0.62) {
					hit = true;
					settle = landImpact(i, 1);
				}
				applyRig(i);
				cableTo(i);
			}, ease.drop);
			r.oy = 0;
			r.ox = 0;
			r.rot = 0;
			applyRig(i);
			if (settle) await settle;
			await boltDown(i);
			await cablesAway();
		}
		r.alpha = 1;
		applyRig(i);
	};

	const countBeat = async (count: number, final: boolean) => {
		countShown = count;
		countFinal = false;
		ensureSignFont();
		// the node is read LIVE each frame: the header can re-mount under a running beat
		const n = () => N.count;
		if (n() && !prefersReducedMotion()) {
			await tween(dur(300), (p) => n()?.scale.set(0.6 + 0.4 * p), ease.backOut);
			// the held breath: the SAME three pulses after every board, whatever follows
			await tween(dur(760), (_p, raw) => n()?.scale.set(1 + 0.07 * Math.abs(Math.sin(raw * Math.PI * 3)) * (1 - raw * 0.3)), ease.linear);
			n()?.scale.set(1);
		} else {
			await waitForTimeout(hold(500));
		}
		if (!final) return;
		countFinal = true;
		animating = false;
		if (n() && !prefersReducedMotion()) {
			if (N.countGlow) N.countGlow.visible = true;
			await tween(dur(460), (p, raw) => {
				n()?.scale.set(1.32 - 0.32 * p);
				if (N.countGlow) N.countGlow.alpha = 1 - raw;
			}, ease.backOut);
			if (N.countGlow) N.countGlow.visible = false;
		}
	};

	// ---- shared round meter -------------------------------------------------------------------------
	const roundSum = $derived(stateBuild.boards.reduce((n, b) => n + (b.totalDisplay || 0), 0));
	const roundTarget = $derived(stateBuild.phase === 'total' || stateBuild.phase === 'outro' ? stateBuild.roundTotal : roundSum);
	const roundLabel = $derived(stateBuild.phase === 'total' || stateBuild.phase === 'outro' ? 'TOTAL' : 'FEATURE TOTAL');
	// DRAWN capped (r6): an expanded round's booked per-board totals (expandEnd.boards[].total) are the UNCAPPED
	// board sums, while the round itself is capped at 25,000x (wincap). The meter never draws more than the cap;
	// the booked figures, the plate and settlement are untouched (min() is applied to what is drawn only).
	const roundShown = new Tween(0, { duration: 0, easing: cubicOut });
	$effect(() => {
		const target = roundTarget;
		if (Math.abs(target - roundShown.target) < 0.5) return;
		void roundShown.set(target, { duration: prefersReducedMotion() ? 0 : dur(300) });
	});
	const meterIn = new Tween(0, { duration: 0, easing: cubicOut });
	$effect(() => {
		void meterIn.set(stateBuild.showRoundTotal ? 1 : 0, { duration: dur(420) });
	});
	/** The round is over: every door prize already flew into the ONE shared meter during the
	 *  doors (contract 7.7), so the end does not add anything to it — it seals what is there
	 *  with a single beat: the plaque swells, a light passes over it, and it settles. */
	const meterSeal = async () => {
		const m = N.meter;
		const glow = N.meterGlow;
		if (!m || prefersReducedMotion()) return;
		audioDirector.collect();
		if (glow) {
			glow.visible = true;
			glow.alpha = 0;
		}
		await tween(dur(640), (_p, raw) => {
			m.scale.set(1 + 0.16 * springDecay(raw, 1.4, 3.2));
			if (glow) glow.alpha = Math.sin(Math.min(1, raw * 1.6) * Math.PI);
		}, ease.linear);
		m.scale.set(1);
		if (glow) glow.visible = false;
	};

	context.eventEmitter.subscribeOnMount({
		buildTotalPresent: async ({ amount, winLevel, capped }) => {
			totalAmount = amount;
			totalWinLevel = winLevel;
			totalCapped = capped;
			showTotalPlate = true;
			ensureSignFont();
			totalA.set(0, { duration: 0 });
			await totalA.set(1, { duration: dur(500) });
		},
		buildTotalHide: () => {
			showTotalPlate = false;
		},
		// A skip / stop press fast-forwards the director's remaining beats.
		stopButtonClick: () => {
			if (!stateBuild.active) return;
			stateBuild.skip = true;
			finishAllTweens();
			// reels in flight come to rest at once (the director then applies the booked hats)
			for (let i = 0; i < stateBuild.boards.length; i += 1) getCellReels(i)?.clear();
		},
		expandPullBack: ({ count }) => pullBack(count),
		expandBoardIn: ({ board }) => boardIn(board),
		expandCount: ({ count, final }) => countBeat(count, final),
		expandTotalSeal: () => meterSeal(),
		expandSnap: () => {
			finishAllTweens();
			animating = false;
			countShown = stateBuild.boardCount;
			countFinal = true;
			slotOf = [0, 1, 2, 3];
			queueMicrotask(snapAll);
		},
	});

	// ---- backdrop -------------------------------------------------------------------------------------
	const orient = $derived(sl.canvas.height > sl.canvas.width ? 'portrait' : 'landscape');
	const plateTex = $derived(sceneTex(`amb_plate_${premium ? 'golden' : 'hold'}_${orient}`));
	const plateCover = $derived(plateTex ? Math.max(sl.canvas.width / plateTex.width, sl.canvas.height / plateTex.height) : 1);

	// ---- header sign ------------------------------------------------------------------------------------
	const hdr = $derived(layoutNow.header);
	const hdrW = $derived(Math.min(hdr.w * 0.96, hdr.h * 12));
	const titleText = $derived(expandedTitle(premium, stateBuild.prizeScale));
	// a narrow header (portrait, mini) cannot hold the name AND the count side by side:
	// every text is fitted to the plaque, and the count takes the plaque over once it exists
	const narrow = $derived(hdrW < hdr.h * 10.5);
	const fit = (text: string, size: number, avail: number) => Math.min(size, avail / Math.max(1, text.length * 0.66));
	const titleSize = $derived(fit(titleText, hdr.h * 0.42, narrow ? hdrW * 0.9 : hdrW * 0.56));
	const showTitle = $derived(!narrow || countShown < 2);
	const titleA = new Tween(1, { duration: 0, easing: cubicOut });
	$effect(() => {
		void titleA.set(showTitle ? 1 : 0, { duration: dur(260) });
	});
	const countText = $derived(countShown < 2 ? '' : countFinal ? `${districtsText(countShown)} OPEN` : districtsText(countShown));
	const label = (size: number, fill: number) => ({
		fontFamily: 'LuckySign, Inter, sans-serif',
		fontSize: size,
		fill,
		stroke: { color: SIGN.outline, width: size * 0.16, join: 'round' as const },
	});
</script>

{#if stateScene.staged && !expanded}
	<!-- ONE board, inside the base timber frame, exactly as before -->
	<MainContainer>
		<Container x={boardLayout().x} y={boardLayout().y} scale={boardLayout().scale} pivot={{ x: W / 2, y: H / 2 }}>
			<BuildBoard board={0} {premium} post={sl.post} innerMargin={sl.innerMargin} />
		</Container>
	</MainContainer>
{/if}

{#if stateScene.staged && expanded}
	<!-- THE WIDE SITE. Screen-px space; mounted behind the shutter, so the base frame
	     underneath is never seen in an expanded round. -->
	<Container>
		<Container x={sl.canvas.width / 2} y={sl.canvas.height / 2}>
			<Grab ongrab={grab('bg')} />
			{#if plateTex}
				<BaseSprite texture={plateTex} anchor={0.5} scale={plateCover} />
			{/if}
		</Container>
		<Graphics draw={(g) => g.rect(0, 0, sl.canvas.width, sl.canvas.height).fill({ color: premium ? 0x1c0f02 : 0x050f24, alpha: premium ? 0.42 : 0.5 })} />

		<!-- OWNER RULING 2026-09-19: the scaffold gantry (rail + posts beside the boards) is REMOVED from the
		     expanded scene. Do not re-add it; applyScaffold() below is a no-op kept so the pull-back maths
		     needs no rewrite. -->

		<!-- the hoist: a golden bamboo beam lowered on two knotted red ropes, silk tassels at the beam ends
		     (units: 100 = one cell; y = 0 is the board's top edge, same anchor the old rig used) -->
		<Container>
			<Grab ongrab={grab('cable', true)} />
			<Graphics draw={drawHoist} />
		</Container>

		{#each stateBuild.boards as b (b.index)}
			<Container pivot={{ x: W / 2, y: 0 }}>
				<Grab ongrab={grab(`rig${b.index}`, true)} />
				<BuildBoard board={b.index} {premium} compact post={POST} innerMargin={MARGIN} />
			</Container>
		{/each}

		<!-- LOCKED boxes: the hoarding over a box the book did not unlock (owner ruling 2026-09-19) -->
		{#each LOCKS as i (i)}
			<Container>
				<Grab ongrab={grab(`lock${i}`, true)} />
				{#if lockTex}
					<BaseSprite texture={lockTex} anchor={0.5} width={LOCK_W} height={LOCK_W * lockAspect} />
				{/if}
				<Container y={LOCK_W * lockAspect * 0.41}>
					<Graphics
						draw={(g) => {
							g.roundRect(-262, -66, 524, 132, 28).fill({ color: 0x1c1208, alpha: 0.92 });
							g.roundRect(-262, -66, 524, 132, 28).stroke({ width: 8, color: 0xffc400 });
						}}
					/>
					<Text anchor={0.5} text="LOCKED" style={{ fontFamily: 'LuckySign, Inter, sans-serif', fontSize: 92, fill: 0xfff1c4, letterSpacing: 6 }} />
				</Container>
			</Container>
		{/each}

		<!-- SITE PERMIT: the booked board count is drawn on the counter reel before the site opens -->
		<CountReel {band} {premium} />

		<!-- landing dust (pooled) -->
		<Container>
			<Grab ongrab={grab('dust', true)} />
			{#each PUFFS as i (i)}
				<Graphics
					alpha={0}
					draw={(g) => {
						// a soft three-lobe clump, no hard outline
						g.circle(0, 0, 1).fill({ color: premium ? 0xf1d9a6 : 0xd9d2c0, alpha: 0.85 });
						g.circle(0.62, 0.18, 0.66).fill({ color: premium ? 0xf1d9a6 : 0xd9d2c0, alpha: 0.85 });
						g.circle(-0.58, 0.24, 0.58).fill({ color: premium ? 0xe6c88c : 0xc4bca8, alpha: 0.85 });
					}}
				/>
			{/each}
		</Container>
		<!-- bolt-down flashes (pooled) -->
		<Container>
			<Grab ongrab={grab('bolts', true)} />
			{#each BOLTS as i (i)}
				<Graphics
					alpha={0}
					blendMode="add"
					draw={(g) => {
						g.poly([0, -1, 0.22, -0.22, 1, 0, 0.22, 0.22, 0, 1, -0.22, 0.22, -1, 0, -0.22, -0.22]).fill({ color: 0xfff3c4 });
						g.circle(0, 0, 0.34).fill({ color: 0xffffff });
					}}
				/>
			{/each}
		</Container>

		<!-- header: the feature's name + the booked site count, then the shared ROUND TOTAL -->
		<Container x={hdr.x} y={hdr.y}>
			<Graphics
				draw={(g) => {
					const w = hdrW;
					const h = hdr.h * 0.86;
					g.roundRect(-w / 2 + 2, -h / 2 + 3, w, h, h * 0.24).fill({ color: 0x000000, alpha: 0.35 });
					g.roundRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, h * 0.28).fill({ color: SIGN.outline });
					g.roundRect(-w / 2, -h / 2, w, h, h * 0.24).fill({ color: premium ? 0x8a5f28 : SIGN.wood });
					g.roundRect(-w / 2, -h / 2, w, h * 0.42, h * 0.24).fill({ color: 0xffffff, alpha: 0.07 });
					g.roundRect(-w / 2 + h * 0.09, -h / 2 + h * 0.09, w - h * 0.18, h - h * 0.18, h * 0.17).stroke({ width: h * 0.045, color: premium ? 0xffd34d : 0xd9a866, alpha: 0.75 });
				}}
			/>
			<!-- title + count (spins phase) -->
			<Container alpha={1 - meterIn.current} visible={meterIn.current < 0.99}>
				<Text anchor={{ x: narrow ? 0.5 : 0, y: 0.5 }} x={narrow ? 0 : -hdrW / 2 + hdr.h * 0.4} alpha={titleA.current} text={titleText} style={{ fontFamily: 'LuckySign, Inter, sans-serif', fontSize: titleSize, fill: 0xfff1c4, letterSpacing: 1 }} />
				<Container x={narrow ? 0 : hdrW / 2 - hdr.h * 2.3}>
					<Grab ongrab={grab('count')} />
					<Container>
						<Grab ongrab={grab('countGlow', true)} />
						<Graphics
							blendMode="add"
							draw={(g) => {
								for (let i = 0; i < 6; i += 1) g.ellipse(0, 0, hdr.h * (2.6 - i * 0.3), hdr.h * (0.7 - i * 0.08)).fill({ color: 0xffd34d, alpha: 0.09 });
							}}
						/>
					</Container>
					<Text anchor={0.5} text={countText} style={label(fit(`${districtsText(4)} OPEN`, hdr.h * 0.44, narrow ? hdrW * 0.8 : hdr.h * 4.2), countFinal ? 0xffe07a : 0xffffff)} />
				</Container>
			</Container>
			<!-- ROUND TOTAL (doors phase on) -->
			<Container alpha={meterIn.current} visible={meterIn.current > 0.01}>
				<Grab ongrab={grab('meter')} />
				<Container>
					<Grab ongrab={grab('meterGlow', true)} />
					<Graphics
						blendMode="add"
						draw={(g) => {
							for (let i = 0; i < 6; i += 1) g.ellipse(0, 0, hdr.h * (3.2 - i * 0.36), hdr.h * (0.8 - i * 0.09)).fill({ color: 0xffd34d, alpha: 0.1 });
						}}
					/>
				</Container>
				<Text anchor={{ x: 1, y: 0.5 }} x={-hdr.h * 0.2} text={roundLabel} style={{ fontFamily: 'LuckySign, Inter, sans-serif', fontSize: fit(roundLabel, hdr.h * 0.34, hdrW * (roundLabel === 'FEATURE TOTAL' ? 0.37 : 0.42)), fill: 0xf3d9a4, letterSpacing: 1 }} />
				{#if roundShown.current >= 0.5}
					<Text anchor={{ x: 0, y: 0.5 }} x={hdr.h * 0.2} text={formatBookMultiple(Math.min(roundShown.current, WIN_CAP_BOOKED))} style={label(fit('100000.00×', hdr.h * 0.56, hdrW * 0.44), 0xffe07a)} />
				{/if}
			</Container>
		</Container>
	</Container>
{/if}

{#if stateScene.staged}
	<!-- total-win celebration (scaled by winLevel). The dim is a deep site-night
	     blue over the LIVE scene — never a black void. -->
	{#if showTotalPlate}
		<CanvasSizeRectangle backgroundColor={premium ? 0x1a0f02 : 0x04131c} backgroundAlpha={0.5 * Math.max(0, Math.min(1, totalA.current))} />
		<MainContainer>
			<Container x={boardLayout().x} y={boardLayout().y} scale={Math.max(0.001, totalA.current) * boardLayout().scale} alpha={Math.max(0, Math.min(1, totalA.current * 1.5))}>
				<Graphics draw={(g) => drawSignPanel(g as any, { w: S * 5.4, h: S * 2.6, s: S, variant: 'win' })} />
				{#if winText || totalCapped}
					<Text anchor={0.5} y={-S * 0.7} text={totalCapped ? 'MAX WIN' : (winText ?? '')} style={{ ...signTitleStyle(S, { gold: true }), fontSize: S * 0.62 }} />
				{:else}
					<Text anchor={0.5} y={-S * 0.72} text="TOTAL WIN" style={{ ...signTitleStyle(S, { gold: true }), fontSize: S * 0.46 }} />
				{/if}
				<Text anchor={0.5} y={S * 0.28} text={formatBookMultiple(totalAmount)} style={signValueStyle(S, 0.98)} />
			</Container>
		</MainContainer>
	{/if}
{/if}
