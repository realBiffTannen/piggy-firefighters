/**
 * GPU pre-upload. Pixi uploads a texture the first time it is DRAWN, so the first gust, the first win
 * rung, the first bonus — exactly the moments a player is watching closely — each paid a texture
 * upload (and sometimes a shader compile) on the frame they started: a visible hitch. Every loaded
 * texture source is uploaded here instead, a few per frame, while the splash is still up.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const prewarmTextures = (pixiApplication: any, loadedAssets: Record<string, any>): Promise<number> =>
	new Promise((resolve) => {
		const renderer = pixiApplication?.renderer;
		const init = renderer?.texture?.initSource?.bind(renderer.texture);
		if (!init || typeof requestAnimationFrame === 'undefined') return resolve(0);
		const sources = new Set<any>();
		const take = (t: any) => {
			if (!t) return;
			if (t.source && t.frame) sources.add(t.source);
			else if (t.textures) Object.values(t.textures).forEach(take); // spritesheet
			else if (t.pages) t.pages.forEach((p: any) => take(p.texture)); // spine atlas
			else if (t.atlas?.pages) t.atlas.pages.forEach((p: any) => take(p.texture));
			else if (t.pageTextures) Object.values(t.pageTextures).forEach(take); // bitmap font
		};
		Object.values(loadedAssets ?? {}).forEach(take);
		const queue = [...sources];
		let done = 0;
		const step = () => {
			const t0 = performance.now();
			// stay well inside a frame: stop after ~4 ms of uploads
			while (queue.length && performance.now() - t0 < 4) {
				try {
					init(queue.shift());
					done += 1;
				} catch {
					/* an upload that fails here simply happens later, on first draw */
				}
			}
			if (queue.length) requestAnimationFrame(step);
			else resolve(done);
		};
		requestAnimationFrame(step);
	});
