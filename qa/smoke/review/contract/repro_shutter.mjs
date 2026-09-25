// Deterministic repro (review lens: contract): SceneShutter's wall-clock FAILSAFE races the frame-clocked open.
// 1) close (intro card) and await it; 2) open, and stall the main thread 13 s while the door is lifting (a slow device /
// a backgrounded tab); 3) close again (outro card): with the bug this close never resolves and the card is null.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const GAME = process.env.GAME_URL ?? 'http://127.0.0.1:3005/';
const RGS = process.env.RGS_HOST ?? '127.0.0.1:3047';
const STALL = Number(process.env.STALL_MS ?? 13000);
const ARGS = ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ channel: 'chromium', args: ARGS });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.routeWebSocket(/\?token=/, (ws) => ws.onMessage(() => {}));
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e?.message ?? e)));
await page.goto(`${GAME}?sessionID=repro-${Date.now()}&rgs_url=${RGS}&device=desktop`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.splash .press', { timeout: 180000 });
await page.waitForTimeout(400);
await page.mouse.click(720, 450);
await page.waitForFunction(() => document.documentElement.dataset.splashShutter === 'done', null, { timeout: 60000 });
await page.waitForTimeout(3000);
const r = await page.evaluate(async (stall) => {
  const { eventEmitter } = await import('/src/game/eventEmitter.ts');
  const { stateScene } = await import('/src/game/fx/stateScene.svelte.ts');
  const T = () => Math.round(performance.now());
  const out = { stall };
  const t0 = T();
  await eventEmitter.broadcastAsync({ type: 'shutterClose', card: { kind: 'intro', title: 'RESCUE SPINS', subtitle: 'repro', hint: 'x' } });
  out.introClosedMs = T() - t0; out.coveredAfterClose = stateScene.covered;
  const t1 = T();
  const opening = eventEmitter.broadcastAsync({ type: 'shutterOpen' });
  const busy = performance.now(); while (performance.now() - busy < stall) { /* main thread stalled: no frames, wall clock runs */ }
  await opening;
  out.openMs = T() - t1; out.coveredAfterOpen = stateScene.covered;
  await new Promise((res) => setTimeout(res, 1500));
  const t2 = T();
  const closing = eventEmitter.broadcastAsync({ type: 'shutterClose', card: { kind: 'outro', title: 'RESCUE SPINS COMPLETE', value: '7.60×', hint: 'x' } });
  const res = await Promise.race([closing.then(() => 'resolved'), new Promise((r2) => setTimeout(() => r2('TIMEOUT 30s'), 30000))]);
  out.outroClose = res; out.outroMs = T() - t2; out.card = window.__pffCard ? { live: window.__pffCard.live, kind: window.__pffCard.kind } : null; out.covered = stateScene.covered;
  return out;
}, STALL);
console.log(JSON.stringify({ ...r, errors }));
await browser.close();
