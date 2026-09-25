#!/usr/bin/env node
/**
 * PIGGY FIREFIGHTERS — frontend-port smoke (dev server + fixtures-only mock RGS).
 *
 *   PORT=3036 BOOKS_DIR=none node server/mock-rgs.mjs &
 *   (cd apps/piggy_firefighters && pnpm dev) &          # port 3003
 *   node qa/smoke/port/smoke.mjs [fixture ...]           # ALL_FIXTURES=1 for the whole index
 *   FIXTURES_DIR=server/fixtures_m1 on BOTH the mock and this driver runs the math lane's M1 books instead
 *   (results_m1.json + screenshots under qa/smoke/port/m1/); expected payouts come from the books, expected rungs from
 *   the contract §8 rule at each fixture's mode cost.
 *
 * For each fixture: open the game with `&fixture=<name>` (the dev build pins the mock to that book), pass the splash
 * gate, press Space once, wait for the round's `finalWin` (DEV-only hook `window.__pffFinalWins`, pushed by the
 * finalWin handler), let the presentation settle, screenshot to qa/smoke/port/<name>.png and record console errors.
 * Bonus fixtures run with the DEV turbo switch (`window.__pffSetTurbo(true)`) so the pass stays short; turbo only
 * shortens holds, never the event order.
 *
 * Browser: full Chromium (`channel: 'chromium'`), always muted. Playwright is resolved from the workspace, else from the
 * global install (PLAYWRIGHT_MODULE overrides); browsers from PLAYWRIGHT_BROWSERS_PATH (default /opt/pw-browsers).
 * Results: qa/smoke/port/results.json.
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

const GAME = process.env.GAME_URL ?? 'http://127.0.0.1:3003/';
const RGS = process.env.RGS_HOST ?? '127.0.0.1:3036';
// FIXTURES_DIR selects the fixture set the MOCK is serving (default server/fixtures; server/fixtures_m1 = the math
// lane's real-model books). The index there is the roster, the booked payouts and the mode costs. OUT_DIR keeps the
// two sets' screenshots and results apart (default: this folder; results_<set>.json for a non-default set).
const FIXTURES_DIR = process.env.FIXTURES_DIR ?? join(HERE, '..', '..', '..', 'server', 'fixtures');
const SET_NAME = /fixtures_m1/.test(FIXTURES_DIR) ? 'm1' : 'dev';
const OUT_DIR = process.env.OUT_DIR ?? (SET_NAME === 'dev' ? HERE : join(HERE, SET_NAME));
const INDEX = (() => {
	try {
		return JSON.parse(readFileSync(join(FIXTURES_DIR, 'index.json'), 'utf8'));
	} catch {
		return { fixtures: [], costs: {} };
	}
})();
const FIXTURES = process.argv.slice(2).length
	? process.argv.slice(2)
	: process.env.ALL_FIXTURES
		? INDEX.fixtures.map((f) => f.name)
		: ['base_win', 'base_backdraft_win', 'base_trigger_rescue', 'alarm_call_false', 'max_win'];
/** the booked payout of a fixture (x100 of the base bet): the index row, else the book itself (the M1 index has none) */
const bookedPayout = (name) => {
	const row = INDEX.fixtures.find((f) => f.name === name);
	if (row && typeof row.payoutMultiplier === 'number') return row.payoutMultiplier;
	try {
		const book = JSON.parse(readFileSync(join(FIXTURES_DIR, row?.file ?? `${name}.json`), 'utf8'));
		return typeof book.payoutMultiplier === 'number' ? book.payoutMultiplier : null;
	} catch {
		return null;
	}
};
const bookHas = (name, type) => {
	const row = INDEX.fixtures.find((f) => f.name === name);
	if (row?.events) return row.events.includes(type);
	try {
		const book = JSON.parse(readFileSync(join(FIXTURES_DIR, row?.file ?? `${name}.json`), 'utf8'));
		return (book.events ?? []).some((e) => e.type === type);
	} catch {
		return false;
	}
};
const costOf = (name) => {
	const row = INDEX.fixtures.find((f) => f.name === name);
	return Number(row?.cost ?? INDEX.costs?.[row?.mode ?? 'base'] ?? 1);
};
// a multi-step round (a bonus) runs with the DEV turbo switch so the pass stays short; base rounds play at normal speed
const TURBO = new Set(FIXTURES.filter((name) => ['freeSpinTrigger', 'rescueStart', 'alarmCall', 'backdraftSpinsStart'].some((t) => bookHas(name, t)) && !(bookHas(name, 'alarmCall') && !bookHas(name, 'rescueStart'))));

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

// the booked payout of each fixture: the round must end on exactly this finalWin
const EXPECTED = Object.fromEntries(INDEX.fixtures.map((f) => [f.name, bookedPayout(f.name)]));

