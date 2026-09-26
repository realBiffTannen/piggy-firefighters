#!/usr/bin/env node
/** One Chief on stage (game/anim/rigLogic.ts): BIG+ belongs to the plate chief; the gutter chief steps out and back.
 *    node qa/gate/check_rig_beats.mjs */
const { planBeat } = await import(new URL('../../apps/piggy_firefighters/src/game/anim/rigLogic.ts', import.meta.url).href);
const S = { speedTier: 0, reducedMotion: false };
const problems = [];
const expect = (label, got, pred) => {
	if (!pred(got)) problems.push(`${label}: ${JSON.stringify(got)}`);
};
expect('gutter chief, tier 1 win', planBeat('pf_chief', 'mascotLeft', { beat: 'winTier', tier: 1, amount: 2, x: 2 }, S), (p) => p && p.steps[0].animation === 'win');
expect('gutter chief, tier 3 win', planBeat('pf_chief', 'mascotLeft', { beat: 'winTier', tier: 3, amount: 40, x: 40 }, S), (p) => p === null);
expect('gutter chief steps out on BIG+', planBeat('pf_chief', 'mascotLeft', { beat: 'bigWinStart', tier: 2 }, S), (p) => p && p.visible === false);
expect('gutter chief back after', planBeat('pf_chief', 'mascotLeft', { beat: 'bigWinEnd' }, S), (p) => p && p.visible === true);
expect('Ember keeps acting', planBeat('pf_dog', 'mascotRight', { beat: 'bigWinStart', tier: 2 }, S), (p) => p === null);
expect('plate chief enters', planBeat('pf_chief', 'winPlate', { beat: 'bigWinStart', tier: 2 }, S), (p) => p && p.visible === true);
if (problems.length) {
	console.error(`check_rig_beats: FAIL\n  ${problems.join('\n  ')}`);
	process.exit(1);
}
console.log('check_rig_beats: PASS (6 cases)');
