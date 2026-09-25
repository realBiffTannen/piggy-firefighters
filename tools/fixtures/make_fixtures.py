#!/usr/bin/env python3
"""PIGGY FIREFIGHTERS — hand-authored DEV fixture books for the mock RGS (server/fixtures/).

These are NOT math books. They are small, deterministic, HONEST books written by the frontend lane so every
presentation path can be exercised before the math lane publishes (docs/GAME_CONTRACT.md v1.2.2 §8 shapes; event order, anticipation and winLevel as the frozen math's game_events.py / game_executables.py):

  * every line win is EVALUATED from the board with the contract's rules (§3: 20 lines, left to right, W substitutes
    and pays as H1 on its own, highest win per line) — never typed;
  * every douse / rescue / multiplier / spin count is SIMULATED from the bonus boards with the §5/§6 rules;
  * reveal boards are 5 reels x 5 rows (padded row 0 and 4); winInfo / freeSpinTrigger positions are PADDED (+1 row);
    custom events (backdraft, douse, rescueStart rooms) are 0-based visible rows (contract §8);
  * amounts are integers x100 of the base bet; the cap is 15,000x (wincap event, capped meters).

Run:  python3 tools/fixtures/make_fixtures.py   (writes server/fixtures/*.json + index.json; deterministic)
"""
import json
import os
import random

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'server', 'fixtures')
CAP = 15000
# the FROZEN math's mode costs (math-freeze-v1, math/games/piggy_firefighters/game_config.py MODE_COSTS; contract §2)
COSTS = {'base': 1.0, 'ante': 1.5, 'alarm_call': 12.0, 'rescue': 18.0, 'backdraft_spins': 50.0, 'inferno': 90.0}

PAYLINES = [
    [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
    [0, 0, 1, 0, 0], [2, 2, 1, 2, 2], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [0, 1, 1, 1, 0],
    [2, 1, 1, 1, 2], [1, 0, 1, 0, 1], [1, 2, 1, 2, 1], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2],
    [1, 1, 0, 1, 1], [1, 1, 2, 1, 1], [0, 0, 2, 0, 0], [2, 2, 0, 2, 2], [0, 2, 0, 2, 0],
]
PAYTABLE = {
    'H1': {3: 1.5, 4: 5, 5: 25}, 'H2': {3: 1, 4: 3, 5: 12}, 'H3': {3: 0.6, 4: 2, 5: 8}, 'H4': {3: 0.5, 4: 1.5, 5: 5},
    'L1': {3: 0.3, 4: 0.8, 5: 2.5}, 'L2': {3: 0.2, 4: 0.6, 5: 2}, 'L3': {3: 0.2, 4: 0.5, 5: 1.5}, 'L4': {3: 0.1, 4: 0.4, 5: 1.2},
    'W': {3: 1.5, 4: 5, 5: 25},
}
PAYERS = ['H1', 'H2', 'H3', 'H4', 'L1', 'L2', 'L3', 'L4']
PAYER_W = [3, 4, 5, 6, 9, 10, 11, 12]
SCATTERS = ('ALARM', 'GALARM')


def x100(v):
    return int(round(v * 100))


def sym(name):
    s = {'name': name}
    if name == 'W':
        s['wild'] = True
    if name in SCATTERS:
        s['scatter'] = True
    return s


def std_level(x):
    for lvl, (lo, hi) in {1: (0, 0.1), 2: (0.1, 1), 3: (1, 2), 4: (2, 5), 5: (5, 15), 6: (15, 30), 7: (30, 50), 8: (50, 100), 9: (100, CAP)}.items():
        if lo <= x < hi:
            return lvl
    return 10


def end_level(x):
    for lvl, (lo, hi) in {1: (0, 1), 2: (1, 5), 3: (5, 10), 4: (10, 20), 5: (20, 50), 6: (50, 100), 7: (100, 500), 8: (500, 2000), 9: (2000, CAP)}.items():
        if lo <= x < hi:
            return lvl
    return 10


