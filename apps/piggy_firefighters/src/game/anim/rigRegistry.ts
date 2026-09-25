import { SvelteMap } from 'svelte/reactivity';
import type { Assets } from 'pixi-svelte';
import { RIG_DEFINITIONS, type RigName } from './rigLogic';
import { resolveRigAssetUrl } from './playbackControl';

// Vite's Object.keys(glob) transform emits path metadata ONLY: public assets stay
// in static/, with no JS imports, embedded JSON, duplicate atlas pages, or 404 probes.
const files = Object.keys(import.meta.glob('../../../../static/assets/spine/*/*.{json,atlas}'));
const here = import.meta.url;
export const rigSources = Object.fromEntries(Object.keys(RIG_DEFINITIONS).map(name => [name, {
  json: resolveRigAssetUrl('spine/' + name + '/' + name + '.json', here, import.meta.env.DEV),
  atlas: resolveRigAssetUrl('spine/' + name + '/' + name + '.atlas', here, import.meta.env.DEV),
}])) as Record<RigName, { json: string; atlas: string }>;

/** Spread into the game's pixi-svelte asset manifest. Absent exports add no requests. */
export const rigAssets: Assets = Object.fromEntries(Object.keys(RIG_DEFINITIONS)
  .filter(name => ['json','atlas'].every(ext => files.some(path => path.endsWith(`/${name}/${name}.${ext}`))))
  .map(name => [name, { type: 'spine', src: { skeleton: rigSources[name as RigName].json, atlas: rigSources[name as RigName].atlas } }]));

// Counts are reactive and per mounted actor. Five rescue actors share one rig;
// destroying one must not make the remaining four lose their fallback contract.
const mounted = new SvelteMap<RigName, number>();
export const rigRegistry = {
  has: (rig: RigName) => (mounted.get(rig) ?? 0) > 0,
};

/** Called only after the renderer has a validated skeleton and an active track. */
export function registerMountedRig(rig: RigName): () => void {
  mounted.set(rig, (mounted.get(rig) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const remaining = (mounted.get(rig) ?? 1) - 1;
    if (remaining > 0) mounted.set(rig, remaining);
    else mounted.delete(rig);
  };
}
