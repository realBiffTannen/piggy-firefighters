/** Rookie visual sanity capture: rest pose + one mid-clip frame per clip, muted headless Chromium. */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const [playwrightEntry, viewerUrl] = process.argv.slice(2);
if (!playwrightEntry || !viewerUrl) throw new Error('Usage: node capture.mjs /abs/playwright/index.mjs http://127.0.0.1:PORT/rigs');
const here = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--mute-audio'] });
const context = await browser.newContext({ viewport: { width: 1360, height: 1000 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
const log = () => page.locator('.events li').evaluateAll(n => n.map(x => x.textContent));
await page.goto(viewerUrl, { waitUntil: 'networkidle', timeout: 60000 });
await page.getByRole('heading', { name: 'Character clip review' }).waitFor();
if (await page.locator('#rig').inputValue() !== 'pf_rookie') await page.locator('#rig').selectOption('pf_rookie');
await page.waitForFunction(() => document.querySelector('#clip') && !document.querySelector('#clip').disabled
  && document.querySelector('.events')?.textContent.includes('LOADED pf_rookie'), null, { timeout: 30000 });
const canvas = page.locator('canvas[aria-label="pf_rookie animation preview"]');
const anchors = page.locator('input[type=checkbox]').first();
const clips = await page.locator('#clip option').evaluateAll(n => n.map(o => o.value));
const report = { viewerUrl, clips, frames: [], errors };
const pause = page.getByRole('button', { name: 'Pause', exact: true });
const replay = page.getByRole('button', { name: 'Replay', exact: true });
async function shoot(name) {
  const file = path.join(here, `${name}.png`);
  await canvas.screenshot({ path: file });
  report.frames.push(name);
}
// Rest pose: hold_sheet/idle at t≈0 by pausing right after replay.
const wanted = (process.env.CLIPS ?? clips.join(',')).split(',');
for (const clip of wanted) {
  await page.locator('#clip').selectOption(clip);
  await page.locator('#speed').selectOption('0.25');
  if (await pause.isVisible().catch(() => false) && await pause.isEnabled()) await pause.click();
  await replay.click();
  await page.waitForTimeout(80);
  if (clip === wanted[0]) { await shoot(`rest-${clip}`); }
  // mid clip: wait a fraction of the (quarter-speed) duration, then pause and shoot
  const note = await page.locator('.clip-note').innerText();
  const duration = Number((/^(\d+(?:\.\d+)?)s/.exec(note) ?? [0, 1])[1]);
  const fraction = Number(process.env.FRACTION ?? 0.45);
  await page.waitForTimeout(Math.max(50, duration * 4 * fraction * 1000 - 80));
  const resume = page.getByRole('button', { name: 'Pause', exact: true });
  if (await resume.isEnabled().catch(() => false)) await resume.click();
  await page.waitForTimeout(60);
  await shoot(`mid-${clip}${process.env.FRACTION ? '-' + process.env.FRACTION : ''}`);
  report[clip] = { duration, log: (await log()).slice(-6) };
  const res = page.getByRole('button', { name: 'Resume', exact: true });
  if (await res.isVisible().catch(() => false)) await res.click();
}
await writeFile(path.join(here, 'capture.json'), JSON.stringify(report, null, 2) + '\n');
await browser.close();
console.log(JSON.stringify({ frames: report.frames, errors }));
