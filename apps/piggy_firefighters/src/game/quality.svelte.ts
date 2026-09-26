/**
 * QUALITY TIER — the one device-capability notion every cap in the game keys off (perf sweep, group a, 2026-09-25).
 *
 *   staticTier   frozen at import, BEFORE game/stateApp.ts builds the manifest and before Application.init: it picks
 *                the renderer resolution / antialias and the asset variants (LOD plates, half-size rig pages).
 *   quality      reactive; `tier` starts at staticTier and may drop ONE step, once per session, after the shutter
 *                (measureOnce). The drop changes caps only (particle pools, idle motions, frame cap): resolution,
 *                antialias and asset variants stay what staticTier chose.
 *   qv({...})    the value for the current tier. Every `high` value is today's constant, so a desktop / flagship
 *                phone renders exactly what it rendered before this module existed.
 *
 * Scoring is deliberately conservative and Chromium-shaped: navigator.deviceMemory (Chromium only) <= 2 GB -> low,
 * <= 4 GB -> mid; <= 4 cores demote one step ONLY when deviceMemory is defined (WebKit quantises hardwareConcurrency
 * and would demote every iPhone); no WebGL2 -> low. devicePixelRatio and pointer:coarse are never penalised (a
 * flagship phone is 'high'). `?quality=high|mid|low` is honoured only in DEV or under the QA seam flag
 * (globalThis.__PFF_QA, the same rule as game/stateSpeed.svelte.ts).
 */
import type { PIXI } from 'pixi-svelte';

export type Tier = 'high' | 'mid' | 'low';

const ORDER: readonly Tier[] = ['high', 'mid', 'low'];
const stepDown = (t: Tier): Tier => ORDER[Math.min(ORDER.length - 1, ORDER.indexOf(t) + 1)];

const qaSeams = (): boolean => (globalThis as unknown as { __PFF_QA?: unknown }).__PFF_QA === true;

/** `?quality=` override: DEV builds and QA-seamed pages only; never a player's session. */
const override = (): Tier | null => {
	if (typeof window === 'undefined') return null;
	if (!import.meta.env.DEV && !qaSeams()) return null;
	try {
		const q = new URLSearchParams(window.location.search).get('quality');
		return q === 'high' || q === 'mid' || q === 'low' ? q : null;
	} catch {
		return null;
	}
};

/** A throwaway WebGL2 probe (released at once): no WebGL2 means no NPOT mipmaps and a WebGL1 fallback renderer. */
const hasWebGL2 = (): boolean => {
	try {
		const canvas = document.createElement('canvas');
		const gl = canvas.getContext('webgl2');
		if (!gl) return false;
		gl.getExtension('WEBGL_lose_context')?.loseContext();
		return true;
	} catch {
		return false;
	}
};

const score = (): Tier => {
	const forced = override();
	if (forced) return forced;
	if (typeof navigator === 'undefined' || typeof document === 'undefined') return 'high';
	let tier: Tier = 'high';
	const memory = (navigator as unknown as { deviceMemory?: unknown }).deviceMemory;
	if (typeof memory === 'number') {
		if (memory <= 2) tier = 'low';
		else if (memory <= 4) tier = 'mid';
		const cores = navigator.hardwareConcurrency;
		if (typeof cores === 'number' && cores <= 4) tier = stepDown(tier);
	}
	if (!hasWebGL2()) tier = 'low';
	return tier;
};

/** Frozen at import: resolution, antialias and asset variants read this, never `quality.tier`. */
export const staticTier: Tier = score();

const DROP_KEY = 'pff-quality-drop';
const droppedThisSession = (): boolean => {
	try {
		return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(DROP_KEY) === '1';
	} catch {
		return false;
	}
};
const forcedByQuery = override() !== null;
const dropped = !forcedByQuery && droppedThisSession();

/** Reactive tier. `measured` is true once the one frame-time measurement has run (or was skipped: override / reload). */
export const quality = $state({
	tier: (dropped ? stepDown(staticTier) : staticTier) as Tier,
	measured: dropped || forcedByQuery,
});

/** The value for the CURRENT tier. */
export const qv = <T>(v: { high: T; mid: T; low: T }): T => v[quality.tier];

/** The value for the STATIC tier (asset variants and renderer options). */
export const qvStatic = <T>(v: { high: T; mid: T; low: T }): T => v[staticTier];

// ---- renderer options (read by game/stateApp.ts, applied by pixi-svelte InitialiseApplication) ------------------------
/** DPR cap per tier. 'high' = pixi-svelte's own clamp [1, 2], so a 'high' device gets byte-identical init options. */
export const DPR_CAP = { high: 2, mid: 1.5, low: 1.25 } as const;

/** Renderer resolution: the device pixel ratio clamped to [1, cap] (the lower bound keeps a zoomed-out tab sharp). */
export const clampResolution = (ratio: number | undefined, cap: number): number => Math.min(cap, Math.max(1, ratio ?? 1));

/** The tier's Application.init overrides: resolution cap and MSAA off on 'low' (sprites, nine-slices and Spine meshes
 *  gain nothing from MSAA; only Graphics edges do). Fixed at init, so the static tier decides. */
export const rendererOptions = () => ({
	resolution: clampResolution(typeof window !== 'undefined' ? window.devicePixelRatio : 1, qvStatic(DPR_CAP)),
	antialias: staticTier !== 'low',
});

// ---- the one measurement ---------------------------------------------------------------------------------------------
const SAMPLES = 180;
const P90_LIMIT_MS = 25;

/**
 * Called once, ~2 s after the splash shutter is done (components/Game.svelte): samples 180 ticker frames and, when the
 * p90 frame time is over 25 ms (the device cannot hold ~40 fps on the idle board), drops the tier one step. Once per
 * session: the drop is remembered in sessionStorage so a reload keeps it without re-measuring. Never runs under a
 * `?quality=` override.
 */
export function measureOnce(app: PIXI.Application | undefined): void {
	if (quality.measured || !app?.ticker) return;
	quality.measured = true;
	const ticker = app.ticker;
	const samples: number[] = [];
	const tick = () => {
		if (typeof document !== 'undefined' && document.hidden) return; // a hidden tab clamps to the ticker's max delta
		samples.push(ticker.deltaMS);
		if (samples.length < SAMPLES) return;
		ticker.remove(tick);
		samples.sort((a, b) => a - b);
		const p90 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.9))];
		if (p90 > P90_LIMIT_MS && quality.tier !== 'low') {
			quality.tier = stepDown(quality.tier);
			try {
				sessionStorage.setItem(DROP_KEY, '1');
			} catch {
				/* private mode: the drop lasts this page only */
			}
			console.info(`[quality] p90 frame ${p90.toFixed(1)} ms > ${P90_LIMIT_MS} ms: caps dropped to '${quality.tier}'`);
		}
	};
	ticker.add(tick);
}
