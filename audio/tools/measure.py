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
    json.dump(rows, open(f'{QA}/music_draws_measured.json', 'w'), indent=1)
    print('wrote', os.path.relpath(f'{QA}/music_draws_measured.json', ROOT), len(rows), 'draws')


# ------------------------------------------------------------------------------------------ shipped files
def one(c):
    cid = c['id']; out = {'id': cid, 'bus': c['bus'], 'loop': bool(c.get('loop')), 'status': c.get('status')}
    mast = f'{K.MAST}/{cid}.wav'; out['master'] = os.path.exists(mast)
    m = lk.decode(mast) if out['master'] else None
    out['masterSamples'] = len(m) if m is not None else None
    for f in c['files']:
        ext = f.rsplit('.', 1)[1]; p = os.path.join(STATIC_BASE, f); r = f'{K.RUN}/{cid}.{ext}'
        d = {'present': os.path.exists(p)}
        if d['present']:
            I, TP = K.measure(p); d.update(I_LUFS=I, TP_dBFS=TP)
            d['sameAsRuntime'] = os.path.exists(r) and sha(r) == sha(p)
            x = lk.decode(p); d['samples'] = len(x)
            if m is not None: d['lenDiff'] = len(x) - len(m)
            if out['loop']:
                y = x[:len(m)] if (m is not None and len(x) >= len(m)) else x
                w, b = lk.wrap_step(y); d.update(wrap=w, bodyP999=b, seamClean=bool(w <= b))
            if c['bus'] == 'music' and c.get('tempoBpm') and out['loop']:
                bpm = c['tempoBpm']; d['bpmEst'] = round(float(K.tempo_autocorr(x, bpm - 12, bpm + 12)), 2)
        out[ext] = d
    if out['loop'] and m is not None:
        out['headTail_dB'] = {w: v[2] for w, v in lk.headtail(m, (50, 250, 1000)).items()}
    if c['bus'] == 'music' and c.get('tempoBpm') and out['loop'] and m is not None:
        bpm = c['tempoBpm']; bars = (c.get('build') or {}).get('bars') or c.get('bars')
        if bars:
            want = int(round(bars / 8 * K.stage_for(bpm)))
            out['grid'] = {'bpm': bpm, 'bars': bars, 'samples': len(m), 'expected': want, 'exact': len(m) == want,
                           'barSeconds': round(4 * 60 / bpm, 5), 'loopSeconds': round(len(m) / SR, 4)}
            out['chug'] = chug_ratio(m, bpm); out['selfSim'] = selfsim(m, bpm, bars); out['cpentShare'] = round(cpent_share(m), 3)
    return out


