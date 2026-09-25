<script lang="ts">
	import * as PIXI from 'pixi.js';
	import { onMount, onDestroy, type Snippet } from 'svelte';
	import { devicePixelRatio } from 'svelte/reactivity/window';

	import { getContextApp } from '../context.svelte';
	import { preloadFont } from '../utils.svelte';

	type Props = { children: Snippet };

	const props: Props = $props();
	const context = getContextApp();

	let wrap: HTMLDivElement;
	let initialised = $state(false);

	/**
	 * Renderer resolution = the device pixel ratio, clamped to [1, 2].
	 *
	 * Uncapped (the web-sdk default, `resolution: devicePixelRatio.current`), a
	 * 3x phone renders the board at NINE times its CSS pixel count - every render
	 * target, every filter pass, every readback - for sharpness no screen at that
	 * density can show. 2 is the ceiling a handheld can still distinguish and the
	 * value the rest of the industry ships; the floor of 1 keeps a zoomed-out
	 * desktop tab from going soft. Renderer options are fixed at
	 * `Application.init`, so the ratio is read once, here.
	 *
	 * This is a PERFORMANCE cap, not the fix for the WebGPU depth-stencil bug
	 * below: a clamped ratio is still fractional (1.25 stays 1.25), and the
	 * epsilon there comes from an IEEE round-trip, not from the ratio's digits.
	 */
	const MIN_RESOLUTION = 1;
	const MAX_RESOLUTION = 2;
	const clampResolution = (ratio: number | undefined) =>
		Math.min(MAX_RESOLUTION, Math.max(MIN_RESOLUTION, ratio ?? 1));

	/**
	 * Depth-stencil size guard (ported from piggy-christmas E81, 2026-08-30;
	 * COMMON-ISSUE-LEDGER "black board on WebGPU"). Belt-and-braces behind the
	 * `preference: 'webgl'` below - it makes the failure class unreachable even
	 * if a later change flips the backend back.
	 *
	 * Pixi 8.16's `RenderTarget.ensureDepthStencilTexture()` builds the
	 * depth-stencil texture through the `TextureSource` CONSTRUCTOR, which does
	 * `pixelWidth = width * resolution` with NO rounding - while the colour
	 * texture it has to match reached its size through `TextureSource.resize()`,
	 * which does `Math.round(width * resolution)`. At any resolution that is not
	 * exactly representable in binary (Windows display scaling: 110%, 125%, 150%
	 * ...) the unrounded product can land an epsilon ABOVE the integer the colour
	 * texture rounded to (measured 1419.0000000000002 against a canvas of 1419).
	 * `GpuTextureSystem._initSource` then puts that float into the
	 * `GPUTextureDescriptor` through a bare `Math.ceil`, so the epsilon becomes a
	 * whole extra pixel. The colour and depth-stencil attachments of the same
	 * render pass then disagree by one pixel, every `beginRenderPass` is
	 * rejected, and because Pixi batches a whole frame into ONE
	 * `GPUCommandEncoder` the entire frame is discarded: a black board under a
	 * perfectly healthy DOM HUD. That is the exact failure Stake's reviewer
	 * photographed. Still present in pixi.js 8.20.1; a version bump is not the fix.
	 *
	 * The fix is to give the depth-stencil texture the colour texture's own
	 * integer pixel size at the moment it is created. Every LATER size change
	 * goes through `RenderTarget.resize()` -> `TextureSource.resize()`, which
	 * rounds, so correcting the constructor once per render target is enough.
	 *
	 * Defensive by construction: if a future Pixi drops or renames the method the
	 * `typeof` check leaves the runtime untouched rather than throwing at boot.
	 */
	const installDepthStencilSizeGuard = () => {
		const proto = (PIXI as unknown as { RenderTarget?: { prototype: Record<string, unknown> } })
			.RenderTarget?.prototype;
		if (!proto || typeof proto.ensureDepthStencilTexture !== 'function') return;
		if ((proto as { __depthSizeGuard__?: boolean }).__depthSizeGuard__) return;
		(proto as { __depthSizeGuard__?: boolean }).__depthSizeGuard__ = true;

		const original = proto.ensureDepthStencilTexture as (this: unknown) => void;
		proto.ensureDepthStencilTexture = function guardedEnsureDepthStencilTexture(
			this: {
				pixelWidth: number;
				pixelHeight: number;
				depthStencilTexture?: {
					pixelWidth: number;
					pixelHeight: number;
					width: number;
					height: number;
					_resolution: number;
				};
			},
		) {
			const existed = !!this.depthStencilTexture;
			original.call(this);
			const source = this.depthStencilTexture;
			// Only the freshly-constructed one can be fractional; a texture that
			// already existed got here through the rounding resize path.
			if (existed || !source) return;
			if (source.pixelWidth === this.pixelWidth && source.pixelHeight === this.pixelHeight) return;
			source.pixelWidth = this.pixelWidth;
			source.pixelHeight = this.pixelHeight;
			source.width = source.pixelWidth / source._resolution;
			source.height = source.pixelHeight / source._resolution;
		};
	};

	const initialiseApplication = async () => {
		PIXI.Assets.reset();
		installDepthStencilSizeGuard();

		await preloadFont();
		context.stateApp.pixiApplication = new PIXI.Application<PIXI.Renderer<HTMLCanvasElement>>();
		await context.stateApp.pixiApplication.init({
			autoDensity: true,
			backgroundAlpha: 0,
			hello: true,
			multiView: false,
			antialias: true,
			clearBeforeRender: true,
			// RENDERER BACKEND - WebGL2, deliberately, not the web-sdk's inherited
			// `'webgpu'`. Two reasons, both measured on the piggy titles (E81):
			//  1. WebGPU shipped a BLACK BOARD to Stake's reviewer at a fractional
			//     devicePixelRatio (see `installDepthStencilSizeGuard` above).
			//     WebGL2 is structurally immune: its root render target IS the
			//     default framebuffer, so no depth-stencil texture is allocated
			//     and there is nothing to disagree with.
			//  2. WebGL2 is the backend every headless probe in this studio's
			//     gate fleet actually measures (headless Chromium exposes no
			//     WebGPU adapter). Asking for `'webgpu'` shipped players a
			//     backend nothing here had ever verified.
			preference: 'webgl',
			powerPreference: 'high-performance',
			resolution: clampResolution(devicePixelRatio.current),
			resizeTo: window,
		});

		wrap.appendChild(context.stateApp.pixiApplication.canvas);

		// to prevent that you can't scroll the page with touch on the canvas. https://github.com/pixijs/pixijs/issues/4824
		context.stateApp.pixiApplication.renderer.events.autoPreventDefault = false;
		context.stateApp.pixiApplication.renderer.canvas.style.touchAction = 'auto';
	};

	onMount(async () => {
		try {
			if (!initialised) await initialiseApplication();
			initialised = true;
		} catch (error) {
			console.error(error);
		}
	});

	onDestroy(() => {
		if (context.stateApp.pixiApplication) {
			context.stateApp.pixiApplication.destroy();
		}
	});
</script>

<div bind:this={wrap}>
	{#if initialised}
		{@render props.children()}
	{/if}
</div>
