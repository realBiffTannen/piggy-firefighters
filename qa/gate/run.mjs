#!/usr/bin/env node
/** Frontend gate: every check under qa/gate plus the reel-padding derivation. `node qa/gate/run.mjs` (exit 1 on any FAIL). */
import { spawnSync } from 'node:child_process';
const ROOT = new URL('../..', import.meta.url).pathname;
const steps = [
	['node', ['qa/gate/check_mode_costs.mjs']],
	['node', ['qa/gate/check_round_tier.mjs']],
	['node', ['qa/gate/check_cue_ids.mjs']],
	['python3', ['tools/reels/make_padding.py', '--check']],
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
