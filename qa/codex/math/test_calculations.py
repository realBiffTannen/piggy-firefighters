"""Hand-calculated payout/state regressions; run with unittest discovery."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'math'))


class CalculationTests(unittest.TestCase):
    def setUp(self):
        try:
            from games.piggy_firefighters import game_calculations as calc
        except ImportError:
            self.fail('Piggy Firefighters calculation engine has not been implemented')
        self.calc = calc

    def line(self, symbols, multiplier=1):
        return self.calc.evaluate_lines([[s] for s in symbols], {1: [0] * 5}, multiplier)

    def test_wild_prefix_wins_when_three_wilds_beat_five_low_symbols(self):
        # Paying the 5 L4 combination would incorrectly return only 1.2x.
        result = self.line(['W', 'W', 'W', 'L4', 'L4'])
        self.assertEqual(result['totalWin'], 150)
        self.assertEqual(result['wins'][0]['symbol'], 'W')
        self.assertEqual(len(result['wins'][0]['positions']), 3)

    def test_substitution_wins_when_five_high_symbols_beat_wild_prefix(self):
        result = self.line(['W', 'W', 'W', 'H2', 'H2'], 3)
        self.assertEqual(result['totalWin'], 3600)
        self.assertEqual(len(result['wins']), 1)
        self.assertEqual(result['wins'][0]['symbol'], 'H2')

    def test_all_wild_line_pays_h1_once(self):
        self.assertEqual(self.line(['W'] * 5)['totalWin'], 2500)

    def test_alarm_is_not_payable_or_substituted(self):
        self.assertEqual(self.line(['W', 'W', 'ALARM', 'W', 'W'])['totalWin'], 0)

    def test_blaze_multiplier_compares_final_candidate_not_raw_pay(self):
        result = self.calc.evaluate_lines([['W'], ['W'], ['W'], ['L4'], ['W']],
                                          {1: [0] * 5}, blaze={(4, 0): 10})
        self.assertEqual(result['totalWin'], 1200)
        self.assertEqual(result['wins'][0]['symbol'], 'L4')
        self.assertEqual(result['wins'][0]['meta']['lineMultiplier'], 10)

    def test_lines_add_and_positions_identify_actual_rows(self):
        board = [['H1', 'H2']] * 5
        result = self.calc.evaluate_lines(board, {1: [0] * 5, 2: [1] * 5}, 2)
        self.assertEqual(result['totalWin'], 7400)
        self.assertEqual(result['wins'][1]['positions'][-1], {'reel': 4, 'row': 1})

    def test_rescue_douses_twice_without_spilling_into_next_building(self):
        state = self.calc.RescueState('rescue', spins=10)
        state.rooms = [0, 0, 0, 0, 2]
        board = [['H1'] * 3 for _ in range(4)] + [['W'] * 3]
        result = state.advance(board, lambda: 500)
        self.assertEqual(result['sprays'], [{'reel': 4, 'from': 2, 'to': 0}])
        self.assertEqual(result['rescues'], [{'reel': 4}])
        self.assertEqual(result['multiplier'], 2)
        self.assertEqual(result['spinsAdded'], 1)
        self.assertEqual(result['spinsLeft'], 10)
        self.assertEqual(state.rooms, [2] * 5)
        self.assertEqual(state.spins, 15)
        self.assertEqual(state.buildings, 1)

    def test_inferno_prizes_remain_unmultiplied(self):
        state = self.calc.RescueState('inferno', spins=10)
        result = state.advance([['W', 'H1', 'H2']] * 5, lambda: 500)
        self.assertEqual(result['multiplier'], 11)
        self.assertEqual(sum(r['prize'] for r in result['rescues']), 2500)
        self.assertEqual(state.spins, 19)

    def test_wild_in_rescued_room_never_awards_again(self):
        state = self.calc.RescueState('inferno', spins=2)
        state.rooms[0] = 0
        result = state.advance([['W'] * 3] + [['H1'] * 3 for _ in range(4)], lambda: 500)
        self.assertEqual(result['rescues'], [])
        self.assertEqual(state.multiplier, 1)
        self.assertEqual(state.spins, 1)


if __name__ == '__main__':
    unittest.main()
