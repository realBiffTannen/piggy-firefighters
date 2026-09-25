#!/usr/bin/env python3
"""PIGGY FIREFIGHTERS audio acceptance measurements (family tool, LUCKY audio/tools/lucky_measure.py, adapted 2026-09-25).

    python3 audio/tools/measure.py          # shipped files: every cue, both codecs  -> audio/qa/measure_all.json, cues_table.csv, beds_table.md
    python3 audio/tools/measure.py draws    # raw MUSIC draws, before choosing a source -> audio/qa/music_draws_measured.json
                                            # (named defects: short / quiet intro / dropout / chug / out of key / tempo off / near-copy sections)

Shipped checks (the acceptance the family's accepted audio passed, plus the two that got "Bad sound design" tagged):
  * every registered id has BOTH codec files (ogg first, m4a second) and static == runtime (sha256);
  * true peak of the decoded .ogg (Opus) AND .m4a (AAC) <= -1.0 dBTP; integrated LUFS of both;
  * every loop: wrap step |last -> first| of the DECODED file <= the body's adjacent-sample p99.9 (loopkit.wrap_step) in both
    codecs, plus head/tail RMS at 50 / 250 / 1000 ms (a decaying tail makes the loop dip);
  * every bed: exact whole-bar length in samples on its grid, tempo re-estimated on the shipped .ogg, C-pentatonic share,
    the 8th/quarter "chug" ratio (300-1200 Hz envelope modulation; >> 1 = strummed eighths), and SECTION SELF-SIMILARITY:
    8-bar sections compared pairwise on band-mean-removed log spectra (an EQ'd copy of one 8-bar loop scores ~1.0; the
    tag the family got for "one 8-bar loop dressed as 32 bars" is caught here, not by ear);
  * bed LUFS vs the target in cues.json mix.bedLUFS; rung beds strictly rising.
r2 gates (2026-09-25; summary.gates, PASS = all of them):
  * truePeak8x: kit.true_peak (8x oversampled at the codec's native rate, unrounded) <= -1.0 dBTP, both codecs;
  * monoSum: every cue, both codecs: inter-channel correlation >= 0 and loudest-400 ms loss of the (L+R)/2 sum <= 3 dB;
  * tails: every one-shot (master, ogg, m4a): the 10 ms that ends 10 ms before the last sample <= -40 dB re peak and
    |last sample| < 0.002 (a ring cut short, or a short fade into a loud ring, reads high);
  * turbo700ms: every _turbo variant's AUDIBLE length (last sample > -80 dBFS; AAC pads to whole frames) <= 700 ms (both codecs) unless the cue records turboCapExempt (held risers);
  * tadaLadderRising: the SHS fundamental (kit.shs_f0) of rescue_tada_1..8 rises strictly (>= 0.5 st per rung);
  * reelStopsPhone: every reel stop's effective 400 Hz phone-proxy level >= reel_spin_loop's + 6 dB, stops within 1 dB;
  * chains_st_mono_phone: every mix.CHAINS entry rising on stereo power, the mono sum and the phone proxy (gain x file);
  * alarmTopVoice: each alarm chord's top voice (A4 D5 F5 A5 B5) within 3 dB of its loudest partial on the mono sum;
  * selfSimSliding: 8-bar windows at every half beat (cyclic), band spectrogram AND beat chroma, r < 0.90;
  * bedTailDip1000ms: head-tail at 1000 ms <= 6 dB on every bed.
"""
import csv, hashlib, json, os, sys
from concurrent.futures import ProcessPoolExecutor
import numpy as np
from scipy.signal import butter, sosfilt
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit as K
import loopkit as lk

ROOT, SR, QA = K.ROOT, K.SR, K.QA
STATIC_BASE = f'{ROOT}/apps/{K.GAME}/static'
CPENT_PC = (0, 2, 4, 7, 9)
sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()


