// Diagnostic: M1 max_win@super with an FPS / state probe every 5 s (review lens: contract). Muted, full Chromium.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const GAME = process.env.GAME_URL ?? 'http://127.0.0.1:3005/';
const RGS = process.env.RGS_HOST ?? '127.0.0.1:3048';
const FIX = process.argv[2] ?? 'max_win';
const SPEED = process.argv[3] ?? 'super';
const ARGS = ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ channel: 'chromium', args: ARGS });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => { globalThis.__PFF_QA = true; });
await context.routeWebSocket(/\?token=/, (ws) => ws.onMessage(() => {}));
const page = await context.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 300)));
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e?.message ?? e).slice(0, 300)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const samples = [];
const t0 = Date.now();
await page.goto(`${GAME}?sessionID=diag-${FIX}-${Date.now()}&rgs_url=${RGS}&device=desktop&fixture=${FIX}`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.splash .press', { timeout: 180000 });
await page.evaluate(async () => {
  const w = window; w.__rvLog = [];
  const m = await import('/src/game/eventEmitter.ts');
  const em = m.eventEmitter; const b = em.broadcast.bind(em); const ba = em.broadcastAsync.bind(em);
  const rec = (e) => { if (['winRungs','shutterClose','shutterOpen','shutterReset'].includes(e.type)) w.__rvLog.push({ t: Math.round(performance.now()), type: e.type, level: e.level }); };
  em.broadcast = (e) => { rec(e); return b(e); }; em.broadcastAsync = (e) => { rec(e); return ba(e); };
  w.__rvRescue = await import('/src/game/rescue/stateRescue.svelte.ts');
  w.__rvScene = await import('/src/game/fx/stateScene.svelte.ts');
  w.__rvApp = await import('/src/game/stateApp.ts');
});
await sleep(400);
await page.mouse.click(720, 450);
await page.waitForFunction(() => document.documentElement.dataset.splashShutter === 'done', null, { timeout: 60000 });
await page.evaluate((s) => window.__qaSetSpeedForTest?.(s), SPEED);
await sleep(1500);
await page.keyboard.press('Space');
let done = false;
while (!done && Date.now() - t0 < 1500000) {
  const s = await page.evaluate(async () => {
    const w = window;
    const n0 = performance.now(); let frames = 0;
    await new Promise((res) => { const f = () => { frames += 1; if (performance.now() - n0 < 1000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); setTimeout(res, 3000); });
    const tk = w.__rvApp?.stateApp?.pixiApplication?.ticker;
    return {
      rafFps: frames, pixiStarted: tk?.started ?? null, pixiFps: tk ? Math.round(tk.FPS) : null, lastTickMs: tk ? Math.round(tk.lastTime) : null, now: Math.round(performance.now()),
      vis: document.visibilityState, rescue: w.__rvRescue?.stateRescue?.active, covered: w.__rvScene?.stateScene?.covered,
      card: w.__pffCard ? { live: w.__pffCard.live, kind: w.__pffCard.kind } : null, finals: w.__pffFinalWins ?? [], log: (w.__rvLog ?? []).slice(-3),
    };
  });
  s.t = Math.round((Date.now() - t0) / 1000);
  samples.push(s);
  console.log(JSON.stringify(s));
  if (s.finals.length) done = true;
  await sleep(5000);
}
writeFileSync(new URL(`./diag_${FIX}_${SPEED}.json`, import.meta.url), JSON.stringify({ errors, samples, browser: browser.version() }, null, 1));
await page.screenshot({ path: new URL(`./diag_${FIX}_${SPEED}.png`, import.meta.url).pathname });
await browser.close();
console.log('DONE', done, 'errors', errors.length);
