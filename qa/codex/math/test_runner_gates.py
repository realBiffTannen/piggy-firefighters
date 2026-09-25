"""Known-bad runtime and nonfinite statistics must fail before publication."""
import sys
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'math'))


class RunnerGateTests(unittest.TestCase):
    def test_runtime_matches_the_supported_pinned_environment(self):
        from games.piggy_firefighters import run
        good = {'python_version': [3, 12, 14], 'numpy': '2.2.5', 'scipy': '1.15.3', 'zstandard': '0.23.0'}
        run.validate_runtime(good)
        for change in ({'python_version': [3, 14, 6]}, {'scipy': '1.16.0'}, {'numpy': '2.3.0'}):
            with self.assertRaises(ValueError):
                run.validate_runtime({**good, **change})

    def test_nonfinite_and_invalid_probabilities_fail_closed(self):
        from games.piggy_firefighters.run import publication_violations
        report = {'rtp': .96699999, 'etl10k': .015, 'etl40b': .015, 'cvar': 10,
                  'prob5k': 1e-6, 'prob10k': 1e-6, 'any_win': .9, 'regular_hit': .4,
                  'sub_hit': .5, 'rescue_probability': 1, 'inferno_probability': 0,
                  'backdraft_probability': 0, 'cap_probability': 1e-6, 'sd_over_cost': 1.4}
        self.assertFalse(publication_violations('rescue', report))
        for key in ('rtp', 'etl40b', 'sd_over_cost', 'any_win'):
            self.assertTrue(publication_violations('rescue', {**report, key: float('nan')}))
        self.assertIn('any_win', publication_violations('rescue', {**report, 'any_win': 1.01}))


if __name__ == '__main__':
    unittest.main()
