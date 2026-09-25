#!/usr/bin/env python3
"""PIGGY FIREFIGHTERS mix pass (family tool: Piggy Workers round-7 mix_pass.py + LUCKY lucky_mix.py, adapted 2026-09-25).

Every SFX cue's level is measured on the SHIPPED .ogg as the loudest 400 ms RMS window (what a listener hears as "how
loud was that"), then the cue's playback `gain` is set so gain x file lands on its family's target dBFS. The targets are
a ladder relative to the music beds (-15.5 LUFS, about -18.5 dBFS RMS): ambience far under, UI and reel mechanics under,
gameplay events at the bed, rewards above it and STRICTLY RISING with the size of the reward (every reward chain below is
checked). Gains clamp to [0.12, 2.0]; a cue that needs more than +6 dB is re-mastered through the kit's limiter (and
re-shipped so both codecs stay <= -1 dBTP) instead of being redrawn. `_turbo` variants take their parent's target.
Primary beds keep gain 1.0 (mastered to LUFS); the two additive layers get MUSIC_LAYER_TARGET.

Writes gains into audio/cues.json and audio/qa/mix_pass.csv + mix_ladder.json.   usage: python3 audio/tools/mix.py
"""
import json, os, re, subprocess, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit as K
import loopkit as lk
ROOT, SR, QA = K.ROOT, K.SR, K.QA
STATIC_BASE = f'{ROOT}/apps/{K.GAME}/static'

