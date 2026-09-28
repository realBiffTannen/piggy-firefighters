/**
 * GPU pre-upload. Pixi uploads a texture the first time it is DRAWN, so the first gust, the first win, the first
 * rig clip — exactly the moments a player is watching closely — each paid a texture upload (and sometimes a shader
 * compile) on the frame they started: a visible hitch. Every source the boot manifest loaded is uploaded here instead,
 * a few per frame, while the splash is still up: the boot set first (font, symbols, coins, the reel frame, the base
 * plate), then whatever else is resident. The uploader is game/lazyAssets.ts's shared budgeted
 * queue (<= 4 ms per frame, re-checked before every upload), and the walker reaches Spine atlas pages
 * (`page.texture.texture`), a rig's SkeletonData regions and the Pixi v8 BitmapFont pages, which the first version
 * of this file missed (perf sweep A5).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { PIXI } from 'pixi-svelte';

import { stateApp } from './stateApp';
import { textureSourcesOf, uploadTextureSources } from './lazyAssets';

/** Boot-set order: what the first frames draw goes first (a later rank uploads later; unknown keys go last). */
const BOOT_RANK: readonly RegExp[] = [/^goldFont$/, /^sym_/, /^symT_/, /^coins$/, /^board_frame$/, /^cell_/, /^win_cell_frame$/, /^line_plate$/, /^bg_base_/, /^scene_shutter_/, /^wordmark_small$/, /^rung_fx_/];
const rank = (key: string) => {
	const i = BOOT_RANK.findIndex((re) => re.test(key));
	return i === -1 ? BOOT_RANK.length : i;
};

export const prewarmTextures = (pixiApplication: any, loadedAssets: Record<string, any>): Promise<number> => {
	if (!pixiApplication?.renderer?.texture?.initSource || typeof requestAnimationFrame === 'undefined') return Promise.resolve(0);
	const sources = new Set<any>();
	// bitmap fonts are not in loadedAssets (pixi-svelte getProcessed skips them); their pages sit in Pixi's asset cache
	const fonts = Object.entries((stateApp.assets ?? {}) as Record<string, { type: string; src: unknown }>)
		.filter(([, a]) => a.type === 'font' && typeof a.src === 'string')
		.map(([key, a]) => [key, PIXI.Assets.cache.has(a.src as string) ? PIXI.Assets.get(a.src as string) : undefined] as const);
	const items = [...fonts, ...Object.entries(loadedAssets ?? {})].sort((a, b) => rank(a[0]) - rank(b[0]));
	for (const [, asset] of items) textureSourcesOf(asset, sources);
	return uploadTextureSources(sources);
};