# ------------------------------------------------------------------------------------------ analysis (also used by build_audio.py)
def chroma(x, lo=110, hi=2500):
    m = x.mean(axis=1) if x.ndim > 1 else x; n = 8192; hop = 2048; pcp = np.zeros(12); w = np.hanning(n)
    if len(m) < n: m = np.concatenate([m, np.zeros(n - len(m))])
    fr = np.fft.rfftfreq(n, 1 / SR); sel = (fr > lo) & (fr < hi)
    pc = np.round(69 + 12 * np.log2(fr[sel] / 440.0)).astype(int) % 12
    for i in range(0, len(m) - n + 1, hop):
        np.add.at(pcp, pc, np.abs(np.fft.rfft(m[i:i + n] * w))[sel] ** 2)
    return pcp / (pcp.sum() + 1e-12)


def cpent_share(x): return float(chroma(x)[list(CPENT_PC)].sum())


def chug_ratio(x, bpm):
    """8th-note / quarter-note envelope-modulation peak in 300-1200 Hz (the donor's chug discriminator; > 3 = a named defect)."""
    m = x.mean(axis=1) if x.ndim > 1 else x
    b = sosfilt(butter(4, [300, 1200], 'bandpass', fs=SR, output='sos'), m)
    hop = 441; e = np.sqrt(np.convolve(b * b, np.ones(hop) / hop, 'same'))[::hop]; e = e - e.mean()
    if len(e) < 64: return 0.0
    S = np.abs(np.fft.rfft(e * np.hanning(len(e)))); f = np.fft.rfftfreq(len(e), hop / SR)
    def pk(f0):
        sel = (f > f0 * 0.97) & (f < f0 * 1.03)
        return float(S[sel].max()) if sel.any() else 0.0
    q = bpm / 60.0
    return round(pk(2 * q) / (pk(q) + 1e-12), 3)


def selfsim(x, bpm, bars, per=8):
    """Pairwise similarity of `per`-bar sections: Pearson r of band-mean-removed log-band spectrograms (EQ-proof).
    Returns {'sections': n, 'pairs': {'i-j': r}, 'maxPair': r, 'nearCopy': r >= 0.90}."""
    if bars < 2 * per: return {'sections': 1, 'pairs': {}, 'maxPair': None, 'nearCopy': False}
    m = x.mean(axis=1) if x.ndim > 1 else x
    L = int(round(per * 4 * 60.0 / bpm * SR)); n = min(bars // per, len(m) // L)
    edges = np.geomspace(60, 8000, 41); N = 4096; hop = 2048; w = np.hanning(N); fr = np.fft.rfftfreq(N, 1 / SR)
    band = np.digitize(fr, edges) - 1
    feats = []
    for i in range(n):
        seg = m[i * L:(i + 1) * L]; frames = []
        for j in range(0, len(seg) - N, hop):
            P = np.abs(np.fft.rfft(seg[j:j + N] * w)) ** 2
            frames.append(np.log10(np.bincount(band[(band >= 0) & (band < 40)], P[(band >= 0) & (band < 40)], minlength=40) + 1e-10))
        F = np.array(frames); F = F - F.mean(axis=0, keepdims=True)
        feats.append(F.ravel())
    k = min(len(f) for f in feats); feats = [f[:k] for f in feats]
    pairs = {}
    for i in range(n):
        for j in range(i + 1, n):
            a, b = feats[i], feats[j]
            pairs[f'{i + 1}-{j + 1}'] = round(float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-12)), 3)
    mx = max(pairs.values()) if pairs else None
    return {'sections': n, 'pairs': pairs, 'maxPair': mx, 'nearCopy': bool(mx is not None and mx >= 0.90)}


