import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Run from repository root; pass the installed Playwright entry module as argv[2].
const { chromium } = await import(pathToFileURL(path.resolve(process.argv[2])).href);
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--mute-audio'] });
const errors = [];
const requests = [];
try {
  const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await page.goto('http://127.0.0.1:3008/rigs', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Character clip review' }).waitFor();
  for (const selector of ['#rig', '#skin', '#clip', '#speed']) assert.equal(await page.locator(selector).isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Pause', exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Replay', exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('checkbox', { name: 'Show contract anchors' }).isDisabled(), true);
  assert.equal(await page.locator('canvas').count(), 0);
  assert.match(await page.locator('main').innerText(), /BLOCKED: no original character exports/);
  await page.screenshot({ path: 'qa/codex/rig-viewer/empty-desktop.png', fullPage: true });
  await page.locator('#frame').selectOption('mobile');
  assert.match(await page.locator('.preview-toolbar').innerText(), /PHONE SIZE STUDY/);
  assert.equal(await page.locator('.preview-frame').evaluate(node => Math.round(node.getBoundingClientRect().width)), 360);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).overflowY), 'hidden');
  await page.locator('footer').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('footer').evaluate(node => node.getBoundingClientRect().bottom <= window.innerHeight + 1), true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'qa/codex/rig-viewer/empty-phone.png', fullPage: true });
  const forbidden = requests.filter(url => /\/assets\/(?:spine|audio)\/|\.(?:mp3|ogg|wav|m4a|aac|flac)(?:\?|$)|\/(?:authenticate|wallet|bet)\b|:(?:3036|3037)\//i.test(url));
  assert.deepEqual(forbidden, [], 'empty viewer must not request missing rigs, audio, or RGS');
  assert.deepEqual(errors, [], 'viewer must not throw browser errors');
  const report = { status: 'PASS', tested: ['desktop empty state', 'disabled art controls', 'phone size frame', '390px no horizontal overflow and footer reachable', 'zero missing-rig/audio/RGS requests', 'zero page errors'], artMotion: 'NOT RUN — no original exports', requestCount: requests.length, forbidden, errors, browser: await browser.version(), muted: true };
  writeFileSync('qa/codex/rig-viewer/empty-state-report.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
