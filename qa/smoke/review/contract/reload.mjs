#!/usr/bin/env node
/**
 * Mid-bonus RELOAD check (review lens: contract). Plays <fixture> in a fresh session, waits until the Rescue /
 * Backdraft Spins scene has played WAIT_SPINS reveals (the mock records the /bet/event cursor), then navigates the
 * same session again WITHOUT the fixture pin. The page must resume the open round (rewound to its bonus start) and
 * end on the booked finalWin with 0 console errors.
 *
 *   GAME_URL=http://127.0.0.1:3005/ RGS_HOST=127.0.0.1:3047 node qa/smoke/review/contract/reload.mjs rescue_buy
 */
import { createRequire } from 'node:module';
import { writeFileSync, readdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
let pw;
for (const c of [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node22/lib/node_modules/playwright']) {
	if (!c) continue;
	try {
		pw = require(c);
		break;
	} catch {
		/* next */
	}
}
const { chromium } = pw;
const GAME = process.env.GAME_URL ?? 'http://127.0.0.1:3005/';
const RGS = process.env.RGS_HOST ?? '127.0.0.1:3047';
const FIXTURE = process.argv[2] ?? 'rescue_buy';
const WAIT_SPINS = Number(process.env.WAIT_SPINS || 3);
const FIXTURES_DIR = process.env.FIXTURES_DIR ?? join(HERE, '..', '..', '..', '..', 'server', 'fixtures');
const expected = (() => {
	try {
		const index = JSON.parse(readFileSync(join(FIXTURES_DIR, 'index.json'), 'utf8'));
		const f = index.fixtures.find((x) => x.name === FIXTURE);
		return f?.payoutMultiplier ?? JSON.parse(readFileSync(join(FIXTURES_DIR, f.file), 'utf8')).payoutMultiplier;
	} catch {
		return null;
	}
})();
const ARGS = ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const exe = () => {
	const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
	const dir = existsSync(root) ? readdirSync(root).find((d) => /^chromium-\d+$/.test(d)) : undefined;
	return dir ? join(root, dir, 'chrome-linux', 'chrome') : undefined;
};
const browser = await chromium.launch({ channel: 'chromium', args: ARGS }).catch(() => chromium.launch({ executablePath: exe(), args: ARGS }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => {
	globalThis.__PFF_QA = true;
});
await context.routeWebSocket(/\?token=/, (ws) => ws.onMessage(() => {}));
const page = await context.newPage();
const errors = [];
const requests = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 300)));
page.on('pageerror', (e) => errors.push(`pageerror: ${String(e?.message ?? e).slice(0, 300)}`));
page.on('request', (r) => {
	const u = r.url();
	if (/\/(bet\/event|wallet\/(authenticate|play|end-round))/.test(u)) requests.push({ url: u.replace(/^https?:\/\/[^/]+/, ''), body: r.postData()?.slice(0, 200) ?? null });
});
const session = `reload-${FIXTURE}-${Date.now()}`;
const out = { fixture: FIXTURE, expected, session, errors, requests };
const splash = async () => {
	await page.waitForSelector('.splash .press', { timeout: 120000 });
	await sleep(400);
	await page.mouse.click(720, 450);
	await page.waitForFunction(() => document.documentElement.dataset.splashShutter === 'done', null, { timeout: 30000 });
};
try {
	await page.goto(`${GAME}?sessionID=${session}&rgs_url=${RGS}&device=desktop&fixture=${FIXTURE}`, { waitUntil: 'domcontentloaded' });
	await splash();
	await page.evaluate(() => window.__qaSetSpeedForTest?.('turbo'));
	await sleep(1500);
	await page.keyboard.press('Space');
	// wait until the mock has recorded WAIT_SPINS bonus reveals
	const t0 = Date.now();
	while (Date.now() - t0 < 600000) {
		const n = requests.filter((r) => r.url.includes('/bet/event')).length;
		if (n >= WAIT_SPINS) break;
		await sleep(500);
	}
	out.eventsBeforeReload = requests.filter((r) => r.url.includes('/bet/event')).map((r) => r.body);
	await page.screenshot({ path: join(HERE, `reload_${FIXTURE}.before.png`) });
	out.finalWinsBeforeReload = await page.evaluate(() => window.__pffFinalWins ?? []);
	// RELOAD the same session without the fixture pin
	await page.goto(`${GAME}?sessionID=${session}&rgs_url=${RGS}&device=desktop`, { waitUntil: 'domcontentloaded' });
	await splash();
	await page.evaluate(() => window.__qaSetSpeedForTest?.('turbo'));
	await sleep(4000);
	await page.screenshot({ path: join(HERE, `reload_${FIXTURE}.resumed.png`) });
	await page.waitForFunction(() => (window.__pffFinalWins ?? []).length > 0, null, { timeout: 900000, polling: 250 });
	out.finalWin = await page.evaluate(() => window.__pffFinalWins[0]);
	await sleep(2500);
	out.win = await page.evaluate(() => document.querySelector('#win')?.textContent?.trim());
	out.balance = await page.evaluate(() => document.querySelector('#balance')?.textContent?.trim());
	await page.screenshot({ path: join(HERE, `reload_${FIXTURE}.end.png`) });
	out.passed = out.finalWin === expected && errors.length === 0;
} catch (e) {
	out.driver = String(e?.message ?? e).split('\n')[0];
	await page.screenshot({ path: join(HERE, `reload_${FIXTURE}.FAILED.png`) }).catch(() => {});
}
out.browser = `chromium ${browser.version()}`;
await browser.close();
writeFileSync(join(HERE, `reload_${FIXTURE}.json`), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ fixture: FIXTURE, expected, finalWin: out.finalWin, win: out.win, errors: errors.length, driver: out.driver, passed: out.passed }));