def selfsim_sliding(x, bpm, bars, per=8, thr=0.90):
    """r2 (2026-09-25): repetition at ANY lag. The grid test above compares only 8-bar sections that start on bars 1 / 9 /
    17 / 25, so it cannot see a near-copy offset by 4 bars (rescue_loop repeats at a 12-bar lag: bars 9-16 vs 21-28).
    Every `per`-bar window starting on any half beat (cyclic: the loop wraps) is compared with every NON-overlapping one on
    (a) the band-mean-removed log-band spectrogram (40 bands 60-8000 Hz, 1/8-beat frames; EQ-proof) and (b) BEAT chroma
    (12 pitch classes per beat, 110-2500 Hz), each pitch class z-scored within the window: with mean removal alone the
    static key profile (the C / E / G energy of every C-major bar) dominates the correlation and any two phrases in the key
    read alike; standardising each pitch class makes the test about the 32-beat harmonic PATTERN. Pearson r; a near copy
    is r >= thr on either feature."""
    if bars < 2 * per: return None
    m = x.mean(axis=1) if x.ndim > 1 else x; beat = 60.0 / bpm * SR; nf = int(bars * 32); hop = beat / 8
    N = 4096; w = np.hanning(N); fr = np.fft.rfftfreq(N, 1 / SR); mc = np.concatenate([m, m[:N + 8]])
    edges = np.geomspace(60, 8000, 41); band = np.digitize(fr, edges) - 1; okb = (band >= 0) & (band < 40)
    selc = (fr > 110) & (fr < 2500); pc = np.round(69 + 12 * np.log2(fr[selc] / 440.0)).astype(int) % 12
    F = np.zeros((nf, 40)); C = np.zeros((nf, 12))
    for i in range(nf):
        a = int(round(i * hop)); P = np.abs(np.fft.rfft(mc[a:a + N] * w)) ** 2
        F[i] = np.log10(np.bincount(band[okb], P[okb], minlength=40) + 1e-10); C[i] = np.bincount(pc, P[selc], minlength=12)
    Wf = per * 32; starts = np.arange(0, nf, 4); ns = len(starts); Wh = per * 8  # window length in half beats
    def vecs(kind):
        V = []
        for s in starts:
            idx = (s + np.arange(Wf)) % nf
            if kind == 'band': Z = F[idx] - F[idx].mean(axis=0, keepdims=True)
            else:
                Z = C[idx].reshape(per * 4, 8, 12).sum(axis=1); Z = (Z - Z.mean(axis=0, keepdims=True)) / (Z.std(axis=0, keepdims=True) + 1e-12)
            v = Z.ravel(); V.append(v / (np.linalg.norm(v) + 1e-12))
        return np.array(V)
    out = {}
    d = np.abs(starts[:, None] - starts[None, :]) // 4; d = np.minimum(d, ns - d); valid = d >= Wh
    for kind in ('band', 'chroma'):
        V = vecs(kind); G = V @ V.T; G[~valid] = -1.0; i, j = np.unravel_index(int(np.argmax(G)), G.shape)
        out[kind] = {'maxR': round(float(G[i, j]), 3), 'barsA': [round(starts[i] / 32 + 1, 2), round(starts[i] / 32 + per, 2)],
                     'barsB': [round(starts[j] / 32 + 1, 2), round(starts[j] / 32 + per, 2)], 'lagBars': round(float(min(abs(starts[i] - starts[j]), nf - abs(starts[i] - starts[j])) / 32), 2)}
    mx = max(out['band']['maxR'], out['chroma']['maxR'])
    return {**out, 'maxR': mx, 'nearCopy': bool(mx >= thr), 'windowBars': per, 'hop': 'half beat, cyclic'}


def level_profile(x, win_s=1.0):
    m = (x ** 2).mean(axis=1) if x.ndim > 1 else x ** 2; n = int(win_s * SR)
    k = len(m) // n
    return np.array([10 * np.log10(m[i * n:(i + 1) * n].mean() + 1e-12) for i in range(k)])


