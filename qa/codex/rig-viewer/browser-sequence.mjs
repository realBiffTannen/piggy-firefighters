import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { captureRigResponses, inspectRig, sha256, verifyServed } from './capture-plan.mjs';

const [playwrightEntry, destination] = process.argv.slice(2);
assert(playwrightEntry && destination, 'Usage: node browser-sequence.mjs /absolute/playwright/index.mjs NEW_OUTPUT_DIRECTORY');
const repo = path.resolve(import.meta.dirname, '../../..');
const sourcePaths = [
  ...['+page@.svelte', 'ViewerCanvas.svelte', 'ViewerScene.svelte', 'ViewerPlayback.svelte', 'viewerLogic.ts']
    .map(name => `apps/piggy_firefighters/src/routes/rigs/${name}`),
  ...['rigLogic.ts', 'rigRegistry.ts', 'playbackControl.ts'].map(name => `apps/piggy_firefighters/src/game/anim/${name}`),
  'qa/codex/rig-viewer/browser-sequence.mjs', 'qa/codex/rig-viewer/capture-plan.mjs',
];
async function sourceHashes() {
  return Object.fromEntries(await Promise.all(sourcePaths.map(async name => [name, sha256(await readFile(path.join(repo, name)))])));
}
const sourceBefore = await sourceHashes();
const output = path.resolve(destination);
assert(output.startsWith(path.join(repo, 'qa/codex/rig-viewer') + path.sep), 'Output must be a new rig-viewer QA directory');
await mkdir(output); // Deliberately refuses to overwrite evidence.
const root = path.join(repo, 'apps/piggy_firefighters/static/assets/spine');
const before = await inspectRig(root, 'pf_chief');
assert(before, 'Original Chief export is required');
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--mute-audio'] });
const context = await browser.newContext({ viewport: { width: 1360, height: 1000 }, serviceWorkers: 'block',
  recordVideo: { dir: output, size: { width: 1360, height: 1000 } } });
const page = await context.newPage();
const errors = [], responses = [], cases = [];
const reads = await captureRigResponses(context, 'pf_chief', row => responses.push(row), error => errors.push(String(error)));
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => {
  if (/\/rgs\/|\/wallet\/|\/assets\/audio\//.test(request.url())) errors.push(`Unexpected game/audio request: ${request.url()}`);
});
async function logs() {
  return page.locator('.events li').evaluateAll(items => items.map(item => ({
    id: Number(item.querySelector('span')?.textContent),
    text: Array.from(item.childNodes).filter(node => node.nodeName !== 'SPAN').map(node => node.textContent).join('').trim(),
  })).sort((a, b) => a.id - b.id));
}
async function clearLogs() {
  const clear = page.getByRole('button', { name: 'Clear', exact: true });
  if (await clear.isEnabled()) await clear.click();
}
async function complete() {
  await page.waitForFunction(() => [...document.querySelectorAll('.events li')].some(item => item.textContent.includes('SEQUENCE COMPLETE chief_spray')), null, { timeout: 90000 });
}
let failure;
try {
  await page.goto('http://127.0.0.1:3008/rigs?pilot=1');
  await page.locator('#spray-sequence:enabled').waitFor({ timeout: 60000 });
  for (const speed of [1, 0.25]) {
    let pausedFrameSha256;
    await page.selectOption('#speed', String(speed));
    await clearLogs();
    await page.locator('#spray-sequence').click();
    if (speed === 0.25) {
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      const paused = await logs();
      const pausedFrame = await page.locator('.preview-frame').screenshot({ path: path.join(output, 'paused-before.png') });
      await page.waitForTimeout(500);
      assert.deepEqual(await logs(), paused, 'Paused sequence advanced its clips/events');
      const stillPaused = await page.locator('.preview-frame').screenshot({ path: path.join(output, 'paused-after.png') });
      assert.equal(sha256(stillPaused), sha256(pausedFrame), 'Character pose moved while paused');
      pausedFrameSha256 = sha256(pausedFrame);
      await page.getByRole('button', { name: 'Resume', exact: true }).click();
    }
    await complete();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    const rows = await logs();
    const played = rows.filter(row => row.text.startsWith('PLAY ')).map(row => row.text.split(' · ')[0]);
    assert.deepEqual(played, ['PLAY spray_start', 'PLAY spray_loop', 'PLAY spray_end']);
    const find = text => rows.find(row => row.text.startsWith(text))?.id;
    assert(find('PLAY spray_start') < find('EVENT spray_on') && find('EVENT spray_on') < find('PLAY spray_loop'), 'spray_on did not occur during start');
    assert(find('PLAY spray_end') < find('EVENT spray_off') && find('EVENT spray_off') < find('SEQUENCE COMPLETE'), 'spray_off did not occur during end');
    const hold = Number(rows.find(row => row.text.startsWith('SEQUENCE HOLD spray_loop'))?.text.match(/@ ([\d.]+)s/)?.[1]);
    assert(Number.isFinite(hold) && hold >= 0.799 && hold <= 0.8 + 0.1 * speed + 0.001, 'Loop hold differs from runtime animation-time threshold');
    const screenshot = `sequence-${speed}-final.png`;
    await page.locator('.preview-frame').screenshot({ path: path.join(output, screenshot) });
    cases.push({ speed, pausedAndResumed: speed === 0.25, pausedFrameSha256, loopTrackSeconds: hold, rows, screenshot });
  }
  await page.selectOption('#speed', '1');
  await clearLogs();
  await page.locator('#spray-sequence').click();
  await page.selectOption('#clip', 'spray_loop');
  const lastPlay = (await logs()).filter(row => row.text.startsWith('PLAY ')).at(-1);
  assert(lastPlay?.text.startsWith('PLAY spray_loop'), 'Manual clip selection failed to replace sequence');
  await page.waitForFunction(afterId => [...document.querySelectorAll('.events li')].filter(item => {
    const id = Number(item.querySelector('span')?.textContent);
    return id > afterId && item.textContent.includes('LOOP spray_loop');
  }).length >= 2, lastPlay.id, { timeout: 60000 });
  const cancelled = await logs();
  assert(!cancelled.some(row => row.text.startsWith('SEQUENCE COMPLETE') || row.text.startsWith('PLAY spray_end')), 'Cancelled sequence advanced after replacement');
  assert(!cancelled.some(row => row.id > lastPlay.id && row.text.startsWith('PLAY ')), 'Replacement was interrupted by a stale sequence step');
  cases.push({ manualClipCancelsSequence: true, replacementPlayId: lastPlay.id, observedReplacementLoops: 2, rows: cancelled });
  await Promise.all(reads);
  verifyServed(before.files, responses);
  assert.deepEqual((await inspectRig(root, 'pf_chief')).files, before.files, 'Export changed during probe');
  assert.deepEqual(await sourceHashes(), sourceBefore, 'Viewer or probe sources changed during verification');
  assert.deepEqual(errors, []);
} catch (error) { failure = String(error); }
await context.close();
await browser.close();
const video = path.basename(await page.video().path());
const report = { status: failure ? 'FAIL' : 'PASS', failure, browser: browser.version(),
  assetCapture: 'Server response bytes hashed and forwarded unchanged through a read-only Playwright route',
  sourceSha256: sourceBefore,
  scope: 'Dev-only real-Chief sequence controls, keyed events, pause/resume and replacement; not mounted gameplay or artistic acceptance',
  motionAcceptance: 'NOT RUN', export: before, responses, cases, errors, video,
  videoSha256: sha256(await readFile(path.join(output, video))) };
await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, report: path.join(output, 'report.json'), failure }));
if (failure) process.exitCode = 1;
