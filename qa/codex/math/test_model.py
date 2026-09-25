"""Round bookkeeping, source provenance, cap and determinism regressions."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'math'))


class ModelTests(unittest.TestCase):
    def setUp(self):
        try:
            from games.piggy_firefighters.game_config import GameConfig
            from games.piggy_firefighters.gamestate import GameState
        except ImportError:
            self.fail('Six-mode model has not been implemented')
        self.config = GameConfig()
        self.state = GameState(self.config)

    def test_reels_exclude_alarms_in_all_bought_and_bonus_sets(self):
        for name in ('BRB', 'FR0', 'FRI'):
            self.assertFalse(any(s in ('ALARM', 'GALARM') for reel in self.config.reels[name] for s in reel))
        for name in ('BR0', 'BRA', 'BRB'):
            self.assertNotIn('W', self.config.reels[name][0])

    def test_bonus_same_seed_reproduces_events_after_another_mode(self):
        before = self.state.simulate('rescue', 123, 'ordinary')
        self.state.simulate('inferno', 22, 'ordinary')
        self.assertEqual(before, self.state.simulate('rescue', 123, 'ordinary'))

    def test_alarm_false_book_has_no_fake_visual_entropy(self):
        book = self.state.simulate('alarm_call', 0, 'falseAlarm')
        self.assertEqual([e['type'] for e in book['events']], ['alarmCall', 'setTotalWin', 'finalWin'])
        self.assertEqual(book['payoutMultiplier'], 0)

    def test_all_modes_reach_cap_from_actual_reel_outcomes(self):
        for mode in self.config.mode_costs:
            with self.subTest(mode=mode):
                book = self.state.simulate(mode, 7, 'cap')
                self.assertEqual(book['payoutMultiplier'], 1500000)
                self.assertEqual(sum(e['amount'] for e in book['events'] if e['type'] == 'setWin'), 1500000)
                self.assertEqual(len([e for e in book['events'] if e['type'] == 'wincap']), 1)
                for e in book['events']:
                    if e['type'] == 'reveal':
                        strips = self.config.reels[e['reelSet']]
                        for r, stop in enumerate(e['paddingPositions']):
                            expected = [strips[r][(stop + j) % len(strips[r])] for j in range(-1, 4)]
                            self.assertEqual([s['name'] for s in e['board'][r]], expected)
                    if e['type'] == 'winInfo':
                        self.assertEqual(sum(w['win'] for w in e['wins']), e['totalWin'])
                        self.assertLessEqual(e['totalWin'], 1500000)

    def test_backdraft_cap_uses_only_five_cells_per_spin(self):
        book = self.state.simulate('backdraft_spins', 7, 'cap')
        self.assertEqual([e['amount'] for e in book['events'] if e['type'] == 'setWin'], [987500, 512500])
        for e in book['events']:
            if e['type'] == 'backdraft':
                self.assertEqual(e['count'], 5)
                self.assertTrue(all(c['row'] == 1 and c['mult'] == 10 for c in e['cells']))

    def test_natural_bonus_has_no_backdraft_and_maps_five_plus(self):
        from games.piggy_firefighters.game_config import initial_spins
        self.assertEqual([initial_spins(n) for n in (3, 4, 5, 6, 15)], [10, 12, 15, 15, 15])
        for mode in ('base', 'ante'):
            book = self.state.simulate(mode, 78, 'rescue')
            self.assertNotIn('backdraft', [e['type'] for e in book['events']])
            self.assertEqual(next(e for e in book['events'] if e['type'] == 'rescueStart')['source'], 'natural')

    def test_building_cleared_names_completed_building_for_runtime(self):
        book = self.state.simulate('rescue', 7, 'cap')
        events = [e for e in book['events'] if e['type'] == 'buildingCleared']
        self.assertEqual([e['building'] for e in events], [1, 2, 3])

    def test_inferno_prize_cap_clips_credit_before_any_line_award(self):
        self.state.total_x100 = 1499700
        self.state.cap_x100 = 1500000
        rescues = [{'reel': 0, 'prize': 500}, {'reel': 1, 'prize': 10000}]
        credited = self.state.clip_prizes(rescues)
        self.assertEqual(credited, 300)
        self.assertEqual(rescues, [
            {'reel': 0, 'prize': 300, 'rawPrize': 500},
            {'reel': 1, 'prize': 0, 'rawPrize': 10000},
        ])

    def test_plain_backdraft_is_eligible_and_has_no_cell_multiplier(self):
        book = self.state.simulate('base', 11, 'backdraft')
        board = book['events'][0]['board']
        event = next(e for e in book['events'] if e['type'] == 'backdraft')
        for cell in event['cells']:
            self.assertNotIn('mult', cell)
            self.assertNotIn(board[cell['reel']][cell['row'] + 1]['name'], ('W', 'ALARM', 'GALARM'))

    def test_payout_balance_on_small_unbiased_round_sample(self):
        for mode in self.config.mode_costs:
            for seed in range(6):
                book = self.state.simulate(mode, seed, 'ordinary')
                events = book['events']
                self.assertEqual(events[-1]['type'], 'finalWin')
                self.assertEqual(events[-1]['amount'], book['payoutMultiplier'])
                self.assertEqual(sum(e['amount'] for e in events if e['type'] == 'setWin'), book['payoutMultiplier'])
                self.assertEqual([e['index'] for e in events], list(range(len(events))))
                self.assertEqual(book['payoutMultiplier'] % 10, 0)


if __name__ == '__main__':
    unittest.main()