# ------------------------------------------------------------------------------------------ raw music draws
def draws():
    plans = {k: v for k, v in json.load(open(f'{K.TOOLS}/plans.json')).items() if not k.startswith('_')}
    rows = []
    for f in sorted(os.listdir(K.PCM)) if os.path.isdir(K.PCM) else []:
        if not f.endswith('.wav') or '__' not in f: continue
        name = f[:-4]; pn = name.rsplit('__', 1)[0]; p = plans.get(pn)
        if not p: continue
        x = K.load(f'{K.PCM}/{f}'); bpm = p['bpm']; dur = len(x) / SR
        planned = sum(s['duration_ms'] for s in p['sections']) / 1000.0
        prof = level_profile(x); body = float(np.median(prof)) if len(prof) else -120.0
        intro_db = round(float(prof[:2].mean() - body), 1) if len(prof) >= 4 else None
        drop = [i for i, v in enumerate(prof) if v < body - 20.0 and 2 <= i < len(prof) - 1]
        t0 = K.first_onset(x); meas = K.fine_tempo(x, bpm - 4.0, bpm + 4.0); auto = K.tempo_autocorr(x, bpm - 12, bpm + 12)
        need = p['loop_s'] + 4 * 60.0 / bpm
        r = dict(draw=name, plan=pn, cue=p['cue'], seconds=round(dur, 2), planned_s=planned, needed_s=round(need, 2), firstOnset_s=round(t0, 3),
                 introVsBody_dB=intro_db, dropoutSeconds=drop[:20], fineBpm=round(float(meas), 3), autoBpm=round(float(auto), 2),
                 cpentShare=round(cpent_share(x), 3), chug=chug_ratio(x, bpm),
                 selfSim=selfsim(x[int(t0 * SR):], bpm, p['bars']) if p['bars'] >= 16 else None)
        defects = []
        if dur - t0 < need: defects.append(f'short: {dur - t0:.1f} s of material after the first onset < {need:.1f} s needed')
        if intro_db is not None and intro_db < -9: defects.append(f'quiet intro ({intro_db} dB under the body)')
        if drop: defects.append(f'dropout at {drop[:5]} s')
        if r['chug'] > 3.0: defects.append(f'chug {r["chug"]} (8th/quarter > 3)')
        if r['cpentShare'] < 0.6: defects.append(f'out of key (C-pent share {r["cpentShare"]})')
        if abs(meas - bpm) > 3.5: defects.append(f'tempo {meas:.2f} far from {bpm}')
        if r['selfSim'] and r['selfSim']['nearCopy']: defects.append(f'near-copy sections (max r {r["selfSim"]["maxPair"]})')
        r['defects'] = defects; rows.append(r); print(name, 'OK' if not defects else defects)
    os.makedirs(QA, exist_ok=True)
    K.write_json(f'{QA}/music_draws_measured.json', rows, indent=1)
    print('wrote', os.path.relpath(f'{QA}/music_draws_measured.json', ROOT), len(rows), 'draws')


# ------------------------------------------------------------------------------------------ shipped files
def loop_span(c, n):
    """[start, end) of the looped region in samples: the cue's loopPoints (beds carry a codec-guard pre/post-roll), else all."""
    lp = c.get('loopPoints') or {}
    if lp.get('padSamples') is not None and lp.get('loopSamples'):
        return int(lp['padSamples']), int(lp['padSamples']) + int(lp['loopSamples'])
    if lp.get('startMs') and not lp.get('planned'):
        return int(round(lp['startMs'] * SR / 1000)), int(round(lp['endMs'] * SR / 1000))
    return 0, n


