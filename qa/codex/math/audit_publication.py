#!/usr/bin/env python3
"""Read-only independent audit of a COMPLETED Piggy Firefighters M3 publication.

No game/SDK/NumPy imports and no simulations. Integer moments and Fraction
arithmetic drive all statistics; LUTs, metadata and bank links are streamed.
A completed matching guard is required before the output directory is read.
Compressed event files are hash-checked, not replayed; canonical digest checks
use the completed bank report and per-row link manifests. Event legality and
uniqueness remain the frozen producer's separately recorded checks.
"""
import argparse
from array import array
from collections import defaultdict
import csv
from dataclasses import dataclass
from fractions import Fraction
import hashlib
from itertools import zip_longest
import json
import math
from pathlib import Path
import subprocess
import sys

COSTS = {'base': Fraction(1), 'ante': Fraction(3, 2), 'backdraft_spins': Fraction(50),
         'alarm_call': Fraction(12), 'rescue': Fraction(18), 'inferno': Fraction(90)}
BANK_BUDGET = 10**12
BASE_FACTORS = {('rescue', 10): 12600, ('rescue', 12): 1260, ('rescue', 15): 140,
                ('inferno', 10): 990, ('inferno', 12): 99, ('inferno', 15): 11}
ALARM_FACTORS = {('rescue', 10): 155, ('inferno', 10): 9}
CAP_WEIGHTS = {('rescue', 10): 1000000, ('inferno', 10): 4000000,
               ('rescue', 12): 147785136, ('inferno', 12): 147785136,
               ('rescue', 15): 600000000, ('inferno', 15): 600000000}
LINK_COLUMNS = ('published_id', 'bonus', 'starting_spins', 'bank_id',
                'canonical_event_sha256', 'bank_weight', 'factor', 'published_weight')
RUNTIME = {'python_version': [3, 12, 14], 'numpy': '2.2.5', 'scipy': '1.15.3', 'zstandard': '0.23.0'}


class AuditError(ValueError):
    """Refuse a candidate whose evidence is incomplete or inconsistent."""


def require(condition, message):
    if not condition:
        raise AuditError(message)


def load_json_snapshot(path):
    def reject_constant(value):
        raise AuditError(f'Nonfinite JSON number {value} in {path}')
    try:
        payload = Path(path).read_bytes()
        return json.loads(payload, parse_constant=reject_constant), hashlib.sha256(payload).hexdigest()
    except (OSError, json.JSONDecodeError) as exc:
        raise AuditError(f'Cannot read JSON {path}: {exc}') from exc


def load_json(path):
    return load_json_snapshot(path)[0]


def verify_evidence_snapshot(identities):
    for path, expected in identities.items():
        require(digest(path) == expected, f'Completion evidence changed during audit: {path}')


def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def same_number(actual, expected, label):
    require(not isinstance(expected, bool) and isinstance(expected, (int, float))
            and math.isfinite(expected), f'{label}: invalid reported number')
    require(math.isclose(float(actual), expected, rel_tol=1e-11, abs_tol=1e-13),
            f'{label}: computed {actual}, reported {expected}')


def integer(text, label):
    require(isinstance(text, str) and text.isascii() and text.isdecimal(), f'{label}: not an unsigned integer')
    return int(text)


@dataclass(frozen=True)
class Plan:
    main: int = 350000
    auxiliary: int = 10000
    natural: int = 200000

    def bank_count(self, spins):
        return self.main if spins == 10 else self.auxiliary

    @property
    def bank_rows(self):
        return 2 * self.main + 4 * self.auxiliary

    @property
    def rows(self):
        return {mode: self.natural + self.bank_rows if mode in ('base', 'ante') else
                2 * self.main + 1 if mode == 'alarm_call' else self.main for mode in COSTS}

    @property
    def trials(self):
        return 4 * self.main + 4 * self.auxiliary + 2 * self.natural


