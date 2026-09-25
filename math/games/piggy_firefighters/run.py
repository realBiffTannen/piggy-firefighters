"""Bounded v1.2 shared-bank generation; simulation trials and publication rows differ.

PF_SIMS=10000 PF_AUX_SIMS=1000 PF_THREADS=2 PF_OUTPUT=<new directory> python run.py
Production requires the agreed tag and explicit counts; never overwrites outputs.
"""
import os
for _thread_env in ('OPENBLAS_NUM_THREADS', 'OMP_NUM_THREADS', 'MKL_NUM_THREADS', 'VECLIB_MAXIMUM_THREADS'):
    os.environ[_thread_env] = '1'
import bisect
import csv
import hashlib
import io
import json
import math
import random
import subprocess
import sys
import time
from collections import defaultdict, deque
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

MATH_ROOT = Path(__file__).resolve().parents[2]
if str(MATH_ROOT) not in sys.path:
    sys.path.insert(0, str(MATH_ROOT))
import zstandard as zstd
from games.piggy_firefighters.game_config import GameConfig, GAME_DIR, RTP_TARGET
from games.piggy_firefighters.gamestate import GameState
from games.piggy_firefighters.game_weights import solve_mode, solve_bank, solve_nonbonus, summarize, FitError
from games.piggy_firefighters.game_banks import (BANK_BUDGET, NATURAL_DENOMINATOR, ALARM_DENOMINATOR,
    ALARM_FACTORS, SPIN_CLASSES, natural_factors, bank_cap_probability, canonical_bonus_hash,
    trigger_prefix, wrap_bonus)
from utils.analysis.distribution_functions import get_etl_cvar_p5k_10k_vales

_STATE = None