def evaluate(board, mult=1, blaze=None):
    """SDK lines algorithm (math/src/calculations/lines.py) on a visible board[reel][row]. Returns (total_x, wins).
    `blaze` maps (reel, row) -> Blaze Wild multiplier (contract v1.1 §7, Backdraft Spins only): a line's win is
    multiplied by the SUM of the multipliers of the Blaze Wilds it uses (x1 when it uses none)."""
    blaze = blaze or {}
    wins = []
    total = 0.0
    for li, line in enumerate(PAYLINES, start=1):
        first = board[0][line[0]]
        wild_run = first == 'W'
        first_non_wild = None if wild_run else first
        wild_matches = 1 if wild_run else 0
        matches = 0 if wild_run else 1
        for reel in range(1, 5):
            s = board[reel][line[reel]]
            if first_non_wild is not None:
                if s == first_non_wild or s == 'W':
                    matches += 1
                else:
                    break
            else:
                if s == 'W':
                    wild_matches += 1
                else:
                    first_non_wild = s
                    matches += 1
        wild_win = PAYTABLE['W'].get(wild_matches, 0) if wild_matches else 0
        base_win = PAYTABLE.get(first_non_wild, {}).get(wild_matches + matches, 0) if first_non_wild else 0
        if base_win <= 0 and wild_win <= 0:
            continue
        if wild_win > base_win:
            kind, symbol, base = wild_matches, 'W', wild_win
        else:
            kind, symbol, base = wild_matches + matches, first_non_wild, base_win
        line_mult = sum(blaze.get((r, line[r]), 0) for r in range(kind)) or 1
        win = base * mult * line_mult
        total += win
        wins.append({
            'symbol': symbol, 'kind': kind, 'win': win,
            'positions': [{'reel': r, 'row': line[r]} for r in range(kind)],
            'meta': {'lineIndex': li, 'multiplier': mult * line_mult, 'winWithoutMult': base, 'globalMult': mult, 'lineMultiplier': line_mult},
        })
    return total, wins


class Book:
    def __init__(self, mode, criteria, description):
        self.mode, self.criteria, self.description = mode, criteria, description
        self.events = []
        self.total = 0.0  # running round total, x bet
        self.base_wins = 0.0
        self.free_wins = 0.0
        self.capped = False

    def add(self, type_, **payload):
        self.events.append({'index': len(self.events), 'type': type_, **payload})

    def reveal(self, board, pads, game_type='basegame', anticipation=None, reel_set=None):
        padded = [[sym(pads[r][0])] + [sym(s) for s in board[r]] + [sym(pads[r][1])] for r in range(5)]
        if reel_set is None:
            reel_set = {'ante': 'BRA', 'backdraft_spins': 'BRB'}.get(self.mode, 'BR0') if game_type == 'basegame' or self.mode == 'backdraft_spins' else 'FR0'
        # anticipation: the math's binary array (game_events.py reveal) — computed from the board unless given
        self.add('reveal', board=padded, paddingPositions=[random.randint(0, 80) for _ in range(5)], gameType=game_type,
                 anticipation=anticipation if anticipation is not None else (anticipation_for(board) if game_type == 'basegame' else [0] * 5),
                 reelSet=reel_set)

    def headroom(self):
        return max(0.0, CAP - self.total)

    def line_wins(self, board, mult=1, extra=0.0, free=False, blaze=None):
        """winInfo (+ wincap) + setWin for one spin's line wins; `extra` = instant prizes of this spin (x bet), already
        clipped by the caller. CAP CLIPPING (contract v1.1 §6): every amount written is clipped to the remaining headroom
        under 15,000x, in book order, so the client only ever adds what the book says."""
        total, wins = evaluate(board, mult, blaze)
        raw = total + extra
        room = self.headroom() - extra
        clipped = []
        for w in wins:
            amount = min(w['win'], max(0.0, room))
            room -= amount
            clipped.append((w, amount))
        total = sum(a for _, a in clipped)
        spin = total + extra
        if wins:
            self.add('winInfo', totalWin=x100(total), wins=[
                {**w, 'win': x100(a), 'positions': [{'reel': p['reel'], 'row': p['row'] + 1} for p in w['positions']],
                 'meta': {**w['meta'], 'winWithoutMult': x100(w['meta']['winWithoutMult'])}} for w, a in clipped])
        if self.total + raw >= CAP and not self.capped:
            self.capped = True
            self.add('wincap', amount=CAP * 100)
        if spin > 0:
            # like the math (game_events.py): the level of the CREDITED (capped) amount, never of the raw win
            self.add('setWin', amount=x100(spin), winLevel=std_level(spin))
        self.total += spin
        if free:
            self.free_wins += spin
        else:
            self.base_wins += spin
        return total

    def set_total(self):
        self.add('setTotalWin', amount=x100(min(self.total, CAP)))

    def final(self):
        amount = x100(min(self.total, CAP))
        self.add('finalWin', amount=amount)
        return {'id': 1, 'payoutMultiplier': amount, 'events': self.events, 'criteria': self.criteria,
                'baseGameWins': round(min(self.base_wins, CAP), 2), 'freeGameWins': round(min(self.free_wins, CAP) if not self.capped else max(0, CAP - self.base_wins), 2)}


