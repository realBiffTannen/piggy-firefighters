/**
 * The view of the math bet-mode table the studio HUD consumes
 * (`@crashgalaxy/hud` BetModeTable). Derived from `game/config.ts` so costs and
 * buy flags have ONE source. The host derives each mode's kind from these
 * flags: `base` (costMultiplier 1) → default, `ante` (1.5x, ALARM BOOST) — not a buy →
 * the "activate" toggle, and the four isBuyBonus modes → buy cards. Nothing here is
 * typed twice; add a mode in config.ts and it appears (with `maxWin` 15,000 on every row).
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
