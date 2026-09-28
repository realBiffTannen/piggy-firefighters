#!/usr/bin/env python3
"""Print the contract §9 measured-figures table (Markdown) from a production report.json.

    python3 tools/math/contract_figures.py math/games/piggy_firefighters/library/production-100k/report.json
"""
import json, sys
from fractions import Fraction

MODES = ['base', 'ante', 'super_ante', 'backdraft_spins', 'alarm_call', 'rescue', 'inferno']
TRIGGER = {'base': (Fraction(1, 165), Fraction(1, 2100)), 'ante': (Fraction(5, 165), Fraction(5, 2100)),
           'super_ante': (Fraction(15, 165), Fraction(15, 2100))}


def one_in(p):
    return f'1 in {float(1 / p):,.1f}' if p else '—'


def main():
    r = json.load(open(sys.argv[1]))
    m = r['modes']
    rows = []
    rows.append('| Figure | ' + ' | '.join(MODES) + ' |')
    rows.append('|---|' + '---:|' * len(MODES))
    rows.append('| cost (x base bet) | ' + ' | '.join(str(m[k]['cost']) for k in MODES) + ' |')
    rows.append('| RTP (LUT exact) | ' + ' | '.join(f"{m[k]['rtp']:.12f}" for k in MODES) + ' |')
    rows.append('| SD / cost | ' + ' | '.join(f"{m[k]['sd_over_cost']:.4f}" for k in MODES) + ' |')
    rows.append('| any-win / regular hit / sub-hit | ' + ' | '.join(f"{m[k]['any_win']*100:.2f}% / {m[k]['regular_hit']*100:.2f}% / {m[k]['sub_hit']*100:.2f}%" for k in MODES) + ' |')
    def trig(k, i, key):
        p = m[k][key]
        if k in TRIGGER:
            f = TRIGGER[k][i]
            return f'{f} ({one_in(f)})'
        if k == 'alarm_call':
            return f'share {round(p*300)}/300 = {p*100:.2f}%'
        return '1' if p == 1 else '—'
    rows.append('| Rescue Spins trigger | ' + ' | '.join(trig(k, 0, 'rescue_probability') for k in MODES) + ' |')
    rows.append('| Inferno trigger | ' + ' | '.join(trig(k, 1, 'inferno_probability') for k in MODES) + ' |')
    rows.append('| Backdraft rate | ' + ' | '.join(('every spin' if k == 'backdraft_spins' else f"{m[k]['backdraft_probability']:.7f}" if m[k]['backdraft_probability'] else '—') for k in MODES) + ' |')
    rows.append('| max win 20,000x | ' + ' | '.join(f"{m[k]['cap_probability']:.4e} ({one_in(Fraction(m[k]['cap_probability']).limit_denominator(10**12)) if m[k]['cap_probability'] else '—'})" for k in MODES) + ' |')
    rows.append('| etl10k / etl40b / cvar | ' + ' | '.join(f"{m[k]['etl10k']:.4f} / {m[k]['etl40b']:.4f} / {m[k]['cvar']:.2f}" for k in MODES) + ' |')
    rows.append('| actual simulation trials | ' + ' | '.join(f"{m[k]['simulation_trials']:,}" for k in MODES) + ' |')
    rows.append('| books / unique | ' + ' | '.join(f"{m[k]['publication_rows']:,} / {m[k]['unique_events']:,}" for k in MODES) + ' |')
    rows.append('| minimum weight | ' + ' | '.join(f"{m[k]['minimum_weight']:,}" for k in MODES) + ' |')
    print('\n'.join(rows))
    print()
    for b, v in r['banks'].items():
        print(f"bank {b}: trials {v['simulation_trials']:,}, organic mean {v['ordinary_unweighted_mean_x']:.4f}x, weighted target {v['weighted_target_mean_x']:.4f}x, cap {v['cap_probability_actual']:.3e}")
    print(f"total seconds {r['total_seconds']}, threads {r['threads']}, trials {r['total_independent_simulation_trials']:,}, rows {r['total_published_rows']:,}")


if __name__ == '__main__':
    main()
