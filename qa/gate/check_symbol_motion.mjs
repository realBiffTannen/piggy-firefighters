#!/usr/bin/env node
/** Symbol win motion (game/symbolMotion.ts): every performance returns to rest, stays <= 1000 ms, and every pose cut
 *  happens at the bottom of a squash (sy/sx <= 0.88) so no cut is ever seen.
 *    node qa/gate/check_symbol_motion.mjs */
const M = await import(new URL('../../apps/piggy_firefighters/src/game/symbolMotion.ts', import.meta.url).href);
const problems = [];
const t = M.restTransform();
const sample = (m, p) => (M.resetTransform(t), m.sample(p, t), { ...t });
const near = (a, b, e = 1e-3) => Math.abs(a - b) <= e;
const NAMES = ['H1', 'H2', 'H3', 'H4', 'L1', 'L2', 'L3', 'L4', 'W', 'ALARM', 'GALARM'];
if (JSON.stringify([...(M.SYMBOL_POSE_NAMES ?? [])].sort()) !== JSON.stringify([...NAMES].sort())) problems.push(`SYMBOL_POSE_NAMES = ${M.SYMBOL_POSE_NAMES}`);
for (const name of NAMES) {
	for (const poses of [0, 1, 2]) {
		const m = M.symbolMotion(name, 'win', { poses });
		if (m.durationMs > 1000) problems.push(`${name} poses ${poses}: ${m.durationMs} ms > 1000`);
		const end = sample(m, 1);
		if (end.pose !== 0 || !near(end.sx, 1, 0.02) || !near(end.sy, 1, 0.02) || Math.abs(end.oy) > 1.5 || Math.abs(end.rot) > 0.5)
			problems.push(`${name} poses ${poses}: not at rest at p=1 (${JSON.stringify(end)})`);
		let prev = sample(m, 0).pose;
		const seen = new Set([prev]);
		for (let i = 1; i <= 2000; i += 1) {
			const s = sample(m, i / 2000);
			seen.add(s.pose);
			if (s.pose > poses) problems.push(`${name} poses ${poses}: shows pose ${s.pose} it does not have`);
			if (s.pose !== prev) {
				const before = sample(m, (i - 1) / 2000);
				const squashed = Math.min(before.sy / Math.max(before.sx, 1e-6), s.sy / Math.max(s.sx, 1e-6));
				if (squashed > 0.88) problems.push(`${name} poses ${poses}: cut ${prev}->${s.pose} at p=${(i / 2000).toFixed(3)} is not inside a squash (sy/sx ${squashed.toFixed(3)})`);
				prev = s.pose;
			}
		}
		if (poses === 2 && !(seen.has(1) && seen.has(2))) problems.push(`${name} poses 2: never shows both B and C`);
	}
}
if (typeof M.poseKey !== 'function' || M.poseKey('sym_W_BLAZE', 1) !== 'sym_W_BLAZE_b' || M.poseKey('symT_H1', 2) !== 'symT_H1_c') problems.push('poseKey naming');
if (problems.length) {
	console.error(`check_symbol_motion: FAIL\n  ${[...new Set(problems)].slice(0, 40).join('\n  ')}`);
	process.exit(1);
}
console.log(`check_symbol_motion: PASS (${NAMES.length} symbols x 3 pose sets)`);