# (regex, target dBFS of the loudest 400 ms after gain) — first match wins. Ladders rise by 0.5 dB per rung.
FAMILIES = [
    (r'^ambient_', -40), (r'^reel_spin_loop$', -30), (r'^hose_loop$', -24),
    (r'^ui_click_|^bet_change$', -27), (r'^count_ticker_', -27), (r'^dead_spin_settle$', -28),
    (r'^spin_whoosh$', -25), (r'^spin_start$', -23), (r'^reel_stop_turbo$', -21), (r'^reel_stop_', -22), (r'^wild_land$', -20),
    (r'^alarm_land_1$', -20), (r'^alarm_land_2$', -19.5), (r'^alarm_land_3$', -19), (r'^alarm_land_4$', -18.5), (r'^alarm_land_5$', -18),
    (r'^galarm_glint$', -20), (r'^antic_riser$', -18), (r'^antic_riser_2$', -17.5), (r'^antic_miss$', -20), (r'^antic_hit$', -18),
    (r'^trigger_fanfare$', -15),
    (r'^backdraft_whoosh$', -19), (r'^backdraft_roar$', -17.5), (r'^backdraft_chord$', -17), (r'^blaze_ignite', -19),
    (r'^blaze_mult_2$', -18), (r'^blaze_mult_3$', -17.5), (r'^blaze_mult_5$', -17), (r'^blaze_mult_10$', -16),
    (r'^sym_win_', -19), (r'^line_win_small$', -19), (r'^line_win_mid$', -18),
    (r'^total_win_small$', -18), (r'^total_win_mid$', -16.5), (r'^total_win_big$', -15), (r'^win_max$', -13.5),
    (r'^rung_hit_big$', -16), (r'^rung_hit_huge$', -15.5), (r'^rung_hit_mega$', -15), (r'^rung_hit_epic$', -14.5), (r'^rung_hit_max$', -14),
    (r'^sign_impact_big$', -18.5), (r'^sign_impact_huge$', -18), (r'^sign_impact_mega$', -17.5), (r'^sign_impact_epic$', -17), (r'^sign_impact_max$', -16.5),
    (r'^burst_water$', -19), (r'^burst_embers$', -18.5), (r'^burst_badges$', -18), (r'^burst_coins$', -17.5), (r'^burst_gold$', -17),
    (r'^rung_flare$|^rung_out$', -19), (r'^rung_land$', -15),
    (r'^backdraft_spins_start$', -15.5), (r'^rescue_enter$', -15), (r'^inferno_enter$', -14.5), (r'^backdraft_spins_end$', -16),
    (r'^hose_start$', -20), (r'^hose_end$', -21), (r'^steam$', -24), (r'^room_down$', -20),
    (r'^rescue_tada_1$', -19), (r'^rescue_tada_2$', -18.5), (r'^rescue_tada_3$', -18), (r'^rescue_tada_4$', -17.5),
    (r'^rescue_tada_5$', -17), (r'^rescue_tada_6$', -16.5), (r'^rescue_tada_7$', -16), (r'^rescue_tada_8$', -15.5),
    (r'^prize_coins$', -18), (r'^prize_coins_big$', -16.5), (r'^building_cleared$', -15.5), (r'^siren_pass$', -19), (r'^block_slide$', -20),
    (r'^spins_added$', -18), (r'^last_spin$', -18),
    (r'^rescue_total_small$', -18), (r'^rescue_total_mid$', -16.5), (r'^rescue_total_big$', -15),
    (r'^inferno_total_small$', -17.5), (r'^inferno_total_mid$', -16), (r'^inferno_total_big$', -14.5),
    (r'^alarm_call_ring$', -18), (r'^alarm_card_flip$', -21), (r'^alarm_outcome_false$', -20), (r'^alarm_outcome_rescue$', -15.5),
    (r'^alarm_outcome_inferno$', -14.5), (r'^dog_bark$', -21),
    (r'^ante_(on|off)$', -21), (r'^alert_insufficient$', -18), (r'^buy_confirm$', -21),
    (r'^shutter_slam$', -18), (r'^shutter_haul_[123]$', -23),
]
MUSIC_LAYER_TARGET = {'anticipation_layer': -21, 'backdraft_spins_layer': -20}
CHAINS = {  # effective level must RISE strictly along each chain (bigger reward / more tension = louder)
    'alarm_ladder': [f'alarm_land_{i}' for i in range(1, 6)],
    'anticipation': ['antic_riser', 'antic_riser_2'],
    'blaze_mult': ['blaze_mult_2', 'blaze_mult_3', 'blaze_mult_5', 'blaze_mult_10'],
    'line_wins': ['line_win_small', 'line_win_mid'],
    'total_win': ['total_win_small', 'total_win_mid', 'total_win_big'],
    'rung_hits': [f'rung_hit_{k}' for k in ('big', 'huge', 'mega', 'epic', 'max')],
    'sign_impacts': [f'sign_impact_{k}' for k in ('big', 'huge', 'mega', 'epic', 'max')],
    'bursts': ['burst_water', 'burst_embers', 'burst_badges', 'burst_coins', 'burst_gold'],
    'rescue_tada': [f'rescue_tada_{i}' for i in range(1, 9)],
    'rescue_total': ['rescue_total_small', 'rescue_total_mid', 'rescue_total_big'],
    'inferno_total': ['inferno_total_small', 'inferno_total_mid', 'inferno_total_big'],
    'prizes': ['prize_coins', 'prize_coins_big'],
    'entries': ['backdraft_spins_start', 'rescue_enter', 'inferno_enter'],
    'alarm_call': ['alarm_outcome_false', 'alarm_outcome_rescue', 'alarm_outcome_inferno'],
    'reward_to_max': ['total_win_big', 'rung_hit_max', 'win_max'],
}
MUSIC_RISING = [f'rung_bed_{k}' for k in ('big', 'huge', 'mega', 'epic', 'max')]
ALTERNATES = {'ui_click': ['ui_click_1', 'ui_click_2', 'ui_click_3'], 'shutter_haul': ['shutter_haul_1', 'shutter_haul_2', 'shutter_haul_3'],
              'reel_stops': [f'reel_stop_{i}' for i in range(1, 6)], 'blaze_ignite': ['blaze_ignite'] + [f'blaze_ignite_{i}' for i in range(2, 6)]}