def rnd_payer(rng):
    return rng.choices(PAYERS, PAYER_W)[0]


def pads_for(rng, wilds=False):
    pool = PAYERS + (['W'] if wilds else [])
    return [[rng.choice(pool), rng.choice(pool)] for _ in range(5)]


def anticipation_for(board):
    """The math's binary anticipation (math/games/piggy_firefighters/game_events.py reveal): reel r is held when two or
    more alarms already show on the reels before it."""
    out, count = [0] * 5, 0
    for r in range(5):
        if count >= 2:
            out[r] = 1
        count += sum(1 for s in board[r] if s in SCATTERS)
    return out


def alarm_count(board):
    return sum(1 for reel in board for s in reel if s in SCATTERS)


def base_board(rng, w_prob=0.06, alarm_prob=0.0):
    b = []
    for r in range(5):
        col = []
        for _ in range(3):
            x = rng.random()
            if x < w_prob:
                col.append('W' if r > 0 else rnd_payer(rng))  # no W on reel 1 in base / ante / BRB (contract §3)
            elif x < w_prob + alarm_prob:
                col.append('ALARM')
            else:
                col.append(rnd_payer(rng))
        b.append(col)
    return b


def search(pred, make, seed0=1, tries=200000):
    for seed in range(seed0, seed0 + tries):
        rng = random.Random(seed)
        cand = make(rng)
        if pred(cand):
            return cand
    raise RuntimeError('no candidate found')


