import * as PIXI from 'pixi.js';

import type { LoadedAssets, Assets, RendererOptions } from './types';

export function createApp({ assets, rendererOptions }: { assets: Assets; rendererOptions?: RendererOptions }) {
	const reset = () => {
		stateApp.loaded = false;
		stateApp.loadingProgress = 0;
		stateApp.loadedAssets = {};
		stateApp.pixiApplication = undefined as PIXI.Application | undefined;
	};

	const stateApp = $state({
		reset,
		assets,
		/** Application.init overrides the game chose before init (quality tier): see InitialiseApplication. */
		rendererOptions: rendererOptions ?? ({} as RendererOptions),
		loaded: false,
		loadingProgress: 0,
		loadedAssets: {} as LoadedAssets,
		pixiApplication: undefined as PIXI.Application | undefined,
	});

	return {
		stateApp,
	};
}

export type App = ReturnType<typeof createApp>;