def shipped():
    doc = json.load(open(f'{ROOT}/audio/cues.json')); cues = doc['cues']
    with ProcessPoolExecutor(max_workers=6) as ex:
        rows = list(ex.map(one, cues, chunksize=4))
    tp = [(r['id'], e, r[e]['TP_dBFS']) for r in rows for e in ('ogg', 'm4a') if r.get(e, {}).get('TP_dBFS') is not None]
    over = [t for t in tp if t[2] > -1.0]
    missing = [(r['id'], e) for r in rows for e in ('ogg', 'm4a') if not r.get(e, {}).get('present')]
    notsame = [(r['id'], e) for r in rows for e in ('ogg', 'm4a') if r.get(e, {}).get('present') and not r[e].get('sameAsRuntime')]
    loops = [r for r in rows if r['loop'] and r.get('ogg', {}).get('present')]
    seam_bad = [(r['id'], e, r[e].get('wrap'), r[e].get('bodyP999')) for r in loops for e in ('ogg', 'm4a') if r[e].get('present') and not r[e].get('seamClean')]
    grid_bad = [r['id'] for r in rows if 'grid' in r and not r['grid']['exact']]
    chug_bad = [(r['id'], r['chug']) for r in rows if r.get('chug') and r['chug'] > 3.0]
    copy_bad = [(r['id'], r['selfSim']['maxPair']) for r in rows if (r.get('selfSim') or {}).get('nearCopy')]
    tail_dip = [(r['id'], r['headTail_dB'].get(1000)) for r in rows if r.get('headTail_dB') and r['bus'] == 'music' and (r['headTail_dB'].get(1000) or 0) > 6.0]
    by = {c['id']: c for c in cues}; bedLUFS = doc.get('mix', {}).get('bedLUFS', {})
    lufs_off = [(r['id'], r['ogg'].get('I_LUFS'), bedLUFS[r['id']]) for r in rows if r['id'] in bedLUFS and r.get('ogg', {}).get('I_LUFS') is not None
                and abs(r['ogg']['I_LUFS'] - bedLUFS[r['id']]) > 1.0 and not r['id'].endswith('_layer')]
    rung = [by[f'rung_bed_{k}'].get('measured', {}).get('I_LUFS') for k in ('big', 'huge', 'mega', 'epic', 'max') if f'rung_bed_{k}' in by]
    built = [r for r in rows if r['master']]
    summary = {'cues': len(cues), 'built': len(built), 'planned': len(cues) - len(built), 'filesExpected': 2 * len(cues),
               'filesPresent': 2 * len(cues) - len(missing), 'missing': missing if len(missing) <= 40 else f'{len(missing)} files (see rows)',
               'maxTP_dBFS': max((t[2] for t in tp), default=None), 'overMinus1dBTP': over, 'staticDiffersFromRuntime': notsame,
               'loops': len(loops), 'seamNotClean': seam_bad, 'gridNotExact': grid_bad, 'chugOver3': chug_bad, 'nearCopySections': copy_bad,
               'bedTailDipOver6dB_1000ms': tail_dip, 'bedLUFSoffTarget': lufs_off,
               'rungBedsLUFS': rung, 'rungBedsStrictlyRising': bool(rung and None not in rung and all(b > a for a, b in zip(rung, rung[1:])))}
    summary['PASS'] = bool(built) and not (over or notsame or seam_bad or grid_bad or chug_bad or copy_bad) and summary['filesPresent'] == summary['filesExpected']
    os.makedirs(QA, exist_ok=True)
    json.dump({'summary': summary, 'rows': rows}, open(f'{QA}/measure_all.json', 'w'), indent=1, default=str)
    with open(f'{QA}/cues_table.csv', 'w', newline='') as f:
        w = csv.writer(f); w.writerow(['id', 'bus', 'loop', 'status', 'durationMs', 'gain', 'ogg_I', 'ogg_TP', 'm4a_I', 'm4a_TP', 'ogg_wrap', 'ogg_bodyP999', 'm4a_wrap', 'm4a_bodyP999', 'lenDiff_ogg', 'lenDiff_m4a'])
        for r in rows:
            o, a = r.get('ogg', {}), r.get('m4a', {})
            w.writerow([r['id'], r['bus'], r['loop'], r['status'], by[r['id']].get('durationMs'), by[r['id']].get('gain'), o.get('I_LUFS'), o.get('TP_dBFS'), a.get('I_LUFS'), a.get('TP_dBFS'),
                        o.get('wrap', ''), o.get('bodyP999', ''), a.get('wrap', ''), a.get('bodyP999', ''), o.get('lenDiff'), a.get('lenDiff')])
    beds = [r for r in rows if 'grid' in r]
    with open(f'{QA}/beds_table.md', 'w') as f:
        f.write('| bed | grid BPM | bars | loop s | samples exact | shipped BPM ogg / m4a | I LUFS ogg | TP ogg / m4a | wrap ogg / m4a (body p99.9) | '
                'head-tail dB 250 / 1000 ms | chug | section self-sim max | C-pent | source |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n')
        for r in beds:
            g = r['grid']; o, a = r['ogg'], r['m4a']; B = by[r['id']].get('build', {})
            f.write(f"| {r['id']} | {g['bpm']} | {g['bars']} | {g['loopSeconds']} | {g['exact']} | {o.get('bpmEst')} / {a.get('bpmEst')} | {o.get('I_LUFS')} | "
                    f"{o.get('TP_dBFS')} / {a.get('TP_dBFS')} | {o.get('wrap')} / {a.get('wrap')} ({o.get('bodyP999')}) | {r['headTail_dB'].get(250)} / {r['headTail_dB'].get(1000)} | "
                    f"{r.get('chug')} | {r['selfSim'].get('maxPair')} | {r.get('cpentShare')} | {B.get('source')} |\n")
    print(json.dumps(summary, indent=1, default=str))


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'draws': draws()
    else: shipped()
