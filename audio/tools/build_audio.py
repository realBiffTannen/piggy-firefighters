#!/usr/bin/env python3
"""PIGGY FIREFIGHTERS audio BUILD (2026-09-25) — raw ElevenLabs draws -> 24-bit masters -> runtime AAC 160k + Opus 160k.

The family's recommission pipeline (LUCKY audio/tools/build_lucky.py, itself the Piggy Workers round-7/recommission chain)
adapted for this title. Same kit (kit.py: load / fine_tempo / time_scale / loopkit.cut / limit / ship), same acceptance
(sample-exact whole-bar loops, both codecs <= -1 dBTP, key-fit, tonic-snapped ladders). What is new here, and why:
  * beds come from audio/tools/plans.json (cue, bpm, bars, target LUFS, hook) + bed_overrides.json (measured source picks);
  * the hook is the Firefighters call G C E G | A G E C in firehouse timbres (hook_layer.py: glock / bugle / bell / vibes);
  * EVERY ladder root is snapped to the TONIC (the LUCKY bug: a root snapped to A3 gave an A-major-pentatonic ladder
    with C# and F#); the reel-stop ladder is C D E G A, the ignition ladder C5 D5 E5 G5 A5, the ta-da ladder
    C D E G A C' D' E' (built from three snapped brass sources so no rung is shifted more than a few semitones);
  * the ALARM ladder is deliberately NOT pentatonic: ii -> V -> V7 -> V9 -> V13 (synthesised chime chords under the drawn
    bell strike), unresolved until trigger_fanfare, whose pickup (G C E G) resolves it — never key-fitted;
  * no donor durations exist for a new title, so a one-shot's trim cap is its drawn length + 50 ms;
  * `shots` (fanfare pickups) is IDEMPOTENT: it always mixes into the pre-pickup master kept in audio/masters/_src/_prepickup;
  * turbo variants are their own last step (`turbo`), so they inherit ladders and pickups;
  * nothing is written into static/assets/audio while the donor's untracked LUCKY folder is still there
    (kit.assert_static_clean; --purge-donor deletes ONLY untracked donor folders).

usage: python3 audio/tools/build_audio.py music|sfx|derived|shots|turbo|all [--only a,b] [--purge-donor]
   all = music -> sfx -> derived -> shots -> turbo; then mix.py -> gen_manifest.mjs -> measure.py -> audio_map.py -> montage.py
"""
import json, os, shutil, sys, time
import numpy as np
from scipy.signal import butter, sosfilt
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit as K
import loopkit as lk
import hook_layer as HL
import keyfit as KF
import measure as M

ROOT, SR, TOOLS = K.ROOT, K.SR, K.TOOLS
CUES_PATH = f'{ROOT}/audio/cues.json'
QA = K.QA
PASS = 'pf_0925'
JOBS = {k: v for k, v in json.load(open(f'{TOOLS}/jobs.json')).items() if not k.startswith('_')}
PROMPTS = {k: v for k, v in json.load(open(f'{TOOLS}/prompts.json')).items() if not k.startswith('_')}
PLANS = {k: v for k, v in json.load(open(f'{TOOLS}/plans.json')).items() if not k.startswith('_')}
cues_doc = json.load(open(CUES_PATH)); CUES = {c['id']: c for c in cues_doc['cues']}
report = {'music': {}, 'sfx': {}, 'derived': {}, 'shots': {}, 'turbo': {}, 'skipped': [], 'warnings': []}
PREPICK = f'{K.SRC_MAST}/_prepickup'

# ------------------------------------------------------------------------------------------ beds (from plans.json)
BEDS = {}
for pn, p in PLANS.items():
    if p.get('redrawOf') or not p.get('cue'): continue
    BEDS[p['cue']] = dict(src=f'{pn}__1', bpm=p['bpm'], bars=p['bars'], I=p['targetLUFS'], hook=p.get('hook'))
OVERRIDES_PATH = f'{TOOLS}/bed_overrides.json'  # measured source / tempo decisions (one redraw per named defect)
if os.path.exists(OVERRIDES_PATH):
    for k, v in json.load(open(OVERRIDES_PATH)).items():
        if not k.startswith('_') and k in BEDS: BEDS[k].update({kk: vv for kk, vv in v.items() if kk != 'why'})

LOOP_CUES = {'reel_spin_loop': (2.4, 80), 'hose_loop': (3.2, 150), 'ambient_station_loop': (14.0, 400)}
TRANSITION = {'shutter_slam': (0.80, -12.0), 'shutter_haul_1': (0.45, -16.0), 'shutter_haul_2': (0.45, -16.0), 'shutter_haul_3': (0.65, -16.0)}
SOURCES = {'count_ticker_src', 'alarm_land_src', 'blaze_mult_src', 'rescue_tada_src_lo', 'rescue_tada_src_mid', 'rescue_tada_src_hi'}
NO_KEYFIT = {'dead_spin_settle', 'dog_bark'}


def pre_rms(cid):
    if cid.startswith(('ambient_', 'reel_spin_loop')): return -27.0
    if cid.startswith('hose_loop'): return -24.0
    if cid.startswith(('ui_click', 'bet_change', 'count_ticker')): return -22.0
    return -20.0


PENT5 = [0, 2, 4, 7, 9]
CPENT_PC = (0, 2, 4, 7, 9)
NAMES = HL.NOTE_NAMES

