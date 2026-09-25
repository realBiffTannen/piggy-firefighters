"""Single bounded M1 calibration; no publication or book write."""
import json
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'math'))
from games.piggy_firefighters.game_config import GameConfig, BUY_BLAZE_COUNTS, BLAZE_MULTIPLIERS
from games.piggy_firefighters.gamestate import GameState

state = GameState(GameConfig())
awards = [state.simulate('backdraft_spins', seed, 'ordinary')['payoutMultiplier'] / 100 for seed in range(1000)]
result = {'rounds': len(awards), 'mean_x': statistics.mean(awards),
          'sample_se_x': statistics.stdev(awards) / len(awards)**.5,
          'derived_cost': statistics.mean(awards) / .967,
          'count_weights': BUY_BLAZE_COUNTS, 'mult_weights': BLAZE_MULTIPLIERS}
Path(__file__).with_suffix('.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