def one(c):
    cid = c['id']; out = {'id': cid, 'bus': c['bus'], 'loop': bool(c.get('loop')), 'status': c.get('status')}
    mast = f'{K.MAST}/{cid}.wav'; out['master'] = os.path.exists(mast)
    m = lk.decode(mast) if out['master'] else None
    out['masterSamples'] = len(m) if m is not None else None
    for f in c['files']:
        ext = f.rsplit('.', 1)[1]; p = os.path.join(STATIC_BASE, f); r = f'{K.RUN}/{cid}.{ext}'
        d = {'present': os.path.exists(p)}
        if d['present']:
            I, TP4 = K.measure(p); d.update(I_LUFS=I, TP_dBFS=round(K.true_peak(p), 2), TP_ebur128_4x=TP4)
            d['sameAsRuntime'] = os.path.exists(r) and sha(r) == sha(p)
            x = lk.decode(p); d['samples'] = len(x); d['ms'] = round(len(x) / SR * 1000, 1)
            nz = np.nonzero(np.abs(x).max(axis=1) > 1e-4)[0]  # audible length: AAC in MP4 decodes to whole 1024-sample frames (silent padding)
            d['audibleMs'] = round((int(nz[-1]) + 1) / SR * 1000, 1) if len(nz) else 0.0
            if m is not None: d['lenDiff'] = len(x) - len(m)
            d['levels'] = K.levels(x)
            if not out['loop']: d['tail'] = K.tail_metrics(x)
            if cid.startswith('rescue_tada_') and not cid.endswith('_turbo'): d['shsMidi'] = round(K.shs_f0(x, t_from=0.1)[1], 2)
            if cid.startswith('alarm_land_') and not cid.endswith('_turbo') and ext == 'ogg': d['topVoice'] = top_voice(x, c)
            if out['loop']:
                ls, le = loop_span(c, len(m) if m is not None else len(x))
                y = x[ls:le]
                w, b = lk.wrap_step(y); d.update(wrap=w, bodyP999=b, seamClean=bool(w <= b), loopSpan=[ls, le])
            if c['bus'] == 'music' and c.get('tempoBpm') and out['loop']:
                bpm = c['tempoBpm']; d['bpmEst'] = round(float(K.tempo_autocorr(x, bpm - 12, bpm + 12)), 2)
        out[ext] = d
    if m is not None and not out['loop']: out['masterTail'] = K.tail_metrics(m)
    if out['loop'] and m is not None:
        ls, le = loop_span(c, len(m)); lm = m[ls:le]
        out['headTail_dB'] = {w: v[2] for w, v in lk.headtail(lm, (50, 250, 1000)).items()}
        if ls or le != len(m):  # the codec-guard pads must be the loop's own tail / head (cyclic), or the guard is wrong
            out['padCyclic'] = bool(np.allclose(m[:ls], lm[-ls:], atol=2e-4) and np.allclose(m[le:], lm[:len(m) - le], atol=2e-4))
    if c['bus'] == 'music' and c.get('tempoBpm') and out['loop'] and m is not None:
        bpm = c['tempoBpm']; bars = (c.get('build') or {}).get('bars') or c.get('bars')
        if bars:
            want = int(round(bars / 8 * K.stage_for(bpm)))
            out['grid'] = {'bpm': bpm, 'bars': bars, 'samples': len(lm), 'expected': want, 'exact': len(lm) == want,
                           'barSeconds': round(4 * 60 / bpm, 5), 'loopSeconds': round(len(lm) / SR, 4)}
            out['chug'] = chug_ratio(lm, bpm); out['selfSim'] = selfsim(lm, bpm, bars); out['cpentShare'] = round(cpent_share(lm), 3)
            out['selfSimSliding'] = selfsim_sliding(lm, bpm, bars)
    return out


def top_voice(x, c, t0=0.03, t1=0.45):
    """Alarm chords (r2): level of each chord tone's fundamental on the MONO sum (30-450 ms), re the loudest partial in
    150-2500 Hz; the top voice should lead (A4 D5 F5 A5 B5 up the ladder)."""
    m = x.mean(axis=1)[int(t0 * SR):int(t1 * SR)]; N = 1 << 16; X = np.abs(np.fft.rfft(m * np.hanning(len(m)), N)); fr = np.fft.rfftfreq(N, 1 / SR)
    sel = (fr > 150) & (fr < 2500); top = float(X[sel].max()); fl = fr[sel][int(np.argmax(X[sel]))]
    notes = (c.get('derive') or {}).get('chord') or []
    lv = {}
    for n_ in notes:
        f = 440 * 2 ** ((n_ - 69) / 12); s = (fr > f * 0.985) & (fr < f * 1.015); lv[K.note_name(n_)] = round(float(20 * np.log10(X[s].max() / top + 1e-12)), 1)
    tv = K.note_name(max(notes)) if notes else None
    return {'topVoice': tv, 'topVoice_dB_reLoudest': lv.get(tv), 'loudestPartial': K.note_name(69 + 12 * np.log2(fl / 440)), 'chordTones_dB': lv}


