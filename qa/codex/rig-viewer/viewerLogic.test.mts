import assert from 'node:assert/strict';
import { test } from 'node:test';
import { availableRigNames, isLoopClip, appendLog, previewFrame } from '../../../apps/piggy_firefighters/src/routes/rigs/viewerLogic.ts';

test('missing exports cannot become preview choices', () => {
  assert.deepEqual(availableRigNames({}), []);
  assert.deepEqual(availableRigNames({ pf_dog: {}, unrelated: {} }), ['pf_dog']);
});

test('authored loop and once identities are preserved', () => {
  for (const clip of ['idle', 'idle_alt', 'sit_idle', 'run_loop', 'spray_loop', 'hold_sheet', 'wave_window', 'cheer']) assert.equal(isLoopClip(clip), true);
  for (const clip of ['slide', 'land', 'catch', 'celebrate', 'spray_start', 'spray_end']) assert.equal(isLoopClip(clip), false);
});

test('event history is bounded and reference scale never renormalizes art', () => {
  const log = Array.from({ length: 60 }, (_, id) => ({ id, text: String(id) }));
  assert.equal(appendLog(log, { id: 60, text: 'land' }).length, 60);
  assert.equal(appendLog(log, { id: 60, text: 'land' })[0].text, 'land');
  assert.equal(previewFrame('desktop').scale, 1);
  assert.equal(previewFrame('mobile').scale, 0.5);
});
