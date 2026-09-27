#!/usr/bin/env node
/** Frontend gate: every check under qa/gate plus the reel-padding and art-meta derivations. `node qa/gate/run.mjs` (exit 1 on any FAIL). */
import { spawnSync } from 'node:child_process';
const ROOT = new URL('../..', import.meta.url).pathname;
const steps = [
	['node', ['qa/gate/check_mode_costs.mjs']],
	['node', ['qa/gate/check_round_tier.mjs']],
	['node', ['qa/gate/check_rung_pacing.mjs']],
	['node', ['qa/gate/check_hud_bar.mjs']],
	['node', ['qa/gate/check_symbol_motion.mjs']],
	['node', ['qa/gate/check_splash_no_gradients.mjs']],
	['node', ['qa/gate/check_rig_beats.mjs']],
	['node', ['qa/gate/check_bonus_font.mjs']],
	['node', ['qa/gate/check_cue_ids.mjs']],
	['node', ['qa/gate/check_rescue_phone.mjs']],
	['node', ['qa/gate/check_win_coins.mjs']],
	['python3', ['tools/reels/make_padding.py', '--check']],
	['node', ['tools/art/gen_art_meta.mjs', '--check']],
	// the win rungs' local light textures (winrungs/fx) must re-derive from their script + record (art-src/winrungs)
	['python3', ['tools/art/derive_rung_light.py', '--check']],
	// the SHIPPED tree must be the tree these sources produce (build_dist.sh stamps it) — a missing stamp is a FAIL, not a skip
	['node', ['qa/gate/check_provenance.mjs', '--dir', 'game/dist']],
];
let failed = 0;
for (const [cmd, args] of steps) {
	const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });
	if (r.status !== 0) failed += 1;
}
if (failed) {
	console.error(`qa/gate: ${failed} check(s) FAILED`);
	process.exit(1);
}
console.log('qa/gate: all checks passed');
