/**
 * pixi.js is not a direct dependency of this app (pnpm strict; it arrives through
 * pixi-svelte), so scene code cannot `import { Texture } from 'pixi.js'`. The few
 * classes the scene needs are taken from LIVE instances instead — same module
 * instance as the renderer, so `instanceof` and the texture GC keep working.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyTexture = any;

let TextureCls: any = null;
let RectCls: any = null;

/** Hand the kit any loaded texture once; idempotent. */
export const bindTexture = (t: AnyTexture) => {
	if (TextureCls || !t || !t.source || !t.frame) return;
	TextureCls = t.constructor;
	RectCls = t.frame.constructor;
};

export const kitReady = () => !!TextureCls;

/** A sub-rectangle of `tex` as its own texture (shares the GPU source). */
export const subTexture = (tex: AnyTexture, x: number, y: number, w: number, h: number): AnyTexture => {
	bindTexture(tex);
	const f = tex.frame;
	return new TextureCls({ source: tex.source, frame: new RectCls(f.x + x, f.y + y, w, h) });
};

/** Texture from a decoded <img> (fallback loader path). */
export const textureFromImage = (img: HTMLImageElement): AnyTexture | null =>
	TextureCls ? TextureCls.from(img, true) : null;

export const emptyTexture = (): AnyTexture | null => (TextureCls ? TextureCls.EMPTY : null);
