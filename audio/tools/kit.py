"""PIGGY FIREFIGHTERS audio kit (2026-09-25): the family's recommission kit (LUCKY audio/tools/recommission_kit.py)
with the tempo as a parameter, adapted for this repo:

  * ROOT is relative to this file (or PF_AUDIO_ROOT for a scratch smoke test); no absolute owner-Mac paths.
  * STATIC is apps/piggy_firefighters/static/assets/audio/piggy_firefighters (one folder, one file per cue per codec).
  * load() parses the RIFF chunks (any fmt/data order, 16-bit PCM, 1 or 2 channels); a genuine mono draw is
    duplicated to stereo. gen_audio.mjs always writes true-channel 2-ch headers, so the donor's "mono header over
    stereo data" special case is gone.
  * assert_static_clean(): the donor's untracked LUCKY files in static/assets/audio/ must be gone before anything is
    written there (CLAUDE.md: no donor asset may ship). build_audio.py calls it before its first ship().

Everything else (measure / enc_wav / enc_runtime / ship with the both-codec true-peak loop / time_scale / fine_tempo /
tempo_autocorr / limit / first_onset / trim / norm_rms / pitch / loop_cut / stage_for) is the donor's code, so the
masters and runtime files are produced exactly the way the family's accepted audio was.
"""
import os, shutil, subprocess, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import loopkit as lk
from beat_tools import onset_env

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.environ.get('PF_AUDIO_ROOT') or os.path.join(TOOLS, '..', '..'))
GAME = 'piggy_firefighters'
PCM = f'{ROOT}/audio/cues_pcm'; MAST = f'{ROOT}/audio/masters'; RUN = f'{ROOT}/audio/runtime'
SRC_MAST = f'{ROOT}/audio/masters/_src'          # mastered ladder SOURCES (never shipped as cues)
STATIC_AUDIO = f'{ROOT}/apps/{GAME}/static/assets/audio'
STATIC = f'{STATIC_AUDIO}/{GAME}'
QA = f'{ROOT}/audio/qa'
SR = 44100
FFMPEG = os.environ.get('FFMPEG') or shutil.which('ffmpeg') or '/usr/local/bin/ffmpeg'
DONOR_DIRS = ('lucky', 'piggy', 'piggy_police', 'police')  # donor runtime folders that must not ship


def write_text(path, text):
    """Atomic text write (r3): write a sibling temp file, then os.replace, so a crash never leaves a truncated QA / registry file."""
    d = os.path.dirname(path) or '.'; os.makedirs(d, exist_ok=True); tmp = f'{path}.tmp{os.getpid()}'
    with open(tmp, 'w', newline='') as f: f.write(text)
    os.replace(tmp, path)


def write_json(path, obj, indent=1, **kw):
    import json
    write_text(path, json.dumps(obj, indent=indent, **kw))


def stage_for(bpm, bars=8):
    """`bars` whole bars at `bpm`, in samples (sample-exact loop length)."""
    return int(round(bars * 4 * 60.0 / bpm * SR))


def run(*a, **k):
    a = (FFMPEG,) + a[1:] if a and a[0] == 'ffmpeg' else a
    return subprocess.run(a, capture_output=True, **k)


def assert_static_clean(purge=False):
    """Refuse to write into static/assets/audio while donor files sit there. With purge=True, delete ONLY donor
    folders that git does not track (the untracked LUCKY copy); a tracked donor file is never deleted here."""
    bad = [d for d in DONOR_DIRS if os.path.isdir(f'{STATIC_AUDIO}/{d}')]
    if not bad: return []
    if not purge:
        raise SystemExit(f'static/assets/audio still holds donor folders {bad}; re-run with --purge-donor '
                         '(deletes only untracked files there) or remove them by hand before any ship().')
    removed = []
    for d in bad:
        p = f'{STATIC_AUDIO}/{d}'
        tracked = subprocess.run(['git', '-C', ROOT, 'ls-files', '--', os.path.relpath(p, ROOT)], capture_output=True, text=True).stdout.strip()
        if tracked:
            raise SystemExit(f'{p} has git-tracked files; not deleting them here (report to the coordinator).')
        shutil.rmtree(p); removed.append(os.path.relpath(p, ROOT))
    return removed


