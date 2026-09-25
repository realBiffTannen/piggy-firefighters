#!/usr/bin/env python3
"""PIGGY FIREFIGHTERS 75 s review montage (family tool LUCKY montage_lucky.py, adapted 2026-09-25): masters, equal-power bed
fades, a simple duck under celebrations, final render loudnorm'd and re-rendered until the FILE is <= -1 dBTP. Every one-shot
plays at its REGISTERED cues.json gain, so what you hear is the shipped family ladder, not a hand balance. It is a listening
aid for the human pass (SOUND_BIBLE §9), not an acceptance test. A cue whose master does not exist yet is skipped and listed.

Timeline: base A (ambience) -> spin with the reel-stop ladder and a line win -> spin with alarms 1, 2, anticipation layer +
riser, alarm 3 + hit -> trigger fanfare -> bay-door shutter -> Rescue entry + Rescue bed: hose start/loop/end, room down,
rescue ta-das rising, spins added, building cleared + two-tone call + block slide, last spin, rescue total -> a Backdraft with
ignitions + multipliers -> BIG -> HUGE rung beds with the count-up ladder -> Alarm Call false alarm (neutral) -> base B.
Writes audio/qa/review_montage.mp3 (+ .json cue sheet).   usage: python3 audio/tools/montage.py
"""
import json, os, subprocess, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit as K
ROOT, SR, QA, MAST = K.ROOT, K.SR, K.QA, K.MAST
CUES = {c['id']: c for c in json.load(open(f'{ROOT}/audio/cues.json'))['cues']}
_cache = {}; missing = set()


