#!/usr/bin/env python3
"""PIGGY FIREFIGHTERS mix pass (family tool: Piggy Workers round-7 mix_pass.py + LUCKY lucky_mix.py, adapted 2026-09-25).

Every SFX cue's level is measured on the SHIPPED .ogg as the loudest 400 ms RMS window (what a listener hears as "how
loud was that"), then the cue's playback `gain` is set so gain x file lands on its family's target dBFS. The targets are
a ladder relative to the music beds (-15.5 LUFS, about -18.5 dBFS RMS): ambience far under, UI and reel mechanics under,
gameplay events at the bed, rewards above it and STRICTLY RISING with the size of the reward (every reward chain below is
checked). Gains clamp to [0.12, 2.0]; a cue that needs more than +6 dB is re-mastered through the kit's limiter (and
re-shipped so both codecs stay <= -1 dBTP) instead of being redrawn. `_turbo` variants take their parent's target.
Primary beds keep gain 1.0 (mastered to LUFS); the two additive layers get MUSIC_LAYER_TARGET.

r2 (2026-09-25): every cue is measured three ways (kit.levels): `st` the per-channel stereo power (headphones; the family
level and the one the targets are set on), `mono` the (L+R)/2 sum (a phone speaker / mono box) and `phone` that sum through
a 4th-order 400 Hz high-pass (a phone speaker's band). r1 checked the chains on `st` only, so they rose on headphones while
the mono sum of partly anti-phase draws and comb-filtered synth layers fell (rung hits BIG..MAX -16.0 / -16.7 / -17.5 /
-18.0 / -14.9 in mono). Now every CHAINS entry must rise by >= CHAIN_MARGIN_DB on ALL THREE: a later entry's gain is nudged
up (or, at the +6 dB clamp, the earlier entry's down) until it does; `_turbo` variants follow their parent's nudge and
their own chains are enforced the same way. Nudges are recorded per cue (`mix.chainNudge_dB`).

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


PREMIX = f'{K.SRC_MAST}/_premix'  # the build's master of every cue mix.py re-mastered (so the pass is idempotent)


def _sha(p):
    import hashlib
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()


def restore_pristine(cid):
    """If the current master is one mix.py wrote (sha recorded), put the build's own master back first, so re-running
    mix.py never stacks a second raise on the first one. A master the BUILD rewrote since is already pristine."""
    m, p = f'{K.MAST}/{cid}.wav', f'{PREMIX}/{cid}.wav'
    if os.path.exists(p + '.json') and os.path.exists(m) and json.load(open(p + '.json')).get('after') == _sha(m):
        K.ship(lk.decode(p), cid); return True
    return False


def softclip(x, ceil_db=-3.0):
    """4x-oversampled tanh soft clip: bounds the isolated full-scale pops of a crackle (crest > 16 dB) instantly, where a
    look-ahead limiter would pump on every pop. Crackle is broadband already, so the added harmonics are not heard as grit."""
    from scipy.signal import resample_poly
    c = 10 ** (ceil_db / 20); y = resample_poly(x, 4, 1, axis=0); y = c * np.tanh(y / c)
    return resample_poly(y, 1, 4, axis=0)[:len(x)]


def remaster(cid, target):
    """Raise a cue that needs > +6 dB of gain: from the BUILD's master (kept in masters/_src/_premix), soft-clip first
    when the crest factor is high, then limit at -1.5 dBFS and re-ship (both codecs <= -1 dBTP); up to 4 passes."""
    os.makedirs(PREMIX, exist_ok=True)
    m, p = f'{K.MAST}/{cid}.wav', f'{PREMIX}/{cid}.wav'
    import shutil
    shutil.copy(m, p); x = lk.decode(p)
    ogg = f'{K.RUN}/{cid}.ogg'; lvl0 = loud400(decode(ogg)); crest = 20 * np.log10(np.abs(x).max() + 1e-12) - lvl0
    up = 0.0; res = None; frac = 0.0; clip = bool(crest > 16.0)
    for k in range(4):
        need = target - (loud400(decode(ogg)) if res else lvl0)
        if res and need <= 4.0: break
        up += need - 3.0  # land ~3 dB inside the +6 dB clamp
        y = x * 10 ** (up / 20)
        if clip: y = softclip(y)
        y, frac = K.limit(y, ceiling_db=-1.5); res = K.ship(y, cid)
    json.dump({'after': _sha(m), 'raised_dB': round(up, 2)}, open(p + '.json', 'w'))
    return {'raised_dB': round(up, 2), 'crest_dB': round(float(crest), 1), 'softClip': clip, 'limitedFraction': round(frac, 4), 'passes': k + 1, **res}


METRICS = ('st', 'mono', 'phone')   # kit.levels: stereo power (headphones), (L+R)/2 (phone / mono box), 400 Hz HP of the sum (phone band)
CHAIN_MARGIN_DB = 0.25              # every chain step must rise by at least this on EVERY metric
G_MIN_DB, G_MAX_DB = 20 * np.log10(0.12), 20 * np.log10(2.0)


def solve_chains(chains, lv, g, log):
    """r2 (2026-09-25): every chain must rise by >= CHAIN_MARGIN_DB on st, mono AND phone with ONE gain per cue. Solved jointly
    over all chains (they share members) as a linear programme: minimise 10 x the largest |gain - family-target gain| plus the
    sum of them, subject to  g_a - g_b <= L_b[k] - L_a[k] - margin  for every consecutive pair and metric k, and the gain
    clamp. So a chain whose members differ in spectral balance (a bass-heavy impact loses 4-6 dB through the phone proxy)
    is spread evenly around its family targets instead of piling the whole correction onto its last member. Falls back to the
    iterative raise when the programme is infeasible (reported)."""
    from scipy.optimize import linprog
    ids = sorted({c for ch in chains.values() if all(x in lv for x in ch) for c in ch})
    if not ids: return g, True
    n = len(ids); ix = {c: i for i, c in enumerate(ids)}; g0 = np.array([g[c] for c in ids])
    # variables: g (n), a (n) = |g - g0|, t = max a
    A, b = [], []
    for ch in chains.values():
        if not all(x in lv for x in ch): continue
        for p, q in zip(ch, ch[1:]):
            for k in METRICS:
                row = np.zeros(2 * n + 1); row[ix[p]] = 1; row[ix[q]] = -1; A.append(row); b.append(lv[q][k] - lv[p][k] - CHAIN_MARGIN_DB)
    for i in range(n):
        r1 = np.zeros(2 * n + 1); r1[i] = 1; r1[n + i] = -1; A.append(r1); b.append(g0[i])      # g - g0 <= a
        r2 = np.zeros(2 * n + 1); r2[i] = -1; r2[n + i] = -1; A.append(r2); b.append(-g0[i])    # g0 - g <= a
        r3 = np.zeros(2 * n + 1); r3[n + i] = 1; r3[2 * n] = -1; A.append(r3); b.append(0.0)    # a <= t
    cost = np.concatenate([np.zeros(n), np.ones(n), [10.0]])
    bounds = [(G_MIN_DB, G_MAX_DB)] * n + [(0, None)] * (n + 1)
    res = linprog(cost, A_ub=np.array(A), b_ub=np.array(b), bounds=bounds, method='highs')
    if res.status != 0:
        log.append(('LP', 'infeasible', res.message)); return enforce_chains(chains, lv, g, log), False
    for c in ids:
        v = float(res.x[ix[c]])
        if abs(v - g[c]) >= 0.005: log.append(('LP', c, round(v - g[c], 2)))
        g[c] = v
    return g, True


def enforce_chains(chains, lv, g, log):
    """Fallback: raise a later entry (or, at the clamp, lower the previous one) until every chain rises on st, mono and phone;
    iterates to a fixpoint (chains share members)."""
    for _ in range(40):
        changed = False
        for name, chain in chains.items():
            if not all(c in lv for c in chain): continue
            for a, b in zip(chain, chain[1:]):
                req = max(lv[a][k] + g[a] + CHAIN_MARGIN_DB - lv[b][k] for k in METRICS)
                if g[b] < req - 1e-6:
                    if req <= G_MAX_DB: log.append((name, b, round(req - g[b], 2))); g[b] = req; changed = True
                    else:
                        if g[b] < G_MAX_DB: g[b] = G_MAX_DB; changed = True
                        ga = min(lv[b][k] + g[b] - CHAIN_MARGIN_DB - lv[a][k] for k in METRICS)
                        if ga < g[a] - 1e-6: log.append((name, a, round(ga - g[a], 2))); g[a] = max(G_MIN_DB, ga); changed = True
        if not changed: break
    return g


def chain_checks(chains, lv, g):
    out = {}
    for name, chain in chains.items():
        if not all(c in lv for c in chain): out[name] = {'chain': chain, 'skipped': 'not all built'}; continue
        eff = {k: [round(lv[c][k] + g[c], 2) for c in chain] for k in METRICS}
        rising = {k: all(y - x >= CHAIN_MARGIN_DB - 0.01 for x, y in zip(v, v[1:])) for k, v in eff.items()}
        out[name] = {'chain': chain, 'effective_dBFS': eff['st'], 'effective_mono_dBFS': eff['mono'], 'effective_phone_dBFS': eff['phone'],
                     'strictlyRising': all(rising.values()), 'risingBy': rising}
    return out


def main():
    doc = json.load(open(f'{ROOT}/audio/cues.json'))
    remastered, unmatched, unbuilt = {}, [], []
    ids = {c['id'] for c in doc['cues']}; cues = {c['id']: c for c in doc['cues']}
    lv, g, tgt = {}, {}, {}
    for c in doc['cues']:
        t = target_for(c, ids)
        if t is None:
            if c['bus'] == 'sfx': unmatched.append(c['id'])
            continue
        ogg = os.path.join(STATIC_BASE, c['files'][0])
        if not os.path.exists(ogg): unbuilt.append(c['id']); continue
        if restore_pristine(c['id']): c.get('build', {}).pop('remaster', None)
        L = K.levels(decode(ogg)); need = t - L['st']
        if need > 6.02:
            r = remaster(c['id'], t); L = K.levels(decode(ogg))
            remastered[c['id']] = r
            c['measured'] = {'I_LUFS': r['I_LUFS'], 'TP_dBFS': r['TP_dBFS'], 'TP_m4a_dBFS': r.get('TP_m4a_dBFS')}
            c.setdefault('build', {})['remaster'] = r
        lv[c['id']] = L; tgt[c['id']] = t; g[c['id']] = float(min(G_MAX_DB, max(G_MIN_DB, t - L['st'])))
    base = dict(g); log = []
    g, lp_ok = solve_chains(CHAINS, lv, g, log)
    # a _turbo variant follows its parent's nudge, then its own chains are enforced the same way
    for cid in g:
        if cid.endswith('_turbo') and cid[:-6] in g and abs(g[cid[:-6]] - base[cid[:-6]]) > 1e-6:
            g[cid] = float(min(G_MAX_DB, max(G_MIN_DB, g[cid] + g[cid[:-6]] - base[cid[:-6]])))
    turbo_chains = {f'{k}_turbo': [f'{c}_turbo' for c in v] for k, v in CHAINS.items() if all(f'{c}_turbo' in lv for c in v)}
    g, lp_ok_t = solve_chains(turbo_chains, lv, g, log)
    rows = []
    for cid, L in lv.items():
        c = cues[cid]; gl = round(float(10 ** (g[cid] / 20)), 3); old = c.get('gain', 1.0); c['gain'] = gl; gd = 20 * np.log10(gl)
        eff = {k: round(L[k] + gd, 2) for k in METRICS}
        c['mix'] = {'file_loud400_dBFS': round(L['st'], 1), 'file_mono_dBFS': round(L['mono'], 1), 'file_phone400_dBFS': round(L['phone'], 1), 'corr': L['corr'],
                    'target_dBFS': tgt[cid], 'chainNudge_dB': round(g[cid] - base[cid], 2), 'effective_dBFS': eff['st'], 'effective_mono_dBFS': eff['mono'],
                    'effective_phone_dBFS': eff['phone'], 'pass': 'pf_0925r2 (mix.py: st + mono + phone)'}
        rows.append((cid, round(L['st'], 2), round(L['mono'], 2), round(L['phone'], 2), L['corr'], tgt[cid], old, gl, eff['st'], eff['mono'], eff['phone']))
    tmp = f'{ROOT}/audio/cues.json.tmp'; json.dump(doc, open(tmp, 'w'), indent=1, default=float); os.replace(tmp, f'{ROOT}/audio/cues.json')  # atomic
    gq = {cid: 20 * np.log10(cues[cid]['gain']) for cid in lv}  # the gains as registered (rounded)
    checks = chain_checks(CHAINS, lv, gq); checks.update(chain_checks(turbo_chains, lv, gq))
    lufs = [cues[c].get('measured', {}).get('I_LUFS') for c in MUSIC_RISING if c in cues]
    checks['rung_beds_LUFS'] = {'chain': MUSIC_RISING, 'I_LUFS': lufs, 'strictlyRising': None not in lufs and all(b > a for a, b in zip(lufs, lufs[1:]))}
    alts = {k: {m: [round(lv[c][m] + gq[c], 2) for c in v if c in lv] for m in METRICS} for k, v in ALTERNATES.items()}
    checks['alternates_levelMatched'] = {k: {m: {'effective_dBFS': v, 'spread_dB': round(max(v) - min(v), 2) if v else None} for m, v in d.items()} for k, d in alts.items()}
    clamped = [(r[0], r[1], r[5], r[7]) for r in rows if r[7] in (2.0, 0.12) and abs(r[8] - r[5]) > 0.2 and abs(cues[r[0]]['mix']['chainNudge_dB']) < 0.01]
    failing = [k for k, v in checks.items() if v.get('strictlyRising') is False]
    nudged = {cid: cues[cid]['mix']['chainNudge_dB'] for cid in lv if abs(cues[cid]['mix']['chainNudge_dB']) >= 0.01}
    os.makedirs(QA, exist_ok=True)
    with open(f'{QA}/mix_pass.csv', 'w') as f:
        f.write('cue,file_loud400_dBFS,file_mono_dBFS,file_phone400_dBFS,corr,target_dBFS,old_gain,new_gain,effective_dBFS,effective_mono_dBFS,effective_phone_dBFS\n')
        for r in rows: f.write(','.join(map(str, r)) + '\n')
    json.dump({'pass': 'pf_0925r2', 'metrics': {'st': 'loudest 400 ms, per-channel stereo power', 'mono': 'loudest 400 ms of (L+R)/2',
                                                 'phone': 'loudest 400 ms of (L+R)/2 through a 4th-order 400 Hz high-pass'},
               'chainMargin_dB': CHAIN_MARGIN_DB, 'levelled': len(rows), 'unmatched': unmatched, 'notBuilt': len(unbuilt), 'remastered': remastered,
               'clampedOffTarget': clamped, 'chainSolver': {'method': 'linear programme (scipy HiGHS): min 10 x max|nudge| + sum|nudge|', 'feasible': lp_ok, 'feasibleTurbo': lp_ok_t},
               'chainNudges_dB': nudged, 'chainsNotRising': failing, 'checks': checks}, open(f'{QA}/mix_ladder.json', 'w'), indent=1, default=str)
    print(len(rows), 'cues levelled;', len(unbuilt), 'not built;', len(unmatched), 'unmatched:', unmatched)
    print('remastered (> +6 dB):', {k: v['raised_dB'] for k, v in remastered.items()})
    print('chain nudges (dB over the family target):', nudged)
    print('clamped off target:', clamped)
    print('chains not rising (st / mono / phone):', failing or 'none')


if __name__ == '__main__':
    main()
