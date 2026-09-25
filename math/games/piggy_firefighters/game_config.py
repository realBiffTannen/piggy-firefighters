"""Piggy Firefighters v1.1 draft model; final values freeze only after M2."""
from pathlib import Path
from src.config.config import Config
from src.config.betmode import BetMode
from src.config.distributions import Distribution
from .game_paytable import PAYTABLE, SPECIAL_SYMBOLS

GAME_DIR = Path(__file__).resolve().parent
PAYLINES = {i + 1: row for i, row in enumerate([
    [1,1,1,1,1], [0,0,0,0,0], [2,2,2,2,2], [0,1,2,1,0], [2,1,0,1,2],
    [0,0,1,0,0], [2,2,1,2,2], [1,0,0,0,1], [1,2,2,2,1], [0,1,1,1,0],
    [2,1,1,1,2], [1,0,1,0,1], [1,2,1,2,1], [0,1,0,1,0], [2,1,2,1,2],
    [1,1,0,1,1], [1,1,2,1,1], [0,0,2,0,0], [2,2,0,2,2], [0,2,0,2,0],
])}
MODE_COSTS = {'base': 1.0, 'ante': 1.5, 'backdraft_spins': 50.0,
              'alarm_call': 12.0, 'rescue': 18.0, 'inferno': 90.0}
RTP_TARGET = 0.96699999  # leave integer-weight rounding beneath the 0.967 ceiling
BASE_RESCUE_RATE = 1 / 165
BASE_INFERNO_RATE = 1 / 2100
BACKDRAFT_RATE = 1 / 40
BASE_BLAZE_COUNTS = {2: 45, 3: 35, 4: 15, 5: 5}
BUY_BLAZE_COUNTS = {3: 92, 4: 6, 5: 2}
BLAZE_MULTIPLIERS = {2: 96.5, 3: 1, 5: 1, 10: 1.5}
INFERNO_PRIZES_X100 = {500: 50, 1000: 30, 2000: 14, 5000: 5, 10000: 1}


def initial_spins(alarms):
    if alarms < 3:
        raise ValueError('Fewer than three alarms cannot trigger a bonus')
    return 10 if alarms == 3 else 12 if alarms == 4 else 15


class GameConfig(Config):
    def __init__(self):
        super().__init__()
        self.game_id = 'piggy_firefighters'
        self.game_name = 'Piggy Firefighters'
        self.provider_name = 'Crash Galaxy'
        self.rtp = RTP_TARGET
        self.wincap = 15000
        self.num_reels, self.num_rows = 5, [3] * 5
        self.include_padding = True
        self.output_regular_json = False
        self.paytable = PAYTABLE
        self.paylines = PAYLINES
        self.special_symbols = SPECIAL_SYMBOLS
        self.all_valid_sym_names = set(SPECIAL_SYMBOLS['scatter']) | {s for _, s in PAYTABLE}
        self.mode_costs = dict(MODE_COSTS)
        self.reels = {name: self.read_reels_csv(GAME_DIR / 'reels' / f'{name}.csv')
                      for name in ('BR0', 'BRA', 'BRB', 'FR0', 'FRI')}
        for strips in self.reels.values():
            self.validate_reel_symbols(strips)
        self.padding_reels = {'basegame': self.reels['BR0'], 'freegame': self.reels['FR0']}
        self.bet_modes = [BetMode(name=mode, cost=cost, rtp=self.rtp, max_win=self.wincap,
            auto_close_disabled=True, is_feature=mode == 'ante', is_buybonus=mode not in ('base','ante'),
            distributions=[Distribution(criteria='ordinary', quota=1.0, conditions={'reel_weights': {}})])
            for mode, cost in self.mode_costs.items()]
        self.construct_paths()
        # Integrity abort, not a silent award/spin cap: an unexpectedly long round
        # must be investigated instead of accepted with altered math.
        self.round_guard = 10000
