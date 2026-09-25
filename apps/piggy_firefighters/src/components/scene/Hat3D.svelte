<script lang="ts" module>
	// The 3D hard hat, played straight off the hat3d sprite sheets
	// (static/assets/hat3d/manifest.json) — no Spine wrapper needed yet. One
	// instance = one hat; reusable on the bonus board AND on the base board
	// (mount it over a cell; `size` is the cell size in the parent's units).
	//
	// Everything is FRAME-driven: `onframe(clip, frame)` fires as each sheet frame
	// is shown, so the director hangs the spins-banner tick and the "+1 SPIN"
	// call-out on the manifest's flip PEAK frame, never on a timer.
	export type Hat3DApi = {
		/** Play a clip once (loops if the manifest says so). Resolves on the last frame. */
		play: (clip: HatClip, opts?: { rate?: number; swell?: boolean }) => Promise<void>;
		/** Hold the static rest frame (rim glow on). */
		rest: () => void;
		/** Remove the hat from view. */
		hide: () => void;
	};
	export type HatClip = 'land' | 'idle_tilt' | 'flip' | 'slam';
	export type HatSkin = 'yellow' | 'gold';
</script>

<script lang="ts">
	import { onMount } from 'svelte';

	import { BaseSprite, Container, getContextApp } from 'pixi-svelte';

	import { sceneTex } from '../../game/build/sceneTextures.svelte';
	import { subTexture } from '../../game/build/pixiKit';
	import { hatManifest as M, hatRects, loadHatManifest } from '../../game/build/hatManifest.svelte';
	import Grab from './Grab.svelte';

	/* eslint-disable @typescript-eslint/no-explicit-any */
	type Props = {
		x: number;
		y: number;
		/** cell size in the parent's units */
		size: number;
		skin?: HatSkin;
		register: (api: Hat3DApi) => (() => void) | void;
		onframe?: (clip: HatClip, frame: number) => void;
	};
	const { x, y, size, skin = 'yellow', register, onframe }: Props = $props();

	const app = getContextApp();
	loadHatManifest();
	const SWELL = 1.35;
	const PIVOT = $derived(M.pivot);
	// the frame is larger than the hat (it contains the whole tumble)
	const fit = $derived(size * (skin === 'gold' ? M.cellFitGoldPlated : M.cellFit));
	const k = $derived(fit / M.frame);

	// ---- frame tables (sub-rectangles of the sheets, built once per sheet) ----------
	const cache = new Map<string, any[]>();
	const framesOf = (key: string, rects: number[][]): any[] | null => {
		const hit = cache.get(key);
		if (hit) return hit;
		const sheet = sceneTex(key);
		if (!sheet) return null;
		const list = rects.map((r) => subTexture(sheet, r[0], r[1], r[2], r[3]));
		cache.set(key, list);
		return list;
	};
	const clipFrames = (clip: string) => framesOf(`hat3d_${skin}_${clip}`, hatRects(M.clips[clip]));
	const fxFrames = (fx: string) => framesOf(`hat3d_fx_${fx}`, hatRects(M.fx[fx]));

	const restTex = $derived(sceneTex(`hat3d_${skin}_rest`));
	const sunTex = $derived(skin === 'gold' ? sceneTex('hat3d_fx_sunburst') : null);

	// ---- live nodes ---------------------------------------------------------------------
	const R: Record<string, any> = {};
	const grab = (n: string) => (node: any) => (R[n] = node);
	const spriteOf = (n: string) => R[n]?.children?.find((c: any) => 'texture' in c);

	let shown = $state(false);
	let playing: { clip: HatClip; frames: any[]; t: number; fps: number; loop: boolean; rate: number; swell: boolean; last: number; done: () => void } | null = null;
	let glowT = 0;
	let sunRot = 0;

	const setHat = (tex: any) => {
		const s = spriteOf('hat');
		if (s && tex) s.texture = tex;
	};

	const step = (tk: any) => {
		if (!shown) return;
		const dt = Math.min(0.05, (tk?.deltaMS ?? 16.7) / 1000);
		glowT += dt;
		sunRot += dt * (((M.fx.sunburst.rotate_deg_per_s ?? 10) * Math.PI) / 180);
		if (R.sun) R.sun.rotation = sunRot;

		// rim glow loops while the hat is on the board
		const glow = fxFrames('rim_glow');
		const gs = spriteOf('glow');
		if (gs) gs.visible = !!glow;
		if (glow && gs) gs.texture = glow[Math.floor(glowT * M.fx.rim_glow.fps) % glow.length];

		let swell = 1;
		const crack = spriteOf('crack');
		if (crack) crack.visible = false;
		if (playing) {
			const p = playing;
			p.t += dt * p.rate;
			let f = Math.floor(p.t * p.fps);
			if (p.loop) f %= p.frames.length;
			const end = f >= p.frames.length;
			f = Math.min(p.frames.length - 1, f);
			if (f !== p.last) {
				// never skip a frame's callback (a slow tick can jump several frames)
				for (let i = p.last + 1; i <= f; i += 1) onframe?.(p.clip, i);
				p.last = f;
				setHat(p.frames[f]);
			}
			if (p.swell) {
				// swell out of the cell, hold through the tumble, settle back
				const n = p.frames.length;
				const up = Math.min(1, f / 8);
				const down = Math.min(1, Math.max(0, (n - 1 - f) / 9));
				const e = Math.min(up, down);
				swell = 1 + (SWELL - 1) * (1 - Math.pow(1 - e, 2));
			}
			if (p.clip === 'flip' && crack) {
				const [a, b] = M.fx.energy_crack.match_frame_range ?? [14, 23];
				const cf = fxFrames('energy_crack');
				if (cf && f >= a && f <= b) {
					crack.visible = true;
					crack.texture = cf[Math.min(cf.length - 1, f - a)];
				}
			}
			if (end && !p.loop) {
				qaLog('end');
				playing = null;
				p.done();
			}
		}
		if (R.body) R.body.scale.set(swell);
	};

	// QA seam (dev only): every clip's real run — frames shown vs frames authored, and whether a
	// later play / rest / hide cut it short. window.__pwHatLog on the dev server.
	const qaLog = (why: string) => {
		if (!import.meta.env.DEV || !playing) return;
		const p = playing;
		const cut = p.last + 1 < p.frames.length;
		const w = globalThis as unknown as { __pwHatLog?: unknown[] };
		(w.__pwHatLog ??= []).push({ x: Math.round(x), y: Math.round(y), skin, clip: p.clip, shown: p.last + 1, total: p.frames.length, cut, by: why, t: Math.round(performance.now()) });
	};
	const api: Hat3DApi = {
		play: (clip, opts = {}) =>
			new Promise<void>((resolve) => {
				const frames = clipFrames(clip);
				qaLog(`play:${clip}`);
				playing?.done();
				if (!frames) {
					// sheet not decoded: show the rest frame instead of nothing, and let the
					// caller's sequence continue (frame callbacks still fire, in order)
					shown = true;
					for (let i = 0; i < M.clips[clip].frames; i += 1) onframe?.(clip, i);
					resolve();
					return;
				}
				shown = true;
				playing = { clip, frames, t: 0, fps: M.clips[clip].fps, loop: !!M.clips[clip].loop, rate: opts.rate ?? 1, swell: !!opts.swell, last: -1, done: resolve };
			}),
		rest: () => {
			qaLog('rest');
			playing?.done();
			playing = null;
			shown = true;
			setHat(restTex);
		},
		hide: () => {
			qaLog('hide');
			playing?.done();
			playing = null;
			shown = false;
		},
	};

	onMount(() => {
		const un = register(api);
		const ticker = app.stateApp.pixiApplication?.ticker;
		ticker?.add(step);
		return () => {
			ticker?.remove(step);
			playing?.done();
			if (typeof un === 'function') un();
		};
	});
