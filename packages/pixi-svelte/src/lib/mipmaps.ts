/**
 * Mipmaps for loaded assets (shared by AssetsLoader at boot and by app-level lazy loaders after it).
 *
 * Reel symbols, sprite sheets and Spine atlas pages are authored larger than they are drawn (a 384 px symbol lands in
 * a ~150 px cell, smaller still on phones). Without mipmaps the GPU point/bilinear-samples a big texture into few
 * pixels, which shimmers and looks jagged in motion; trilinear mipmapping fixes that. Non-power-of-two mipmaps need
 * WebGL2 or WebGPU, so on a WebGL1 context only power-of-two textures are mipmapped (anything else would render black).
 */
import * as PIXI from 'pixi.js';

const isPowerOfTwo = (n: number) => n > 0 && (n & (n - 1)) === 0;

const canMipmapNpot = (renderer: unknown): boolean => {
	if (!renderer || typeof renderer !== 'object') return false;
	const gl = (renderer as { gl?: unknown }).gl;
	if (!('gl' in renderer) || !gl) return true; // WebGPU
	return typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
};

/**
 * Enable trilinear mipmaps on every texture source reachable from `rawAsset` (a Texture, a TextureSource, a
 * Spritesheet, a Spine TextureAtlas or a dict of those). `renderer` decides whether NPOT sources qualify.
 */
export const enableMipmaps = (rawAsset: unknown, renderer: unknown): void => {
	try {
		const seen = new Set<unknown>();
		let npotOk: boolean | undefined;
		const mipmapSource = (source: PIXI.TextureSource | undefined) => {
			if (!source || seen.has(source)) return;
			seen.add(source);
			const npot = !isPowerOfTwo(source.pixelWidth) || !isPowerOfTwo(source.pixelHeight);
			if (npot) {
				npotOk ??= canMipmapNpot(renderer);
				if (!npotOk) return;
			}
			source.autoGenerateMipmaps = true;
			source.scaleMode = 'linear';
			source.mipmapFilter = 'linear';
			source.updateMipmaps();
		};
		const visit = (value: unknown, depth: number) => {
			if (!value || typeof value !== 'object' || depth > 3) return;
			if (value instanceof PIXI.Texture) return mipmapSource(value.source);
			if (value instanceof PIXI.TextureSource) return mipmapSource(value);
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
