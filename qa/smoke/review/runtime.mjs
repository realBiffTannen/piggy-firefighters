#!/usr/bin/env node
/**
 * REVIEW (runtime lens) — Super Turbo, mid-Rescue reload and RESUME= seeded resume against the dev server + mock RGS.
 *   node qa/smoke/review/runtime.mjs super:<fixture> | reload:<fixture>:<eventIndex> | resume:<rgsHost>
 * GAME_URL (default http://127.0.0.1:3004/), RGS_HOST (default 127.0.0.1:3037). Muted full Chromium.
 */
import { createRequire } from 'node:module';
import { writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
let pw;
for (const c of [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node22/lib/node_modules/playwright']) {
	if (!c) continue;
	try { pw = require(c); break; } catch { /* next */ }
}
const { chromium } = pw;
const GAME = process.env.GAME_URL ?? 'http://127.0.0.1:3004/';
const RGS = process.env.RGS_HOST ?? '127.0.0.1:3037';
const ARGS = ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const launch = async () => {
	try { return await chromium.launch({ channel: 'chromium', args: ARGS }); } catch (e) {
		const root = process.env.PLAYWRIGHT_BROWSERS_PATH; const d = existsSync(root) ? readdirSync(root).find((x) => /^chromium-\d+$/.test(x)) : undefined;
		if (!d) throw e; return chromium.launch({ executablePath: join(root, d, 'chrome-linux', 'chrome'), args: ARGS });
	}
};
const hud = async (page) => page.evaluate(() => {
	const t = document.body.innerText.replace(/\s+/g, ' ');
	const bal = t.match(/BALANCE \$?([\d,]+\.\d\d)/); const win = t.match(/WIN \$?([\d,]+\.\d\d)/);
	return { balance: bal?.[1] ?? null, win: win?.[1] ?? null };
});
const attach = (page, log) => {
	page.on('console', (m) => {
		const where = m.location()?.url ?? '';
		if (m.type() === 'error' && /Failed to load resource/.test(m.text()) && /\/assets\/audio\//.test(where)) { log.audio404 += 1; return; }
		if (m.type() === 'error' || m.type() === 'warning') log.console.push(`${m.type()}: ${m.text().slice(0, 300)}${where ? ' @ ' + where : ''}`);
	});
	page.on('pageerror', (e) => log.console.push(`pageerror: ${String(e?.message ?? e).slice(0, 300)}`));
	page.on('request', (r) => {
		const u = r.url();
		if (/\/(wallet|bet)\//.test(u)) log.rgs.push(`${((Date.now() - log.t0) / 1000).toFixed(1)}s ${u.replace(/^https?:\/\/[^/]+/, '')} ${r.postData()?.slice(0, 120) ?? ''}`);
	});
};
const passSplash = async (page) => {
	await page.waitForSelector('.splash .press', { timeout: 180000 });
	// SPEED=super|turbo arms the tier BEFORE the gate opens, so a resumed round plays at that speed from its first event
	if (process.env.SPEED === 'super') log.speed = await page.evaluate(() => window.__qaSetSpeedForTest?.('super') ?? 'no-hook');
	else if (process.env.SPEED === 'turbo') log.speed = await page.evaluate(() => (window.__pffSetTurbo?.(true), 'turbo'));
	await sleep(400);
	await page.mouse.click(720, 450);
	await page.waitForFunction(() => document.documentElement.dataset.splashShutter === 'done', null, { timeout: 30000 });
};
const waitFinal = (page, ms = 900000) => page.waitForFunction(() => (window.__pffFinalWins ?? []).length > 0, null, { timeout: ms, polling: 250 });

const [kind, a1, a2] = (process.argv[2] ?? '').split(':');
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => { globalThis.__PFF_QA = true; });
const page = await ctx.newPage();
const log = { t0: Date.now(), console: [], rgs: [], audio404: 0, browser: `chromium ${browser.version()}` };
attach(page, log);
const session = `review-${kind}-${Date.now()}`;
const out = { kind, args: [a1, a2], session };
try {
	if (kind === 'super') {
		await page.goto(`${GAME}?sessionID=${session}&rgs_url=${RGS}&device=desktop&fixture=${a1}`, { waitUntil: 'domcontentloaded' });
		await passSplash(page); await sleep(1500);
		out.hudBefore = await hud(page);
		out.superArmed = await page.evaluate(() => window.__qaSetSpeedForTest?.('super') ?? 'no-hook');
		const t = Date.now();
		await page.keyboard.press('Space');
		await waitFinal(page);
		out.roundMs = Date.now() - t;
		out.finalWin = await page.evaluate(() => window.__pffFinalWins[0]);
		await sleep(2500);
		out.hudAfter = await hud(page);
		await page.screenshot({ path: join(HERE, `runtime_super_${a1}.png`) });
	} else if (kind === 'reload') {
		const url = `${GAME}?sessionID=${session}&rgs_url=${RGS}&device=desktop&fixture=${a1}`;
		await page.goto(url, { waitUntil: 'domcontentloaded' });
		await passSplash(page); await sleep(1500);
		out.hudBefore = await hud(page);
		await page.evaluate(() => window.__pffSetTurbo?.(true));
		await page.keyboard.press('Space');
		const target = Number(a2 ?? 20);
		// wait until the client has recorded a /bet/event at or past `target`
		const t = Date.now();
		while (Date.now() - t < 600000) {
			const last = log.rgs.filter((l) => l.includes('/bet/event')).at(-1);
			const idx = last ? Number((last.match(/"event":"?(\d+)/) ?? [])[1]) : -1;
			if (idx >= target) { out.reloadedAtEvent = idx; break; }
			if (await page.evaluate(() => (window.__pffFinalWins ?? []).length > 0)) { out.finishedBeforeReload = true; break; }
			await sleep(250);
		}
		await page.screenshot({ path: join(HERE, `runtime_reload_${a1}_before.png`) });
		log.rgs.push('---- RELOAD ----');
		await page.goto(`${GAME}?sessionID=${session}&rgs_url=${RGS}&device=desktop`, { waitUntil: 'domcontentloaded' });
		await passSplash(page);
		const t2 = Date.now();
		await sleep(6000);
		await page.screenshot({ path: join(HERE, `runtime_reload_${a1}_resumed.png`) });
		await waitFinal(page);
		out.resumeMs = Date.now() - t2;
		out.finalWin = await page.evaluate(() => window.__pffFinalWins[0]);
		await sleep(3000);
		out.hudAfter = await hud(page);
		await page.screenshot({ path: join(HERE, `runtime_reload_${a1}_after.png`) });
	} else if (kind === 'resume') {
		const rgs = a1 ?? '127.0.0.1:3038';
		await page.goto(`${GAME}?sessionID=${session}&rgs_url=${rgs}&device=desktop`, { waitUntil: 'domcontentloaded' });
		await passSplash(page);
		out.hudBefore = await hud(page);
		await page.evaluate(() => window.__pffSetTurbo?.(true));
		const t = Date.now();
		await sleep(8000);
		await page.screenshot({ path: join(HERE, `runtime_resume_mid.png`) });
		await waitFinal(page);
		out.resumeMs = Date.now() - t;
		out.finalWin = await page.evaluate(() => window.__pffFinalWins[0]);
		await sleep(3000);
		out.hudAfter = await hud(page);
		await page.screenshot({ path: join(HERE, `runtime_resume_after.png`) });
	}
} catch (e) {
	out.error = String(e?.message ?? e).split('\n')[0];
	try { await page.screenshot({ path: join(HERE, `runtime_${kind}_${a1}.FAILED.png`) }); } catch { /* */ }
}
out.log = log;
writeFileSync(join(HERE, `runtime_${kind}_${a1 ?? ''}.json`.replace(/[:]/g, '_')), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ ...out, log: { console: log.console.slice(0, 20), audio404: log.audio404, rgs: log.rgs.slice(-12) } }, null, 1));
await browser.close();