def decode(path):
    raw = subprocess.run([K.FFMPEG, '-v', 'error', '-nostdin', '-i', path, '-f', 'f32le', '-acodec', 'pcm_f32le', '-ar', str(SR), '-ac', '2', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)


def loud400(x):
    m = (x ** 2).mean(axis=1); n = int(0.4 * SR)
    if len(m) <= n: return 10 * np.log10(m.mean() + 1e-12)
    c = np.cumsum(np.insert(m, 0, 0.0)); w = (c[n:] - c[:-n]) / n
    return 10 * np.log10(w.max() + 1e-12)


def target_for(c, ids=()):
    cid = c['id'][:-6] if c['id'].endswith('_turbo') and c['id'][:-6] in ids else c['id']  # a variant takes its parent's target
    t = MUSIC_LAYER_TARGET.get(cid)
    if t is None and c['bus'] == 'sfx': t = next((t for rx, t in FAMILIES if re.search(rx, cid)), None)
    return t


def remaster(cid, need_db):
    x = lk.decode(f'{K.MAST}/{cid}.wav'); up = need_db - 4.0  # land ~2 dB inside the clamp
    y, frac = K.limit(x * 10 ** (up / 20), ceiling_db=-1.5)
    res = K.ship(y, cid)
    return {'raised_dB': round(up, 2), 'limitedFraction': round(frac, 4), **res}


def main():
    doc = json.load(open(f'{ROOT}/audio/cues.json'))
    rows, remastered, unmatched, unbuilt = [], {}, [], []
    ids = {c['id'] for c in doc['cues']}
    for c in doc['cues']:
        t = target_for(c, ids)
        if t is None:
            if c['bus'] == 'sfx': unmatched.append(c['id'])
            continue
        ogg = os.path.join(STATIC_BASE, c['files'][0])
        if not os.path.exists(ogg): unbuilt.append(c['id']); continue
        lvl = loud400(decode(ogg)); need = t - lvl
        if need > 6.02:
            remastered[c['id']] = remaster(c['id'], need); lvl = loud400(decode(ogg)); need = t - lvl
            c['measured'] = {'I_LUFS': remastered[c['id']]['I_LUFS'], 'TP_dBFS': remastered[c['id']]['TP_dBFS']}
            c.setdefault('build', {})['remaster'] = remastered[c['id']]
        g = round(float(min(2.0, max(0.12, 10 ** (need / 20)))), 3); old = c.get('gain', 1.0); c['gain'] = g
        eff = round(lvl + 20 * np.log10(g), 2)
        c['mix'] = {'file_loud400_dBFS': round(lvl, 1), 'target_dBFS': t, 'effective_dBFS': eff, 'pass': 'pf_0925 (mix.py)'}
        rows.append((c['id'], round(lvl, 2), t, old, g, eff))
    json.dump(doc, open(f'{ROOT}/audio/cues.json', 'w'), indent=1)
    by = {r[0]: r for r in rows}; cues = {c['id']: c for c in doc['cues']}
    checks = {}
    for name, chain in CHAINS.items():
        if not all(c in by for c in chain): checks[name] = {'chain': chain, 'skipped': 'not all built'}; continue
        effs = [by[c][5] for c in chain]
        checks[name] = {'chain': chain, 'effective_dBFS': effs, 'strictlyRising': all(b > a for a, b in zip(effs, effs[1:]))}
    lufs = [cues[c].get('measured', {}).get('I_LUFS') for c in MUSIC_RISING if c in cues]
    checks['rung_beds_LUFS'] = {'chain': MUSIC_RISING, 'I_LUFS': lufs, 'strictlyRising': None not in lufs and all(b > a for a, b in zip(lufs, lufs[1:]))}
    alts = {k: [by[c][5] for c in v if c in by] for k, v in ALTERNATES.items()}
    checks['alternates_levelMatched'] = {k: {'effective_dBFS': v, 'spread_dB': round(max(v) - min(v), 2) if v else None} for k, v in alts.items()}
    clamped = [(r[0], r[1], r[2], r[4]) for r in rows if r[4] in (2.0, 0.12) and abs(r[5] - r[2]) > 0.2]
    failing = [k for k, v in checks.items() if v.get('strictlyRising') is False]
    os.makedirs(QA, exist_ok=True)
    with open(f'{QA}/mix_pass.csv', 'w') as f:
        f.write('cue,file_loud400_dBFS,target_dBFS,old_gain,new_gain,effective_dBFS\n')
        for r in rows: f.write(','.join(map(str, r)) + '\n')
    json.dump({'levelled': len(rows), 'unmatched': unmatched, 'notBuilt': len(unbuilt), 'remastered': remastered, 'clampedOffTarget': clamped,
               'chainsNotRising': failing, 'checks': checks}, open(f'{QA}/mix_ladder.json', 'w'), indent=1, default=str)
    print(len(rows), 'cues levelled;', len(unbuilt), 'not built;', len(unmatched), 'unmatched:', unmatched)
    print('remastered (> +6 dB):', {k: v['raised_dB'] for k, v in remastered.items()})
    print('clamped off target:', clamped)
    print('chains not rising:', failing or 'none')


if __name__ == '__main__':
    main()
