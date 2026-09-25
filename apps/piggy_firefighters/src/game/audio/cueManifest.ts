/**
 * GENERATED from /audio/cues.json by audio/tools/gen_manifest_lucky.mjs — do not hand-edit.
 * Re-run the generator if the manifest changes. One entry per cue; gains are the
 * pre-duck cue trims (the player's master/music/sfx gains sit OUTSIDE ducking).
 */
export type Bus = 'music' | 'sfx';

export interface CueDef {
	id: string;
	bus: Bus;
	/** codec-ordered source paths (relative to the served base): ogg first, m4a second */
	files: string[];
	gain: number;
	durationMs: number;
	priority: number;
	maxInstances: number;
	cooldownMs: number;
	loop: boolean;
	loopStartMs?: number;
	loopEndMs?: number;
	tempoBpm?: number;
}

export const GRID = {
	"tempoBpm": 83,
	"targetBpm": 83,
	"meter": "4/4",
	"key": "C major (major-pentatonic lead)"
} as const;

export const MIX = {
	"musicBusLUFS": -14,
	"sfxBusLUFS": -16,
	"maxTruePeak_dBTP": -1,
	"duckDb": [
		3,
		6
	],
	"duckAttackMs": [
		40,
		80
	],
	"duckReleaseMs": [
		250,
		500
	]
} as const;

