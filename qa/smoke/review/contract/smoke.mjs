#!/usr/bin/env node
/**
 * PIGGY FIREFIGHTERS — adversarial review smoke (lens: contract). Adapted from qa/smoke/port/smoke.mjs.
 *
 *   PORT=3047 BOOKS_DIR=none node server/mock-rgs.mjs &
 *   (cd apps/piggy_firefighters && npx vite dev --host --port 3005) &
 *   GAME_URL=http://127.0.0.1:3005/ RGS_HOST=127.0.0.1:3047 node qa/smoke/review/contract/smoke.mjs base_trigger_rescue@turbo rescue_buy@super
 *
 * Differences from the port smoke:
 *  - `<fixture>@<speed>` picks off / turbo / super (super via the __PFF_QA seam `__qaSetSpeedForTest('super')`).
 *  - `RESUME_RUN=1`: no Space press; the mock (started with RESUME=<fixture>) seeds an unfinished round, the page must
 *    resume and finish it on its own.
 *  - The game's event emitter is instrumented from the page (Vite dev serves the same module instance at
 *    /src/game/eventEmitter.ts), so every winRungs / winUpdate / shutterClose card / linePop is logged with its level,
 *    scale and amount; the HUD `#win` and `#balance` readouts are sampled at finalWin and after the settle.
 *  - Mid-round captures every CAPTURE_EVERY_MS (default 0 = off) as <name>.<n>.png.
 * Output: qa/smoke/review/contract/<name>.png + results.json. Browser always muted.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const resolvePlaywright = () => {
	for (const candidate of [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node22/lib/node_modules/playwright']) {
		if (!candidate) continue;
		try {
			return require(candidate);
		} catch {
			/* next */
		}
	}
	throw new Error('playwright not found (set PLAYWRIGHT_MODULE)');
};
const { chromium } = resolvePlaywright();

const GAME = process.env.GAME_URL ?? 'http://127.0.0.1:3005/';
const RGS = process.env.RGS_HOST ?? '127.0.0.1:3047';
const RESUME_RUN = process.env.RESUME_RUN === '1';
const CAPTURE_EVERY_MS = Number(process.env.CAPTURE_EVERY_MS || 0);
const FIXTURES_DIR = process.env.FIXTURES_DIR ?? join(HERE, '..', '..', '..', '..', 'server', 'fixtures');
const RUNS = process.argv.slice(2).length ? process.argv.slice(2) : ['base_trigger_rescue@turbo'];

const executablePath = () => {
	const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
	const dir = existsSync(root) ? readdirSync(root).find((d) => /^chromium-\d+$/.test(d)) : undefined;
	return dir ? join(root, dir, 'chrome-linux', 'chrome') : undefined;
};

const ARGS = ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const launch = async () => {
	try {
		return await chromium.launch({ channel: 'chromium', args: ARGS });
	} catch (error) {
		const exe = executablePath();
		if (!exe) throw error;
		return chromium.launch({ executablePath: exe, args: ARGS });
	}
};

const EXPECTED = (() => {
	try {
		const index = JSON.parse(readFileSync(join(FIXTURES_DIR, 'index.json'), 'utf8'));
		return Object.fromEntries(
			index.fixtures.map((f) => {
				let payout = f.payoutMultiplier ?? null;
				if (payout === null) {
					try {
						payout = JSON.parse(readFileSync(join(FIXTURES_DIR, f.file), 'utf8')).payoutMultiplier ?? null;
					} catch {
						/* unknown */
					}
				}
				return [f.name, payout];
			}),
		);
	} catch {
		return {};
	}
})();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const INSTRUMENT = async () => {
	const w = window;
	if (w.__rvLog) return true;
	w.__rvLog = [];
	const t0 = performance.now();
	const m = await import('/src/game/eventEmitter.ts');
	const em = m.eventEmitter;
	const keep = new Set(['winRungs', 'winShow', 'winUpdate', 'winHide', 'shutterClose', 'shutterOpen', 'linePop', 'paylineShow', 'paylinesAll', 'backdraftFx', 'alarmCallShow', 'uiHide', 'uiShow']);
	const rec = (e) => {
		if (!keep.has(e.type)) return;
		const entry = { t: Math.round(performance.now() - t0), type: e.type };
		for (const k of ['level', 'scale', 'amount', 'lineIndex', 'multiplier', 'outcome']) if (e[k] !== undefined) entry[k] = e[k];
		if (e.winLevelData) entry.winLevel = e.winLevelData.level;
		if (e.card) entry.card = { kind: e.card.kind, title: e.card.title, value: e.card.value, subtitle: e.card.subtitle };
		w.__rvLog.push(entry);
	};
	const b = em.broadcast.bind(em);
	const ba = em.broadcastAsync.bind(em);
	em.broadcast = (e) => {
		rec(e);
		return b(e);
	};
	em.broadcastAsync = (e) => {
		rec(e);
		return ba(e);
	};
	try {
		const r = await import('/src/game/rescue/stateRescue.svelte.ts');
		w.__rvRescue = r;
	} catch {
		/* optional */
	}
	return true;
};

const readouts = (page) =>
	page.evaluate(() => ({
		win: document.querySelector('#win')?.textContent?.trim() ?? null,
		balance: document.querySelector('#balance')?.textContent?.trim() ?? null,
		featureSpins: document.querySelector('#feature-spins')?.textContent?.trim() ?? null,
		rescueTotal: window.__rvRescue?.stateRescue?.total ?? null,
		rescueActive: window.__rvRescue?.stateRescue?.active ?? null,
	}));

