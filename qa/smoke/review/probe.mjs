#!/usr/bin/env node
// REVIEW probe: play one fixture (turbo) and log the feature state every second until finalWin, to find where a round
// stalls. node qa/smoke/review/probe.mjs <fixture> [maxSeconds]
import { createRequire } from 'node:module';
import { writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const GAME = process.env.GAME_URL ?? 'http://127.0.0.1:3004/';
const RGS = process.env.RGS_HOST ?? '127.0.0.1:3037';
const fixture = process.argv[2] ?? 'base_trigger_rescue';
const maxS = Number(process.argv[3] ?? 600);
const ARGS = ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ channel: 'chromium', args: ARGS });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => {
	globalThis.__PFF_QA = true;
	// trap every (re)definition of the DEV card handle: one per SceneShutter instance that initialises
	let cur; window.__pffCardSets = [];
	Object.defineProperty(window, '__pffCard', { configurable: true, get: () => cur, set: (v) => { cur = v; window.__pffCardSets.push(performance.now()); } });
});
const page = await ctx.newPage();
const t0 = Date.now();
const lines = [];
const L = (s) => { const l = `${((Date.now() - t0) / 1000).toFixed(1)}s ${s}`; lines.push(l); console.log(l); };
page.on('console', (m) => { if (!/Failed to load resource/.test(m.text())) L(`console.${m.type()}: ${m.text().slice(0, 240)}`); });
page.on('pageerror', (e) => L(`pageerror: ${String(e?.message ?? e).slice(0, 240)}`));
page.on('request', (r) => { if (/\/(wallet|bet)\//.test(r.url())) L(`req ${r.url().replace(/^https?:\/\/[^/]+/, '')} ${r.postData()?.slice(0, 100) ?? ''}`); });
page.on('response', (r) => { if (r.status() >= 400) L(`HTTP ${r.status()} ${r.url().replace(/^https?:\/\/[^/]+/, '')}`); });
await page.goto(`${GAME}?sessionID=probe-${fixture}-${Date.now()}&rgs_url=${RGS}&device=desktop&fixture=${fixture}`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.splash .press', { timeout: 180000 });
await sleep(400);
await page.mouse.click(720, 450);
await page.waitForFunction(() => document.documentElement.dataset.splashShutter === 'done', null, { timeout: 30000 });
await sleep(1500);
// grab the live module instances the app itself imported (same URL = same instance)
await page.evaluate(async () => {
	const urls = performance.getEntriesByType('resource').map((e) => e.name);
	const find = (frag) => urls.find((u) => u.includes(frag) && !u.includes('?import&') ) ?? urls.find((u) => u.includes(frag));
	const w = window;
	w.__probe = {};
	for (const [k, frag] of [['rescue', 'game/rescue/stateRescue.svelte.ts'], ['scene', 'game/fx/stateScene.svelte.ts'], ['xs', 'game/stateXstate.ts'], ['map', 'game/bookEventHandlerMap.ts'], ['em', 'game/eventEmitter.ts']]) {
		const u = find(frag);
		w.__probe[k + 'Url'] = u;
		try { w.__probe[k] = await import(/* @vite-ignore */ u); } catch (e) { w.__probe[k + 'Err'] = String(e); }
	}
});
// trace every book-event handler (start / end / throw) and every awaited emitter broadcast
await page.evaluate(() => {
	const p = window.__probe; const t0 = performance.now(); p.trace = [];
	const T = (s) => p.trace.push(`${((performance.now() - t0) / 1000).toFixed(1)} ${s}`);
	const map = p.map?.bookEventHandlerMap;
	if (map) for (const k of Object.keys(map)) { const f = map[k]; map[k] = async (e, c) => { T(`> ${k} #${e.index}`); try { const r = await f(e, c); T(`< ${k} #${e.index}`); return r; } catch (err) { T(`! ${k} #${e.index} ${err?.stack ?? err}`); throw err; } }; }
	const em = p.em?.eventEmitter;
	if (em?.broadcastAsync) { const f = em.broadcastAsync.bind(em); em.broadcastAsync = async (ev) => { T(`  bA> ${ev.type}${ev.card ? ' card=' + ev.card.kind : ''}`); try { const r = await f(ev); T(`  bA< ${ev.type}`); return r; } catch (err) { T(`  bA! ${ev.type} ${err?.stack ?? err}`); throw err; } }; }
	if (em?.broadcast) { const g = em.broadcast.bind(em); em.broadcast = (ev) => { if (!/^(sound|symbolWinFx|linePop|payline|boardShow|stopButtonEnable|soundOnce|anim)/.test(ev.type)) T(`  b ${ev.type}`); return g(ev); }; }
	// 50 ms watcher: every transition of the card / cover / rescue flags
	let prev = '';
	setInterval(() => {
		const c = window.__pffCard; const sc = p.scene?.stateScene; const r = p.rescue?.stateRescue;
		const k = `card=${c?.live}/${c?.kind} cov=${sc?.covered} act=${r?.active}`;
		if (k !== prev) { T(`  ~ ${k}`); prev = k; }
	}, 50);
	p.traceReady = { map: !!map, em: !!em?.broadcastAsync };
});
L('trace: ' + JSON.stringify(await page.evaluate(() => window.__probe.traceReady)));
L('probe: ' + JSON.stringify(await page.evaluate(() => ({ r: window.__probe.rescueUrl, s: window.__probe.sceneUrl, x: window.__probe.xsUrl, e: [window.__probe.rescueErr, window.__probe.sceneErr, window.__probe.xsErr] }))));
if (process.env.SUPER) L('super: ' + (await page.evaluate(() => window.__qaSetSpeedForTest?.('super') ?? 'no-hook')));
else await page.evaluate(() => window.__pffSetTurbo?.(true));
const tSpace = Date.now();
await page.keyboard.press('Space');
let last = '';
let shot = 0;
while ((Date.now() - t0) / 1000 < maxS) {
	const s = await page.evaluate(() => {
		const p = window.__probe;
		const r = p.rescue?.stateRescue; const b = p.rescue?.stateBackdraftSpins; const a = p.rescue?.stateAlarmCall;
		const sc = p.scene?.stateScene;
		const card = window.__pffCard;
		let idle; try { idle = p.xs?.stateXstateDerived?.isIdle?.(); } catch { idle = 'err'; }
		return JSON.stringify({
			fin: (window.__pffFinalWins ?? []).length ? window.__pffFinalWins[0] : null,
			r: r ? { a: r.active, m: r.multiplier, b: r.building, left: r.spinsLeft, tot: r.total, ban: r.banner, cap: r.capped, skip: r.skip } : null,
			bd: b?.active, ac: a ? `${a.active}/${a.phase}` : null,
			sc: sc ? { cov: sc.covered, busy: sc.busy, mood: sc.mood } : null,
			card: card ? `${card.live}/${card.kind}` : null, idle, cardSets: (window.__pffCardSets ?? []).length, canvases: document.querySelectorAll('canvas').length,
		});
	});
	if (s !== last) { L('state ' + s); last = s; }
	const tr = await page.evaluate(() => window.__probe.trace.splice(0));
	for (const t of tr) L('trace ' + t);
	if (JSON.parse(s).fin !== null) break;
	if ((Date.now() - t0) / 1000 > 60 * (shot + 1)) { shot += 1; await page.screenshot({ path: join(HERE, `probe_${fixture}${process.env.SUPER ? '_super' : ''}_${shot}.png`) }); }
	await sleep(1000);
}
L(`round ms since Space: ${Date.now() - tSpace}`);
await sleep(2500);
L('hud: ' + (await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').match(/BALANCE.{0,40}/)?.[0])));
await page.screenshot({ path: join(HERE, `probe_${fixture}${process.env.SUPER ? '_super' : ''}_end.png`) });
writeFileSync(join(HERE, `probe_${fixture}${process.env.SUPER ? '_super' : ''}.log`), lines.join('\n'));
await browser.close();
