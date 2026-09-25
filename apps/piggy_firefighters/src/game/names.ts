/**
 * PIGGY FIREFIGHTERS — the ONE player-facing naming table.
 *
 * The law is docs/PIGGY_FIREFIGHTERS_THEME.md: §2 characters, §3 symbols, §5 modes and copy hooks. Internal ids
 * (bet-mode keys, symbol ids, book event types, asset keys) are docs/GAME_CONTRACT.md's and never change; only the
 * words the player reads do, and every component takes them from here so a rename is one edit.
 */

export const GAME_TITLE = 'PIGGY FIREFIGHTERS';

/** Bet-mode titles (theme §5), keyed by the internal bet-mode key. Used verbatim on buy cards, mode cards and rules
 *  headings. */
export const MODE_TITLE = {
	ante: 'ALARM BOOST',
	backdraft_spins: 'BACKDRAFT SPINS',
	alarm_call: 'ALARM CALL',
	rescue: 'RESCUE SPINS',
	inferno: 'INFERNO RESCUE',
} as const;

/** The same names in running text (rules sentences, card subtitles, aria text). */
export const FEATURE = {
	ante: 'Alarm Boost',
	backdraftSpins: 'Backdraft Spins',
	alarmCall: 'Alarm Call',
	rescue: 'Rescue Spins',
	inferno: 'Inferno Rescue',
} as const;

/** Mechanic names (theme §4, contract §4-§7). */
export const MECHANIC = {
	/** the base-game modifier: 2-5 cells ignite into Blaze Wilds */
	backdraft: 'Backdraft',
	/** a W created by a Backdraft */
	blazeWild: 'Blaze Wild',
	/** a W on reel r sprays room r */
	douse: 'Douse',
	/** a room reaching fire level 0 */
	rescue: 'Rescue',
	/** all five rooms rescued: the crew moves on */
	buildingCleared: 'Next Building',
	/** the Alarm Call outcome that awards nothing */
	falseAlarm: 'False Alarm',
	/** the global multiplier badge on the truck door */
	multiplier: 'Rescue Multiplier',
} as const;

/** Reel symbols (theme §3 / contract §3). */
export const SYMBOL_NAME: Record<string, string> = {
	H1: 'Fire Truck',
	H2: 'Fire Helmet',
	H3: 'Axe & Halligan',
	H4: 'Extinguisher',
	L1: 'Brass Nozzle',
	L2: 'Water Bucket',
	L3: 'Ladder',
	L4: 'Fire Boots',
	W: 'Chief Hamm',
	ALARM: 'Fire Alarm',
	GALARM: 'Golden Alarm',
};

/** Characters (theme §2). */
export const CHARACTER = {
	chief: 'Chief Hamm',
	rookie: 'Sprocket',
	dog: 'Ember',
	family: 'the Trotter family',
} as const;

/** The rescued (theme §2): five skins of one rig; room r of building b shows skin [(r + b) mod 5] (b 0-based). */
export const TROTTER_SKINS = ['grandma', 'twins', 'dad', 'baby', 'teen'] as const;
export const trotterSkin = (reel: number, building: number) => TROTTER_SKINS[(reel + Math.max(0, building - 1)) % TROTTER_SKINS.length];

/** Rescue scene words (theme §4). */
export const ROOMS = 5;
export const BUILDING = 'BUILDING';
