<script lang="ts">
	// THE WORLD BEHIND THE REELS (theme §4): Station 13 at dusk (base), the bay door blown open (Backdraft Spins), the
	// burning apartment block at night (Rescue Spins), the same block under a red sky (Inferno Rescue). One plate per
	// mood and orientation (the art lane's static/assets/environment/<mood>_{landscape,portrait}.webp), cover-fitted to
	// the canvas; the mood is `stateScene.mood`. The Rescue / Inferno moods are flipped by the rescue director only while
	// the bay-door shutter covers the play area, so that swap is never seen; the Backdraft Spins mood has no shutter and
	// cross-fades over the previous plate here (the old plate fades out over the new one).
	import { BaseSprite, Rectangle } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	import { getContext } from '../game/context';
	import { sceneTex } from '../game/fx/sceneTextures.svelte';
	import { ensureFeatureAssets } from '../game/lazyAssets';
	import { stateScene } from '../game/fx/stateScene.svelte';
	import { prefersReducedMotion } from '../game/fx/timing';

	const context = getContext();
	const cs = $derived(context.stateLayoutDerived.canvasSizes());
	const portrait = $derived(cs.height > cs.width * 1.05);
	/** the plate the scene asks for (mood x orientation; game/assetsScene.ts currentOrientation uses the same rule) */
	const wanted = $derived(`bg_${stateScene.mood}_${portrait ? 'portrait' : 'landscape'}`);
	/* eslint-disable @typescript-eslint/no-explicit-any */
	const texOf = (k: string) => ((context.stateApp.loadedAssets as any)?.[k] ?? sceneTex(k)) as any;
	const wantedTex = $derived(texOf(wanted));
	// The plate on screen: the wanted one once it is resident, else the last one that was. Only the boot orientation's
	// base plate ships with the boot manifest; every other plate is lazy (game/lazyAssets.ts 'bg' / 'rescue' /
	// 'backdraft'), so a key whose texture is not here yet keeps the previous plate up (no fade, no colour gap) until
	// it lands. The rescue director awaits its plates before it flips the mood, so a covered swap is still immediate.
	let key = $state<string | null>(null);
	const tex = $derived(key ? texOf(key) : undefined);
	const cover = (t: any) => {
		if (!t) return null;
		const k = Math.max(cs.width / Math.max(1, t.width), cs.height / Math.max(1, t.height));
		const w = t.width * k;
		const h = t.height * k;
		return { x: (cs.width - w) / 2, y: (cs.height - h) / 2, w, h };
	};
	const fit = $derived(cover(tex));

	// the plate on its way out: shown over the new one and faded (a covered swap has nothing to fade: the old plate
	// is dropped at once, so a mood set under the shutter never lingers)
	let oldKey = $state<string | null>(null);
	let shownKey: string | null = null;
	const fade = new Tween(0, { duration: 700, easing: cubicOut });
	$effect(() => {
		const next = wanted;
		if (!wantedTex) {
			// not resident yet: fetch it (memoised) once the boot pass is over, and keep drawing what is up
			if (context.stateApp.loaded) void ensureFeatureAssets('bg');
			return;
		}
		if (shownKey === null || next === shownKey) {
			shownKey = next;
			key = next;
			return;
		}
		const previous = shownKey;
		shownKey = next;
		key = next;
		if (stateScene.covered || prefersReducedMotion()) {
			oldKey = null;
			return;
		}
		oldKey = previous;
		fade.set(1, { duration: 0 });
		void fade.set(0).then(() => {
			if (shownKey === next) oldKey = null;
		});
	});
	const oldTex = $derived(oldKey ? texOf(oldKey) : null);
	const oldFit = $derived(cover(oldTex));
	const fallback = $derived(stateScene.mood === 'inferno' ? 0x3a0a0c : stateScene.mood === 'rescue' ? 0x0d1226 : 0x1e2a4a);
</script>

<!-- the mood colour stands in only until a plate is resident; under a cover-fitted plate it would be a wasted
     full-canvas fill every frame -->
{#if !tex || !fit}
	<Rectangle width={cs.width} height={cs.height} backgroundColor={fallback} zIndex={-3} />
{/if}
{#if tex && fit}
	<BaseSprite texture={tex} x={fit.x} y={fit.y} width={fit.w} height={fit.h} zIndex={-2} />
{/if}
{#if oldTex && oldFit && fade.current > 0.01}
	<BaseSprite texture={oldTex} x={oldFit.x} y={oldFit.y} width={oldFit.w} height={oldFit.h} alpha={fade.current} zIndex={-1} />
{/if}