# ------------------------------------------------------------------------------------------ registry helpers
TOUCHED = set()


def set_cue(cid, x, extra=None, tempo=None, loop=None):
    c = CUES[cid]; dur = round(len(x) / SR * 1000, 1)
    c['durationMs'] = dur; c['status'] = 'built'
    if loop is None: loop = bool(c.get('loop'))
    if loop:
        c['loop'] = True; c['loopPoints'] = {'startMs': 0, 'endMs': dur, 'sampleAccurate': True}
    if tempo: c['tempoBpm'] = tempo
    rec = {'pass': PASS, 'at': time.strftime('%Y-%m-%dT%H:%M:%S')}
    if extra: rec.update(extra)
    c['build'] = rec
    TOUCHED.add(cid)
    return dur


def measured(cid, res):
    CUES[cid]['measured'] = {'I_LUFS': res['I_LUFS'], 'TP_dBFS': res['TP_dBFS'], 'TP_m4a_dBFS': res.get('TP_m4a_dBFS')}


def save():
    disk = json.load(open(CUES_PATH)); by = {c['id']: i for i, c in enumerate(disk['cues'])}
    for cid in TOUCHED:
        if cid in by: disk['cues'][by[cid]] = CUES[cid]
    json.dump(disk, open(CUES_PATH, 'w'), indent=1)


def ship(y, cid, **kw):
    res = K.ship(y, cid, **kw); measured(cid, res); return res


# ------------------------------------------------------------------------------------------ analysis helpers
def ping(x, t_from=0.0, lo=200.0, hi=3000.0):
    """Dominant sustained partial after `t_from` s: (Hz, prominence = peak / median magnitude in band)."""
    m = x.mean(axis=1); a = int(t_from * SR); seg = m[a:]
    if len(seg) < 2048: return None, 0.0
    e = np.convolve(seg ** 2, np.ones(1024) / 1024, 'same'); c = int(np.argmax(e))
    s0 = max(0, c - 512); seg = seg[s0: s0 + min(len(seg) - s0, int(0.35 * SR))]
    N = 1 << 16; X = np.abs(np.fft.rfft(seg * np.hanning(len(seg)), N)); fr = np.fft.rfftfreq(N, 1 / SR)
    sel = np.nonzero((fr > lo) & (fr < hi))[0]; i = sel[int(np.argmax(X[sel]))]
    if 0 < i < len(X) - 1:
        al, be, ga = np.log(X[i - 1] + 1e-12), np.log(X[i] + 1e-12), np.log(X[i + 1] + 1e-12)
        d = 0.5 * (al - ga) / (al - 2 * be + ga + 1e-12)
    else: d = 0.0
    return float((i + d) * SR / N), float(X[i] / (np.median(X[sel]) + 1e-12))


def midi(hz): return 69 + 12 * np.log2(hz / 440.0)


def snap_semis(hz, target_pc=None):
    mm = midi(hz); cands = [o * 12 + pc for o in range(1, 10) for pc in ((target_pc,) if target_pc is not None else CPENT_PC)]
    best = min(cands, key=lambda c: abs(c - mm)); return best - mm


def onset_peak(y, win_ms=25):
    e = np.convolve((y ** 2).mean(axis=1), np.ones(int(win_ms * SR / 1000)) / int(win_ms * SR / 1000), 'same'); return int(np.argmax(e))


def hp(v, hz_):
    return sosfilt(butter(4, hz_, 'highpass', fs=SR, output='sos'), v, axis=0)


def pad_to(y, n):
    return y if len(y) >= n else np.concatenate([y, np.zeros((n - len(y), 2))])


# ------------------------------------------------------------------------------------------ beds
def section_ride(x, bpm, bars, window_db=2.0, max_db=6.0):
    """PERIODIC section ride (LUCKY): per-section level pulled toward the loop mean only beyond +-window_db, raised-cosine
    between section centres, wrapping round the loop end, so a quiet composed section cannot make the loop dip and no
    gain step lands on the seam. Sections: 8 bars (32-bar beds), 2 bars (8/16-bar), 1 bar (4-bar layers)."""
    per = 8 if bars >= 32 else (2 if bars >= 8 else 1)
    n = bars // per; L = len(x); sec = L / n
    lv = np.array([HL.rms_db(x[int(i * sec):int((i + 1) * sec)]) for i in range(n)]); d = lv.mean() - lv
    g = np.sign(d) * np.clip(np.abs(d) - window_db, 0, max_db)
    if np.abs(g).max() < 0.25: return x, [0.0] * n, [round(float(v), 1) for v in lv]
    p = np.arange(L) / sec - 0.5; i0 = np.floor(p).astype(int); frac = p - i0
    w = (1 - np.cos(np.pi * frac)) / 2; gi = g[i0 % n] * (1 - w) + g[(i0 + 1) % n] * w
    return x * (10 ** (gi / 20))[:, None], [round(float(v), 2) for v in g], [round(float(v), 1) for v in lv]


