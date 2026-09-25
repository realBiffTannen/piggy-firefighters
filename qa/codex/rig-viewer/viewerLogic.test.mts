import assert from 'node:assert/strict';
import { test } from 'node:test';
import { availableRigNames, isLoopClip, appendLog, previewFrame, isUsablePilotRigData } from '../../../apps/piggy_firefighters/src/routes/rigs/viewerLogic.ts';

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

const pilotRequirements = { anchors: ['nozzle_tip'], events: ['spray_on'], skins: ['default'] };
const pilot = () => ({ version: '4.2.43', width: 280, height: 420,
  animations: [{ name: 'spray_start', duration: .6, timelines: [{}] }],
  bones: [{ name: 'root', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, { name: 'nozzle_tip' }],
  events: [{ name: 'spray_on' }], skins: [{ name: 'default' }],
  findAnimation() {}, findBone() {}, findSkin() {},
});

test('pilot preview accepts a parsed partial performance without inventing other clips', () => {
  const data = pilot();
  assert.equal(isUsablePilotRigData(data, pilotRequirements), true);
  assert.deepEqual(data.animations.map(a => a.name), ['spray_start']);
  assert.equal(isUsablePilotRigData({ ...data, version: '4.3.0' }, pilotRequirements), false);
  assert.equal(isUsablePilotRigData({ ...data, findAnimation: undefined }, pilotRequirements), false);
});

test('pilot preview rejects empty motion, broken anchors and a displaced root', () => {
  const data = pilot();
  assert.equal(isUsablePilotRigData({ ...data, animations: [] }, pilotRequirements), false);
  assert.equal(isUsablePilotRigData({ ...data, animations: [{ name: 'spray_start', duration: 0, timelines: [] }] }, pilotRequirements), false);
  assert.equal(isUsablePilotRigData({ ...data, bones: data.bones.slice(0, 1) }, pilotRequirements), false);
  assert.equal(isUsablePilotRigData({ ...data, bones: [{ ...data.bones[0], y: 1 }, data.bones[1]] }, pilotRequirements), false);
  assert.equal(isUsablePilotRigData({ ...data, events: [] }, pilotRequirements), false);
  assert.equal(isUsablePilotRigData({ ...data, skins: [] }, pilotRequirements), false);
});
