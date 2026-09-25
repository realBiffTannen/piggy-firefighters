<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as PIXI from 'pixi.js';

	import { getContextApp } from '../context.svelte';
	import { getProcessed } from '../assetLoad';
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

	// Mipmaps: reel symbols, sprite sheets and Spine atlas pages are authored larger than they are drawn
	// (a 384 px symbol lands in a ~150 px cell, smaller still on phones). Without mipmaps the GPU
	// point/bilinear-samples a big texture into few pixels, which shimmers and looks jagged in motion.
	// Trilinear mipmapping fixes that. Non-power-of-two mipmaps need WebGL2 or WebGPU, so on a WebGL1
	// context only power-of-two textures are mipmapped (anything else would render black there).
	const isPowerOfTwo = (n: number) => n > 0 && (n & (n - 1)) === 0;
	const canMipmapNpot = () => {
		const renderer = context.stateApp.pixiApplication?.renderer as { gl?: unknown } | undefined;
		if (!renderer) return false;
		if (!('gl' in renderer) || !renderer.gl) return true; // WebGPU
		return typeof WebGL2RenderingContext !== 'undefined' && renderer.gl instanceof WebGL2RenderingContext;
	};
	const mipmapSource = (source: PIXI.TextureSource | undefined, seen: Set<unknown>) => {
		if (!source || seen.has(source)) return;
		seen.add(source);
		const npot = !isPowerOfTwo(source.pixelWidth) || !isPowerOfTwo(source.pixelHeight);
		if (npot && !canMipmapNpot()) return;
		source.autoGenerateMipmaps = true;
		source.scaleMode = 'linear';
		source.mipmapFilter = 'linear';
		source.updateMipmaps();
	};
	const enableMipmaps = (rawAsset: unknown) => {
		try {
			const seen = new Set<unknown>();
			const visit = (value: unknown, depth: number) => {
				if (!value || typeof value !== 'object' || depth > 3) return;
				if (value instanceof PIXI.Texture) return mipmapSource(value.source, seen);
				if (value instanceof PIXI.TextureSource) return mipmapSource(value, seen);
				const record = value as Record<string, unknown>;
				// Spritesheet -> textures; Spine TextureAtlas -> pages[].texture.texture; plain dict of assets.
				for (const k of ['textures', 'pages', 'texture', 'textureSource']) {
					const child = record[k];
					if (Array.isArray(child)) child.forEach((c) => visit(c, depth + 1));
					else if (child && typeof child === 'object') {
						if (child instanceof PIXI.Texture || child instanceof PIXI.TextureSource) visit(child, depth + 1);
						else Object.values(child as Record<string, unknown>).forEach((c) => visit(c, depth + 1));
						visit(child, depth + 1);
					}
				}
				if (Array.isArray(value)) value.forEach((c) => visit(c, depth + 1));
				else if (!(['textures', 'pages', 'texture'] as string[]).some((k) => k in record))
					Object.values(record).forEach((c) => visit(c, depth + 1));
			};
			visit(rawAsset, 0);
		} catch (error) {
			console.warn('mipmaps not enabled for an asset', error);
		}
	};

	const loadAssets = async (nameList: string[]) => {
		const loadedAssetsArray = await Promise.all(
			nameList.map(async (key) => {
				try {
					const { type, src } = context.stateApp.assets![key];
					const loadSrc =
						type === 'spine' ? Object.values(src).filter((item) => typeof item === 'string') : src;
					const rawAsset = await PIXI.Assets.load<RawAsset>(loadSrc, onProgress);
					enableMipmaps(rawAsset);
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
					if (preLoadedAssets) context.stateApp.loadedAssets = preLoadedAssets;
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
