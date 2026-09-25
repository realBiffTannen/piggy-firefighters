/**
 * Scene texture access: prefers the app's AssetsLoader result
 * (`stateApp.loadedAssets[key]`, once game/assets.ts spreads assetsScene in) and
 * otherwise lazy-loads the same URL itself, so the scene is never blocked on the
 * asset registry. Reactive: `sceneTex()` re-derives when a fallback load lands.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import sceneAssets from '../assetsScene';
import { stateApp } from '../stateApp';
import { bindTexture, kitReady, textureFromImage } from './pixiKit';

const fallback = $state<Record<string, any>>({});
const pending = new Map<string, Promise<any>>();

const fromApp = (key: string): any => (stateApp.loadedAssets as any)?.[key];

const ensureKit = () => {
	if (kitReady()) return true;
	const la = stateApp.loadedAssets as any;
	for (const k of Object.keys(la ?? {})) {
		const t = la[k];
		if (t && t.source && t.frame) {
			bindTexture(t);
			return true;
		}
	}
	return false;
};

/** Reactive, synchronous: the texture or undefined (not loaded yet). */
export const sceneTex = (key: string): any => fromApp(key) ?? fallback[key];

export const loadSceneTex = (key: string): Promise<any> => {
	const have = fromApp(key) ?? fallback[key];
	if (have) return Promise.resolve(have);
	const hit = pending.get(key);
	if (hit) return hit;
	const entry = (sceneAssets as any)[key];
	if (!entry || typeof window === 'undefined') return Promise.resolve(undefined);
	const p = new Promise<any>((resolve) => {
		const img = new Image();
		img.decoding = 'async';
		img.onload = async () => {
			try {
				await img.decode?.();
			} catch {
				/* decode() can reject on some engines after onload; the image is still usable */
			}
			// the kit needs one live texture to learn the classes; wait for the app's
			const tryBind = (n: number) => {
				if (ensureKit()) {
					const tex = textureFromImage(img);
					if (tex) fallback[key] = tex;
					resolve(tex);
				} else if (n > 0) setTimeout(() => tryBind(n - 1), 250);
				else resolve(undefined);
			};
			tryBind(120);
		};
		img.onerror = () => resolve(undefined);
		img.src = entry.src;
	});
	pending.set(key, p);
	return p;
};

export const loadSceneTexMany = (keys: string[]) => Promise.all(keys.map(loadSceneTex));

/**
 * Warm everything the scene can need. Every scene entry is now part of game/assets.ts, so the app's
 * AssetsLoader preloads it behind the splash; warming BEFORE that finishes would fetch and decode
 * every image a second time through the <img> fallback (39 duplicate downloads, 39 Pixi
 * "Image element passed, converting to canvas" warnings). So wait for the loader, then fill only
 * what is genuinely missing.
 */
export const warmSceneTextures = async () => {
	const deadline = Date.now() + 30000;
	while (!(stateApp as any).loaded && Date.now() < deadline) {
		await new Promise((resolve) => setTimeout(resolve, 200));
	}
	return loadSceneTexMany(Object.keys(sceneAssets));
};
