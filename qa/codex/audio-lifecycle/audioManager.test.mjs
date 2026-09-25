import test from 'node:test';
import assert from 'node:assert/strict';
import { createHarness, loadRealManifest } from './fake-web-audio.mjs';

test('unlock starts the original default bed and station ambience registered in the real manifest', async () => {
  const { CUES } = await loadRealManifest();
  assert.equal(CUES.base_loop_a.bus, 'music');
  assert.equal(CUES.ambient_station_loop.bus, 'sfx');
  const h = createHarness();
  await h.unlock();
  assert.equal(h.manager.currentBed, 'base_loop_a');
  await h.resolve('ambient_station_loop');
  assert.equal(h.sourcesFor('ambient_station_loop').length, 1);
});

test('the latest bed request wins when an older decode finishes last', async () => {
  const h = createHarness(); await h.unlock();
  h.manager.crossfadeToBed('rescue_loop'); h.manager.startBed('inferno_loop');
  await h.resolve('inferno_loop'); await h.resolve('rescue_loop');
  assert.equal(h.manager.currentBed, 'inferno_loop');
  assert.equal(h.sourcesFor('rescue_loop').length, 0);
});

test('requesting the current bed cancels an older pending switch', async () => {
  const h = createHarness(); await h.unlock(); await h.decode('base_loop_a');
  h.manager.startBed('base_loop_a');
  h.manager.crossfadeToBed('rescue_loop'); h.manager.startBed('base_loop_a');
  await h.resolve('rescue_loop');
  assert.equal(h.manager.currentBed, 'base_loop_a');
  assert.equal(h.sourcesFor('rescue_loop').length, 0);
});

test('a bonus bed requested before unlock is remembered without creating an AudioContext', async () => {
  const h = createHarness();
  h.manager.startBed('rescue_loop');
  assert.equal(h.contexts.length, 0);
  const unlocking = h.manager.unlock(); await h.settle();
  assert.ok(h.pending.has('rescue_loop'), 'unlock did not decode the remembered bonus bed');
  await h.resolve('rescue_loop'); await unlocking; await h.settle();
  assert.equal(h.manager.currentBed, 'rescue_loop');
  assert.equal(h.sourcesFor('base_loop_a').length, 0);
});

const voiceKinds = [
  ['held', 'held_fixture', (m, id) => m.playHeld(id), (m, id) => m.stopHeld(id)],
  ['SFX loop', 'loop_fixture', (m, id) => m.startSfxLoop(id), (m, id) => m.stopSfxLoop(id)],
  ['layer', 'layer_fixture', (m, id) => m.addLayer(id), (m, id) => m.removeLayer(id)],
];
for (const [kind, id, start, stop] of voiceKinds) {
  test(`${kind} stop before decode prevents a stale start`, async () => {
    const h = createHarness(); await h.unlock();
    start(h.manager, id); stop(h.manager, id); await h.resolve(id);
    assert.equal(h.sourcesFor(id).length, 0);
  });
  test(`${kind} stop/restart while decoding starts exactly the replacement`, async () => {
    const h = createHarness(); await h.unlock();
    start(h.manager, id); stop(h.manager, id); start(h.manager, id); await h.resolve(id);
    assert.equal(h.sourcesFor(id).length, 1);
    const replacement = h.sourcesFor(id)[0]; stop(h.manager, id);
    assert.equal(replacement.stopCalls.length, 1);
  });
  test(`${kind} old ended callback cannot remove its replacement`, async () => {
    const h = createHarness(); await h.unlock(); await h.decode(id);
    start(h.manager, id); const old = h.sourcesFor(id)[0]; stop(h.manager, id);
    start(h.manager, id); const replacement = h.sourcesFor(id)[1];
    old.emitEnded(); stop(h.manager, id);
    assert.equal(replacement.stopCalls.length, 1);
  });
}

test('a long one-shot completing after the 120ms deadline is dropped', async () => {
  const h = createHarness(); await h.unlock();
  h.manager.playCue('one_fixture'); h.advance(121); await h.resolve('one_fixture');
  assert.equal(h.sourcesFor('one_fixture').length, 0);
});

