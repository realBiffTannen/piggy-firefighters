// RESUME=<fixture> mock check (review lens: contract): a fresh session opens with an ACTIVE round; the page must resume it
// on its own (no Space press) through the bonus start (rescueStart intro card -> Rescue scene). Samples the state every 5 s
// for WAIT_S seconds, then (FULL=1) waits for finalWin. Muted full Chromium; the Vite HMR socket is swallowed.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const GAME = process.env.GAME_URL ?? 'http://127.0.0.1:3005/';
const RGS = process.env.RGS_HOST ?? '127.0.0.1:3049';
const WAIT_S = Number(process.env.WAIT_S || 150);
const ARGS = ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ channel: 'chromium', args: ARGS });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => { globalThis.__PFF_QA = true; });
await context.routeWebSocket(/\?token=/, (ws) => ws.onMessage(() => {}));
const page = await context.newPage();
const errors = []; const reqs = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 300)));
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e?.message ?? e).slice(0, 300)));
page.on('request', (r) => { if (/wallet|bet\//.test(r.url())) reqs.push(r.url().replace(/^https?:\/\/[^/]+/, '').split('?')[0]); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
await page.goto(`${GAME}?sessionID=resume-${Date.now()}&rgs_url=${RGS}&device=desktop`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.splash .press', { timeout: 180000 });
await page.evaluate(async () => {
  const w = window; w.__rvLog = [];
  const m = await import('/src/game/eventEmitter.ts');
  const em = m.eventEmitter; const b = em.broadcast.bind(em); const ba = em.broadcastAsync.bind(em);
  const rec = (e) => { if (['winRungs','shutterClose','shutterOpen','winUpdate'].includes(e.type)) w.__rvLog.push({ t: Math.round(performance.now()), type: e.type, amount: e.amount, card: e.card?.kind }); };
  em.broadcast = (e) => { rec(e); return b(e); }; em.broadcastAsync = (e) => { rec(e); return ba(e); };
  w.__rvRescue = await import('/src/game/rescue/stateRescue.svelte.ts');
});
await sleep(400);
await page.mouse.click(720, 450);
await page.evaluate(() => window.__qaSetSpeedForTest?.('turbo'));
const samples = [];
while (Date.now() - t0 < WAIT_S * 1000) {
  await sleep(5000);
  const s = await page.evaluate(() => ({ rescue: window.__rvRescue?.stateRescue?.active, spinsLeft: window.__rvRescue?.stateRescue?.spinsLeft, mult: window.__rvRescue?.stateRescue?.multiplier, total: window.__rvRescue?.stateRescue?.total, finals: window.__pffFinalWins ?? [], log: (window.__rvLog ?? []).slice(-2), win: document.querySelector('#win')?.textContent?.trim(), fs: document.querySelector('#feature-spins')?.textContent?.trim() }));
  s.t = Math.round((Date.now() - t0) / 1000); samples.push(s); console.log(JSON.stringify(s));
  if (s.finals.length) break;
}
await page.screenshot({ path: new URL('./resume_check.png', import.meta.url).pathname });
writeFileSync(new URL('./resume_check.json', import.meta.url), JSON.stringify({ errors, reqs, samples, browser: browser.version() }, null, 1));
await browser.close();
console.log('errors', errors.length, 'requests', reqs.join(' '));
