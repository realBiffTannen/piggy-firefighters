#!/usr/bin/env python3
"""PIGGY FIREFIGHTERS audio BUILD (2026-09-25) — raw ElevenLabs draws -> 24-bit masters -> runtime AAC 160k + Opus 160k.

The family's recommission pipeline (LUCKY audio/tools/build_lucky.py, itself the Piggy Workers round-7/recommission chain)
adapted for this title. Same kit (kit.py: load / fine_tempo / time_scale / loopkit.cut / limit / ship), same acceptance
(sample-exact whole-bar loops, both codecs <= -1 dBTP, key-fit, tonic-snapped ladders). What is new here, and why:
  * beds come from audio/tools/plans.json (cue, bpm, bars, target LUFS, hook) + bed_overrides.json (measured source picks);
  * the hook is the Firefighters call G C E G | A G E C in firehouse timbres (hook_layer.py: glock / bugle / bell / vibes);
  * EVERY ladder root is snapped to the TONIC (the LUCKY bug: a root snapped to A3 gave an A-major-pentatonic ladder
    with C# and F#); the reel-stop ladder is C D E G A (drawn thunk + a tuned wood knock C5 D5 E5 G5 A5 per stop), the
    ignition ladder C5 D5 E5 G5 A5, the ta-da ladder C4 D4 E4 G4 A4 C5 D5 E5 (brass sources labelled by their FUNDAMENTAL,
    cleaned to one note, smallest upward shift: lo 0/2/4, mid 0/2/5/7/9);
  * r2 (2026-09-25) build fixes: level-only stereo on synthesised layers (hook_layer.stereo), M/S narrowing of anti-phase draws
    and a 20 Hz DC block on every draw, tuned layers that ring out (kit.ring_out), loud-tail releases (kit.trim), whole
    pickups or none, reel-stop knock voiced on the 400 Hz phone proxy, alarm top voice +6 dB, turbo cap 0.70 s, rung-bed
    tail fills, 8x true peak in ship() -- see assets/SOUND_BIBLE.md section 13;
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
from scipy.signal import butter, sosfilt, sosfiltfilt
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
    tmp = CUES_PATH + '.tmp'; json.dump(disk, open(tmp, 'w'), indent=1); os.replace(tmp, CUES_PATH)  # atomic: a failed dump never truncates the registry


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


def dc_block(x, hz_=20.0):
    """r2 (2026-09-25): zero-phase 20 Hz high-pass on every raw draw. Draws carry DC offsets up to 0.017 (blaze_mult_src);
    Opus's encoder rejects DC itself, so a faded-to-zero master decoded with a slow step tail (line_win_small.ogg ended
    on a constant 0.004 = -48 dBFS). Applied to the whole draw before any cut, so loop seams stay continuous."""
    return sosfiltfilt(butter(2, hz_, 'highpass', fs=SR, output='sos'), x, axis=0)


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


def tail_fill(y, s, L, X, bars, tf, loop):
    """r2 (2026-09-25): a loop whose last beats sit in a composed rest dips at EVERY loop point (rung_bed_big's final beat
    -18 dB under the bed median, rung_bed_mega's -5 dB: +25 / +20.6 dB head-tail at 250 ms, repeating every 19.2 s under
    the whole count-up). Fill the loop's last `beats` beats with the SAME beats (beat positions) of bar `fromBar` (1-based)
    of the time-scaled draw `y` -- a half-bar that leads into a downbeat WITHOUT the phrase-end breath (bed_overrides.json
    records the measured choice) -- through a 30 ms equal-power splice just before the fill's
    first beat, and the head blend re-made from the FILL's own continuation (y after the end of `fromBar`), so the wrap
    stays sample-continuous by construction. The grid is untouched (same length, sample-exact)."""
    BAR = L / bars; beat = BAR / 4; nb = float(tf.get('beats', 2)); fb = float(tf['fromBar'])
    a = int(round(L - nb * beat)); se = int(round(fb * BAR)); sa = se - (L - a); F = int(0.03 * SR)
    new = loop.copy(); w_out, w_in = lk.equal_power(F)
    new[a - F:a] = loop[a - F:a] * w_out + y[s + sa - F:s + sa] * w_in
    new[a:] = y[s + sa:s + se]
    wo, wi = lk.equal_power(X)
    new[:X] = y[s:s + X] * wi + y[s + se:s + se + X] * wo
    return new, {'beats': nb, 'fromBar': fb, 'fillStartBeat': round(a / beat, 2), 'why': tf.get('why')}


def bed(cid, cfg):
    src, bpm, bars, target_I = cfg['src'], cfg['bpm'], cfg['bars'], cfg['I']
    x = dc_block(K.load(f'{K.PCM}/{src}.wav'))
    x, sinfo = K.narrow(x)  # r2: mono-compatibility guard (no music draw needs it today: corr >= 0.36)
    semis = cfg.get('semis') or 0.0
    if semis:  # measured wrong centre (e.g. the Inferno draw came back in C minor: -3 st puts it on A = the plan's A-minor pentatonic)
        x = pitch_bed(x, semis)
    end = material_end(x); x = x[:end]  # never loop into the draw's closing decay
    meas = cfg.get('bpmOverride') or K.fine_tempo(x, bpm - 4.0, bpm + 4.0); factor = meas / bpm
    oa = cfg.get('onsetAfter')  # a draw that opens with a quiet pre-roll: the entry is the first sample within 12 dB of the draw's
    if oa is not None:          # peak AFTER `onsetAfter` s (the fixed 0.02 threshold fires on the pre-roll itself)
        seg = x[int(oa * SR):]; t0 = oa + K.first_onset(seg, thr=max(0.02, 10 ** (-12 / 20) * float(np.abs(x).max())))
    else: t0 = K.first_onset(x)
    t0 += cfg.get('start', 0) * 4 * 60.0 / meas
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
        # the head blend makes the seam the raw's own adjacent-sample step y[s+L-1] -> y[s+L]; on a loud, noisy downbeat (the
        # Backdraft layer's shaker + tom) that single step can exceed the body's p99.9 although it is continuous audio. Nudge the
        # start by at most +-2 ms (a 16th note at 92 BPM is 163 ms: the grid is untouched) to the smallest step.
        sh = int(0.002 * SR); cands = [d for d in range(-sh, sh + 1) if 0 <= s + d and s + d + L + X <= len(y)]
        step = lambda d: float(np.abs(y[s + d + L] - y[s + d + L - 1]).max()) + 1e-4 * abs(d) / sh
        ds = min(cands, key=step); s += ds
        if ds: how = f'head; start nudged {ds / SR * 1000:+.2f} ms to the smallest seam step'
        loop = lk.cut(y, s, L, X, 'head')
    assert len(loop) == L, (len(loop), L)
    tf_info = None
    if cfg.get('tailFill') and how.startswith('head'):
        loop, tf_info = tail_fill(y, s, L, X, bars, cfg['tailFill'], loop)
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
                chug=round(M.chug_ratio(out, bpm), 2), selfSim=M.selfsim(out, bpm, bars), tailFill=tf_info, stereo=sinfo, levels=K.levels(out),
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
    # r2 (2026-09-25): the ta-da sources are labelled and snapped by their FUNDAMENTAL (subharmonic summation, kit.shs_f0),
    # never by their loudest partial: r1 recorded lo as C5 and hi as C6 (their 2nd / 4th harmonics; both are C4 harmonic
    # series) and the ladder dropped a minor sixth at rung 3 -> 4 (perceived C4 D4 E4 G3 A3 C4 D4 E4).
    'rescue_tada_src_lo': dict(target_pc=0, t_from=0.1, method='shs'),
    'rescue_tada_src_mid': dict(target_pc=7, t_from=0.1, method='shs'),
    'rescue_tada_src_hi': dict(target_pc=0, t_from=0.1, method='shs'),
}


def pitch_fix_shs(cid, y, spec):
    """Snap a pitched source by its SHS fundamental (the perceived pitch) to the target pitch class; verify with SHS again."""
    f0, mm = K.shs_f0(y, t_from=spec.get('t_from', 0.1))
    st = snap_semis(f0, spec.get('target_pc'))
    info = {'method': 'subharmonic summation (kit.shs_f0)', 'measuredF0Hz': round(f0, 1), 'measuredNote': K.note_name(mm)}
    if abs(st) > 7: info['op'] = f'correction {st:+.2f} st too large; left as drawn'; report['warnings'].append(f'{cid}: {info["op"]}'); return y, info
    if abs(st) >= 0.12: y = pitch_bed(y, st)
    f1, m1 = K.shs_f0(y, t_from=spec.get('t_from', 0.1)); want = mm + st
    info.update(op='pitch-snapped (fundamental)', semis=round(float(st), 2), postF0Hz=round(f1, 1), midi=round(float(want), 2),
                postErrCents=round(float(100 * (m1 - want)), 1), targetNote=K.note_name(want), shift='rubberband, formants preserved')
    if abs(m1 - want) > 0.5: report['warnings'].append(f'{cid}: post-snap SHS {K.note_name(m1)} != {K.note_name(want)}')
    return y, info


def pitch_fix(cid, y, spec):
    if spec.get('method') == 'shs': return pitch_fix_shs(cid, y, spec)
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


# r2 (2026-09-25): tuned layers are rendered long (>= 1.5 s) with a natural exponential decay (`damp_s` on top of each
# colour's own partial decays) and the cue then RINGS OUT (kit.ring_out: cut once the whole sum is below -50 dB re peak,
# cap 1.6 s, cos^2 fade >= 60 ms). r1 rendered a fixed 0.5 / 0.7 / 0.9 s layer with no release, so blaze_ignite ended on a
# hard cut (ping at -25 dB), blaze_mult_2/3/5 went into a 20 ms fade at -18 dB and the alarm chords into 40 ms at -20 dB.
LAYER_S = 1.6


def tuned(note, dur, colours=(('glock', 0.6), ('chime', 0.55)), blip=False, damp_s=None):
    """the tuned layer of a hybrid cue: glockenspiel + chime at an exact note (C major pentatonic)."""
    f = HL.hz(note); y = sum(g * HL.tone(f, dur, c) for c, g in colours)
    t = np.arange(len(y)) / SR
    if blip: y *= np.exp(-t / 0.05)
    if damp_s: y *= np.exp(-t / damp_s)
    return HL.stereo(y / (np.abs(y).max() + 1e-12))


def hybrid_ping(drawn, note, rel_db=0.0, dur=LAYER_S, colours=(('glock', 0.6), ('chime', 0.55)), damp_s=0.45):
    """drawn character (kept as drawn) + a tuned ping at `note` placed on the drawn onset peak."""
    on = max(0, onset_peak(drawn) - int(0.01 * SR))
    t = tuned(note, dur, colours, damp_s=damp_s)
    lvl = HL.rms_db(drawn[on:on + int(0.12 * SR)]) if len(drawn) - on > 100 else HL.rms_db(drawn)
    t = t * 10 ** ((lvl + rel_db - HL.rms_db(t[: int(0.12 * SR)])) / 20)
    out = pad_to(drawn.copy(), on + len(t)); out[on:on + len(t)] += t
    return out, on


def hybrid_chord(strike, notes, dur=LAYER_S, strike_db=-4.0, top_glock=True, top_w=2.0, damp_s=0.6):
    """a short drawn strike (the bell's clapper transient) + a synthesised chime chord (+ the top note on glockenspiel).
    r2: the TOP voice is weighted `top_w` (+6 dB over each inner voice) so the ladder's top line (alarm A4 D5 F5 A5 B5)
    is the loudest partial of every rung: r1's alarm 3 carried the same G4 B4 D5 triad as alarm 2 with its added F5
    11 dB under the loudest partial, so the 2 -> 3 step barely read as a rise."""
    w = [1.0] * (len(notes) - 1) + [top_w]; order = np.argsort(notes); ws = [0.0] * len(notes)
    for rank, i in enumerate(order): ws[i] = w[rank]
    c = HL.chord(notes, dur, 'chime', spread_ms=6.0, weights=ws)
    if top_glock: c = 0.8 * c + 0.35 * HL.tone(HL.hz(max(notes)), dur, 'glock')
    if damp_s: c = c * np.exp(-np.arange(len(c)) / SR / damp_s)
    c = HL.stereo(c / (np.abs(c).max() + 1e-12))
    s = strike / (np.abs(strike).max() + 1e-12) * 10 ** (strike_db / 20)
    out = pad_to(c.copy(), len(s)); out[:len(s)] += s
    return out


# r2 (2026-09-25): reel-stop voicing. r1 put the tuned wood knock at C4-A4 (262-440 Hz), below a phone speaker's band:
# through a 400 Hz high-pass the loudest 400 ms fell 12.4 / 10.7 / 9.3 / 7.4 / 6.3 dB, so stops 1-2 sat UNDER the
# reel_spin_loop still running and the level rose 6 dB across the ladder. Now the knock is voiced an octave up
# (C5 D5 E5 G5 A5, rendered per stop at its exact note, never resampled) over the drawn thunk (the low body, pitched
# with the ladder as before), and its level is solved per stop so the phone proxy sits within PHONE_GAP_DB of the
# stereo level: every stop reads the same on a phone and on headphones.
REEL_KNOCK_ROOT = 72            # C5
PHONE_GAP_DB = 1.5


def reel_stop_voice(thunk, note, cap_s=0.6):
    """drawn thunk (low body) + tuned wood knock at `note`; knock level solved on the 400 Hz phone proxy."""
    for rel in np.arange(0.0, 14.01, 0.5):
        y, on = hybrid_ping(thunk, note, rel_db=float(rel), dur=cap_s, colours=(('wood', 1.0),), damp_s=None)
        lv = K.levels(y)
        if lv['st'] - lv['phone'] <= PHONE_GAP_DB: break
    y, ro = K.ring_out(y, cap_s=cap_s, fade_ms=60.0, knee_s=0.15)
    lv = K.levels(y)
    return y, {'knock': HL.name(note), 'knockRel_dB': float(rel), 'onset_ms': round(on / SR * 1000), 'levels': lv, 'ringOut': ro}


# r3 (2026-09-25, redraw fold-in): a SYMBOL WIN drawn as a sub-bass thump. sym_win_l4 ("Boots win") measured 99.5 % of its
# energy under 200 Hz in BOTH takes (v1 and the --force redraw: loudest-400 ms st -41.6 / -46.5 dBFS, 400 Hz phone proxy
# -76.1 / -80.4 dBFS, i.e. a 34 dB phone gap either way), so after mix.py's family gain it read -19.0 dBFS on headphones
# and -53.4 dBFS on a phone while every other symbol win reads -19.0 .. -20.8 on the phone proxy. The redraw did not fix
# the named defect, so the fix is the reel-stop one (offline, no paid call): the drawn stomp stays as the low body and a
# tuned wood knock on its onset carries it on a phone, level solved on the 400 Hz proxy (st - phone <= gap_db).
# Note A4 = the pitch class of the drawn thump (measured chroma A 0.70), inside C pentatonic, inside a phone's band and an
# octave under the reel-stop knocks (C5-A5), so it never reads as a reel stop. gap_db 2.5, not the reel stops' 1.5: A4's own
# loss through the 400 Hz high-pass is ~1.6 dB, so 1.5 was only reachable by burying the drawn stomp 30 dB under the knock
# (first solve, measured); at 2.5 the knock sits +8.5 dB over the stomp's onset and the stomp stays audible as the body, and
# the cue lands within 2.5 dB of every other symbol win on the phone proxy (-19.0 .. -20.8 dBFS effective).
PHONE_VOICE = {
    'sym_win_l4': dict(note=69, colour='wood', cap_s=1.05, gap_db=2.5, max_rel=24.0),
}


def phone_voice(y, note, colour='wood', cap_s=1.05, gap_db=PHONE_GAP_DB, max_rel=24.0):
    """drawn sub-heavy one-shot (kept as the body) + a tuned knock at `note` on its onset, level solved on the phone proxy."""
    lv0 = K.levels(y)
    for rel in np.arange(0.0, max_rel + 0.01, 0.5):
        z, on = hybrid_ping(y, note, rel_db=float(rel), dur=cap_s, colours=((colour, 1.0),), damp_s=None)
        lv = K.levels(z)
        if lv['st'] - lv['phone'] <= gap_db: break
    z, ro = K.ring_out(z, cap_s=cap_s, fade_ms=60.0, knee_s=0.3)
    lv = K.levels(z)
    return z, {'op': f'hybrid: drawn body + tuned {colour} knock {HL.name(note)} at {round(on / SR * 1000)} ms ({rel:+.1f} dB re the drawn onset), '
                     f'level solved on the 400 Hz phone proxy (st - phone <= {gap_db} dB)',
               'note': HL.name(note), 'knockRel_dB': float(rel), 'onset_ms': round(on / SR * 1000),
               'phoneGap_dB': {'drawn': round(lv0['st'] - lv0['phone'], 2), 'shipped': round(lv['st'] - lv['phone'], 2)}, 'levels': lv, 'ringOut': ro}


def keyfit(cid, y):
    pal = PROMPTS.get(cid, {}).get('palette', 'mech'); a = KF.analyse(y); st, why = KF.decide(a, pal)
    info = {'offsetCents': a['offsetCents'], 'tonality': a['tonality'], 'cpentShareDrawn': a['share'][0], 'decision': why, 'semis': st}
    if st:
        before = M.cpent_share(y); z = K.pitch(y, st, preserve_len=True); after = M.cpent_share(z)
        info['cpentShare110_2500'] = [round(before, 3), round(after, 3)]
        # guard: keyfit.analyse reads 150-4000 Hz and can be steered by one very high ring (sym_win_h2: a 3.9 kHz shield
        # partial) while the body under 2.5 kHz was already in key; a transposition that makes the body worse is reverted.
        if after < before - 0.05:
            # split-band fit: the body under 2.5 kHz stays as drawn (already in key), only the band above it (the ring that
            # steered the analysis) is transposed. Zero-phase low-pass + its exact complement, so unshifted it sums to the input.
            lo = sosfiltfilt(butter(4, 2500.0, 'lowpass', fs=SR, output='sos'), y, axis=0); hi_ = y - lo
            z = lo + pad_to(K.pitch(hi_, st, preserve_len=True), len(y))[:len(y)]
            a2 = KF.analyse(z); after2 = M.cpent_share(z); best0 = a2['share'][0]
            info['decision'] += (f' -> whole-cue shift would drop the 110-2500 Hz share {before:.2f} -> {after:.2f}; SPLIT-BAND: only > 2.5 kHz '
                                 f'shifted {st:+.2f} st (150-4000 Hz share {a["share"][0]:.2f} -> {best0:.2f}, 110-2500 Hz {before:.2f} -> {after2:.2f})')
            info['splitBandHz'] = 2500; info['cpentShareShipped'] = round(after2, 3); y = z
            report['warnings'].append(f'{cid}: split-band key-fit above 2.5 kHz ({a["share"][0]:.2f} -> {best0:.2f}; body {before:.2f} -> {after2:.2f})')
        else: y = z; info['cpentShareShipped'] = round(after, 3)
    return y, info


def master_draw(name):
    """One raw draw -> a shipped cue (cue id == draw name) or a mastered ladder SOURCE (audio/masters/_src)."""
    j = JOBS[name]; x = dc_block(K.load(f'{K.PCM}/{name}.wav'))
    x, sinfo = K.narrow(x)  # r2: a (partly) anti-phase draw is made mono-compatible before anything else (kit.narrow)
    if sinfo: report['warnings'].append(f'{name}: {sinfo["op"]} (drawn corr {sinfo["corrDrawn"]} -> {sinfo["corr"]})')
    tinfo = {}
    if name in LOOP_CUES:
        L, xf = LOOP_CUES[name]
        x, kinfo = keyfit(name, x)
        y = K.loop_cut(x, L, xf)
        y = K.norm_rms(y, pre_rms(name), peak_db=-8.0 if name != 'ambient_station_loop' else -14.0)
        wrap, body = lk.wrap_step(y)
        res = ship(y, name); res['wrap'] = round(float(wrap), 4); res['bodyP999'] = round(float(body), 4)
        set_cue(name, y, {'source': f'{name}.wav', 'loopCut_s': L, 'xfade_ms': xf, 'wrap': res['wrap'], 'bodyP999': res['bodyP999'], 'key': kinfo, 'stereo': sinfo}, loop=True)
        return {**res, 'key': kinfo}
    if name in TRANSITION:
        cap, rms = TRANSITION[name]
        y = K.trim(x, max_s=cap, info=tinfo); y, kinfo = keyfit(name, y); y = K.norm_rms(y, rms)
        res = ship(y, name); set_cue(name, y, {'source': f'{name}.wav', 'trimCap_s': cap, 'key': kinfo, 'stereo': sinfo, 'tail': tinfo or None}, loop=False)
        return {**res, 'key': kinfo}
    cap = max(0.25, j['s'] + 0.05)  # a new title has no donor lengths: cap = the drawn length
    extra = {'source': f'{name}.wav', 'trimCap_s': round(cap, 2)}
    if sinfo: extra['stereo'] = sinfo
    if name == 'count_ticker_src':
        y = K.trim(x, max_s=0.25); p = K.save_src(y, name); return {'source': os.path.relpath(p, ROOT)}
    if name in ('alarm_land_src', 'blaze_mult_src'):
        y = K.trim(x, max_s=cap); p = K.save_src(y, name); return {'source': os.path.relpath(p, ROOT), 'len_s': round(len(y) / SR, 3)}
    y = K.trim(x, max_s=cap, info=tinfo)
    if tinfo: extra['tail'] = tinfo
    if name in SNAP:
        y, info = pitch_fix(name, y, SNAP[name]); extra['pitch'] = info
        if name == 'reel_stop_1':
            # measured 2026-09-25: the drawn wooden thunk holds 99-100 % of its energy under 200 Hz (partials 65 / 91 / 139 /
            # 200 Hz, inharmonic), i.e. it is close to silent on a phone speaker and has no clear pitch for a C D E G A
            # ladder. Hybrid: the thunk (sub-sonic rumble high-passed at 45 Hz) = the low body, + a tuned marimba/woodblock
            # knock at C5 on its onset (r2: an octave up from r1's C4, level solved on the 400 Hz phone proxy,
            # reel_stop_voice); the derived ladder pitches the thunk and renders a fresh knock per stop (C5 D5 E5 G5 A5).
            y = hp(y, 45.0); K.save_src(y, 'reel_stop_thunk')
            y, vinfo = reel_stop_voice(y, REEL_KNOCK_ROOT)
            extra['tonal'] = {'op': f'hybrid: drawn thunk (HP 45 Hz) + tuned wood knock C5 at {vinfo["onset_ms"]} ms ({vinfo["knockRel_dB"]:+.1f} dB, phone-proxy solved)',
                              'note': 'C5', **vinfo}
            y = K.norm_rms(y, pre_rms(name), peak_db=-3.0); res = ship(y, name); set_cue(name, y, extra)
            return {**res, 'tonal': extra['tonal']}
        if name in SOURCES:
            if SNAP[name].get('method') == 'shs' and info.get('midi') is not None:  # a ladder rung is ONE note (kit.harmonic_only)
                f0 = 440.0 * 2 ** ((info['midi'] - 69) / 12); e0 = float((y ** 2).sum()); y = K.harmonic_only(y, f0)
                info['harmonicOnly'] = {'f0Hz': round(f0, 2), 'floor_dB': -18.0, 'energyKept_dB': round(10 * np.log10(float((y ** 2).sum()) / (e0 + 1e-12)), 2),
                                        'cpentShare': round(M.cpent_share(y), 3)}
            p = K.save_src(y, name); json.dump(info, open(p[:-4] + '.json', 'w')); return {'source': os.path.relpath(p, ROOT), 'pitch': info}
    elif name == 'blaze_ignite':
        K.save_src(y, 'blaze_ignite_drawn')
        y, on = hybrid_ping(y, 72, rel_db=-3.0); y, ro = K.ring_out(y)
        extra['tonal'] = {'op': f'hybrid: drawn fwoomp + tuned glock/chime ping C5 at {on / SR * 1000:.0f} ms (-3 dB), rings out', 'note': 'C5', 'ringOut': ro}
    elif name == 'blaze_mult_10':
        strike = y[: min(len(y), int(0.12 * SR))].copy(); n = int(0.04 * SR); strike[-n:] *= np.linspace(1, 0, n)[:, None]
        body = hybrid_chord(hp(strike, 400.0), [84, 88, 91], strike_db=-2.0)
        out = pad_to(y * 10 ** (-3 / 20), len(body)); out[:len(body)] += body * (np.abs(y).max() + 1e-9)
        y, ro = K.ring_out(out)
        extra['tonal'] = {'op': 'hybrid: drawn slam/flare (-3 dB) + chime chord C6 E6 G6 (top voice +4 dB) + glock G6, rings out', 'chord': 'C6 E6 G6', 'ringOut': ro}
    elif name not in NO_KEYFIT:
        y, info = keyfit(name, y); extra['key'] = info
    if name in PHONE_VOICE:
        y, extra['tonal'] = phone_voice(y, **PHONE_VOICE[name])
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
        fo = min(int(fade_ms * SR / 1000), max(1, int(0.2 * len(y)))); y = y - y.mean(axis=0); y[-fo:] *= np.linspace(1, 0, fo)[:, None]  # DC first, so the fade ends on 0
        res = ship(y, cid); set_cue(cid, y, extra); out[cid] = res

    # reel stops: C D E G A. r2: the drawn thunk (tonic-snapped, HP 45 Hz; masters/_src/reel_stop_thunk) is pitched with the
    # ladder (length kept) as the low body, and each stop gets its OWN tuned wood knock one octave up (C5 D5 E5 G5 A5),
    # level-solved on the 400 Hz phone proxy (reel_stop_voice), so the stops sit together on a phone speaker.
    th = src('reel_stop_thunk')
    if th is not None:
        for i, st in zip(range(2, 6), PENT5[1:]):
            cid = f'reel_stop_{i}'
            if not want(cid): continue
            y, vinfo = reel_stop_voice(K.pitch(th, st, True), REEL_KNOCK_ROOT + st)
            y = K.norm_rms(y, pre_rms(cid), peak_db=-3.0)
            put(cid, y, {'from': 'reel_stop_1', 'semis': st, 'op': f'tonic ladder: thunk +{st} st + wood knock {HL.name(REEL_KNOCK_ROOT + st)}', 'tonal': vinfo}, fade_ms=2)
        if want('reel_stop_turbo'):
            parts = [m for m in (mast('reel_stop_1'), mast('reel_stop_3'), mast('reel_stop_5')) if m is not None]
            n = max(len(p) for p in parts) + int(0.012 * SR); y = np.zeros((n, 2))
            for k, p in enumerate(parts): y[int(k * 0.006 * SR):int(k * 0.006 * SR) + len(p)] += p / 1.6
            put('reel_stop_turbo', K.norm_rms(y, -20.0), {'from': 'reel_stop_1', 'op': 'stack of stops 1 + 3 + 5 (C5 + E5 + A5 knocks), 6 ms roll (one merged stop for Turbo)'}, fade_ms=2)
    else: report['skipped'].append('reel_stop ladder: no masters/_src/reel_stop_thunk (run sfx --only reel_stop_1 first)')
    # alarm ladder: drawn strike + synthesised ii-V chords (NOT pentatonic by design, never key-fitted). r2: the chord rings
    # out (kit.ring_out) and its top voice leads (A4 D5 F5 A5 B5, hybrid_chord top_w).
    x = src('alarm_land_src')
    if x is not None:
        on = onset_peak(x); a = max(0, on - int(0.004 * SR)); strike = x[a:a + int(0.07 * SR)].copy()
        n = int(0.03 * SR); strike[-n:] *= np.linspace(1, 0, n)[:, None]; strike = hp(strike, 700.0)
        for n_ in range(1, 6):
            cid = f'alarm_land_{n_}'
            if not want(cid): continue
            d = CUES[cid]['derive']; s = K.pitch(strike, d['strikeSemis'], True) if d['strikeSemis'] else strike
            y = hybrid_chord(s, d['chord'], strike_db=-3.0); y, ro = K.ring_out(y)
            y = K.norm_rms(y, -20.0 + 0.5 * (n_ - 1), peak_db=-3.0)
            put(cid, y, {'from': 'alarm_land_src', 'op': 'hybrid: drawn strike (70 ms, HP 700 Hz) + chime chord (top voice +6 dB), rings out', 'chord': [HL.name(m) for m in d['chord']],
                         'topVoice': HL.name(max(d['chord'])), 'strikeSemis': d['strikeSemis'], 'ringOut': ro}, fade_ms=2)
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
            y, on = hybrid_ping(x, note, rel_db=-3.0); y, ro = K.ring_out(y); y = K.norm_rms(y, -20.0, peak_db=-3.0)
            put(cid, y, {'from': 'blaze_ignite', 'op': f'hybrid: drawn fwoomp + tuned ping {HL.name(note)}, rings out', 'note': HL.name(note), 'ringOut': ro}, fade_ms=2)
    # multiplier badges x2 / x3 / x5 (x10 is its own draw)
    x = src('blaze_mult_src')
    if x is not None:
        for m, lvl in ((2, -20.0), (3, -19.5), (5, -19.0)):
            cid = f'blaze_mult_{m}'
            if not want(cid): continue
            note = CUES[cid]['derive']['note']
            y, on = hybrid_ping(x, note, rel_db=0.0); y, ro = K.ring_out(y); y = K.norm_rms(y, lvl, peak_db=-3.0)
            put(cid, y, {'from': 'blaze_mult_src', 'op': f'hybrid: drawn clank/flare + tuned ping {HL.name(note)}, rings out', 'note': HL.name(note), 'ringOut': ro}, fade_ms=2)
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
                # r2: the resampled blip keeps its shape but shrinks (250 -> 56 ms), so the top ticks ended 30-40 dB under their peak;
                # an exponential release over the last 45 % of each tick lands every one at silence (measure.py tails gate)
                y = K.pitch(base, CLAD[i - 1], False); y = K.release(y, 0.45 * len(y) / SR * 1000)
                put(f'count_ticker_{i}', y, {'from': 'count_ticker_1', 'semis': CLAD[i - 1], 'op': 'pentatonic ladder (resampled, release over the last 45 %)'}, fade_ms=2)
    # rescue ta-da ladder C4 D4 E4 G4 A4 C5 D5 E5 (perceived pitch = the FUNDAMENTAL). r2: every source is labelled by its
    # SHS fundamental (lo C4, mid G4, hi C4 -- r1 read lo / hi as C5 / C6 from their loudest partials, and its smallest-
    # shift planner built rungs 4-8 from hi, so the ladder fell a minor sixth at 3 -> 4 and rungs 6-8 repeated 1-3). The
    # planner now takes the smallest UPWARD shift (ties: the source listed first), which gives exactly the registry's
    # derivation: rungs 1-3 from lo (0 / +2 / +4), 4-5 from mid (0 / +2), 6-8 from mid (+5 / +7 / +9); every shift is
    # the rubberband formant-preserving transposition used for Inferno (pitch_bed), not asetrate. hi (a C4 series, same
    # register as lo) is not used. measure.py gates the shipped ladder: SHS fundamental strictly rising.
    srcs = {}
    for k in ('lo', 'mid', 'hi'):
        p = f'{K.SRC_MAST}/rescue_tada_src_{k}.json'; y = src(f'rescue_tada_src_{k}')
        if y is not None and os.path.exists(p):
            info = json.load(open(p))
            if info.get('midi') is not None and info.get('method', '').startswith('subharmonic'): srcs[k] = (y, float(info['midi']))
            else: report['warnings'].append(f'rescue_tada_src_{k}: label is not an SHS fundamental; re-run sfx --only rescue_tada_src_{k}')
    if srcs:
        steps = [0, 2, 4, 7, 9, 12, 14, 16]
        lowest = min(v[1] for v in srcs.values()); root = int(round(lowest / 12.0) * 12)  # the tonic nearest the lowest source
        plan = []
        for i, st in enumerate(steps, 1):
            target = root + st
            up = [(target - srcs[k][1], n) for n, k in enumerate(srcs) if target - srcs[k][1] > -0.5]
            k = list(srcs)[min(up)[1]] if up else min(srcs, key=lambda kk: abs(target - srcs[kk][1]))
            plan.append((i, target, k, target - srcs[k][1]))
        expect = [('lo', 0), ('lo', 2), ('lo', 4), ('mid', 0), ('mid', 2), ('mid', 5), ('mid', 7), ('mid', 9)]
        if [(k, round(s)) for _, _, k, s in plan] != expect: report['warnings'].append(f'ta-da plan {[(k, round(s, 2)) for _, _, k, s in plan]} != registry {expect}')
        for i, target, k, shift in plan:
            cid = f'rescue_tada_{i}'
            if not want(cid): continue
            y = pitch_bed(srcs[k][0], shift) if abs(shift) >= 0.05 else srcs[k][0].copy()
            y = K.norm_rms(y, -20.0 + 0.4 * (i - 1), peak_db=-3.0)
            f0, m0 = K.shs_f0(y, t_from=0.1)
            put(cid, y, {'from': f'rescue_tada_src_{k}', 'semis': round(float(shift), 2), 'targetNote': HL.name(target), 'shs': K.note_name(m0), 'shsMidi': round(m0, 2),
                         'op': 'snap ladder (held note; rubberband, formants preserved)'}, fade_ms=25)
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
    # r2 (2026-09-25): the pickup is used WHOLE, never sliced. r1 cut it to the cue length (h = pick[:len(x) - s]) with no
    # fade, so on spins_added (1.0 s) its last note (G6) was cut mid-ring. The rendered bar is trimmed to its own content
    # (every note now ends in a release, hook_layer.tone), and a cue must hold the whole pickup + PICK_TAIL_S; a cue of
    # >= PICK_EXTEND_MIN_S that is a little short is extended with silence so the pickup rings out; a shorter cue is refused.
    e = K.env_db(pick); pick = pick[:int(np.nonzero(e > -70)[0][-1]) + 1]
    PICK_TAIL_S, PICK_EXTEND_MIN_S = 0.3, 1.2
    for cid in SHOTS:
        if only and cid not in only: continue
        mp = f'{K.MAST}/{cid}.wav'; pp = f'{PREPICK}/{cid}.wav'
        if not os.path.exists(mp): report['skipped'].append(f'shot {cid}: no master'); continue
        if not os.path.exists(pp): shutil.copy(mp, pp)
        x = lk.decode(pp); share = M.cpent_share(x)
        s = int(0.02 * SR); need = s + len(pick) + int(PICK_TAIL_S * SR)
        rec = CUES[cid].setdefault('build', {})
        short = len(x) < need and len(x) < int(PICK_EXTEND_MIN_S * SR)
        if short or share < min_share:
            out[cid] = {'pickup': False, 'cpentShare': round(share, 3),
                        'why': (f'too short for the whole pickup to ring out ({len(x) / SR:.2f} s < {PICK_EXTEND_MIN_S} s; needs {need / SR:.2f} s)' if short
                                else f'C-pentatonic share {share:.2f} < {min_share}')}
            ship(x, cid)  # no pickup: the pre-pickup master IS the master (undoes a pickup from an earlier run)
            set_cue(cid, x, {**{k: v for k, v in rec.items() if k not in ('pass', 'at', 'hook', 'remaster')}, 'hook': out[cid]}); print('no pickup', cid, out[cid]); continue
        ext = max(0, need - len(x)); x = pad_to(x, len(x) + ext)
        h = pick * 10 ** ((HL.rms_db(x[s:s + len(pick)]) - 5.0 - HL.rms_db(pick)) / 20)
        y = x.copy(); y[s:s + len(h)] += h
        y = K.norm_rms(y, HL.rms_db(y), peak_db=-1.5); y, _ = K.limit(y, ceiling_db=-1.5)
        res = ship(y, cid)
        hook = {'pickup': True, 'firstBar': 'G5 C6 E6 G6 glockenspiel, 132 BPM eighths, -5 dB, whole (rings out)', 'cpentShare': round(share, 3),
                'pickup_s': round(len(pick) / SR, 3), 'extended_ms': round(ext / SR * 1000, 1) if ext else None}
        set_cue(cid, y, {**{k: v for k, v in rec.items() if k not in ('pass', 'at', 'hook', 'remaster')}, 'hook': hook})
        out[cid] = {**res, 'cpentShare': round(share, 3)}; print('pickup', cid, out[cid])
    return out


# ------------------------------------------------------------------------------------------ turbo variants
# r2 (2026-09-25): turbo length cap. r1 applied a fixed timeScale (0.5-0.55) with no cap: 33 of 94 variants ran over 0.7 s
# (win_max_turbo 1.55 s, trigger_fanfare_turbo 1.30 s ...), i.e. the turbo cue outlived the turbo cadence. Now: a variant
# longer than TURBO_MAX_S is re-scaled to fit (0.69 / parent length) when that factor is >= TURBO_MIN_SCALE, otherwise the
# time-scaled cue keeps its head up to TURBO_HEAD_S and gets a TURBO_REL_MS exponential release. HELD cues are exempt
# (recorded on the cue as turboCapExempt): the runtime stops them itself (stopHeld on resolve), so their file length is an
# upper bound, not a played length; cutting them would leave the anticipation silent before the reel resolves.
TURBO_MAX_S, TURBO_HEAD_S, TURBO_REL_MS, TURBO_MIN_SCALE = 0.70, 0.58, 120.0, 0.4
TURBO_CAP_EXEMPT = {
    'antic_riser_turbo': 'held riser (playHeld; stopHeld when the anticipating reel resolves): the runtime ends it, so its length never extends the turbo cadence',
    'antic_riser_2_turbo': 'held riser (playHeld; stopHeld when the anticipating reel resolves): the runtime ends it, so its length never extends the turbo cadence',
}


def turbo(only=None):
    out = {}
    for cid, c in CUES.items():
        d = c.get('derive') or {}
        if d.get('op') != 'turbo' or (only and cid not in only): continue
        p = f"{K.MAST}/{d['from']}.wav"
        if not os.path.exists(p): report['skipped'].append(f'{cid}: parent {d["from"]} not built'); continue
        x = lk.decode(p); f = d['timeScale']; y = K.time_scale(x, f); how = f'atempo x{f}'
        cap = None
        if len(y) > TURBO_MAX_S * SR and cid not in TURBO_CAP_EXEMPT:
            f2 = (TURBO_MAX_S - 0.01) * SR / len(x)
            if f2 >= TURBO_MIN_SCALE:
                y = K.time_scale(x, f2); how = f'atempo x{f2:.3f} (re-scaled to fit {TURBO_MAX_S} s)'; cap = {'op': 'rescaled', 'timeScale': round(f2, 3)}
            else:
                y = K.release(y[:int((TURBO_HEAD_S + TURBO_REL_MS / 1000) * SR)], TURBO_REL_MS, floor_db=-80.0)
                how = f'atempo x{f}, head {TURBO_HEAD_S} s + {TURBO_REL_MS:.0f} ms release'; cap = {'op': 'head+release', 'head_s': TURBO_HEAD_S, 'release_ms': TURBO_REL_MS}
            if len(y) > TURBO_MAX_S * SR: y = K.release(y[:int(TURBO_MAX_S * SR)], 60.0, floor_db=-80.0)
        if cap is None or cap['op'] == 'rescaled':
            n = min(len(y), int(0.02 * SR)); y[-n:] *= np.linspace(1, 0, n)[:, None]
        if cid in TURBO_CAP_EXEMPT: cap = {'op': 'exempt', 'why': TURBO_CAP_EXEMPT[cid]}; c['turboCapExempt'] = TURBO_CAP_EXEMPT[cid]
        res = ship(y, cid); set_cue(cid, y, {'from': d['from'], 'timeScale': d['timeScale'], 'op': f'turbo variant ({how}, pitch kept)', 'turboCap': cap}); out[cid] = res
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
    rp = f'{QA}/build_report_{mode}.json'
    if only and os.path.exists(rp):  # r3: a --only rebuild MERGES into the last full report (it used to replace it with the subset)
        prev = json.load(open(rp))
        for k, v in report.items():
            if isinstance(v, dict) and isinstance(prev.get(k), dict): prev[k].update(v)
            elif isinstance(v, list): prev[k] = [e for e in prev.get(k, []) if not any(str(e).startswith(f'{o}:') or f' {o}:' in str(e) for o in only)] + v
            else: prev[k] = v
        prev.setdefault('onlyRuns', []).append({'at': time.strftime('%Y-%m-%dT%H:%M:%S'), 'only': sorted(only)}); report = prev
    K.write_json(rp, report)
    print('skipped:', report['skipped']); print('warnings:', report['warnings'])