def bar_lift(x, bpm, bars, below_db=4.0, aim_db=2.5, max_db=8.0):
    """BAR-level lift for a sparse intro bar the 8-bar section ride cannot see (a draw's quiet first bar, found by
    `measure.py draws` as 'quiet intro'): any bar more than `below_db` under the loop's median bar level is raised to
    median - `aim_db` (at most +max_db). Lift only (never a cut); the gain ramps UP over the lifted bar's first half beat
    (so the seam, which sits on a bar line, stays at unity gain) and DOWN over its last beat (so the next bar's downbeat
    is never boosted)."""
    L = len(x); bar = L / bars; beat = bar / 4
    lv = np.array([HL.rms_db(x[int(i * bar):int((i + 1) * bar)]) for i in range(bars)]); med = float(np.median(lv))
    g = np.where(lv < med - below_db, np.minimum(max_db, med - aim_db - lv), 0.0)
    if not g.any(): return x, [0.0] * bars
    gd = np.zeros(L)
    for i in range(bars):
        if g[i] <= 0: continue
        a, b = int(round(i * bar)), int(round((i + 1) * bar)); up, dn = int(beat / 2), int(beat)
        env = np.full(b - a, g[i])
        env[:up] = g[i] * (1 - np.cos(np.linspace(0, np.pi, up))) / 2
        env[-dn:] = np.minimum(env[-dn:], g[i] * (1 + np.cos(np.linspace(0, np.pi, dn))) / 2)
        gd[a:b] = np.maximum(gd[a:b], env)
    return x * (10 ** (gd / 20))[:, None], [round(float(v), 2) for v in g]


def material_end(x, drop_db=15.0, win_s=0.25):
    """Sample index where the draw's own ending (its closing decay / fade) starts: the last window within drop_db of the
    body median. Every music_v1 draw closes with a decay, and a loop that runs into it dips at the seam."""
    n = int(win_s * SR); m = (x ** 2).mean(axis=1); k = len(m) // n
    lv = np.array([10 * np.log10(m[i * n:(i + 1) * n].mean() + 1e-12) for i in range(k)]); body = np.median(lv)
    ok = np.nonzero(lv > body - drop_db)[0]
    return int((ok[-1] + 1) * n) if len(ok) else len(x)


def pitch_bed(x, semis):
    """Whole-mix transposition for a bed drawn in the wrong mode/centre (rubberband, formants kept, length kept)."""
    r = 2 ** (semis / 12.0); os.makedirs(K.RUN, exist_ok=True); tin, tout = f'{K.RUN}/_pb_in.wav', f'{K.RUN}/_pb_out.wav'; K.enc_wav(x, tin)
    K.run('ffmpeg', '-v', 'error', '-nostdin', '-y', '-i', tin, '-af', f'rubberband=pitch={r:.8f}:transients=mixed:formant=preserved:pitchq=quality',
          '-ac', '2', '-c:a', 'pcm_s24le', tout, check=True)
    y = lk.decode(tout); n = min(len(x), len(y)); return y[:n]


def add_hook(x, bpm, colour, octave, places, rel):
    hook = HL.stereo(HL.render(HL.HOOK * 2, bpm, colour, octave)); bar = int(4 * 60.0 / bpm * SR)
    for pb in places:
        s = pb * bar; seg = x[s:s + 4 * bar]
        want = HL.rms_db(seg) + rel; h = hook[: min(len(hook), len(x) - s)]
        h = h * 10 ** ((want - HL.rms_db(hook[: 4 * bar])) / 20)
        x[s:s + len(h)] += h
    return x


