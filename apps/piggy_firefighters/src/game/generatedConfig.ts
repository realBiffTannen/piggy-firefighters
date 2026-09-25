/**
 * The view of the math bet-mode table the studio HUD consumes
 * (`@crashgalaxy/hud` BetModeTable). Derived from `game/config.ts` so costs and
 * buy flags have ONE source. The host derives each mode's kind from these
 * flags (docs/INTEGRATION.md §5): `base` (costMultiplier 1) → default, `ante` (3x)
 * and `super_ante` (10x) — not buys → "activate" tiers, and the six isBuyBonus modes
 * (including LUCKY's `golden_four`) → buy cards. Nothing here is typed twice; add a
 * mode in config.ts and it appears (with `maxWin` 25,000 on every row).
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
