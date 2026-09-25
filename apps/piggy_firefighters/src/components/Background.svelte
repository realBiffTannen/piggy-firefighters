<script lang="ts">
	// THE WORLD BEHIND THE REELS (theme §4): Station 13 at dusk (base), the burning apartment block at night (Rescue
	// Spins), the same block under a red sky (Inferno Rescue). One plate per mood and orientation, cover-fitted to
	// the canvas; the mood is `stateScene.mood`, which the rescue director flips only while the bay-door shutter
	// covers the play area, so the swap is never seen.
	//
	// PLACEHOLDER plates (static/assets/placeholder/scene/bg_<mood>_<orient>.webp, 2048x1024 / 1080x1920). The art
	// lane replaces the files; a later scene lane may layer ambient life (Ember, the hydrant, the swinging bell) on
	// top of this plate without changing the mood contract.
	import { BaseSprite, Rectangle } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { sceneTex } from '../game/fx/sceneTextures.svelte';
	import { stateScene } from '../game/fx/stateScene.svelte';

	const context = getContext();
	const cs = $derived(context.stateLayoutDerived.canvasSizes());
	const portrait = $derived(cs.height > cs.width * 1.05);
	const key = $derived(`bg_${stateScene.mood}_${portrait ? 'portrait' : 'landscape'}`);
	/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
	const tex = $derived(((context.stateApp.loadedAssets as any)?.[key] ?? sceneTex(key)) as any);
	const fit = $derived.by(() => {
		if (!tex) return null;
		const k = Math.max(cs.width / Math.max(1, tex.width), cs.height / Math.max(1, tex.height));
		const w = tex.width * k;
		const h = tex.height * k;
		return { x: (cs.width - w) / 2, y: (cs.height - h) / 2, w, h };
	});
	const fallback = $derived(stateScene.mood === 'inferno' ? 0x3a0a0c : stateScene.mood === 'rescue' ? 0x0d1226 : 0x1e2a4a);
</script>

<Rectangle width={cs.width} height={cs.height} backgroundColor={fallback} zIndex={-3} />
{#if tex && fit}
	<BaseSprite texture={tex} x={fit.x} y={fit.y} width={fit.w} height={fit.h} zIndex={-2} />
{/if}
