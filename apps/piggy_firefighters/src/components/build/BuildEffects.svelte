<script lang="ts" module>
	export type BuildCellRef = { reel: number; row: number };
	/** `fromReel`: the hat is already AT REST on its cell reel (flat symbol) — the 3D
	 *  hat takes the plot over in place instead of arriving. */
	export type BuildHatRef = BuildCellRef & { golden?: boolean; fromReel?: boolean };

	export type EmitterEventBuildEffects =
		/** White square target highlight on every cell a hat is about to land on. */
		| { type: 'buildHatTargets'; cells: BuildCellRef[]; board?: number }
		/** The 3D hats arrive (`land`). Resolves once every hat has landed. */
		| { type: 'buildHatsLand'; hats: BuildHatRef[]; board?: number }
		/** RETRIGGER: every hat landed this spin flips in sync, swelling out of its
		 *  cell. `onPeak` fires on the manifest's flip PEAK FRAME (never a timer). */
		| { type: 'buildHatsFlip'; onPeak: () => void; board?: number }
		/** One hat slams flat into its cell and is gone (the square trace starts with it). */
		| { type: 'buildHatSlam'; reel: number; row: number; board?: number }
		/** no `board` = every board */
		| { type: 'buildHatsClear'; board?: number }
		| { type: 'buildSquareTrace'; reel: number; row: number; tier?: number; board?: number }
		| { type: 'buildDust'; reel: number; row: number; board?: number }
		| { type: 'buildSparkle'; reel: number; row: number; board?: number }
		| { type: 'buildCoinTrail'; reel: number; row: number; board?: number }
		| { type: 'buildSpinPulse' };

	/** Where collected prizes fly to: the TOTAL sign on the hazard beam (board units / cell). */
	export const TOTAL_ANCHOR = { x: 2.5, y: -0.13 };
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut, cubicIn, cubicInOut } from 'svelte/easing';

	import { Container, Graphics } from 'pixi-svelte';

	import { SYMBOL_SIZE } from '../../game/constants';
	import { getContext } from '../../game/context';
	import { dur, isTurbo, prefersReducedMotion } from '../../game/build/buildTiming';
	import { audioDirector } from '../../game/build/audioDirector';
	import Hat3D, { type Hat3DApi, type HatClip } from '../scene/Hat3D.svelte';
	import { hatManifest } from '../../game/build/hatManifest.svelte';

	import { getCellReels } from '../../game/build/cellReels';

	/* eslint-disable @typescript-eslint/no-explicit-any */
	// One effects layer PER BOARD: every event carries `board` (absent = board 0,
	// the single-board bonuses) and a layer ignores the beats of the other boards.
	type Props = { board?: number };
	const { board = 0 }: Props = $props();
	const mine = (b?: number) => (b ?? 0) === board;

	const context = getContext();
	const S = SYMBOL_SIZE;
	const cx = (reel: number) => (reel + 0.5) * S;
	const cy = (row: number) => (row + 0.5) * S;

	// ---- one-shot effects -----------------------------------------------------------
	type Fx = {
		id: number;
		kind: 'target' | 'trace' | 'dust' | 'sparkle' | 'coin';
		x: number;
		y: number;
		tx?: number;
		ty?: number;
		bend?: number;
		gold?: boolean;
		t: Tween<number>;
	};
	let fx = $state<Fx[]>([]);
	let nextId = 0;

	const add = (item: Omit<Fx, 'id'>, lifeMs: number) => {
		const id = nextId++;
		fx.push({ ...item, id } as Fx);
		setTimeout(() => {
			fx = fx.filter((f) => f.id !== id);
		}, lifeMs + 80);
	};

	const oneShot = (kind: Fx['kind'], reel: number, row: number, ms: number, easing = cubicOut, extra: Partial<Fx> = {}) => {
		const d = dur(ms);
		const t = new Tween(0, { duration: 0, easing });
		add({ kind, x: cx(reel), y: cy(row), t, ...extra }, d);
		void t.set(1, { duration: d });
		return d;
	};

	// ---- the 3D hats ---------------------------------------------------------------------
	type Hat = { key: string; reel: number; row: number; golden: boolean; fromReel: boolean };
	let hats = $state<Hat[]>([]);
	const apis = new Map<string, Hat3DApi>();
	const waiters = new Map<string, () => void>();
	const keyOf = (reel: number, row: number) => `${reel}_${row}`;
	let peakCb: (() => void) | null = null;

	const awaitApi = (key: string) =>
		apis.has(key)
			? Promise.resolve()
			: new Promise<void>((res) => {
					waiters.set(key, res);
					setTimeout(res, 600);
				});

	const registerHat = (key: string) => (api: Hat3DApi) => {
		apis.set(key, api);
		waiters.get(key)?.();
		waiters.delete(key);
		return () => {
			if (apis.get(key) === api) apis.delete(key);
		};
	};

	const onHatFrame = (hat: Hat) => (clip: HatClip, frame: number) => {
		if (clip === 'flip' && frame === (hatManifest.clips.flip.peak ?? 18) && peakCb) {
			const cb = peakCb;
			peakCb = null; // ONE tick per retrigger, off the first hat to reach its peak
			audioDirector.hatFlipPeak?.(hat.golden);
			cb();
		}
	};

	const rate = (clip: HatClip) => (isTurbo() ? (clip === 'flip' ? 2.45 : 1.6) : 1);

	const land = async (list: BuildHatRef[]) => {
		const reduced = prefersReducedMotion();
		hats = list.map((h) => ({ key: keyOf(h.reel, h.row), reel: h.reel, row: h.row, golden: !!h.golden, fromReel: !!h.fromReel }));
		await Promise.all(
			hats.map(async (h, i) => {
				await awaitApi(h.key);
				const api = apis.get(h.key);
				// the flat reel hat leaves on the SAME frame the 3D hat appears (same size, no pop)
				const takeOver = () => h.fromReel && getCellReels(board)?.release(h.reel, h.row);
				if (!api) return takeOver();
				if (reduced) {
					api.rest();
					return takeOver();
				}
				await new Promise((r) => setTimeout(r, dur(70) * i)); // a quick ripple, not a wall
				if (!h.fromReel) audioDirector.hatContact(); // a reel hat already ticked on its stop
				const played = api.play('land', { rate: rate('land') });
				takeOver();
				await played;
				api.rest();
			}),
		);
	};

	const flip = async (onPeak: () => void) => {
		if (prefersReducedMotion() || hats.length === 0) {
			onPeak(); // static rest frame + banner tick only
			return;
		}
		peakCb = onPeak;
		audioDirector.hatFlipStart?.(hats.some((h) => h.golden));
		// all hats start on the SAME tick so they tumble in sync
		await Promise.all(
			hats.map(async (h) => {
				const api = apis.get(h.key);
				if (!api) return;
				await api.play('flip', { rate: rate('flip'), swell: true });
				api.rest();
			}),
		);
		audioDirector.hatFlipSettle?.();
		if (peakCb) {
			// no hat reached its peak frame (sheets missing): still tick exactly once
			peakCb = null;
			onPeak();
		}
	};

	const slam = async (reel: number, row: number) => {
		const key = keyOf(reel, row);
		const api = apis.get(key);
		if (api && !prefersReducedMotion()) {
			audioDirector.hatSlam?.();
			await api.play('slam', { rate: rate('slam') });
		}
		api?.hide();
		hats = hats.filter((h) => h.key !== key);
	};

	context.eventEmitter.subscribeOnMount({
		buildHatTargets: ({ cells, board: b }) =>
			!mine(b) ? undefined : new Promise<void>((resolve) => {
				let d = 0;
				for (const c of cells) d = oneShot('target', c.reel, c.row, 520, cubicInOut);
				setTimeout(resolve, prefersReducedMotion() ? 0 : d * 0.55);
			}),
		buildHatsLand: ({ hats: list, board: b }) => (mine(b) ? land(list) : undefined),
		buildHatsFlip: ({ onPeak, board: b }) => (mine(b) ? flip(onPeak) : undefined),
		buildHatSlam: ({ reel, row, board: b }) => (mine(b) ? slam(reel, row) : undefined),
		buildHatsClear: ({ board: b }) => {
			if (b !== undefined && b !== board) return;
			for (const api of apis.values()) api.hide();
			hats = [];
			peakCb = null;
		},
		buildSquareTrace: ({ reel, row, tier, board: b }) =>
			!mine(b) ? undefined : new Promise<void>((resolve) => {
				audioDirector.squareTrace?.(tier ?? 1);
				const d = oneShot('trace', reel, row, 360, cubicOut, { gold: (tier ?? 1) >= 4 });
				setTimeout(resolve, d);
			}),
		buildDust: ({ reel, row, board: b }) => void (mine(b) && oneShot('dust', reel, row, 520)),
		buildSparkle: ({ reel, row, board: b }) => void (mine(b) && oneShot('sparkle', reel, row, 640)),
		buildCoinTrail: ({ reel, row, board: b }) => {
			if (!mine(b)) return;
			// prizes fly on ARCS into the total sign, a short string of coins each
			const n = 3;
			for (let i = 0; i < n; i += 1) {
				setTimeout(() => {
					const d = dur(520);
					const t = new Tween(0, { duration: 0, easing: cubicIn });
					add({ kind: 'coin', x: cx(reel), y: cy(row) + S * 0.1, tx: TOTAL_ANCHOR.x * S, ty: TOTAL_ANCHOR.y * S, bend: (reel - 2) * 0.22 + (i - 1) * 0.12, t }, d);
					void t.set(1, { duration: d });
				}, dur(55) * i);
			}
		},
		buildSpinPulse: () => (board === 0 ? new Promise<void>((resolve) => setTimeout(resolve, dur(160))) : undefined),
	});