export const CUES: Record<string, CueDef> = {
	"base_loop": {
		"id": "base_loop",
		"bus": "music",
		"files": [
			"assets/audio/lucky/base_loop.ogg",
			"assets/audio/lucky/base_loop.m4a"
		],
		"gain": 1,
		"durationMs": 92530.2,
		"priority": 10,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 0,
		"loopEndMs": 92530.2,
		"tempoBpm": 83
	},
	"anticipation_layer": {
		"id": "anticipation_layer",
		"bus": "music",
		"files": [
			"assets/audio/lucky/anticipation_layer.ogg",
			"assets/audio/lucky/anticipation_layer.m4a"
		],
		"gain": 0.522,
		"durationMs": 11566.3,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 0,
		"loopEndMs": 11566.3,
		"tempoBpm": 83
	},
	"hold_build_loop": {
		"id": "hold_build_loop",
		"bus": "music",
		"files": [
			"assets/audio/lucky/hold_build_loop.ogg",
			"assets/audio/lucky/hold_build_loop.m4a"
		],
		"gain": 1,
		"durationMs": 80000,
		"priority": 10,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 0,
		"loopEndMs": 80000,
		"tempoBpm": 96
	},
	"golden_build_loop": {
		"id": "golden_build_loop",
		"bus": "music",
		"files": [
			"assets/audio/lucky/golden_build_loop.ogg",
			"assets/audio/lucky/golden_build_loop.m4a"
		],
		"gain": 1,
		"durationMs": 76800,
		"priority": 10,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 0,
		"loopEndMs": 76800,
		"tempoBpm": 100
	},
	"reveal_bed": {
		"id": "reveal_bed",
		"bus": "music",
		"files": [
			"assets/audio/lucky/reveal_bed.ogg",
			"assets/audio/lucky/reveal_bed.m4a"
		],
		"gain": 0.85,
		"durationMs": 80000,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 0,
		"loopEndMs": 80000,
		"tempoBpm": 96
	},
	"ui_click": {
		"id": "ui_click",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/ui_click.ogg",
			"assets/audio/lucky/ui_click.m4a"
		],
		"gain": 0.694,
		"durationMs": 387.5,
		"priority": 3,
		"maxInstances": 4,
		"cooldownMs": 40,
		"loop": false
	},
	"ui_click_2": {
		"id": "ui_click_2",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/ui_click_2.ogg",
			"assets/audio/lucky/ui_click_2.m4a"
		],
		"gain": 0.99,
		"durationMs": 98.3,
		"priority": 3,
		"maxInstances": 4,
		"cooldownMs": 40,
		"loop": false
	},
	"ui_click_3": {
		"id": "ui_click_3",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/ui_click_3.ogg",
			"assets/audio/lucky/ui_click_3.m4a"
		],
		"gain": 1.17,
		"durationMs": 251.1,
		"priority": 3,
		"maxInstances": 4,
		"cooldownMs": 40,
		"loop": false
	},
	"bet_change": {
		"id": "bet_change",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/bet_change.ogg",
			"assets/audio/lucky/bet_change.m4a"
		],
		"gain": 1.129,
		"durationMs": 387.5,
		"priority": 3,
		"maxInstances": 4,
		"cooldownMs": 40,
		"loop": false
	},
	"ante_on": {
		"id": "ante_on",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/ante_on.ogg",
			"assets/audio/lucky/ante_on.m4a"
		],
		"gain": 0.727,
		"durationMs": 600,
		"priority": 4,
		"maxInstances": 1,
		"cooldownMs": 120,
		"loop": false
	},
	"ante_off": {
		"id": "ante_off",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/ante_off.ogg",
			"assets/audio/lucky/ante_off.m4a"
		],
		"gain": 0.727,
		"durationMs": 600,
		"priority": 4,
		"maxInstances": 1,
		"cooldownMs": 120,
		"loop": false
	},
	"alert_insufficient": {
		"id": "alert_insufficient",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/alert_insufficient.ogg",
			"assets/audio/lucky/alert_insufficient.m4a"
		],
		"gain": 0.982,
		"durationMs": 680,
		"priority": 6,
		"maxInstances": 1,
		"cooldownMs": 600,
		"loop": false
	},
	"spin_start": {
		"id": "spin_start",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/spin_start.ogg",
			"assets/audio/lucky/spin_start.m4a"
		],
		"gain": 0.771,
		"durationMs": 334.6,
		"priority": 5,
		"maxInstances": 1,
		"cooldownMs": 300,
		"loop": false
	},
	"reel_stop_1": {
		"id": "reel_stop_1",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/reel_stop_1.ogg",
			"assets/audio/lucky/reel_stop_1.m4a"
		],
		"gain": 1.525,
		"durationMs": 204.9,
		"priority": 5,
		"maxInstances": 2,
		"cooldownMs": 20,
		"loop": false
	},
	"reel_stop_2": {
		"id": "reel_stop_2",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/reel_stop_2.ogg",
			"assets/audio/lucky/reel_stop_2.m4a"
		],
		"gain": 1.584,
		"durationMs": 196.7,
		"priority": 5,
		"maxInstances": 2,
		"cooldownMs": 20,
		"loop": false
	},
	"reel_stop_3": {
		"id": "reel_stop_3",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/reel_stop_3.ogg",
			"assets/audio/lucky/reel_stop_3.m4a"
		],
		"gain": 1.668,
		"durationMs": 195.7,
		"priority": 5,
		"maxInstances": 2,
		"cooldownMs": 20,
		"loop": false
	},
	"reel_stop_4": {
		"id": "reel_stop_4",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/reel_stop_4.ogg",
			"assets/audio/lucky/reel_stop_4.m4a"
		],
		"gain": 1.571,
		"durationMs": 183.2,
		"priority": 5,
		"maxInstances": 2,
		"cooldownMs": 20,
		"loop": false
	},
	"reel_stop_5": {
		"id": "reel_stop_5",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/reel_stop_5.ogg",
			"assets/audio/lucky/reel_stop_5.m4a"
		],
		"gain": 1.797,
		"durationMs": 180.8,
		"priority": 5,
		"maxInstances": 2,
		"cooldownMs": 20,
		"loop": false
	},
	"hat_land_1": {
		"id": "hat_land_1",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/hat_land_1.ogg",
			"assets/audio/lucky/hat_land_1.m4a"
		],
		"gain": 1.155,
		"durationMs": 317.1,
		"priority": 6,
		"maxInstances": 3,
		"cooldownMs": 0,
		"loop": false
	},
	"hat_land_2": {
		"id": "hat_land_2",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/hat_land_2.ogg",
			"assets/audio/lucky/hat_land_2.m4a"
		],
		"gain": 0.859,
		"durationMs": 573.1,
		"priority": 6,
		"maxInstances": 3,
		"cooldownMs": 0,
		"loop": false
	},
	"hat_land_3": {
		"id": "hat_land_3",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/hat_land_3.ogg",
			"assets/audio/lucky/hat_land_3.m4a"
		],
		"gain": 2,
		"durationMs": 464.6,
		"priority": 6,
		"maxInstances": 3,
		"cooldownMs": 0,
		"loop": false
	},
	"house_straw": {
		"id": "house_straw",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/house_straw.ogg",
			"assets/audio/lucky/house_straw.m4a"
		],
		"gain": 0.859,
		"durationMs": 801.5,
		"priority": 7,
		"maxInstances": 4,
		"cooldownMs": 0,
		"loop": false
	},
	"house_wood": {
		"id": "house_wood",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/house_wood.ogg",
			"assets/audio/lucky/house_wood.m4a"
		],
		"gain": 1.927,
		"durationMs": 583.5,
		"priority": 7,
		"maxInstances": 4,
		"cooldownMs": 0,
		"loop": false
	},
	"house_brick": {
		"id": "house_brick",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/house_brick.ogg",
			"assets/audio/lucky/house_brick.m4a"
		],
		"gain": 1.061,
		"durationMs": 883.7,
		"priority": 7,
		"maxInstances": 4,
		"cooldownMs": 0,
		"loop": false
	},
	"house_mansion": {
		"id": "house_mansion",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/house_mansion.ogg",
			"assets/audio/lucky/house_mansion.m4a"
		],
		"gain": 0.87,
		"durationMs": 985,
		"priority": 7,
		"maxInstances": 4,
		"cooldownMs": 0,
		"loop": false
	},
	"house_palace": {
		"id": "house_palace",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/house_palace.ogg",
			"assets/audio/lucky/house_palace.m4a"
		],
		"gain": 0.937,
		"durationMs": 984.4,
		"priority": 7,
		"maxInstances": 4,
		"cooldownMs": 0,
		"loop": false
	},
	"house_maxed": {
		"id": "house_maxed",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/house_maxed.ogg",
			"assets/audio/lucky/house_maxed.m4a"
		],
		"gain": 1.114,
		"durationMs": 880,
		"priority": 5,
		"maxInstances": 2,
		"cooldownMs": 120,
		"loop": false
	},
	"square_tick": {
		"id": "square_tick",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/square_tick.ogg",
			"assets/audio/lucky/square_tick.m4a"
		],
		"gain": 0.53,
		"durationMs": 480,
		"priority": 3,
		"maxInstances": 6,
		"cooldownMs": 25,
		"loop": false
	},
	"extra_spin": {
		"id": "extra_spin",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/extra_spin.ogg",
			"assets/audio/lucky/extra_spin.m4a"
		],
		"gain": 0.715,
		"durationMs": 1183.4,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"build_or_bust_anticipation": {
		"id": "build_or_bust_anticipation",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/build_or_bust_anticipation.ogg",
			"assets/audio/lucky/build_or_bust_anticipation.m4a"
		],
		"gain": 0.978,
		"durationMs": 1611.8,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"bust_settle": {
		"id": "bust_settle",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/bust_settle.ogg",
			"assets/audio/lucky/bust_settle.m4a"
		],
		"gain": 1.109,
		"durationMs": 518.2,
		"priority": 6,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"bonus_entry_hold": {
		"id": "bonus_entry_hold",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/bonus_entry_hold.ogg",
			"assets/audio/lucky/bonus_entry_hold.m4a"
		],
		"gain": 0.968,
		"durationMs": 1574.6,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"bonus_entry_golden": {
		"id": "bonus_entry_golden",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/bonus_entry_golden.ogg",
			"assets/audio/lucky/bonus_entry_golden.m4a"
		],
		"gain": 0.963,
		"durationMs": 1888.5,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"door_latch": {
		"id": "door_latch",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/door_latch.ogg",
			"assets/audio/lucky/door_latch.m4a"
		],
		"gain": 0.577,
		"durationMs": 600,
		"priority": 6,
		"maxInstances": 3,
		"cooldownMs": 0,
		"loop": false
	},
	"prize_small": {
		"id": "prize_small",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/prize_small.ogg",
			"assets/audio/lucky/prize_small.m4a"
		],
		"gain": 0.9,
		"durationMs": 680,
		"priority": 6,
		"maxInstances": 3,
		"cooldownMs": 40,
		"loop": false
	},
	"prize_medium": {
		"id": "prize_medium",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/prize_medium.ogg",
			"assets/audio/lucky/prize_medium.m4a"
		],
		"gain": 0.899,
		"durationMs": 800,
		"priority": 6,
		"maxInstances": 3,
		"cooldownMs": 40,
		"loop": false
	},
	"prize_large": {
		"id": "prize_large",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/prize_large.ogg",
			"assets/audio/lucky/prize_large.m4a"
		],
		"gain": 1.131,
		"durationMs": 990.3,
		"priority": 7,
		"maxInstances": 3,
		"cooldownMs": 40,
		"loop": false
	},
	"jackpot_minor": {
		"id": "jackpot_minor",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/jackpot_minor.ogg",
			"assets/audio/lucky/jackpot_minor.m4a"
		],
		"gain": 1.317,
		"durationMs": 1600,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"jackpot_major": {
		"id": "jackpot_major",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/jackpot_major.ogg",
			"assets/audio/lucky/jackpot_major.m4a"
		],
		"gain": 0.846,
		"durationMs": 2000,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"jackpot_grand": {
		"id": "jackpot_grand",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/jackpot_grand.ogg",
			"assets/audio/lucky/jackpot_grand.m4a"
		],
		"gain": 0.926,
		"durationMs": 3000,
		"priority": 10,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"win_max": {
		"id": "win_max",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/win_max.ogg",
			"assets/audio/lucky/win_max.m4a"
		],
		"gain": 1.009,
		"durationMs": 4000,
		"priority": 11,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"collect_tick": {
		"id": "collect_tick",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/collect_tick.ogg",
			"assets/audio/lucky/collect_tick.m4a"
		],
		"gain": 0.633,
		"durationMs": 390.9,
		"priority": 5,
		"maxInstances": 4,
		"cooldownMs": 30,
		"loop": false
	},
	"collect_resolve": {
		"id": "collect_resolve",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/collect_resolve.ogg",
			"assets/audio/lucky/collect_resolve.m4a"
		],
		"gain": 0.905,
		"durationMs": 1200,
		"priority": 7,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"bonus_exit": {
		"id": "bonus_exit",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/bonus_exit.ogg",
			"assets/audio/lucky/bonus_exit.m4a"
		],
		"gain": 0.978,
		"durationMs": 1360,
		"priority": 7,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"total_win_small": {
		"id": "total_win_small",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/total_win_small.ogg",
			"assets/audio/lucky/total_win_small.m4a"
		],
		"gain": 0.727,
		"durationMs": 1200,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"total_win_mid": {
		"id": "total_win_mid",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/total_win_mid.ogg",
			"assets/audio/lucky/total_win_mid.m4a"
		],
		"gain": 1.242,
		"durationMs": 1498.4,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"total_win_big": {
		"id": "total_win_big",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/total_win_big.ogg",
			"assets/audio/lucky/total_win_big.m4a"
		],
		"gain": 0.991,
		"durationMs": 2109.2,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"pig_hup": {
		"id": "pig_hup",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/pig_hup.ogg",
			"assets/audio/lucky/pig_hup.m4a"
		],
		"gain": 1.291,
		"durationMs": 600,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 120,
		"loop": false
	},
	"pig_thud": {
		"id": "pig_thud",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/pig_thud.ogg",
			"assets/audio/lucky/pig_thud.m4a"
		],
		"gain": 1.019,
		"durationMs": 268.3,
		"priority": 5,
		"maxInstances": 2,
		"cooldownMs": 80,
		"loop": false
	},
	"square_trace_t1": {
		"id": "square_trace_t1",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/square_trace_t1.ogg",
			"assets/audio/lucky/square_trace_t1.m4a"
		],
		"gain": 0.833,
		"durationMs": 609.3,
		"priority": 3,
		"maxInstances": 6,
		"cooldownMs": 25,
		"loop": false
	},
	"square_trace_t2": {
		"id": "square_trace_t2",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/square_trace_t2.ogg",
			"assets/audio/lucky/square_trace_t2.m4a"
		],
		"gain": 0.799,
		"durationMs": 783.2,
		"priority": 3,
		"maxInstances": 6,
		"cooldownMs": 25,
		"loop": false
	},
	"square_trace_t3": {
		"id": "square_trace_t3",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/square_trace_t3.ogg",
			"assets/audio/lucky/square_trace_t3.m4a"
		],
		"gain": 0.759,
		"durationMs": 731.3,
		"priority": 3,
		"maxInstances": 6,
		"cooldownMs": 25,
		"loop": false
	},
	"square_trace_t4": {
		"id": "square_trace_t4",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/square_trace_t4.ogg",
			"assets/audio/lucky/square_trace_t4.m4a"
		],
		"gain": 0.769,
		"durationMs": 758.7,
		"priority": 3,
		"maxInstances": 6,
		"cooldownMs": 25,
		"loop": false
	},
	"square_trace_t5": {
		"id": "square_trace_t5",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/square_trace_t5.ogg",
			"assets/audio/lucky/square_trace_t5.m4a"
		],
		"gain": 0.761,
		"durationMs": 739.3,
		"priority": 3,
		"maxInstances": 6,
		"cooldownMs": 25,
		"loop": false
	},
	"square_trace_t1_turbo": {
		"id": "square_trace_t1_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/square_trace_t1_turbo.ogg",
			"assets/audio/lucky/square_trace_t1_turbo.m4a"
		],
		"gain": 1.016,
		"durationMs": 305.9,
		"priority": 3,
		"maxInstances": 6,
		"cooldownMs": 15,
		"loop": false
	},
	"square_trace_t2_turbo": {
		"id": "square_trace_t2_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/square_trace_t2_turbo.ogg",
			"assets/audio/lucky/square_trace_t2_turbo.m4a"
		],
		"gain": 1.095,
		"durationMs": 392.7,
		"priority": 3,
		"maxInstances": 6,
		"cooldownMs": 15,
		"loop": false
	},
	"square_trace_t3_turbo": {
		"id": "square_trace_t3_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/square_trace_t3_turbo.ogg",
			"assets/audio/lucky/square_trace_t3_turbo.m4a"
		],
		"gain": 1.003,
		"durationMs": 367.5,
		"priority": 3,
		"maxInstances": 6,
		"cooldownMs": 15,
		"loop": false
	},
	"square_trace_t4_turbo": {
		"id": "square_trace_t4_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/square_trace_t4_turbo.ogg",
			"assets/audio/lucky/square_trace_t4_turbo.m4a"
		],
		"gain": 1.102,
		"durationMs": 391.1,
		"priority": 3,
		"maxInstances": 6,
		"cooldownMs": 15,
		"loop": false
	},
	"square_trace_t5_turbo": {
		"id": "square_trace_t5_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/square_trace_t5_turbo.ogg",
			"assets/audio/lucky/square_trace_t5_turbo.m4a"
		],
		"gain": 1.021,
		"durationMs": 374.2,
		"priority": 3,
		"maxInstances": 6,
		"cooldownMs": 15,
		"loop": false
	},
	"hat_flip_whoosh": {
		"id": "hat_flip_whoosh",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/hat_flip_whoosh.ogg",
			"assets/audio/lucky/hat_flip_whoosh.m4a"
		],
		"gain": 1.274,
		"durationMs": 1498.9,
		"priority": 7,
		"maxInstances": 2,
		"cooldownMs": 0,
		"loop": false
	},
	"hat_flip_whoosh_turbo": {
		"id": "hat_flip_whoosh_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/hat_flip_whoosh_turbo.ogg",
			"assets/audio/lucky/hat_flip_whoosh_turbo.m4a"
		],
		"gain": 1.816,
		"durationMs": 732.9,
		"priority": 7,
		"maxInstances": 2,
		"cooldownMs": 0,
		"loop": false
	},
	"hat_energy_crack": {
		"id": "hat_energy_crack",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/hat_energy_crack.ogg",
			"assets/audio/lucky/hat_energy_crack.m4a"
		],
		"gain": 1.839,
		"durationMs": 480,
		"priority": 7,
		"maxInstances": 3,
		"cooldownMs": 0,
		"loop": false
	},
	"hat_flip_settle": {
		"id": "hat_flip_settle",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/hat_flip_settle.ogg",
			"assets/audio/lucky/hat_flip_settle.m4a"
		],
		"gain": 1.595,
		"durationMs": 887.2,
		"priority": 6,
		"maxInstances": 3,
		"cooldownMs": 0,
		"loop": false
	},
	"hat_slam": {
		"id": "hat_slam",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/hat_slam.ogg",
			"assets/audio/lucky/hat_slam.m4a"
		],
		"gain": 1.596,
		"durationMs": 480,
		"priority": 6,
		"maxInstances": 3,
		"cooldownMs": 0,
		"loop": false
	},
	"ghat_flip_whoosh": {
		"id": "ghat_flip_whoosh",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/ghat_flip_whoosh.ogg",
			"assets/audio/lucky/ghat_flip_whoosh.m4a"
		],
		"gain": 0.544,
		"durationMs": 1778.1,
		"priority": 8,
		"maxInstances": 2,
		"cooldownMs": 0,
		"loop": false
	},
	"ghat_flip_whoosh_turbo": {
		"id": "ghat_flip_whoosh_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/ghat_flip_whoosh_turbo.ogg",
			"assets/audio/lucky/ghat_flip_whoosh_turbo.m4a"
		],
		"gain": 0.922,
		"durationMs": 758,
		"priority": 8,
		"maxInstances": 2,
		"cooldownMs": 0,
		"loop": false
	},
	"ghat_energy_crack": {
		"id": "ghat_energy_crack",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/ghat_energy_crack.ogg",
			"assets/audio/lucky/ghat_energy_crack.m4a"
		],
		"gain": 0.722,
		"durationMs": 1000,
		"priority": 8,
		"maxInstances": 3,
		"cooldownMs": 0,
		"loop": false
	},
	"ghat_land": {
		"id": "ghat_land",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/ghat_land.ogg",
			"assets/audio/lucky/ghat_land.m4a"
		],
		"gain": 1.553,
		"durationMs": 880,
		"priority": 8,
		"maxInstances": 2,
		"cooldownMs": 0,
		"loop": false
	},
	"ghat_glint": {
		"id": "ghat_glint",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/ghat_glint.ogg",
			"assets/audio/lucky/ghat_glint.m4a"
		],
		"gain": 1.025,
		"durationMs": 480,
		"priority": 4,
		"maxInstances": 3,
		"cooldownMs": 200,
		"loop": false
	},
	"golden_trigger": {
		"id": "golden_trigger",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/golden_trigger.ogg",
			"assets/audio/lucky/golden_trigger.m4a"
		],
		"gain": 0.828,
		"durationMs": 1760,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"hat_ladder_1": {
		"id": "hat_ladder_1",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/hat_ladder_1.ogg",
			"assets/audio/lucky/hat_ladder_1.m4a"
		],
		"gain": 1.155,
		"durationMs": 317.1,
		"priority": 6,
		"maxInstances": 3,
		"cooldownMs": 0,
		"loop": false
	},
	"hat_ladder_2": {
		"id": "hat_ladder_2",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/hat_ladder_2.ogg",
			"assets/audio/lucky/hat_ladder_2.m4a"
		],
		"gain": 1.209,
		"durationMs": 310,
		"priority": 6,
		"maxInstances": 3,
		"cooldownMs": 0,
		"loop": false
	},
	"hat_ladder_3": {
		"id": "hat_ladder_3",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/hat_ladder_3.ogg",
			"assets/audio/lucky/hat_ladder_3.m4a"
		],
		"gain": 1.289,
		"durationMs": 313,
		"priority": 6,
		"maxInstances": 3,
		"cooldownMs": 0,
		"loop": false
	},
	"hat_ladder_4": {
		"id": "hat_ladder_4",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/hat_ladder_4.ogg",
			"assets/audio/lucky/hat_ladder_4.m4a"
		],
		"gain": 1.383,
		"durationMs": 309.5,
		"priority": 6,
		"maxInstances": 3,
		"cooldownMs": 0,
		"loop": false
	},
	"hat_ladder_5": {
		"id": "hat_ladder_5",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/hat_ladder_5.ogg",
			"assets/audio/lucky/hat_ladder_5.m4a"
		],
		"gain": 1.436,
		"durationMs": 299.1,
		"priority": 6,
		"maxInstances": 3,
		"cooldownMs": 0,
		"loop": false
	},
	"tension_1": {
		"id": "tension_1",
		"bus": "music",
		"files": [
			"assets/audio/lucky/tension_1.ogg",
			"assets/audio/lucky/tension_1.m4a"
		],
		"gain": 0.726,
		"durationMs": 10000,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 0,
		"loopEndMs": 10000,
		"tempoBpm": 96
	},
	"tension_2": {
		"id": "tension_2",
		"bus": "music",
		"files": [
			"assets/audio/lucky/tension_2.ogg",
			"assets/audio/lucky/tension_2.m4a"
		],
		"gain": 0.746,
		"durationMs": 10000,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 0,
		"loopEndMs": 10000,
		"tempoBpm": 96
	},
	"tension_3": {
		"id": "tension_3",
		"bus": "music",
		"files": [
			"assets/audio/lucky/tension_3.ogg",
			"assets/audio/lucky/tension_3.m4a"
		],
		"gain": 1.145,
		"durationMs": 10000,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 0,
		"loopEndMs": 10000,
		"tempoBpm": 96
	},
	"tension_hit": {
		"id": "tension_hit",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/tension_hit.ogg",
			"assets/audio/lucky/tension_hit.m4a"
		],
		"gain": 0.779,
		"durationMs": 1282.3,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"tension_miss": {
		"id": "tension_miss",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/tension_miss.ogg",
			"assets/audio/lucky/tension_miss.m4a"
		],
		"gain": 0.854,
		"durationMs": 871.5,
		"priority": 6,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"tension_gold": {
		"id": "tension_gold",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/tension_gold.ogg",
			"assets/audio/lucky/tension_gold.m4a"
		],
		"gain": 1.637,
		"durationMs": 3000,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 0,
		"loopEndMs": 3000
	},
	"last_spin": {
		"id": "last_spin",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/last_spin.ogg",
			"assets/audio/lucky/last_spin.m4a"
		],
		"gain": 0.902,
		"durationMs": 881.3,
		"priority": 7,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"near_full_shimmer": {
		"id": "near_full_shimmer",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/near_full_shimmer.ogg",
			"assets/audio/lucky/near_full_shimmer.m4a"
		],
		"gain": 0.7,
		"durationMs": 5700,
		"priority": 7,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 0,
		"loopEndMs": 5700
	},
	"door_roll": {
		"id": "door_roll",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/door_roll.ogg",
			"assets/audio/lucky/door_roll.m4a"
		],
		"gain": 0.931,
		"durationMs": 3800,
		"priority": 7,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 0,
		"loopEndMs": 3800
	},
	"door_chime_src": {
		"id": "door_chime_src",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/door_chime_src.ogg",
			"assets/audio/lucky/door_chime_src.m4a"
		],
		"gain": 0.826,
		"durationMs": 880,
		"priority": 5,
		"maxInstances": 4,
		"cooldownMs": 0,
		"loop": false
	},
	"door_chime_1": {
		"id": "door_chime_1",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/door_chime_1.ogg",
			"assets/audio/lucky/door_chime_1.m4a"
		],
		"gain": 0.826,
		"durationMs": 880,
		"priority": 6,
		"maxInstances": 4,
		"cooldownMs": 20,
		"loop": false
	},
	"door_chime_2": {
		"id": "door_chime_2",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/door_chime_2.ogg",
			"assets/audio/lucky/door_chime_2.m4a"
		],
		"gain": 0.837,
		"durationMs": 874.1,
		"priority": 6,
		"maxInstances": 4,
		"cooldownMs": 20,
		"loop": false
	},
	"door_chime_3": {
		"id": "door_chime_3",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/door_chime_3.ogg",
			"assets/audio/lucky/door_chime_3.m4a"
		],
		"gain": 0.837,
		"durationMs": 875.6,
		"priority": 6,
		"maxInstances": 4,
		"cooldownMs": 20,
		"loop": false
	},
	"door_chime_4": {
		"id": "door_chime_4",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/door_chime_4.ogg",
			"assets/audio/lucky/door_chime_4.m4a"
		],
		"gain": 0.839,
		"durationMs": 870.2,
		"priority": 6,
		"maxInstances": 4,
		"cooldownMs": 20,
		"loop": false
	},
	"door_chime_5": {
		"id": "door_chime_5",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/door_chime_5.ogg",
			"assets/audio/lucky/door_chime_5.m4a"
		],
		"gain": 0.847,
		"durationMs": 869.7,
		"priority": 6,
		"maxInstances": 4,
		"cooldownMs": 20,
		"loop": false
	},
	"door_chime_6": {
		"id": "door_chime_6",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/door_chime_6.ogg",
			"assets/audio/lucky/door_chime_6.m4a"
		],
		"gain": 0.849,
		"durationMs": 855.3,
		"priority": 6,
		"maxInstances": 4,
		"cooldownMs": 20,
		"loop": false
	},
	"door_chime_7": {
		"id": "door_chime_7",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/door_chime_7.ogg",
			"assets/audio/lucky/door_chime_7.m4a"
		],
		"gain": 0.861,
		"durationMs": 850.5,
		"priority": 6,
		"maxInstances": 4,
		"cooldownMs": 20,
		"loop": false
	},
	"door_chime_8": {
		"id": "door_chime_8",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/door_chime_8.ogg",
			"assets/audio/lucky/door_chime_8.m4a"
		],
		"gain": 0.869,
		"durationMs": 842,
		"priority": 6,
		"maxInstances": 4,
		"cooldownMs": 20,
		"loop": false
	},
	"rung_bed_big": {
		"id": "rung_bed_big",
		"bus": "music",
		"files": [
			"assets/audio/lucky/rung_bed_big.ogg",
			"assets/audio/lucky/rung_bed_big.m4a"
		],
		"gain": 1,
		"durationMs": 20000,
		"priority": 10,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 0,
		"loopEndMs": 20000,
		"tempoBpm": 96
	},
	"rung_bed_super": {
		"id": "rung_bed_super",
		"bus": "music",
		"files": [
			"assets/audio/lucky/rung_bed_super.ogg",
			"assets/audio/lucky/rung_bed_super.m4a"
		],
		"gain": 1,
		"durationMs": 20000,
		"priority": 10,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 0,
		"loopEndMs": 20000,
		"tempoBpm": 96
	},
	"rung_bed_mega": {
		"id": "rung_bed_mega",
		"bus": "music",
		"files": [
			"assets/audio/lucky/rung_bed_mega.ogg",
			"assets/audio/lucky/rung_bed_mega.m4a"
		],
		"gain": 1,
		"durationMs": 20000,
		"priority": 10,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 0,
		"loopEndMs": 20000,
		"tempoBpm": 96
	},
	"rung_bed_epic": {
		"id": "rung_bed_epic",
		"bus": "music",
		"files": [
			"assets/audio/lucky/rung_bed_epic.ogg",
			"assets/audio/lucky/rung_bed_epic.m4a"
		],
		"gain": 1,
		"durationMs": 20000,
		"priority": 10,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 0,
		"loopEndMs": 20000,
		"tempoBpm": 96
	},
	"rung_bed_max": {
		"id": "rung_bed_max",
		"bus": "music",
		"files": [
			"assets/audio/lucky/rung_bed_max.ogg",
			"assets/audio/lucky/rung_bed_max.m4a"
		],
		"gain": 1,
		"durationMs": 20000,
		"priority": 11,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 0,
		"loopEndMs": 20000,
		"tempoBpm": 96
	},
	"rung_hit_big": {
		"id": "rung_hit_big",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/rung_hit_big.ogg",
			"assets/audio/lucky/rung_hit_big.m4a"
		],
		"gain": 1.906,
		"durationMs": 937,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"rung_hit_super": {
		"id": "rung_hit_super",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/rung_hit_super.ogg",
			"assets/audio/lucky/rung_hit_super.m4a"
		],
		"gain": 1.036,
		"durationMs": 1216.4,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"rung_hit_mega": {
		"id": "rung_hit_mega",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/rung_hit_mega.ogg",
			"assets/audio/lucky/rung_hit_mega.m4a"
		],
		"gain": 0.936,
		"durationMs": 1540.7,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"rung_hit_epic": {
		"id": "rung_hit_epic",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/rung_hit_epic.ogg",
			"assets/audio/lucky/rung_hit_epic.m4a"
		],
		"gain": 0.985,
		"durationMs": 1713.2,
		"priority": 10,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"rung_hit_max": {
		"id": "rung_hit_max",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/rung_hit_max.ogg",
			"assets/audio/lucky/rung_hit_max.m4a"
		],
		"gain": 1.042,
		"durationMs": 2324.9,
		"priority": 11,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"count_ticker": {
		"id": "count_ticker",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/count_ticker.ogg",
			"assets/audio/lucky/count_ticker.m4a"
		],
		"gain": 0.563,
		"durationMs": 250,
		"priority": 5,
		"maxInstances": 6,
		"cooldownMs": 20,
		"loop": false
	},
	"count_ticker_1": {
		"id": "count_ticker_1",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/count_ticker_1.ogg",
			"assets/audio/lucky/count_ticker_1.m4a"
		],
		"gain": 0.563,
		"durationMs": 250,
		"priority": 5,
		"maxInstances": 6,
		"cooldownMs": 15,
		"loop": false
	},
	"count_ticker_2": {
		"id": "count_ticker_2",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/count_ticker_2.ogg",
			"assets/audio/lucky/count_ticker_2.m4a"
		],
		"gain": 0.562,
		"durationMs": 222.7,
		"priority": 5,
		"maxInstances": 6,
		"cooldownMs": 15,
		"loop": false
	},
	"count_ticker_3": {
		"id": "count_ticker_3",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/count_ticker_3.ogg",
			"assets/audio/lucky/count_ticker_3.m4a"
		],
		"gain": 0.562,
		"durationMs": 198.4,
		"priority": 5,
		"maxInstances": 6,
		"cooldownMs": 15,
		"loop": false
	},
	"count_ticker_4": {
		"id": "count_ticker_4",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/count_ticker_4.ogg",
			"assets/audio/lucky/count_ticker_4.m4a"
		],
		"gain": 0.563,
		"durationMs": 166.9,
		"priority": 5,
		"maxInstances": 6,
		"cooldownMs": 15,
		"loop": false
	},
	"count_ticker_5": {
		"id": "count_ticker_5",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/count_ticker_5.ogg",
			"assets/audio/lucky/count_ticker_5.m4a"
		],
		"gain": 0.562,
		"durationMs": 148.7,
		"priority": 5,
		"maxInstances": 6,
		"cooldownMs": 15,
		"loop": false
	},
	"count_ticker_6": {
		"id": "count_ticker_6",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/count_ticker_6.ogg",
			"assets/audio/lucky/count_ticker_6.m4a"
		],
		"gain": 0.563,
		"durationMs": 125,
		"priority": 5,
		"maxInstances": 6,
		"cooldownMs": 15,
		"loop": false
	},
	"count_ticker_7": {
		"id": "count_ticker_7",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/count_ticker_7.ogg",
			"assets/audio/lucky/count_ticker_7.m4a"
		],
		"gain": 0.562,
		"durationMs": 111.4,
		"priority": 5,
		"maxInstances": 6,
		"cooldownMs": 15,
		"loop": false
	},
	"count_ticker_8": {
		"id": "count_ticker_8",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/count_ticker_8.ogg",
			"assets/audio/lucky/count_ticker_8.m4a"
		],
		"gain": 0.563,
		"durationMs": 99.2,
		"priority": 5,
		"maxInstances": 6,
		"cooldownMs": 15,
		"loop": false
	},
	"count_ticker_9": {
		"id": "count_ticker_9",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/count_ticker_9.ogg",
			"assets/audio/lucky/count_ticker_9.m4a"
		],
		"gain": 0.563,
		"durationMs": 83.4,
		"priority": 5,
		"maxInstances": 6,
		"cooldownMs": 15,
		"loop": false
	},
	"count_ticker_10": {
		"id": "count_ticker_10",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/count_ticker_10.ogg",
			"assets/audio/lucky/count_ticker_10.m4a"
		],
		"gain": 0.561,
		"durationMs": 74.3,
		"priority": 5,
		"maxInstances": 6,
		"cooldownMs": 15,
		"loop": false
	},
	"count_ticker_11": {
		"id": "count_ticker_11",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/count_ticker_11.ogg",
			"assets/audio/lucky/count_ticker_11.m4a"
		],
		"gain": 0.562,
		"durationMs": 62.5,
		"priority": 5,
		"maxInstances": 6,
		"cooldownMs": 15,
		"loop": false
	},
	"count_ticker_12": {
		"id": "count_ticker_12",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/count_ticker_12.ogg",
			"assets/audio/lucky/count_ticker_12.m4a"
		],
		"gain": 0.563,
		"durationMs": 55.7,
		"priority": 5,
		"maxInstances": 6,
		"cooldownMs": 15,
		"loop": false
	},
	"rung_flare": {
		"id": "rung_flare",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/rung_flare.ogg",
			"assets/audio/lucky/rung_flare.m4a"
		],
		"gain": 1.023,
		"durationMs": 480,
		"priority": 6,
		"maxInstances": 3,
		"cooldownMs": 30,
		"loop": false
	},
	"sign_impact_timber": {
		"id": "sign_impact_timber",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/sign_impact_timber.ogg",
			"assets/audio/lucky/sign_impact_timber.m4a"
		],
		"gain": 1.075,
		"durationMs": 1000,
		"priority": 7,
		"maxInstances": 2,
		"cooldownMs": 0,
		"loop": false
	},
	"sign_impact_brick": {
		"id": "sign_impact_brick",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/sign_impact_brick.ogg",
			"assets/audio/lucky/sign_impact_brick.m4a"
		],
		"gain": 1.303,
		"durationMs": 982.9,
		"priority": 7,
		"maxInstances": 2,
		"cooldownMs": 0,
		"loop": false
	},
	"sign_impact_stone": {
		"id": "sign_impact_stone",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/sign_impact_stone.ogg",
			"assets/audio/lucky/sign_impact_stone.m4a"
		],
		"gain": 1.173,
		"durationMs": 1000,
		"priority": 7,
		"maxInstances": 2,
		"cooldownMs": 0,
		"loop": false
	},
	"sign_impact_palace": {
		"id": "sign_impact_palace",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/sign_impact_palace.ogg",
			"assets/audio/lucky/sign_impact_palace.m4a"
		],
		"gain": 0.902,
		"durationMs": 1000,
		"priority": 7,
		"maxInstances": 2,
		"cooldownMs": 0,
		"loop": false
	},
	"sign_impact_gold": {
		"id": "sign_impact_gold",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/sign_impact_gold.ogg",
			"assets/audio/lucky/sign_impact_gold.m4a"
		],
		"gain": 1.11,
		"durationMs": 1000,
		"priority": 8,
		"maxInstances": 2,
		"cooldownMs": 0,
		"loop": false
	},
	"bolt_pop_1": {
		"id": "bolt_pop_1",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/bolt_pop_1.ogg",
			"assets/audio/lucky/bolt_pop_1.m4a"
		],
		"gain": 1.087,
		"durationMs": 480,
		"priority": 5,
		"maxInstances": 4,
		"cooldownMs": 0,
		"loop": false
	},
	"bolt_pop_2": {
		"id": "bolt_pop_2",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/bolt_pop_2.ogg",
			"assets/audio/lucky/bolt_pop_2.m4a"
		],
		"gain": 1.419,
		"durationMs": 480,
		"priority": 5,
		"maxInstances": 4,
		"cooldownMs": 0,
		"loop": false
	},
	"bolt_pop_3": {
		"id": "bolt_pop_3",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/bolt_pop_3.ogg",
			"assets/audio/lucky/bolt_pop_3.m4a"
		],
		"gain": 1.685,
		"durationMs": 419.1,
		"priority": 5,
		"maxInstances": 4,
		"cooldownMs": 0,
		"loop": false
	},
	"burst_wood": {
		"id": "burst_wood",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/burst_wood.ogg",
			"assets/audio/lucky/burst_wood.m4a"
		],
		"gain": 1.767,
		"durationMs": 1254.9,
		"priority": 7,
		"maxInstances": 2,
		"cooldownMs": 0,
		"loop": false
	},
	"burst_brick": {
		"id": "burst_brick",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/burst_brick.ogg",
			"assets/audio/lucky/burst_brick.m4a"
		],
		"gain": 1.721,
		"durationMs": 1280,
		"priority": 7,
		"maxInstances": 2,
		"cooldownMs": 0,
		"loop": false
	},
	"burst_stone": {
		"id": "burst_stone",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/burst_stone.ogg",
			"assets/audio/lucky/burst_stone.m4a"
		],
		"gain": 0.786,
		"durationMs": 1128.9,
		"priority": 7,
		"maxInstances": 2,
		"cooldownMs": 0,
		"loop": false
	},
	"burst_coins": {
		"id": "burst_coins",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/burst_coins.ogg",
			"assets/audio/lucky/burst_coins.m4a"
		],
		"gain": 1.497,
		"durationMs": 1197.3,
		"priority": 7,
		"maxInstances": 2,
		"cooldownMs": 0,
		"loop": false
	},
	"burst_gold": {
		"id": "burst_gold",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/burst_gold.ogg",
			"assets/audio/lucky/burst_gold.m4a"
		],
		"gain": 0.725,
		"durationMs": 1280,
		"priority": 8,
		"maxInstances": 2,
		"cooldownMs": 0,
		"loop": false
	},
	"rung_land": {
		"id": "rung_land",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/rung_land.ogg",
			"assets/audio/lucky/rung_land.m4a"
		],
		"gain": 1.107,
		"durationMs": 2000,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"rung_out": {
		"id": "rung_out",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/rung_out.ogg",
			"assets/audio/lucky/rung_out.m4a"
		],
		"gain": 1.44,
		"durationMs": 560.5,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 0,
		"loop": false
	},
	"wolf_peek": {
		"id": "wolf_peek",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/wolf_peek.ogg",
			"assets/audio/lucky/wolf_peek.m4a"
		],
		"gain": 1.158,
		"durationMs": 800,
		"priority": 7,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"wolf_inhale": {
		"id": "wolf_inhale",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/wolf_inhale.ogg",
			"assets/audio/lucky/wolf_inhale.m4a"
		],
		"gain": 0.913,
		"durationMs": 800,
		"priority": 7,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"wolf_huff": {
		"id": "wolf_huff",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/wolf_huff.ogg",
			"assets/audio/lucky/wolf_huff.m4a"
		],
		"gain": 0.843,
		"durationMs": 1200,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"wolf_defeated": {
		"id": "wolf_defeated",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/wolf_defeated.ogg",
			"assets/audio/lucky/wolf_defeated.m4a"
		],
		"gain": 0.924,
		"durationMs": 1360,
		"priority": 7,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"gust_sweep": {
		"id": "gust_sweep",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/gust_sweep.ogg",
			"assets/audio/lucky/gust_sweep.m4a"
		],
		"gain": 1.279,
		"durationMs": 1000.3,
		"priority": 7,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"pig_brace": {
		"id": "pig_brace",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/pig_brace.ogg",
			"assets/audio/lucky/pig_brace.m4a"
		],
		"gain": 1.151,
		"durationMs": 600,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 0,
		"loop": false
	},
	"wolf_inhale_turbo": {
		"id": "wolf_inhale_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/wolf_inhale_turbo.ogg",
			"assets/audio/lucky/wolf_inhale_turbo.m4a"
		],
		"gain": 1.291,
		"durationMs": 416,
		"priority": 7,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"wolf_huff_turbo": {
		"id": "wolf_huff_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/wolf_huff_turbo.ogg",
			"assets/audio/lucky/wolf_huff_turbo.m4a"
		],
		"gain": 1.315,
		"durationMs": 592,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"delivery_whistle": {
		"id": "delivery_whistle",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/delivery_whistle.ogg",
			"assets/audio/lucky/delivery_whistle.m4a"
		],
		"gain": 0.858,
		"durationMs": 1011.3,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"delivery_whistle_gold": {
		"id": "delivery_whistle_gold",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/delivery_whistle_gold.ogg",
			"assets/audio/lucky/delivery_whistle_gold.m4a"
		],
		"gain": 0.827,
		"durationMs": 1297.5,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"delivery_beacon_loop": {
		"id": "delivery_beacon_loop",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/delivery_beacon_loop.ogg",
			"assets/audio/lucky/delivery_beacon_loop.m4a"
		],
		"gain": 0.609,
		"durationMs": 2866.7,
		"priority": 6,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 0,
		"loopEndMs": 2866.7
	},
	"delivery_drum_build": {
		"id": "delivery_drum_build",
		"bus": "music",
		"files": [
			"assets/audio/lucky/delivery_drum_build.ogg",
			"assets/audio/lucky/delivery_drum_build.m4a"
		],
		"gain": 0.693,
		"durationMs": 11566.3,
		"priority": 10,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false,
		"tempoBpm": 83
	},
	"delivery_drum_build_turbo": {
		"id": "delivery_drum_build_turbo",
		"bus": "music",
		"files": [
			"assets/audio/lucky/delivery_drum_build_turbo.ogg",
			"assets/audio/lucky/delivery_drum_build_turbo.m4a"
		],
		"gain": 0.741,
		"durationMs": 5783.1,
		"priority": 10,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false,
		"tempoBpm": 83
	},
	"crane_swing": {
		"id": "crane_swing",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/crane_swing.ogg",
			"assets/audio/lucky/crane_swing.m4a"
		],
		"gain": 1.099,
		"durationMs": 1163.2,
		"priority": 7,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"crate_stop": {
		"id": "crate_stop",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/crate_stop.ogg",
			"assets/audio/lucky/crate_stop.m4a"
		],
		"gain": 1.171,
		"durationMs": 519.9,
		"priority": 7,
		"maxInstances": 2,
		"cooldownMs": 0,
		"loop": false
	},
	"crate_burst": {
		"id": "crate_burst",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/crate_burst.ogg",
			"assets/audio/lucky/crate_burst.m4a"
		],
		"gain": 1.23,
		"durationMs": 653.1,
		"priority": 8,
		"maxInstances": 2,
		"cooldownMs": 0,
		"loop": false
	},
	"sym_win_h1": {
		"id": "sym_win_h1",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/sym_win_h1.ogg",
			"assets/audio/lucky/sym_win_h1.m4a"
		],
		"gain": 1.141,
		"durationMs": 1013.9,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 90,
		"loop": false
	},
	"sym_win_h2": {
		"id": "sym_win_h2",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/sym_win_h2.ogg",
			"assets/audio/lucky/sym_win_h2.m4a"
		],
		"gain": 1.1,
		"durationMs": 657.1,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 90,
		"loop": false
	},
	"sym_win_h3": {
		"id": "sym_win_h3",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/sym_win_h3.ogg",
			"assets/audio/lucky/sym_win_h3.m4a"
		],
		"gain": 1.574,
		"durationMs": 608.3,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 90,
		"loop": false
	},
	"sym_win_h4": {
		"id": "sym_win_h4",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/sym_win_h4.ogg",
			"assets/audio/lucky/sym_win_h4.m4a"
		],
		"gain": 1.75,
		"durationMs": 614.4,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 90,
		"loop": false
	},
	"sym_win_l1": {
		"id": "sym_win_l1",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/sym_win_l1.ogg",
			"assets/audio/lucky/sym_win_l1.m4a"
		],
		"gain": 1.982,
		"durationMs": 580,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 90,
		"loop": false
	},
	"sym_win_l2": {
		"id": "sym_win_l2",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/sym_win_l2.ogg",
			"assets/audio/lucky/sym_win_l2.m4a"
		],
		"gain": 1.641,
		"durationMs": 600,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 90,
		"loop": false
	},
	"sym_win_l3": {
		"id": "sym_win_l3",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/sym_win_l3.ogg",
			"assets/audio/lucky/sym_win_l3.m4a"
		],
		"gain": 1.007,
		"durationMs": 600,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 90,
		"loop": false
	},
	"sym_win_w": {
		"id": "sym_win_w",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/sym_win_w.ogg",
			"assets/audio/lucky/sym_win_w.m4a"
		],
		"gain": 1.231,
		"durationMs": 699.5,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 90,
		"loop": false
	},
	"way_win_small": {
		"id": "way_win_small",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/way_win_small.ogg",
			"assets/audio/lucky/way_win_small.m4a"
		],
		"gain": 0.863,
		"durationMs": 680,
		"priority": 7,
		"maxInstances": 1,
		"cooldownMs": 120,
		"loop": false
	},
	"way_win_mid": {
		"id": "way_win_mid",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/way_win_mid.ogg",
			"assets/audio/lucky/way_win_mid.m4a"
		],
		"gain": 0.871,
		"durationMs": 880,
		"priority": 7,
		"maxInstances": 1,
		"cooldownMs": 120,
		"loop": false
	},
	"antic_riser": {
		"id": "antic_riser",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/antic_riser.ogg",
			"assets/audio/lucky/antic_riser.m4a"
		],
		"gain": 0.667,
		"durationMs": 2300.1,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 400,
		"loop": false
	},
	"spin_whoosh": {
		"id": "spin_whoosh",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/spin_whoosh.ogg",
			"assets/audio/lucky/spin_whoosh.m4a"
		],
		"gain": 0.536,
		"durationMs": 493.3,
		"priority": 5,
		"maxInstances": 1,
		"cooldownMs": 300,
		"loop": false
	},
	"dead_spin_settle": {
		"id": "dead_spin_settle",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/dead_spin_settle.ogg",
			"assets/audio/lucky/dead_spin_settle.m4a"
		],
		"gain": 0.476,
		"durationMs": 480,
		"priority": 4,
		"maxInstances": 1,
		"cooldownMs": 200,
		"loop": false
	},
	"trigger_fanfare": {
		"id": "trigger_fanfare",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/trigger_fanfare.ogg",
			"assets/audio/lucky/trigger_fanfare.m4a"
		],
		"gain": 1.267,
		"durationMs": 2210,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 1000,
		"loop": false
	},
	"hat_land_heavy": {
		"id": "hat_land_heavy",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/hat_land_heavy.ogg",
			"assets/audio/lucky/hat_land_heavy.m4a"
		],
		"gain": 1.603,
		"durationMs": 680,
		"priority": 6,
		"maxInstances": 3,
		"cooldownMs": 0,
		"loop": false
	},
	"reel_spin_loop": {
		"id": "reel_spin_loop",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/reel_spin_loop.ogg",
			"assets/audio/lucky/reel_spin_loop.m4a"
		],
		"gain": 0.805,
		"durationMs": 2400,
		"priority": 4,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 0,
		"loopEndMs": 2400
	},
	"ambient_site_loop": {
		"id": "ambient_site_loop",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/ambient_site_loop.ogg",
			"assets/audio/lucky/ambient_site_loop.m4a"
		],
		"gain": 0.807,
		"durationMs": 13000,
		"priority": 2,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 0,
		"loopEndMs": 13000
	},
	"expanded_build_loop": {
		"id": "expanded_build_loop",
		"bus": "music",
		"files": [
			"assets/audio/lucky/expanded_build_loop.ogg",
			"assets/audio/lucky/expanded_build_loop.m4a"
		],
		"gain": 1,
		"durationMs": 78367.3,
		"priority": 10,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 0,
		"loopEndMs": 78367.3,
		"tempoBpm": 98
	},
	"golden_expanded_loop": {
		"id": "golden_expanded_loop",
		"bus": "music",
		"files": [
			"assets/audio/lucky/golden_expanded_loop.ogg",
			"assets/audio/lucky/golden_expanded_loop.m4a"
		],
		"gain": 1,
		"durationMs": 76800,
		"priority": 10,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 0,
		"loopEndMs": 76800,
		"tempoBpm": 100
	},
	"expand_open": {
		"id": "expand_open",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/expand_open.ogg",
			"assets/audio/lucky/expand_open.m4a"
		],
		"gain": 1.1,
		"durationMs": 1854.4,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 500,
		"loop": false
	},
	"board_unlock": {
		"id": "board_unlock",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/board_unlock.ogg",
			"assets/audio/lucky/board_unlock.m4a"
		],
		"gain": 1.996,
		"durationMs": 574.9,
		"priority": 8,
		"maxInstances": 3,
		"cooldownMs": 80,
		"loop": false
	},
	"board_complete": {
		"id": "board_complete",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/board_complete.ogg",
			"assets/audio/lucky/board_complete.m4a"
		],
		"gain": 0.766,
		"durationMs": 1352.8,
		"priority": 7,
		"maxInstances": 2,
		"cooldownMs": 200,
		"loop": false
	},
	"expand_stinger": {
		"id": "expand_stinger",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/expand_stinger.ogg",
			"assets/audio/lucky/expand_stinger.m4a"
		],
		"gain": 1.295,
		"durationMs": 2416.6,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 1000,
		"loop": false
	},
	"golden_expand_stinger": {
		"id": "golden_expand_stinger",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/golden_expand_stinger.ogg",
			"assets/audio/lucky/golden_expand_stinger.m4a"
		],
		"gain": 0.914,
		"durationMs": 2760,
		"priority": 10,
		"maxInstances": 1,
		"cooldownMs": 1000,
		"loop": false
	},
	"base_loop_b": {
		"id": "base_loop_b",
		"bus": "music",
		"files": [
			"assets/audio/lucky/base_loop_b.ogg",
			"assets/audio/lucky/base_loop_b.m4a"
		],
		"gain": 1,
		"durationMs": 92530.2,
		"priority": 10,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 0,
		"loopEndMs": 92530.2,
		"tempoBpm": 83
	},
	"permit_reel_start": {
		"id": "permit_reel_start",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/permit_reel_start.ogg",
			"assets/audio/lucky/permit_reel_start.m4a"
		],
		"gain": 1.842,
		"durationMs": 937.9,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 300,
		"loop": false
	},
	"permit_reel_slow": {
		"id": "permit_reel_slow",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/permit_reel_slow.ogg",
			"assets/audio/lucky/permit_reel_slow.m4a"
		],
		"gain": 1.99,
		"durationMs": 406,
		"priority": 7,
		"maxInstances": 3,
		"cooldownMs": 40,
		"loop": false
	},
	"permit_reel_stop": {
		"id": "permit_reel_stop",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/permit_reel_stop.ogg",
			"assets/audio/lucky/permit_reel_stop.m4a"
		],
		"gain": 1.487,
		"durationMs": 660.6,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 200,
		"loop": false
	},
	"permit_stamp": {
		"id": "permit_stamp",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/permit_stamp.ogg",
			"assets/audio/lucky/permit_stamp.m4a"
		],
		"gain": 1.25,
		"durationMs": 1012.1,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 400,
		"loop": false
	},
	"gpermit_reel_stop": {
		"id": "gpermit_reel_stop",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/gpermit_reel_stop.ogg",
			"assets/audio/lucky/gpermit_reel_stop.m4a"
		],
		"gain": 1.143,
		"durationMs": 768.3,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 200,
		"loop": false
	},
	"gpermit_stamp": {
		"id": "gpermit_stamp",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/gpermit_stamp.ogg",
			"assets/audio/lucky/gpermit_stamp.m4a"
		],
		"gain": 1.038,
		"durationMs": 1584.9,
		"priority": 10,
		"maxInstances": 1,
		"cooldownMs": 400,
		"loop": false
	},
	"permit_reel_tick": {
		"id": "permit_reel_tick",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/permit_reel_tick.ogg",
			"assets/audio/lucky/permit_reel_tick.m4a"
		],
		"gain": 1.858,
		"durationMs": 1200,
		"priority": 5,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 0,
		"loopEndMs": 1200
	},
	"site_stamp": {
		"id": "site_stamp",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/site_stamp.ogg",
			"assets/audio/lucky/site_stamp.m4a"
		],
		"gain": 1.776,
		"durationMs": 377.9,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 300,
		"loop": false
	},
	"gsite_stamp": {
		"id": "gsite_stamp",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/gsite_stamp.ogg",
			"assets/audio/lucky/gsite_stamp.m4a"
		],
		"gain": 1.388,
		"durationMs": 643.6,
		"priority": 10,
		"maxInstances": 1,
		"cooldownMs": 300,
		"loop": false
	},
	"sym_land_1": {
		"id": "sym_land_1",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/sym_land_1.ogg",
			"assets/audio/lucky/sym_land_1.m4a"
		],
		"gain": 1.119,
		"durationMs": 273.7,
		"priority": 7,
		"maxInstances": 3,
		"cooldownMs": 30,
		"loop": false
	},
	"sym_land_2": {
		"id": "sym_land_2",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/sym_land_2.ogg",
			"assets/audio/lucky/sym_land_2.m4a"
		],
		"gain": 1.038,
		"durationMs": 600,
		"priority": 7,
		"maxInstances": 3,
		"cooldownMs": 30,
		"loop": false
	},
	"sym_land_3": {
		"id": "sym_land_3",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/sym_land_3.ogg",
			"assets/audio/lucky/sym_land_3.m4a"
		],
		"gain": 1.982,
		"durationMs": 486.2,
		"priority": 7,
		"maxInstances": 3,
		"cooldownMs": 30,
		"loop": false
	},
	"blast_vacuum": {
		"id": "blast_vacuum",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/blast_vacuum.ogg",
			"assets/audio/lucky/blast_vacuum.m4a"
		],
		"gain": 0.558,
		"durationMs": 397.2,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 400,
		"loop": false
	},
	"blast_impact": {
		"id": "blast_impact",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/blast_impact.ogg",
			"assets/audio/lucky/blast_impact.m4a"
		],
		"gain": 1.012,
		"durationMs": 1100,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 300,
		"loop": false
	},
	"blast_reveal": {
		"id": "blast_reveal",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/blast_reveal.ogg",
			"assets/audio/lucky/blast_reveal.m4a"
		],
		"gain": 0.386,
		"durationMs": 900,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 400,
		"loop": false
	},
	"shutter_slam": {
		"id": "shutter_slam",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/shutter_slam.ogg",
			"assets/audio/lucky/shutter_slam.m4a"
		],
		"gain": 1.542,
		"durationMs": 704.9,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 250,
		"loop": false
	},
	"shutter_haul_1": {
		"id": "shutter_haul_1",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/shutter_haul_1.ogg",
			"assets/audio/lucky/shutter_haul_1.m4a"
		],
		"gain": 0.552,
		"durationMs": 450,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 60,
		"loop": false
	},
	"shutter_haul_2": {
		"id": "shutter_haul_2",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/shutter_haul_2.ogg",
			"assets/audio/lucky/shutter_haul_2.m4a"
		],
		"gain": 0.616,
		"durationMs": 450,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 60,
		"loop": false
	},
	"shutter_haul_3": {
		"id": "shutter_haul_3",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/shutter_haul_3.ogg",
			"assets/audio/lucky/shutter_haul_3.m4a"
		],
		"gain": 0.452,
		"durationMs": 650,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 60,
		"loop": false
	},
	"street_bonus": {
		"id": "street_bonus",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/street_bonus.ogg",
			"assets/audio/lucky/street_bonus.m4a"
		],
		"gain": 0.824,
		"durationMs": 1600,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 200,
		"loop": false
	},
	"grand_festival": {
		"id": "grand_festival",
		"bus": "sfx",
		"files": [
			"assets/audio/lucky/grand_festival.ogg",
			"assets/audio/lucky/grand_festival.m4a"
		],
		"gain": 1.002,
		"durationMs": 2719.3,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 1000,
		"loop": false
	}
};

export type CueId = keyof typeof CUES;
