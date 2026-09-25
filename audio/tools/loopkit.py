# PIGGY FIREFIGHTERS audio lane: copied from the family tool set (LUCKY audio/tools/loopkit.py), code unchanged below.
# DSP only (seam cut / wrap step / head-tail / click metric); no donor sound is used or referenced.
#!/usr/bin/env python3
"""HOG STAMPEDE loop toolkit (audio:mix 2026-09-08) — the DSP the two seam fixes and the
free-games bed variant are rendered with. numpy + ffmpeg only, no API calls.

A loop is measured the way the review panel measured it and the way verify-report.json
records it: RMS of the first vs the last W ms of the packed span (W = 5..2000 ms), the
wrap step |last -> first| against the body's adjacent-sample p99.9, and the HF click
percentile of qa/assets/audio_verify/click_metric.py (energy > 3 kHz in the 5 ms straddling
the self-concatenated seam, as a percentile of the same window everywhere in the body).

Building a loop from a raw draw: `cut(raw, s, L)` takes raw[s : s+L]; the joint is made
seamless with an equal-power crossfade that uses the raw's OWN continuation — `head` blend
mixes raw[s+L : s+L+X] (what really follows the last sample) into the first X samples,
`tail` blend mixes raw[s-X : s] (what really precedes the first sample) into the last X
samples — so the wrap is sample-continuous by construction and the crossfade only has to
hide the difference between two takes of the same beat. `rotate(loop, r)` then moves the
FILE boundary anywhere inside the seamless loop without cutting audio (wheel_loop.py
precedent): the boundary is chosen where head and tail agree at every window.
"""
import json, subprocess, sys, hashlib
import numpy as np
from scipy import signal as sg

SR = 44100
WINDOWS_MS = (5, 20, 50, 100, 250, 500, 1000, 2000)


def decode(path, sr=SR):
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-nostdin', '-i', path, '-f', 'f32le', '-acodec', 'pcm_f32le', '-ar', str(sr), '-ac', '2', '-'],
        capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)


def encode_mp3(x, path, kbps=320):
    """Stereo float -> libmp3lame CBR. 24-bit PCM in so the master carries no dither noise of its own."""
    pcm = (np.clip(x, -1, 1) * 8388607).astype('<i4')
    pcm = (pcm << 8).tobytes()  # s32 container, low byte zero
    subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-y', '-f', 's32le', '-ar', str(SR), '-ac', '2', '-i', '-',
                    '-c:a', 'libmp3lame', '-b:a', f'{kbps}k', path], input=pcm, check=True)


def encode_wav(x, path):
    pcm = (np.clip(x, -1, 1) * 8388607).astype('<i4')
    pcm = (pcm << 8).tobytes()
    subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-y', '-f', 's32le', '-ar', str(SR), '-ac', '2', '-i', '-',
                    '-c:a', 'pcm_s24le', path], input=pcm, check=True)


def rms(x):
    return float(np.sqrt(np.mean(x ** 2))) if len(x) else 0.0


def db(a, b):
    return round(20 * np.log10(a / b), 2) if a > 0 and b > 0 else None


def headtail(x, windows=WINDOWS_MS):
    """{W: [rms_head, rms_tail, head_minus_tail_dB]} — positive = the head is louder (a step UP at the wrap)."""
    out = {}
    for w in windows:
        n = int(SR * w / 1000)
        h, t = rms(x[:n]), rms(x[-n:])
        out[w] = [round(h, 4), round(t, 4), db(h, t)]
    return out


def worst_db(x, windows=(20, 50, 100, 250, 500)):
    return max(abs(v[2] or 0) for w, v in headtail(x, windows).items())


def wrap_step(x):
    """max over channels of |last -> first| and the body's p99.9 adjacent-sample delta (mono)."""
    d = float(np.abs(x[0] - x[-1]).max())
    body = np.abs(np.diff(x.mean(axis=1)))
    return round(d, 5), round(float(np.quantile(body, 0.999)), 5)


_SOS_HP = sg.butter(4, 3000, 'hp', fs=SR, output='sos')