</script>

<!-- hats sit ABOVE the houses and their plots -->
{#each hats as h (h.key)}
	<Hat3D x={cx(h.reel)} y={cy(h.row)} size={S} skin={h.golden ? 'gold' : 'yellow'} register={registerHat(h.key)} onframe={onHatFrame(h)} />
{/each}

{#each fx as f (f.id)}
	{#if f.kind === 'target'}
		{@const p = f.t.current}
		<!-- clean white square target: snaps in, holds, breathes out -->
		<Graphics
			x={f.x}
			y={f.y}
			scale={1.18 - 0.18 * Math.min(1, p * 3)}
			alpha={p < 0.75 ? Math.min(1, p * 5) : (1 - p) / 0.25}
			draw={(g) => {
				const s = S * 0.47;
				g.roundRect(-s, -s, s * 2, s * 2, S * 0.06).fill({ color: 0xffffff, alpha: 0.12 });
				g.roundRect(-s, -s, s * 2, s * 2, S * 0.06).stroke({ width: S * 0.05, color: 0xffffff, alpha: 1 });
				g.roundRect(-s - S * 0.03, -s - S * 0.03, s * 2 + S * 0.06, s * 2 + S * 0.06, S * 0.08).stroke({ width: S * 0.03, color: 0xffffff, alpha: 0.35 });
			}}
		/>
	{:else if f.kind === 'trace'}
		{@const p = f.t.current}
		<Graphics
			x={f.x}
			y={f.y}
			alpha={p < 0.85 ? 1 : (1 - p) / 0.15}
			draw={(g) => {
				const s = S * 0.47;
				const w = s * 2;
				let len = p * 4 * w;
				const seg = [
					[-s, -s, s, -s],
					[s, -s, s, s],
					[s, s, -s, s],
					[-s, s, -s, -s],
				];
				for (const [x0, y0, x1, y1] of seg) {
					if (len <= 0) break;
					const f2 = Math.min(1, len / w);
					g.moveTo(x0, y0).lineTo(x0 + (x1 - x0) * f2, y0 + (y1 - y0) * f2);
					len -= w;
				}
				g.stroke({ width: S * 0.1, color: f.gold ? 0xffb300 : 0xffe14a, alpha: 0.3, cap: 'round', join: 'round' });
				len = p * 4 * w;
				for (const [x0, y0, x1, y1] of seg) {
					if (len <= 0) break;
					const f2 = Math.min(1, len / w);
					g.moveTo(x0, y0).lineTo(x0 + (x1 - x0) * f2, y0 + (y1 - y0) * f2);
					len -= w;
				}
				g.stroke({ width: S * 0.045, color: 0xfff7c9, alpha: 1, cap: 'round', join: 'round' });
			}}
		/>
	{:else if f.kind === 'dust'}
		{@const p = f.t.current}
		<Container x={f.x} y={f.y + S * 0.3} alpha={1 - p}>
			{#each [0, 1, 2, 3, 4, 5, 6] as i (i)}
				{@const ang = Math.PI * (0.08 + (i / 6) * 0.84)}
				<Graphics
					x={Math.cos(ang) * p * S * 0.52}
					y={-Math.sin(ang) * p * S * 0.26}
					draw={(g) => {
						g.circle(0, 0, S * (0.09 + p * 0.07)).fill({ color: 0xe6d5b0, alpha: 0.85 });
						g.circle(0, 0, S * (0.09 + p * 0.07)).stroke({ width: S * 0.012, color: 0x8a6f48, alpha: 0.5 });
					}}
				/>
			{/each}
		</Container>
	{:else if f.kind === 'sparkle'}
		{@const p = f.t.current}
		<Container x={f.x} y={f.y - S * 0.1} alpha={Math.sin(p * Math.PI)}>
			{#each [0, 1, 2, 3, 4] as i (i)}
				{@const ang = (i / 5) * Math.PI * 2 + p * 1.5}
				{@const r = S * (0.15 + p * 0.32)}
				<Graphics
					blendMode="add"
					x={Math.cos(ang) * r}
					y={Math.sin(ang) * r}
					draw={(g) => {
						const a = S * 0.07;
						g.poly([0, -a, a * 0.25, -a * 0.25, a, 0, a * 0.25, a * 0.25, 0, a, -a * 0.25, a * 0.25, -a, 0, -a * 0.25, -a * 0.25]).fill({ color: 0xfff6c0 });
					}}
				/>
			{/each}
		</Container>
	{:else if f.kind === 'coin'}
		{@const p = f.t.current}
		{@const tx = f.tx ?? f.x}
		{@const ty = f.ty ?? f.y}
		{@const mx = (f.x + tx) / 2 + (f.bend ?? 0) * S * 2.2}
		{@const my = Math.min(f.y, ty) - S * 0.55}
		{@const q = 1 - p}
		<!-- quadratic arc: start -> lifted control point -> the total sign -->
		{#each [0, 0.07, 0.14] as lag, i (i)}
			{@const pp = Math.max(0, p - lag)}
			{@const qq = 1 - pp}
			<Graphics
				x={qq * qq * f.x + 2 * qq * pp * mx + pp * pp * tx}
				y={qq * qq * f.y + 2 * qq * pp * my + pp * pp * ty}
				alpha={(i === 0 ? 1 : 0.45 - i * 0.12) * (p > 0.92 ? (1 - p) / 0.08 : 1)}
				scale={(i === 0 ? 1 : 0.8 - i * 0.12) * (0.75 + q * 0.4)}
				draw={(g) => {
					g.circle(0, 0, S * 0.1).fill({ color: 0xffcf3a });
					g.circle(0, 0, S * 0.1).stroke({ width: S * 0.025, color: 0x8a5a10 });
					g.circle(-S * 0.025, -S * 0.03, S * 0.035).fill({ color: 0xfff3b0, alpha: 0.9 });
				}}
			/>
		{/each}
	{/if}
{/each}
