// Static smoke of game/dist: real published books via the mock RGS (math/publish), desktop + phone.
import { createRequire } from 'node:module';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
process.env.PLAYWRIGHT_BROWSERS_PATH ??= existsSync('/opt/pw-browsers') ? '/opt/pw-browsers' : join(process.env.HOME ?? '', 'Library', 'Caches', 'ms-playwright');
let pw;
for (const c of [process.env.PLAYWRIGHT_MODULE, '/Users/jbull/code/piggy-firefighters/node_modules/playwright', 'playwright', '/opt/node22/lib/node_modules/playwright']) {
	if (!c) continue;
	try { pw = require(c); break; } catch { /* next */ }
}
if (!pw) throw new Error('playwright not found');
const { chromium } = pw;
const GAME = process.env.GAME_URL ?? 'http://127.0.0.1:3070/';
const RGS = process.env.RGS_HOST ?? '127.0.0.1:3071';
const OUT = process.env.OUT_DIR;
const ARGS = ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const browser = await chromium.launch({ channel: 'chromium', args: ARGS });
for (const [label, viewport, device] of [['desktop', { width: 1440, height: 900 }, 'desktop'], ['phone', { width: 390, height: 844 }, 'mobile']]) {
	const ctx = await browser.newContext({ viewport, deviceScaleFactor: label === 'phone' ? 2 : 1, isMobile: label === 'phone', hasTouch: label === 'phone' });
	const page = await ctx.newPage();
	const errors = [], pageErrors = [], failed = [];
	page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200)); });
	page.on('pageerror', (e) => pageErrors.push(String(e?.message ?? e).slice(0, 200)));
	page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url().replace(/^https?:\/\/[^/]+/, '')}`); });
	const r = { label, steps: [] };
	const shot = async (name) => { await page.screenshot({ path: join(OUT, `${label}_${name}.png`) }); r.steps.push(name); };
	try {
		await page.goto(`${GAME}?sessionID=smoke-${label}-${Date.now()}&rgs_url=${RGS}&device=${device}&lang=en&currency=USD`, { waitUntil: 'domcontentloaded' });
		await page.waitForSelector('.splash .press', { timeout: 180000 });
		await sleep(6000); // the publisher bumper plays over the splash first
		await shot('splash_card1');
		await page.mouse.click(viewport.width / 2, viewport.height / 2);
		await page.waitForFunction(() => document.documentElement.dataset.splashShutter === 'done', null, { timeout: 30000 });
		await sleep(2500);
		await shot('base_idle');
		// one real spin: Space, then wait for the round to settle (spin button enabled again)
		await page.keyboard.press('Space');
		await sleep(1500);
		await shot('spinning');
		await page.waitForFunction(() => {
			const b = document.querySelector('[data-testid="spin"], button.spin, .spin-button, button[aria-label*="pin" i]');
			return !b || !b.disabled;
		}, null, { timeout: 90000 }).catch(() => r.steps.push('spin-wait-timeout'));
		await sleep(2500);
		await shot('after_spin');
		// the feature sheet (GET BONUS) and the ante chooser
		const bonus = page.getByText(/GET BONUS|PLAY FEATURE/i).first();
		if (await bonus.count()) { await bonus.click({ timeout: 5000 }).catch(() => null); await sleep(1500); await shot('feature_sheet'); await page.keyboard.press('Escape'); await sleep(600); }
		const chip = page.locator('.ante-chip').first();
		if (await chip.count()) { await chip.click({ timeout: 5000 }).catch(() => null); await sleep(1200); await shot('ante_chooser'); await page.keyboard.press('Escape'); await sleep(500); }
	} catch (e) {
		r.error = String(e?.message ?? e).slice(0, 300);
		await page.screenshot({ path: join(OUT, `${label}_error.png`) }).catch(() => null);
	}
	r.console_errors = errors; r.page_errors = pageErrors; r.failed_requests = failed.slice(0, 20);
	results.push(r);
	await ctx.close();
}
await browser.close();
writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 1));
