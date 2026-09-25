// Shared Playwright launcher for the pre-submission probes (same resolution rules as qa/smoke/port/smoke.mjs):
// PLAYWRIGHT_MODULE overrides the module, PLAYWRIGHT_BROWSERS_PATH the browser cache; the newest full Chromium in the
// cache drives when the module's pinned revision is absent. Every launch is muted.
import { createRequire } from 'node:module';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
process.env.PLAYWRIGHT_BROWSERS_PATH ??= existsSync('/opt/pw-browsers') ? '/opt/pw-browsers' : join(process.env.HOME ?? '', 'Library', 'Caches', 'ms-playwright');

export const resolvePlaywright = () => {
	for (const c of [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node22/lib/node_modules/playwright']) {
		if (!c) continue;
		try {
			return require(c);
		} catch {
			/* next */
		}
	}
	throw new Error('playwright not found (set PLAYWRIGHT_MODULE)');
};

export const executablePath = () => {
	const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
	const dirs = existsSync(root) ? readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.slice(9)) - Number(a.slice(9))) : [];
	for (const dir of dirs) {
		for (const rel of ['chrome-linux/chrome', 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
			const exe = join(root, dir, rel);
			if (existsSync(exe)) return exe;
		}
	}
	return undefined;
};

/** Launch full Chromium, always muted; `extraArgs` are appended (e.g. WebGPU flags). */
export const launch = async (extraArgs = []) => {
	const { chromium } = resolvePlaywright();
	const args = ['--mute-audio', '--autoplay-policy=no-user-gesture-required', ...extraArgs.filter((a) => a !== '--mute-audio')];
	try {
		return await chromium.launch({ channel: 'chromium', args });
	} catch (error) {
		const exe = executablePath();
		if (!exe) throw error;
		return chromium.launch({ executablePath: exe, args });
	}
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