def bed(cid, cfg):
    src, bpm, bars, target_I = cfg['src'], cfg['bpm'], cfg['bars'], cfg['I']
    x = K.load(f'{K.PCM}/{src}.wav')
    semis = cfg.get('semis') or 0.0
    if semis:  # measured wrong centre (e.g. the Inferno draw came back in C minor: -3 st puts it on A = the plan's A-minor pentatonic)
        x = pitch_bed(x, semis)
    end = material_end(x); x = x[:end]  # never loop into the draw's closing decay
    meas = cfg.get('bpmOverride') or K.fine_tempo(x, bpm - 4.0, bpm + 4.0); factor = meas / bpm
    oa = cfg.get('onsetAfter', 0.0)  # a draw that opens with near-silence: the first onset AFTER it is the downbeat
    t0 = oa + K.first_onset(x[int(oa * SR):]) + cfg.get('start', 0) * 4 * 60.0 / meas
    y = K.time_scale(x, factor)
    STAGE = K.stage_for(bpm); BAR = STAGE // 8
    s = int(round(t0 * factor * SR)); L = int(round(bars / 8 * STAGE)); X = int(0.06 * SR)
    how = 'head'
    if s + L + X > len(y):  # round 7's rule: stretch only the final bar to complete the loop
        deficit = s + L - len(y)
        last = y[len(y) - BAR:]
        y = np.concatenate([y[:len(y) - BAR], K.time_scale(last, (BAR + deficit + 64) / BAR)])
        if len(y) < s + L: y = np.concatenate([y, np.zeros((s + L - len(y), 2))])
        how = f'tail; final bar stretched {deficit / SR * 1000:.0f} ms ({deficit / BAR * 100:.1f}%)'
        loop = lk.cut(y, s, L, X, 'tail') if s - X >= 0 else y[s:s + L].copy()
        if abs(deficit) > 0.25 * BAR: report['warnings'].append(f'{cid}: draw short by {deficit / BAR * 100:.0f}% of a bar (final bar stretched)')
    else:
        loop = lk.cut(y, s, L, X, 'head')
    assert len(loop) == L, (len(loop), L)
    loop, ride_g, lv = section_ride(loop, bpm, bars)
    loop, lift_g = bar_lift(loop, bpm, bars)
    hk = cfg.get('hook')
    if hk: loop = add_hook(loop, bpm, *hk)
    K.enc_wav(loop, f'{K.RUN}/_m.wav'); I, _ = K.measure(f'{K.RUN}/_m.wav'); base = loop * 10 ** ((target_I - I) / 20)
    for ceiling in (-2.0, -3.5, -5.0, -6.5):
        out, limited = K.limit_cyclic(base, ceiling_db=ceiling)
        res = K.ship(K.pad_loop(out), cid, tp_target=-1.3)
        if res['I_LUFS'] is not None and res['I_LUFS'] >= target_I - 1.0: break
    # land ON the target (+-0.1 LU): the rung beds must rise strictly in 0.2 LU steps, and the limiter eats a variable amount
    for _ in range(4):
        if res['I_LUFS'] is None or abs(target_I - res['I_LUFS']) <= 0.1: break
        base = base * 10 ** ((target_I - res['I_LUFS']) / 20)
        out, limited = K.limit_cyclic(base, ceiling_db=ceiling)
        res = K.ship(K.pad_loop(out), cid, tp_target=-1.3)
    out = lk.decode(f'{K.MAST}/{cid}.wav')[K.PAD:K.PAD + L]  # the loop as shipped (after ship's constant true-peak gain)
    wrap, body = lk.wrap_step(out)
    ht = lk.headtail(out, (50, 250, 1000))
    shipped = lk.decode(f'{K.RUN}/{cid}.ogg')[K.PAD:K.PAD + L]
    shipped_bpm = K.tempo_autocorr(shipped, bpm - 12, bpm + 12)
    meta = dict(source=src, measuredBpm=round(float(meas), 3), bpmOverride=bool(cfg.get('bpmOverride')), gridBpm=bpm, bars=bars,
                startSeconds=round(t0, 3), materialEnd_s=round(end / SR, 2), transposeSemis=semis or None,
                barLift_dB=({i: v for i, v in enumerate(lift_g) if v} or None),
                samples=len(out), padSamples=K.PAD, barSamples=round(len(out) / bars, 2), blend=how, wrap=round(float(wrap), 4), bodyP999=round(float(body), 4),
                headTail_dB={w: v[2] for w, v in ht.items()}, sectionRMS_raw=lv, sectionRide_dB=ride_g, limiterCeiling_dB=ceiling,
                limitedFraction=round(limited, 4), shippedBpmEst=round(float(shipped_bpm), 2), cpentShare=round(M.cpent_share(out), 3),
                chug=round(M.chug_ratio(out, bpm), 2), selfSim=M.selfsim(out, bpm, bars),
                hook=({'colour': hk[0], 'octave': hk[1], 'bars': hk[2], 'relDb': hk[3], 'notes': 'G C E G | A G E C x2'} if hk else None))
    print(f"{cid}: {src} draw={meas:.3f} grid={bpm} bars={bars} {how} wrap={wrap:.4f}/{body:.4f} ride={ride_g} I={res['I_LUFS']} TP={res['TP_dBFS']} "
          f"shippedBpm~{shipped_bpm:.2f} chug={meta['chug']} selfSimMax={meta['selfSim'].get('maxPair')} lift={meta['barLift_dB']} ht={meta['headTail_dB']}")
    return out, res, meta


def music(only=None):
    out = {}
    for cid, cfg in BEDS.items():
        if only and cid not in only: continue
        if not os.path.exists(f"{K.PCM}/{cfg['src']}.wav"): report['skipped'].append(f"{cid}: no draw {cfg['src']}"); continue
        x, res, meta = bed(cid, cfg)
        set_cue(cid, K.pad_loop(x), meta, tempo=cfg['bpm'], loop=True); measured(cid, res)
        dur = round((len(x) + 2 * K.PAD) / SR * 1000, 1)
        CUES[cid]['loopPoints'] = {'startMs': K.PAD_MS, 'endMs': round(K.PAD_MS + len(x) / SR * 1000, 4), 'sampleAccurate': True,
                                   'padSamples': K.PAD, 'loopSamples': len(x), 'note': 'cyclic codec-guard pre/post-roll; loop [startMs, endMs)'}
        CUES[cid]['durationMs'] = dur
        out[cid] = {**res, **meta}
    return out


# ------------------------------------------------------------------------------------------ SFX
SNAP = {  # tonal ladder roots / sources: snap the measured partial to the TONIC (or the named pitch class)
    'reel_stop_1': dict(target_pc=0, t_from=0.0, lo=100, hi=700, min_prom=8.0),
    'rescue_tada_src_lo': dict(target_pc=0, t_from=0.15, lo=90, hi=1400, min_prom=6.0),
    'rescue_tada_src_mid': dict(target_pc=7, t_from=0.15, lo=120, hi=1600, min_prom=6.0),
    'rescue_tada_src_hi': dict(target_pc=0, t_from=0.15, lo=200, hi=2400, min_prom=6.0),
}


