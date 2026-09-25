import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const helpers = await import('./capture-plan.mjs').catch(() => ({}));

test('missing exports block capture instead of accepting an empty readiness page', async () => {
  assert.equal(typeof helpers.inspectRig, 'function', 'export inspection must exist');
  const root = await mkdtemp(path.join(os.tmpdir(), 'pf-capture-'));
  try {
    assert.equal(await helpers.inspectRig(root, 'pf_chief'), null);
    assert.equal(helpers.captureStatus({ expected: 0, completed: 0, missing: [], errors: [] }), 'BLOCKED');
    assert.equal(helpers.captureStatus({ expected: 4, completed: 4, missing: ['pf_dog'], errors: [] }), 'BLOCKED');
  } finally { await rm(root, { recursive: true }); }
});

test('coverage includes every declared skin and clip at both speeds, including two loop cycles', () => {
  assert.equal(typeof helpers.planCases, 'function', 'coverage planning must exist');
  const plan = helpers.planCases('pf_rescued', [
    { name: 'wave_window', duration: 2, loop: true },
    { name: 'land', duration: 0.6, loop: false },
  ], ['grandma', 'baby'], ['desktop']);
  assert.equal(plan.length, 8);
  assert.equal(new Set(plan.map(c => c.key)).size, 8);
  assert.equal(plan.find(c => c.skin === 'baby' && c.clip === 'wave_window' && c.speed === 0.25).playMs, 16000);
  assert.equal(plan.find(c => c.skin === 'grandma' && c.clip === 'land' && c.speed === 1).playMs, 600);
  assert.throws(() => helpers.planCases('pf_chief', [{ name: 'idle', duration: 0 }], ['default'], ['desktop']), /duration/i);
});

test('completion evidence excludes pre-replay rows and detects an interrupted case', () => {
  const rows = [
    { id: 20, text: 'LOOP spray_loop' },
    { id: 21, text: 'PLAY spray_loop · default · loop' },
    { id: 22, text: 'LOOP spray_loop_extra' },
    { id: 23, text: 'LOOP spray_loop' },
  ];
  const progress = helpers.playbackEvidence(rows, { clip: 'spray_loop', skin: 'default', loop: true, afterId: 20 });
  assert.equal(progress.playId, 21);
  assert.equal(progress.boundaries, 1);
  assert.equal(progress.interrupted, false);
  assert.equal(helpers.playbackEvidence(rows, { clip: 'spray_loop', skin: 'default', loop: true, afterId: 21 }), null);
  const restarted = helpers.playbackEvidence([...rows, { id: 24, text: 'PLAY idle · default · loop' }],
    { clip: 'spray_loop', skin: 'default', loop: true, playId: 21 });
  assert.equal(restarted.interrupted, true);
});

test('served export proof requires JSON, atlas and every referenced texture to match disk bytes', async () => {
  assert.equal(typeof helpers.inspectRig, 'function', 'export inspection must exist');
  const root = await mkdtemp(path.join(os.tmpdir(), 'pf-capture-'));
  try {
    const dir = path.join(root, 'pf_chief');
    await mkdir(dir);
    await writeFile(path.join(dir, 'pf_chief.json'), JSON.stringify({ skeleton: { spine: '4.2.43' }, animations: { idle: {} }, skins: [{ name: 'default' }] }));
    await writeFile(path.join(dir, 'pf_chief.atlas'), 'page.png\nsize: 8,8\nfilter: Linear,Linear\nregion\n  bounds: 0,0,8,8\n');
    await writeFile(path.join(dir, 'page.png'), Buffer.from([137,80,78,71,13,10,26,10,1]));
    const info = await helpers.inspectRig(root, 'pf_chief');
    assert.equal(info.files.length, 3);
    assert.deepEqual(info.clips, ['idle']);
    assert(info.contractCoverage?.missingClips.includes('spray_start'), 'pilot captures must expose missing contract clips');
    assert(info.contractCoverage?.missingAnchors.includes('nozzle_tip'));
    assert(info.contractCoverage?.missingEvents.includes('spray_on'));
    const served = info.files.map(file => ({ path: file.path, sha256: file.sha256, bytes: file.bytes }));
    assert.doesNotThrow(() => helpers.verifyServed(info.files, served));
    assert.throws(() => helpers.verifyServed(info.files, served.slice(0, 2)), /not fetched/);
    assert.throws(() => helpers.verifyServed(info.files, served.map(file => ({ ...file, sha256: 'wrong' }))), /changed|mismatch/);
    await writeFile(path.join(dir, 'pf_chief.atlas'), '../outside.png\nsize: 8,8\n');
    await assert.rejects(helpers.inspectRig(root, 'pf_chief'), /outside|unsafe/i);
  } finally { await rm(root, { recursive: true }); }
});
