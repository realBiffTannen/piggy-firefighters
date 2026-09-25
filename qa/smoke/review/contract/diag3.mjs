// Diagnostic 2: M1 max_win@super — where does the round stall after the MAX rung? (review lens: contract)
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
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.type() + ': ' + m.text().slice(0, 300)));
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e?.message ?? e).slice(0, 300)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const out = { samples: [], errors };
await page.goto(`${GAME}?sessionID=diag3-${FIX}-${Date.now()}&rgs_url=${RGS}&device=desktop&fixture=${FIX}`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.splash .press', { timeout: 180000 });
await page.evaluate(async () => {
  const w = window; w.__rvLog = [];
  const m = await import('/src/game/eventEmitter.ts');
  const em = m.eventEmitter; const b = em.broadcast.bind(em); const ba = em.broadcastAsync.bind(em);
  const T = () => Math.round(performance.now());
  em.broadcast = (e) => { if (/shutter|winRungs|stopButton/.test(e.type)) w.__rvLog.push({ t: T(), b: e.type }); return b(e); };
  em.broadcastAsync = (e) => {
    const watch = /shutter|winRungs/.test(e.type);
    if (watch) w.__rvLog.push({ t: T(), ba: e.type, level: e.level, card: e.card?.kind });
    let p;
    try { p = ba(e); } catch (err) { w.__rvLog.push({ t: T(), threw: e.type, err: String(err) }); throw err; }
    if (watch) p.then(() => w.__rvLog.push({ t: T(), resolved: e.type }), (err) => w.__rvLog.push({ t: T(), rejected: e.type, err: String(err) }));
    return p;
  };
  w.__rvRescue = await import('/src/game/rescue/stateRescue.svelte.ts');
  w.__rvScene = await import('/src/game/fx/stateScene.svelte.ts');
  w.__rvDir = await import('/src/game/rescue/rescueDirector.ts');
  w.__rvErrs = []; const ce = console.error.bind(console); console.error = (...a) => { w.__rvErrs.push(a.map(String).join(' ').slice(0, 300)); ce(...a); }; const cw = console.warn.bind(console); console.warn = (...a) => { w.__rvErrs.push('W ' + a.map(String).join(' ').slice(0, 300)); cw(...a); };
  w.addEventListener('unhandledrejection', (ev) => w.__rvLog.push({ t: T(), unhandled: String(ev.reason?.stack ?? ev.reason).slice(0, 400) }));
});
await sleep(400);
await page.mouse.click(720, 450);
await page.waitForFunction(() => document.documentElement.dataset.splashShutter === 'done', null, { timeout: 60000 });
await page.evaluate((s) => window.__qaSetSpeedForTest?.(s), SPEED);
await sleep(1500);
await page.keyboard.press('Space');
const snap = () => page.evaluate(() => ({ errs: (window.__rvErrs ?? []).slice(-4), rescue: window.__rvRescue.stateRescue.active, covered: window.__rvScene.stateScene.covered, busy: window.__rvScene.stateScene.busy, card: window.__pffCard ? { live: window.__pffCard.live, kind: window.__pffCard.kind } : null, finals: window.__pffFinalWins ?? [], log: window.__rvLog.slice(-8) }));
let closeSeenAt = 0; let poked = false;
while (Date.now() - t0 < 1700000) {
  const s = await snap(); s.t = Math.round((Date.now() - t0) / 1000); out.samples.push(s);
  console.log(JSON.stringify(s).slice(0, 700));
  if (s.finals.length) break;
  if (!closeSeenAt && s.log.some((l) => l.ba === 'shutterClose' && l.card === 'outro')) closeSeenAt = Date.now();
  if (closeSeenAt && !poked && Date.now() - closeSeenAt > 60000 && s.rescue) {
    poked = true;
    out.stuck = s;
    await page.screenshot({ path: new URL('./diag3_stuck.png', import.meta.url).pathname });
    const probe = await page.evaluate(async () => {
      const m = await import('/src/game/eventEmitter.ts');
      const before = window.__pffCard?.kind ?? null;
      void m.eventEmitter.broadcastAsync({ type: 'shutterClose', card: { kind: 'outro', title: 'PROBE', hint: 'x' } });
      await new Promise((r) => setTimeout(r, 50));
      const after = window.__pffCard?.kind ?? null;
      return { before, after, errs: window.__rvErrs.slice(-6) };
    });
    out.probe = probe; console.log('PROBE', JSON.stringify(probe));
  }
  await sleep(closeSeenAt ? 1000 : (out.samples.at(-1)?.log?.some((l) => l.ba === 'winRungs' && l.level === 10) ? 1000 : 8000));
  if (poked && Date.now() - closeSeenAt > 120000) break;
}
await page.screenshot({ path: new URL('./diag3_end.png', import.meta.url).pathname });
writeFileSync(new URL('./diag3.json', import.meta.url), JSON.stringify(out, null, 1));
await browser.close();
console.log('DONE errors', errors.length);
