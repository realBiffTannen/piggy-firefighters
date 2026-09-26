/**
 * LAZY ASSETS — everything the base game does not draw from its first frame (perf sweep A1 / A2 / A5 / A6, 2026-09-25).
 *
 * The boot manifest (game/assets.ts) carries the base game only; the feature art, the feature rigs and the other
 * layout's symbol sheet arrive here, either warmed after the splash gate (components/Game.svelte warmAfterGate) or
 * awaited by the director at the moment a feature is booked, behind the bay-door shutter that already covers those
 * transitions (game/rescue/rescueDirector.ts).
 *
 *   ensureFeatureAssets(kind)   PIXI.Assets.load of every missing key of the set, mipmaps on, merged into
 *                               stateApp.loadedAssets[key] (so every `loadedAssets[key] ?? sceneTex(key)` read keeps
 *                               working, reactively), then GPU-uploaded a few per frame. Memoised: a second call is
 *                               free, and only ever adds what is still missing (an orientation change).
 *   loadRig(name)               the same for a Spine rig (pf_rookie rides with 'alarm', pf_rescued with 'rescue').
 *   ensureSymbolSet(set)        the other layout's symbol sheet, on the first layout flip (SymbolSprite).
 *   ensureSymbolPoses(set)      the win key frames (B, C) of a sheet, after boot (SymbolSprite; symbolMotion.ts).
 *   uploadTextureSources        the ONE budgeted uploader (<= 4 ms per animation frame, one shared queue); prewarm.ts
 *                               reuses it for the boot set.
 *
 * Nothing here can hang a round: a failed fetch is logged once and the promise still resolves (the components draw
 * their fallbacks: RescueScene's procedural slide, an EMPTY texture).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { PIXI, enableMipmaps, getProcessed } from 'pixi-svelte';

import sceneAssets, { LAZY_SETS, currentOrientation, type LazyKind, type SceneEntry } from './assetsScene';
import { symbolSetEntries, symbolPoseEntries, rigSrc, type SymbolSet } from './assets';
import type { RigName } from './anim/rigLogic';
import { stateApp } from './stateApp';
import { stateScene } from './fx/stateScene.svelte';

type Entry = Pick<SceneEntry, 'src' | 'resolution'>;

// ---- loadedAssets access ---------------------------------------------------------------------------------------------
const loaded = (): Record<string, any> | undefined => stateApp.loadedAssets as any;
const has = (key: string): boolean => loaded()?.[key] !== undefined;
/** In place, one key: only the reads of THAT key re-run (the loader's own passes merge whole objects). */
const merge = (key: string, value: any) => {
	if (value === undefined) return;
	const la = loaded();
	if (la) la[key] = value;
	else (stateApp as any).loadedAssets = { [key]: value };
};
const renderer = (): any => stateApp.pixiApplication?.renderer;

// ---- texture sources of anything in loadedAssets ---------------------------------------------------------------------
/**
 * Every GPU texture source reachable from a loaded asset: a Texture, a spritesheet (`textures` dict or the processed
 * Texture[]), a Pixi v8 BitmapFont (`pages[].texture`), a Spine TextureAtlas (`pages[].texture` is a SpineTexture
 * whose Pixi texture is one level deeper: `.texture`) and a Spine SkeletonData (its skins' attachment regions).
 */
export const textureSourcesOf = (asset: any, out: Set<any> = new Set()): Set<any> => {
	const seen = new Set<any>();
	const take = (t: any) => {
		if (!t || typeof t !== 'object' || seen.has(t)) return;
		seen.add(t);
		if (t.source && t.frame) out.add(t.source); // PIXI.Texture
		else if (t.texture?.source && t.texture?.frame) take(t.texture); // SpineTexture -> PIXI.Texture
		else if (Array.isArray(t)) t.forEach(take); // processed spriteSheet: Texture[]
		else if (t.textures) Object.values(t.textures).forEach(take); // spritesheet / sprites dict
		else if (t.pages) t.pages.forEach((p: any) => take(p?.texture?.texture ?? p?.texture)); // spine atlas / bitmap font
		else if (t.atlas?.pages) t.atlas.pages.forEach((p: any) => take(p?.texture?.texture ?? p?.texture));
		else if (t.pageTextures) Object.values(t.pageTextures).forEach(take); // v7-style bitmap font
		else if (Array.isArray(t.skins)) {
			// Spine SkeletonData: every region / mesh attachment points at its atlas page's texture
			for (const skin of t.skins)
				for (const slot of skin?.attachments ?? []) for (const att of Object.values(slot ?? {})) take((att as any)?.region?.texture);
		}
	};
	take(asset);
	return out;
};

