"""Published probabilities must close real moments and preserve every book."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'math'))


class WeightTests(unittest.TestCase):
    def setUp(self):
        try:
            from games.piggy_firefighters import game_weights
        except ImportError:
            self.fail('Deterministic weights solver has not been implemented')
        self.weights = game_weights

    def test_entropy_projection_closes_mean_and_group_share(self):
        import numpy as np
        features = np.array([[0, 0], [1, 0], [2, 1], [4, 1]], dtype=float)
        p, _ = self.weights.fit_probabilities(features, [1.0, .2])
        self.assertAlmostEqual(sum(p), 1, places=10)
        self.assertAlmostEqual(float(p @ features[:, 0]), 1, places=8)
        self.assertAlmostEqual(float(p @ features[:, 1]), .2, places=8)
        self.assertTrue(all(p > 0))

    def test_integerization_keeps_tiny_positive_outcomes_and_budget(self):
        integers = self.weights.integer_weights([.5, .5 - 1e-16, 1e-16], budget=10**12)
        self.assertEqual(sum(integers), 10**12)
        self.assertTrue(all(int(w) == w and w >= 1 for w in integers))

    def test_infeasible_mean_fails_instead_of_faking_weights(self):
        with self.assertRaises(self.weights.FitError):
            self.weights.fit_probabilities([[0], [1]], [2])

    def test_large_publication_report_keeps_probabilities_and_second_moment(self):
        import math
        records = [(0, 'none', False), (50, 'none', True), (1000, 'rescue', False),
                   (1500000, 'inferno', False)] * 8500
        weights = [10**12, 10**12, 10**12, 100] * 8500
        total = sum(weights)
        mean = math.fsum(w / total * r[0] / 100 for r, w in zip(records, weights))
        second = math.fsum(w / total * (r[0] / 100)**2 for r, w in zip(records, weights))
        report = self.weights.summarize(records, weights, 1)
        self.assertAlmostEqual(report['sd_over_cost'], math.sqrt(second - mean**2), places=8)
        self.assertAlmostEqual(report['any_win'], sum(weights[1:4]) / sum(weights[:4]), places=10)
        self.assertTrue(all(0 <= report[k] <= 1 for k in ('any_win', 'sub_hit', 'cap_probability')))

    def test_natural_and_alarm_weighting_require_shared_banks(self):
        from types import SimpleNamespace
        for mode in ('base', 'ante', 'alarm_call'):
            with self.assertRaises(self.weights.FitError):
                self.weights.solve_mode(mode, [(0, 'none', False), (1500000, 'inferno', False)],
                                        SimpleNamespace(mode_costs={mode: 1.5}))


if __name__ == '__main__':
    unittest.main()
