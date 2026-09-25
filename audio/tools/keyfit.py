"""Key-fit analysis for tonal one-shots (family tool, LUCKY audio/tools/lucky_keyfit.py, adapted 2026-09-25): fine
(10-cent) chroma of a cue -> its tuning offset from 12-TET and the transposition (-2..+2 st) that best puts its pitch
content on C major pentatonic (C D E G A), the key of every Piggy Firefighters bed (the Inferno bed centres on A over
the SAME five notes, so the same test holds). Used by build_audio.py; runnable alone as a dry run over the raw draws:
    python3 audio/tools/keyfit.py [draw names...]      (reads audio/cues_pcm/<name>.wav, palettes from prompts.json)

Cues that are deliberately OUTSIDE the pentatonic set (the alarm ladder's ii-V chords, whose F and B are the point)
are never passed through here; build_audio.py lists them in NO_KEYFIT."""
import sys, os, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
SR = 44100
CPENT = (0, 2, 4, 7, 9)


def fine_chroma(x, lo=150.0, hi=4000.0):
    m = x.mean(axis=1) if x.ndim > 1 else x; n = 16384; hop = 4096; acc = np.zeros(120); w = np.hanning(n)
    if len(m) < n: m = np.concatenate([m, np.zeros(n - len(m))])
    fr = np.fft.rfftfreq(n, 1 / SR); sel = (fr > lo) & (fr < hi)
    cents = 1200 * np.log2(fr[sel] / 440.0) + 6900.0; idx = np.round(cents / 10).astype(int) % 120
    for i in range(0, len(m) - n + 1, hop):
        X = np.abs(np.fft.rfft(m[i:i + n] * w))[sel] ** 2
        np.add.at(acc, idx, X)
    return acc / (acc.sum() + 1e-12)


def analyse(x):
    acc = fine_chroma(x)
    ang = 2 * np.pi * (np.arange(120) % 10) / 10.0
    z = (acc * np.exp(1j * ang)).sum(); offset = float(np.angle(z) / (2 * np.pi) * 100.0)  # cents, [-50, 50)
    sh = int(round(offset / 10.0)); a = np.roll(acc, -sh)  # tuned so semitone centres sit on multiples of 10
    pcp = np.array([a[[(10 * p + d) % 120 for d in range(-4, 5)]].sum() for p in range(12)])
    near = np.array([a[[(10 * p + d) % 120 for d in (-2, -1, 0, 1, 2)]].sum() for p in range(12)]).sum()
    tonality = float(near / (a.sum() + 1e-12))  # share of energy within +-20 cents of a (tuned) semitone
    pcp = pcp / (pcp.sum() + 1e-12)
    share = {s: float(sum(pcp[(q - s) % 12] for q in CPENT)) for s in range(-2, 3)}
    return {'offsetCents': round(offset, 1), 'tonality': round(tonality, 3), 'share': {k: round(v, 3) for k, v in share.items()},
            'top': [['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][i] for i in np.argsort(pcp)[::-1][:5]]}


def decide(a, palette='mus'):
    """semitone correction to apply (0.0 = leave). Conservative: only clearly tonal cues, only clear gains.
    tonality is the energy share within +-20 cents of a semitone: ~0.5 for noise, >= 0.75 for a clear pitched ring.
    Musical cues (palette 'mus') are judged from 0.6 (0.5 when the best transposition gains >= 0.4 of share: a
    drum-heavy flourish whose pitched layer is plainly out of key); every other cue only from 0.75."""
    s0 = a['share'][0]; best = max(a['share'], key=lambda s: a['share'][s]); off = a['offsetCents']
    min_t = 0.6 if palette == 'mus' else 0.75
    if palette == 'mus' and a['share'][best] - s0 >= 0.4: min_t = 0.5
    if a['tonality'] < min_t: return 0.0, f'not tonal enough to judge (tonality {a["tonality"]:.2f} < {min_t})'
    tune = -off / 100.0 if abs(off) > 20 else 0.0
    if best != 0 and a['share'][best] - s0 >= 0.15 and a['share'][best] >= 0.6:
        return round(best + tune, 2), f'transpose {best:+d} st (share {s0:.2f} -> {a["share"][best]:.2f})' + (f', retune {-off:+.0f} c' if tune else '')
    if tune and s0 >= 0.5:
        return round(tune, 2), f'retune {-off:+.0f} c (share {s0:.2f})'
    if s0 < 0.5: return 0.0, f'OUT OF KEY, no small fix (share {s0:.2f}, best {best:+d} -> {a["share"][best]:.2f})'
    return 0.0, 'in key'


if __name__ == '__main__':
    import kit as K
    prompts = json.load(open(f'{K.TOOLS}/prompts.json'))
    ids = sys.argv[1:] or [k for k in prompts if not k.startswith('_') and os.path.exists(f'{K.PCM}/{k}.wav')]
    for cid in ids:
        x = K.load(f'{K.PCM}/{cid}.wav'); x = K.trim(x); a = analyse(x); st, why = decide(a, prompts.get(cid, {}).get('palette', 'mech'))
        print(f'{cid:28s} off={a["offsetCents"]:+6.1f}c ton={a["tonality"]:.2f} share0={a["share"][0]:.2f} '
              f'best={max(a["share"], key=lambda s: a["share"][s]):+d} top={a["top"]}  -> {st:+.2f} st: {why}')