def click_pct(x):
    """click_metric.py's HF click score: (seam_e, body_median, body_max, percentile of body windows below the seam)."""
    mono = x.mean(axis=1)
    hp = sg.sosfilt(_SOS_HP, np.concatenate([mono, mono]))
    n = len(mono); w = int(SR * 0.005)
    seam_e = rms(hp[n - w // 2:n + w // 2])
    hops = np.arange(n + int(SR * 0.02), 2 * n - int(SR * 0.02), w)
    body = np.array([rms(hp[i:i + w]) for i in hops])
    return round(seam_e, 5), round(float(np.median(body)), 5), round(float(body.max()), 5), round(float((body < seam_e).mean() * 100), 2)


def onset_env(mono, hop=44):
    f, t, Z = sg.stft(mono, fs=SR, nperseg=1024, noverlap=1024 - hop, padded=False, boundary=None)
    M = np.log1p(1000 * np.abs(Z))
    flux = np.diff(M, axis=1); flux[flux < 0] = 0
    o = flux.sum(axis=0); o = o - np.median(o); o[o < 0] = 0
    return o, hop


def equal_power(n):
    t = np.linspace(0, 1, n, endpoint=False)[:, None]
    return np.cos(t * np.pi / 2), np.sin(t * np.pi / 2)  # (out, in)


def cut(raw, s, L, X, blend='head'):
    """raw[s : s+L] with an X-sample equal-power crossfade at the joint using the raw's own continuation."""
    loop = raw[s:s + L].copy()
    w_out, w_in = equal_power(X)
    if blend == 'head':
        if s + L + X > len(raw): raise ValueError(f'head blend needs {s + L + X} samples, raw has {len(raw)}')
        loop[:X] = raw[s:s + X] * w_in + raw[s + L:s + L + X] * w_out
    elif blend == 'tail':
        if s - X < 0: raise ValueError('tail blend needs X samples before s')
        loop[-X:] = raw[s + L - X:s + L] * w_out + raw[s - X:s] * w_in
    else:
        raise ValueError(blend)
    return loop


def rotate(loop, r):
    return np.concatenate([loop[r:], loop[:r]])


def rotation_search(loop, step_ms=1.0, windows=(20, 50, 100, 250, 500), onset_weight=0.0, hf_weight=0.0, max_db=1.0, refine=True):
    """The file boundary where head and tail agree at every window. Every r on a step_ms grid is
    scored: boundaries whose worst window exceeds max_db are out (unless none pass), and among the
    rest the score is worst |dB| + onset_weight * onset strength at r (a transient is never the
    boundary) + hf_weight * the 5 ms HF (> 3 kHz) energy at r as a fraction of the body's p95 (the
    boundary sits between hi-hat / clap hits so the click metric stays low). The winner is refined
    to the nearest mono zero-crossing that still passes max_db."""
    n = len(loop); mono = loop.mean(axis=1)
    o, hop = onset_env(mono)
    onorm = o / (o.max() + 1e-12)
    hp = sg.sosfilt(_SOS_HP, np.concatenate([mono, mono]))
    w5 = int(SR * 0.005)
    hfe = np.sqrt(np.convolve(hp ** 2, np.ones(w5) / w5, 'same'))[:n]
    hfn = hfe / (np.quantile(hfe, 0.95) + 1e-12)
    dbl = np.concatenate([loop, loop])
    cp = np.concatenate([[0.0], np.cumsum((dbl ** 2).sum(axis=1))])
    def wrms(a, b):
        return np.sqrt((cp[b] - cp[a]) / (2 * (b - a)))
    def worst_at(r):
        worst = 0.0
        for w in windows:
            m = int(SR * w / 1000)
            h = wrms(r, r + m); t = wrms(r + n - m, r + n)
            worst = max(worst, abs(20 * np.log10((h + 1e-9) / (t + 1e-9))))
        return worst
    step = max(1, int(SR * step_ms / 1000))
    rows = []
    for r in range(0, n, step):
        worst = worst_at(r)
        oi = min(len(onorm) - 1, r // hop)
        rows.append((worst, onset_weight * onorm[oi] + hf_weight * hfn[r], r))
    passing = [x for x in rows if x[0] <= max_db] or rows
    worst, extra, r = min(passing, key=lambda x: x[0] + x[1])
    if refine:
        lo, hi = max(1, r - step), min(n - 1, r + step)
        zc = [i for i in range(lo, hi) if mono[i - 1] <= 0 < mono[i] or mono[i - 1] >= 0 > mono[i]]
        zc = [i for i in zc if worst_at(i) <= max_db] or zc
        if zc:
            r = min(zc, key=lambda i: abs(i - r))
            worst = worst_at(r)
    return r, worst


def roundtrip(x, kbps=128, codec='mp3'):
    """What the sprite codec does to a loop: encode at the packer's bitrate, decode gaplessly, compare length."""
    import tempfile, os
    d = tempfile.mkdtemp()
    src = os.path.join(d, 'x.wav'); encode_wav(x, src)
    out = os.path.join(d, 'x.m4a' if codec == 'aac' else 'x.mp3')
    if codec == 'aac':
        subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-y', '-i', src, '-c:a', 'aac', '-b:a', f'{kbps}k', out], check=True)
    else:
        subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-y', '-i', src, '-c:a', 'libmp3lame', '-b:a', f'{kbps}k', out], check=True)
    y = decode(out)
    for p in (src, out): os.remove(p)
    os.rmdir(d)
    return y


def ebur128(path):
    """Integrated LUFS / true peak the packer's way (apad 0.4 s, ebur128 peak=true)."""
    err = subprocess.run(['ffmpeg', '-v', 'info', '-nostdin', '-i', path, '-af', 'apad=pad_dur=0.4,ebur128=peak=true', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    s = err[err.rfind('Summary:'):]
    import re
    num = lambda k: float(re.search(rf'{k}:\s+(-?[\d.]+|-inf)', s).group(1))
    return {'I': num('I'), 'TP': num('Peak'), 'LRA': num('LRA')}


def sha256(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


def report(x, label=''):
    ht = headtail(x)
    ws, body = wrap_step(x)
    ck = click_pct(x)
    print(f'{label} len {len(x)} ({len(x) / SR:.4f}s) wrap {ws} (body p99.9 {body}) click {ck}')
    for w, (h, t, d) in ht.items():
        print(f'   {w:>5} ms  head {h:.4f}  tail {t:.4f}  {d:+.2f} dB')
    return {'len_samples': len(x), 'len_s': round(len(x) / SR, 4), 'wrap_step': ws, 'body_p999': body, 'click': ck, 'headtail': ht}