def load(path):
    """16-bit PCM WAV -> float64 (n, 2). Walks the RIFF chunks instead of assuming a 44-byte header."""
    b = open(path, 'rb').read()
    if b[:4] != b'RIFF' or b[8:12] != b'WAVE': raise ValueError(f'{path}: not a RIFF/WAVE file')
    i, ch, bits, data = 12, None, None, None
    while i + 8 <= len(b):
        cid, n = b[i:i + 4], int.from_bytes(b[i + 4:i + 8], 'little')
        if cid == b'fmt ':
            ch = int.from_bytes(b[i + 10:i + 12], 'little'); bits = int.from_bytes(b[i + 22:i + 24], 'little')
        elif cid == b'data':
            data = b[i + 8:i + 8 + n]
        i += 8 + n + (n & 1)
    if data is None or ch is None: raise ValueError(f'{path}: no fmt/data chunk')
    if bits != 16: raise ValueError(f'{path}: {bits}-bit PCM, expected 16')
    x = np.frombuffer(data[: len(data) // (2 * ch) * 2 * ch], dtype='<i2').astype(np.float64) / 32768.0
    x = x.reshape(-1, ch)
    if ch == 1: x = np.repeat(x, 2, axis=1)
    return x[:, :2]


def measure(path):
    o = run('ffmpeg', '-nostdin', '-i', path, '-af', 'apad=pad_dur=0.4,ebur128=peak=true', '-f', 'null', '-').stderr.decode()
    I = TP = None; tp = False
    for ln in o.splitlines():
        s = ln.strip()
        if s.startswith('I:') and 'LUFS' in s: I = float(s.split()[1])
        if s.startswith('True peak'): tp = True
        if s.startswith('Peak:') and 'dBFS' in s and tp: TP = float(s.split()[1]); tp = False
    return I, TP


def enc_wav(x, path):
    pcm = (np.clip(x, -1, 1) * 8388607).astype('<i4'); pcm = (pcm << 8).tobytes()
    run('ffmpeg', '-v', 'error', '-nostdin', '-y', '-f', 's32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'pcm_s24le', path, input=pcm, check=True)


def enc_runtime(wav, base):
    run('ffmpeg', '-v', 'error', '-nostdin', '-y', '-i', wav, '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', f'{base}.m4a', check=True)
    run('ffmpeg', '-v', 'error', '-nostdin', '-y', '-i', wav, '-c:a', 'libopus', '-b:a', '160k', f'{base}.ogg', check=True)


TP_SHIP_MAX = -1.1   # ship() loops until BOTH decoded codecs measure <= this at 8x oversampling (the gate is -1.0 dBTP)


def ship(x, name, tp_target=-1.3):
    """24-bit master -> AAC 160k + Opus 160k; re-scale by a CONSTANT gain until BOTH decoded codecs are <= -1.1 dBTP at 8x
    oversampling (constant gain keeps loop seams sample-continuous), then copy both into the static folder.
    r2 (2026-09-25): the loop used ebur128's true peak, which prints one decimal (4x oversampling): spins_added.ogg,
    rung_hit_big.m4a and rescue_total_big.ogg shipped at -0.96 / -0.97 / -0.98 dBTP (8x) while ebur128 printed -1.0.
    Now the loop reads true_peak() (8x, native codec rate, unrounded) and lands at tp_target -1.3 with a -1.1 ceiling."""
    os.makedirs(RUN, exist_ok=True); os.makedirs(MAST, exist_ok=True); os.makedirs(STATIC, exist_ok=True)
    for _ in range(8):
        enc_wav(x, f'{MAST}/{name}.wav'); enc_runtime(f'{MAST}/{name}.wav', f'{RUN}/{name}')
        tps = [true_peak(f'{RUN}/{name}.m4a'), true_peak(f'{RUN}/{name}.ogg')]
        if max(tps) <= TP_SHIP_MAX: break
        x = x * 10 ** ((tp_target - max(tps)) / 20)
    for ext in ('m4a', 'ogg'):  # r3: atomic into static (a partial copy must never be what ships)
        tmp = f'{STATIC}/.{name}.{ext}.tmp'; shutil.copy(f'{RUN}/{name}.{ext}', tmp); os.replace(tmp, f'{STATIC}/{name}.{ext}')
    I, _ = measure(f'{RUN}/{name}.ogg')
    I4, _ = measure(f'{RUN}/{name}.m4a')
    return dict(I_LUFS=I, TP_dBFS=round(tps[1], 2), TP_m4a_dBFS=round(tps[0], 2), I_m4a_LUFS=I4, tpMethod='8x oversampled, native codec rate', samples=len(x))


def save_src(x, name):
    """Master a ladder SOURCE (not a runtime cue): 24-bit WAV under audio/masters/_src, never shipped."""
    os.makedirs(SRC_MAST, exist_ok=True); enc_wav(x, f'{SRC_MAST}/{name}.wav'); return f'{SRC_MAST}/{name}.wav'


def atempo_chain(f):
    st = []
    while f > 2.0: st.append(2.0); f /= 2.0
    while f < 0.5: st.append(0.5); f /= 0.5
    st.append(f); return ','.join(f'atempo={s:.8f}' for s in st)


def time_scale(x, factor):
    """factor > 1 = longer (pitch preserved, ffmpeg atempo chain)."""
    tin, tout = f'{RUN}/_ts_in.wav', f'{RUN}/_ts_out.wav'; os.makedirs(RUN, exist_ok=True)
    enc_wav(x, tin)
    run('ffmpeg', '-v', 'error', '-nostdin', '-y', '-i', tin, '-af', atempo_chain(1.0 / factor), '-ac', '2', '-c:a', 'pcm_s24le', tout, check=True)
    return lk.decode(tout)


# ---------------------------------------------------------------- tempo / downbeat
def fine_tempo(x, lo, hi):
    o, fr = onset_env(x, SR); o = o - o.mean(); best = (-1e18, 0)
    for bpm in np.arange(lo, hi, 0.004):
        lag = 60.0 / bpm * fr; s = 0.0
        for k in (8, 16, 32, 64):
            L = lag * k; i = int(L); f = L - i
            if i + 1 >= len(o) - 10: continue
            a = o[:len(o) - i - 1]
            s += np.dot(a, (1 - f) * o[i:i + len(a)] + f * o[i + 1:i + 1 + len(a)]) / len(a)
        if s > best[0]: best = (s, bpm)
    return best[1]


def tempo_autocorr(x, lo=60, hi=140):
    """Coarse tempo estimate by onset autocorrelation (verification, independent of fine_tempo's window)."""
    o, fr = onset_env(x, SR); o = o - o.mean(); best = (-1e18, 0)
    for bpm in np.arange(lo, hi, 0.05):
        lag = 60.0 / bpm * fr; s = 0.0
        for k in (1, 2, 4, 8):
            L = lag * k; i = int(L); f = L - i
            if i + 1 >= len(o) - 10: continue
            a = o[:len(o) - i - 1]
            s += np.dot(a, (1 - f) * o[i:i + len(a)] + f * o[i + 1:i + 1 + len(a)]) / len(a)
        if s > best[0]: best = (s, bpm)
    return best[1]


def limit(x, ceiling_db=-2.0, look_ms=5.0, release_ms=90.0):
    thr = 10 ** (ceiling_db / 20); pk = np.abs(x).max(axis=1)
    n = int(look_ms * SR / 1000)
    from numpy.lib.stride_tricks import sliding_window_view
    env = sliding_window_view(np.pad(pk, (0, n)), n + 1).max(axis=1)
    g = np.minimum(1.0, thr / np.maximum(env, 1e-9))
    a = np.exp(-1.0 / (release_ms * SR / 1000)); out = np.empty_like(g); cur = 1.0
    for i in range(len(g)):
        cur = min(1.0, cur + (1.0 - cur) * (1 - a))
        if g[i] < cur: cur = g[i]
        out[i] = cur
    return x * out[:, None], float((out < 0.999).mean())


def limit_cyclic(x, ceiling_db=-2.0, context_s=0.5):
    """limit() with CYCLIC context (limit_loop.py's idea in numpy): the loop's tail is prepended and its head appended
    before limiting and the middle is kept, so the gain at the first sample continues the gain at the last one."""
    c = min(len(x) // 2, int(context_s * SR))
    y, frac = limit(np.concatenate([x[-c:], x, x[:c]]), ceiling_db=ceiling_db)
    return y[c:c + len(x)], frac


# Codec guard for music loops (found by the 2026-09-25 smoke test): AAC reconstructs the first ~1024 samples of a file badly
# (the encoder cannot see before the start: max error 0.15-0.28 against a body p99 of 0.006-0.009), so a bed that loops the
# WHOLE decoded m4a buffer glitches at the seam (Safari plays m4a). Beds therefore ship with a cyclic pre-roll (the loop's own
# last PAD samples) and post-roll (its first PAD samples); the runtime loops [loopStartMs, loopEndMs] (audioManager.spawnBed
# honours both), so the codec's edge error is never played and both seam neighbours were encoded with their true context.
PAD_MS = 60.0
PAD = int(round(PAD_MS * SR / 1000))  # 2646 samples > one AAC frame (1024) + encoder priming (1024)


def pad_loop(x, pre=PAD, post=PAD):
    return np.concatenate([x[-pre:], x, x[:post]])


def first_onset(x, thr=0.02):
    m = np.abs(x).max(axis=1); return max(0.0, float(np.argmax(m > thr)) / SR - 0.003)


# ---------------------------------------------------------------- one-shots
def trim(x, pre_ms=4, thr_db=-42, tail_db=-48, max_s=None, fade_ms=25, release_ms=200.0, loud_db=-40.0, info=None):
    """Head at -42 dB re peak (- pre_ms), tail at the last sample above -48 dB (+ 30 ms), capped at max_s.
    r2 (2026-09-25): when the cap lands inside the ring (the 50 ms before the fade is louder than `loud_db` re peak:
    line_win_small was still at -22 dB at its 0.8 s draw boundary, burst_badges at -25 dB) the 25 ms cos^2 cut the ring
    audibly; such a tail now gets an exponential release of `release_ms` (>= 150 ms, down to -60 dB) instead."""
    m = np.abs(x).max(axis=1); pk = m.max() + 1e-9
    a = int(np.argmax(m > pk * 10 ** (thr_db / 20))); a = max(0, a - int(pre_ms * SR / 1000))
    idx = np.nonzero(m > pk * 10 ** (tail_db / 20))[0]; b = int(idx[-1]) + int(0.03 * SR)
    if max_s: b = min(b, a + int(max_s * SR))
    y = x[a:b].copy(); n = min(len(y), int(fade_ms * SR / 1000))
    w = int(0.05 * SR); e = env_db(y) + 20 * np.log10((np.abs(y).max() + 1e-12) / pk)  # re the draw's peak
    pre_db = float(e[max(0, len(y) - n - w):].max()) if len(y) > n else -120.0  # the loudest 10 ms in the fade + the 50 ms before it
    if pre_db > loud_db and len(y) > int(release_ms * SR / 1000) * 2:
        y = release(y, release_ms)
        if info is not None: info.update(tailRelease_ms=release_ms, preFade_dB=round(float(pre_db), 1))
    else:
        y[-n:] *= np.cos(np.linspace(0, np.pi / 2, n))[:, None] ** 2
    y[: int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))[:, None]
    return y


# ---------------------------------------------------------------- r2 (2026-09-25): tails, mono / phone metrics, true peak
def release(y, ms=200.0, floor_db=-60.0):
    """Exponential (linear-in-dB) release over the last `ms`: 0 dB -> floor_db, then the final 2 ms to zero."""
    y = y.copy(); R = min(len(y), int(ms * SR / 1000))
    y[-R:] *= (10 ** (floor_db / 20 * np.arange(R) / R))[:, None]
    z = min(R, int(0.002 * SR)); y[-z:] *= np.cos(np.linspace(0, np.pi / 2, z))[:, None] ** 2
    return y


def env_db(y, win_ms=10.0):
    """10 ms RMS envelope (max over channels), dB re the sample peak."""
    n = max(1, int(win_ms * SR / 1000)); p = (y ** 2).max(axis=1) if y.ndim > 1 else y ** 2
    e = np.sqrt(np.convolve(p, np.ones(n) / n, 'same')); pk = np.abs(y).max() + 1e-12
    return 20 * np.log10(e / pk + 1e-12)


def ring_out(y, floor_db=-50.0, cap_s=1.6, fade_ms=60.0, knee_s=0.3):
    """Let a cue ring out: cut where the whole sum has fallen below `floor_db` re peak (+ a cos^2 fade of fade_ms), never
    later than cap_s. When the ring is still above the floor at cap - fade, an extra exponential decay (linear in dB) is
    applied from `knee_s` on so it reaches the floor exactly there. Returns (y, info)."""
    F = int(fade_ms * SR / 1000); cap = int(cap_s * SR); e = env_db(y)
    above = np.nonzero(e > floor_db)[0]; end = (int(above[-1]) + 1) if len(above) else len(y)
    info = {'floor_dB': floor_db, 'fade_ms': fade_ms}
    if end + F <= cap:
        y = np.concatenate([y, np.zeros((max(0, end + F - len(y)), 2))])[:end + F].copy(); info['natural'] = True
    else:
        y = np.concatenate([y, np.zeros((max(0, cap - len(y)), 2))])[:cap].copy()
        k = int(knee_s * SR); c = cap - F; lvl = float(e[min(c, len(e) - 1)]) if c < len(e) else floor_db
        need = min(0.0, floor_db - lvl - 3.0)
        if need < 0 and c > k:
            g = np.ones(len(y)); t = np.arange(len(y)); r = np.clip((t - k) / (c - k), 0, None)
            g = 10 ** (need * r / 20); y *= g[:, None]
        info.update(natural=False, extraDecay_dB=round(need, 1), knee_s=knee_s)
    y[-F:] *= np.cos(np.linspace(0, np.pi / 2, F))[:, None] ** 2
    info['len_s'] = round(len(y) / SR, 3)
    return y, info


def tail_metrics(y):
    """endLevel_dB: RMS of the 10 ms that ends 10 ms before the last sample, re the sample peak (a cut ring reads high);
    lastSample: |last sample| (max over channels)."""
    pk = np.abs(y).max() + 1e-12; a, b = max(0, len(y) - int(0.02 * SR)), max(1, len(y) - int(0.01 * SR))
    seg = y[a:b]
    return {'endLevel_dB': round(float(20 * np.log10(np.sqrt((seg ** 2).mean()) / pk + 1e-12)), 1),
            'lastSample': round(float(np.abs(y[-1]).max()), 5)}


def _sos_hp400():
    from scipy.signal import butter
    return butter(4, 400.0, 'highpass', fs=SR, output='sos')


def loud400_p(p):
    """loudest 400 ms mean of a per-sample power series, dB."""
    n = int(0.4 * SR)
    if len(p) <= n: return float(10 * np.log10(p.mean() + 1e-12))
    c = np.cumsum(np.insert(p, 0, 0.0)); w = (c[n:] - c[:-n]) / n
    return float(10 * np.log10(w.max() + 1e-12))


def levels(x):
    """The three listening conditions every reward chain must rise on (r2, 2026-09-25):
         st    loudest 400 ms of the per-channel stereo power (headphones; the family's level)
         mono  loudest 400 ms of the (L+R)/2 sum (a phone speaker, a mono Bluetooth box)
         phone the same sum through a 4th-order 400 Hz high-pass (a phone speaker's band)
       plus corr (energy-weighted inter-channel correlation) and monoLoss = st - mono (dB)."""
    from scipy.signal import sosfilt
    L, R = x[:, 0], x[:, 1]; m = (L + R) / 2
    st = loud400_p((x ** 2).mean(axis=1)); mo = loud400_p(m ** 2); ph = loud400_p(sosfilt(_sos_hp400(), m) ** 2)
    c = float((L * R).sum() / (np.sqrt((L * L).sum() * (R * R).sum()) + 1e-12))
    return {'st': round(st, 2), 'mono': round(mo, 2), 'phone': round(ph, 2), 'corr': round(c, 3), 'monoLoss': round(st - mo, 2)}


def corr(x):
    L, R = x[:, 0], x[:, 1]; return float((L * R).sum() / (np.sqrt((L * L).sum() * (R * R).sum()) + 1e-12))


def narrow(x, min_corr=0.2, side=0.5, mono_below=-0.5):
    """Mono-compatibility for a DRAWN cue (r2): some ElevenLabs draws are partly anti-phase (alarm_outcome_false corr -0.74 =
    8.6 dB lost in a mono sum; line_win_mid -0.31, sym_win_l1 -0.33, sym_win_h4 -0.23). corr < min_corr -> M/S narrowing
    (side x `side`, the mono sum is unchanged); corr < mono_below -> the stronger channel as mono (a -0.74 draw keeps a
    negative correlation even at side x 0.5). Returns (y, info or None)."""
    c = corr(x)
    if c >= min_corr: return x, None
    if c < mono_below:
        k = int(np.argmax((x ** 2).sum(axis=0))); y = np.repeat(x[:, k:k + 1], 2, axis=1)
        return y, {'corrDrawn': round(c, 3), 'op': f'anti-phase draw: channel {"LR"[k]} as mono', 'corr': 1.0}
    M = (x[:, 0] + x[:, 1]) / 2; S = (x[:, 0] - x[:, 1]) / 2 * side
    y = np.stack([M + S, M - S], axis=1)
    return y, {'corrDrawn': round(c, 3), 'op': f'M/S narrowing, side x {side}', 'corr': round(corr(y), 3)}


def true_peak(path, over=8):
    """True peak (dBTP) of an encoded file: decoded at its NATIVE rate (Opus 48 kHz, AAC 44.1 kHz), 8x oversampled
    (scipy resample_poly, chunked with overlap), unrounded. ebur128 (4x, printed to one decimal) let -0.96 ship as -1.0."""
    from scipy.signal import resample_poly
    raw = run('ffmpeg', '-v', 'error', '-nostdin', '-i', path, '-f', 'f32le', '-acodec', 'pcm_f32le', '-ac', '2', '-', check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)
    pk = float(np.abs(x).max()) if len(x) else 0.0; B, P = 1 << 17, 64
    for ch in (0, 1):
        v = x[:, ch]
        for i in range(0, len(v), B):
            a0 = max(0, i - P); seg = v[a0:i + B + P]; up = resample_poly(seg, over, 1)
            s = (i - a0) * over; e = s + min(B, len(v) - i) * over
            pk = max(pk, float(np.abs(up[s:e]).max()))
    return 20 * np.log10(pk + 1e-12)


NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']


def note_name(m): m = int(round(m)); return NOTE_NAMES[m % 12] + str(m // 12 - 1)


def shs_f0(x, t_from=0.1, win_s=0.4, lo=55.0, hi=1100.0, H=10, w=0.84, fmax=5000.0):
    """Perceived pitch by SUBHARMONIC SUMMATION (Hermes 1988): for each candidate f0 (0.1 st grid, lo..hi) sum the
    spectrum (dB above a -60 dB floor, peak within +-1.5 %) at its harmonics h*f0 weighted w^(h-1); the best sum is the
    fundamental even when the loudest partial is the 2nd or 4th harmonic (the r1 ta-da bug: the lo / hi sources were
    labelled by their loudest partial, C5 / C6, while both are C4 harmonic series). Window: `win_s` around the energy
    maximum after `t_from`. Returns (f0 Hz, midi float)."""
    m = x.mean(axis=1) if x.ndim > 1 else x; a = int(t_from * SR); seg = m[a:] if len(m) - a > 2048 else m
    e = np.convolve(seg ** 2, np.ones(1024) / 1024, 'same'); c = int(np.argmax(e)); h = int(win_s * SR / 2)
    seg = seg[max(0, c - h):c + h]
    N = 1 << 16; X = np.abs(np.fft.rfft(seg * np.hanning(len(seg)), N)); df = SR / N
    S = np.clip(20 * np.log10(X / (X.max() + 1e-12) + 1e-12) + 60.0, 0, None)
    cands = 440.0 * 2 ** (np.arange(np.floor(120 * np.log2(lo / 440)), np.ceil(120 * np.log2(hi / 440)) + 1) / 120.0)
    best = (-1.0, cands[0])
    for f0 in cands:
        s = 0.0
        for k in range(1, H + 1):
            f = k * f0
            if f > fmax: break
            s += w ** (k - 1) * S[int(f * 0.985 / df):int(f * 1.015 / df) + 1].max()
        if s > best[0]: best = (s, f0)
    f0 = best[1]
    # refine on the strongest member of the series (exact tuning): its frequency / its harmonic number
    kk = [k for k in range(1, H + 1) if k * f0 < fmax]
    amp = [S[int(k * f0 * 0.985 / df):int(k * f0 * 1.015 / df) + 1].max() for k in kk]; k = kk[int(np.argmax(amp))]
    i0, i1 = int(k * f0 * 0.985 / df), int(k * f0 * 1.015 / df) + 1; i = i0 + int(np.argmax(X[i0:i1]))
    if 0 < i < len(X) - 1:
        al, be, ga = np.log(X[i - 1] + 1e-12), np.log(X[i] + 1e-12), np.log(X[i + 1] + 1e-12); d = 0.5 * (al - ga) / (al - 2 * be + ga + 1e-12)
    else: d = 0.0
    f0 = (i + d) * df / k
    return float(f0), float(69 + 12 * np.log2(f0 / 440.0))


def norm_rms(y, rms_db, peak_db=-3.0):
    r = 20 * np.log10(np.sqrt((y ** 2).mean()) + 1e-9); y = y * 10 ** ((rms_db - r) / 20)
    p = 20 * np.log10(np.abs(y).max() + 1e-9)
    return y * 10 ** ((peak_db - p) / 20) if p > peak_db else y


def pitch(y, semis, preserve_len=True):
    r = 2 ** (semis / 12.0); tin, tout = f'{RUN}/_p_in.wav', f'{RUN}/_p_out.wav'; os.makedirs(RUN, exist_ok=True); enc_wav(y, tin)
    af = f'asetrate={SR * r:.3f},aresample={SR}' + (',' + atempo_chain(1.0 / r) if preserve_len else '')
    run('ffmpeg', '-v', 'error', '-nostdin', '-y', '-i', tin, '-af', af, '-ac', '2', '-c:a', 'pcm_s24le', tout, check=True)
    return lk.decode(tout)


def loop_cut(x, length_s, xfade_ms, start_s=0.25):
    """A seamless loop of ~length_s from a steady draw; if the draw is shorter than start + length + crossfade,
    the loop is shortened to what the draw holds (never the crossfade)."""
    L = int(length_s * SR); X = int(xfade_ms * SR / 1000); s = int(start_s * SR)
    if s + L + X > len(x): s = max(0, len(x) - L - X - 1)
    if s + L + X > len(x): L = len(x) - X - s - 1
    return lk.cut(x, s, L, X, 'head')


def harmonic_only(y, f0, floor_db=-18.0, tol_c=35.0, N=4096, hop=512):
    """Keep the harmonic series of f0 (STFT mask: each bin within max(tol_c cents, 2.5 bins) of k*f0 passes, a raised-cosine
    ramp to floor_db beyond; below 0.8*f0 floor_db). r2 (2026-09-25), for the ta-da ladder sources: the drawn horn 'ta-da'
    (rescue_tada_src_mid) is a CHORD stab (G4 with F4 / F5 / C6 / F6 at -3..-10 dB, i.e. G7sus4), so transposed rungs carried
    the chord's out-of-key tones (rung 6 = mid +5 put F -> Bb over the C-pentatonic bed: C-pent share 0.53) and their virtual
    pitch followed the chord (SHS read A4 / D5 / E5 rungs as G4 / C5 / D5). A rung is ONE note: the source keeps its own
    harmonic series (the horn's timbre), the chord tones drop by |floor_db|."""
    from scipy.signal import stft, istft
    fr = np.fft.rfftfreq(N, 1 / SR); k = np.maximum(1, np.round(fr / f0)); d_hz = np.abs(fr - k * f0)
    tol = np.maximum(f0 * (2 ** (tol_c / 1200) - 1), 2.5 * SR / N)
    g = 10 ** (floor_db / 20); r = np.clip((d_hz - tol) / tol, 0, 1)
    mask = 1 - (1 - g) * (1 - np.cos(np.pi * r)) / 2; mask[fr < 0.8 * f0] = g
    out = np.zeros_like(y)
    for ch in range(y.shape[1]):
        _, _, Z = stft(y[:, ch], fs=SR, window='hann', nperseg=N, noverlap=N - hop, boundary='even', padded=True)
        _, z = istft(Z * mask[:, None], fs=SR, window='hann', nperseg=N, noverlap=N - hop, boundary=True)
        out[:, ch] = z[:len(y)] if len(z) >= len(y) else np.pad(z, (0, len(y) - len(z)))
    return out