def pitch_fix(cid, y, spec):
    hz, prom = ping(y, spec.get('t_from', 0.0), spec.get('lo', 200), spec.get('hi', 3000))
    info = {'measuredHz': round(hz, 1) if hz else None, 'prominence': round(prom, 1)}
    if not hz or prom < spec.get('min_prom', 10.0):
        info['op'] = 'no usable pitched partial; left as drawn'; report['warnings'].append(f'{cid}: {info["op"]} (prominence {prom:.1f})'); return y, info
    st = snap_semis(hz, spec.get('target_pc'))
    if abs(st) > 7: info['op'] = f'correction {st:+.2f} st too large; left as drawn'; report['warnings'].append(f'{cid}: {info["op"]}'); return y, info
    if abs(st) >= 0.12: y = K.pitch(y, st, preserve_len=True)
    # verify the SAME partial moved where it should: search +-1.5 st around the expected frequency. (A free re-measure in the
    # whole band can pick another partial, e.g. the 3rd harmonic G5 of a C source, and the ta-da ladder then treats a C
    # source as G, landing its rungs a fourth off: every rung built from it would carry an F.)
    want = hz * 2 ** (st / 12)
    hz2, _ = ping(y, spec.get('t_from', 0.0), want * 2 ** (-1.5 / 12), want * 2 ** (1.5 / 12))
    mm = midi(want)
    info.update(op='pitch-snapped', semis=round(float(st), 2), postHz=round(hz2, 1) if hz2 else None, midi=round(float(mm), 2),
                postErrCents=round(float(1200 * np.log2(hz2 / want)), 1) if hz2 else None,
                targetNote=NAMES[int(round(mm)) % 12] + str(int(round(mm)) // 12 - 1))
    return y, info


def tuned(note, dur, colours=(('glock', 0.6), ('chime', 0.55)), blip=False):
    """the tuned layer of a hybrid cue: glockenspiel + chime at an exact note (C major pentatonic)."""
    f = HL.hz(note); y = sum(g * HL.tone(f, dur, c) for c, g in colours)
    if blip: y *= np.exp(-np.arange(len(y)) / SR / 0.05)
    return HL.stereo(y / (np.abs(y).max() + 1e-12))


def hybrid_ping(drawn, note, rel_db=0.0, dur=0.6):
    """drawn character (kept as drawn) + a tuned ping at `note` placed on the drawn onset peak."""
    on = max(0, onset_peak(drawn) - int(0.01 * SR))
    t = tuned(note, dur)
    lvl = HL.rms_db(drawn[on:on + int(0.12 * SR)]) if len(drawn) - on > 100 else HL.rms_db(drawn)
    t = t * 10 ** ((lvl + rel_db - HL.rms_db(t[: int(0.12 * SR)])) / 20)
    out = pad_to(drawn.copy(), on + len(t)); out[on:on + len(t)] += t
    return out, on


def hybrid_chord(strike, notes, dur=0.9, strike_db=-4.0, top_glock=True):
    """a short drawn strike (the bell's clapper transient) + a synthesised chime chord (+ the top note on glockenspiel)."""
    c = HL.chord(notes, dur, 'chime', spread_ms=6.0)
    if top_glock: c = 0.8 * c + 0.35 * HL.tone(HL.hz(max(notes)), dur, 'glock')
    c = HL.stereo(c / (np.abs(c).max() + 1e-12))
    s = strike / (np.abs(strike).max() + 1e-12) * 10 ** (strike_db / 20)
    out = pad_to(c.copy(), len(s)); out[:len(s)] += s
    return out


def keyfit(cid, y):
    pal = PROMPTS.get(cid, {}).get('palette', 'mech'); a = KF.analyse(y); st, why = KF.decide(a, pal)
    info = {'offsetCents': a['offsetCents'], 'tonality': a['tonality'], 'cpentShareDrawn': a['share'][0], 'decision': why, 'semis': st}
    if st:
        before = M.cpent_share(y); z = K.pitch(y, st, preserve_len=True); after = M.cpent_share(z)
        info['cpentShare110_2500'] = [round(before, 3), round(after, 3)]
        # guard: keyfit.analyse reads 150-4000 Hz and can be steered by one very high ring (sym_win_h2: a 3.9 kHz shield
        # partial) while the body under 2.5 kHz was already in key; a transposition that makes the body worse is reverted.
        if after < before - 0.05:
            info['decision'] += f' -> REVERTED (C-pent share 110-2500 Hz {before:.2f} -> {after:.2f})'; info['semis'] = 0.0
            report['warnings'].append(f'{cid}: key-fit reverted ({before:.2f} -> {after:.2f} below 2.5 kHz)')
        else: y = z; info['cpentShareShipped'] = round(after, 3)
    return y, info


def master_draw(name):
    """One raw draw -> a shipped cue (cue id == draw name) or a mastered ladder SOURCE (audio/masters/_src)."""
    j = JOBS[name]; x = K.load(f'{K.PCM}/{name}.wav')
    if name in LOOP_CUES:
        L, xf = LOOP_CUES[name]
        x, kinfo = keyfit(name, x)
        y = K.loop_cut(x, L, xf)
        y = K.norm_rms(y, pre_rms(name), peak_db=-8.0 if name != 'ambient_station_loop' else -14.0)
        wrap, body = lk.wrap_step(y)
        res = ship(y, name); res['wrap'] = round(float(wrap), 4); res['bodyP999'] = round(float(body), 4)
        set_cue(name, y, {'source': f'{name}.wav', 'loopCut_s': L, 'xfade_ms': xf, 'wrap': res['wrap'], 'bodyP999': res['bodyP999'], 'key': kinfo}, loop=True)
        return {**res, 'key': kinfo}
    if name in TRANSITION:
        cap, rms = TRANSITION[name]
        y = K.trim(x, max_s=cap); y, kinfo = keyfit(name, y); y = K.norm_rms(y, rms)
        res = ship(y, name); set_cue(name, y, {'source': f'{name}.wav', 'trimCap_s': cap, 'key': kinfo}, loop=False)
        return {**res, 'key': kinfo}
    cap = max(0.25, j['s'] + 0.05)  # a new title has no donor lengths: cap = the drawn length
    extra = {'source': f'{name}.wav', 'trimCap_s': round(cap, 2)}
    if name == 'count_ticker_src':
        y = K.trim(x, max_s=0.25); p = K.save_src(y, name); return {'source': os.path.relpath(p, ROOT)}
    if name in ('alarm_land_src', 'blaze_mult_src'):
        y = K.trim(x, max_s=cap); p = K.save_src(y, name); return {'source': os.path.relpath(p, ROOT), 'len_s': round(len(y) / SR, 3)}
    y = K.trim(x, max_s=cap)
    if name in SNAP:
        y, info = pitch_fix(name, y, SNAP[name]); extra['pitch'] = info
        if name in SOURCES:
            p = K.save_src(y, name); json.dump(info, open(p[:-4] + '.json', 'w')); return {'source': os.path.relpath(p, ROOT), 'pitch': info}
    elif name == 'blaze_ignite':
        K.save_src(y, 'blaze_ignite_drawn')
        y, on = hybrid_ping(y, 72, rel_db=-3.0, dur=0.5); extra['tonal'] = {'op': f'hybrid: drawn fwoomp + tuned glock/chime ping C5 at {on / SR * 1000:.0f} ms (-3 dB)', 'note': 'C5'}
    elif name == 'blaze_mult_10':
        strike = y[: min(len(y), int(0.12 * SR))].copy(); n = int(0.04 * SR); strike[-n:] *= np.linspace(1, 0, n)[:, None]
        body = hybrid_chord(hp(strike, 400.0), [84, 88, 91], dur=1.0, strike_db=-2.0)
        out = pad_to(y * 10 ** (-3 / 20), len(body)); out[:len(body)] += body * (np.abs(y).max() + 1e-9)
        y = out; extra['tonal'] = {'op': 'hybrid: drawn slam/flare (-3 dB) + chime chord C6 E6 G6 + glock G6', 'chord': 'C6 E6 G6'}
    elif name not in NO_KEYFIT:
        y, info = keyfit(name, y); extra['key'] = info
    y = K.norm_rms(y, pre_rms(name), peak_db=-3.0)
    res = ship(y, name)
    set_cue(name, y, extra)
    return {**res, **{k: v for k, v in extra.items() if k in ('pitch', 'key', 'tonal')}}


def sfx(only=None):
    out = {}
    for name in JOBS:
        if only and name not in only: continue
        if not os.path.exists(f'{K.PCM}/{name}.wav'): report['skipped'].append(f'{name}: no draw'); continue
        if name not in SOURCES and name not in CUES: report['skipped'].append(f'{name}: not a cue id and not a source'); continue
        try:
            out[name] = master_draw(name); print('sfx', name, out[name])
            if os.path.exists(f'{PREPICK}/{name}.wav'): os.remove(f'{PREPICK}/{name}.wav')  # a fresh master invalidates its pre-pickup copy
        except Exception as e:  # noqa: BLE001 - a failed cue is reported, the build continues
            report['skipped'].append(f'{name}: {e}'); print('FAIL', name, e)
    return out


# ------------------------------------------------------------------------------------------ derived ladders
def derived(only=None):
    out = {}
    want = lambda cid: (not only) or cid in only

    def src(name):
        p = f'{K.SRC_MAST}/{name}.wav'
        return lk.decode(p) if os.path.exists(p) else None

    def mast(name):
        p = f'{K.MAST}/{name}.wav'
        return lk.decode(p) if os.path.exists(p) else None

    def put(cid, y, extra, fade_ms=10):
        fo = min(int(fade_ms * SR / 1000), max(1, int(0.2 * len(y)))); y = y.copy(); y[-fo:] *= np.linspace(1, 0, fo)[:, None]; y = y - y.mean(axis=0)
        res = ship(y, cid); set_cue(cid, y, extra); out[cid] = res

    # reel stops: C D E G A from the tonic-snapped root (length preserved)
    x = mast('reel_stop_1')
    if x is not None:
        for i, st in zip(range(2, 6), PENT5[1:]):
            if want(f'reel_stop_{i}'): put(f'reel_stop_{i}', K.pitch(x, st, True), {'from': 'reel_stop_1', 'semis': st, 'op': 'tonic ladder (C D E G A)'})
        if want('reel_stop_turbo'):
            parts = [x, K.pitch(x, 4, True), K.pitch(x, 9, True)]; n = max(len(p) for p in parts) + int(0.012 * SR); y = np.zeros((n, 2))
            for k, p in enumerate(parts): y[int(k * 0.006 * SR):int(k * 0.006 * SR) + len(p)] += p / 1.6
            put('reel_stop_turbo', K.norm_rms(y, -20.0), {'from': 'reel_stop_1', 'op': 'stack C+E+A, 6 ms roll (one merged stop for Turbo)'})
    else: report['skipped'].append('reel_stop ladder: no reel_stop_1 master')
    # alarm ladder: drawn strike + synthesised ii-V chords (NOT pentatonic by design, never key-fitted)
    x = src('alarm_land_src')
    if x is not None:
        on = onset_peak(x); a = max(0, on - int(0.004 * SR)); strike = x[a:a + int(0.07 * SR)].copy()
        n = int(0.03 * SR); strike[-n:] *= np.linspace(1, 0, n)[:, None]; strike = hp(strike, 700.0)
        for n_ in range(1, 6):
            cid = f'alarm_land_{n_}'
            if not want(cid): continue
            d = CUES[cid]['derive']; s = K.pitch(strike, d['strikeSemis'], True) if d['strikeSemis'] else strike
            y = hybrid_chord(s, d['chord'], dur=0.9, strike_db=-3.0)
            y = K.norm_rms(y, -20.0 + 0.5 * (n_ - 1), peak_db=-3.0)
            put(cid, y, {'from': 'alarm_land_src', 'op': 'hybrid: drawn strike (70 ms, HP 700 Hz) + chime chord', 'chord': [HL.name(m) for m in d['chord']],
                         'strikeSemis': d['strikeSemis']}, fade_ms=40)
    else: report['skipped'].append('alarm ladder: no alarm_land_src')
    # anticipation riser, stepped up
    x = mast('antic_riser')
    if x is not None and want('antic_riser_2'):
        put('antic_riser_2', K.pitch(x, 2, True), {'from': 'antic_riser', 'semis': 2, 'op': 'stepped riser (+2 st, same length)'}, fade_ms=30)
    # Blaze Wild ignition ladder: the drawn fwoomp (unshifted) + tuned ping per rung
    x = src('blaze_ignite_drawn')
    if x is not None:
        for i, note in zip(range(2, 6), (74, 76, 79, 81)):
            cid = f'blaze_ignite_{i}'
            if not want(cid): continue
            y, on = hybrid_ping(x, note, rel_db=-3.0, dur=0.5); y = K.norm_rms(y, -20.0, peak_db=-3.0)
            put(cid, y, {'from': 'blaze_ignite', 'op': f'hybrid: drawn fwoomp + tuned ping {HL.name(note)}', 'note': HL.name(note)}, fade_ms=20)
    # multiplier badges x2 / x3 / x5 (x10 is its own draw)
    x = src('blaze_mult_src')
    if x is not None:
        for m, lvl in ((2, -20.0), (3, -19.5), (5, -19.0)):
            cid = f'blaze_mult_{m}'
            if not want(cid): continue
            note = CUES[cid]['derive']['note']
            y, on = hybrid_ping(x, note, rel_db=0.0, dur=0.7); y = K.norm_rms(y, lvl, peak_db=-3.0)
            put(cid, y, {'from': 'blaze_mult_src', 'op': f'hybrid: drawn clank/flare + tuned ping {HL.name(note)}', 'note': HL.name(note)}, fade_ms=20)
    # count-up ticker: hybrid C5 blip, then a 12-step resampled ladder (shorter as it rises)
    x = src('count_ticker_src')
    if x is not None:
        if want('count_ticker_1'):
            n = int(0.25 * SR); click = hp(x[:int(0.015 * SR)], 1000.0); t = tuned(72, 0.25, blip=True)[:n]
            y = np.zeros((n, 2)); y[:len(t)] += t; y[:len(click)] += click / (np.abs(click).max() + 1e-12) * 10 ** (-8 / 20)
            y = K.norm_rms(y, pre_rms('count_ticker_1'), peak_db=-3.0)
            put('count_ticker_1', y, {'from': 'count_ticker_src', 'op': 'hybrid: tuned glock/chime blip C5 + drawn click (15 ms, HP 1 kHz, -8 dB)', 'note': 'C5'}, fade_ms=6)
        base = mast('count_ticker_1')
        CLAD = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26]
        for i in range(2, 13):
            if base is not None and want(f'count_ticker_{i}'):
                put(f'count_ticker_{i}', K.pitch(base, CLAD[i - 1], False), {'from': 'count_ticker_1', 'semis': CLAD[i - 1], 'op': 'pentatonic ladder (resampled)'}, fade_ms=6)
    # rescue ta-da ladder C D E G A C' D' E' from three snapped brass sources (smallest shift wins)
    srcs = {}
    for k in ('lo', 'mid', 'hi'):
        p = f'{K.SRC_MAST}/rescue_tada_src_{k}.json'; y = src(f'rescue_tada_src_{k}')
        if y is not None and os.path.exists(p):
            info = json.load(open(p))
            if info.get('midi') is not None: srcs[k] = (y, float(info['midi']))
    if srcs:
        steps = [0, 2, 4, 7, 9, 12, 14, 16]
        def cost(r):  # the tonic whose 8 rungs need the smallest worst-case shift from the nearest source
            sh = [min(abs(r + st - v[1]) for v in srcs.values()) for st in steps]; return (max(sh), sum(sh))
        root = min(range(36, 85, 12), key=cost)
        for i, st in enumerate(steps, 1):
            cid = f'rescue_tada_{i}'
            if not want(cid): continue
            target = root + st
            k = min(srcs, key=lambda kk: (abs(target - srcs[kk][1]), -srcs[kk][1]))
            shift = target - srcs[k][1]
            if abs(shift) > 5: report['warnings'].append(f'{cid}: shifted {shift:+.2f} st from {k} (sources did not spread across registers)')
            y = K.pitch(srcs[k][0], shift, True) if abs(shift) >= 0.05 else srcs[k][0].copy()
            y = K.norm_rms(y, -20.0 + 0.4 * (i - 1), peak_db=-3.0)
            put(cid, y, {'from': f'rescue_tada_src_{k}', 'semis': round(float(shift), 2), 'targetNote': HL.name(target), 'op': 'snap ladder (held note)'}, fade_ms=25)
    else: report['skipped'].append('rescue ta-da ladder: no snapped sources')
    return out


# ------------------------------------------------------------------------------------------ fanfare pickups
SHOTS = ['trigger_fanfare', 'rescue_enter', 'inferno_enter', 'backdraft_spins_start', 'building_cleared', 'total_win_big', 'rescue_total_big',
         'inferno_total_big', 'rung_hit_big', 'rung_hit_huge', 'rung_hit_mega', 'rung_hit_epic', 'rung_hit_max', 'win_max',
         'alarm_outcome_rescue', 'alarm_outcome_inferno', 'spins_added']


def shots(min_share=0.6, only=None):
    """The hook's call (G5 C6 E6 G6, glockenspiel eighths at 132 BPM, -5 dB) as a pickup on the fanfares whose own content is
    in C pentatonic. IDEMPOTENT: always mixes into the pre-pickup master (saved on first run)."""
    out = {}; os.makedirs(PREPICK, exist_ok=True)
    pick = HL.stereo(HL.render(HL.FIRST_BAR, 132, 'glock', 1, note_beats=0.5))
    for cid in SHOTS:
        if only and cid not in only: continue
        mp = f'{K.MAST}/{cid}.wav'; pp = f'{PREPICK}/{cid}.wav'
        if not os.path.exists(mp): report['skipped'].append(f'shot {cid}: no master'); continue
        if not os.path.exists(pp): shutil.copy(mp, pp)
        x = lk.decode(pp); share = M.cpent_share(x)
        s = int(0.02 * SR); h = pick[: max(0, len(x) - s)]
        rec = CUES[cid].setdefault('build', {})
        if len(h) < int(0.6 * SR) or share < min_share:
            out[cid] = {'pickup': False, 'cpentShare': round(share, 3), 'why': 'too short' if len(h) < int(0.6 * SR) else f'C-pentatonic share {share:.2f} < {min_share}'}
            ship(x, cid)  # no pickup: the pre-pickup master IS the master (undoes a pickup from an earlier run)
            rec['hook'] = out[cid]; TOUCHED.add(cid); print('no pickup', cid, out[cid]); continue
        h = h * 10 ** ((HL.rms_db(x[: len(h)]) - 5.0 - HL.rms_db(h)) / 20)
        y = x.copy(); y[s:s + len(h)] += h
        y = K.norm_rms(y, HL.rms_db(y), peak_db=-1.5); y, _ = K.limit(y, ceiling_db=-1.5)
        res = ship(y, cid)
        rec['hook'] = {'pickup': True, 'firstBar': 'G5 C6 E6 G6 glockenspiel, 132 BPM eighths, -5 dB', 'cpentShare': round(share, 3)}
        TOUCHED.add(cid); out[cid] = {**res, 'cpentShare': round(share, 3)}; print('pickup', cid, out[cid])
    return out


# ------------------------------------------------------------------------------------------ turbo variants
def turbo(only=None):
    out = {}
    for cid, c in CUES.items():
        d = c.get('derive') or {}
        if d.get('op') != 'turbo' or (only and cid not in only): continue
        p = f"{K.MAST}/{d['from']}.wav"
        if not os.path.exists(p): report['skipped'].append(f'{cid}: parent {d["from"]} not built'); continue
        x = lk.decode(p); y = K.time_scale(x, d['timeScale'])
        n = min(len(y), int(0.02 * SR)); y[-n:] *= np.linspace(1, 0, n)[:, None]
        res = ship(y, cid); set_cue(cid, y, {'from': d['from'], 'timeScale': d['timeScale'], 'op': 'turbo variant (atempo, pitch kept)'}); out[cid] = res
    return out


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'all'
    only = set(sys.argv[sys.argv.index('--only') + 1].split(',')) if '--only' in sys.argv else None
    removed = K.assert_static_clean(purge='--purge-donor' in sys.argv)
    if removed: print('removed untracked donor folders:', removed); report['purgedDonor'] = removed
    os.makedirs(QA, exist_ok=True); os.makedirs(K.RUN, exist_ok=True); os.makedirs(K.STATIC, exist_ok=True)
    steps = ['music', 'sfx', 'derived', 'shots', 'turbo'] if mode == 'all' else [mode]
    for st in steps:
        if st == 'music': report['music'] = music(only)
        elif st == 'sfx': report['sfx'] = sfx(only)
        elif st == 'derived': report['derived'] = derived(only)
        elif st == 'shots': report['shots'] = shots(only=only)
        elif st == 'turbo': report['turbo'] = turbo(only)
        else: raise SystemExit(__doc__)
        save()
    json.dump(report, open(f'{QA}/build_report_{mode}.json', 'w'), indent=1, default=str)
    print('skipped:', report['skipped']); print('warnings:', report['warnings'])
