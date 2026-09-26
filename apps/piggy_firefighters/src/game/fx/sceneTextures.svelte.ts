/**
 * Scene texture access: `stateApp.loadedAssets[key]`, reactively (a boot key is there from the AssetsLoader; a lazy
 * key lands when game/lazyAssets.ts merges it), and a lazy loader for any single key through that same
 * PIXI.Assets.load + merge path (no <img> -> canvas copy, no "Image element passed" warning), so the scene is never
 * blocked on the boot registry: components/scene/SceneShutter.svelte awaits its slats, bar and card art here.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { stateApp } from '../stateApp';
import { loadSceneKeys } from '../lazyAssets';

/** Reactive, synchronous: the texture or undefined (not loaded yet). */
export const sceneTex = (key: string): any => (stateApp.loadedAssets as any)?.[key];

/** The texture for `key`, fetched (and GPU-uploaded) if it is not resident yet; undefined for an unknown or failed key. */
export const loadSceneTex = async (key: string): Promise<any> => {
	const have = sceneTex(key);
	if (have) return have;
	if (typeof window === 'undefined') return undefined;
	await loadSceneKeys([key]);
	return sceneTex(key);
};

export const loadSceneTexMany = (keys: string[]) => Promise.all(keys.map(loadSceneTex));
