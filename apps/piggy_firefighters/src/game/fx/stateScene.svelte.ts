/**
 * Scene-direction state shared by the background, the bay-door shutter and the board frame. The rescue director is
 * the single writer of `mood`, and it only changes it WHILE THE SHUTTER IS CLOSED, so a player never sees the world
 * swap — they see Station 13 give way to the burning block when the door rolls back up (theme §4).
 */
export type SceneMood = 'base' | 'rescue' | 'inferno';

export const stateScene = $state({
	/** base = Station 13 at dusk, rescue = the apartment block at night, inferno = the same block under a red sky */
	mood: 'base' as SceneMood,
	/** the shutter currently covers the play area */
	covered: false,
	/** presentation is in a win / reveal beat: ambient life stays quiet */
	busy: false,
});

export const moodForBonus = (inferno: boolean): SceneMood => (inferno ? 'inferno' : 'rescue');
