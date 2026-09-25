/**
 * MOTION-BLUR ATLAS — baked ONCE, the first time the board mounts (behind the splash shutter).
 *
 * Every reel symbol gets two vertically smeared copies (REEL_BLUR.lengths, in symbols) drawn into a
 * single canvas atlas with plain 2D `drawImage` accumulation: three box passes, i.e. a bell-shaped
 * kernel, which is what a moving object actually looks like through a shutter. The atlas is uploaded
 * to the GPU here as well, so while a reel moves nothing is filtered, created or uploaded: the strip
 * only swaps which already-resident texture a pooled sprite points at and cross-fades two sprites.
 *
 * If a symbol's pixels cannot be read back (no 2D canvas, an exotic texture resource) the atlas is
 * simply absent and the strips stream the sharp art with velocity stretch alone.
 */
import { PIXI } from 'pixi-svelte';

import { REEL_BLUR, SYMBOL_INFO_MAP } from '../constants';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type BlurSet = {
	/** level 0 / 1 textures per symbol name */
	textures: Record<string, [PIXI.Texture, PIXI.Texture]>;
	/** atlas cell height / width: a blurred sprite is this much taller than it is wide */
	aspect: number;
};

const CELL_W = 192; // half the 384 px source: a smear never needs the full resolution
const PASSES = 3; // three box passes: a smooth bell, no visible taps
const TAPS = 13;

let built: BlurSet | null | undefined;

const symbolNames = Object.keys(SYMBOL_INFO_MAP) as (keyof typeof SYMBOL_INFO_MAP)[];

export const getBlurSet = (): BlurSet | null => built ?? null;

export const ensureBlurAtlas = (pixiApplication: any, loadedAssets: Record<string, any> | undefined): BlurSet | null => {
	if (built !== undefined) return built;
	built = null;
	try {
		if (typeof document === 'undefined' || !loadedAssets) return built;
		const levels = REEL_BLUR.lengths;
		// the longest smear, for the smallest on-board symbol ratio, decides the cell height
		const minRatio = Math.min(...symbolNames.map((n) => SYMBOL_INFO_MAP[n].static.sizeRatios.height));
		const maxSmear = Math.ceil((Math.max(...levels) * CELL_W) / minRatio);
		const CELL_H = CELL_W + maxSmear + 8;
		const cols = 5;
		const rows = Math.ceil((symbolNames.length * levels.length) / cols);

		const atlas = document.createElement('canvas');
		atlas.width = cols * CELL_W;
		atlas.height = rows * CELL_H;
		const actx = atlas.getContext('2d');
		const a = document.createElement('canvas');
		const b = document.createElement('canvas');
		a.width = b.width = CELL_W;
		a.height = b.height = CELL_H;
		const ca = a.getContext('2d');
		const cb = b.getContext('2d');
		if (!actx || !ca || !cb) return built;

		const cells: { name: string; level: number; x: number; y: number }[] = [];
		let cell = 0;
		for (const name of symbolNames) {
			const info = SYMBOL_INFO_MAP[name].static;
			const tex = loadedAssets[info.assetKey] as PIXI.Texture | undefined;
			const image = tex?.source?.resource as CanvasImageSource | undefined;
			if (!tex || !image) return built;
			const f = tex.frame;
			for (let level = 0; level < levels.length; level += 1) {
				// smear length in atlas px: `lengths` are in board symbols, the art fills `ratio` of one
				const smear = (levels[level] * CELL_W) / info.sizeRatios.height;
				const box = smear / PASSES;
				// sharp copy, centred
				ca.globalCompositeOperation = 'source-over';
				ca.globalAlpha = 1;
				ca.clearRect(0, 0, CELL_W, CELL_H);
				ca.drawImage(image, f.x, f.y, f.width, f.height, 0, (CELL_H - CELL_W) / 2, CELL_W, CELL_W);
				let src = a;
				let dst = b;
				let dctx = cb;
				for (let pass = 0; pass < PASSES; pass += 1) {
					dctx.globalCompositeOperation = 'source-over';
					dctx.globalAlpha = 1;
					dctx.clearRect(0, 0, CELL_W, CELL_H);
					dctx.globalCompositeOperation = 'lighter';
					dctx.globalAlpha = 1 / TAPS;
					for (let k = 0; k < TAPS; k += 1) dctx.drawImage(src, 0, (k / (TAPS - 1) - 0.5) * box);
					const swap = src;
					src = dst;
					dst = swap;
					dctx = dctx === cb ? ca : cb;
				}
				const x = (cell % cols) * CELL_W;
				const y = Math.floor(cell / cols) * CELL_H;
				actx.drawImage(src, x, y);
				cells.push({ name, level, x, y });
				cell += 1;
			}
		}

		const base = PIXI.Texture.from(atlas);
		const textures: BlurSet['textures'] = {};
		for (const c of cells) {
			const t = new PIXI.Texture({ source: base.source, frame: new PIXI.Rectangle(c.x, c.y, CELL_W, CELL_H) });
			(textures[c.name] ??= [t, t])[c.level] = t;
		}
		// resident on the GPU before the first spin can ask for it
		try {
			pixiApplication?.renderer?.texture?.initSource?.(base.source);
		} catch {
			/* it uploads on first draw instead */
		}
		built = { textures, aspect: CELL_H / CELL_W };
	} catch {
		built = null;
	}
	return built;
};