# ---------------------------------------------------------------------------------------------- bonus sim
def play_bonus(book, bonus, spins, boards):
    """Simulate Rescue / Inferno over the given freegame boards (list of visible boards); returns nothing.
    Emits updateFreeSpin, reveal, douse, buildingCleared, winInfo/setWin, setTotalWin per spin."""
    start = 1 if bonus == 'inferno' else 2
    step = 2 if bonus == 'inferno' else 1
    prizes = [5, 10, 20, 50, 100]
    prng = random.Random(4242)
    fire = [start] * 5
    mult = 1
    total_spins = spins
    played = 0
    rescued_total = 0
    buildings = 0
    it = iter(boards)
    while played < total_spins and not book.capped:
        board = next(it)
        played += 1
        book.reveal(board, pads_for(random.Random(played * 7), wilds=True), game_type='freegame',
                    reel_set='FRI' if bonus == 'inferno' else 'FR0')
        sprays, rescues = [], []
        prize_x = 0.0
        for r in range(5):
            k = sum(1 for s in board[r] if s == 'W')
            if k == 0 or fire[r] <= 0:
                continue
            to = max(0, fire[r] - k)
            sprays.append({'reel': r, 'from': fire[r], 'to': to})
            fire[r] = to
            if to == 0:
                entry = {'reel': r}
                if bonus == 'inferno':
                    p = prng.choices(prizes, [50, 30, 14, 5, 1])[0]
                    p = min(p, max(0.0, book.headroom() - prize_x))  # contract v1.1 §6 cap clipping
                    entry['prize'] = x100(p)
                    prize_x += p
                rescues.append(entry)
        mult += step * len(rescues)
        total_spins += len(rescues)
        rescued_total += len(rescues)
        spins_left = total_spins - played
        book.add('douse', sprays=sprays, rescues=rescues, multiplier=mult, spinsAdded=len(rescues), spinsLeft=spins_left)
        if all(f == 0 for f in fire):
            buildings += 1
            total_spins += 5
            fire = [start] * 5
            book.add('buildingCleared', building=buildings, spinsAdded=5, spinsLeft=total_spins - played)
        book.line_wins(board, mult, extra=prize_x, free=True)
        # math order (game_executables.py): ... setWin -> updateFreeSpin {amount: played, total: played + left} -> setTotalWin
        book.add('updateFreeSpin', amount=played, total=total_spins)
        book.set_total()
    book.add('rescueEnd', amount=x100(min(book.free_wins, CAP)), multiplier=mult, rescued=rescued_total, buildings=buildings)
    fs = min(book.free_wins, CAP - min(book.base_wins, CAP))
    book.add('freeSpinEnd', amount=x100(fs), winLevel=10 if book.capped else end_level(fs))
    return {'rescued': rescued_total, 'buildings': buildings, 'mult': mult, 'spins': played}


def free_board(rng, w_prob):
    return [[('W' if rng.random() < w_prob else rnd_payer(rng)) for _ in range(3)] for _ in range(5)]


def bonus_boards(seed, w_prob, n=400):
    rng = random.Random(seed)
    return [free_board(rng, w_prob) for _ in range(n)]


def find_bonus(bonus, spins, w_prob, pred, seed0=100):
    for seed in range(seed0, seed0 + 5000):
        probe = Book('probe', '', '')
        stats = play_bonus(probe, bonus, spins, bonus_boards(seed, w_prob))
        if pred(stats, probe):
            return seed
    raise RuntimeError('no bonus seed')


# ------------------------------------------------------------------------------------------------ books
def base_nowin():
    b = Book('base', 'basegame', 'Base spin: no line win, one alarm, no Backdraft')
    board = search(lambda bd: evaluate(bd)[0] == 0 and alarm_count(bd) == 1, lambda rng: base_board(rng, 0.05, 0.05), 11)
    b.reveal(board, pads_for(random.Random(1)))
    b.set_total()
    return b.final()


def base_win():
    b = Book('base', 'basegame', 'Base spin: exactly two line wins (sequential line presentation, then both together)')
    board = search(lambda bd: len(evaluate(bd)[1]) == 2 and alarm_count(bd) == 0 and 1.0 <= evaluate(bd)[0] < 5,
                   lambda rng: base_board(rng, 0.08), 21)
    b.reveal(board, pads_for(random.Random(2)))
    b.line_wins(board)
    b.set_total()
    return b.final()


def base_backdraft_win():
    b = Book('base', 'basegame', 'Base spin with a Backdraft: 3 cells ignite into Blaze Wilds; line wins on the post-Backdraft board use them')

    def make(rng):
        bd = base_board(rng, 0.03)
        cells = []
        free = [(r, row) for r in range(5) for row in range(3) if bd[r][row] not in ('W',) + SCATTERS]
        count = rng.choices([2, 3, 4, 5], [45, 35, 15, 5])[0]
        cells = rng.sample(free, count)
        post = [list(c) for c in bd]
        for r, row in cells:
            post[r][row] = 'W'
        return bd, cells, post

    def ok(c):
        bd, cells, post = c
        if evaluate(bd)[0] != 0 or alarm_count(bd) > 1:
            return False
        tot, wins = evaluate(post)
        ignited = {(r, row) for r, row in cells}
        uses = any((p['reel'], p['row']) in ignited for w in wins for p in w['positions'])
        return uses and 1.0 <= tot <= 12 and len(wins) >= 1
    bd, cells, post = search(ok, make, 31)
    b.reveal(bd, pads_for(random.Random(3)))
    b.add('backdraft', cells=[{'reel': r, 'row': row} for r, row in sorted(cells)], count=len(cells))
    b.line_wins(post)
    b.set_total()
    return b.final()