def preflight(output, guard_path, launch_path):
    # Guard first: neither stat nor open any path under output while incomplete.
    guard, guard_hash = load_json_snapshot(guard_path)
    require(guard.get('status') == 'COMPLETE' and guard.get('group_empty') is True
            and guard.get('command_exit_code') == 0, 'Matching memory guard must be COMPLETE, successful and group_empty')
    peak, limit = guard.get('peak_rss_mib'), guard.get('max_rss_mib')
    require(isinstance(peak, (int, float)) and math.isfinite(peak) and
            isinstance(limit, (int, float)) and math.isfinite(limit) and 0 <= peak < limit <= 5120,
            'Memory guard peak/limit is invalid or exceeds the approved threshold')
    launch, launch_hash = load_json_snapshot(launch_path)
    require(launch.get('process_group') == guard.get('pid') and isinstance(guard.get('pid'), int),
            'Memory guard belongs to a different launch process group')
    require(Path(launch.get('output', '')).resolve() == Path(output).resolve(), 'Launch output path mismatch')
    require(launch.get('rss_limit_mib') == limit, 'Launch/guard memory limit mismatch')
    report_path = Path(output) / 'report.json'
    report, report_hash = load_json_snapshot(report_path)
    require(report.get('candidate_status') == 'PASS' and report.get('source_unchanged') is True,
            'Completed PASS report with unchanged source is required')
    identities = {str(guard_path): guard_hash, str(launch_path): launch_hash, str(report_path): report_hash}
    return report, launch, guard, identities


def weight_rows(path):
    with Path(path).open(newline='') as stream:
        for row_id, fields in enumerate(csv.reader(stream)):
            require(len(fields) == 3, f'{path}:{row_id}: expected three LUT columns')
            book_id, weight, payout = (integer(value, str(path)) for value in fields)
            require(book_id == row_id, f'{path}: noncontiguous/duplicate book ID {book_id}, expected {row_id}')
            require(weight > 0, f'{path}:{row_id}: nonpositive weight')
            require(0 <= payout <= 1500000 and payout % 10 == 0, f'{path}:{row_id}: invalid payout denomination/cap')
            yield book_id, weight, payout


class ScalarStats:
    def __init__(self, cost, retain_payouts=False):
        self.cost = Fraction(cost)
        self.rows = self.total = self.moment1 = self.moment2 = 0
        self.minimum = None
        self.distribution = defaultdict(int)
        self.categories = defaultdict(int)
        self.payouts = array('I') if retain_payouts else None

    def add(self, weight, payout, route, backdraft):
        self.rows += 1
        self.total += weight
        self.moment1 += weight * payout
        self.moment2 += weight * payout * payout
        self.minimum = weight if self.minimum is None else min(weight, self.minimum)
        self.distribution[payout] += weight
        if self.payouts is not None:
            self.payouts.append(payout)
        if payout:
            self.categories['any_win'] += weight
            self.categories['regular_hit' if payout >= 100 * self.cost else 'sub_hit'] += weight
        if route in ('rescue', 'inferno'):
            self.categories[route + '_probability'] += weight
        if backdraft:
            self.categories['backdraft_probability'] += weight
        if payout == 1500000:
            self.categories['cap_probability'] += weight

    def exact(self):
        require(self.total > 0, 'Empty LUT')
        mean = Fraction(self.moment1, 100 * self.total) / self.cost
        variance = Fraction(self.moment2, 10000 * self.total) / self.cost**2 - mean**2
        require(variance >= 0, 'Negative exact variance')
        return mean, variance

    def probability(self, key):
        return Fraction(self.categories[key], self.total)

    def figures(self):
        mean, variance = self.exact()
        def mass_at_least(threshold, moment=False):
            return sum(weight * (payout if moment else 1) for payout, weight in self.distribution.items()
                       if payout >= threshold)
        cumulative, quantile = 0, 0
        for payout, weight in sorted(self.distribution.items()):
            cumulative += weight
            if cumulative * 1000 >= 999 * self.total:
                quantile = payout
                break
        tail_weight = mass_at_least(quantile)
        # Same inclusive quantile/tie convention as the SDK; no fractional trim.
        cvar = Fraction(mass_at_least(quantile, True), 100 * tail_weight) / self.cost
        scale = Fraction(1, 5) if self.cost >= 1000 else Fraction(1, 2) if self.cost >= 500 else Fraction(4, 5) if self.cost >= 200 else Fraction(1)
        return {'cost': float(self.cost), 'total_weight': self.total, 'minimum_weight': self.minimum,
                'rtp': float(mean), 'sd_over_cost': math.sqrt(float(variance)),
                **{key: float(self.probability(key)) for key in ('any_win', 'regular_hit', 'sub_hit',
                    'rescue_probability', 'inferno_probability', 'backdraft_probability', 'cap_probability')},
                'prob5k': float(Fraction(mass_at_least(500000), self.total) * scale),
                'prob10k': float(Fraction(mass_at_least(1000000), self.total) * scale),
                'etl10k': float(Fraction(mass_at_least(1000000, True), 100 * self.total)),
                'etl40b': float(Fraction(mass_at_least(4000 * self.cost, True), 100 * self.total)),
                'cvar': float(cvar)}


