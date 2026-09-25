// @ts-ignore
import config from 'config-vite';

const viteConfig = config();

// The studio HUD ships as a file: tarball (vendor/crashgalaxy-hud-1.0.3-ppec8b63d9.tgz), so
// it lands in node_modules and Vite's dep optimizer tries to prebundle it AND
// crawl its `import 'state-shared'` — but state-shared is a workspace package of
// Svelte-5 rune modules (`*.svelte.ts`) that esbuild's optimizer cannot parse
// ("Unexpected token" on `$state`). Excluding the HUD (and state-shared) from
// optimizeDeps keeps them as source the svelte plugin compiles, and makes the
// HUD's `state-shared` resolve to THIS repo's packages/state-shared — the same
// instance the game writes to, so balance / bet-mode state actually syncs.
viteConfig.optimizeDeps = {
	...(viteConfig.optimizeDeps ?? {}),
	exclude: [...(viteConfig.optimizeDeps?.exclude ?? []), '@crashgalaxy/hud', 'state-shared'],
};

// Never inline fonts as data: urls. Stake's CSP refuses data: fonts, so an inlined face (the HUD's
// Lilita One was being inlined from its stylesheet) silently falls back to the next family.
viteConfig.build = {
	...(viteConfig.build ?? {}),
	/** @param {string} filePath */
	assetsInlineLimit: (filePath) => (/\.(ttf|otf|woff2?)$/i.test(filePath) ? false : undefined),
};

// A production build (tools/build_dist.sh) rewrites build/ and .svelte-kit/generated in this directory; a running
// dev server must not full-reload mid-round because of it (a smoke run lost its round that way).
viteConfig.server = {
	...(viteConfig.server ?? {}),
	watch: {
		...(viteConfig.server?.watch ?? {}),
		ignored: [...[viteConfig.server?.watch?.ignored ?? []].flat(), '**/build/**', '**/.svelte-kit/output/**'],
	},
};

export default viteConfig;