def trigger_board(rng, golden):
    bd = base_board(rng, 0.04)
    reels = rng.sample(range(5), 3)
    for i, r in enumerate(sorted(reels)):
        bd[r][rng.randrange(3)] = 'GALARM' if golden and i == 1 else 'ALARM'
    return bd


def natural_bonus(name, golden, bonus_pred, w_prob, description, seed0=100, spins_boards=None):
    b = Book('base', 'freegame', description)
    board = search(lambda bd: alarm_count(bd) == 3 and 0 < evaluate(bd)[0] < 3 and ('GALARM' in sum(bd, [])) == golden,
                   lambda rng: trigger_board(rng, golden), 51 if not golden else 61)
    b.reveal(board, pads_for(random.Random(5)), anticipation=anticipation_for(board))
    b.line_wins(board)
    b.set_total()
    positions = [{'reel': r, 'row': row + 1} for r in range(5) for row in range(3) if board[r][row] in SCATTERS]
    bonus = 'inferno' if golden else 'rescue'
    b.add('freeSpinTrigger', totalFs=10, positions=positions)
    b.add('rescueStart', bonus=bonus, source='natural', spins=10, rooms=[{'reel': r, 'fire': 1 if golden else 2} for r in range(5)], multiplier=1)
    boards = spins_boards or bonus_boards(find_bonus(bonus, 10, w_prob, bonus_pred, seed0), w_prob)
    play_bonus(b, bonus, 10, boards)
    return b.final()


def bought_bonus(mode, bonus, source, pred, w_prob, description, seed0=300, alarm_outcome=None):
    b = Book(mode, 'freegame', description)
    if alarm_outcome:
        b.add('alarmCall', outcome=alarm_outcome)
    b.add('rescueStart', bonus=bonus, source=source, spins=10, rooms=[{'reel': r, 'fire': 1 if bonus == 'inferno' else 2} for r in range(5)], multiplier=1)
    play_bonus(b, bonus, 10, bonus_boards(find_bonus(bonus, 10, w_prob, pred, seed0), w_prob))
    return b.final()


def ante_win():
    b = Book('ante', 'basegame', 'ALARM BOOST spin (reel set BRA): one line win that returns less than the 1.5x stake (tier 0: no celebration)')
    board = search(lambda bd: len(evaluate(bd)[1]) == 1 and alarm_count(bd) == 1 and 0.5 <= evaluate(bd)[0] <= 1.5,
                   lambda rng: base_board(rng, 0.06, 0.03), 41)
    b.reveal(board, pads_for(random.Random(4)))
    b.line_wins(board)
    b.set_total()
    return b.final()


def alarm_call_false():
    b = Book('alarm_call', 'falseAlarm', 'Alarm Call that turns out a False Alarm: nothing is awarded')
    b.add('alarmCall', outcome='falseAlarm')
    b.set_total()
    return b.final()