const runOne = async (browser, spec) => {
	const [fixture, speed = 'off'] = spec.split('@');
	const name = `${RESUME_RUN ? 'resume_' : ''}${fixture}@${speed}`;
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
	await context.addInitScript(() => {
		globalThis.__PFF_QA = true;
	});
	const page = await context.newPage();
	const errors = [];
	page.on('console', (msg) => {
		if (msg.type() === 'error') errors.push(msg.text().slice(0, 400));
	});
	page.on('pageerror', (err) => errors.push(`pageerror: ${String(err?.message ?? err).slice(0, 400)}`));
	const failed = [];
	page.on('response', (r) => {
		if (r.status() >= 400) failed.push(`${r.status()} ${r.url().replace(/^https?:\/\/[^/]+/, '')}`);
	});
	page.on('requestfailed', (r) => failed.push(`FAILED ${r.url().replace(/^https?:\/\/[^/]+/, '')} ${r.failure()?.errorText ?? ''}`));
	const url = RESUME_RUN
		? `${GAME}?sessionID=resume-${fixture}-${Date.now()}&rgs_url=${RGS}&device=desktop`
		: `${GAME}?sessionID=rv-${fixture}-${Date.now()}&rgs_url=${RGS}&device=desktop&fixture=${fixture}`;
	const t0 = Date.now();
	const result = { name, fixture, speed, resume: RESUME_RUN, passed: false, console_errors: 0, finalWin: null, ms: 0, errors, failed };
	let capTimer = null;
	try {
		await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
		await page.waitForSelector('.splash .press', { timeout: 120000 });
		await page.evaluate(INSTRUMENT);
		await sleep(400);
		await page.mouse.click(720, 450);
		await page.waitForFunction(() => document.documentElement.dataset.splashShutter === 'done', null, { timeout: 30000 });
		if (speed === 'turbo') await page.evaluate(() => window.__qaSetSpeedForTest?.('turbo'));
		if (speed === 'super') await page.evaluate(() => window.__qaSetSpeedForTest?.('super'));
		if (CAPTURE_EVERY_MS > 0) {
			let n = 0;
			capTimer = setInterval(() => {
				n += 1;
				page.screenshot({ path: join(HERE, `${name}.${String(n).padStart(2, '0')}.png`) }).catch(() => {});
			}, CAPTURE_EVERY_MS);
		}
		if (!RESUME_RUN) {
			await sleep(1500);
			await page.keyboard.press('Space');
		}
		await page.waitForFunction(() => (window.__pffFinalWins ?? []).length > 0, null, { timeout: 900000, polling: 250 });
		result.finalWin = await page.evaluate(() => window.__pffFinalWins?.[0] ?? null);
		result.atFinalWin = await readouts(page);
		result.expected = EXPECTED[fixture] ?? null;
		if (result.expected !== null && result.finalWin !== result.expected) errors.push(`driver: finalWin ${result.finalWin} != booked ${result.expected}`);
		await sleep(2500);
		if (capTimer) clearInterval(capTimer);
		result.afterSettle = await readouts(page);
		await page.screenshot({ path: join(HERE, `${name}.png`) });
		result.log = await page.evaluate(() => window.__rvLog ?? []);
		result.passed = !errors.some((e) => e.startsWith('driver:'));
	} catch (error) {
		if (capTimer) clearInterval(capTimer);
		errors.push(`driver: ${String(error?.message ?? error).split('\n')[0]}`);
		try {
			result.log = await page.evaluate(() => window.__rvLog ?? []);
			result.atFail = await readouts(page);
			await page.screenshot({ path: join(HERE, `${name}.FAILED.png`) });
		} catch {
			/* no page */
		}
	}
	result.ms = Date.now() - t0;
	result.console_errors = errors.filter((e) => !e.startsWith('driver:')).length;
	if (result.console_errors > 0) result.passed = false;
	await context.close();
	return result;
};

mkdirSync(HERE, { recursive: true });
const browser = await launch();
const version = browser.version();
{
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await context.newPage();
	try {
		await page.goto(`${GAME}?sessionID=warmup-${Date.now()}&rgs_url=${RGS}&device=desktop`, { waitUntil: 'domcontentloaded', timeout: 60000 });
		await page.waitForSelector('.splash .press', { timeout: 120000 });
		await sleep(3000);
	} catch {
		/* the real runs report */
	}
	await context.close();
}
const results = [];
for (const spec of RUNS) {
	const r = await runOne(browser, spec);
	results.push(r);
	console.log(`${r.passed ? 'PASS' : 'FAIL'} ${r.name.padEnd(30)} finalWin=${r.finalWin} expected=${r.expected} win=${r.afterSettle?.win} console_errors=${r.console_errors} ${r.ms} ms`);
	for (const e of r.errors) console.log(`   ${e}`);
}
await browser.close();
const out = join(HERE, process.env.RESULTS_NAME ?? 'results.json');
let prior = [];
try {
	prior = JSON.parse(readFileSync(out, 'utf8')).results ?? [];
} catch {
	/* first */
}
writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), browser: `chromium ${version} (full Chromium, SwiftShader GL, muted)`, game: GAME, rgs: RGS, results: [...prior, ...results] }, null, 2));
process.exit(results.every((r) => r.passed) ? 0 : 1);