</script>

<Container {x} {y} visible={shown}>
	{#if sunTex}
		<Container zIndex={0}>
			<Grab ongrab={grab('sun')} />
			<BaseSprite texture={sunTex} anchor={0.5} width={fit} height={fit} />
		</Container>
	{/if}
	<!-- swell / rotate about the manifest pivot, not the frame centre -->
	<Container zIndex={1} x={(PIVOT[0] - 0.5) * fit} y={(PIVOT[1] - 0.5) * fit}>
		<Grab ongrab={grab('body')} />
		<Container x={-(PIVOT[0] - 0.5) * fit} y={-(PIVOT[1] - 0.5) * fit}>
			<Container zIndex={0}>
				<Grab ongrab={grab('glow')} />
				{#if sceneTex('hat3d_fx_rim_glow') && restTex}
					<BaseSprite texture={restTex} anchor={0.5} scale={k} blendMode="add" alpha={0.85} />
				{/if}
			</Container>
			<Container zIndex={1}>
				<Grab ongrab={grab('hat')} />
				{#if restTex}
					<BaseSprite texture={restTex} anchor={0.5} scale={k} />
				{/if}
			</Container>
			<Container zIndex={2}>
				<Grab ongrab={grab('crack')} />
				{#if sceneTex('hat3d_fx_energy_crack') && restTex}
					<BaseSprite texture={restTex} anchor={0.5} scale={k} blendMode="add" visible={false} />
				{/if}
			</Container>
		</Container>
	</Container>
</Container>
