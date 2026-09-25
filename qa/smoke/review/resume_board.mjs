#!/usr/bin/env node
// REVIEW: which board does a NATURAL-trigger resume show while its rewound `freeSpinTrigger` rings the alarms?
// Seeds an active base_trigger_rescue round with a mid-bonus cursor (event 13) on the mock, loads that session and
// samples the visible board the instant the resume starts.
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const GAME = process.env.GAME_URL ?? 'http://127.0.0.1:3004/';
const RGS = process.env.RGS_HOST ?? '127.0.0.1:3037';
const S = `review-rboard-${Date.now()}`;
const post = (path, body) => fetch(`http://${RGS}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
console.log(await post('/control/fixture', { name: null }));
console.log(await post('/control/resume', { name: 'base_trigger_rescue', sessionID: S }));
console.log(await post('/control/resume', { name: null })); // later sessions are not seeded
console.log(await post('/bet/event', { sessionID: S, event: '13' }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ channel: 'chromium', args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(`${GAME}?sessionID=${S}&rgs_url=${RGS}&device=desktop`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.splash .press', { timeout: 180000 });
await page.evaluate(async () => {
	const url = performance.getEntriesByType('resource').map((e) => e.name).find((u) => u.includes('/src/game/stateGame.svelte.ts'));
	window.__sg = (await import(/* @vite-ignore */ url)).stateGame;
});
await sleep(400);
await page.mouse.click(720, 450);
const samples = [];
for (let i = 0; i < 40; i += 1) {
	samples.push(await page.evaluate(() => window.__sg.board.map((reel) => reel.reelState.symbols.slice(1, 4).map((s) => s.rawSymbol.name).join('/')).join(' | ')));
	if (i === 6 || i === 12) await page.screenshot({ path: join(HERE, `resume_board_${i}.png`) });
	await sleep(250);
}
const uniq = [...new Set(samples)];
console.log(JSON.stringify({ trigger_board_book: 'reveal #0 of base_trigger_rescue', samples: uniq }, null, 1));
await browser.close();