def backdraft_spins():
    b = Book('backdraft_spins', 'freegame', 'Backdraft Spins: 5 spins, a Backdraft of 3-5 multiplier Blaze Wilds (x2-x10, summed along a line) on every spin')
    b.add('backdraftSpinsStart', spins=5)
    rng = random.Random(77)
    for spin in range(1, 6):
        bd = base_board(rng, 0.03)
        free = [(r, row) for r in range(5) for row in range(3) if bd[r][row] != 'W']
        cells = sorted(rng.sample(free, rng.choices([3, 4, 5], [50, 35, 15])[0]))
        mults = {c: rng.choices([2, 3, 5, 10], [60, 30, 8, 2])[0] for c in cells}
        post = [list(c) for c in bd]
        for r, row in cells:
            post[r][row] = 'W'
        b.reveal(bd, pads_for(rng), game_type='freegame')
        b.add('backdraft', cells=[{'reel': r, 'row': row, 'mult': mults[(r, row)]} for r, row in cells], count=len(cells))
        b.line_wins(post, free=True, blaze=mults)
        b.add('updateFreeSpin', amount=spin, total=5)
        b.set_total()
    b.add('backdraftSpinsEnd', amount=x100(min(b.total, CAP)))
    return b.final()


def max_win():
    """Natural Inferno trigger that reaches the 15,000x cap: three spins with a WILD on every reel clear three buildings
    (every rescue +2x: multiplier x1 -> x31, plus instant prizes), then a board of fifteen WILDs rescues a fourth building
    (x41) and pays 20 lines x 25x x 41 = 20,500x: the round is capped at 15,000x (wincap) and the bonus ends."""
    rng = random.Random(9)
    full_w = [['W', 'W', 'W'] for _ in range(5)]

    def one_w_per_reel(seed):
        r = random.Random(seed)
        bd = [[rnd_payer(r) for _ in range(3)] for _ in range(5)]
        rows = [0, 2, 0, 2, 1]  # a zig-zag of single WILDs: no WILD line of 3+
        for reel in range(5):
            bd[reel][rows[reel]] = 'W'
        return bd
    boards = [one_w_per_reel(1), one_w_per_reel(2), one_w_per_reel(3), full_w] + bonus_boards(5, 0.1)
    del rng
    return natural_bonus('max_win', True, None, 0.1, 'Natural Inferno Rescue that hits the 15,000x cap (wincap, capped meters, MAX WIN)', spins_boards=boards)


FIXTURES = [
    ('base_nowin', base_nowin),
    ('base_win', base_win),
    ('base_backdraft_win', base_backdraft_win),
    ('ante_win', ante_win),
    ('base_trigger_rescue', lambda: natural_bonus('base_trigger_rescue', False,
                                                  lambda s, bk: s['rescued'] == 1 and sum(1 for e in bk.events if e['type'] == 'douse' and e['sprays']) >= 4 and s['spins'] == 11,
                                                  0.07, 'Natural trigger: 3 ALARM -> Rescue Spins, 10 spins, several douses, one rescue (+1x, +1 spin)')),
    ('base_trigger_inferno', lambda: natural_bonus('base_trigger_inferno', True,
                                                   lambda s, bk: 2 <= s['rescued'] <= 4 and s['buildings'] == 0,
                                                   0.06, 'Natural trigger with a GOLDEN ALARM -> Inferno Rescue: rescues carry instant prizes, +2x each')),
    ('rescue_buy', lambda: bought_bonus('rescue', 'rescue', 'buy',
                                        lambda s, bk: s['buildings'] == 1 and bk.total < 3000, 0.12, 'Bought Rescue Spins: rescues, a building cleared (+5 spins), multiplier kept')),
    ('inferno_buy', lambda: bought_bonus('inferno', 'inferno', 'buy',
                                         lambda s, bk: 3 <= s['rescued'] <= 7 and bk.total < 3000, 0.08, 'Bought Inferno Rescue: one spray per room, +2x and a prize per rescue')),
    ('alarm_call_rescue', lambda: bought_bonus('alarm_call', 'rescue', 'alarmCall',
                                               lambda s, bk: 2 <= s['rescued'] <= 4 and bk.total < 1500, 0.1, 'Alarm Call awarding Rescue Spins (10 spins, as bought)', alarm_outcome='rescue')),
    ('alarm_call_false', alarm_call_false),
    ('backdraft_spins', backdraft_spins),
    ('max_win', max_win),
]


