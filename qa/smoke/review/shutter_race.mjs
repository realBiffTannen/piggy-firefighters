#!/usr/bin/env node
// REVIEW repro: SceneShutter failsafe misfire. Drive the bay door directly through the game's event emitter:
// close(intro) -> open() with one long frame (a 13 s main-thread stall, like a backgrounded tab or a very slow
// device) -> close(outro). Expected: the second close settles. Observed (bug): it never settles, card === null.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const GAME = process.env.GAME_URL ?? 'http://127.0.0.1:3004/';
const RGS = process.env.RGS_HOST ?? '127.0.0.1:3037';
const STALL = Number(process.env.STALL_MS ?? 13000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ channel: 'chromium', args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e?.message ?? e)));
await page.goto(`${GAME}?sessionID=race-${Date.now()}&rgs_url=${RGS}&device=desktop`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.splash .press', { timeout: 180000 });
await sleep(400);
await page.mouse.click(720, 450);
await page.waitForFunction(() => document.documentElement.dataset.splashShutter === 'done', null, { timeout: 30000 });
await sleep(2000);
const result = await page.evaluate(async (stall) => {
	const url = performance.getEntriesByType('resource').map((e) => e.name).find((u) => u.includes('/src/game/eventEmitter.ts'));
	const { eventEmitter } = await import(/* @vite-ignore */ url);
	const log = [];
	const t0 = performance.now();
	const T = (s) => log.push(`${((performance.now() - t0) / 1000).toFixed(2)}s ${s} card=${window.__pffCard?.kind}`);
	const card = (kind) => ({ kind, premium: false, title: 'RESCUE SPINS', subtitle: 'review', hint: 'TAP', value: kind === 'outro' ? '3.7x' : undefined });
	T('close(intro) >');
	await eventEmitter.broadcastAsync({ type: 'shutterClose', card: card('intro') });
	T('close(intro) <');
	const opening = eventEmitter.broadcastAsync({ type: 'shutterOpen' });
	await new Promise((r) => setTimeout(r, 60));
	if (stall > 0) { T(`stall ${stall} ms`); const end = performance.now() + stall; while (performance.now() < end) { /* one long frame */ } }
	await opening;
	T('open <');
	await new Promise((r) => setTimeout(r, 1500));
	T('close(outro) >');
	const closing = eventEmitter.broadcastAsync({ type: 'shutterClose', card: card('outro') }).then(() => 'settled');
	const outcome = await Promise.race([closing, new Promise((r) => setTimeout(() => r('TIMEOUT (20 s)'), 20000))]);
	T(`close(outro) ${outcome}`);
	// leave the page clean when it did settle
	if (outcome === 'settled') await eventEmitter.broadcastAsync({ type: 'shutterOpen' });
	return log;
}, STALL);
console.log(JSON.stringify({ stallMs: STALL, result, errors }, null, 1));
await browser.close();
