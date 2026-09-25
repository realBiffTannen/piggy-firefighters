"""SDK line calculation and the pure Rescue state transition."""
from dataclasses import dataclass, field
from types import SimpleNamespace

from src.calculations.lines import Lines
from src.calculations.symbol import SymbolStorage
from .game_paytable import PAYTABLE, PAYTABLE_X100, SPECIAL_SYMBOLS

_SYMBOL_CONFIG = SimpleNamespace(paytable=PAYTABLE, special_symbols=SPECIAL_SYMBOLS)
_STORAGE = SymbolStorage(_SYMBOL_CONFIG, list(dict.fromkeys(
    [symbol for _, symbol in PAYTABLE] + ['ALARM', 'GALARM'])))
# Symbols are read-only during line evaluation; reuse definitions/instances across rounds.
_SYMBOLS = {name: _STORAGE.create_symbol(name) for name in _STORAGE.symbol_defs}


def evaluate_lines(board, paylines, multiplier=1, blaze=None):
    """Return SDK win shapes with integer x100 amounts, unpadded positions.

    The SDK compares the payable leading W prefix with the substituted combination;
    only the larger amount on a line is returned. All-W pays as H1 via W's paytable.
    """
    if not isinstance(multiplier, int) or multiplier < 1:
        raise ValueError('Line multiplier must be a positive integer')
    if blaze:
        # SDK Lines compares raw candidates before applying cell multipliers. In
        # Backdraft Spins the longer substituted line may use extra Blaze cells,
        # so compare the fully multiplied awards here using the same SDK shape.
        result = {'totalWin': 0, 'wins': []}
        for line_id, line in paylines.items():
            names = [board[r][row] for r, row in enumerate(line)]
            first = next((name for name in names if name != 'W'), None)
            candidates = ['W'] + ([first] if first in PAYTABLE_X100 and first != 'W' else [])
            best = None
            for symbol in candidates:
                count = 0
                for name in names:
                    if name == symbol or (symbol != 'W' and name == 'W'):
                        count += 1
                    else:
                        break
                raw = PAYTABLE_X100[symbol].get(count, 0)
                if not raw:
                    continue
                positions = [{'reel': r, 'row': line[r]} for r in range(count)]
                line_mult = max(1, sum(blaze.get((p['reel'], p['row']), 0) for p in positions))
                win = Lines.line_win_info(symbol, count, raw * line_mult * multiplier, positions,
                    {'lineIndex': line_id, 'multiplier': line_mult * multiplier,
                     'winWithoutMult': raw, 'globalMult': multiplier, 'lineMultiplier': line_mult})
                if best is None or win['win'] > best['win']:
                    best = win
            if best:
                result['wins'].append(best)
                result['totalWin'] += best['win']
        return result
    config = SimpleNamespace(paytable=PAYTABLE, paylines=paylines)
    symbols = [[_SYMBOLS[name] for name in reel] for reel in board]
    result = Lines.get_lines(symbols, config, multiplier_method='global',
                             global_multiplier=multiplier)
    result['totalWin'] = int(round(result['totalWin'] * 100))
    for win in result['wins']:
        win['win'] = int(round(win['win'] * 100))
        win['meta']['winWithoutMult'] = int(round(win['meta']['winWithoutMult'] * 100))
    return result


@dataclass
class RescueState:
    bonus: str
    spins: int
    multiplier: int = 1
    rescued: int = 0
    buildings: int = 0
    played: int = 0
    rooms: list = field(default_factory=list)

    def __post_init__(self):
        if self.bonus not in ('rescue', 'inferno') or self.spins <= 0:
            raise ValueError('A Rescue state needs a valid bonus and positive spin count')
        if not self.rooms:
            self.rooms = [self.fire_level] * 5

    @property
    def fire_level(self):
        return 1 if self.bonus == 'inferno' else 2

    def advance(self, board, prize_draw):
        """Consume one spin, douse current rooms, then relight at most one building.

        Surplus W in this board never affects the next building. The returned spinsLeft
        is after rescues; a separate buildingCleared event adds the five building spins.
        Prize draws and their eventual cap allocation belong to the round executor.
        """
        if self.spins <= 0:
            raise ValueError('Cannot douse after the bonus ended')
        self.spins -= 1
        self.played += 1
        sprays, rescues = [], []
        for reel, symbols in enumerate(board):
            wilds = symbols.count('W')
            before = self.rooms[reel]
            if wilds:
                after = max(0, before - wilds)
                sprays.append({'reel': reel, 'from': before, 'to': after})
                self.rooms[reel] = after
                if before > 0 and after == 0:
                    rescue = {'reel': reel}
                    if self.bonus == 'inferno':
                        rescue['prize'] = prize_draw()
                    rescues.append(rescue)
        self.rescued += len(rescues)
        self.multiplier += len(rescues) * (2 if self.bonus == 'inferno' else 1)
        self.spins += len(rescues)
        result = {'sprays': sprays, 'rescues': rescues, 'multiplier': self.multiplier,
                  'spinsAdded': len(rescues), 'spinsLeft': self.spins}
        if all(fire == 0 for fire in self.rooms):
            self.buildings += 1
            self.spins += 5
            self.rooms = [self.fire_level] * 5
        return result
