#!/usr/bin/env node
// PIGGY FIREFIGHTERS (2026-09-25): regenerate apps/piggy_firefighters/src/game/audio/cueManifest.ts from audio/cues.json.
// The family generator (LUCKY audio/tools/gen_manifest_lucky.mjs) with a relative ROOT and the SAME exported shape
// (Bus, CueDef, GRID, MIX, CUES: Record<string, CueDef>, CueId), so audioManager.ts / audioDirector.ts compile unchanged.
//
//   node audio/tools/gen_manifest.mjs            # only cues whose BOTH files exist in static/ (the runtime never fetches a 404)
//   node audio/tools/gen_manifest.mjs --all      # every roster id, built or not (for type work before the audio exists)
//   node audio/tools/gen_manifest.mjs --out <path.ts>   # write elsewhere (dry run / smoke test)
//
// The runtime reads gains / durations / loop points from this generated file, so re-run it after every cues.json change
// (build_audio.py, mix.py). It never hand-edits: the header says so.
import fs from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOLS = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(process.env.PF_AUDIO_ROOT || resolve(TOOLS, '../..'));
const APP = `${ROOT}/apps/piggy_firefighters`;
const args = process.argv.slice(2);
const all = args.includes('--all');
const oi = args.indexOf('--out');
const OUT = oi >= 0 ? resolve(args[oi + 1]) : `${APP}/src/game/audio/cueManifest.ts`;
const src = JSON.parse(fs.readFileSync(`${ROOT}/audio/cues.json`, 'utf8'));
const cue = (c) => ({
	id: c.id, bus: c.bus, files: c.files, gain: c.gain, durationMs: c.durationMs,
	priority: c.priority, maxInstances: c.maxInstances, cooldownMs: c.cooldownMs,
	loop: !!c.loop,
	...(c.loopPoints ? { loopStartMs: c.loopPoints.startMs, loopEndMs: c.loopPoints.endMs } : {}),
	...(c.tempoBpm ? { tempoBpm: c.tempoBpm } : {}),
});
const cues = {}; const skipped = [];
for (const c of src.cues) {
	const built = c.files.every((f) => fs.existsSync(`${APP}/static/${f}`));
	if (all || built) cues[c.id] = cue(c); else skipped.push(c.id);
}
const out = `/**
 * GENERATED from /audio/cues.json by audio/tools/gen_manifest.mjs — do not hand-edit.
 * Re-run the generator if the manifest changes. One entry per cue; gains are the
 * pre-duck cue trims (the player's master/music/sfx gains sit OUTSIDE ducking).
 * ${all ? 'Every roster id (--all): some files may not exist yet.' : 'Only cues whose ogg AND m4a exist in static/ are listed.'}
 */
export type Bus = 'music' | 'sfx';

export interface CueDef {
	id: string;
	bus: Bus;
	/** codec-ordered source paths (relative to the served base): ogg first, m4a second */
	files: string[];
	gain: number;
	durationMs: number;
	priority: number;
	maxInstances: number;
	cooldownMs: number;
	loop: boolean;
	loopStartMs?: number;
	loopEndMs?: number;
	tempoBpm?: number;
}

export const GRID = ${JSON.stringify({ tempoBpm: src.grid.tempoBpm, targetBpm: src.grid.targetBpm, meter: src.grid.meter, key: src.grid.key }, null, '\t')} as const;

export const MIX = ${JSON.stringify({ musicBusLUFS: src.mix.musicBusLUFS, sfxBusLUFS: src.mix.sfxBusLUFS, maxTruePeak_dBTP: src.mix.maxTruePeak_dBTP, duckDb: src.mix.duckDb, duckAttackMs: src.mix.duckAttackMs, duckReleaseMs: src.mix.duckReleaseMs }, null, '\t')} as const;

export const CUES: Record<string, CueDef> = ${JSON.stringify(cues, null, '\t')};

export type CueId = keyof typeof CUES;
`;
fs.mkdirSync(dirname(OUT), { recursive: true });
const TMP = `${OUT}.tmp${process.pid}`; fs.writeFileSync(TMP, out); fs.renameSync(TMP, OUT); // r3: atomic (a failed write never truncates the manifest)
console.log(`wrote ${OUT.replace(`${ROOT}/`, '')} with ${Object.keys(cues).length} cues${skipped.length ? ` (${skipped.length} roster ids not built yet, left out)` : ''}`);
