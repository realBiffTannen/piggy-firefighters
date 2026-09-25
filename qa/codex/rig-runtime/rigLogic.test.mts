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

test('negative Chief bounds fit with feet centered and a motion gutter', () => {
  assert.ok(logic && typeof logic.fitRigInSlot === 'function', 'bounds-aware slot layout is required');
  const bounds = { x: -171.06, y: -1.47, width: 287.94, height: 423.83 };
  const slot = { width: 200, height: 420 };
  const result = logic.fitRigInSlot(bounds, slot.width, slot.height, 1);
  assert.equal(result.x, slot.width / 2, 'keep the authored feet/root horizontally centered');
  assert.ok(result.scale > 0);
  const edges = {
    left: result.x + bounds.x * result.scale,
    right: result.x + (bounds.x + bounds.width) * result.scale,
    top: result.y - (bounds.y + bounds.height) * result.scale,
    bottom: result.y - bounds.y * result.scale,
  };
  assert.ok(edges.left >= 7.99 && edges.right <= slot.width - 7.99);
  assert.ok(edges.top >= 7.99 && edges.bottom <= slot.height - 7.99);
  assert.equal(logic.fitRigInSlot(bounds, slot.width, slot.height, .5).scale, result.scale / 2);
  assert.equal(logic.fitRigInSlot(bounds, slot.width, slot.height, 2).scale, result.scale,
    'layout scale cannot crop the fitted actor');
});

test('the win plate ignores mascot douse/idle beats and uses only its own lifecycle', () => {
  assert.ok(logic);
  const settings = { speedTier: 0 as const, reducedMotion: false };
  const douse = {type:'animBeat' as const,beat:'douse' as const,sprays:[{reel:0,from:2,to:1}],rescues:[],multiplier:1,spinsAdded:0};
  assert.equal(logic.planBeat('pf_chief', 'winPlate', douse, settings), null);
  assert.equal(logic.planBeat('pf_chief', 'winPlate', {type:'animBeat',beat:'idle',seconds:10}, settings), null);
  assert.equal(logic.planBeat('pf_chief', 'winPlate', {type:'animBeat',beat:'bigWinStart',tier:2,amount:15}, settings)?.visible, true);
  assert.equal(logic.planBeat('pf_chief', 'winPlate', {type:'animBeat',beat:'bigWinEnd',tier:2,amount:15}, settings)?.visible, false);
  assert.equal(logic.planBeat('pf_chief', 'mascotLeft', douse, settings)?.steps[0].animation, 'spray_start');
});
