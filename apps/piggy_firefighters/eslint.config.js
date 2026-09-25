// @ts-nocheck — a node-run config file, not app code (svelte-check type-checks every .js with checkJs)
// ESLint 9 flat config for the game app. The donor's `.eslintrc.cjs` (extends `custom`, plugin `svelte3`) cannot load
// under ESLint 9 (no flat config, and eslint-plugin-svelte3 is not installed), so `pnpm lint` failed before linting a
// single file. This config uses the SAME plugins the workspace's `eslint-config-custom` package installs
// (@typescript-eslint 8, eslint-plugin-svelte 3), resolved from that package so nothing new is installed.
import { createRequire } from 'node:module';

const fromCustom = createRequire(new URL('../../packages/eslint-config-custom/package.json', import.meta.url));
const fromEslint = createRequire(createRequire(import.meta.url).resolve('eslint/package.json'));
const tsParser = fromCustom('@typescript-eslint/parser');
const tsPlugin = fromCustom('@typescript-eslint/eslint-plugin');
const svelteModule = fromCustom('eslint-plugin-svelte');
const sveltePlugin = svelteModule.default ?? svelteModule;
const svelteParser = createRequire(fromCustom.resolve('eslint-plugin-svelte'))('svelte-eslint-parser');
const js = fromEslint('@eslint/js');
const globals = {
	window: 'readonly', document: 'readonly', navigator: 'readonly', localStorage: 'readonly', sessionStorage: 'readonly',
	console: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
	requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly', performance: 'readonly', fetch: 'readonly',
	URL: 'readonly', URLSearchParams: 'readonly', Image: 'readonly', HTMLElement: 'readonly', HTMLCanvasElement: 'readonly',
	HTMLImageElement: 'readonly', KeyboardEvent: 'readonly', PointerEvent: 'readonly', MouseEvent: 'readonly', Event: 'readonly',
	ResizeObserver: 'readonly', AudioContext: 'readonly', BaseAudioContext: 'readonly', AudioBuffer: 'readonly', GainNode: 'readonly',
	AudioBufferSourceNode: 'readonly', AudioNode: 'readonly', OfflineAudioContext: 'readonly', globalThis: 'readonly', Response: 'readonly',
	getComputedStyle: 'readonly', matchMedia: 'readonly', DOMException: 'readonly', CustomEvent: 'readonly', EventTarget: 'readonly',
	TouchEvent: 'readonly', WheelEvent: 'readonly', FocusEvent: 'readonly', Node: 'readonly', Element: 'readonly', SVGElement: 'readonly',
	MutationObserver: 'readonly', IntersectionObserver: 'readonly', HTMLDivElement: 'readonly', HTMLButtonElement: 'readonly',
	structuredClone: 'readonly', queueMicrotask: 'readonly', atob: 'readonly', btoa: 'readonly', TextEncoder: 'readonly',
	TextDecoder: 'readonly', Blob: 'readonly', crypto: 'readonly', location: 'readonly', history: 'readonly', screen: 'readonly',
	FontFace: 'readonly', AbortController: 'readonly', PromiseRejectionEvent: 'readonly', ErrorEvent: 'readonly',
	visualViewport: 'readonly', devicePixelRatio: 'readonly', innerWidth: 'readonly', innerHeight: 'readonly',
};

const tsRules = {
	...tsPlugin.configs.recommended.rules,
	'no-undef': 'off', // TypeScript owns undefined names (svelte-check)
	'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
	'@typescript-eslint/no-unused-expressions': 'off',
};

export default [
	{ ignores: ['build/**', '.svelte-kit/**', 'node_modules/**', 'static/**', 'vendor/**'] },
	js.configs.recommended,
	...sveltePlugin.configs['flat/base'],
	{
		files: ['**/*.ts', '**/*.js'],
		languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: 'module', globals },
		plugins: { '@typescript-eslint': tsPlugin },
		rules: tsRules,
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts'],
		languageOptions: { parser: svelteParser, parserOptions: { parser: tsParser, extraFileExtensions: ['.svelte'] }, globals },
		plugins: { '@typescript-eslint': tsPlugin },
		rules: { ...tsRules, 'svelte/valid-compile': 'off' },
	},
];
