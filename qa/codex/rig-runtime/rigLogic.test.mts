import assert from 'node:assert/strict';
import test from 'node:test';

// Breaks caught: celebrating a loss, continuing a stale rescue after cancellation,
// long motion in Super Turbo, wrong family skin, invalid assets hiding fallbacks.
const logic = await import('../../../apps/piggy_firefighters/src/game/anim/rigLogic.ts').catch(() => null);

test('the rig runtime exposes its contract implementation', () => {
  assert.ok(logic, 'rigLogic implementation is required');
});

test('loss tiers never celebrate and Super Turbo skips long one-shots', { skip: !logic }, () => {
  assert.equal(logic!.planBeat('pf_chief', 'mascotLeft', {type:'animBeat',beat:'winTier',tier:0,amount:1,x:1}, {speedTier:0,reducedMotion:false}), null);
  const normal = logic!.planBeat('pf_chief', 'mascotLeft', {type:'animBeat',beat:'douse',sprays:[{reel:0,from:2,to:1}],rescues:[],multiplier:1,spinsAdded:0}, {speedTier:0,reducedMotion:false});
  assert.deepEqual(normal?.steps.map(s => s.animation), ['spray_start','spray_loop','spray_end','idle']);
  const turbo = logic!.planBeat('pf_chief', 'mascotLeft', {type:'animBeat',beat:'winTier',tier:4,amount:200,x:200}, {speedTier:2,reducedMotion:false});
  assert.deepEqual(turbo?.steps.map(s => s.animation), ['idle']);
});

test('rescue room and building map to the correct family and reduced motion stays still', { skip: !logic }, () => {
  assert.equal(logic!.rescuedSkin(4,2), 'twins');
  assert.equal(logic!.rescuedSkin(0,0), 'grandma');
  const beat = {type:'animBeat' as const,beat:'rescue' as const,reel:2,skin:'baby',multiplier:3};
  assert.equal(logic!.planBeat('pf_rescued','rescueRoom',beat,{speedTier:0,reducedMotion:false},1), null);
  assert.equal(logic!.planBeat('pf_rescued','ladder',beat,{speedTier:0,reducedMotion:true})?.travel, false);
  assert.equal(logic!.motionTimeScale({speedTier:0,reducedMotion:true}), 0);
});

test('cancellation invalidates completion from the prior clip and dispose is final', { skip: !logic }, () => {
  const lifecycle = logic!.createPlaybackEpoch();
  const old = lifecycle.begin();
  assert.equal(lifecycle.isCurrent(old), true);
  const current = lifecycle.begin();
  assert.equal(lifecycle.isCurrent(old), false);
  assert.equal(lifecycle.isCurrent(current), true);
  lifecycle.dispose();
  assert.equal(lifecycle.isCurrent(current), false);
  assert.equal(lifecycle.isCurrent(lifecycle.begin()), false);
});

test('unparsed or incomplete exports cannot suppress procedural fallbacks', { skip: !logic }, () => {
  assert.equal(logic!.isUsableRigData('pf_chief', {}), false);
  assert.equal(logic!.isUsableRigData('pf_chief', {version:'4.2.43',animations:[],bones:[],skins:[],events:[]}), false);
});

test('malformed parsed-looking data fails closed without breaking the fallback', { skip: !logic }, () => {
  const malformed = {version:42,width:100,height:100,findAnimation(){},findBone(){},findSkin(){}};
  assert.equal(logic!.isUsableRigData('pf_chief', malformed), false);
});
