#!/usr/bin/env python3
"""PIGGY FIREFIGHTERS signature hook + tuned layers (2026-09-25). Imported by build_audio.py; runnable alone to
render a preview:  python3 audio/tools/hook_layer.py preview [bpm] [colour]  -> audio/qa/hook_preview_<colour>.wav

Why synthesised (family lesson, LUCKY/Piggy Workers): the ElevenLabs music model cannot play a dictated note
sequence (2-5 of 16 beats matched over four solo draws), so a hook the player is meant to hum is rendered here,
deterministically, at each bed's own tempo and mixed into the drawn beds (bars 1-4 and 17-20 of 32-bar beds, bars
1-4 of the 8-bar rung beds) and as a fast first-bar pickup on the fanfares.

THE HOOK (C major pentatonic, 4 + 4 notes, one note per beat, two bars, stated twice = 4 bars):
    call   G4 C5 E5 G5   (a bugle call: the natural-horn notes G C E G)
    answer A5 G5 E5 C5   (a pentatonic fall that lands on the tonic)
The call is also the pickup (G C E G) that RESOLVES the unresolved alarm ladder (ii -> V -> V7 -> V9 -> V13) on the
trigger fanfare: its first note is the dominant, its second the tonic.

Colours (additive partials, per-partial exponential decay; no samples, nothing from a donor):
    glock  glockenspiel: 1 / 2.76 / 5.4 inharmonic bar partials, bright, long ring
    bugle  brass: harmonic partials 1..14 with a brass-like spectral tilt that opens during a 25 ms attack,
           a 5 Hz 0.3 % vibrato after 150 ms, held then released (not a mallet)
    bell   brass fire bell: 1 / 2.0 / 2.43 / 3.0 / 4.1, strike noise, very long ring
    chime  a clean harmonic chime (1 / 2 / 3 / 4.02) for CHORDS (inharmonic bell partials make chords muddy)
    vibes  vibraphone: 1 / 4.0 / 10.0 with a 5.5 Hz tremolo
    wood   tuned marimba / woodblock knock: 1 / 3.93 / 9.2, 160 ms (the reel-stop ladder's pitched layer)
"""
import os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

SR = 44100
HOOK = [67, 72, 76, 79, 81, 79, 76, 72]   # G4 C5 E5 G5 | A5 G5 E5 C5
FIRST_BAR = [67, 72, 76, 79]              # the call (pickup)
NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']


def hz(m): return 440.0 * 2 ** ((m - 69) / 12.0)
def name(m): return NOTE_NAMES[int(round(m)) % 12] + str(int(round(m)) // 12 - 1)


def tone(f, dur_s, colour, hold_s=None):
    """One deterministic note. `hold_s` (bugle only) = how long the note is held before its release."""
    n = max(1, int(dur_s * SR)); t = np.arange(n) / SR; y = np.zeros(n)
    rng = np.random.default_rng(int(f * 10) + len(colour))
    if colour == 'glock':
        for ratio, amp, tau in [(1.0, 1.0, 0.9), (2.76, 0.35, 0.5), (5.4, 0.12, 0.25)]:
            if f * ratio < 16000: y += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t / tau)
        y += rng.standard_normal(n) * np.exp(-t / 0.0015) * 0.04          # mallet contact
    elif colour == 'bugle':
        hold = hold_s if hold_s is not None else dur_s * 0.75
        vib = 1 + 0.003 * np.sin(2 * np.pi * 5.0 * t) * np.clip((t - 0.15) / 0.15, 0, 1)
        ph = 2 * np.pi * np.cumsum(f * vib) / SR
        att = np.clip(t / 0.025, 0, 1)                                     # brightness opens with the attack
        for k in range(1, 15):
            if f * k > 12000: break
            tilt = k ** -(1.6 - 0.7 * att)                                 # dark at the front, brassy once open
            y += tilt * np.sin(k * ph)
        env = np.clip(t / 0.018, 0, 1) * np.where(t < hold, 1.0 - 0.15 * t / max(hold, 1e-3), 0.85 * np.exp(-(t - hold) / 0.07))
        y *= env
    elif colour == 'bell':
        for ratio, amp, tau in [(1.0, 1.0, 2.2), (2.0, 0.55, 1.4), (2.43, 0.35, 0.9), (3.0, 0.25, 0.7), (4.1, 0.15, 0.35)]:
            if f * ratio < 16000: y += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t / tau)
        y += rng.standard_normal(n) * np.exp(-t / 0.002) * 0.08            # clapper strike
    elif colour == 'chime':
        for ratio, amp, tau in [(1.0, 1.0, 1.4), (2.0, 0.35, 0.9), (3.0, 0.12, 0.5), (4.02, 0.06, 0.3)]:
            if f * ratio < 16000: y += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t / tau)
    elif colour == 'wood':  # a tuned marimba / woodblock knock (bar partials 1 : 3.93 : 9.2, short), phone-audible pitch for thunks
        for ratio, amp, tau in [(1.0, 1.0, 0.16), (3.93, 0.3, 0.05), (9.2, 0.08, 0.018)]:
            if f * ratio < 16000: y += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t / tau)
        y += rng.standard_normal(n) * np.exp(-t / 0.0008) * 0.06          # mallet contact
    elif colour == 'vibes':
        trem = 1 + 0.25 * np.sin(2 * np.pi * 5.5 * t)
        for ratio, amp, tau in [(1.0, 1.0, 1.6), (4.0, 0.2, 0.4), (10.0, 0.05, 0.1)]:
            if f * ratio < 16000: y += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t / tau)
        y *= trem
    else:
        raise ValueError(colour)
    a = int(0.003 * SR); y[:a] *= np.linspace(0, 1, min(a, n))
    # r2 (2026-09-25): a note used to END on a hard cut wherever `dur_s` fell (a 92 BPM glock hook note at -14 dB, a
    # 132 BPM pickup note at -5 dB, the bell at -5 dB): a click at every note end. Now a cos^2 release over the last
    # 30 % of the note (10-250 ms), so every note ends at zero.
    r = int(min(0.25 * SR, max(0.01 * SR, 0.3 * n))); y[-r:] *= np.cos(np.linspace(0, np.pi / 2, r)) ** 2
    return y / (np.abs(y).max() + 1e-12)