/** Rung levels (6 BIG … 10 MAX) a fixture must climb, once, on its round total: contract §8 v1.2.2 — tier 0 when
 *  W <= S (the charged cost of its mode), then the floors in base-bet units 15 / 30 / 50 / 100 x, MAX only on a
 *  `wincap`. The same rule as apps/piggy_firefighters/src/game/roundTier.ts (node-checked by qa/gate); restated here so
 *  the driver needs no TypeScript. */
const expectedRungs = (name) => {
	const w = bookedPayout(name);
	if (w === null) return undefined;
	const s = costOf(name) * 100;
	if (w <= s) return [];
	if (bookHas(name, 'wincap')) return [10];
	const x = w / 100;
	if (x >= 100) return [9];
	if (x >= 50) return [8];
	if (x >= 30) return [7];
	if (x >= 15) return [6];
	return [];
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const runOne = async (browser, fixture) => {
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
	const page = await context.newPage();
	const errors = [];
	page.on('console', (msg) => {
		if (msg.type() === 'error') errors.push(msg.text().slice(0, 400));
	});
	page.on('pageerror', (err) => errors.push(`pageerror: ${String(err?.message ?? err).slice(0, 400)}`));
	// one session per fixture run: a round left open by an earlier run would otherwise be RESUMED instead of played
	const url = `${GAME}?sessionID=local-${fixture}-${Date.now()}&rgs_url=${RGS}&device=desktop&fixture=${fixture}`;
	const t0 = Date.now();
	const result = { fixture, passed: false, console_errors: 0, finalWin: null, ms: 0, errors };
	try {
		await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
		// splash gate: the press line appears only once loading is genuinely done
		await page.waitForSelector('.splash .press', { timeout: 90000 });
		await sleep(400);
		await page.mouse.click(720, 450);
		await page.waitForFunction(() => document.documentElement.dataset.splashShutter === 'done', null, { timeout: 30000 });
		await sleep(1500); // resumeBet pass + the board settles
		if (TURBO.has(fixture)) await page.evaluate(() => (window).__pffSetTurbo?.(true));
		await page.keyboard.press('Space');
		await page.waitForFunction(() => ((window).__pffFinalWins ?? []).length > 0, null, { timeout: 900000, polling: 250 });
		result.finalWin = await page.evaluate(() => (window).__pffFinalWins?.[0] ?? null);
		await sleep(600);
		// every win-rung climb of the round (contract §8: rungs play ONCE, on the round total, at roundTier)
		result.rungs = await page.evaluate(() => (window).__pffRungs ?? []);
		const wantRungs = expectedRungs(fixture);
		if (wantRungs && JSON.stringify(result.rungs.map((r) => r.level)) !== JSON.stringify(wantRungs))
			errors.push(`driver: rung levels ${JSON.stringify(result.rungs.map((r) => r.level))} != contract §8 ${JSON.stringify(wantRungs)}`);
		result.expected = EXPECTED[fixture] ?? null;
		if (result.expected !== null && result.finalWin !== result.expected) errors.push(`driver: finalWin ${result.finalWin} != booked ${result.expected}`);
		await sleep(1800); // let the last presentation (outro / shutter lift) settle for the capture
		await page.screenshot({ path: join(OUT_DIR, `${fixture}.png`) });
		result.passed = !errors.some((e) => e.startsWith('driver:'));
	} catch (error) {
		errors.push(`driver: ${String(error?.message ?? error).split('\n')[0]}`);
		try {
			await page.screenshot({ path: join(OUT_DIR, `${fixture}.FAILED.png`) });
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

mkdirSync(OUT_DIR, { recursive: true });
const browser = await launch();
const version = browser.version();
// WARM-UP: the dev server compiles and may re-optimize dependencies on the first page load after an edit, which
// reloads the page mid-run (the splash comes back and the Space press is lost). One throwaway load first.
{
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await context.newPage();
	try {
		await page.goto(`${GAME}?sessionID=warmup&rgs_url=${RGS}&device=desktop`, { waitUntil: 'domcontentloaded', timeout: 60000 });
		await page.waitForSelector('.splash .press', { timeout: 120000 });
		await sleep(3000);
	} catch {
		/* the real runs report */
	}
	await context.close();
}
const results = [];
for (const fixture of FIXTURES) {
	const r = await runOne(browser, fixture);
	results.push(r);
	console.log(`${r.passed ? 'PASS' : 'FAIL'} ${fixture.padEnd(22)} finalWin=${r.finalWin} console_errors=${r.console_errors} ${r.ms} ms`);
	for (const e of r.errors) console.log(`   ${e}`);
}
await browser.close();
writeFileSync(
	join(OUT_DIR, SET_NAME === 'dev' ? 'results.json' : `results_${SET_NAME}.json`),
	JSON.stringify({ at: new Date().toISOString(), browser: `chromium ${version}`, game: GAME, rgs: RGS, fixturesDir: FIXTURES_DIR, results }, null, 2),
);
process.exit(results.every((r) => r.passed) ? 0 : 1);
