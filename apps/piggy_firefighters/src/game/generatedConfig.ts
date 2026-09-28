/**
 * The view of the math bet-mode table the studio HUD consumes
 * (`@crashgalaxy/hud` BetModeTable). Derived from `game/config.ts` so costs and
 * buy flags have ONE source. The host derives each mode's kind from these
 * flags: `base` (costMultiplier 1) → default, `ante` (3x, ALARM BOOST) and `super_ante`
 * (5x, FIVE-ALARM BOOST) — not buys → the two "activate" tiers of the HUD's ante chooser
 * (hud.config.ts `features.anteTiers`), and the four isBuyBonus modes → buy cards. Seven
 * modes, nothing typed twice; add a mode in config.ts and it appears (with `maxWin` 20,000
 * on every row).
 */
import type { BetModeTable } from '@crashgalaxy/hud';

import config from './config';

const betModes: BetModeTable = Object.fromEntries(
	Object.entries(config.betModes).map(([key, mode]) => [
		key,
		{
			cost: mode.cost,
			costMultiplier: mode.cost,
			isBuyBonus: mode.buyBonus,
			feature: mode.feature,
			maxWin: mode.max_win,
		},
	]),
);

export default { betModes };
