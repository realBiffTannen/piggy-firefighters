<script lang="ts" module>
	import * as PIXI from 'pixi.js';

	import type { Sizes, OverwriteCursor } from '../types';

	export type Props = OverwriteCursor<PIXI.TextOptions> & {
		onresize?: (arg0: Sizes) => void;
	};
</script>

<script lang="ts">
	import { onMount } from 'svelte';

	import { propsSyncEffect } from '../utils.svelte';
	import { getContextParent, getContextApp } from '../context.svelte';

	const props: Props = $props();
	const parentContext = getContextParent();
	const text = new PIXI.Text({ text: props.text, style: props.style });

	propsSyncEffect({ props, target: text, ignore: ['onresize'] });

	$effect(() => {
		props?.text;
		props?.style;
		props.onresize?.({ width: text.width, height: text.height });
	});

	onMount(() => {
		props.onresize?.({ width: text.width, height: text.height });
	});

	// CRISP TEXT AT ANY SCALE. A PIXI.Text is rasterised once at `fontSize x resolution` and then drawn
	// through every ancestor's transform. This game lays out in design units and scales whole boards up
	// (board fit x main layout, about 1.5-2.5x on a desktop), so a label rasterised at its local size was
	// being MAGNIFIED on screen: soft edges, mushy outlines — QA's "this looks blurry". The fix is to
	// rasterise at the size it is actually shown: renderer resolution x on-screen scale. It only ever
	// goes UP (a pop animation that overshoots must not re-rasterise every frame), in 0.25 steps, and
	// the texture is capped so a huge headline cannot allocate an absurd canvas.
	const appContext = getContextApp();
	const MAX_TEXTURE_SIDE = 3072;
	let settled = 0;
	text.onRender = () => {
		const wt = text.worldTransform;
		const scale = Math.max(Math.hypot(wt.a, wt.b), Math.hypot(wt.c, wt.d));
		if (!(scale > 0)) return;
		const base = appContext.stateApp.pixiApplication?.renderer?.resolution ?? 1;
		let want = Math.ceil(base * Math.max(1, scale) * 4) / 4;
		const side = Math.max(text.width, text.height) / Math.max(scale, 0.0001); // local size
		if (side > 0) want = Math.min(want, Math.max(base, MAX_TEXTURE_SIDE / side));
		if (want > text.resolution + 0.2) {
			// let a scale-in animation finish before paying for a re-raster
			settled += 1;
			if (settled >= 4) {
				text.resolution = want;
				settled = 0;
			}
		} else settled = 0;
	};

	parentContext.addToParent(text);
</script>
