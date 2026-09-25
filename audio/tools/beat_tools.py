# PIGGY FIREFIGHTERS audio lane: copied from the family tool set (LUCKY audio/tools/beat_tools.py), code unchanged below.
"""Tempo / downbeat tools with numpy + scipy only (no librosa on this machine)."""
import numpy as np
from scipy.signal import butter, sosfilt

def onset_env(x, sr, hop=441):
    m = x.mean(axis=1) if x.ndim > 1 else x
    env = []
    bands = [(40, 180), (180, 1200), (1200, 6000)]
    for lo, hi in bands:
        y = sosfilt(butter(2, [lo, hi], 'band', fs=sr, output='sos'), m)
        e = np.sqrt(np.convolve(y * y, np.ones(hop) / hop, 'same'))[::hop]
        d = np.diff(np.log1p(200 * e), prepend=0.0)
        env.append(np.maximum(d, 0))
    o = np.sum(env, axis=0)
    return o / (o.max() + 1e-9), sr / hop

def tempo(x, sr, lo=104.0, hi=126.0):
    o, fr = onset_env(x, sr)
    o = o - o.mean()
    best = (0, 0)
    for bpm in np.arange(lo, hi, 0.02):
        lag = 60.0 / bpm * fr
        # comb over 1, 2, 4 beats with fractional-lag interpolation
        s = 0.0
        for k in (1, 2, 4, 8):
            L = lag * k; i = int(np.floor(L)); f = L - i
            if i + 1 >= len(o): continue
            a = o[:len(o) - i - 1]
            s += np.dot(a, (1 - f) * o[i:i + len(a)] + f * o[i + 1:i + 1 + len(a)]) / k ** 0.5
        if s > best[0]: best = (s, bpm)
    return best[1]

def beat_phase(x, sr, bpm):
    """offset (s) of the beat grid that best explains the onsets, and per-quarter drift (ms) of that phase."""
    o, fr = onset_env(x, sr)
    period = 60.0 / bpm * fr
    def phase_of(seg, start):
        best = (-1, 0.0)
        for ph in np.arange(0, period, 0.25):
            idx = (np.arange(ph, len(seg), period)).astype(int)
            s = seg[idx[idx < len(seg)]].sum()
            if s > best[0]: best = (s, ph)
        return ((best[1] + start) % period) / fr
    whole = phase_of(o, 0)
    q = len(o) // 4
    parts = [phase_of(o[i * q:(i + 1) * q], (i * q) % period if False else 0) for i in range(4)]
    # phases of the quarters measured on their own local index need the quarter start folded in
    fold = []
    for i in range(4):
        start = i * q
        ph_local = parts[i] * fr
        fold.append((((ph_local + start) % period) / fr))
    per = 60.0 / bpm
    drift = [round((((f - whole + per / 2) % per) - per / 2) * 1000, 1) for f in fold]
    return whole, drift