def mode_layout(mode, plan):
    if mode in ('base', 'ante'):
        ranges, end = [(plan.natural, 'none', None)], plan.natural
        for bonus, spins in BASE_FACTORS:
            end += plan.bank_count(spins)
            ranges.append((end, bonus, False))
        return ranges
    if mode == 'alarm_call':
        return [(1, 'falseAlarm', False), (1 + plan.main, 'rescue', False), (1 + 2 * plan.main, 'inferno', False)]
    return [(plan.main, mode if mode in ('rescue', 'inferno') else 'none', mode == 'backdraft_spins')]


def scan_lut(lut_path, metadata_path, cost, expected_rows, layout=None, retain_payouts=False):
    stats, section = ScalarStats(cost, retain_payouts), 0
    with Path(metadata_path).open(newline='') as stream:
        for lut, fields in zip_longest(weight_rows(lut_path), csv.reader(stream)):
            require(lut is not None and fields is not None and len(fields) == 4, f'{metadata_path}: row count/shape mismatch')
            book_id, weight, payout = lut
            require(integer(fields[0], 'metadata ID') == book_id, 'Metadata ID mismatch')
            require(integer(fields[1], 'metadata payout') == payout, 'Metadata payout mismatch')
            route, backdraft_text = fields[2:]
            require(route in ('none', 'rescue', 'inferno', 'falseAlarm') and backdraft_text in ('True', 'False'), 'Invalid metadata route/backdraft')
            backdraft = backdraft_text == 'True'
            if layout:
                while section < len(layout) and book_id >= layout[section][0]:
                    section += 1
                require(section < len(layout), 'Publication exceeds planned mode layout')
                _, expected_route, expected_backdraft = layout[section]
                require(route == expected_route and (expected_backdraft is None or backdraft == expected_backdraft),
                        f'Book {book_id}: route/backdraft differs from canonical publication layout')
            stats.add(weight, payout, route, backdraft)
    require(stats.rows == expected_rows, f'{lut_path}: {stats.rows} rows, expected {expected_rows}')
    return stats


def audit_links(output, mode, plan, bank_reports):
    factors = ALARM_FACTORS if mode == 'alarm_call' else {
        key: factor * (2 if mode == 'ante' else 1) for key, factor in BASE_FACTORS.items()}
    first = 1 if mode == 'alarm_call' else plan.natural
    published = weight_rows(output / f'lookUpTable_{mode}_0.csv')
    for _ in range(first):
        require(next(published, None) is not None, 'Missing nonbonus/false-alarm publication prefix')
    count, hashes = 0, {}
    with (output / f'bank_links_{mode}.csv').open(newline='') as stream:
        links = csv.DictReader(stream)
        require(tuple(links.fieldnames or ()) == LINK_COLUMNS, 'Unexpected canonical-link columns')
        for (bonus, spins), factor in factors.items():
            key, hasher, bank_count = f'{bonus}_{spins}', hashlib.sha256(), 0
            for bank_id, bank_weight, payout in weight_rows(output / 'banks' / f'weights_{bonus}_{spins}.csv'):
                row, actual = next(links, None), next(published, None)
                require(row is not None and actual is not None, 'Missing canonical publication link')
                published_id, weight, published_payout = actual
                require(published_id == first + count and integer(row['published_id'], 'linked publication ID') == published_id,
                        'Canonical link publication ID mismatch')
                require(row['bonus'] == bonus and integer(row['starting_spins'], 'spin class') == spins and
                        integer(row['bank_id'], 'linked bank ID') == bank_id, 'Canonical link source/class mismatch')
                require(integer(row['bank_weight'], 'linked bank weight') == bank_weight and
                        integer(row['factor'], 'linked factor') == factor and
                        integer(row['published_weight'], 'linked published weight') == weight == bank_weight * factor,
                        'Canonical link weight is not the actual bank weight times its factor')
                require(published_payout == payout, 'Canonical linked payout mismatch')
                value = row['canonical_event_sha256']
                require(len(value) == 64 and all(c in '0123456789abcdef' for c in value), 'Invalid canonical hash')
                hasher.update(bytes.fromhex(value))
                count += 1
                bank_count += 1
            require(bank_count == plan.bank_count(spins), 'Canonical bank row count mismatch')
            require(hasher.hexdigest() == bank_reports[key]['full_event_bank_sha256'], 'Canonical event digest differs from bank report')
            hashes[key] = hasher.hexdigest()
        require(next(links, None) is None and next(published, None) is None, 'Extra canonical links or publication rows')
    return {'rows': count, 'canonical_digests': hashes}