def main():
    os.makedirs(OUT, exist_ok=True)
    index = {
        'note': 'PIGGY FIREFIGHTERS DEV fixtures, hand-authored by the frontend lane (tools/fixtures/make_fixtures.py). NOT math books: line wins are evaluated from each board with the contract rules and every bonus is simulated from its boards, but the boards are chosen, not drawn. Replace with Codex production fixtures when published.',
        'amounts': 'All amounts are integer x100 of the base bet. reveal / winInfo / freeSpinTrigger positions are padded (+1 row); custom events are 0-based visible rows.',
        'cap': CAP,
        'modes': list(COSTS.keys()),
        'costs': COSTS,
        'fixtures': [],
    }
    for name, fn in FIXTURES:
        random.seed(hash(name) & 0)  # paddingPositions: deterministic
        random.seed(sum(map(ord, name)))
        book = fn()
        mode = book.pop('_mode', None) or next(m for m in COSTS if m == {'base_nowin': 'base', 'base_win': 'base', 'base_backdraft_win': 'base', 'ante_win': 'ante', 'base_trigger_rescue': 'base', 'base_trigger_inferno': 'base', 'max_win': 'base', 'rescue_buy': 'rescue', 'inferno_buy': 'inferno', 'alarm_call_rescue': 'alarm_call', 'alarm_call_false': 'alarm_call', 'backdraft_spins': 'backdraft_spins'}[name])
        with open(os.path.join(OUT, f'{name}.json'), 'w') as f:
            json.dump(book, f, indent=1)
        desc = next(d for n, d in DESCRIPTIONS if n == name)
        index['fixtures'].append({
            'name': name, 'file': f'{name}.json', 'mode': mode, 'source_mode': mode, 'cost': COSTS[mode], 'criteria': book['criteria'],
            'payoutMultiplier': book['payoutMultiplier'], 'events': [e['type'] for e in book['events']], 'forced': False, 'description': desc,
        })
        print(f"{name:22s} {mode:16s} payout {book['payoutMultiplier'] / 100:>10.2f}x  events {len(book['events'])}")
    with open(os.path.join(OUT, 'index.json'), 'w') as f:
        json.dump(index, f, indent=1)


DESCRIPTIONS = [
    ('base_nowin', 'Base spin: no line win, one alarm, no Backdraft'),
    ('base_win', 'Base spin: exactly two line wins (sequential line presentation, then both together)'),
    ('base_backdraft_win', 'Base spin with a Backdraft: cells ignite into Blaze Wilds; the line wins are counted on the post-Backdraft board and use them'),
    ('ante_win', 'ALARM BOOST spin (reel set BRA): one line win that returns less than the 1.5x stake (tier 0: no celebration)'),
    ('base_trigger_rescue', 'Natural trigger: 3 ALARM -> Rescue Spins, 10 spins, several douses, one rescue (+1x, +1 spin)'),
    ('base_trigger_inferno', 'Natural trigger with a GOLDEN ALARM -> Inferno Rescue: rescues carry instant prizes, +2x each'),
    ('rescue_buy', 'Bought Rescue Spins: rescues, a building cleared (+5 spins), multiplier kept'),
    ('inferno_buy', 'Bought Inferno Rescue: one spray per room, +2x and a prize per rescue'),
    ('alarm_call_rescue', 'Alarm Call awarding Rescue Spins (10 spins, played as bought)'),
    ('alarm_call_false', 'Alarm Call that turns out a False Alarm: nothing is awarded'),
    ('backdraft_spins', 'Backdraft Spins: 5 spins, a Backdraft of 3-5 multiplier Blaze Wilds (x2-x10, summed along a line) on every spin'),
    ('max_win', 'Natural Inferno Rescue that reaches the 15,000x cap (wincap, capped meters, MAX WIN)'),
]

if __name__ == '__main__':
    main()
