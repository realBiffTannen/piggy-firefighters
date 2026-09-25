#!/usr/bin/env node
/**
 * PIGGY FIREFIGHTERS audio lane — ElevenLabs draws (family generator, LUCKY audio/tools/gen_lucky.mjs, adapted 2026-09-25).
 * Lossless pcm_44100 -> true-channel 16-bit WAV in audio/cues_pcm/<name>.wav (git-ignored).
 *
 *   node audio/tools/gen_audio.mjs sfx   audio/tools/jobs.json  <name...|--all> [--dry-run] [--force --reason "<measured defect>"]
 *   node audio/tools/gen_audio.mjs music audio/tools/plans.json <plan__N...>   [--dry-run] [--force --reason "<measured defect>"]
 *   node audio/tools/gen_audio.mjs quota                                        # read the character quota only (ledgered)
 *
 * Rules (CLAUDE.md, the lane brief, the family's lessons):
 *   - key from ELEVENLABS_API_KEY ONLY; it is never printed, logged or written (only the `xi-api-key` header carries it);
 *   - ROOT is relative to this file (PF_AUDIO_ROOT overrides it for a scratch smoke test);
 *   - SFX prompt > 450 characters is refused before any call (API limit);
 *   - an existing draw is NEVER re-requested unless --force is given, and --force needs --reason (the named, measured
 *     defect; one redraw per defect — no speculative rerolls). Prefer a new plan name (<plan>_v2) for music redraws;
 *   - CONC <= 2 parallel requests;
 *   - QUOTA GUARD: GET /v1/user/subscription before the first draw and after every 20 draws; refuse to start when
 *     remaining - estimated(batch) < 25,000, stop drawing (and say so) when remaining < 25,000 or when the local
 *     running spend since the last reading would take it below. A failed quota read fails CLOSED (no draws);
 *   - EVERY call — success, API failure, quota read — appends one row to audio/source-record.json (JSON array) and one
 *     line to audio/PROVENANCE.jsonl: endpoint, model, prompt / plan, params, character-cost header, cost estimate,
 *     output path, byte sha256, status (+ http status and a 300-char error excerpt on failure).
 */
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOLS = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(process.env.PF_AUDIO_ROOT || resolve(TOOLS, '../..'));
const OUT = `${ROOT}/audio/cues_pcm`;
const LEDGER = `${ROOT}/audio/source-record.json`;
const PROV = `${ROOT}/audio/PROVENANCE.jsonl`;
const KEY = process.env.ELEVENLABS_API_KEY;
const API = 'https://api.elevenlabs.io';
const FMT = 'pcm_44100';
const CONC = Math.max(1, Math.min(2, +(process.env.CONC || 2)));
const ROUND = process.env.PF_AUDIO_ROUND || 'pf_0925';
const QUOTA_FLOOR = 25000;
const QUOTA_EVERY = 20;
const SFX_CHARS_PER_S = 11.0; // donor-measured: character-cost header = round_half_up(11 x seconds)
const MUSIC_CHARS_PER_S = 15206 / 1106; // donor-measured: 15,206 characters over 1,106 planned music seconds (no header)
const sha = (b) => createHash('sha256').update(b).digest('hex');
const rel = (p) => p.replace(`${ROOT}/`, '');
const estSfx = (s) => Math.floor(SFX_CHARS_PER_S * s + 0.5);
const estMusic = (plan) => Math.ceil((plan.sections.reduce((a, x) => a + x.duration_ms, 0) / 1000) * MUSIC_CHARS_PER_S);

function wav(pcm, ch, rate = 44100) {
	const h = Buffer.alloc(44);
	h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16);
	h.writeUInt16LE(1, 20); h.writeUInt16LE(ch, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * ch * 2, 28);
	h.writeUInt16LE(ch * 2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
	return Buffer.concat([h, pcm]);
}
/** The reply may be interleaved stereo or mono: decided from the byte count against the planned length. Mono is
 *  duplicated to stereo, and the header states the TRUE channel count (the donor's gen_pcm.mjs wrote a mono header). */
