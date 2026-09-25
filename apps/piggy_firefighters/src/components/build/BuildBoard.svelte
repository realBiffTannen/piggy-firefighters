<script lang="ts" module>
	export type EmitterEventBuildBoard =
		| { type: 'buildGrandOpening'; multiplier: number; board?: number }
		/** v2.3 street bonus: a completed row pays x`multiplier` */
		| { type: 'buildStreet'; row: number; multiplier: number; board?: number }
		/** the xN badge slams onto the total as the board total moves to the post-street figure */
		| { type: 'buildStreetBadge'; multiplier: number; board?: number };
</script>

<script lang="ts">
	// ONE BUILD BOARD — plots, cell reels, houses, hats, street sweep, spins banner,
	// status plaques, the board's own TOTAL sign, the +1 SPIN call-out, the Grand
	// Opening plate and (expanded rounds) the SITE COMPLETE rest state.
	//
	// It is drawn in board units with the grid's top-left at (0,0) and reads ONLY
	// `stateBuild.boards[board]`, so the same component is the single Hold & Build /
	// Golden Build board (board 0, framed by the base BoardFrame underneath) and each
	// of the 2-4 boards of an EXPANDED round (`compact`: it carries its own timber).
	// The parent owns position / scale / reveal motion.
	import { Tween } from 'svelte/motion';
	import { cubicOut, backOut } from 'svelte/easing';
	import { onMount } from 'svelte';

	import { Container, Graphics, Text } from 'pixi-svelte';
	import { waitForTimeout } from 'utils-shared/wait';

	import { SYMBOL_SIZE, BOARD_SIZES } from '../../game/constants';
	import { getContext } from '../../game/context';
	import { stateBuild, stateBuildDerived, BUILD_CELLS } from '../../game/build/stateBuild.svelte';
	import { dur, hold, prefersReducedMotion } from '../../game/build/buildTiming';
	import { drawSignPanel, signTitleStyle, signValueStyle, ensureSignFont, SIGN } from '../../game/build/signPanel';
	import { tween, ease, springDecay } from '../../game/build/motion';
	import { audioDirector } from '../../game/build/audioDirector';
	import { DISTRICT, MECHANIC } from '../../game/names';
	import { WIN_CAP_BOOKED } from '../../game/roundTier';
	import HouseView from './HouseView.svelte';
	import BuildCell from './BuildCell.svelte';
	import BuildEffects, { TOTAL_ANCHOR } from './BuildEffects.svelte';
	import CellReels from './CellReels.svelte';
	import BoardTimber from './BoardTimber.svelte';
	import Grab from '../scene/Grab.svelte';

	/* eslint-disable @typescript-eslint/no-explicit-any */
	type Props = {
		board?: number;
		premium?: boolean;
		/** expanded round: own timber, bigger banner, site tag, no side plaques */
		compact?: boolean;
		/** timber post thickness / inner margin, in cells */
		post: number;
		innerMargin: number;
	};
	const { board = 0, premium = false, compact = false, post, innerMargin }: Props = $props();

	const context = getContext();
	const S = SYMBOL_SIZE;
	const W = BOARD_SIZES.width;
	const H = BOARD_SIZES.height;

	const bs = $derived(stateBuild.boards[board]);
	const mine = (b?: number) => (b ?? 0) === board;

	const fmtMult = (bookUnits: number) => {
		const m = Math.round(bookUnits) / 100;
		return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(2)}×`;
	};
	// DRAWN capped (r6): a single board's booked running figures can pass the 25,000x cap before the book caps the
	// round (e.g. base 747462: streetBonus.boardTotal 2,549,000 lands before grandOpening's capped 2,500,000). The
	// TOTAL sign never draws more than the cap; bs.totalDisplay, the plate and settlement are untouched.
	const capDrawn = (bookUnits: number) => Math.min(bookUnits, WIN_CAP_BOOKED);

	// ---- spins banner: tick + glow whenever the booked figure changes --------------
	const bannerPop = new Tween(0, { duration: 0, easing: cubicOut });
	let lastTick = -1;
	$effect(() => {
		const tck = bs?.bannerTick ?? 0;
		if (tck === lastTick) return;
		lastTick = tck;
		if (prefersReducedMotion() || tck === 0) return;
		void bannerPop.set(1, { duration: 0 }).then(() => bannerPop.set(0, { duration: dur(520) }));
	});
	// "+1 SPIN" call-out, raised by the director on the flip's PEAK FRAME
	const extraA = new Tween(0, { duration: 0, easing: cubicOut });
	let lastExtra = 0;
	$effect(() => {
		const n = bs?.bannerExtra ?? 0;
		if (n === lastExtra) return;
		lastExtra = n;
		if (n === 0) return;
		void extraA.set(0, { duration: 0 }).then(() => extraA.set(1, { duration: prefersReducedMotion() ? 600 : dur(1150) }));
	});

	// ---- the running total: counts toward the booked figure as coins arrive ---------
	const totalShown = new Tween(0, { duration: 0, easing: cubicOut });
	const totalPop = new Tween(0, { duration: 0, easing: cubicOut });
	$effect(() => {
		const target = bs?.totalDisplay ?? 0;
		if (Math.abs(target - totalShown.target) < 0.5) return;
		void totalShown.set(target, { duration: prefersReducedMotion() ? 0 : dur(260) });
		if (!prefersReducedMotion() && target > 0) void totalPop.set(1, { duration: 0 }).then(() => totalPop.set(0, { duration: dur(300) }));
	});
	const totalIn = new Tween(0, { duration: 0, easing: backOut });
	$effect(() => {
		const on = !!bs?.showTotal;
		void totalIn.set(on ? 1 : 0, { duration: on ? dur(380) : dur(260) });
	});

	// ---- status: honest, derived from the shown board --------------------------------
	const built = $derived(stateBuildDerived.occupiedCount(board));
	const streets = $derived(stateBuildDerived.streetsComplete(board));
	const spinning = $derived(stateBuild.phase === 'spinning' && bs?.phase === 'spinning' && bs?.status === 'live');
	const lastSpin = $derived(spinning && (bs?.bannerSpins ?? 0) <= 1);
	const nearFull = $derived(spinning && (built === 13 || built === 14));
	const complete = $derived(bs?.status === 'complete');

	// LUCKY names (theme §5): the donor's GRAND OPENING is the GRAND FESTIVAL (a 15/15 board, x10); a board whose
	// spins have run out rests as a finished DISTRICT — never "GRAND FESTIVAL", which would claim the x10.
	const FESTIVAL = MECHANIC.festival.toUpperCase();
	const DONE = `${DISTRICT} COMPLETE`;
	const STREET = MECHANIC.street.toUpperCase();

	// the banner always says something TRUE about where this board is
	const bannerText = $derived(
		bs?.phase === 'doors'
			? 'DOORS OPEN'
			: bs?.phase === 'grandOpening'
				? FESTIVAL
				: complete || bs?.phase === 'done' || stateBuild.phase === 'total' || stateBuild.phase === 'outro'
					? DONE
					: lastSpin
						? 'LAST SPIN'
						: `${bs?.bannerSpins ?? 0} ${(bs?.bannerSpins ?? 0) === 1 ? 'SPIN' : 'SPINS'} LEFT`,
	);

	// a street that has JUST been completed gets a sweep of light along the row
	let streetSweep = $state.raw<{ id: number; row: number; t: Tween<number>; label: string }[]>([]);
	let sweepId = 0;
	const sweep = (row: number, label: string) => {
		const t = new Tween(0, { duration: 0, easing: cubicOut });
		const id = sweepId++;
		streetSweep = [...streetSweep, { id, row, t, label }];
		void t.set(1, { duration: prefersReducedMotion() ? 500 : dur(950) }).then(() => {
			streetSweep = streetSweep.filter((e) => e.id !== id);
		});
	};
	const seenStreet = [false, false, false];
	$effect(() => {
		for (let row = 0; row < 3; row += 1) {
			const full = stateBuildDerived.isStreetComplete(row, board);
			if (full && !seenStreet[row] && spinning) sweep(row, STREET);
			seenStreet[row] = full;
		}
	});

	// one slow breathing value for the near-full shimmer / last-spin glow (30 Hz is plenty)
	let breathe = $state(0);
	onMount(() => {
		if (prefersReducedMotion()) return;
		const id = setInterval(() => {
			if (document.hidden) return;
			if (nearFull || lastSpin) breathe = 0.5 + 0.5 * Math.sin(performance.now() / 260);
			else if (breathe !== 0) breathe = 0;
		}, 33);
		return () => clearInterval(id);
	});

	// ---- grand opening plate ------------------------------------------------------------
	let grandMult = $state(0);
	const grandA = new Tween(0, { duration: 0, easing: backOut });

	context.eventEmitter.subscribeOnMount({
		buildGrandOpening: async ({ multiplier, board: b }) => {
			if (!mine(b)) return;
			grandMult = multiplier;
			ensureSignFont();
			grandA.set(0, { duration: 0 });
			await grandA.set(1, { duration: dur(420) });
			await waitForTimeout(hold(900));
			await grandA.set(0, { duration: dur(300) });
		},
		// FULL STREET xN — the multiplier moment (owner, 2026-09-19). The director bumps the row's
		// prizes under this callout and moves the total afterwards, with the badge.
		buildStreet: async ({ row, multiplier, board: b }) => {
			if (!mine(b)) return;
			ensureSignFont();
			const t = new Tween(0, { duration: 0, easing: cubicOut });
			street = { row, mult: multiplier, t };
			await t.set(1, { duration: prefersReducedMotion() ? 600 : dur(1500) });
			street = null;
		},
		buildStreetBadge: async ({ multiplier, board: b }) => {
			if (!mine(b)) return;
			const t = new Tween(0, { duration: 0, easing: cubicOut });
			badge = { mult: multiplier, t };
			await t.set(1, { duration: prefersReducedMotion() ? 500 : dur(1100) });
			badge = null;
		},
	});
	let street = $state.raw<{ row: number; mult: number; t: Tween<number> } | null>(null);
	let badge = $state.raw<{ mult: number; t: Tween<number> } | null>(null);
	const fitSize = (text: string, size: number, avail: number) => Math.min(size, avail / Math.max(1, text.length * 0.62));

	// ---- SITE COMPLETE (expanded): stamp, then rest slightly dimmed ------------------------
	// Ticker-driven, straight onto the display objects.
	const N: Record<string, any> = {};
	const grab = (k: string) => (node: any) => {
		N[k] = node;
		node.once?.('destroyed', () => {
			if (N[k] === node) delete N[k];
		});
		if (k === 'stamp') node.visible = false;
		if (k === 'dim') node.alpha = 0;
	};
	let dimNow = 0;
	let dimRun = 0;
	const dimTo = (target: number, ms: number) => {
		const from = dimNow;
		const run = ++dimRun;
		void tween(prefersReducedMotion() ? 120 : dur(ms), (p) => {
			if (run !== dimRun) return;
			dimNow = from + (target - from) * p;
			if (N.dim) N.dim.alpha = dimNow;
		}, ease.cubicInOut);
	};
	// dimmed while it waits: finished among live boards, or waiting its turn at the doors
	const wantDim = $derived(
		compact && ((complete && stateBuild.phase === 'spinning') || (stateBuild.phase === 'doors' && bs?.phase === 'spinning')),
	);
	$effect(() => {
		dimTo(wantDim ? 1 : 0, wantDim ? 700 : 420);
	});

	// The badge is S*4.3 wide with an S*1.15*0.13 inner border each side: the words get the
	// rest, less a little air. Measured on the live Text (font loaded or not), then re-measured
	// once LuckySign has actually arrived, since the fallback face is narrower.
	const STAMP_TEXT_AVAIL = S * (4.3 - 2 * 1.15 * 0.13 - 0.3);
	const fitStampText = () => {
		const wrap = N.stampText;
		const text = wrap?.children?.[0];
		if (!wrap || !text) return;
		const apply = () => {
			wrap.scale.set(1);
			const w = Math.max(1, text.width);
			wrap.scale.set(Math.min(1, STAMP_TEXT_AVAIL / w));
		};
		apply();
		try {
			const fonts = (document as unknown as { fonts?: { load?: (f: string) => Promise<unknown> } }).fonts;
			void fonts?.load?.('400 120px LuckySign').then(apply);
		} catch {
			/* no fonts API: the first measurement stands */
		}
	};

	let lastComplete = 0;
	$effect(() => {
		const n = bs?.completeTick ?? 0;
		if (n === lastComplete) return;
		lastComplete = n;
		if (n === 0 || !N.stamp) return;
		ensureSignFont();
		const st = N.stamp;
		if (prefersReducedMotion() || stateBuild.skip) {
			st.visible = false;
			return;
		}
		st.visible = true;
		fitStampText();
		// swing in big, STAMP down with a settle wobble, hold, ease away. The swing-in starts
		// at 1.3x: the stamp is 4.3 cells wide, so anything larger would reach over the
		// neighbouring board on the tight 2-in-a-row / 2x2 layouts.
		void tween(dur(420), (p, raw) => {
			st.alpha = Math.min(1, raw * 4);
			st.scale.set(1.3 - 0.3 * p);
			st.rotation = -0.2 + 0.13 * p;
		}, ease.cubicIn)
			.then(() => {
				audioDirector.siteStamp?.(premium); // the impact: the stamp is DOWN
				return tween(dur(520), (_p, raw) => {
					const w = springDecay(raw, 2, 4);
					st.scale.set(1 + 0.09 * w);
					st.rotation = -0.07 + 0.03 * w;
					if (N.body) N.body.y = 0.035 * S * w;
				}, ease.linear);
			})
			.then(() => waitForTimeout(hold(620)))
			.then(() =>
				tween(dur(380), (p) => {
					st.alpha = 1 - p;
					st.scale.set(1 + 0.06 * p);
				}, ease.cubicIn),
			)
			.then(() => {
				st.visible = false;
			});
	});

	// ---- furniture geometry (board units) ----------------------------------------------
	const beamBottomY = $derived(H + (innerMargin + post * 0.45) * S);
	const bannerW = $derived(compact ? S * 3.3 : S * 2.7);
	const bannerH = $derived(compact ? S * 0.56 : S * 0.44);
	const bannerY = $derived(beamBottomY + bannerH * (compact ? 0.3 : 0.22));
	const plaqueW = S * 1.4;
	const plaqueH = S * 0.34;
	const rowScale = $derived(compact ? 1 : Math.min(1, ((BOARD_SIZES.width / S + 2 * (innerMargin + post * 1.33)) * S) / (bannerW + 2 * plaqueW + S * 0.34)));

	const hazard = (g: any, w: number, h: number, glow: number) => {
		const r = h * 0.2;
		// drop shadow + ink
		g.roundRect(-w / 2 + 3, -h / 2 + 5, w, h, r).fill({ color: 0x000000, alpha: 0.35 });
		g.roundRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, r + 3).fill({ color: SIGN.outline });
		g.roundRect(-w / 2, -h / 2, w, h, r).fill({ color: 0xffc400 });
		// diagonal stripes on the two end caps only, so the figure stays legible
		const cap = h * 1.05;
		for (const side of [-1, 1]) {
			const x0 = side < 0 ? -w / 2 : w / 2 - cap;
			for (let i = -1; i < 4; i += 1) {
				const x = x0 + i * (cap / 2.6);
				g.poly([x, h / 2, x + cap / 5.2, h / 2, x + cap / 5.2 + h * 0.55, -h / 2, x + h * 0.55, -h / 2]).fill({ color: 0x1c1208 });
			}
		}
		// face plate for the figure
		g.roundRect(-w / 2 + cap, -h / 2 + h * 0.1, w - cap * 2, h * 0.8, r * 0.7).fill({ color: 0x1c1208 });
		g.roundRect(-w / 2 + cap, -h / 2 + h * 0.1, w - cap * 2, h * 0.8, r * 0.7).stroke({ width: h * 0.045, color: 0xffe07a, alpha: 0.55 + glow * 0.45 });
		// re-ink the outline over the stripe ends
		g.roundRect(-w / 2, -h / 2, w, h, r).stroke({ width: h * 0.06, color: SIGN.outline });
		// hanging straps up to the beam
		for (const sx of [-1, 1]) g.rect(sx * w * 0.36 - h * 0.05, -h / 2 - h * 0.34, h * 0.1, h * 0.34).fill({ color: SIGN.outline });
	};

	const plaque = (g: any, w: number, h: number) => {
		g.roundRect(-w / 2 + 2, -h / 2 + 4, w, h, h * 0.22).fill({ color: 0x000000, alpha: 0.3 });
		g.roundRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, h * 0.26).fill({ color: SIGN.outline });
		g.roundRect(-w / 2, -h / 2, w, h, h * 0.22).fill({ color: premium ? 0x8a5f28 : SIGN.wood });
		g.roundRect(-w / 2, -h / 2, w, h * 0.42, h * 0.22).fill({ color: 0xffffff, alpha: 0.08 });
		g.roundRect(-w / 2 + h * 0.08, -h / 2 + h * 0.08, w - h * 0.16, h - h * 0.16, h * 0.16).stroke({ width: h * 0.04, color: premium ? 0xffd34d : 0xd9a866, alpha: 0.7 });
		for (const sx of [-1, 1]) {
			g.rect(sx * w * 0.32 - h * 0.05, -h / 2 - h * 0.4, h * 0.1, h * 0.4).fill({ color: SIGN.outline });
			g.circle(sx * (w / 2 - h * 0.2), 0, h * 0.06).fill({ color: 0x3a2413 });
		}
	};

	const label = (size: number, fill: number) => ({
		fontFamily: 'LuckySign, Inter, sans-serif',
		fontSize: size,
		fill,
		stroke: { color: SIGN.outline, width: size * 0.16, join: 'round' as const },
	});

	const totalW = $derived(compact ? S * 2.5 : S * 2.0);
	const totalH = $derived(compact ? S * 0.52 : S * 0.4);
	const totalLabelSize = $derived(totalH * 0.3);
	// THE FIGURE FITS THE SIGN (review 2026-09-20, seat C: the max-win screen read "TOTA100000×"). The figure was drawn
	// at a fixed totalH * 0.68 inside a fixed-width sign, so anything from about 1000.00× up ran back over the word
	// TOTAL. Same estimate BuildScene's header uses (a LuckySign glyph is ~0.66 em). Fitted against the tween's TARGET
	// as well as what is showing, so the size is decided once per prize and does not step while the digits count up.
	const totalFigSize = $derived.by(() => {
		const a = fmtMult(capDrawn(totalShown.current));
		const b = fmtMult(capDrawn(totalShown.target));
		const chars = Math.max(a.length, b.length, 1);
		// Reserve the longer FEATURE line of the two-line label, then a gap before the amount.
		const avail = totalW * 0.89 - totalLabelSize * 7 * 0.76 - totalH * 0.3;
		return Math.min(totalH * 0.68, avail / (chars * 0.66));
	});
</script>

<Container>
	<Grab ongrab={grab('body')} />

	{#if compact}
		<Container zIndex={-1}>
			<BoardTimber {post} {innerMargin} {premium} />
		</Container>
	{/if}

	<!-- deeper teal field + soft vignette (gold-warmed in Golden Build) -->
	<Graphics
		zIndex={0}
		draw={(g) => {
			const m = S * (innerMargin + post * 0.4);
			const r = S * 0.1;
			g.roundRect(-m, -m, W + 2 * m, H + 2 * m, r).fill({ color: premium ? 0x1d1608 : 0x041f27 });
			g.roundRect(0, 0, W, H, r).fill({ color: premium ? 0x3a2a0c : 0x07343f, alpha: 0.9 });
			// light pooled in the middle, falling off to the corners
			for (let i = 0; i < 7; i += 1) {
				const k = i / 7;
				g.ellipse(W / 2, H / 2, (W / 2) * (1.05 - k * 0.75), (H / 2) * (1.1 - k * 0.75)).fill({ color: premium ? 0xa9741a : 0x118596, alpha: 0.045 });
			}
			for (let i = 0; i < 6; i += 1) {
				const o = i * S * 0.07;
				g.roundRect(-m + o, -m + o, W + 2 * m - o * 2, H + 2 * m - o * 2, r + S * 0.1).stroke({ width: S * 0.09, color: 0x000a0e, alpha: 0.16 - i * 0.022 });
			}
		}}
	/>

	<Container zIndex={1}>
		{#each BUILD_CELLS as cell (cell.reel + '_' + cell.row + '_cell')}
			<BuildCell {board} reel={cell.reel} row={cell.row} x={(cell.reel + 0.5) * S} y={(cell.row + 0.5) * S} size={S} {premium} shimmer={nearFull ? breathe * 0.9 : 0} />
		{/each}
	</Container>

	<!-- the cell reels: every EMPTY plot spins a strip of the game's own symbols -->
	<Container zIndex={2}>
		<CellReels {board} {premium} />
	</Container>

	<!-- houses, back row first so a tall roof overlaps the plot BEHIND it -->
	<Container zIndex={3}>
		{#each [0, 1, 2] as row (row)}
			<Container zIndex={row}>
				{#each [0, 1, 2, 3, 4] as reel (reel)}
					<HouseView {board} {reel} {row} x={(reel + 0.5) * S} y={(row + 0.5) * S} size={S} {premium} />
				{/each}
			</Container>
		{/each}
	</Container>

	<!-- a completed street lights up along its row -->
	{#each streetSweep as st (st.id)}
		{@const p = st.t.current}
		<Container zIndex={4} y={(st.row + 0.5) * S}>
			<Graphics
				blendMode="add"
				alpha={Math.sin(Math.min(1, p) * Math.PI) * 0.8}
				draw={(g) => {
					g.roundRect(0, -S * 0.49, W, S * 0.98, S * 0.08).fill({ color: 0xffd34d, alpha: 0.2 });
					g.roundRect(0, -S * 0.49, W, S * 0.98, S * 0.08).stroke({ width: S * 0.05, color: 0xffe9a0, alpha: 0.9 });
				}}
			/>
			<Graphics
				blendMode="add"
				x={-S + p * (W + 2 * S)}
				alpha={0.7 * (1 - p)}
				draw={(g) => {
					for (let i = 0; i < 6; i += 1) g.rect(-S * 0.5 + i * S * 0.08, -S * 0.49, S * (1 - i * 0.16), S * 0.98).fill({ color: 0xfff3c4, alpha: 0.12 });
				}}
			/>
			<Text anchor={0.5} x={W / 2} y={0} alpha={Math.min(1, Math.sin(Math.min(1, p) * Math.PI) * 1.8)} scale={0.8 + 0.25 * Math.min(1, p * 3)} text={st.label} style={label(S * 0.34, 0xffe07a)} />
		</Container>
	{/each}

	<!-- FULL STREET xN: the row lights, the five houses pulse gold in sequence, the words on a plaque -->
	{#if street}
		{@const p = street.t.current}
		{@const inP = Math.min(1, p * 4)}
		{@const outP = p < 0.6 ? 0 : Math.min(1, (p - 0.6) / 0.12)}
		<Container zIndex={compact ? 8.7 : 6} y={(street.row + 0.5) * S}>
			<Graphics
				blendMode="add"
				alpha={Math.sin(Math.min(1, p) * Math.PI) * 0.9}
				draw={(g) => {
					g.roundRect(0, -S * 0.49, W, S * 0.98, S * 0.08).fill({ color: 0xffd34d, alpha: 0.26 });
					g.roundRect(0, -S * 0.49, W, S * 0.98, S * 0.08).stroke({ width: S * 0.06, color: 0xffe9a0, alpha: 1 });
				}}
			/>
			{#each [0, 1, 2, 3, 4] as reel (reel)}
				{@const q = Math.max(0, Math.min(1, (p - 0.64 - reel * 0.06) / 0.26))}
				<Graphics
					blendMode="add"
					x={(reel + 0.5) * S}
					alpha={Math.sin(q * Math.PI) * 0.8}
					scale={1 + 0.14 * Math.sin(q * Math.PI)}
					draw={(g) => {
						g.roundRect(-S * 0.46, -S * 0.46, S * 0.92, S * 0.92, S * 0.1).fill({ color: 0xffd34d, alpha: 0.32 });
						g.roundRect(-S * 0.46, -S * 0.46, S * 0.92, S * 0.92, S * 0.1).stroke({ width: S * 0.05, color: 0xfff3c4, alpha: 1 });
					}}
				/>
			{/each}
			<Container x={W / 2} scale={(0.7 + 0.3 * backOut(inP)) * (1 + 0.08 * outP)} alpha={inP * (1 - outP)}>
				<Graphics
					draw={(g) => {
						const w = W * 0.92;
						const h = S * 0.72;
						g.roundRect(-w / 2 + 3, -h / 2 + 4, w, h, h * 0.3).fill({ color: 0x000000, alpha: 0.4 });
						g.roundRect(-w / 2, -h / 2, w, h, h * 0.3).fill({ color: premium ? 0x3a2308 : 0x0d2b1c, alpha: 0.95 });
						g.roundRect(-w / 2, -h / 2, w, h, h * 0.3).stroke({ width: h * 0.08, color: premium ? 0xffd34d : 0xffc53a });
					}}
				/>
				<Text anchor={0.5} text={`${STREET} ×${street.mult}`} style={label(fitSize(`${STREET} ×${street.mult}`, S * 0.5, W * 0.84), premium ? 0xffe07a : 0xfff1c4)} />
			</Container>
		</Container>
	{/if}

	<!-- site tag (expanded): which board is which, on the hazard beam. Pixi 8 sorts a parent's children by
	     zIndex once any child carries one (pixi-svelte calls sortChildren on mount; markup order breaks
	     ties), so the tag carries a LOWER zIndex than the hats (4.5 < the effects' 5) and is written before
	     them: it used to sit at 8, above the effects (5), and
	     come after them and cut the crown off a hat landing / tumbling in the top-left plot — QA: "the
	     animation when hats land has gotten cut off" (owner, 2026-09-19). -->
	{#if compact}
		<Container zIndex={4.5} x={S * 0.52} y={TOTAL_ANCHOR.y * S}>
			<Graphics
				draw={(g) => {
					const w = S * 1.0;
					const h = S * 0.36;
					g.roundRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, h * 0.3).fill({ color: SIGN.outline });
					g.roundRect(-w / 2, -h / 2, w, h, h * 0.25).fill({ color: premium ? 0x8a5f28 : SIGN.wood });
					g.roundRect(-w / 2 + h * 0.08, -h / 2 + h * 0.08, w - h * 0.16, h - h * 0.16, h * 0.18).stroke({ width: h * 0.05, color: premium ? 0xffd34d : 0xd9a866, alpha: 0.7 });
				}}
			/>
			<!-- a bare numeral: this board's remaining spins while it is live (no words — contract 7.7) -->
			<Text
				anchor={0.5}
				text={spinning || bs?.status === 'live' ? String(bs?.bannerSpins ?? 0) : ''}
				style={{ fontFamily: 'LuckySign, Inter, sans-serif', fontSize: S * 0.26, fill: lastSpin ? 0xffb37a : 0xfff1c4 }}
			/>
		</Container>
	{/if}


	<!-- hats, dust, coins — above the plots, houses, street glow and the compact tag; the +1 SPIN call-out
	     and the SITE COMPLETE stamp below in the markup still draw above the hats -->
	<Container zIndex={5}>
		<BuildEffects {board} />
	</Container>

	<!-- OWNER RULING 2026-09-19 (docs/GAME_CONTRACT.md 7.7): the text strip that hung under the board — the
	     HOUSES n/15 plaque, the hazard banner with its words (n SPINS LEFT / LAST SPIN / DOORS OPEN / SITE
	     COMPLETE) and the STREETS n/3 plaque — is REMOVED ENTIRELY, in every bonus. "Confusing, and far too
	     small once there are several boards." Do NOT re-add it in any form. Spins left lives on the HUD spin
	     button; an expanded board shows its own remaining spins as a bare numeral on its tag (below). -->

	<!-- resting dim while this site waits (expanded rounds only) -->
	{#if compact}
		<Container zIndex={7}>
			<Grab ongrab={grab('dim')} />
			<Graphics
				draw={(g) => {
					const m = S * (innerMargin + post * 1.2);
					g.roundRect(-m, -m, W + 2 * m, H + 2 * m, S * 0.12).fill({ color: premium ? 0x120a02 : 0x030d18, alpha: 0.42 });
				}}
			/>
		</Container>
	{/if}

	<!-- TOTAL: only once the doors open; the coin arcs land here. Single-board bonuses only: an expanded
	     round has ONE shared TOTAL in the scene header (owner ruling, contract 7.7), never one per board. -->
	{#if totalIn.current > 0.01 && !compact}
		<Container zIndex={8} x={TOTAL_ANCHOR.x * S} y={TOTAL_ANCHOR.y * S} scale={Math.max(0.001, totalIn.current) * (1 + totalPop.current * 0.14)} alpha={Math.min(1, Math.max(0, totalIn.current) * 1.6)}>
			<Graphics
				blendMode="add"
				alpha={0.35 + totalPop.current * 0.65}
				draw={(g) => {
					for (let i = 0; i < 6; i += 1) g.roundRect(-totalW / 2 - i * 5, -totalH / 2 - i * 5, totalW + i * 10, totalH + i * 10, S * 0.1 + i * 4).fill({ color: 0xffc53a, alpha: 0.07 });
				}}
			/>
			<Graphics
				draw={(g) => {
					const w = totalW;
					const h = totalH;
					g.roundRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, h * 0.3).fill({ color: SIGN.outline });
					g.roundRect(-w / 2, -h / 2, w, h, h * 0.25).fill({ color: 0x3a2308 });
					g.roundRect(-w / 2, -h / 2, w, h, h * 0.25).stroke({ width: h * 0.09, color: 0xffc53a });
					g.roundRect(-w / 2 + h * 0.1, -h / 2 + h * 0.1, w - h * 0.2, h * 0.3, h * 0.12).fill({ color: 0xffffff, alpha: 0.07 });
				}}
			/>
			<Text anchor={{ x: 0, y: 0.5 }} x={-totalW * 0.44} text={'FEATURE\nTOTAL'} style={{ fontFamily: 'LuckySign, Inter, sans-serif', fontSize: totalLabelSize, lineHeight: totalH * 0.36, fill: 0xf3d9a4 }} />
			<!-- no dead "0×": the figure appears with the first prize that lands -->
			{#if totalShown.current >= 0.5}
				<Text anchor={{ x: 1, y: 0.5 }} x={totalW * 0.45} text={fmtMult(capDrawn(totalShown.current))} style={label(totalFigSize, 0xffe07a)} />
			{/if}
		</Container>
	{/if}

	<!-- the xN badge slams onto the total — written AFTER the TOTAL sign so it draws over its edge (single board: beside the TOTAL sign; compact: on the beam, top right) -->
	{#if badge}
		{@const p = badge.t.current}
		{@const inP = Math.min(1, p * 3)}
		{@const outP = p < 0.8 ? 0 : (p - 0.8) / 0.2}
		<Container
			zIndex={compact ? 8.8 : 8.5}
			x={compact ? W - S * 0.55 : TOTAL_ANCHOR.x * S + totalW / 2 + S * 0.42}
			y={TOTAL_ANCHOR.y * S}
			scale={(1.8 - 0.8 * backOut(inP)) * (1 + 0.1 * outP)}
			rotation={-0.18 + 0.12 * inP}
			alpha={Math.min(1, inP * 2) * (1 - outP)}
		>
			<Graphics
				draw={(g) => {
					const r = S * 0.36;
					g.circle(3, 4, r).fill({ color: 0x000000, alpha: 0.4 });
					g.circle(0, 0, r).fill({ color: premium ? 0xb8860b : 0xd63a28 });
					g.circle(0, 0, r).stroke({ width: S * 0.05, color: 0xffe07a });
				}}
			/>
			<Text anchor={0.5} text={`×${badge.mult}`} style={label(S * 0.42, 0xfff1c4)} />
		</Container>
	{/if}

	<!-- +1 SPIN call-out, raised on the flip's peak frame -->
	{#if extraA.current > 0.001 && extraA.current < 0.999}
		{@const p = extraA.current}
		<Container zIndex={9} x={W / 2} y={bannerY - S * 0.35 - Math.min(1, p * 2.2) * S * 0.75} scale={(compact ? 1.25 : 1) * (0.5 + Math.min(1, p * 5) * 0.62 + Math.sin(Math.min(1, p * 5) * Math.PI) * 0.22)} alpha={p < 0.78 ? 1 : (1 - p) / 0.22}>
			<Graphics
				blendMode="add"
				draw={(g) => {
					for (let i = 0; i < 7; i += 1) g.ellipse(0, 0, S * (1.5 - i * 0.17), S * (0.5 - i * 0.055)).fill({ color: 0xffd34d, alpha: 0.07 });
				}}
			/>
			<Text anchor={0.5} text="+1 LUCKY SPIN" style={{ ...label(S * 0.44, 0xfff1a8), dropShadow: { color: 0x7a3d00, alpha: 1, blur: 0, distance: S * 0.05, angle: Math.PI / 2.2 } }} />
		</Container>
	{/if}

	<!-- DISTRICT COMPLETE stamp (expanded; donor "SITE COMPLETE") -->
	{#if compact}
		<Container zIndex={10} x={W / 2} y={H / 2}>
			<Grab ongrab={grab('stamp')} />
			<Graphics
				draw={(g) => {
					const w = S * 4.3;
					const h = S * 1.15;
					g.roundRect(-w / 2 + 4, -h / 2 + 8, w, h, h * 0.18).fill({ color: 0x000000, alpha: 0.35 });
					g.roundRect(-w / 2, -h / 2, w, h, h * 0.18).fill({ color: premium ? 0x3a2308 : 0x0d2b1c, alpha: 0.94 });
					g.roundRect(-w / 2, -h / 2, w, h, h * 0.18).stroke({ width: h * 0.09, color: premium ? 0xffd34d : 0x9df2b4 });
					g.roundRect(-w / 2 + h * 0.13, -h / 2 + h * 0.13, w - h * 0.26, h - h * 0.26, h * 0.1).stroke({ width: h * 0.03, color: premium ? 0xffd34d : 0x9df2b4, alpha: 0.6 });
				}}
			/>
			<!-- the words are FITTED to the badge (owner, 2026-09-19: "needs to fit inside the badge ...
			     throughout all viewports"): the wrap is scaled down to the inner width once the sign
			     font has loaded, so the text never overruns the border at any board size -->
			<Container>
				<Grab ongrab={grab('stampText')} />
				<Text anchor={0.5} text={DONE} style={{ fontFamily: 'LuckySign, Inter, sans-serif', fontSize: S * 0.5, fill: premium ? 0xffe9a0 : 0xd6ffe0, letterSpacing: 2 }} />
			</Container>
		</Container>
	{/if}

	<!-- grand festival plate (donor "grand opening") -->
	{#if grandA.current > 0.001}
		<Container zIndex={11} x={W / 2} y={H / 2} scale={Math.max(0.001, grandA.current)} alpha={Math.max(0, Math.min(1, grandA.current * 1.5))}>
			<Graphics draw={(g) => drawSignPanel(g as any, { w: S * 4.6, h: S * 2.4, s: S, variant: 'win' })} />
			<Text anchor={0.5} y={-S * 0.5} text={FESTIVAL} style={{ ...signTitleStyle(S, { gold: true }), fontSize: S * 0.36 }} />
			<Text anchor={0.5} y={S * 0.4} text={`×${grandMult}`} style={signValueStyle(S, 0.86)} />
		</Container>
	{/if}
</Container>