test('a one-shot ready exactly at 120ms can still start', async () => {
  const h = createHarness(); await h.unlock();
  h.manager.playCue('one_fixture'); h.advance(120); await h.resolve('one_fixture');
  assert.equal(h.sourcesFor('one_fixture').length, 1);
});

test('a held cue completing after 120ms does not arrive after its visual moment', async () => {
  const h = createHarness(); await h.unlock();
  h.manager.playHeld('held_fixture'); h.advance(121); await h.resolve('held_fixture');
  assert.equal(h.sourcesFor('held_fixture').length, 0);
});

test('pending held restart uses only the latest playback rate', async () => {
  const h = createHarness(); await h.unlock();
  h.manager.playHeld('held_fixture', { rate: 0.8 }); h.manager.stopHeld('held_fixture');
  h.manager.playHeld('held_fixture', { rate: 1.4 }); await h.resolve('held_fixture');
  assert.equal(h.sourcesFor('held_fixture').length, 1);
  assert.equal(h.sourcesFor('held_fixture')[0].playbackRate.value, 1.4);
});

test('deferred one-shots recheck maxInstances when decode completes', async () => {
  const h = createHarness(); await h.unlock();
  h.manager.playCue('one_fixture'); h.manager.playCue('one_fixture'); await h.resolve('one_fixture');
  assert.equal(h.sourcesFor('one_fixture').length, 1);
});

test('deferred cues coalesce across a family when both decodes complete', async () => {
  const h = createHarness(); await h.unlock();
  const opts = { family: 'reel', coalesceMs: 80 };
  h.manager.playCue('one_fixture', opts); h.manager.playCue('other_fixture', opts);
  await h.resolve('one_fixture'); await h.resolve('other_fixture');
  assert.equal(h.sourcesFor('one_fixture').length + h.sourcesFor('other_fixture').length, 1);
});

test('deferred starts establish cooldown for subsequent requests', async () => {
  const h = createHarness(); await h.unlock();
  h.manager.playCue('cooldown_fixture'); await h.resolve('cooldown_fixture');
  h.sourcesFor('cooldown_fixture')[0].emitEnded(); h.advance(10);
  h.manager.playCue('cooldown_fixture');
  assert.equal(h.sourcesFor('cooldown_fixture').length, 1);
});

test('teardown stops every pre-existing live or fading source and retains decoded caches', async () => {
  const h = createHarness(); await h.unlock();
  await h.decode('base_loop_a', 'rescue_loop', 'inferno_loop', 'held_fixture', 'loop_fixture', 'layer_fixture', 'one_fixture');
  h.manager.startBed('rescue_loop'); h.manager.crossfadeToBed('inferno_loop', 3000);
  h.manager.playHeld('held_fixture'); h.manager.stopHeld('held_fixture', 3000);
  h.manager.playHeld('held_fixture'); h.manager.startSfxLoop('loop_fixture');
  h.manager.addLayer('layer_fixture'); h.manager.playCue('one_fixture');
  const existing = [...h.sources]; const fetchCount = h.fetches.length;
  h.manager.teardownToBase(); await h.settle();
  assert.equal(h.manager.currentBed, 'base_loop_a');
  for (const source of existing) {
    assert.ok(source.stopCalls.length, `${source.buffer.id} source was never stopped`);
    assert.ok(source.stopCalls.at(-1)[0] <= h.audioTime + 0.8, `${source.buffer.id} retained its long old fade`);
  }
  await h.decode('held_fixture', 'loop_fixture', 'layer_fixture', 'one_fixture');
  assert.equal(h.fetches.length, fetchCount, 'teardown discarded reusable decoded buffers');
});

test('teardown cancels all pending cue kinds before their decodes complete', async () => {
  const h = createHarness(); await h.unlock(); await h.decode('base_loop_a');
  h.manager.crossfadeToBed('rescue_loop'); h.manager.playHeld('held_fixture');
  h.manager.startSfxLoop('loop_fixture'); h.manager.addLayer('layer_fixture'); h.manager.playCue('one_fixture');
  h.manager.teardownToBase();
  for (const id of ['rescue_loop', 'held_fixture', 'loop_fixture', 'layer_fixture', 'one_fixture']) await h.resolve(id);
  assert.equal(h.manager.currentBed, 'base_loop_a');
  for (const id of ['rescue_loop', 'held_fixture', 'loop_fixture', 'layer_fixture', 'one_fixture']) assert.equal(h.sourcesFor(id).length, 0, id);
});