function toStereo(buf, plannedS) {
	const monoS = buf.length / 2 / 44100;
	if (monoS > plannedS * 1.5) return { pcm: buf, ch: 2, seconds: monoS / 2, replyChannels: 2 };
	const n = buf.length / 2; const out = Buffer.alloc(n * 4);
	for (let i = 0; i < n; i += 1) { const v = buf.readInt16LE(i * 2); out.writeInt16LE(v, i * 4); out.writeInt16LE(v, i * 4 + 2); }
	return { pcm: out, ch: 2, seconds: monoS, replyChannels: 1 };
}
function ledger(row) {
	let a = [];
	try { a = JSON.parse(readFileSync(LEDGER, 'utf8')); } catch { a = []; }
	a.push(row); writeFileSync(LEDGER, JSON.stringify(a, null, 2) + '\n');
	appendFileSync(PROV, JSON.stringify(row) + '\n');
}
const base = () => ({ provider: 'elevenlabs', at: new Date().toISOString(), round: ROUND, lane: 'AUDIO', refs: [] });

class ApiError extends Error { constructor(status, msg) { super(`${status}: ${msg}`); this.status = status; } }
async function post(url, body) {
	const t = Date.now();
	const res = await fetch(url, { method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' }, body: JSON.stringify(body) });
	const buf = Buffer.from(await res.arrayBuffer());
	if (res.status !== 200) throw new ApiError(res.status, buf.toString('utf8').slice(0, 300));
	const ct = res.headers.get('content-type') || '';
	if (ct.includes('json')) throw new ApiError(res.status, `expected pcm, got ${ct}: ${buf.toString('utf8').slice(0, 200)}`);
	return { buf, wall: (Date.now() - t) / 1000, cost: res.headers.get('character-cost'), reqId: res.headers.get('request-id') };
}

// ---- quota guard ------------------------------------------------------------------------------------------------
async function quota(reason) {
	const row = { ...base(), kind: 'quota', endpoint: '/v1/user/subscription', method: 'GET', reason };
	try {
		const res = await fetch(`${API}/v1/user/subscription`, { headers: { 'xi-api-key': KEY } });
		const txt = await res.text();
		if (res.status !== 200) { ledger({ ...row, status: 'error', http_status: res.status, error: txt.slice(0, 300) }); return null; }
		const j = JSON.parse(txt);
		const remaining = (j.character_limit ?? 0) - (j.character_count ?? 0);
		ledger({ ...row, status: 'ok', http_status: 200, tier: j.tier ?? null, character_count: j.character_count, character_limit: j.character_limit,
			remaining, next_reset_unix: j.next_character_count_reset_unix ?? null });
		return { remaining, count: j.character_count, limit: j.character_limit, tier: j.tier };
	} catch (e) {
		ledger({ ...row, status: 'error', error: String(e.message || e).slice(0, 300) });
		return null;
	}
}

// ---- draws ------------------------------------------------------------------------------------------------------
async function drawSfx(name, r, reason) {
	const est = estSfx(r.s);
	const body = { text: r.prompt, duration_seconds: r.s, model_id: 'eleven_text_to_sound_v2', prompt_influence: r.influence ?? 0.75, ...(r.loop ? { loop: true } : {}) };
	const row = { ...base(), kind: 'sfx', name, cue: r.cue ?? name, feeds: r.feeds ?? [], group: r.group, endpoint: '/v1/sound-generation',
		model: 'eleven_text_to_sound_v2', params: { ...body, text: undefined, output_format: FMT }, prompt: r.prompt,
		prompt_sha256: sha(Buffer.from(r.prompt)), est_chars: est, ...(reason ? { redraw_reason: reason } : {}) };
	try {
		const d = await post(`${API}/v1/sound-generation?output_format=${FMT}`, body);
		const st = toStereo(d.buf, r.s);
		const file = `${OUT}/${name}.wav`;
		writeFileSync(file, wav(st.pcm, st.ch));
		ledger({ ...row, status: 'ok', http_status: 200, bytes: d.buf.length, byte_sha256: sha(d.buf), reply_channels: st.replyChannels,
			seconds: +st.seconds.toFixed(3), wall_s: +d.wall.toFixed(2), character_cost: d.cost, request_id: d.reqId, file: rel(file) });
		return { name, seconds: +st.seconds.toFixed(2), ch: st.replyChannels, cost: d.cost == null ? est : +d.cost };
	} catch (e) {
		ledger({ ...row, status: 'error', http_status: e.status ?? null, error: String(e.message || e).slice(0, 300), file: null });
		throw e;
	}
}
async function drawMusic(name, plan, reason) {
	const total = plan.sections.reduce((s, x) => s + x.duration_ms, 0);
	const est = estMusic(plan);
	const body = { composition_plan: { positive_global_styles: plan.positive, negative_global_styles: plan.negative,
		sections: plan.sections.map((s) => ({ section_name: s.name, positive_local_styles: s.positive, negative_local_styles: s.negative ?? [], duration_ms: s.duration_ms, lines: [] })) },
		model_id: plan.model ?? 'music_v1', respect_sections_durations: true };
	const row = { ...base(), kind: 'music', name, cue: plan.cue ?? null, group: 'music_plan', endpoint: '/v1/music', model: body.model_id,
		params: { composition_plan: body.composition_plan, respect_sections_durations: true, output_format: FMT },
		prompt_sha256: sha(Buffer.from(JSON.stringify(body.composition_plan))), planned_s: total / 1000, bpm: plan.bpm ?? null, bars: plan.bars ?? null,
		est_chars: est, ...(reason ? { redraw_reason: reason } : {}), ...(plan.redrawOf ? { redraw_of: plan.redrawOf, defect: plan.defect ?? null } : {}) };
	try {
		const d = await post(`${API}/v1/music?output_format=${FMT}`, body);
		const st = toStereo(d.buf, total / 1000);
		const file = `${OUT}/${name}.wav`;
		writeFileSync(file, wav(st.pcm, st.ch));
		ledger({ ...row, status: 'ok', http_status: 200, bytes: d.buf.length, byte_sha256: sha(d.buf), reply_channels: st.replyChannels,
			seconds: +st.seconds.toFixed(3), wall_s: +d.wall.toFixed(2), character_cost: d.cost, request_id: d.reqId, file: rel(file) });
		return { name, seconds: +st.seconds.toFixed(2), planned: total / 1000, ch: st.replyChannels, cost: d.cost == null ? est : +d.cost };
	} catch (e) {
		ledger({ ...row, status: 'error', http_status: e.status ?? null, error: String(e.message || e).slice(0, 300), file: null });
		throw e;
	}
}

async function main() {
	const [kind, path, ...rest] = process.argv.slice(2);
	const dry = rest.includes('--dry-run');
	if (kind === 'quota') {
		if (!KEY) { console.error('NO ELEVENLABS_API_KEY in the environment'); process.exit(2); }
		const q = await quota('manual read');
		console.log(q ? `quota: remaining ${q.remaining} of ${q.limit} (tier ${q.tier}); floor ${QUOTA_FLOOR}` : 'quota read FAILED (ledgered)');
		process.exit(q ? 0 : 3);
	}
	const force = rest.includes('--force');
	const ri = rest.indexOf('--reason'); const reason = ri >= 0 ? rest[ri + 1] : null;
	let names = rest.filter((a, i) => !a.startsWith('--') && !(ri >= 0 && i === ri + 1));
	if (!['sfx', 'music'].includes(kind) || !path) { console.error('usage: gen_audio.mjs sfx|music <doc.json> <names...|--all> [--dry-run] [--force --reason "..."] | quota'); process.exit(2); }
	const DOC = JSON.parse(readFileSync(path, 'utf8'));
	if (rest.includes('--all')) names = Object.keys(DOC).filter((k) => !k.startsWith('_'));
	if (!names.length) { console.error('no names given'); process.exit(2); }
	if (force && !reason) { console.error('--force needs --reason "<the measured defect>" (one redraw per named defect, no speculative rerolls)'); process.exit(2); }
	const lookup = (n) => (kind === 'sfx' ? DOC[n] : DOC[n.replace(/__\d+$/, '')]);
	for (const n of names) {
		const r = lookup(n);
		if (!r) { console.error(`unknown ${kind === 'sfx' ? 'job' : 'plan'} ${n}${kind === 'music' ? ' (music names are <plan>__N)' : ''}`); process.exit(2); }
		if (kind === 'music' && !/__\d+$/.test(n)) { console.error(`music draw names are <plan>__N, got ${n}`); process.exit(2); }
		if (kind === 'sfx' && r.prompt.length > 450) { console.error(`${n}: prompt ${r.prompt.length} chars > 450 (API limit); nothing drawn`); process.exit(2); }
	}
	mkdirSync(OUT, { recursive: true });
	const q = names.filter((n) => force || !existsSync(`${OUT}/${n}.wav`));
	const skipped = names.length - q.length; if (skipped) console.log(`skip ${skipped} already drawn (no redraw without --force --reason)`);
	const est = (n) => (kind === 'sfx' ? estSfx(lookup(n).s) : estMusic(lookup(n)));
	const batchEst = q.reduce((a, n) => a + est(n), 0);
	console.log(`${q.length} ${kind} draw(s) queued, estimated ${batchEst} characters (donor-measured ratios)`);
	if (dry) { for (const n of q) console.log(`  ${n.padEnd(34)} ~${est(n)}`); return; }
	if (!q.length) return;
	if (!KEY) { console.error('NO ELEVENLABS_API_KEY in the environment'); process.exit(2); }

	let reading = await quota(`before ${kind} batch of ${q.length}`);
	if (!reading) { console.error('QUOTA READ FAILED: no draws (fail closed). See the ledger row.'); process.exit(3); }
	console.log(`quota: remaining ${reading.remaining} of ${reading.limit}; floor ${QUOTA_FLOOR}`);
	if (reading.remaining < QUOTA_FLOOR || reading.remaining - batchEst < QUOTA_FLOOR) {
		console.error(`QUOTA GUARD: remaining ${reading.remaining} - batch ~${batchEst} would go below the ${QUOTA_FLOOR} floor; nothing drawn. Report and stop.`);
		process.exit(3);
	}
	let spentSinceReading = 0; let drawsSinceReading = 0; let stopped = null; let checking = null;
	const out = [];
	async function gate(n) {
		if (stopped) return false;
		if (checking) await checking;
		if (drawsSinceReading >= QUOTA_EVERY) {
			checking = (async () => {
				const r = await quota(`after ${drawsSinceReading} draws`);
				if (!r) stopped = 'quota read failed (fail closed)';
				else { reading = r; spentSinceReading = 0; drawsSinceReading = 0; console.log(`quota: remaining ${r.remaining}`); }
			})();
			await checking; checking = null;
			if (stopped) return false;
		}
		if (reading.remaining - spentSinceReading < QUOTA_FLOOR || reading.remaining - spentSinceReading - est(n) < QUOTA_FLOOR) {
			stopped = `remaining ~${reading.remaining - spentSinceReading} is at the ${QUOTA_FLOOR} floor`; return false;
		}
		return true;
	}
	async function worker() {
		while (q.length) {
			const n = q.shift();
			if (!(await gate(n))) { q.unshift(n); return; }
			drawsSinceReading += 1;
			try {
				const r = kind === 'sfx' ? await drawSfx(n, lookup(n), force ? reason : null) : await drawMusic(n, lookup(n), force ? reason : null);
				spentSinceReading += r.cost ?? est(n);
				out.push(r); console.log('ok  ', JSON.stringify(r));
			} catch (e) {
				spentSinceReading += est(n); // be conservative: a failure may still bill
				out.push({ n, err: e.message }); console.log(`FAIL ${n}: ${String(e.message).slice(0, 300)}`);
			}
		}
	}
	await Promise.all(Array.from({ length: Math.min(CONC, q.length) }, worker));
	const after = await quota('after batch');
	console.log('done', out.filter((r) => r.seconds).length, 'ok', out.filter((r) => r.err).length, 'fail',
		after ? `| remaining ${after.remaining}` : '| final quota read failed');
	if (stopped) { console.error(`QUOTA GUARD STOPPED THE BATCH: ${stopped}. Not drawn: ${q.join(', ')}`); process.exit(3); }
}
main();
