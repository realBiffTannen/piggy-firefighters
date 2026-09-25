/** Muted headless sanity frames of the installed pf_rescued export in the isolated rig viewer.
 * Usage: node capture.mjs /abs/playwright/index.mjs http://127.0.0.1:3041/rigs
 * Not motion acceptance: a few paused frames per skin/clip for a gross-error look. */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [entry, url = 'http://127.0.0.1:3041/rigs'] = process.argv.slice(2);
const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, 'frames');
await mkdir(out, { recursive: true });
const { chromium } = await import(pathToFileURL(entry).href);
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url, { waitUntil: 'networkidle' });
await page.locator('#rig').selectOption('pf_rescued');
await page.waitForFunction(() => document.querySelector('.events')?.textContent.includes('LOADED pf_rescued'), null, { timeout: 30000 });
await page.locator('#speed').selectOption('0.25');
await page.getByText('Show contract anchors').click();
const canvas = page.locator('canvas[aria-label="pf_rescued animation preview"]');
// [skin, clip, clip seconds to pause at]
const cases = [
  ['grandma', 'wave_window', 0.02], ['grandma', 'wave_window', 0.55], ['grandma', 'cheer', 0.3],
  ['twins', 'wave_window', 0.02], ['twins', 'wave_window', 0.9], ['twins', 'cheer', 0.45],
  ['dad', 'slide', 0.5], ['dad', 'land', 0.14],
  ['baby', 'wave_window', 0.55], ['baby', 'land', 0.34],
  ['teen', 'wave_window', 1.95], ['teen', 'slide', 1.15],
];
const report = { url, cases: [] };
for (const [skin, clip, at] of cases) {
  await page.locator('#skin').selectOption(skin);
  await page.locator('#clip').selectOption(clip);
  const resume = page.getByRole('button', { name: 'Resume', exact: true });
  if (await resume.count()) await resume.click();
  await page.getByRole('button', { name: 'Replay', exact: true }).click();
  await page.waitForTimeout(Math.max(40, at * 4 * 1000));
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const file = path.join(out, `${skin}-${clip}-${String(at).replace('.', 'p')}.png`);
  await canvas.screenshot({ path: file });
  report.cases.push({ skin, clip, at, file: path.relative(here, file) });
}
const log = await page.locator('.events li').evaluateAll(n => n.map(x => x.textContent.trim()));
report.log = log.slice(-40);
report.errors = errors;
await writeFile(path.join(here, 'report.json'), JSON.stringify(report, null, 2) + '\n');
await browser.close();
console.log(JSON.stringify({ frames: report.cases.length, errors }));
