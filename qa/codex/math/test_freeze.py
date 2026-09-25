"""Freeze verification covers actual source files, including ignored/untracked additions."""
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'math'))


class FreezeTests(unittest.TestCase):
    def test_only_exact_tracked_source_tree_matches_freeze(self):
        from games.piggy_firefighters import run
        with tempfile.TemporaryDirectory() as temporary:
            repo = Path(temporary)
            game = repo / 'math/games/example'
            game.mkdir(parents=True)
            (game / 'gamestate.py').write_text('version = 1\n')
            def git(*args):
                return subprocess.check_output(['git', '-C', str(repo), *args], text=True, stderr=subprocess.DEVNULL).strip()
            git('init')
            git('add', 'math/games/example/gamestate.py')
            git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'freeze')
            freeze = git('rev-parse', 'HEAD')
            self.assertTrue(run.verify_frozen_sources(freeze, repo, game))
            (game / 'untracked.py').write_text('unfrozen = True\n')
            with self.assertRaises(ValueError):
                run.verify_frozen_sources(freeze, repo, game)
            (game / 'untracked.py').unlink()
            (game / 'gamestate.py').write_text('version = 2\n')
            with self.assertRaises(ValueError):
                run.verify_frozen_sources(freeze, repo, game)


if __name__ == '__main__':
    unittest.main()