// ---- the budgeted uploader -------------------------------------------------------------------------------------------
const UPLOAD_BUDGET_MS = 4;
const uploadedSources = new WeakSet<object>();
type Job = { source: any; done: () => void };
const uploadQueue: Job[] = [];
let pumping = false;
const pump = () => {
	if (pumping) return;
	pumping = true;
	const step = () => {
		const init = renderer()?.texture?.initSource?.bind(renderer().texture);
		const t0 = performance.now();
		// the budget is re-checked before EVERY upload: one 11 MB plate alone can exceed it, and then this frame is done
		while (uploadQueue.length && performance.now() - t0 < UPLOAD_BUDGET_MS) {
			const job = uploadQueue.shift()!;
			try {
				if (init && !uploadedSources.has(job.source)) {
					init(job.source);
					uploadedSources.add(job.source);
				}
			} catch {
				/* an upload that fails here simply happens later, on first draw */
			}
			job.done();
		}
		if (uploadQueue.length) requestAnimationFrame(step);
		else pumping = false;
	};
	requestAnimationFrame(step);
};

/**
 * Upload `sources` to the GPU a few per animation frame (<= 4 ms each). Resolves with the number uploaded by this
 * call. `front` puts the batch ahead of whatever is still queued (a feature entry behind the shutter beats an idle
 * warm-up). Never throws; without a renderer or requestAnimationFrame it resolves 0 at once.
 */
export const uploadTextureSources = (sources: Iterable<any>, { front = false } = {}): Promise<number> =>
	new Promise((resolve) => {
		const list = [...sources].filter((s) => s && typeof s === 'object' && !uploadedSources.has(s));
		if (!list.length || typeof requestAnimationFrame === 'undefined' || !renderer()?.texture?.initSource) return resolve(0);
		let left = list.length;
		let done = 0;
		const jobs: Job[] = list.map((source) => ({
			source,
			done: () => {
				done += uploadedSources.has(source) ? 1 : 0;
				left -= 1;
				if (left === 0) resolve(done);
			},
		}));
		if (front) uploadQueue.unshift(...jobs);
		else uploadQueue.push(...jobs);
		pump();
	});

// ---- key loading -----------------------------------------------------------------------------------------------------
const pendingKeys = new Map<string, Promise<any>>();
/** every value this module ever resolved: re-merged for free if a loader pass replaced `loadedAssets` meanwhile */
const resolvedValues = new Map<string, any>();
const failed = new Set<string>();

const loadEntry = async (key: string, entry: Entry): Promise<any> => {
	try {
		const tex = await PIXI.Assets.load(entry.resolution ? { src: entry.src, data: { resolution: entry.resolution } } : entry.src);
		enableMipmaps(tex, renderer());
		return tex;
	} catch (error) {
		if (!failed.has(key)) {
			failed.add(key);
			console.warn(`[lazyAssets] ${key} did not load`, error);
		}
		return undefined;
	}
};

/** Load (once) and merge the given keys from an entry table. Resolves when every key is in loadedAssets or has failed. */
const ensureKeys = async (keys: readonly string[], entries: Record<string, Entry | undefined>): Promise<void> => {
	const waits: Promise<any>[] = [];
	for (const key of keys) {
		if (has(key)) continue;
		const cached = resolvedValues.get(key);
		if (cached !== undefined) {
			merge(key, cached);
			continue;
		}
		let p = pendingKeys.get(key);
		if (!p) {
			const entry = entries[key];
			if (!entry) continue;
			p = loadEntry(key, entry).then((value) => {
				pendingKeys.delete(key);
				if (value !== undefined) {
					resolvedValues.set(key, value);
					merge(key, value);
				}
				return value;
			});
			pendingKeys.set(key, p);
		}
		waits.push(p);
	}
	await Promise.all(waits);
};

/** The GPU sources of the given loaded keys (only what is loaded). */
const sourcesOfKeys = (keys: readonly string[]): Set<any> => {
	const out = new Set<any>();
	const la = loaded();
	if (!la) return out;
	for (const key of keys) textureSourcesOf(la[key], out);
	return out;
};

