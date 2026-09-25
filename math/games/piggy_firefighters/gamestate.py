"""Deterministic per-book dispatch atop SDK state and Book serialization."""
import hashlib
import random
from src.state.books import Book
from .game_override import GameStateOverride


class GameState(GameStateOverride):
    def __init__(self, config):
        super().__init__(config)
        self.initialize_strip_indices()

    def simulate(self, mode, seed, criterion='ordinary', book_id=None, starting_spins=10):
        if mode not in self.config.mode_costs:
            raise ValueError(f'Unknown mode {mode}')
        # Python hash() is process-randomized. A fixed digest keeps books identical
        # across interpreters, worker counts, chunk sizes and simulation ordering.
        class_suffix = '' if starting_spins == 10 else f':spins{starting_spins}'
        digest = hashlib.sha256(f'pf-v1:{mode}:{seed}:{criterion}{class_suffix}'.encode()).digest()
        self.rng = random.Random(int.from_bytes(digest[:16], 'big'))
        self.betmode, self.criteria = mode, criterion
        self.book = Book(seed if book_id is None else book_id, criterion)
        self.cap_x100 = int(self.config.wincap * 100)
        self.total_x100 = self.base_x100 = self.free_x100 = 0
        self.wincap_triggered = False
        if mode in ('base', 'ante'):
            self.run_base(mode, criterion)
        elif mode == 'backdraft_spins':
            self.run_backdraft_spins(criterion == 'cap')
        elif mode == 'alarm_call':
            self.run_alarm_call(criterion)
        else:
            self.run_rescue(mode, 'buy', starting_spins, cap_path=criterion == 'cap')
        self.emit('finalWin', amount=self.total_x100)
        self.book.payout_multiplier = self.total_x100 / 100
        self.book.basegame_wins = self.base_x100 / 100
        self.book.freegame_wins = self.free_x100 / 100
        self.final_win = self.total_x100 / 100
        if self.base_x100 + self.free_x100 != self.total_x100:
            raise AssertionError('Base/free accounting mismatch')
        return self.book.to_json()

    def run_spin(self, sim, simulation_seed=None):
        """SDK runner-compatible interface; the streaming runner uses simulate."""
        result = self.simulate(self.betmode, sim if simulation_seed is None else simulation_seed,
                               self.criteria, book_id=sim)
        self.library[sim + 1] = result
        self._payout_ints.append(result['payoutMultiplier'])
        self.win_manager.running_bet_win = self.final_win
        self.win_manager.basegame_wins = self.base_x100 / 100
        self.win_manager.freegame_wins = self.free_x100 / 100
        self.win_manager.update_end_round_wins()

    def run_freespin(self):
        raise RuntimeError('Use run_rescue with the explicit bonus/source/spin count')
