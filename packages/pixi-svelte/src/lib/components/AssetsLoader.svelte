<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as PIXI from 'pixi.js';

	import { getContextApp } from '../context.svelte';
	import { getProcessed } from '../assetLoad';
	import { enableMipmaps } from '../mipmaps';
	import type { LoadedAssets, RawAsset } from '../types';

	type Props = { children: Snippet };

	const props: Props = $props();
	const context = getContextApp();

	let preLoaded = $state(false);

	const assetNameList = $derived(
		context.stateApp.assets
			? Object.keys(context.stateApp.assets).filter(
					(key) => Boolean(context.stateApp.assets?.[key].preload) === false,
				)
			: [],
	);

	const preAssetNameList = $derived(
		context.stateApp.assets
			? Object.keys(context.stateApp.assets).filter(
					(key) => context.stateApp.assets?.[key].preload === true,
				)
			: [],
	);

	let counter = 0;

	const totalAssetCount = $derived(preAssetNameList.length + assetNameList.length);

	// Progress has to span BOTH load passes. It previously counted only the
	// post-preload pass (`if (preLoaded && ...)`), so the bar sat frozen at 0
	// through the preload pass — typically the heavier one, since that is where
	// backgrounds and audio live — and then jumped in coarse steps once it finally
	// started moving. Counting every asset against the combined total makes it
	// monotonic and roughly proportional to the wait.
	const onProgress = (value: number) => {
		if (value !== 1 || totalAssetCount === 0) return;
		counter = counter + 1;
		context.stateApp.loadingProgress = Math.min(100, (counter / totalAssetCount) * 100);
	};

	const loadAssets = async (nameList: string[]) => {
		const loadedAssetsArray = await Promise.all(
			nameList.map(async (key) => {
				try {
					const { type, src, resolution } = context.stateApp.assets![key];
					// a scaled-down variant (LOD) carries its logical size as the texture resolution (types.ts Asset)
					const loadSrc =
						type === 'spine'
							? Object.values(src).filter((item) => typeof item === 'string')
							: resolution && typeof src === 'string'
								? { src, data: { resolution } }
								: src;
					const rawAsset = await PIXI.Assets.load<RawAsset>(loadSrc, onProgress);
					enableMipmaps(rawAsset, context.stateApp.pixiApplication?.renderer);
					const processed = getProcessed({ key, rawAsset, type, src });
					return processed;
				} catch (error) {
					console.error(error);
				}
			}),
		);

		return loadedAssetsArray.reduce(
			(acc, cur) => ({
				...acc,
				...cur,
			}),
			{} as LoadedAssets,
		);
	};

	$effect(() => {
		if (!preLoaded) {
			(async () => {
				if (preAssetNameList.length > 0) {
					const preLoadedAssets = await loadAssets(preAssetNameList);
					// merge, never replace: an app-level lazy loader (the game's lazyAssets) may already have put keys here
					if (preLoadedAssets)
						context.stateApp.loadedAssets = {
							...context.stateApp.loadedAssets,
							...preLoadedAssets,
						};
				}
				preLoaded = true;
			})();
		}
	});

	$effect(() => {
		if (!context.stateApp.loaded && preLoaded) {
			(async () => {
				if (assetNameList.length > 0) {
					const postLoadedAssets = await loadAssets(assetNameList);
					if (postLoadedAssets)
						context.stateApp.loadedAssets = {
							...context.stateApp.loadedAssets,
							...postLoadedAssets,
						};
				}
				// An asset that throws never reports progress, so pin the bar to full
				// rather than letting it disappear part-filled.
				context.stateApp.loadingProgress = 100;
				context.stateApp.loaded = true;
			})();
		}
	});
</script>

{#if preLoaded}
	{@render props.children()}
{/if}