def verify_sources(repo, launch, report):
    repo = Path(repo).resolve()
    freeze = launch.get('freeze_sha', '')
    require(launch.get('freeze_tag') == 'math-freeze-v1' and len(freeze) == 40 and
            all(c in '0123456789abcdef' for c in freeze), 'Invalid frozen-source launch identity')
    def git(*arguments):
        return subprocess.check_output(['git', '-C', str(repo), *arguments], stderr=subprocess.PIPE)
    require(git('rev-parse', 'math-freeze-v1^{commit}').decode().strip() == freeze, 'Freeze tag differs from launch SHA')
    prefixes = ('math/games/piggy_firefighters', 'math/src', 'math/utils',
                'math/requirements.txt', 'math/requirements-production.lock')
    def included(path):
        prefix = 'math/games/piggy_firefighters/'
        if path.startswith(prefix):
            parts = path[len(prefix):].split('/')
            return (len(parts) == 1 and path.endswith('.py') or
                    len(parts) == 2 and parts[0] == 'reels' and path.endswith('.csv') or
                    len(parts) == 2 and parts[0] == 'tools' and path.endswith('.py'))
        return ((path.startswith('math/src/') or path.startswith('math/utils/')) and path.endswith('.py') or
                path in ('math/requirements.txt', 'math/requirements-production.lock'))
    frozen_paths = {p for p in git('ls-tree', '-r', '--name-only', freeze, '--', *prefixes).decode().splitlines() if included(p)}
    expected_keys = {p.removeprefix('math/') for p in frozen_paths}
    require(set(report.get('source_sha256', {})) == expected_keys, 'Report source-file set differs from freeze')
    current = set()
    game = repo / 'math/games/piggy_firefighters'
    for path in [*game.glob('*.py'), *(game / 'reels').glob('*.csv'), *(game / 'tools').glob('*.py'),
                 *(repo / 'math/src').rglob('*.py'), *(repo / 'math/utils').rglob('*.py'),
                 repo / 'math/requirements.txt', repo / 'math/requirements-production.lock']:
        if path.is_file():
            current.add(str(path.relative_to(repo)))
    require(current == frozen_paths, 'Current model/SDK input file set differs from freeze')
    for path in sorted(frozen_paths):
        frozen_hash = hashlib.sha256(git('show', f'{freeze}:{path}')).hexdigest()
        require(report['source_sha256'][path.removeprefix('math/')] == frozen_hash, f'Report source hash differs from freeze: {path}')
        require(digest(repo / path) == frozen_hash, f'Current frozen source bytes changed: {path}')
    for key, value in RUNTIME.items():
        require(report.get('runtime', {}).get(key) == value, f'Unsupported recorded runtime: {key}')
    require(Path(report['runtime']['executable']).resolve() == Path(launch['interpreter']).resolve(),
            'Launch/recorded interpreter mismatch')
    return {'freeze_sha': freeze, 'verified_source_files': len(frozen_paths)}


def verify_file(path, expected_hash, expected_size=None):
    actual = digest(path)
    require(actual == expected_hash, f'Hash mismatch: {path}')
    if expected_size is not None:
        require(Path(path).stat().st_size == expected_size, f'Byte-size mismatch: {path}')
    return actual