def dec(name):
    if name not in _cache:
        p = f'{MAST}/{name}.wav'
        if not os.path.exists(p): missing.add(name); return None
        raw = subprocess.run([K.FFMPEG, '-v', 'error', '-nostdin', '-i', p, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
        _cache[name] = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)
    return _cache[name]


TOT = int(75 * SR); mix = np.zeros((TOT, 2)); sheet = []
s = lambda t: int(t * SR)


def add(name, t, g=1.0):
    x = dec(name)
    if x is None: return
    c = x * CUES[name].get('gain', 1.0) * g; a = s(t); b = min(a + len(c), TOT); mix[a:b] += c[:b - a]; sheet.append((round(t, 2), name))


def bedloop(name, t0, t1, g=1.0, fade_in=0.0, fade_out=0.0):
    x = dec(name)
    if x is None: return
    c = x * CUES[name].get('gain', 1.0) * g; a, b = s(t0), s(t1); seg = np.zeros((b - a, 2)); pos = 0
    while pos < b - a:
        n = min(len(c), b - a - pos); seg[pos:pos + n] += c[:n]; pos += n
    if fade_in > 0: f = s(fade_in); seg[:f] *= np.sin(np.linspace(0, np.pi / 2, f))[:, None]
    if fade_out > 0: f = s(fade_out); seg[-f:] *= np.cos(np.linspace(0, np.pi / 2, f))[:, None]
    mix[a:b] += seg; sheet.append((round(t0, 2), f'BED {name} -> {t1:.1f}s'))


def duck(t0, t1, depth=0.55, ramp=0.06):
    a, b, r = s(t0), s(t1), s(ramp); env = np.full(b - a, depth); env[:r] = np.linspace(1, depth, r); env[-r:] = np.linspace(depth, 1, r)
    mix[a:b] *= env[:, None]


# ---- BASE A (92 BPM): two spins
bedloop('base_loop_a', 0.0, 13.0, fade_out=0.6); bedloop('ambient_station_loop', 0.0, 13.0, fade_out=0.6)
add('ui_click_1', 0.6); add('spin_start', 1.0); add('spin_whoosh', 1.05)
for i in range(5): add(f'reel_stop_{i + 1}', 1.9 + 0.22 * i)
add('sym_win_h1', 3.2); add('line_win_small', 3.3); duck(3.25, 3.9, 0.7)
add('spin_start', 5.0); add('spin_whoosh', 5.05)
add('reel_stop_1', 5.9); add('alarm_land_1', 5.92); add('reel_stop_2', 6.12); add('reel_stop_3', 6.34); add('alarm_land_2', 6.36)
bedloop('anticipation_layer', 6.5, 10.3, fade_in=0.3, fade_out=0.3); add('antic_riser', 6.8)
add('reel_stop_4', 8.9); add('antic_riser_2', 9.0); add('reel_stop_5', 10.4); add('alarm_land_3', 10.42); add('antic_hit', 10.45)
add('trigger_fanfare', 10.7); duck(10.6, 12.8, 0.5)
# ---- bay door + RESCUE (100 BPM)
add('shutter_slam', 12.6); duck(12.55, 13.2, 0.6)
bedloop('rescue_loop', 13.2, 33.6, fade_in=0.5, fade_out=0.8); add('rescue_enter', 13.3); duck(13.25, 14.6, 0.6)
for k in range(3):
    t = 16.0 + 3.2 * k
    add('reel_stop_1', t - 0.9); add('reel_stop_3', t - 0.6); add('reel_stop_5', t - 0.3)
    add('hose_start', t); bedloop('hose_loop', t + 0.5, t + 1.6, fade_out=0.1); add('hose_end', t + 1.6)
    add('room_down', t + 0.7); add('steam', t + 1.2)
    add(f'rescue_tada_{k + 1}', t + 1.8); add('spins_added', t + 2.4); duck(t + 1.75, t + 2.8, 0.7)
add('rescue_tada_4', 26.0); add('rescue_tada_6', 26.9); add('rescue_tada_8', 27.8)
add('building_cleared', 28.6); duck(28.55, 30.6, 0.5); add('siren_pass', 30.4); add('block_slide', 31.6)
add('last_spin', 32.4); add('rescue_total_mid', 33.4); duck(33.35, 35.0, 0.55)
# ---- BACKDRAFT (base B)
bedloop('base_loop_b', 34.6, 44.0, fade_in=0.8, fade_out=0.4); bedloop('backdraft_spins_layer', 36.0, 43.6, fade_in=0.3, fade_out=0.4)
add('backdraft_spins_start', 35.4); duck(35.35, 36.8, 0.6)
add('backdraft_whoosh', 37.4); add('backdraft_roar', 37.6); add('backdraft_chord', 38.4); duck(38.35, 39.4, 0.7)
for i, cid in enumerate(['blaze_ignite', 'blaze_ignite_2', 'blaze_ignite_3', 'blaze_ignite_4', 'blaze_ignite_5']): add(cid, 38.6 + 0.16 * i)
for i, m in enumerate((2, 3, 5, 10)): add(f'blaze_mult_{m}', 40.0 + 0.55 * i)
add('backdraft_spins_end', 42.6); duck(42.55, 44.0, 0.6)
# ---- WIN RUNGS (100 BPM): BIG -> HUGE with the count-up
bedloop('rung_bed_big', 44.0, 49.0, fade_in=0.2); add('rung_hit_big', 44.05); add('sign_impact_big', 44.2); add('burst_water', 44.6); add('rung_flare', 45.0)
for i in range(12): add(f'count_ticker_{i + 1}', 45.3 + 0.3 * i)
bedloop('rung_bed_huge', 49.0, 53.0, fade_out=0.5); add('rung_hit_huge', 49.05); add('sign_impact_huge', 49.2); add('burst_embers', 49.5)
add('rung_land', 52.2); add('burst_embers', 52.25); add('rung_out', 53.2)
# ---- ALARM CALL false alarm (neutral) -> BASE B
bedloop('base_loop_b', 53.4, 75.0, fade_in=1.0, fade_out=1.5); bedloop('ambient_station_loop', 53.4, 75.0, fade_in=1.0, fade_out=1.5)
add('buy_confirm', 54.0); add('alarm_call_ring', 54.6); bedloop('anticipation_layer', 55.4, 58.0, fade_in=0.3, fade_out=0.3)
add('alarm_card_flip', 57.6); add('alarm_outcome_false', 58.0); add('dog_bark', 58.7)
add('bet_change', 61.0); add('ante_on', 62.0); add('spin_start', 63.4); add('spin_whoosh', 63.45)
for i in range(5): add(f'reel_stop_{i + 1}', 64.3 + 0.22 * i)
add('dead_spin_settle', 65.6); add('galarm_glint', 67.0)

os.makedirs(QA, exist_ok=True); out = f'{QA}/review_montage.mp3'
pcm = (np.clip(mix, -1, 1) * 8388607).astype('<i4'); pcm = (pcm << 8).tobytes()
trim_db = 0.0; I = TP = None
for _ in range(4):  # the mp3 encoder overshoots the loudnorm ceiling: re-render with a trim until the FILE is <= -1 dBTP
    subprocess.run([K.FFMPEG, '-v', 'error', '-nostdin', '-y', '-f', 's32le', '-ar', str(SR), '-ac', '2', '-i', '-',
                    '-af', f'loudnorm=I=-15:TP=-1.5:LRA=11,volume={trim_db:.2f}dB', '-ar', str(SR), '-c:a', 'libmp3lame', '-b:a', '256k', out], input=pcm, check=True)
    I, TP = K.measure(out)
    if TP is not None and TP <= -1.1: break
    trim_db -= (TP + 1.3) if TP is not None else 0.5
d = len(K.lk.decode(out)) / SR if hasattr(K, 'lk') else TOT / SR
json.dump({'file': os.path.relpath(out, ROOT), 'duration_s': round(d, 2), 'I_LUFS': I, 'TP_dBFS': TP, 'cues_used': len({n for _, n in sheet}),
           'missingMasters': sorted(missing), 'sheet': sheet}, open(f'{QA}/review_montage.json', 'w'), indent=1)
print(f'{out}  dur={d:.1f}s  I={I} LUFS  TP={TP} dBFS  distinct cues={len({n for _, n in sheet})}  missing masters={len(missing)}')
