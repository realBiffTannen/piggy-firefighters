"""Shared full-event bonus law and exact integer publication mixtures (contract v1.2)."""
from copy import deepcopy
import hashlib
import json
import random
from src.state.books import Book
from .game_calculations import evaluate_lines

BANK_BUDGET = 10**12
NATURAL_DENOMINATOR = 2_310_000
ALARM_DENOMINATOR = 300
ALARM_FACTORS = {'rescue': 155, 'inferno': 9, 'falseAlarm': 136}
SPIN_CLASSES = (10, 12, 15)


def natural_factors(mode):
    """90/9/1 starting-class shares; ante doubles each exact natural rate."""
    if mode not in ('base', 'ante'):
        raise ValueError(mode)
    factor = 1 if mode == 'base' else 2
    return {key: value * factor for key, value in {
        ('rescue', 10): 12600, ('rescue', 12): 1260, ('rescue', 15): 140,
        ('inferno', 10): 990, ('inferno', 12): 99, ('inferno', 15): 11}.items()}


def bank_cap_probability(bonus, spins):
    """Natural cap rate derives from the common longer-start banks, never a wrapper tilt."""
    if spins == 10:
        return 1e-6 if bonus == 'rescue' else 4e-6
    if spins == 15:
        return .0006
    rescue, inferno = 1 / 165, 1 / 2100
    return (1 / 7_500_000 - .9 * (rescue * 1e-6 + inferno * 4e-6)
            - .01 * (rescue + inferno) * .0006) / (.09 * (rescue + inferno))


def canonical_bonus_hash(book):
    """Hash every bonus event, normalizing only wrapper source and event index."""
    start = next(i for i, event in enumerate(book['events']) if event['type'] == 'rescueStart')
    events = deepcopy(book['events'][start:])
    for event in events:
        event.pop('index', None)
        if event['type'] == 'rescueStart':
            event['source'] = 'canonical'
    return hashlib.sha256(json.dumps(events, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def trigger_prefix(state, mode, bonus, spins, seed):
    """Sample a genuine zero-line-win alarm window so bonus cap headroom is unchanged."""
    count = {10: 3, 12: 4, 15: 5}[spins]
    digest = hashlib.sha256(f'pf-prefix-v1:{mode}:{bonus}:{spins}:{seed}'.encode()).digest()
    state.rng = random.Random(int.from_bytes(digest[:16], 'big'))
    reel_set = 'BR0' if mode == 'base' else 'BRA'
    buckets = state.stop_buckets[reel_set]
    for _ in range(256):
        alarm_reels = set(state.rng.sample(range(5), count))
        golden = state.rng.choice(sorted(alarm_reels)) if bonus == 'inferno' else None
        stops = [state.rng.choice(buckets[r]['golden' if r == golden else
                    'alarm' if r in alarm_reels else 'none']) for r in range(5)]
        state.book = Book(seed, f'trigger_{bonus}_{spins}')
        state.reveal(reel_set, stops, 'basegame')
        if evaluate_lines(state.board_names, state.config.paylines)['totalWin'] == 0:
            positions = [{'reel': r, 'row': row + 1} for r, reel in enumerate(state.board_names)
                         for row, symbol in enumerate(reel) if symbol in ('ALARM', 'GALARM')]
            if len(positions) != count:
                raise AssertionError('Trigger prefix has the wrong actual alarm count')
            state.emit('setTotalWin', amount=0)
            state.emit('freeSpinTrigger', totalFs=spins, positions=positions)
            return deepcopy(state.book.events)
    raise RuntimeError('Zero-win trigger sampling exhausted its integrity guard')


def wrap_bonus(bank, prefix, source, book_id):
    result = deepcopy(bank)
    result['id'] = book_id
    result['criteria'] = f'bank_{source}_{bank["id"]}'
    result['events'] = deepcopy(prefix) + result['events']
    for i, event in enumerate(result['events']):
        event['index'] = i
        if event['type'] == 'rescueStart':
            event['source'] = source
    return result