test('an old one-shot ended callback cannot free a replacement instance after teardown', async () => {
  const h = createHarness(); await h.unlock(); await h.decode('base_loop_a', 'one_fixture');
  h.manager.playCue('one_fixture'); const old = h.sourcesFor('one_fixture')[0];
  const queuedEnded = old.onended;
  assert.equal(typeof queuedEnded, 'function');
  h.manager.teardownToBase(); h.manager.playCue('one_fixture');
  assert.equal(h.sourcesFor('one_fixture').length, 2);
  // A browser event already queued before teardown can retain the callback,
  // even though teardown clears source.onended before replacing the voice.
  queuedEnded(); h.manager.playCue('one_fixture');
  assert.equal(h.sourcesFor('one_fixture').length, 2);
});

test('resumed audio drops a deferred cue when wall time passed 120ms while context time was frozen', async () => {
  const h = createHarness(); await h.unlock();
  h.manager.playCue('one_fixture');
  const contextTime = h.audioTime;
  h.contexts[0].state = 'suspended'; h.advanceWall(121);
  h.manager.resume(); await h.resolve('one_fixture');
  assert.equal(h.audioTime, contextTime);
  assert.equal(h.sourcesFor('one_fixture').length, 0);
  h.manager.playCue('one_fixture');
  assert.equal(h.sourcesFor('one_fixture').length, 1, 'fresh cues should still start after resume');
});

test('hidden then visible cancels pending one-shot and held cues even inside their deadline', async () => {
  const h = createHarness(); await h.unlock();
  h.manager.playCue('one_fixture'); h.manager.playHeld('held_fixture');
  h.setHidden(true); h.advanceWall(10); h.setHidden(false);
  await h.resolve('one_fixture'); await h.resolve('held_fixture');
  assert.equal(h.sourcesFor('one_fixture').length, 0);
  assert.equal(h.sourcesFor('held_fixture').length, 0);
  h.manager.playCue('one_fixture'); h.manager.playHeld('held_fixture');
  assert.equal(h.sourcesFor('one_fixture').length, 1);
  assert.equal(h.sourcesFor('held_fixture').length, 1);
});

test('pending loops and layers survive hide/show unless explicitly stopped', async () => {
  for (const stopWhileHidden of [false, true]) {
    const h = createHarness(); await h.unlock();
    h.manager.startSfxLoop('loop_fixture'); h.manager.addLayer('layer_fixture');
    h.setHidden(true);
    if (stopWhileHidden) {
      h.manager.stopSfxLoop('loop_fixture'); h.manager.removeLayer('layer_fixture');
    }
    h.setHidden(false);
    await h.resolve('loop_fixture'); await h.resolve('layer_fixture');
    assert.equal(h.sourcesFor('loop_fixture').length, stopWhileHidden ? 0 : 1);
    assert.equal(h.sourcesFor('layer_fixture').length, stopWhileHidden ? 0 : 1);
  }
});

test('loop decode finishing while hidden is dropped without a queued restart; music layers remain scheduled', async () => {
  const h = createHarness(); await h.unlock();
  h.manager.startSfxLoop('loop_fixture'); h.manager.addLayer('layer_fixture');
  h.setHidden(true);
  await h.resolve('loop_fixture'); await h.resolve('layer_fixture');
  h.setHidden(false);
  assert.equal(h.sourcesFor('loop_fixture').length, 0);
  assert.equal(h.sourcesFor('layer_fixture').length, 1);
  h.manager.startSfxLoop('loop_fixture');
  assert.equal(h.sourcesFor('loop_fixture').length, 1, 'a fresh loop request remains valid');
});

