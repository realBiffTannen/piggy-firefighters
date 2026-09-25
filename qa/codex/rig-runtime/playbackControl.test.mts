import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../../packages/pixi-svelte/package.json', import.meta.url));
const { SkeletonData, BoneData, Skeleton, AnimationState, AnimationStateData, Animation, TranslateTimeline, EventTimeline, EventData, Event, Physics } = require('@esotericsoftware/spine-core');
const control = await import('../../../apps/piggy_firefighters/src/game/anim/playbackControl.ts').catch(() => null);
const logic = await import('../../../apps/piggy_firefighters/src/game/anim/rigLogic.ts');

test('A/B/C rescues retain independent snapshots and cancellation discards queued travel', () => {
  assert.ok(control && typeof control.createRescueQueue === 'function', 'snapshotting rescue queue is required');
  const queue = control.createRescueQueue();
  const rescue = (skin: 'grandma' | 'twins' | 'baby') => ({ steps: [{ animation: 'slide', loop: false }], travel: true, skin });
  const path = { fromX: 10, fromY: 20, toX: 100, toY: 200 };
  const activeA = control.snapshotRigRequest(rescue('grandma'), path);
  path.fromX = 30;
  queue.push(rescue('twins'), path);
  path.fromX = 50;
  queue.push(rescue('baby'), path);
  path.fromX = 999;
  const queuedB = queue.shift()!;
  const queuedC = queue.shift()!;
  assert.deepEqual([activeA.path?.fromX, queuedB.path?.fromX, queuedC.path?.fromX], [10, 30, 50]);
  assert.deepEqual([activeA.plan.skin, queuedB.plan.skin, queuedC.plan.skin], ['grandma', 'twins', 'baby']);
  queue.push(queuedB.plan, queuedB.path);
  queue.push(queuedC.plan, queuedC.path);
  queue.clear();
  assert.equal(queue.shift(), undefined, 'cancelled requests must not revive on the next idle transition');
});

test('FX callbacks wait for updated world transforms and cancellation drops queued callbacks', () => {
  assert.ok(control, 'post-transform frame queue is required');
  let epoch = 1;
  const emitted: number[] = [];
  const queue = control.createFrameQueue(value => value === epoch);
  const data = new SkeletonData();
  data.bones.push(new BoneData(0,'root',null));
  const move = new TranslateTimeline(1,0,0);
  move.setFrame(0,0,42,0);
  const cue = new EventData('spray_on');
  const events = new EventTimeline(1);
  events.setFrame(0,new Event(0,cue));
  data.animations.push(new Animation('spray_start',[move,events],.6));
  const skeleton = new Skeleton(data);
  const state = new AnimationState(new AnimationStateData(data));
  state.addListener({event: () => queue.defer(epoch, () => emitted.push(skeleton.bones[0].worldX))});
  state.setAnimation(0,'spray_start',false);
  state.apply(skeleton); // Real Spine dispatches before world transforms.
  assert.deepEqual(emitted, []);
  assert.equal(skeleton.bones[0].worldX,0);
  skeleton.updateWorldTransform(Physics.update);
  queue.flush();
  assert.deepEqual(emitted, [42]);
  queue.defer(epoch, () => emitted.push(99));
  epoch++;
  queue.flush();
  assert.deepEqual(emitted, [42]);
});

test('changing clips keeps the outgoing pose for a 150ms mix and reaches the new setup pose', () => {
  assert.ok(control, 'clip transition helper is required');
  const data = new SkeletonData();
  data.bones.push(new BoneData(0,'root',null));
  const timeline = new TranslateTimeline(1,0,0);
  timeline.setFrame(0,0,50,0);
  data.animations.push(new Animation('point_reels',[timeline],1),new Animation('idle',[],1));
  const skeleton = new Skeleton(data);
  const state = new AnimationState(new AnimationStateData(data));
  state.data.defaultMix = .15;
  control.transitionRigClip({state,skeleton},'point_reels',false,true);
  state.apply(skeleton);
  assert.equal(skeleton.bones[0].x,50);
  const incoming = control.transitionRigClip({state,skeleton},'idle',true);
  assert.equal(incoming.mixingFrom?.animation.name,'point_reels');
  assert.equal(incoming.mixDuration,.15);
  state.update(.075); state.apply(skeleton);
  assert.ok(skeleton.bones[0].x > 0 && skeleton.bones[0].x < 50);
  state.update(.1); state.apply(skeleton);
  assert.equal(skeleton.bones[0].x,0);
  skeleton.bones[0].x=77;
  control.transitionRigClip({state,skeleton},'idle',true,true);
  assert.equal(skeleton.bones[0].x,0, 'explicit static-pose reset clears stale unkeyed transforms');
});

test('the sheet holds during departure and catches only on the internal arrival signal', () => {
  const settings={speedTier:0 as const,reducedMotion:false};
  assert.equal(logic.planBeat('pf_rookie','sheet',{type:'animBeat',beat:'rescue',reel:1,skin:'twins',multiplier:2},settings),null);
  assert.ok(control, 'internal landing signal is required');
  const bus=control.createLandingBus();
  const observed: string[]=[];
  const unsubscribe=bus.subscribe(() => observed.push(logic.planLanding('pf_rookie',settings)!.steps[0].animation));
  assert.deepEqual(observed,[]);
  bus.publish();
  assert.deepEqual(observed,['catch']);
  unsubscribe(); bus.publish();
  assert.deepEqual(observed,['catch']);
});

test('rig asset URLs preserve a nested production release prefix and dev root', () => {
  assert.ok(control, 'deployment-aware rig asset resolver is required');
  const suffix='spine/pf_chief/pf_chief.json';
  assert.equal(control.resolveRigAssetUrl(suffix,'https://cdn.example/games/piggy-firefighters/v1/_app/immutable/bundle.js',false),'https://cdn.example/games/piggy-firefighters/v1/assets/'+suffix);
  assert.equal(control.resolveRigAssetUrl(suffix,'http://localhost:3003/src/game/anim/rigRegistry.ts',true),'http://localhost:3003/assets/'+suffix);
});
