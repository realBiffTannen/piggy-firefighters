import { createApp } from 'pixi-svelte';

import assets from './assets';
import { rendererOptions } from './quality.svelte';

// Renderer options are fixed at Application.init, so the quality tier hands them over here, before the app mounts
// (game/quality.svelte.ts: DPR cap 2 / 1.5 / 1.25 by static tier, MSAA off on 'low'; 'high' is pixi-svelte's own default).
export const { stateApp } = createApp({ assets, rendererOptions: rendererOptions() });