test('changing turbo cancels pending transients but allows fresh high-priority cues', async () => {
  const h = createHarness(); await h.unlock();
  h.manager.playCue('one_fixture'); h.manager.playHeld('held_fixture'); h.manager.setTurbo(1);
  await h.resolve('one_fixture'); await h.resolve('held_fixture');
  assert.equal(h.sourcesFor('one_fixture').length, 0);
  assert.equal(h.sourcesFor('held_fixture').length, 0);
  h.manager.playCue('one_fixture'); h.manager.playHeld('held_fixture');
  assert.equal(h.sourcesFor('one_fixture').length, 1);
  assert.equal(h.sourcesFor('held_fixture').length, 1);
});

test('mute, unmute and context resume retain the bonus bed and player gains', async () => {
  const h = createHarness(); await h.unlock(); await h.decode('rescue_loop');
  h.manager.startBed('rescue_loop');
  const bonus = h.sourcesFor('rescue_loop')[0];
  h.manager.setVolumeStep(12); h.manager.setBusVolume('music', 0.31); h.manager.setBusVolume('sfx', 0.47);
  h.manager.toggleMute();
  assert.equal(h.manager.masterFactor, 0);
  h.contexts[0].state = 'suspended'; h.manager.resume(); await h.manager.unlock();
  assert.equal(h.manager.currentBed, 'rescue_loop');
  assert.equal(h.manager.isMuted, true);
  h.manager.toggleMute();
  assert.equal(h.manager.masterFactor, 0.6);
  assert.equal(h.manager.musicGain, 0.31); assert.equal(h.manager.sfxGain, 0.47);
  assert.equal(h.manager.musicGainLive, 0.31); assert.equal(h.manager.sfxGainLive, 0.47);
  assert.equal(h.sourcesFor('rescue_loop').length, 1);
  assert.equal(bonus.stopCalls.length, 0);
});

test('a 92 BPM layer is removed and cannot restart over a 100 BPM bonus bed', async () => {
  const h = createHarness(); await h.unlock(); await h.decode('layer_fixture', 'rescue_loop');
  h.manager.addLayer('layer_fixture');
  const layer = h.sourcesFor('layer_fixture')[0];
  h.manager.crossfadeToBed('rescue_loop');
  assert.equal(layer.stopCalls.length, 1);
  h.manager.addLayer('layer_fixture');
  assert.equal(h.sourcesFor('layer_fixture').length, 1);
  assert.equal(h.manager.currentBed, 'rescue_loop');
});

test('repeated unlock preserves the active bonus bed', async () => {
  const h = createHarness(); await h.unlock(); await h.decode('rescue_loop');
  h.manager.startBed('rescue_loop'); await h.manager.unlock(); await h.settle();
  assert.equal(h.manager.currentBed, 'rescue_loop');
});

test('delayed warm ambience never starts after the game has entered a bonus', async () => {
  const h = createHarness(); await h.unlock(); await h.decode('rescue_loop');
  h.manager.startBed('rescue_loop'); await h.settle();
  // Correct default ambience belongs to unlock's warm work, even if it decodes after the scene changes.
  assert.ok(h.pending.has('ambient_station_loop'));
  await h.resolve('ambient_station_loop'); await h.runTimers();
  assert.equal(h.sourcesFor('ambient_station_loop').length, 0);
  assert.equal(h.manager.currentBed, 'rescue_loop');
});

test('equal-tempo whole-bar music preserves phase while 92 to 100 BPM starts at bar one', async () => {
  const h = createHarness(); await h.unlock(); await h.decode('base_loop_a', 'base_loop_b', 'rescue_loop');
  h.manager.startBed('base_loop_a'); const base = h.sourcesFor('base_loop_a').at(-1);
  h.advance(1300); h.manager.crossfadeToBed('base_loop_b');
  const aligned = h.sourcesFor('base_loop_b').at(-1);
  const expectedOffset = 0.06 + aligned.startCalls[0][0] - base.startCalls[0][0];
  assert.ok(Math.abs(aligned.startCalls[0][1] - expectedOffset) < 1e-8);
  h.advance(1100); h.manager.crossfadeToBed('rescue_loop');
  assert.ok(Math.abs(h.sourcesFor('rescue_loop').at(-1).startCalls[0][1] - 0.06) < 1e-8);
});