def shipped():
    doc = json.load(open(f'{ROOT}/audio/cues.json')); cues = doc['cues']
    with ProcessPoolExecutor(max_workers=4) as ex:
        rows = list(ex.map(one, cues, chunksize=4))
    tp = [(r['id'], e, r[e]['TP_dBFS']) for r in rows for e in ('ogg', 'm4a') if r.get(e, {}).get('TP_dBFS') is not None]
    over = [t for t in tp if t[2] > -1.0]
    missing = [(r['id'], e) for r in rows for e in ('ogg', 'm4a') if not r.get(e, {}).get('present')]
    notsame = [(r['id'], e) for r in rows for e in ('ogg', 'm4a') if r.get(e, {}).get('present') and not r[e].get('sameAsRuntime')]
    loops = [r for r in rows if r['loop'] and r.get('ogg', {}).get('present')]
    seam_bad = [(r['id'], e, r[e].get('wrap'), r[e].get('bodyP999')) for r in loops for e in ('ogg', 'm4a') if r[e].get('present') and not r[e].get('seamClean')]
    grid_bad = [r['id'] for r in rows if 'grid' in r and not r['grid']['exact']]
    pad_bad = [r['id'] for r in rows if r.get('padCyclic') is False]
    chug_bad = [(r['id'], r['chug']) for r in rows if r.get('chug') and r['chug'] > 3.0]
    copy_grid = [(r['id'], r['selfSim']['maxPair']) for r in rows if (r.get('selfSim') or {}).get('nearCopy')]
    copy_bad = [(r['id'], r['selfSimSliding']['maxR'], r['selfSimSliding']['band'], r['selfSimSliding']['chroma']) for r in rows if (r.get('selfSimSliding') or {}).get('nearCopy')]
    sliding = {r['id']: {k: r['selfSimSliding'][k] for k in ('band', 'chroma', 'maxR')} for r in rows if r.get('selfSimSliding')}
    tail_dip = [(r['id'], r['headTail_dB'].get(1000)) for r in rows if r.get('headTail_dB') and r['bus'] == 'music' and (r['headTail_dB'].get(1000) or 0) > 6.0]
    # ---- r2 gates (2026-09-25)
    by0 = {c['id']: c for c in cues}; E = ('ogg', 'm4a')
    mono_bad = [(r['id'], e, r[e]['levels']['corr'], r[e]['levels']['monoLoss']) for r in rows for e in E if r.get(e, {}).get('levels')
                and (r[e]['levels']['corr'] < 0.0 or r[e]['levels']['monoLoss'] > 3.0)]
    def tail_fail(t): return t and (t['endLevel_dB'] > -40.0 or t['lastSample'] >= 0.002)
    tail_bad = [(r['id'], w, (r.get(w) or {}).get('tail') if w in E else r.get('masterTail')) for r in rows if not r['loop'] for w in ('master', 'ogg', 'm4a')
                if tail_fail((r.get(w) or {}).get('tail') if w in E else r.get('masterTail'))]
    turbo_long = [(r['id'], max(r[e]['audibleMs'] for e in E if r.get(e, {}).get('ms'))) for r in rows if r['id'].endswith('_turbo') and r.get('ogg', {}).get('ms')
                  and max(r[e]['audibleMs'] for e in E if r.get(e, {}).get('ms')) > 700.0 and not by0[r['id']].get('turboCapExempt')]
    turbo_max = max((max(r[e]['audibleMs'] for e in E if r.get(e, {}).get('ms')), r['id']) for r in rows if r['id'].endswith('_turbo')
                    and r.get('ogg', {}).get('ms') and not by0[r['id']].get('turboCapExempt'))
    turbo_exempt = {r['id']: by0[r['id']].get('turboCapExempt') for r in rows if r['id'].endswith('_turbo') and by0[r['id']].get('turboCapExempt')}
    rb = {r['id']: r for r in rows}
    tada = [rb[f'rescue_tada_{i}']['ogg'].get('shsMidi') for i in range(1, 9) if f'rescue_tada_{i}' in rb and rb[f'rescue_tada_{i}'].get('ogg', {}).get('shsMidi') is not None]
    tada_ok = len(tada) == 8 and all(b > a + 0.5 for a, b in zip(tada, tada[1:]))
    gdb = lambda cid: 20 * np.log10(by0[cid].get('gain', 1.0))
    effp = lambda cid: round(rb[cid]['ogg']['levels']['phone'] + gdb(cid), 2) if cid in rb and rb[cid].get('ogg', {}).get('levels') else None
    stops = [effp(f'reel_stop_{i}') for i in range(1, 6)]; spin = effp('reel_spin_loop')
    reel_ok = None not in stops and spin is not None and min(stops) >= spin + 6.0 and max(stops) - min(stops) <= 1.0
    import mix as MX
    chains = {}
    for name, chain in MX.CHAINS.items():
        if not all(c in rb and rb[c].get('ogg', {}).get('levels') for c in chain): continue
        eff = {k: [round(rb[c]['ogg']['levels'][k] + gdb(c), 2) for c in chain] for k in ('st', 'mono', 'phone')}
        chains[name] = {**eff, 'rising': all(all(b > a for a, b in zip(v, v[1:])) for v in eff.values())}
    chains_bad = [k for k, v in chains.items() if not v['rising']]
    alarm_top = {f'alarm_land_{i}': rb[f'alarm_land_{i}']['ogg'].get('topVoice') for i in range(1, 6) if f'alarm_land_{i}' in rb}
    alarm_bad = [k for k, v in alarm_top.items() if not v or v['topVoice_dB_reLoudest'] is None or v['topVoice_dB_reLoudest'] < -3.0]
    by = {c['id']: c for c in cues}; bedLUFS = doc.get('mix', {}).get('bedLUFS', {})
    lufs_off = [(r['id'], r['ogg'].get('I_LUFS'), bedLUFS[r['id']]) for r in rows if r['id'] in bedLUFS and r.get('ogg', {}).get('I_LUFS') is not None
                and abs(r['ogg']['I_LUFS'] - bedLUFS[r['id']]) > 1.0 and not r['id'].endswith('_layer')]
    rung = [by[f'rung_bed_{k}'].get('measured', {}).get('I_LUFS') for k in ('big', 'huge', 'mega', 'epic', 'max') if f'rung_bed_{k}' in by]
    built = [r for r in rows if r['master']]
    summary = {'cues': len(cues), 'built': len(built), 'planned': len(cues) - len(built), 'filesExpected': 2 * len(cues),
               'filesPresent': 2 * len(cues) - len(missing), 'missing': missing if len(missing) <= 40 else f'{len(missing)} files (see rows)',
               'maxTP_dBFS': max((t[2] for t in tp), default=None), 'overMinus1dBTP': over, 'staticDiffersFromRuntime': notsame,
               'loops': len(loops), 'seamNotClean': seam_bad, 'gridNotExact': grid_bad, 'padNotCyclic': pad_bad, 'chugOver3': chug_bad, 'nearCopySections': copy_bad,
               'bedTailDipOver6dB_1000ms': tail_dip, 'bedLUFSoffTarget': lufs_off,
               'rungBedsLUFS': rung, 'rungBedsStrictlyRising': bool(rung and None not in rung and all(b > a for a, b in zip(rung, rung[1:]))),
               'nearCopyGridSections': copy_grid, 'selfSimSliding': sliding,
               'monoNotCompatible': mono_bad, 'tailCutOrClick': tail_bad, 'turboOver700ms': turbo_long, 'turboLongestAudibleMs': turbo_max, 'turboCapExempt': turbo_exempt,
               'tadaShsMidi': tada, 'tadaStrictlyRising': tada_ok, 'reelStopsPhoneEffective_dBFS': stops, 'reelSpinLoopPhoneEffective_dBFS': spin,
               'reelStopsPhoneOK': reel_ok, 'chains3': chains, 'chainsNotRising3': chains_bad, 'alarmTopVoice': alarm_top, 'alarmTopVoiceNotLeading': alarm_bad}
    gates = {'files': summary['filesPresent'] == summary['filesExpected'] and not notsame, 'truePeak8x': not over, 'loopSeams': not seam_bad,
             'grid': not grid_bad, 'pads': not pad_bad, 'chug': not chug_bad, 'selfSimSliding': not copy_bad, 'bedTailDip1000ms': not tail_dip,
             'monoSum': not mono_bad, 'tails': not tail_bad, 'turbo700ms': not turbo_long, 'tadaLadderRising': tada_ok, 'reelStopsPhone': bool(reel_ok),
             'chains_st_mono_phone': not chains_bad, 'alarmTopVoice': not alarm_bad, 'rungBedsRising': summary['rungBedsStrictlyRising']}
    summary['gates'] = gates; summary['failingGates'] = [k for k, v in gates.items() if not v]
    summary['PASS'] = bool(built) and all(gates.values())
    os.makedirs(QA, exist_ok=True)
    K.write_json(f'{QA}/measure_all.json', {'summary': summary, 'rows': rows}, indent=1, default=str)
    import io
    with io.StringIO(newline='') as f:
        w = csv.writer(f); w.writerow(['id', 'bus', 'loop', 'status', 'durationMs', 'gain', 'ogg_I', 'ogg_TP', 'm4a_I', 'm4a_TP', 'ogg_wrap', 'ogg_bodyP999', 'm4a_wrap', 'm4a_bodyP999', 'lenDiff_ogg', 'lenDiff_m4a'])
        for r in rows:
            o, a = r.get('ogg', {}), r.get('m4a', {})
            w.writerow([r['id'], r['bus'], r['loop'], r['status'], by[r['id']].get('durationMs'), by[r['id']].get('gain'), o.get('I_LUFS'), o.get('TP_dBFS'), a.get('I_LUFS'), a.get('TP_dBFS'),
                        o.get('wrap', ''), o.get('bodyP999', ''), a.get('wrap', ''), a.get('bodyP999', ''), o.get('lenDiff'), a.get('lenDiff')])
        K.write_text(f'{QA}/cues_table.csv', f.getvalue())
    beds = [r for r in rows if 'grid' in r]
    with io.StringIO() as f:
        f.write('| bed | grid BPM | bars | loop s | samples exact | shipped BPM ogg / m4a | I LUFS ogg | TP ogg / m4a | wrap ogg / m4a (body p99.9) | '
                'head-tail dB 250 / 1000 ms | chug | section self-sim max | C-pent | source |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n')
        for r in beds:
            g = r['grid']; o, a = r['ogg'], r['m4a']; B = by[r['id']].get('build', {})
            f.write(f"| {r['id']} | {g['bpm']} | {g['bars']} | {g['loopSeconds']} | {g['exact']} | {o.get('bpmEst')} / {a.get('bpmEst')} | {o.get('I_LUFS')} | "
                    f"{o.get('TP_dBFS')} / {a.get('TP_dBFS')} | {o.get('wrap')} / {a.get('wrap')} ({o.get('bodyP999')}) | {r['headTail_dB'].get(250)} / {r['headTail_dB'].get(1000)} | "
                    f"{r.get('chug')} | {r['selfSim'].get('maxPair')} | {r.get('cpentShare')} | {B.get('source')} |\n")
        K.write_text(f'{QA}/beds_table.md', f.getvalue())
    print(json.dumps(summary, indent=1, default=str))


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'draws': draws()
    else: shipped()
