#!/usr/bin/env node
/**
 * Every cue id the frontend asks the audio manager for must exist in the audio lane's manifest
 * (apps/piggy_firefighters/src/game/audio/cueManifest.ts CUES). playCue skips unknown ids SILENTLY, so a stale id
 * is a silent seam; this check makes it a failure.
 *
 *   node qa/gate/check_cue_ids.mjs      exit 1 on any unknown id or unexpanded dynamic id
 *
 * Literal ids: every '...' literal on an audio call line (playCue / playHeld / playRoundRobin / turbo / cue / play /
 * SfxLoop / Layer / Bed / ensureDecoded / prefetch / burstCue / cue tables) of every src file that talks to the
 * manager. Dynamic ids (`prefix_${n}`): each template must be listed in DYNAMIC with its full expansion.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname;
const SRC = join(ROOT, 'apps/piggy_firefighters/src');
const manifest = readFileSync(join(SRC, 'game/audio/cueManifest.ts'), 'utf8');
const CUES = new Set([...manifest.matchAll(/"id": "([^"]+)"/g)].map((m) => m[1]));

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const RUNGS = ['big', 'huge', 'mega', 'epic', 'max'];
/** template (as written in the source, whitespace-free) -> every id it can produce */
const DYNAMIC = {
	'`${id}_turbo`': [], // the turbo variant helper: only used after an `in CUES` / hasCue test
	'`${id}_turbo`in': [],
	'`reel_stop_${rung}`': range(1, 5).map((n) => `reel_stop_${n}`),
	'`alarm_land_${n}`': range(1, 5).map((n) => `alarm_land_${n}`),
	'`sym_win_${String(symbol).toLowerCase()}`': ['h1', 'h2', 'h3', 'h4', 'l1', 'l2', 'l3', 'l4', 'w'].map((s) => `sym_win_${s}`),
	'`shutter_haul_${Math.min(3,Math.max(1,n))}`': range(1, 3).map((n) => `shutter_haul_${n}`),
	'`shutter_haul_${n}`': range(1, 3).map((n) => `shutter_haul_${n}`),
	'`blaze_ignite_${Math.min(5,n+1)}`': range(2, 5).map((n) => `blaze_ignite_${n}`),
	'`rescue_tada_${Math.min(8,Math.max(1,Math.round(multiplier)))}`': range(1, 8).map((n) => `rescue_tada_${n}`),
	'`${bonus}_total_${size}`': ['rescue', 'inferno'].flatMap((b) => ['small', 'mid', 'big'].map((s) => `${b}_total_${s}`)),
	'`total_win_${size}`': ['small', 'mid', 'big'].map((s) => `total_win_${s}`),
	'`rung_bed_${r.key}`': RUNGS.map((k) => `rung_bed_${k}`),
	'`rung_bed_${RUNGS[idx].key}`': RUNGS.map((k) => `rung_bed_${k}`),
	'`rung_hit_${RUNGS[idx].key}`': RUNGS.map((k) => `rung_hit_${k}`),
	'`sign_impact_${RUNGS[idx].skin}`': RUNGS.map((k) => `sign_impact_${k}`),
	'`sign_impact_${RUNGS[0].skin}`': ['sign_impact_big'],
	'`rung_hit_${RUNGS[0].key}`': ['rung_hit_big'],
	'`count_ticker_${n}`': range(1, 12).map((n) => `count_ticker_${n}`),
};

const AUDIO_LINE = /playCue|playHeld|stopHeld|playRoundRobin|turboCue\(|turbo\(|\bcue\(|\bplay\(|SfxLoop|Layer\(|Bed\b|Bed\(|ensureDecoded|prefetch|burstCue|_CUES|baseBeds|BONUS_BED|ENTRY_FLOURISH|AMBIENCE|DEFAULT_BED|spinPress|general:|stinger|const id =|const cue =/;
const NOT_IDS = new Set(['music', 'sfx', 'ui', 'alarm', 'reel', 'wild', 'symwin', 'galarmglint']);

const files = [];
const walk = (dir) => {
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) walk(p);
		else if (/\.(ts|svelte)$/.test(name) && !p.endsWith('cueManifest.ts')) files.push(p);
	}
};
walk(SRC);

const problems = [];
let checked = 0;
for (const file of files) {
	const text = readFileSync(file, 'utf8');
	if (!/audioManager|playCue|audioDirector|gameSound/.test(text)) continue;
	text.split('\n').forEach((line, i) => {
		if (!AUDIO_LINE.test(line) || /^\s*(\/\/|\*)/.test(line)) return;
		const code = line.replace(/family:\s*'[^']*'/g, '').replace(/kind:\s*'[^']*'/g, '').replace(/\/\/.*$/, '');
		for (const m of code.matchAll(/'([a-z][a-z0-9_]*)'/g)) {
			const id = m[1];
			if (!id.includes('_') || NOT_IDS.has(id)) continue;
			checked += 1;
			if (!CUES.has(id)) problems.push(`${relative(ROOT, file)}:${i + 1} unknown cue id '${id}'`);
		}
		for (const m of code.matchAll(/`[^`]*\$\{[^`]*`/g)) {
			const tpl = m[0].replace(/\s+/g, '');
			if (!/^`[a-z_]*\$\{|_\$\{|\}_/.test(tpl)) continue; // not an id-shaped template (e.g. a log message)
			if (!(tpl in DYNAMIC)) {
				problems.push(`${relative(ROOT, file)}:${i + 1} dynamic cue id ${tpl} is not listed in DYNAMIC`);
				continue;
			}
			for (const id of DYNAMIC[tpl]) {
				checked += 1;
				if (!CUES.has(id)) problems.push(`${relative(ROOT, file)}:${i + 1} ${tpl} can produce unknown cue id '${id}'`);
			}
		}
	});
}

if (problems.length) {
	console.error(`FAIL check_cue_ids: ${problems.length} problem(s) (${CUES.size} cues in the manifest)`);
	for (const p of problems) console.error('  ' + p);
	process.exit(1);
}
console.log(`OK check_cue_ids: ${checked} cue references, all in the manifest (${CUES.size} cues)`);