// ---- rigs ------------------------------------------------------------------------------------------------------------
type LazyRig = Extract<RigName, 'pf_rookie' | 'pf_rescued'>;
const RIG_OF_SET: Partial<Record<LazyKind, LazyRig>> = { alarm: 'pf_rookie', rescue: 'pf_rescued' };
const pendingRigs = new Map<string, Promise<void>>();

/**
 * A feature rig after boot: skeleton JSON + the tier's LOD atlas (game/assets.ts rigSrc) through the same
 * PIXI.Assets.load + pixi-svelte getProcessed path the AssetsLoader uses, mipmaps on, then
 * `stateApp.loadedAssets[name] = SkeletonData`. RigActor / RigStage read that key reactively and mount the actor
 * when it lands; rigRegistry.has() (mounted-actor counts) is untouched, so a rig handle simply arrives later.
 */
export const loadRig = (name: LazyRig): Promise<void> => {
	if (has(name)) return Promise.resolve();
	const cached = resolvedValues.get(name);
	if (cached !== undefined) {
		merge(name, cached);
		return Promise.resolve();
	}
	let p = pendingRigs.get(name);
	if (p) return p;
	p = (async () => {
		try {
			const src = rigSrc(name);
			const raw = (await PIXI.Assets.load([src.skeleton, src.atlas])) as Record<string, any>;
			enableMipmaps(raw, renderer());
			const processed = getProcessed({ key: name, type: 'spine', rawAsset: raw as any, src }) as Record<string, any> | undefined;
			const data = processed?.[name];
			if (data) {
				resolvedValues.set(name, data);
				merge(name, data);
			}
		} catch (error) {
			if (!failed.has(name)) {
				failed.add(name);
				console.warn(`[lazyAssets] rig ${name} did not load`, error);
			}
		} finally {
			pendingRigs.delete(name);
		}
	})();
	pendingRigs.set(name, p);
	return p;
};

// ---- the public sets ---------------------------------------------------------------------------------------------------
const keysOf = (kind: LazyKind): string[] => LAZY_SETS[kind]({ orientation: currentOrientation(), mood: stateScene.mood });

/**
 * Make one lazy set resident: every key of `kind` (game/assetsScene.ts LAZY_SETS, resolved for the current
 * orientation / mood) plus its rig, loaded once, merged into stateApp.loadedAssets, and — unless `upload` is false —
 * uploaded to the GPU at <= 4 ms per frame. A set warmed with `upload: false` is decoded only; the director's call at
 * the feature entry (upload on, behind the shutter) finishes the job.
 */
export const ensureFeatureAssets = async (kind: LazyKind, { upload = true }: { upload?: boolean } = {}): Promise<void> => {
	const keys = keysOf(kind);
	const rig = RIG_OF_SET[kind];
	await Promise.all([ensureKeys(keys, sceneAssets as Record<string, SceneEntry>), rig ? loadRig(rig) : Promise.resolve()]);
	if (!upload) return;
	const sources = sourcesOfKeys(rig ? [...keys, rig] : keys);
	// a feature entry is waiting on this: jump the idle warm-up's queue
	await uploadTextureSources(sources, { front: true });
};

/** The other layout's symbol sheet (`sym_*` square / `symT_*` tall), on the first layout flip. */
export const ensureSymbolSet = async (set: SymbolSet): Promise<void> => {
	const entries = symbolSetEntries(set);
	const keys = Object.keys(entries);
	await ensureKeys(keys, entries);
	await uploadTextureSources(sourcesOfKeys(keys));
};

/** The win key frames of one sheet (SymbolSprite asks on mount; one request per sheet per session). Queued behind
 *  whatever the budgeted uploader already holds. */
const posesAsked = new Set<SymbolSet>();
export const ensureSymbolPoses = async (set: SymbolSet): Promise<void> => {
	if (posesAsked.has(set)) return;
	posesAsked.add(set);
	const entries = symbolPoseEntries(set);
	const keys = Object.keys(entries);
	await ensureKeys(keys, entries);
	await uploadTextureSources(sourcesOfKeys(keys));
};

/** Single scene keys through the same path (game/fx/sceneTextures.svelte.ts loadSceneTex / loadSceneTexMany). */
export const loadSceneKeys = async (keys: readonly string[], { upload = true }: { upload?: boolean } = {}): Promise<void> => {
	await ensureKeys(keys, sceneAssets as Record<string, SceneEntry>);
	if (upload) await uploadTextureSources(sourcesOfKeys(keys), { front: true });
};
