/** Real-export evidence only. Run from the repo root; see README.md. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { execFileSync } from 'node:child_process';
import { RIGS, FRAMES, inspectRig, planCases, verifyServed, playbackEvidence, captureStatus, sha256, captureRigResponses } from './capture-plan.mjs';

const qa = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(qa, '../../..');
const exportRoot = path.join(root, 'apps/piggy_firefighters/static/assets/spine');
const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  url: { type: 'string', default: 'http://127.0.0.1:3008/rigs' },
  output: { type: 'string' }, rig: { type: 'string', multiple: true },
  frames: { type: 'string', default: 'desktop' },
} });
const requested = values.rig ?? RIGS;
const frames = values.frames.split(',');
assert(requested.length && requested.every(rig => RIGS.includes(rig)), 'Use --rig with a contract rig name');
assert(frames.length && frames.every(frame => FRAMES[frame]), 'Use --frames desktop,mobile');
const url = new URL(values.url);
assert(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Capture requires the local development viewer');
const output = path.resolve(values.output ?? path.join(qa, 'captures', new Date().toISOString().replace(/[:.]/g, '-')));
assert(output.startsWith(qa + path.sep), 'Output must stay under qa/codex/rig-viewer/');
await mkdir(path.dirname(output), { recursive: true });
await mkdir(output); // Never overwrite a prior evidence run.
const report = {
  schemaVersion: 1, status: 'RUNNING', startedAt: new Date().toISOString(), viewerUrl: url.href,
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  muted: true, browserArgs: ['--mute-audio'], requestedRigs: requested, frames,
  authoringPilot: url.searchParams.get('pilot') === '1',
  contractAcceptance: 'NOT RUN — pilot and complete-export captures are evidence only',
  motionAcceptance: 'NOT RUN — recorded evidence requires human motion review',
  limitations: ['Isolated clips only: no game director, travel, crossfade, gameplay FX, audio, RGS or device acceptance'],
  exports: [], missing: [], sessions: [], cases: [], errors: [], warnings: [], expectedCases: 0,
};
if (report.authoringPilot) report.limitations.push('WORK IN PROGRESS: pilot viewer allows incomplete contracts; missing declarations are listed per export');
const checkpoint = () => writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const addError = (kind, message, session) => report.errors.push({ kind, message: String(message), session });
const readLog = page => page.locator('.events li').evaluateAll(nodes => nodes.map(node => {
  const id = node.querySelector('span')?.textContent ?? '';
  return { id: Number(id), text: node.textContent.slice(id.length).trim() };
}));
async function waitForPlayback(page, identity, count, timeout) {
  const deadline = performance.now() + timeout;
  while (performance.now() < deadline) {
    const progress = playbackEvidence(await readLog(page), identity);
    assert(!progress?.interrupted, 'Capture interrupted by another PLAY');
    if (progress && progress.boundaries >= count) return progress;
    await page.waitForTimeout(50);
  }
  throw new Error(`Timed out waiting for new PLAY/boundary evidence: ${identity.clip}`);
}
let browser;
try {
  for (const rig of requested) {
    const info = await inspectRig(exportRoot, rig);
    if (info) report.exports.push(info);
    else report.missing.push(rig);
  }
  if (!report.exports.length) {
    report.blockedReason = 'No complete original JSON/atlas exports are present. No browser or video capture was started.';
  } else {
    assert(positionals[0], 'Pass the installed Playwright entry module as the first argument');
    const { chromium } = await import(pathToFileURL(path.resolve(positionals[0])).href);
    browser = await chromium.launch({ channel: 'chromium', headless: true, args: report.browserArgs });
    report.browser = await browser.version();
    for (const info of report.exports) for (const frame of frames) for (const speed of [1, 0.25]) {
      const sessionId = `${info.rig}-${frame}-${speed === 1 ? 'normal' : 'quarter'}`;
      const directory = path.join(output, sessionId);
      await mkdir(directory);
      const context = await browser.newContext({ viewport: FRAMES[frame].viewport, deviceScaleFactor: 1,
        reducedMotion: 'no-preference', serviceWorkers: 'block', recordVideo: { dir: directory, size: FRAMES[frame].viewport } });
      const session = { id: sessionId, rig: info.rig, frame, speed, ...FRAMES[frame],
        assetCapture: 'Server response bytes hashed and forwarded unchanged through a read-only Playwright route',
        status: 'RUNNING', servedExports: [], networkErrors: [], consoleErrors: [], pageErrors: [] };
      report.sessions.push(session);
      const responseJobs = await captureRigResponses(context, info.rig,
        row => session.servedExports.push(row), error => addError('responseHash', error, sessionId));
      const page = await context.newPage();
      const recordingStarted = performance.now();
      const video = page.video();
      page.on('pageerror', error => { session.pageErrors.push(error.message); addError('pageerror', error.message, sessionId); });
      page.on('console', message => {
        if (message.type() === 'error') { session.consoleErrors.push(message.text()); addError('console', message.text(), sessionId); }
        if (message.type() === 'warning') report.warnings.push({ session: sessionId, message: message.text() });
      });
      page.on('requestfailed', request => {
        const failure = { url: request.url(), error: request.failure()?.errorText };
        session.networkErrors.push(failure); addError('requestfailed', JSON.stringify(failure), sessionId);
      });
      page.on('response', response => {
        if (response.status() >= 400) addError('http', `${response.status()} ${response.url()}`, sessionId);
      });
      try {
        await page.goto(url.href, { waitUntil: 'networkidle', timeout: 30000 });
        await page.getByRole('heading', { name: 'Character clip review' }).waitFor();
        assert(!await page.locator('#rig').isDisabled(), 'BLOCKED: viewer has no original export choices');
        const choices = await page.locator('#rig option').evaluateAll(nodes => nodes.map(node => node.value));
        assert(choices.includes(info.rig), `BLOCKED: ${info.rig} is absent from runtime choices; restart the dev server after installing exports`);
        if (await page.locator('#rig').inputValue() !== info.rig) await page.locator('#rig').selectOption(info.rig);
        await page.waitForFunction(rig => {
          const clips = document.querySelector('#clip');
          return clips && !clips.disabled && document.querySelector('.events')?.textContent.includes(`LOADED ${rig}`);
        }, info.rig, { timeout: 15000 });
        const canvas = page.locator(`canvas[aria-label="${info.rig} animation preview"]`);
        assert.equal(await canvas.count(), 1, 'Expected one validated original rig canvas');
        await page.locator('#frame').selectOption(frame);
        await page.locator('#speed').selectOption(String(speed));
        const declaredClips = await page.locator('#clip option').evaluateAll(nodes => nodes.map(node => node.value));
        const skins = await page.locator('#skin option').evaluateAll(nodes => nodes.map(node => node.value));
        assert.deepEqual([...declaredClips].sort(), [...info.clips].sort(), 'Loaded clips differ from hashed export');
        assert.deepEqual([...skins].sort(), [...info.skins].sort(), 'Loaded skins differ from hashed export');
        const clips = [];
        for (const clip of declaredClips) {
          await page.locator('#clip').selectOption(clip);
          const note = await page.locator('.clip-note').innerText();
          const match = /^(\d+(?:\.\d+)?)s/.exec(note);
          assert(match, `Missing loaded duration: ${clip}`);
          clips.push({ name: clip, duration: Number(match[1]), loop: note.includes('authored loop') });
        }
        session.loaded = { clips, skins, canvas: await canvas.boundingBox() };
        await Promise.all(responseJobs);
        verifyServed(info.files, session.servedExports);
        const cases = planCases(info.rig, clips, skins, [frame]).filter(item => item.speed === speed);
        report.expectedCases += cases.length;
        for (const [index, item] of cases.entries()) {
          const evidence = { ...item, status: 'RUNNING', screenshots: [], eventLog: [] };
          report.cases.push(evidence);
          const pause = page.getByRole('button', { name: 'Pause', exact: true });
          if (await pause.count()) await pause.evaluate(button => button.click());
          await page.locator('#skin').selectOption(item.skin);
          await page.locator('#clip').selectOption(item.clip);
          const afterId = Math.max(0, ...(await readLog(page)).map(row => row.id));
          const clear = page.getByRole('button', { name: 'Clear', exact: true });
          if (await clear.isEnabled()) await clear.click();
          await canvas.scrollIntoViewIfNeeded();
          const started = performance.now();
          // Keep the stage visible on phone layouts; a pointer click would scroll
          // to the off-screen control before the clip starts.
          await page.getByRole('button', { name: 'Replay', exact: true }).evaluate(button => button.click());
          const identity = { clip: item.clip, skin: item.skin, loop: item.loop };
          const start = await waitForPlayback(page, { ...identity, afterId }, 0, 3000);
          identity.playId = start.playId;
          evidence.playRowId = start.playId;
          evidence.playConfirmedElapsedMs = Math.round(performance.now() - started);
          evidence.session = sessionId;
          evidence.approxVideoStartMs = Math.round(started - recordingStarted);
          evidence.videoTimingNote = 'Offsets use host time since page creation; screenshots record actual elapsed time. WebM recorder startup may add an offset.';
          // Wall-time samples are not animation phases: the viewer clamps ticker deltas.
          const targets = [0.12, 0.5, 0.9].map(fraction => Math.round(item.playMs * fraction));
          for (const [frameIndex, target] of targets.entries()) {
            const delay = target - (performance.now() - started);
            if (delay > 0) await page.waitForTimeout(delay);
            const filename = `${String(index + 1).padStart(3, '0')}-frame-${frameIndex + 1}.png`;
            const absolute = path.join(directory, filename);
            await page.locator('.preview-frame').screenshot({ path: absolute });
            evidence.screenshots.push({ file: path.relative(output, absolute), sample: 'nominal wall-time sample', targetMs: target,
              elapsedMs: Math.round(performance.now() - started), sha256: sha256(await readFile(absolute)) });
          }
          const remainder = item.playMs + 200 - (performance.now() - started);
          if (remainder > 0) await page.waitForTimeout(remainder);
          const boundary = await waitForPlayback(page, identity, item.cycles, Math.max(3000, item.playMs));
          await page.getByRole('button', { name: 'Pause', exact: true }).evaluate(button => button.click());
          const finalPath = path.join(directory, `${String(index + 1).padStart(3, '0')}-boundary-paused.png`);
          await page.locator('.preview-frame').screenshot({ path: finalPath });
          evidence.screenshots.push({ file: path.relative(output, finalPath),
            sample: item.loop ? 'paused after verified loop boundaries; not an exact seam frame' : 'paused final pose after verified completion',
            elapsedMs: Math.round(performance.now() - started), sha256: sha256(await readFile(finalPath)) });
          evidence.verifiedBoundaries = boundary.boundaries;
          evidence.eventLog = (await readLog(page)).filter(row => row.id >= start.playId);
          evidence.approxVideoEndMs = Math.round(performance.now() - recordingStarted);
          evidence.status = 'CAPTURED';
          await checkpoint();
        }
        await Promise.all(responseJobs);
        verifyServed(info.files, session.servedExports);
        session.status = 'CAPTURED';
      } catch (error) {
        session.status = 'FAIL'; addError('capture', error.stack ?? error, sessionId);
        await page.screenshot({ path: path.join(directory, 'failure.png'), fullPage: true }).catch(() => {});
      } finally {
        await context.close();
        await Promise.all(responseJobs);
        if (video) {
          const file = await video.path();
          session.video = { file: path.relative(output, file), sha256: sha256(await readFile(file)), audio: 'muted at browser launch' };
        }
        await checkpoint();
      }
    }
    for (const before of report.exports) {
      const after = await inspectRig(exportRoot, before.rig);
      assert.deepEqual(after?.files, before.files, `Export changed during capture: ${before.rig}`);
    }
  }
} catch (error) { addError('runner', error.stack ?? error); }
finally {
  if (browser) await browser.close();
  report.completedCases = report.cases.filter(item => item.status === 'CAPTURED').length;
  report.status = captureStatus({ expected: report.expectedCases, completed: report.completedCases,
    missing: report.missing, errors: report.errors });
  report.finishedAt = new Date().toISOString();
  await checkpoint();
  console.log(JSON.stringify({ status: report.status, completedCases: report.completedCases,
    expectedCases: report.expectedCases, missing: report.missing, errors: report.errors.length,
    report: path.join(output, 'report.json'), motionAcceptance: report.motionAcceptance }, null, 2));
  process.exitCode = report.status === 'CAPTURED' ? 0 : report.status === 'BLOCKED' ? 2 : 1;
}