def audit_banks(output, plan, bank_reports):
    require(set(bank_reports) == {f'{bonus}_{spins}' for bonus, spins in BASE_FACTORS}, 'Canonical bank set mismatch')
    results = {}
    for bonus, spins in BASE_FACTORS:
        key = f'{bonus}_{spins}'
        stored = bank_reports[key]
        rows = total = cap = moment = organic = 0
        for book_id, weight, payout in weight_rows(output / 'banks' / f'weights_{key}.csv'):
            rows += 1
            total += weight
            moment += weight * payout
            if book_id:
                organic += payout
            if payout == 1500000:
                cap += weight
        require(rows == plan.bank_count(spins) and total == BANK_BUDGET, f'{key}: bank row/budget mismatch')
        require(cap == CAP_WEIGHTS[bonus, spins], f'{key}: canonical cap mass changed')
        for field in ('publication_rows', 'unique_events', 'simulation_trials'):
            require(stored.get(field) == rows, f'{key}: reported {field} mismatch')
        require(stored.get('ordinary_trials') == rows - 1 and stored.get('duplicate_events') == 0, f'{key}: bank trial/uniqueness report mismatch')
        same_number(Fraction(cap, total), stored.get('cap_probability_actual'), key + '.cap_probability_actual')
        require(round(Fraction(str(stored['cap_probability_target'])) * BANK_BUDGET) == cap, f'{key}: cap target does not round to published mass')
        require(math.isclose(float(Fraction(moment, 100 * total)), stored['weighted_target_mean_x'], rel_tol=2e-7, abs_tol=1e-8),
                f'{key}: weighted target mean did not close')
        same_number(Fraction(organic, 100 * (rows - 1)), stored['ordinary_unweighted_mean_x'], key + '.organic_mean')
        results[key] = {'rows': rows, 'total_weight': total, 'cap_weight': cap,
            'book_sha256': verify_file(output / 'banks' / f'books_{key}.jsonl.zst', stored['book_sha256'], stored['compressed_bytes']),
            'lut_sha256': verify_file(output / 'banks' / f'weights_{key}.csv', stored['lut_sha256'])}
    return results


def check_statistical_gates(mode, stats, figures):
    mean, variance = stats.exact()
    require(Fraction('0.9665') <= mean <= Fraction('0.9670'), f'{mode}: RTP outside contract')
    require(stats.distribution.get(1500000, 0) > 0, f'{mode}: no positive-weight capped outcome')
    for key, limit in {'etl10k': .8, 'etl40b': .9, 'cvar': 800, 'prob5k': .01, 'prob10k': .005}.items():
        require(math.isfinite(figures[key]) and 0 <= figures[key] <= limit, f'{mode}: {key} violates platform limit')
    for key in ('any_win', 'regular_hit', 'sub_hit', 'rescue_probability', 'inferno_probability', 'backdraft_probability', 'cap_probability'):
        require(0 <= stats.probability(key) <= 1, f'{mode}: invalid {key}')
    if mode in ('base', 'ante'):
        low, high = ('13.38', '15.44') if mode == 'base' else ('8.79', '10.14')
        require(Fraction(low)**2 <= variance <= Fraction(high)**2, f'{mode}: variance outside contract')
    if mode == 'base':
        for key, low, high in [('any_win', '.33', '.4'), ('regular_hit', '.12', '.18'), ('sub_hit', '.15', '1')]:
            require(Fraction(low) <= stats.probability(key) <= Fraction(high), f'base: {key} outside contract')


def audit_trials(output, plan, stored, payouts):
    path = output / 'trials_alarm_call.csv'
    counts, selected = defaultdict(int), bytearray(len(payouts))
    count = payout_sum = payout_square = 0
    with path.open(newline='') as stream:
        rows = csv.DictReader(stream)
        require(rows.fieldnames == ['trial_id', 'published_book_id', 'outcome', 'payout_x100'], 'Alarm trial columns changed')
        for row in rows:
            trial, book_id, payout = (integer(row[field], field) for field in ('trial_id', 'published_book_id', 'payout_x100'))
            require(trial == count and book_id < len(payouts), 'Alarm trial ID/publication ID invalid')
            route = 'falseAlarm' if book_id == 0 else 'rescue' if book_id <= plan.main else 'inferno'
            require(payout == payouts[book_id] and row['outcome'] == route, 'Alarm trial selected a mismatched payout/route')
            counts[route] += 1
            selected[book_id] = 1
            count += 1
            payout_sum += payout
            payout_square += payout * payout
    require(count == plan.main and stored['simulation_trials'] == count, 'Alarm actual trial count mismatch')
    require(dict(counts) == stored['trial_outcome_counts'] and sum(selected) == stored['distinct_trial_book_ids'], 'Alarm empirical route/distinct counts mismatch')
    same_number(Fraction(payout_sum, 100 * count), stored['empirical_trial_mean_x'], 'Alarm trial mean')
    same_number(Fraction(payout_square, 10000 * count), stored['empirical_trial_second_moment_x2'], 'Alarm trial second moment')
    return {'trials': count, 'distinct_selected_ids': sum(selected), 'outcomes': dict(counts),
            'sha256': verify_file(path, stored['trials_sha256'])}