def render(notes, bpm, colour, octave=0, note_beats=1.0):
    beat = 60.0 / bpm; total = int((len(notes) * note_beats * beat + 2.2) * SR); out = np.zeros(total)
    for i, m in enumerate(notes):
        f = hz(m + 12 * octave); s = int(i * note_beats * beat * SR)
        if colour == 'bugle':
            tn = tone(f, note_beats * beat + 0.35, colour, hold_s=note_beats * beat * 0.82)
        else:
            tn = tone(f, min(2.0, note_beats * beat * 2.2), colour)
        out[s:s + len(tn)] += tn[: total - s]
    return out


def chord(notes, dur_s, colour='chime', spread_ms=0.0, weights=None):
    """Notes sounded together (optionally rolled by spread_ms per voice; per-voice `weights`), normalised to peak 1."""
    n = int(dur_s * SR); out = np.zeros(n); weights = weights or [1.0] * len(notes)
    for i, (m, wt) in enumerate(zip(notes, weights)):
        s = int(i * spread_ms * SR / 1000); tn = tone(hz(m), dur_s, colour)
        out[s:] += wt * tn[: n - s] / np.sqrt(len(notes))
    return out / (np.abs(out).max() + 1e-12)


def stereo(m, width=0.08):
    """Slight width by LEVEL only: the identical signal in both channels, L x (1 + width), R x (1 - width) (~0.7 dB apart).
    r2 (2026-09-25): this was a 0.4 ms (17-sample) inter-channel delay. Summed to mono (a phone speaker) that is a comb
    filter with notches at 1250 / 3750 / 6250 Hz (A5 -6.3, C6 -10.5, D6 -16.6 dB): the alarm ladder stopped rising in
    mono, the multipliers flattened, and every bed's hook bars lost ~1 dB more than the rest (the glock's E6 sat in the
    notch). Level-only width is perfectly mono-compatible (corr 1, no mono loss)."""
    return np.stack([m * (1 + width), m * (1 - width)], axis=1) * 0.5


def rms_db(x): return 20 * np.log10(np.sqrt((x ** 2).mean()) + 1e-12)


if __name__ == '__main__':
    import kit as K
    if len(sys.argv) > 1 and sys.argv[1] == 'preview':
        bpm = float(sys.argv[2]) if len(sys.argv) > 2 else 92.0; colour = sys.argv[3] if len(sys.argv) > 3 else 'glock'
        x = stereo(render(HOOK * 2, bpm, colour, 1 if colour == 'glock' else 0)); x = x / (np.abs(x).max() + 1e-9) * 0.5
        os.makedirs(K.QA, exist_ok=True); p = f'{K.QA}/hook_preview_{colour}.wav'; K.enc_wav(x, p)
        print('wrote', p, '|', ' '.join(name(m) for m in HOOK))
    else:
        print(__doc__)
