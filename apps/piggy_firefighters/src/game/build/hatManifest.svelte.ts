/**
 * hat3d manifest access. The manifest lives in static/ (the hat3d pipeline owns
 * it) and Vite refuses module imports out of the public dir, so it is FETCHED at
 * runtime from the same place the sheets are served. Until it arrives — or if it
 * never does — the baked defaults below (a snapshot of the pass-2 manifest) keep
 * every clip playable; frame rects are derived from grid + frame size exactly as
 * the packer lays them out.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
// Resolved against the PAGE, not this module: a module-relative path has a different depth on the dev
// server (/src/game/build/) and in the built bundle (/_app/immutable/), and the old three-level climb
// left the versioned subpath entirely in production (404 on every boot).
const MANIFEST_URL =
	typeof document === 'undefined'
		? './assets/hat3d/manifest.json'
		: new URL('./assets/hat3d/manifest.json', document.baseURI).href;

type Clip = { frames: number; fps: number; loop: boolean; grid: [number, number]; peak?: number };
type Fx = { frames: number; fps: number; loop: boolean; grid: [number, number]; match_frame_range?: [number, number]; rotate_deg_per_s?: number };

const DEFAULTS = {
	frame: 256,
	pivot: [0.4674, 0.5054] as [number, number],
	cellFit: 1.262,
	cellFitGoldPlated: 1.111,
	clips: {
		rest: { frames: 1, fps: 30, loop: false, grid: [1, 1] },
		land: { frames: 9, fps: 30, loop: false, grid: [3, 3] },
		idle_tilt: { frames: 18, fps: 30, loop: true, grid: [5, 4] },
		flip: { frames: 52, fps: 30, loop: false, grid: [8, 7], peak: 18 },
		slam: { frames: 10, fps: 30, loop: false, grid: [4, 3] },
	} as Record<string, Clip>,
	fx: {
		energy_crack: { frames: 10, fps: 30, loop: false, grid: [4, 3], match_frame_range: [14, 23] },
		rim_glow: { frames: 12, fps: 30, loop: true, grid: [4, 3] },
		glint: { frames: 8, fps: 30, loop: false, grid: [3, 3] },
		sunburst: { frames: 1, fps: 30, loop: true, grid: [1, 1], rotate_deg_per_s: 10 },
		gold_sparkles: { frames: 12, fps: 30, loop: true, grid: [4, 3] },
	} as Record<string, Fx>,
};

export const hatManifest = $state({ ...DEFAULTS, loaded: false });

/** Frame rectangles for a clip / fx, in sheet px (row-major, as packed). */
export const hatRects = (entry: { frames: number; grid: [number, number] }, rects?: number[][]): number[][] => {
	if (rects && rects.length === entry.frames) return rects;
	const f = hatManifest.frame;
	return Array.from({ length: entry.frames }, (_, i) => [(i % entry.grid[0]) * f, Math.floor(i / entry.grid[0]) * f, f, f]);
};

let kicked = false;
export const loadHatManifest = () => {
	if (kicked || typeof window === 'undefined') return;
	kicked = true;
	fetch(MANIFEST_URL)
		.then((r) => (r.ok ? r.json() : null))
		.then((m: any) => {
			if (!m?.meta || !m?.clips) return;
			hatManifest.frame = m.meta.frame ?? hatManifest.frame;
			hatManifest.pivot = m.meta.pivot ?? hatManifest.pivot;
			hatManifest.cellFit = m.meta.cell_fit_scale ?? hatManifest.cellFit;
			hatManifest.cellFitGoldPlated = m.meta.cell_fit_scale_gold_plated ?? hatManifest.cellFitGoldPlated;
			for (const k of Object.keys(hatManifest.clips)) {
				const c = m.clips[k];
				if (c) hatManifest.clips[k] = { frames: c.frames, fps: c.fps, loop: !!c.loop, grid: c.grid, peak: c.peak };
			}
			for (const k of Object.keys(hatManifest.fx)) {
				const c = m.fx?.[k];
				if (c) hatManifest.fx[k] = { frames: c.frames, fps: c.fps, loop: !!c.loop, grid: c.grid, match_frame_range: c.match_frame_range, rotate_deg_per_s: c.rotate_deg_per_s };
			}
			hatManifest.loaded = true;
		})
		.catch(() => {
			/* defaults stand */
		});
};