def sha256_file(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def source_paths(game_dir=GAME_DIR):
    math_root = game_dir.parents[1]
    paths = sorted(game_dir.glob('*.py')) + sorted((game_dir / 'reels').glob('*.csv'))
    paths += sorted((game_dir / 'tools').glob('*.py'))
    paths += sorted((math_root / 'src').rglob('*.py')) + sorted((math_root / 'utils').rglob('*.py'))
    for name in ('requirements.txt', 'requirements-production.lock'):
        if (math_root / name).is_file():
            paths.append(math_root / name)
    return paths


def source_hashes():
    return {str(path.relative_to(MATH_ROOT)): sha256_file(path) for path in source_paths()}


def verify_frozen_sources(freeze, repo_root, game_dir):
    """Reject added, removed, ignored, untracked or changed source inputs vs tag."""
    repo_root, game_dir = Path(repo_root), Path(game_dir)
    math_root = game_dir.parents[1]
    prefixes = [game_dir, math_root / 'src', math_root / 'utils',
                math_root / 'requirements.txt', math_root / 'requirements-production.lock']
    tracked = subprocess.check_output(['git', '-C', str(repo_root), 'ls-tree', '-r', '--name-only',
            freeze, '--', *(str(p.relative_to(repo_root)) for p in prefixes)], text=True).splitlines()
    def included(relative):
        path = repo_root / relative
        return (path.parent == game_dir and path.suffix == '.py' or
                path.parent == game_dir / 'reels' and path.suffix == '.csv' or
                path.parent == game_dir / 'tools' and path.suffix == '.py' or
                path.is_relative_to(math_root / 'src') and path.suffix == '.py' or
                path.is_relative_to(math_root / 'utils') and path.suffix == '.py' or
                path in (math_root / 'requirements.txt', math_root / 'requirements-production.lock'))
    expected = {p for p in tracked if included(p)}
    actual = {str(p.relative_to(repo_root)): p for p in source_paths(game_dir)}
    if set(actual) != expected:
        raise ValueError(f'Freeze source path mismatch: added={sorted(set(actual)-expected)}, missing={sorted(expected-set(actual))}')
    hashes = {}
    for relative, path in actual.items():
        frozen = subprocess.check_output(['git', '-C', str(repo_root), 'show', f'{freeze}:{relative}'])
        expected_hash = hashlib.sha256(frozen).hexdigest()
        if sha256_file(path) != expected_hash:
            raise ValueError(f'Freeze source bytes changed: {relative}')
        hashes[relative] = expected_hash
    return hashes


def runtime_versions():
    return {'python': sys.version, 'python_version': list(sys.version_info[:3]), 'executable': sys.executable,
            'numpy': __import__('numpy').__version__, 'scipy': __import__('scipy').__version__,
            'zstandard': zstd.__version__}


def validate_runtime(runtime):
    expected = {'python_version': [3, 12, 14], 'numpy': '2.2.5', 'scipy': '1.15.3', 'zstandard': '0.23.0'}
    mismatch = {key: {'expected': value, 'actual': runtime.get(key)}
                for key, value in expected.items() if runtime.get(key) != value}
    if mismatch:
        raise ValueError(f'Use the project math/env pinned supported runtime: {mismatch}')


def worker_init():
    global _STATE
    _STATE = GameState(GameConfig())


def criterion_for(mode, index):
    if mode in ('base', 'ante'):
        if index == 0:
            return 'tail_max'
        if index <= 20:
            return 'tail'
        return 'backdraft' if index % 10 == 2 else 'plain'
    return 'cap' if index == 0 else 'ordinary'


def make_chunk(arguments):
    mode, first, last, spins = arguments
    return [_STATE.simulate(mode, index, criterion_for(mode, index), starting_spins=spins)
            for index in range(first, last)]


def stream_books(mode, count, threads, spins=10):
    chunks = iter((mode, first, min(first + 64, count), spins) for first in range(0, count, 64))
    if threads == 1:
        worker_init()
        for chunk in chunks:
            yield from make_chunk(chunk)
    else:
        with ProcessPoolExecutor(max_workers=threads, initializer=worker_init) as pool:
            pending = deque()
            for _ in range(threads * 2):
                chunk = next(chunks, None)
                if chunk is not None:
                    pending.append(pool.submit(make_chunk, chunk))
            while pending:
                yield from pending.popleft().result()
                chunk = next(chunks, None)
                if chunk is not None:
                    pending.append(pool.submit(make_chunk, chunk))


def read_books(path):
    with path.open('rb') as file, zstd.ZstdDecompressor().stream_reader(file) as reader:
        with io.TextIOWrapper(reader, encoding='utf-8') as text:
            for line in text:
                yield json.loads(line)


class FixtureCollector:
    def __init__(self, config, source):
        self.config, self.source = config, source
        self.found = {}

    def observe(self, mode, book):
        kinds = {e['type'] for e in book['events']}
        start = next((e for e in book['events'] if e['type'] == 'rescueStart'), None)
        names = []
        if mode == 'base':
            if not start and 'backdraft' not in kinds:
                names += ['base_nowin' if not book['payoutMultiplier'] else 'base_win']
            if 'backdraft' in kinds and book['payoutMultiplier']:
                names += ['base_backdraft_win']
            if start:
                names += ['base_trigger_' + start['bonus']]
            if not start and any(any(e.get('anticipation', [])) for e in book['events']):
                names += ['base_anticipation_miss']
        if mode == 'rescue':
            names += ['rescue_buy']
            if 'buildingCleared' in kinds:
                names += ['rescue_building_cleared']
            if book['payoutMultiplier'] == 1500000:
                names += ['max_win']
        if mode == 'inferno':
            names += ['inferno_buy']
            if any(e['type'] == 'douse' and e['rescues'] for e in book['events']):
                names += ['inferno_prizes']
        if mode == 'alarm_call':
            outcome = book['events'][0]['outcome']
            names += ['alarm_call_' + ('false' if outcome == 'falseAlarm' else outcome)]
        if mode == 'backdraft_spins':
            names += ['backdraft_spins']
            if book['payoutMultiplier'] == 1500000:
                names += ['backdraft_max_win']
        for name in names:
            # Ordinary presentation fixtures should not all show the forced cap.
            wants_cap = name in ('max_win', 'backdraft_max_win')
            if name not in self.found and (wants_cap or book['payoutMultiplier'] < 1500000):
                self.found[name] = (mode, book)

    def write(self):
        directory = GAME_DIR / 'fixtures'
        directory.mkdir(exist_ok=True)
        entries, provenance = [], {}
        for name, (mode, book) in sorted(self.found.items()):
            path = directory / f'{name}.json'
            path.write_text(json.dumps(book, indent=2) + '\n')
            entries.append({'name': name, 'mode': mode, 'cost': self.config.mode_costs[mode], 'file': path.name})
            start = next((e for e in book['events'] if e['type'] == 'rescueStart'), None)
            origin = {'type': 'direct_model_simulation', 'simulation_seed': book['id']}
            if start and start['source'] != 'buy':
                source_id = int(book['criteria'].rsplit('_', 1)[1])
                origin = {'type': 'canonical_bank_composition',
                          'bank_key': f'{start["bonus"]}_{start["spins"]}',
                          'source_book_id': source_id, 'source_simulation_seed': source_id,
                          'canonical_event_sha256': canonical_bonus_hash(book)}
                if start['source'] == 'natural':
                    origin['prefix'] = {'sampling_seed': source_id, 'mode': mode,
                        'reel_set': book['events'][0]['reelSet'],
                        'actual_stops': book['events'][0]['paddingPositions'],
                        'line_award_x100': 0}
            provenance[name] = {'mode': mode, 'publication_row_id': book['id'],
                                'criterion': book['criteria'], 'origin': origin,
                                'sha256': sha256_file(path)}
        (directory / 'index.json').write_text(json.dumps({'fixtures': entries}, indent=2) + '\n')
        (directory / 'source-record.json').write_text(json.dumps({'kind': 'actual_model_simulations_and_canonical_bank_compositions',
            'source_sha256': self.source, 'fixtures': provenance}, indent=2) + '\n')
        return [entry['name'] for entry in entries]


def verify_round(book):
    events = book['events']
    payout = book['payoutMultiplier']
    if payout % 10 or not 0 <= payout <= 1500000:
        raise AssertionError('Invalid payout denomination/cap')
    if events[-1]['type'] != 'finalWin' or events[-1]['amount'] != payout:
        raise AssertionError('Final payout mismatch')
    if sum(e['amount'] for e in events if e['type'] == 'setWin') != payout:
        raise AssertionError('Credited spin awards do not equal book payout')
    if [e['index'] for e in events] != list(range(len(events))):
        raise AssertionError('Event indices not contiguous')
    for event in events:
        if event['type'] == 'winInfo' and sum(w['win'] for w in event['wins']) != event['totalWin']:
            raise AssertionError('Line winInfo accounting mismatch')


class BookWriter:
    """Keep only compact records/fingerprints; event trees are streamed immediately."""
    def __init__(self, path, mode, fixtures=None):
        self.path, self.mode, self.fixtures = path, mode, fixtures
        self.file = path.open('wb')
        self.compressed = zstd.ZstdCompressor(level=6).stream_writer(self.file)
        self.records, self.fingerprints, self.duplicates = [], set(), 0
        self.started = time.monotonic()

    def add(self, book):
        verify_round(book)
        if book['id'] != len(self.records):
            raise AssertionError('Publication IDs must be distinct and contiguous')
        route = next((e['bonus'] for e in book['events'] if e['type'] == 'rescueStart'), 'none')
        if self.mode == 'alarm_call' and book['events'][0]['outcome'] == 'falseAlarm':
            route = 'falseAlarm'
        backdraft = any(e['type'] == 'backdraft' for e in book['events'])
        self.records.append((book['payoutMultiplier'], route, backdraft))
        fingerprint = hashlib.sha256(json.dumps(book['events'], sort_keys=True, separators=(',', ':')).encode()).digest()
        self.duplicates += fingerprint in self.fingerprints
        self.fingerprints.add(fingerprint)
        self.compressed.write(json.dumps(book, separators=(',', ':'), ensure_ascii=True).encode() + b'\n')
        if self.fixtures:
            self.fixtures.observe(self.mode, book)

    def close(self):
        self.compressed.close()
        return {'publication_rows': len(self.records), 'unique_events': len(self.fingerprints),
                'duplicate_events': self.duplicates, 'seconds': round(time.monotonic() - self.started, 3),
                'book_sha256': sha256_file(self.path), 'compressed_bytes': self.path.stat().st_size}


def write_lut(path, records, weights):
    if len(weights) != len(records) or min(weights) < 1:
        raise AssertionError('LUT must have one positive integer weight per book')
    with path.open('w', newline='') as file:
        csv.writer(file, lineterminator='\n').writerows((i, int(weight), records[i][0]) for i, weight in enumerate(weights))
    return sha256_file(path)


def publication_violations(mode, report):
    limits = {'rtp': .9670000001, 'etl10k': .8, 'etl40b': .9, 'cvar': 800, 'prob5k': .01, 'prob10k': .005}
    violations = {key: report[key] for key, limit in limits.items()
                  if not math.isfinite(report[key]) or report[key] > limit}
    for key in ('any_win', 'regular_hit', 'sub_hit', 'rescue_probability', 'inferno_probability',
                'backdraft_probability', 'cap_probability'):
        if not math.isfinite(report[key]) or not 0 <= report[key] <= 1:
            violations[key] = report[key]
    if not math.isfinite(report['sd_over_cost']) or report['sd_over_cost'] < 0:
        violations['sd_over_cost'] = report['sd_over_cost']
    if report['rtp'] < .9665:
        violations['rtp_below_floor'] = report['rtp']
    if mode in ('base', 'ante'):
        low, high = (13.38, 15.44) if mode == 'base' else (8.79, 10.14)
        if not low <= report['sd_over_cost'] <= high:
            violations['contract_sd'] = report['sd_over_cost']
    if mode == 'base':
        for key, low, high in [('any_win', .33, .4), ('regular_hit', .12, .18), ('sub_hit', .15, 1)]:
            if not low <= report[key] <= high:
                violations['contract_' + key] = report[key]
    return violations


def publication_report(mode, writer, weights, output, config, details=None):
    report = writer.close()
    report.update(summarize(writer.records, weights, config.mode_costs[mode]))
    lut = output / f'lookUpTable_{mode}_0.csv'
    report['lut_sha256'] = write_lut(lut, writer.records, weights)
    distribution = defaultdict(int)
    for record, weight in zip(writer.records, weights):
        distribution[record[0] / 100] += int(weight)
    p5k, p10k, etl10k, etl40, cvar = get_etl_cvar_p5k_10k_vales(dict(sorted(distribution.items())), config.mode_costs[mode])
    report.update(prob5k=p5k, prob10k=p10k, etl10k=etl10k, etl40b=etl40, cvar=cvar)
    report['platform_violations'] = publication_violations(mode, report)
    report['weights_status'] = 'PASS'
    report['fit'] = details or {}
    with (output / f'metadata_{mode}.csv').open('w', newline='') as file:
        csv.writer(file, lineterminator='\n').writerows((i, *record) for i, record in enumerate(writer.records))
    return report


def generate_bank(bonus, spins, count, threads, output, config, fixtures):
    path = output / 'banks' / f'books_{bonus}_{spins}.jsonl.zst'
    writer = BookWriter(path, bonus, fixtures if spins == 10 else None)
    hashes = []
    for book in stream_books(bonus, count, threads, spins):
        writer.add(book)
        hashes.append(bytes.fromhex(canonical_bonus_hash(book)))
    organic_mean = sum(r[0] / 100 for r in writer.records[1:]) / (count - 1)
    target = RTP_TARGET * config.mode_costs[bonus] if spins == 10 else organic_mean
    weights, fit = solve_bank(writer.records, target, bank_cap_probability(bonus, spins), BANK_BUDGET)
    report = writer.close()
    report.update(simulation_trials=count, ordinary_trials=count - 1,
                  ordinary_unweighted_mean_x=organic_mean, weighted_target_mean_x=target,
                  cap_probability_target=bank_cap_probability(bonus, spins), fit=fit,
                  full_event_bank_sha256=hashlib.sha256(b''.join(hashes)).hexdigest(),
                  cap_probability_actual=sum(int(w) for r, w in zip(writer.records, weights)
                                             if r[0] == 1500000) / BANK_BUDGET)
    lut = output / 'banks' / f'weights_{bonus}_{spins}.csv'
    report['lut_sha256'] = write_lut(lut, writer.records, weights)
    report['derived_buy_cost'] = organic_mean / config.rtp if spins == 10 else None
    print(json.dumps({'bank': f'{bonus}_{spins}', **report}), flush=True)
    return {'path': path, 'records': writer.records, 'weights': weights, 'hashes': hashes, 'report': report}


def publish_buy(bonus, bank, output, config, fixtures):
    writer = BookWriter(output / f'books_{bonus}.jsonl.zst', bonus)
    for book in read_books(bank['path']):
        writer.add(book)
    report = publication_report(bonus, writer, bank['weights'], output, config)
    report.update(simulation_trials=bank['report']['simulation_trials'],
                  ordinary_unweighted_mean_x=bank['report']['ordinary_unweighted_mean_x'],
                  derived_buy_cost=bank['report']['derived_buy_cost'], shared_bank=f'{bonus}_10')
    return report


def publish_backdraft(count, threads, output, config, fixtures):
    writer = BookWriter(output / 'books_backdraft_spins.jsonl.zst', 'backdraft_spins', fixtures)
    for book in stream_books('backdraft_spins', count, threads):
        writer.add(book)
    weights, figures = solve_mode('backdraft_spins', writer.records, config)
    ordinary_mean = sum(r[0] / 100 for r in writer.records[1:]) / (count - 1)
    report = publication_report('backdraft_spins', writer, weights, output, config, figures['fit'])
    report.update(simulation_trials=count, ordinary_unweighted_mean_x=ordinary_mean,
                  derived_buy_cost=ordinary_mean / config.rtp)
    return report


def publish_natural(mode, count, threads, banks, output, config, fixtures, state):
    writer = BookWriter(output / f'books_{mode}.jsonl.zst', mode, fixtures)
    for book in stream_books(mode, count, threads):
        writer.add(book)
    weights, fit = solve_nonbonus(mode, writer.records, banks, config)
    weights = [int(w) for w in weights]
    manifest_path = output / f'bank_links_{mode}.csv'
    verified = 0
    with manifest_path.open('w', newline='') as file:
        links = csv.writer(file, lineterminator='\n')
        links.writerow(('published_id', 'bonus', 'starting_spins', 'bank_id', 'canonical_event_sha256', 'bank_weight', 'factor', 'published_weight'))
        for (bonus, spins), factor in natural_factors(mode).items():
            bank = banks[bonus, spins]
            for i, source in enumerate(read_books(bank['path'])):
                book_id = len(writer.records)
                prefix = trigger_prefix(state, mode, bonus, spins, i)
                book = wrap_bonus(source, prefix, 'natural', book_id)
                fingerprint = canonical_bonus_hash(book)
                if bytes.fromhex(fingerprint) != bank['hashes'][i] or book['payoutMultiplier'] != source['payoutMultiplier']:
                    raise AssertionError('Natural wrapper changed canonical bonus law')
                weight = int(bank['weights'][i]) * factor
                weights.append(weight)
                writer.add(book)
                links.writerow((book_id, bonus, spins, i, fingerprint, int(bank['weights'][i]), factor, weight))
                verified += 1
    if sum(weights) != BANK_BUDGET * NATURAL_DENOMINATOR:
        raise AssertionError('Natural mixture budget changed')
    report = publication_report(mode, writer, weights, output, config, fit)
    report.update(simulation_trials=count, nonbonus_source_trials=count, embedded_bank_rows=verified,
                  shared_law_verified_rows=verified, bank_links_sha256=sha256_file(manifest_path))
    return report


def publish_alarm(count, banks, output, config, fixtures, state):
    writer = BookWriter(output / 'books_alarm_call.jsonl.zst', 'alarm_call', fixtures)
    false = state.simulate('alarm_call', 0, 'falseAlarm')
    writer.add(false)
    weights = [ALARM_FACTORS['falseAlarm'] * BANK_BUDGET]
    verified, route_ranges = 0, {}
    manifest_path = output / 'bank_links_alarm_call.csv'
    with manifest_path.open('w', newline='') as file:
        links = csv.writer(file, lineterminator='\n')
        links.writerow(('published_id', 'bonus', 'starting_spins', 'bank_id', 'canonical_event_sha256', 'bank_weight', 'factor', 'published_weight'))
        for bonus in ('rescue', 'inferno'):
            bank, factor = banks[bonus, 10], ALARM_FACTORS[bonus]
            route_ranges[bonus] = [len(writer.records), len(writer.records) + len(bank['records'])]
            for i, source in enumerate(read_books(bank['path'])):
                book_id = len(writer.records)
                book = wrap_bonus(source, [{'type': 'alarmCall', 'outcome': bonus}], 'alarmCall', book_id)
                fingerprint = canonical_bonus_hash(book)
                if bytes.fromhex(fingerprint) != bank['hashes'][i]:
                    raise AssertionError('Alarm Call wrapper changed canonical bonus law')
                weight = int(bank['weights'][i]) * factor
                weights.append(weight)
                writer.add(book)
                links.writerow((book_id, bonus, 10, i, fingerprint, int(bank['weights'][i]), factor, weight))
                verified += 1
    if sum(weights) != BANK_BUDGET * ALARM_DENOMINATOR:
        raise AssertionError('Alarm Call mixture budget changed')
    report = publication_report('alarm_call', writer, weights, output, config)
    cumulative, total = [], 0
    for weight in weights:
        total += weight
        cumulative.append(total)
    rng = random.Random(20260925)
    route_counts, selected_ids = defaultdict(int), set()
    payout_sum, payout_square = 0, 0
    trials_path = output / 'trials_alarm_call.csv'
    with trials_path.open('w', newline='') as file:
        trials = csv.writer(file, lineterminator='\n')
        trials.writerow(('trial_id', 'published_book_id', 'outcome', 'payout_x100'))
        for trial_id in range(count):
            book_id = bisect.bisect_right(cumulative, rng.randrange(total))
            payout, route, _ = writer.records[book_id]
            route_counts[route] += 1
            selected_ids.add(book_id)
            payout_sum += payout
            payout_square += payout * payout
            trials.writerow((trial_id, book_id, route, payout))
    report.update(simulation_trials=count, trial_method='IID integer-weight draws from the composed canonical event law',
                  trial_outcome_counts=dict(route_counts), distinct_trial_book_ids=len(selected_ids),
                  empirical_trial_mean_x=payout_sum / count / 100,
                  empirical_trial_second_moment_x2=payout_square / count / 10000,
                  composed_bank_rows=verified, shared_law_verified_rows=verified,
                  bank_links_sha256=sha256_file(manifest_path), trials_sha256=sha256_file(trials_path))
    return report


def main():
    runtime = runtime_versions()
    validate_runtime(runtime)
    count = int(os.environ.get('PF_SIMS', '10000'))
    auxiliary = int(os.environ.get('PF_AUX_SIMS', '1000'))
    natural = int(os.environ.get('PF_NATURAL_SIMS', '10000'))
    threads = int(os.environ.get('PF_THREADS', '2'))
    stage = os.environ.get('PF_STAGE', 'dev')
    if count < 100 or auxiliary < 100 or natural < 100 or threads not in (1, 2):
        raise SystemExit('Use counts>=100 and PF_THREADS=1 or2')
    if stage not in ('dev', 'production'):
        raise SystemExit('PF_STAGE must be dev or production')
    if stage == 'dev' and (count > 10000 or auxiliary > 1000 or natural > 10000):
        raise SystemExit('Dev generation is capped at10k main and1k auxiliary class trials')
    if stage == 'production':
        freeze = subprocess.check_output(['git', 'rev-parse', 'math-freeze-v1^{commit}'], text=True).strip()
        if os.environ.get('PF_FREEZE_SHA') != freeze:
            raise SystemExit('PF_FREEZE_SHA must equal the agreed math-freeze-v1 commit')
        if count != 350000 or any(key not in os.environ for key in ('PF_AUX_SIMS', 'PF_NATURAL_SIMS')):
            raise SystemExit('Production needs350k bonus trials and explicit approved PF_AUX_SIMS/PF_NATURAL_SIMS counts')
        verify_frozen_sources(freeze, MATH_ROOT.parent, GAME_DIR)
    if os.environ.get('PF_MODES'):
        raise SystemExit('Shared-bank generation publishes all six dependent modes together')
    config = GameConfig()
    state = GameState(config)
    output = Path(os.environ.get('PF_OUTPUT', str(GAME_DIR / 'library' / stage))).resolve()
    if output.exists() and any(output.iterdir()):
        raise SystemExit(f'Refusing to overwrite non-empty output: {output}')
    (output / 'banks').mkdir(parents=True, exist_ok=True)
    before, started = source_hashes(), time.monotonic()
    report = {'stage': stage, 'main_simulation_trials_per_mode': count, 'auxiliary_trials_per_bank': auxiliary,
              'nonbonus_trials_per_natural_mode': natural, 'threads': threads, 'source_sha256': before,
              'runtime': runtime, 'banks': {}, 'modes': {}}
    fixtures, banks = FixtureCollector(config, before), {}
    def checkpoint():
        (output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    for bonus in ('rescue', 'inferno'):
        for spins in SPIN_CLASSES:
            banks[bonus, spins] = generate_bank(bonus, spins, count if spins == 10 else auxiliary,
                                                threads, output, config, fixtures)
            report['banks'][f'{bonus}_{spins}'] = banks[bonus, spins]['report']
            checkpoint()
        report['modes'][bonus] = publish_buy(bonus, banks[bonus, 10], output, config, fixtures)
        checkpoint()
    report['modes']['backdraft_spins'] = publish_backdraft(count, threads, output, config, fixtures)
    checkpoint()
    report['modes']['alarm_call'] = publish_alarm(count, banks, output, config, fixtures, state)
    checkpoint()
    for mode in ('base', 'ante'):
        report['modes'][mode] = publish_natural(mode, natural, threads, banks, output, config, fixtures, state)
        checkpoint()
    report['source_unchanged'] = before == source_hashes()
    report['total_independent_simulation_trials'] = 4 * count + 2 * natural + 4 * auxiliary
    report['total_published_rows'] = sum(r['publication_rows'] for r in report['modes'].values())
    report['total_seconds'] = round(time.monotonic() - started, 3)
    checkpoint()
    failed = not report['source_unchanged'] or any(
        r['platform_violations'] or r['duplicate_events'] for r in report['modes'].values())
    if failed:
        report['candidate_status'] = 'FAIL'
        checkpoint()
        print(json.dumps({'candidate_status': 'FAIL', 'report': str(output / 'report.json')}), flush=True)
        return 1
    report['fixtures'] = fixtures.write()
    report['candidate_status'] = 'PASS'
    checkpoint()
    index = {'modes': [{'name': m, 'cost': config.mode_costs[m], 'events': f'books_{m}.jsonl.zst',
                       'weights': f'lookUpTable_{m}_0.csv'} for m in config.mode_costs]}
    (output / 'index.json').write_text(json.dumps(index, indent=2) + '\n')
    print(json.dumps({'summary': report['modes'], 'total_seconds': report['total_seconds']}), flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