def audit_publication(output, guard_path, launch_path, repo, plan=Plan()):
    output, guard_path, launch_path = Path(output).resolve(), Path(guard_path), Path(launch_path)
    report, launch, guard, identities = preflight(output, guard_path, launch_path)
    require(report.get('stage') == 'production', 'This audit requires the production report')
    for key, expected in [('main_trials_per_bonus', plan.main), ('auxiliary_trials_per_bank', plan.auxiliary),
                          ('nonbonus_trials_per_natural_mode', plan.natural), ('expected_trials', plan.trials),
                          ('expected_publication_rows', sum(plan.rows.values()))]:
        require(launch.get(key) == expected, f'Approved launch plan mismatch: {key}')
    for key, expected in [('main_simulation_trials_per_mode', plan.main), ('auxiliary_trials_per_bank', plan.auxiliary),
                          ('nonbonus_trials_per_natural_mode', plan.natural), ('total_independent_simulation_trials', plan.trials),
                          ('total_published_rows', sum(plan.rows.values()))]:
        require(report.get(key) == expected, f'Reported trial/publication count mismatch: {key}')
    require(report.get('threads') == launch.get('workers') == 2, 'Worker count differs from approved plan')
    require(set(report.get('modes', {})) == set(COSTS), 'Report mode set mismatch')
    source = verify_sources(repo, launch, report)
    index, index_hash = load_json_snapshot(output / 'index.json')
    identities[str(output / 'index.json')] = index_hash
    entries = index.get('modes', [])
    require(len(entries) == len(COSTS) and {r.get('name') for r in entries} == set(COSTS), 'Index mode set/duplicates mismatch')
    for row in entries:
        mode = row['name']
        require(Fraction(str(row['cost'])) == COSTS[mode] and row['events'] == f'books_{mode}.jsonl.zst'
                and row['weights'] == f'lookUpTable_{mode}_0.csv', f'{mode}: index cost/path mismatch')
    bank_results = audit_banks(output, plan, report['banks'])
    modes, exact, links, alarm_payouts = {}, {}, {}, None
    for mode, cost in COSTS.items():
        stored = report['modes'][mode]
        require(stored.get('weights_status') == 'PASS' and stored.get('platform_violations') == {}, f'{mode}: recorded gate is not PASS')
        expected = plan.rows[mode]
        for field in ('publication_rows', 'unique_events'):
            require(stored.get(field) == expected, f'{mode}: {field} differs from plan')
        require(stored.get('duplicate_events') == 0 and stored.get('simulation_trials') == (plan.natural if mode in ('base', 'ante') else plan.main),
                f'{mode}: duplicates or actual trial count mismatch')
        stats = scan_lut(output / f'lookUpTable_{mode}_0.csv', output / f'metadata_{mode}.csv', cost, expected,
                         mode_layout(mode, plan), retain_payouts=mode == 'alarm_call')
        figures = stats.figures()
        budget = BANK_BUDGET * (2310000 if mode in ('base', 'ante') else 300 if mode == 'alarm_call' else 1)
        require(stats.total == budget, f'{mode}: total integer-weight budget changed')
        for field, value in figures.items():
            if field in ('total_weight', 'minimum_weight'):
                require(stored.get(field) == value, f'{mode}.{field}: exact integer mismatch')
            else:
                same_number(value, stored.get(field), f'{mode}.{field}')
        check_statistical_gates(mode, stats, figures)
        mean, variance = stats.exact()
        exact[mode] = {key: stats.probability(key) for key in ('rescue_probability', 'inferno_probability', 'backdraft_probability', 'cap_probability')}
        modes[mode] = {'rows': stats.rows, 'computed': figures, 'exact_rtp': str(mean), 'exact_variance_over_cost': str(variance),
                      'book_sha256': verify_file(output / f'books_{mode}.jsonl.zst', stored['book_sha256'], stored['compressed_bytes']),
                      'lut_sha256': verify_file(output / f'lookUpTable_{mode}_0.csv', stored['lut_sha256'])}
        if mode in ('rescue', 'inferno'):
            bank = bank_results[f'{mode}_10']
            require(modes[mode]['book_sha256'] == bank['book_sha256'] and modes[mode]['lut_sha256'] == bank['lut_sha256'], f'{mode}: direct publication differs from canonical bank bytes')
        if mode in ('base', 'ante', 'alarm_call'):
            links[mode] = audit_links(output, mode, plan, report['banks'])
            expected_links = 2 * plan.main if mode == 'alarm_call' else plan.bank_rows
            require(links[mode]['rows'] == stored.get('shared_law_verified_rows') == expected_links, f'{mode}: canonical-link count mismatch')
            count_key = 'composed_bank_rows' if mode == 'alarm_call' else 'embedded_bank_rows'
            require(stored.get(count_key) == expected_links, f'{mode}: composition count mismatch')
            links[mode]['sha256'] = verify_file(output / f'bank_links_{mode}.csv', stored['bank_links_sha256'])
        if mode == 'alarm_call':
            alarm_payouts = stats.payouts
    for mode, factor in [('base', 1), ('ante', 2)]:
        require(exact[mode]['rescue_probability'] == Fraction(factor, 165) and exact[mode]['inferno_probability'] == Fraction(factor, 2100), f'{mode}: route probability changed')
        require(abs(exact[mode]['backdraft_probability'] - Fraction(1, 40)) <= Fraction(1, 10**8), f'{mode}: Backdraft target did not close')
        cap_mass = sum(BASE_FACTORS[key] * factor * CAP_WEIGHTS[key] for key in BASE_FACTORS)
        require(exact[mode]['cap_probability'] == Fraction(cap_mass, 2310000 * BANK_BUDGET), f'{mode}: canonical cap mixture changed')
    require(exact['alarm_call']['rescue_probability'] == Fraction(155, 300) and exact['alarm_call']['inferno_probability'] == Fraction(9, 300), 'Alarm route mixture changed')
    require(exact['alarm_call']['cap_probability'] == Fraction(155 * 1000000 + 9 * 4000000, 300 * BANK_BUDGET), 'Alarm cap mixture changed')
    for mode, cap in [('rescue', 1000000), ('inferno', 4000000), ('backdraft_spins', 4000000)]:
        require(exact[mode]['cap_probability'] == Fraction(cap, BANK_BUDGET), f'{mode}: cap mass changed')
    trials = audit_trials(output, plan, report['modes']['alarm_call'], alarm_payouts)
    verify_evidence_snapshot(identities)
    return {'status': 'PASS', 'output': str(output), 'source': source,
            'checked_trial_count': plan.trials, 'checked_publication_rows': sum(plan.rows.values()),
            'checked_canonical_links': sum(row['rows'] for row in links.values()),
            'modes': modes, 'banks': bank_results, 'links': links, 'alarm_trials': trials,
            'completion_evidence_sha256': identities, 'index_sha256': index_hash,
            'coverage': {'statistics': 'Independent exact integer/Fraction moments and scalar tail reductions',
                         'books': 'Compressed bytes hashed; event payloads not replayed',
                         'canonical_events': 'Ordered link digests compared to canonical bank report digests',
                         'event_legality_and_uniqueness': 'Producer evidence checked, not independently re-derived'}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--guard', type=Path, required=True)
    parser.add_argument('--launch', type=Path, required=True)
    parser.add_argument('--repo', type=Path, default=Path(__file__).resolve().parents[3])
    parser.add_argument('--audit-report', type=Path)
    args = parser.parse_args()
    try:
        result = audit_publication(args.output, args.guard, args.launch, args.repo)
    except (AuditError, OSError, KeyError, TypeError, ValueError, AttributeError, IndexError, csv.Error, subprocess.CalledProcessError) as exc:
        result = {'status': 'FAIL', 'error': str(exc)}
    if args.audit_report:
        require(not args.audit_report.resolve().is_relative_to(args.output.resolve()), 'Write audit evidence outside the immutable publication directory')
        args.audit_report.parent.mkdir(parents=True, exist_ok=True)
        args.audit_report.write_text(json.dumps(result, indent=2) + '\n')
        print(json.dumps({'status': result['status'], 'audit_report': str(args.audit_report),
                          **({'error': result['error']} if 'error' in result else {})}))
    else:
        print(json.dumps(result, indent=2))
    return 0 if result['status'] == 'PASS' else 1


if __name__ == '__main__':
    sys.exit(main())
