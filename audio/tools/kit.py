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


def ship(x, name, tp_target=-1.2):
    """24-bit master -> AAC 160k + Opus 160k; re-scale by a CONSTANT gain until BOTH decoded codecs are <= -1.0 dBTP
    (constant gain keeps loop seams sample-continuous), then copy both into the static folder."""
    os.makedirs(RUN, exist_ok=True); os.makedirs(MAST, exist_ok=True); os.makedirs(STATIC, exist_ok=True)
    for _ in range(6):
        enc_wav(x, f'{MAST}/{name}.wav'); enc_runtime(f'{MAST}/{name}.wav', f'{RUN}/{name}')
        tps = [v for v in (measure(f'{RUN}/{name}.m4a')[1], measure(f'{RUN}/{name}.ogg')[1]) if v is not None]
        if not tps or max(tps) <= -1.0: break
        x = x * 10 ** ((tp_target - max(tps)) / 20)
    for ext in ('m4a', 'ogg'): shutil.copy(f'{RUN}/{name}.{ext}', f'{STATIC}/{name}.{ext}')
    I, TP = measure(f'{RUN}/{name}.ogg')
    I4, TP4 = measure(f'{RUN}/{name}.m4a')
    return dict(I_LUFS=I, TP_dBFS=TP, TP_m4a_dBFS=TP4, samples=len(x))


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
def trim(x, pre_ms=4, thr_db=-42, tail_db=-48, max_s=None, fade_ms=25):
    m = np.abs(x).max(axis=1); pk = m.max() + 1e-9
    a = int(np.argmax(m > pk * 10 ** (thr_db / 20))); a = max(0, a - int(pre_ms * SR / 1000))
    idx = np.nonzero(m > pk * 10 ** (tail_db / 20))[0]; b = int(idx[-1]) + int(0.03 * SR)
    if max_s: b = min(b, a + int(max_s * SR))
    y = x[a:b].copy(); n = min(len(y), int(fade_ms * SR / 1000))
    y[-n:] *= np.cos(np.linspace(0, np.pi / 2, n))[:, None] ** 2
    y[: int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))[:, None]
    return y


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
