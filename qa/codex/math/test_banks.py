"""The full conditional bonus event law must survive every publication wrapper."""
import sys
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'math'))


class BankTests(unittest.TestCase):
    def setUp(self):
        try:
            from games.piggy_firefighters import game_banks
        except ImportError:
            self.fail('Canonical bonus bank composition is not implemented')
        from games.piggy_firefighters.game_config import GameConfig
        from games.piggy_firefighters.gamestate import GameState
        self.banks = game_banks
        self.state = GameState(GameConfig())

    def test_all_wrappers_keep_every_bonus_event_and_cap_headroom(self):
        for bonus in ('rescue', 'inferno'):
            for spins in (10, 12, 15):
                bank = self.state.simulate(bonus, 7, 'cap', starting_spins=spins)
                reference = self.banks.canonical_bonus_hash(bank)
                for mode in ('base', 'ante'):
                    prefix = self.banks.trigger_prefix(self.state, mode, bonus, spins, 42)
                    book = self.banks.wrap_bonus(bank, prefix, 'natural', 99)
                    self.assertEqual(self.banks.canonical_bonus_hash(book), reference)
                    self.assertEqual(book['payoutMultiplier'], 1500000)
                    self.assertEqual(book['baseGameWins'], 0)
                    trigger = next(e for e in prefix if e['type'] == 'freeSpinTrigger')
                    self.assertEqual(trigger['totalFs'], spins)
                    self.assertEqual(len(trigger['positions']), {10: 3, 12: 4, 15: 5}[spins])
                alarm = self.banks.wrap_bonus(bank, [{'type': 'alarmCall', 'outcome': bonus}], 'alarmCall', 3)
                self.assertEqual(self.banks.canonical_bonus_hash(alarm), reference)

    def test_shared_weights_are_exact_integer_multiples_in_natural_modes(self):
        base = self.banks.natural_factors('base')
        ante = self.banks.natural_factors('ante')
        self.assertEqual(sum(base.values()), 15100)
        for key, value in base.items():
            self.assertEqual(ante[key], 2 * value)
        self.assertEqual(base['rescue', 10], 12600)
        self.assertEqual(base['inferno', 15], 11)

    def test_full_event_hash_detects_changed_douse_not_just_payout(self):
        import copy
        book = self.state.simulate('rescue', 8)
        changed = copy.deepcopy(book)
        next(e for e in changed['events'] if e['type'] == 'douse')['multiplier'] += 1
        self.assertNotEqual(self.banks.canonical_bonus_hash(book), self.banks.canonical_bonus_hash(changed))


if __name__ == '__main__':
    unittest.main()
