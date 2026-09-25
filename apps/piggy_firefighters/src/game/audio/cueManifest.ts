/**
 * GENERATED from /audio/cues.json by audio/tools/gen_manifest.mjs — do not hand-edit.
 * Re-run the generator if the manifest changes. One entry per cue; gains are the
 * pre-duck cue trims (the player's master/music/sfx gains sit OUTSIDE ducking).
 * Only cues whose ogg AND m4a exist in static/ are listed.
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
	"tempoBpm": 92,
	"targetBpm": 92,
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
	"base_loop_a": {
		"id": "base_loop_a",
		"bus": "music",
		"files": [
			"assets/audio/piggy_firefighters/base_loop_a.ogg",
			"assets/audio/piggy_firefighters/base_loop_a.m4a"
		],
		"gain": 1,
		"durationMs": 83598.3,
		"priority": 10,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 60,
		"loopEndMs": 83538.2766,
		"tempoBpm": 92
	},
	"base_loop_b": {
		"id": "base_loop_b",
		"bus": "music",
		"files": [
			"assets/audio/piggy_firefighters/base_loop_b.ogg",
			"assets/audio/piggy_firefighters/base_loop_b.m4a"
		],
		"gain": 1,
		"durationMs": 83598.3,
		"priority": 10,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 60,
		"loopEndMs": 83538.2766,
		"tempoBpm": 92
	},
	"rescue_loop": {
		"id": "rescue_loop",
		"bus": "music",
		"files": [
			"assets/audio/piggy_firefighters/rescue_loop.ogg",
			"assets/audio/piggy_firefighters/rescue_loop.m4a"
		],
		"gain": 1,
		"durationMs": 76920,
		"priority": 10,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 60,
		"loopEndMs": 76860,
		"tempoBpm": 100
	},
	"inferno_loop": {
		"id": "inferno_loop",
		"bus": "music",
		"files": [
			"assets/audio/piggy_firefighters/inferno_loop.ogg",
			"assets/audio/piggy_firefighters/inferno_loop.m4a"
		],
		"gain": 1,
		"durationMs": 76920,
		"priority": 10,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 60,
		"loopEndMs": 76860,
		"tempoBpm": 100
	},
	"anticipation_layer": {
		"id": "anticipation_layer",
		"bus": "music",
		"files": [
			"assets/audio/piggy_firefighters/anticipation_layer.ogg",
			"assets/audio/piggy_firefighters/anticipation_layer.m4a"
		],
		"gain": 0.4,
		"durationMs": 10554.8,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 60,
		"loopEndMs": 10494.7846,
		"tempoBpm": 92
	},
	"backdraft_spins_layer": {
		"id": "backdraft_spins_layer",
		"bus": "music",
		"files": [
			"assets/audio/piggy_firefighters/backdraft_spins_layer.ogg",
			"assets/audio/piggy_firefighters/backdraft_spins_layer.m4a"
		],
		"gain": 0.545,
		"durationMs": 31424.4,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 60,
		"loopEndMs": 31364.3537,
		"tempoBpm": 92
	},
	"rung_bed_big": {
		"id": "rung_bed_big",
		"bus": "music",
		"files": [
			"assets/audio/piggy_firefighters/rung_bed_big.ogg",
			"assets/audio/piggy_firefighters/rung_bed_big.m4a"
		],
		"gain": 1,
		"durationMs": 19320,
		"priority": 10,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 60,
		"loopEndMs": 19260,
		"tempoBpm": 100
	},
	"rung_bed_huge": {
		"id": "rung_bed_huge",
		"bus": "music",
		"files": [
			"assets/audio/piggy_firefighters/rung_bed_huge.ogg",
			"assets/audio/piggy_firefighters/rung_bed_huge.m4a"
		],
		"gain": 1,
		"durationMs": 19320,
		"priority": 10,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 60,
		"loopEndMs": 19260,
		"tempoBpm": 100
	},
	"rung_bed_mega": {
		"id": "rung_bed_mega",
		"bus": "music",
		"files": [
			"assets/audio/piggy_firefighters/rung_bed_mega.ogg",
			"assets/audio/piggy_firefighters/rung_bed_mega.m4a"
		],
		"gain": 1,
		"durationMs": 19320,
		"priority": 10,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 60,
		"loopEndMs": 19260,
		"tempoBpm": 100
	},
	"rung_bed_epic": {
		"id": "rung_bed_epic",
		"bus": "music",
		"files": [
			"assets/audio/piggy_firefighters/rung_bed_epic.ogg",
			"assets/audio/piggy_firefighters/rung_bed_epic.m4a"
		],
		"gain": 1,
		"durationMs": 19320,
		"priority": 10,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 60,
		"loopEndMs": 19260,
		"tempoBpm": 100
	},
	"rung_bed_max": {
		"id": "rung_bed_max",
		"bus": "music",
		"files": [
			"assets/audio/piggy_firefighters/rung_bed_max.ogg",
			"assets/audio/piggy_firefighters/rung_bed_max.m4a"
		],
		"gain": 1,
		"durationMs": 19320,
		"priority": 10,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 60,
		"loopEndMs": 19260,
		"tempoBpm": 100
	},
	"ui_click_1": {
		"id": "ui_click_1",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/ui_click_1.ogg",
			"assets/audio/piggy_firefighters/ui_click_1.m4a"
		],
		"gain": 0.916,
		"durationMs": 256.1,
		"priority": 3,
		"maxInstances": 4,
		"cooldownMs": 40,
		"loop": false
	},
	"ui_click_2": {
		"id": "ui_click_2",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/ui_click_2.ogg",
			"assets/audio/piggy_firefighters/ui_click_2.m4a"
		],
		"gain": 1.355,
		"durationMs": 336.7,
		"priority": 3,
		"maxInstances": 4,
		"cooldownMs": 40,
		"loop": false
	},
	"ui_click_3": {
		"id": "ui_click_3",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/ui_click_3.ogg",
			"assets/audio/piggy_firefighters/ui_click_3.m4a"
		],
		"gain": 0.954,
		"durationMs": 480,
		"priority": 3,
		"maxInstances": 4,
		"cooldownMs": 40,
		"loop": false
	},
	"bet_change": {
		"id": "bet_change",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/bet_change.ogg",
			"assets/audio/piggy_firefighters/bet_change.m4a"
		],
		"gain": 0.513,
		"durationMs": 480,
		"priority": 3,
		"maxInstances": 2,
		"cooldownMs": 60,
		"loop": false
	},
	"ante_on": {
		"id": "ante_on",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/ante_on.ogg",
			"assets/audio/piggy_firefighters/ante_on.m4a"
		],
		"gain": 1.916,
		"durationMs": 803.1,
		"priority": 4,
		"maxInstances": 1,
		"cooldownMs": 150,
		"loop": false
	},
	"ante_off": {
		"id": "ante_off",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/ante_off.ogg",
			"assets/audio/piggy_firefighters/ante_off.m4a"
		],
		"gain": 1.087,
		"durationMs": 800,
		"priority": 4,
		"maxInstances": 1,
		"cooldownMs": 150,
		"loop": false
	},
	"alert_insufficient": {
		"id": "alert_insufficient",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/alert_insufficient.ogg",
			"assets/audio/piggy_firefighters/alert_insufficient.m4a"
		],
		"gain": 1.465,
		"durationMs": 485.6,
		"priority": 6,
		"maxInstances": 1,
		"cooldownMs": 1500,
		"loop": false
	},
	"buy_confirm": {
		"id": "buy_confirm",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/buy_confirm.ogg",
			"assets/audio/piggy_firefighters/buy_confirm.m4a"
		],
		"gain": 1.15,
		"durationMs": 800.9,
		"priority": 6,
		"maxInstances": 1,
		"cooldownMs": 300,
		"loop": false
	},
	"spin_start": {
		"id": "spin_start",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/spin_start.ogg",
			"assets/audio/piggy_firefighters/spin_start.m4a"
		],
		"gain": 1.216,
		"durationMs": 462.5,
		"priority": 5,
		"maxInstances": 1,
		"cooldownMs": 80,
		"loop": false
	},
	"spin_whoosh": {
		"id": "spin_whoosh",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/spin_whoosh.ogg",
			"assets/audio/piggy_firefighters/spin_whoosh.m4a"
		],
		"gain": 0.392,
		"durationMs": 800,
		"priority": 4,
		"maxInstances": 1,
		"cooldownMs": 80,
		"loop": false
	},
	"reel_spin_loop": {
		"id": "reel_spin_loop",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/reel_spin_loop.ogg",
			"assets/audio/piggy_firefighters/reel_spin_loop.m4a"
		],
		"gain": 1.029,
		"durationMs": 2400,
		"priority": 4,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 0,
		"loopEndMs": 2400
	},
	"reel_stop_1": {
		"id": "reel_stop_1",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/reel_stop_1.ogg",
			"assets/audio/piggy_firefighters/reel_stop_1.m4a"
		],
		"gain": 0.72,
		"durationMs": 482.4,
		"priority": 5,
		"maxInstances": 2,
		"cooldownMs": 20,
		"loop": false
	},
	"reel_stop_2": {
		"id": "reel_stop_2",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/reel_stop_2.ogg",
			"assets/audio/piggy_firefighters/reel_stop_2.m4a"
		],
		"gain": 0.758,
		"durationMs": 466.5,
		"priority": 5,
		"maxInstances": 2,
		"cooldownMs": 20,
		"loop": false
	},
	"reel_stop_3": {
		"id": "reel_stop_3",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/reel_stop_3.ogg",
			"assets/audio/piggy_firefighters/reel_stop_3.m4a"
		],
		"gain": 0.777,
		"durationMs": 464.7,
		"priority": 5,
		"maxInstances": 2,
		"cooldownMs": 20,
		"loop": false
	},
	"reel_stop_4": {
		"id": "reel_stop_4",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/reel_stop_4.ogg",
			"assets/audio/piggy_firefighters/reel_stop_4.m4a"
		],
		"gain": 0.786,
		"durationMs": 476.4,
		"priority": 5,
		"maxInstances": 2,
		"cooldownMs": 20,
		"loop": false
	},
	"reel_stop_5": {
		"id": "reel_stop_5",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/reel_stop_5.ogg",
			"assets/audio/piggy_firefighters/reel_stop_5.m4a"
		],
		"gain": 0.793,
		"durationMs": 456.8,
		"priority": 5,
		"maxInstances": 2,
		"cooldownMs": 20,
		"loop": false
	},
	"reel_stop_turbo": {
		"id": "reel_stop_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/reel_stop_turbo.ogg",
			"assets/audio/piggy_firefighters/reel_stop_turbo.m4a"
		],
		"gain": 0.898,
		"durationMs": 494.4,
		"priority": 5,
		"maxInstances": 1,
		"cooldownMs": 120,
		"loop": false
	},
	"wild_land": {
		"id": "wild_land",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/wild_land.ogg",
			"assets/audio/piggy_firefighters/wild_land.m4a"
		],
		"gain": 0.988,
		"durationMs": 800,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 40,
		"loop": false
	},
	"alarm_land_1": {
		"id": "alarm_land_1",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/alarm_land_1.ogg",
			"assets/audio/piggy_firefighters/alarm_land_1.m4a"
		],
		"gain": 0.813,
		"durationMs": 900.4,
		"priority": 7,
		"maxInstances": 3,
		"cooldownMs": 0,
		"loop": false
	},
	"alarm_land_2": {
		"id": "alarm_land_2",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/alarm_land_2.ogg",
			"assets/audio/piggy_firefighters/alarm_land_2.m4a"
		],
		"gain": 0.819,
		"durationMs": 900.4,
		"priority": 7,
		"maxInstances": 3,
		"cooldownMs": 0,
		"loop": false
	},
	"alarm_land_3": {
		"id": "alarm_land_3",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/alarm_land_3.ogg",
			"assets/audio/piggy_firefighters/alarm_land_3.m4a"
		],
		"gain": 0.966,
		"durationMs": 900.4,
		"priority": 7,
		"maxInstances": 3,
		"cooldownMs": 0,
		"loop": false
	},
	"alarm_land_4": {
		"id": "alarm_land_4",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/alarm_land_4.ogg",
			"assets/audio/piggy_firefighters/alarm_land_4.m4a"
		],
		"gain": 0.916,
		"durationMs": 900.4,
		"priority": 7,
		"maxInstances": 3,
		"cooldownMs": 0,
		"loop": false
	},
	"alarm_land_5": {
		"id": "alarm_land_5",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/alarm_land_5.ogg",
			"assets/audio/piggy_firefighters/alarm_land_5.m4a"
		],
		"gain": 0.953,
		"durationMs": 900.4,
		"priority": 7,
		"maxInstances": 3,
		"cooldownMs": 0,
		"loop": false
	},
	"galarm_glint": {
		"id": "galarm_glint",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/galarm_glint.ogg",
			"assets/audio/piggy_firefighters/galarm_glint.m4a"
		],
		"gain": 0.717,
		"durationMs": 800,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 60,
		"loop": false
	},
	"dead_spin_settle": {
		"id": "dead_spin_settle",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/dead_spin_settle.ogg",
			"assets/audio/piggy_firefighters/dead_spin_settle.m4a"
		],
		"gain": 0.326,
		"durationMs": 600,
		"priority": 3,
		"maxInstances": 1,
		"cooldownMs": 200,
		"loop": false
	},
	"antic_riser": {
		"id": "antic_riser",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/antic_riser.ogg",
			"assets/audio/piggy_firefighters/antic_riser.m4a"
		],
		"gain": 0.942,
		"durationMs": 2401.3,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 400,
		"loop": false
	},
	"antic_riser_2": {
		"id": "antic_riser_2",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/antic_riser_2.ogg",
			"assets/audio/piggy_firefighters/antic_riser_2.m4a"
		],
		"gain": 1,
		"durationMs": 2387.9,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 400,
		"loop": false
	},
	"antic_miss": {
		"id": "antic_miss",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/antic_miss.ogg",
			"assets/audio/piggy_firefighters/antic_miss.m4a"
		],
		"gain": 0.942,
		"durationMs": 450.7,
		"priority": 7,
		"maxInstances": 1,
		"cooldownMs": 300,
		"loop": false
	},
	"antic_hit": {
		"id": "antic_hit",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/antic_hit.ogg",
			"assets/audio/piggy_firefighters/antic_hit.m4a"
		],
		"gain": 0.969,
		"durationMs": 779.3,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 300,
		"loop": false
	},
	"trigger_fanfare": {
		"id": "trigger_fanfare",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/trigger_fanfare.ogg",
			"assets/audio/piggy_firefighters/trigger_fanfare.m4a"
		],
		"gain": 1.144,
		"durationMs": 2568.3,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 1000,
		"loop": false
	},
	"backdraft_whoosh": {
		"id": "backdraft_whoosh",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/backdraft_whoosh.ogg",
			"assets/audio/piggy_firefighters/backdraft_whoosh.m4a"
		],
		"gain": 0.847,
		"durationMs": 708.4,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 400,
		"loop": false
	},
	"backdraft_roar": {
		"id": "backdraft_roar",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/backdraft_roar.ogg",
			"assets/audio/piggy_firefighters/backdraft_roar.m4a"
		],
		"gain": 0.813,
		"durationMs": 1671.1,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 400,
		"loop": false
	},
	"backdraft_chord": {
		"id": "backdraft_chord",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/backdraft_chord.ogg",
			"assets/audio/piggy_firefighters/backdraft_chord.m4a"
		],
		"gain": 1.491,
		"durationMs": 1600,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 400,
		"loop": false
	},
	"blaze_ignite": {
		"id": "blaze_ignite",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/blaze_ignite.ogg",
			"assets/audio/piggy_firefighters/blaze_ignite.m4a"
		],
		"gain": 1.576,
		"durationMs": 620.5,
		"priority": 7,
		"maxInstances": 3,
		"cooldownMs": 40,
		"loop": false
	},
	"blaze_ignite_2": {
		"id": "blaze_ignite_2",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/blaze_ignite_2.ogg",
			"assets/audio/piggy_firefighters/blaze_ignite_2.m4a"
		],
		"gain": 1.734,
		"durationMs": 620.5,
		"priority": 7,
		"maxInstances": 3,
		"cooldownMs": 40,
		"loop": false
	},
	"blaze_ignite_3": {
		"id": "blaze_ignite_3",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/blaze_ignite_3.ogg",
			"assets/audio/piggy_firefighters/blaze_ignite_3.m4a"
		],
		"gain": 1.636,
		"durationMs": 620.5,
		"priority": 7,
		"maxInstances": 3,
		"cooldownMs": 40,
		"loop": false
	},
	"blaze_ignite_4": {
		"id": "blaze_ignite_4",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/blaze_ignite_4.ogg",
			"assets/audio/piggy_firefighters/blaze_ignite_4.m4a"
		],
		"gain": 1.405,
		"durationMs": 620.5,
		"priority": 7,
		"maxInstances": 3,
		"cooldownMs": 40,
		"loop": false
	},
	"blaze_ignite_5": {
		"id": "blaze_ignite_5",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/blaze_ignite_5.ogg",
			"assets/audio/piggy_firefighters/blaze_ignite_5.m4a"
		],
		"gain": 1.655,
		"durationMs": 620.5,
		"priority": 7,
		"maxInstances": 3,
		"cooldownMs": 40,
		"loop": false
	},
	"blaze_mult_2": {
		"id": "blaze_mult_2",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/blaze_mult_2.ogg",
			"assets/audio/piggy_firefighters/blaze_mult_2.m4a"
		],
		"gain": 0.942,
		"durationMs": 953.8,
		"priority": 7,
		"maxInstances": 2,
		"cooldownMs": 60,
		"loop": false
	},
	"blaze_mult_3": {
		"id": "blaze_mult_3",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/blaze_mult_3.ogg",
			"assets/audio/piggy_firefighters/blaze_mult_3.m4a"
		],
		"gain": 0.939,
		"durationMs": 953.8,
		"priority": 7,
		"maxInstances": 2,
		"cooldownMs": 60,
		"loop": false
	},
	"blaze_mult_5": {
		"id": "blaze_mult_5",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/blaze_mult_5.ogg",
			"assets/audio/piggy_firefighters/blaze_mult_5.m4a"
		],
		"gain": 0.942,
		"durationMs": 953.8,
		"priority": 7,
		"maxInstances": 2,
		"cooldownMs": 60,
		"loop": false
	},
	"blaze_mult_10": {
		"id": "blaze_mult_10",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/blaze_mult_10.ogg",
			"assets/audio/piggy_firefighters/blaze_mult_10.m4a"
		],
		"gain": 1.216,
		"durationMs": 1360,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 60,
		"loop": false
	},
	"sym_win_h1": {
		"id": "sym_win_h1",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/sym_win_h1.ogg",
			"assets/audio/piggy_firefighters/sym_win_h1.m4a"
		],
		"gain": 0.847,
		"durationMs": 992.6,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 90,
		"loop": false
	},
	"sym_win_h2": {
		"id": "sym_win_h2",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/sym_win_h2.ogg",
			"assets/audio/piggy_firefighters/sym_win_h2.m4a"
		],
		"gain": 0.751,
		"durationMs": 1000,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 90,
		"loop": false
	},
	"sym_win_h3": {
		"id": "sym_win_h3",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/sym_win_h3.ogg",
			"assets/audio/piggy_firefighters/sym_win_h3.m4a"
		],
		"gain": 0.912,
		"durationMs": 1000,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 90,
		"loop": false
	},
	"sym_win_h4": {
		"id": "sym_win_h4",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/sym_win_h4.ogg",
			"assets/audio/piggy_firefighters/sym_win_h4.m4a"
		],
		"gain": 0.967,
		"durationMs": 1000,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 90,
		"loop": false
	},
	"sym_win_l1": {
		"id": "sym_win_l1",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/sym_win_l1.ogg",
			"assets/audio/piggy_firefighters/sym_win_l1.m4a"
		],
		"gain": 0.863,
		"durationMs": 1000,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 90,
		"loop": false
	},
	"sym_win_l2": {
		"id": "sym_win_l2",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/sym_win_l2.ogg",
			"assets/audio/piggy_firefighters/sym_win_l2.m4a"
		],
		"gain": 1.696,
		"durationMs": 934.1,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 90,
		"loop": false
	},
	"sym_win_l3": {
		"id": "sym_win_l3",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/sym_win_l3.ogg",
			"assets/audio/piggy_firefighters/sym_win_l3.m4a"
		],
		"gain": 1.493,
		"durationMs": 943.4,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 90,
		"loop": false
	},
	"sym_win_l4": {
		"id": "sym_win_l4",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/sym_win_l4.ogg",
			"assets/audio/piggy_firefighters/sym_win_l4.m4a"
		],
		"gain": 0.729,
		"durationMs": 1000,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 90,
		"loop": false
	},
	"sym_win_w": {
		"id": "sym_win_w",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/sym_win_w.ogg",
			"assets/audio/piggy_firefighters/sym_win_w.m4a"
		],
		"gain": 0.861,
		"durationMs": 812.6,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 90,
		"loop": false
	},
	"line_win_small": {
		"id": "line_win_small",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/line_win_small.ogg",
			"assets/audio/piggy_firefighters/line_win_small.m4a"
		],
		"gain": 1.061,
		"durationMs": 800,
		"priority": 7,
		"maxInstances": 1,
		"cooldownMs": 120,
		"loop": false
	},
	"line_win_mid": {
		"id": "line_win_mid",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/line_win_mid.ogg",
			"assets/audio/piggy_firefighters/line_win_mid.m4a"
		],
		"gain": 0.761,
		"durationMs": 1200,
		"priority": 7,
		"maxInstances": 1,
		"cooldownMs": 120,
		"loop": false
	},
	"total_win_small": {
		"id": "total_win_small",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/total_win_small.ogg",
			"assets/audio/piggy_firefighters/total_win_small.m4a"
		],
		"gain": 0.808,
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
			"assets/audio/piggy_firefighters/total_win_mid.ogg",
			"assets/audio/piggy_firefighters/total_win_mid.m4a"
		],
		"gain": 0.912,
		"durationMs": 1600,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"total_win_big": {
		"id": "total_win_big",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/total_win_big.ogg",
			"assets/audio/piggy_firefighters/total_win_big.m4a"
		],
		"gain": 0.723,
		"durationMs": 2200,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"win_max": {
		"id": "win_max",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/win_max.ogg",
			"assets/audio/piggy_firefighters/win_max.m4a"
		],
		"gain": 1.108,
		"durationMs": 3087.6,
		"priority": 11,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"count_ticker_1": {
		"id": "count_ticker_1",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/count_ticker_1.ogg",
			"assets/audio/piggy_firefighters/count_ticker_1.m4a"
		],
		"gain": 0.562,
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
			"assets/audio/piggy_firefighters/count_ticker_2.ogg",
			"assets/audio/piggy_firefighters/count_ticker_2.m4a"
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
			"assets/audio/piggy_firefighters/count_ticker_3.ogg",
			"assets/audio/piggy_firefighters/count_ticker_3.m4a"
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
			"assets/audio/piggy_firefighters/count_ticker_4.ogg",
			"assets/audio/piggy_firefighters/count_ticker_4.m4a"
		],
		"gain": 0.562,
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
			"assets/audio/piggy_firefighters/count_ticker_5.ogg",
			"assets/audio/piggy_firefighters/count_ticker_5.m4a"
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
			"assets/audio/piggy_firefighters/count_ticker_6.ogg",
			"assets/audio/piggy_firefighters/count_ticker_6.m4a"
		],
		"gain": 0.562,
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
			"assets/audio/piggy_firefighters/count_ticker_7.ogg",
			"assets/audio/piggy_firefighters/count_ticker_7.m4a"
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
			"assets/audio/piggy_firefighters/count_ticker_8.ogg",
			"assets/audio/piggy_firefighters/count_ticker_8.m4a"
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
			"assets/audio/piggy_firefighters/count_ticker_9.ogg",
			"assets/audio/piggy_firefighters/count_ticker_9.m4a"
		],
		"gain": 0.562,
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
			"assets/audio/piggy_firefighters/count_ticker_10.ogg",
			"assets/audio/piggy_firefighters/count_ticker_10.m4a"
		],
		"gain": 0.562,
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
			"assets/audio/piggy_firefighters/count_ticker_11.ogg",
			"assets/audio/piggy_firefighters/count_ticker_11.m4a"
		],
		"gain": 0.564,
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
			"assets/audio/piggy_firefighters/count_ticker_12.ogg",
			"assets/audio/piggy_firefighters/count_ticker_12.m4a"
		],
		"gain": 0.564,
		"durationMs": 55.7,
		"priority": 5,
		"maxInstances": 6,
		"cooldownMs": 15,
		"loop": false
	},
	"rung_hit_big": {
		"id": "rung_hit_big",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rung_hit_big.ogg",
			"assets/audio/piggy_firefighters/rung_hit_big.m4a"
		],
		"gain": 1.456,
		"durationMs": 1200,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"sign_impact_big": {
		"id": "sign_impact_big",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/sign_impact_big.ogg",
			"assets/audio/piggy_firefighters/sign_impact_big.m4a"
		],
		"gain": 1.329,
		"durationMs": 900.2,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"rung_hit_huge": {
		"id": "rung_hit_huge",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rung_hit_huge.ogg",
			"assets/audio/piggy_firefighters/rung_hit_huge.m4a"
		],
		"gain": 1.348,
		"durationMs": 1343.9,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"sign_impact_huge": {
		"id": "sign_impact_huge",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/sign_impact_huge.ogg",
			"assets/audio/piggy_firefighters/sign_impact_huge.m4a"
		],
		"gain": 1.456,
		"durationMs": 518.8,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"rung_hit_mega": {
		"id": "rung_hit_mega",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rung_hit_mega.ogg",
			"assets/audio/piggy_firefighters/rung_hit_mega.m4a"
		],
		"gain": 1.221,
		"durationMs": 1600,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"sign_impact_mega": {
		"id": "sign_impact_mega",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/sign_impact_mega.ogg",
			"assets/audio/piggy_firefighters/sign_impact_mega.m4a"
		],
		"gain": 1.114,
		"durationMs": 710.9,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"rung_hit_epic": {
		"id": "rung_hit_epic",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rung_hit_epic.ogg",
			"assets/audio/piggy_firefighters/rung_hit_epic.m4a"
		],
		"gain": 1.102,
		"durationMs": 1760,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"sign_impact_epic": {
		"id": "sign_impact_epic",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/sign_impact_epic.ogg",
			"assets/audio/piggy_firefighters/sign_impact_epic.m4a"
		],
		"gain": 1.14,
		"durationMs": 1000,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"rung_hit_max": {
		"id": "rung_hit_max",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rung_hit_max.ogg",
			"assets/audio/piggy_firefighters/rung_hit_max.m4a"
		],
		"gain": 1.153,
		"durationMs": 2200,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"sign_impact_max": {
		"id": "sign_impact_max",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/sign_impact_max.ogg",
			"assets/audio/piggy_firefighters/sign_impact_max.m4a"
		],
		"gain": 1.097,
		"durationMs": 1200,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"burst_water": {
		"id": "burst_water",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/burst_water.ogg",
			"assets/audio/piggy_firefighters/burst_water.m4a"
		],
		"gain": 1.43,
		"durationMs": 1000,
		"priority": 7,
		"maxInstances": 2,
		"cooldownMs": 0,
		"loop": false
	},
	"burst_embers": {
		"id": "burst_embers",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/burst_embers.ogg",
			"assets/audio/piggy_firefighters/burst_embers.m4a"
		],
		"gain": 1.541,
		"durationMs": 972.3,
		"priority": 7,
		"maxInstances": 2,
		"cooldownMs": 0,
		"loop": false
	},
	"burst_badges": {
		"id": "burst_badges",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/burst_badges.ogg",
			"assets/audio/piggy_firefighters/burst_badges.m4a"
		],
		"gain": 1.087,
		"durationMs": 600.7,
		"priority": 7,
		"maxInstances": 2,
		"cooldownMs": 0,
		"loop": false
	},
	"burst_coins": {
		"id": "burst_coins",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/burst_coins.ogg",
			"assets/audio/piggy_firefighters/burst_coins.m4a"
		],
		"gain": 1.325,
		"durationMs": 1360,
		"priority": 7,
		"maxInstances": 2,
		"cooldownMs": 0,
		"loop": false
	},
	"burst_gold": {
		"id": "burst_gold",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/burst_gold.ogg",
			"assets/audio/piggy_firefighters/burst_gold.m4a"
		],
		"gain": 1.41,
		"durationMs": 1600,
		"priority": 7,
		"maxInstances": 2,
		"cooldownMs": 0,
		"loop": false
	},
	"rung_flare": {
		"id": "rung_flare",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rung_flare.ogg",
			"assets/audio/piggy_firefighters/rung_flare.m4a"
		],
		"gain": 0.794,
		"durationMs": 800,
		"priority": 7,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"rung_land": {
		"id": "rung_land",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rung_land.ogg",
			"assets/audio/piggy_firefighters/rung_land.m4a"
		],
		"gain": 1.596,
		"durationMs": 1200,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"rung_out": {
		"id": "rung_out",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rung_out.ogg",
			"assets/audio/piggy_firefighters/rung_out.m4a"
		],
		"gain": 0.792,
		"durationMs": 800,
		"priority": 6,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"rescue_enter": {
		"id": "rescue_enter",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rescue_enter.ogg",
			"assets/audio/piggy_firefighters/rescue_enter.m4a"
		],
		"gain": 1.022,
		"durationMs": 2389,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 1000,
		"loop": false
	},
	"inferno_enter": {
		"id": "inferno_enter",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/inferno_enter.ogg",
			"assets/audio/piggy_firefighters/inferno_enter.m4a"
		],
		"gain": 1.159,
		"durationMs": 1661,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 1000,
		"loop": false
	},
	"hose_start": {
		"id": "hose_start",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/hose_start.ogg",
			"assets/audio/piggy_firefighters/hose_start.m4a"
		],
		"gain": 0.825,
		"durationMs": 1000,
		"priority": 7,
		"maxInstances": 2,
		"cooldownMs": 60,
		"loop": false
	},
	"hose_loop": {
		"id": "hose_loop",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/hose_loop.ogg",
			"assets/audio/piggy_firefighters/hose_loop.m4a"
		],
		"gain": 0.966,
		"durationMs": 3200,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 0,
		"loopEndMs": 3200
	},
	"hose_end": {
		"id": "hose_end",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/hose_end.ogg",
			"assets/audio/piggy_firefighters/hose_end.m4a"
		],
		"gain": 0.77,
		"durationMs": 1000,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 60,
		"loop": false
	},
	"steam": {
		"id": "steam",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/steam.ogg",
			"assets/audio/piggy_firefighters/steam.m4a"
		],
		"gain": 0.412,
		"durationMs": 1360,
		"priority": 5,
		"maxInstances": 2,
		"cooldownMs": 80,
		"loop": false
	},
	"room_down": {
		"id": "room_down",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/room_down.ogg",
			"assets/audio/piggy_firefighters/room_down.m4a"
		],
		"gain": 0.725,
		"durationMs": 793.5,
		"priority": 7,
		"maxInstances": 3,
		"cooldownMs": 40,
		"loop": false
	},
	"rescue_tada_1": {
		"id": "rescue_tada_1",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rescue_tada_1.ogg",
			"assets/audio/piggy_firefighters/rescue_tada_1.m4a"
		],
		"gain": 0.712,
		"durationMs": 1000,
		"priority": 8,
		"maxInstances": 2,
		"cooldownMs": 120,
		"loop": false
	},
	"rescue_tada_2": {
		"id": "rescue_tada_2",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rescue_tada_2.ogg",
			"assets/audio/piggy_firefighters/rescue_tada_2.m4a"
		],
		"gain": 0.727,
		"durationMs": 979.6,
		"priority": 8,
		"maxInstances": 2,
		"cooldownMs": 120,
		"loop": false
	},
	"rescue_tada_3": {
		"id": "rescue_tada_3",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rescue_tada_3.ogg",
			"assets/audio/piggy_firefighters/rescue_tada_3.m4a"
		],
		"gain": 0.732,
		"durationMs": 991.2,
		"priority": 8,
		"maxInstances": 2,
		"cooldownMs": 120,
		"loop": false
	},
	"rescue_tada_4": {
		"id": "rescue_tada_4",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rescue_tada_4.ogg",
			"assets/audio/piggy_firefighters/rescue_tada_4.m4a"
		],
		"gain": 0.727,
		"durationMs": 1016.6,
		"priority": 8,
		"maxInstances": 2,
		"cooldownMs": 120,
		"loop": false
	},
	"rescue_tada_5": {
		"id": "rescue_tada_5",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rescue_tada_5.ogg",
			"assets/audio/piggy_firefighters/rescue_tada_5.m4a"
		],
		"gain": 0.736,
		"durationMs": 1015.9,
		"priority": 8,
		"maxInstances": 2,
		"cooldownMs": 120,
		"loop": false
	},
	"rescue_tada_6": {
		"id": "rescue_tada_6",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rescue_tada_6.ogg",
			"assets/audio/piggy_firefighters/rescue_tada_6.m4a"
		],
		"gain": 0.751,
		"durationMs": 1006,
		"priority": 8,
		"maxInstances": 2,
		"cooldownMs": 120,
		"loop": false
	},
	"rescue_tada_7": {
		"id": "rescue_tada_7",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rescue_tada_7.ogg",
			"assets/audio/piggy_firefighters/rescue_tada_7.m4a"
		],
		"gain": 0.763,
		"durationMs": 992.5,
		"priority": 8,
		"maxInstances": 2,
		"cooldownMs": 120,
		"loop": false
	},
	"rescue_tada_8": {
		"id": "rescue_tada_8",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rescue_tada_8.ogg",
			"assets/audio/piggy_firefighters/rescue_tada_8.m4a"
		],
		"gain": 0.788,
		"durationMs": 992.3,
		"priority": 8,
		"maxInstances": 2,
		"cooldownMs": 120,
		"loop": false
	},
	"prize_coins": {
		"id": "prize_coins",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/prize_coins.ogg",
			"assets/audio/piggy_firefighters/prize_coins.m4a"
		],
		"gain": 1.701,
		"durationMs": 1360,
		"priority": 8,
		"maxInstances": 2,
		"cooldownMs": 60,
		"loop": false
	},
	"prize_coins_big": {
		"id": "prize_coins_big",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/prize_coins_big.ogg",
			"assets/audio/piggy_firefighters/prize_coins_big.m4a"
		],
		"gain": 1.214,
		"durationMs": 2000,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 200,
		"loop": false
	},
	"building_cleared": {
		"id": "building_cleared",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/building_cleared.ogg",
			"assets/audio/piggy_firefighters/building_cleared.m4a"
		],
		"gain": 1,
		"durationMs": 2400,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 1000,
		"loop": false
	},
	"siren_pass": {
		"id": "siren_pass",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/siren_pass.ogg",
			"assets/audio/piggy_firefighters/siren_pass.m4a"
		],
		"gain": 0.743,
		"durationMs": 2044,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 1000,
		"loop": false
	},
	"block_slide": {
		"id": "block_slide",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/block_slide.ogg",
			"assets/audio/piggy_firefighters/block_slide.m4a"
		],
		"gain": 1.041,
		"durationMs": 1268.6,
		"priority": 7,
		"maxInstances": 1,
		"cooldownMs": 300,
		"loop": false
	},
	"spins_added": {
		"id": "spins_added",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/spins_added.ogg",
			"assets/audio/piggy_firefighters/spins_added.m4a"
		],
		"gain": 0.999,
		"durationMs": 1000,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 200,
		"loop": false
	},
	"last_spin": {
		"id": "last_spin",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/last_spin.ogg",
			"assets/audio/piggy_firefighters/last_spin.m4a"
		],
		"gain": 1.051,
		"durationMs": 1200.9,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 1000,
		"loop": false
	},
	"rescue_total_small": {
		"id": "rescue_total_small",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rescue_total_small.ogg",
			"assets/audio/piggy_firefighters/rescue_total_small.m4a"
		],
		"gain": 0.686,
		"durationMs": 1360,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"inferno_total_small": {
		"id": "inferno_total_small",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/inferno_total_small.ogg",
			"assets/audio/piggy_firefighters/inferno_total_small.m4a"
		],
		"gain": 0.724,
		"durationMs": 1360,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"rescue_total_mid": {
		"id": "rescue_total_mid",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rescue_total_mid.ogg",
			"assets/audio/piggy_firefighters/rescue_total_mid.m4a"
		],
		"gain": 0.946,
		"durationMs": 1872,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"inferno_total_mid": {
		"id": "inferno_total_mid",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/inferno_total_mid.ogg",
			"assets/audio/piggy_firefighters/inferno_total_mid.m4a"
		],
		"gain": 0.813,
		"durationMs": 2000,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"rescue_total_big": {
		"id": "rescue_total_big",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rescue_total_big.ogg",
			"assets/audio/piggy_firefighters/rescue_total_big.m4a"
		],
		"gain": 0.804,
		"durationMs": 1983.1,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"inferno_total_big": {
		"id": "inferno_total_big",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/inferno_total_big.ogg",
			"assets/audio/piggy_firefighters/inferno_total_big.m4a"
		],
		"gain": 0.969,
		"durationMs": 1483.3,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"alarm_call_ring": {
		"id": "alarm_call_ring",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/alarm_call_ring.ogg",
			"assets/audio/piggy_firefighters/alarm_call_ring.m4a"
		],
		"gain": 0.924,
		"durationMs": 1149,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 500,
		"loop": false
	},
	"alarm_card_flip": {
		"id": "alarm_card_flip",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/alarm_card_flip.ogg",
			"assets/audio/piggy_firefighters/alarm_card_flip.m4a"
		],
		"gain": 1.845,
		"durationMs": 666.1,
		"priority": 7,
		"maxInstances": 1,
		"cooldownMs": 200,
		"loop": false
	},
	"alarm_outcome_rescue": {
		"id": "alarm_outcome_rescue",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/alarm_outcome_rescue.ogg",
			"assets/audio/piggy_firefighters/alarm_outcome_rescue.m4a"
		],
		"gain": 0.958,
		"durationMs": 1751.1,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"alarm_outcome_inferno": {
		"id": "alarm_outcome_inferno",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/alarm_outcome_inferno.ogg",
			"assets/audio/piggy_firefighters/alarm_outcome_inferno.m4a"
		],
		"gain": 1.083,
		"durationMs": 2200,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"alarm_outcome_false": {
		"id": "alarm_outcome_false",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/alarm_outcome_false.ogg",
			"assets/audio/piggy_firefighters/alarm_outcome_false.m4a"
		],
		"gain": 0.688,
		"durationMs": 1210.5,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"dog_bark": {
		"id": "dog_bark",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/dog_bark.ogg",
			"assets/audio/piggy_firefighters/dog_bark.m4a"
		],
		"gain": 0.63,
		"durationMs": 800,
		"priority": 7,
		"maxInstances": 1,
		"cooldownMs": 300,
		"loop": false
	},
	"backdraft_spins_start": {
		"id": "backdraft_spins_start",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/backdraft_spins_start.ogg",
			"assets/audio/piggy_firefighters/backdraft_spins_start.m4a"
		],
		"gain": 0.721,
		"durationMs": 2200,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 1000,
		"loop": false
	},
	"backdraft_spins_end": {
		"id": "backdraft_spins_end",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/backdraft_spins_end.ogg",
			"assets/audio/piggy_firefighters/backdraft_spins_end.m4a"
		],
		"gain": 1.825,
		"durationMs": 2000,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"ambient_station_loop": {
		"id": "ambient_station_loop",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/ambient_station_loop.ogg",
			"assets/audio/piggy_firefighters/ambient_station_loop.m4a"
		],
		"gain": 0.592,
		"durationMs": 14000,
		"priority": 2,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": true,
		"loopStartMs": 0,
		"loopEndMs": 14000
	},
	"shutter_slam": {
		"id": "shutter_slam",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/shutter_slam.ogg",
			"assets/audio/piggy_firefighters/shutter_slam.m4a"
		],
		"gain": 1.241,
		"durationMs": 800,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 300,
		"loop": false
	},
	"shutter_haul_1": {
		"id": "shutter_haul_1",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/shutter_haul_1.ogg",
			"assets/audio/piggy_firefighters/shutter_haul_1.m4a"
		],
		"gain": 0.985,
		"durationMs": 450,
		"priority": 6,
		"maxInstances": 1,
		"cooldownMs": 60,
		"loop": false
	},
	"shutter_haul_2": {
		"id": "shutter_haul_2",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/shutter_haul_2.ogg",
			"assets/audio/piggy_firefighters/shutter_haul_2.m4a"
		],
		"gain": 1.115,
		"durationMs": 450,
		"priority": 6,
		"maxInstances": 1,
		"cooldownMs": 60,
		"loop": false
	},
	"shutter_haul_3": {
		"id": "shutter_haul_3",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/shutter_haul_3.ogg",
			"assets/audio/piggy_firefighters/shutter_haul_3.m4a"
		],
		"gain": 0.87,
		"durationMs": 524.7,
		"priority": 6,
		"maxInstances": 1,
		"cooldownMs": 60,
		"loop": false
	},
	"spin_start_turbo": {
		"id": "spin_start_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/spin_start_turbo.ogg",
			"assets/audio/piggy_firefighters/spin_start_turbo.m4a"
		],
		"gain": 1.44,
		"durationMs": 274.9,
		"priority": 5,
		"maxInstances": 1,
		"cooldownMs": 80,
		"loop": false
	},
	"spin_whoosh_turbo": {
		"id": "spin_whoosh_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/spin_whoosh_turbo.ogg",
			"assets/audio/piggy_firefighters/spin_whoosh_turbo.m4a"
		],
		"gain": 0.609,
		"durationMs": 446.5,
		"priority": 4,
		"maxInstances": 1,
		"cooldownMs": 80,
		"loop": false
	},
	"wild_land_turbo": {
		"id": "wild_land_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/wild_land_turbo.ogg",
			"assets/audio/piggy_firefighters/wild_land_turbo.m4a"
		],
		"gain": 1.324,
		"durationMs": 440.8,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 40,
		"loop": false
	},
	"alarm_land_1_turbo": {
		"id": "alarm_land_1_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/alarm_land_1_turbo.ogg",
			"assets/audio/piggy_firefighters/alarm_land_1_turbo.m4a"
		],
		"gain": 0.97,
		"durationMs": 499.5,
		"priority": 7,
		"maxInstances": 3,
		"cooldownMs": 0,
		"loop": false
	},
	"alarm_land_2_turbo": {
		"id": "alarm_land_2_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/alarm_land_2_turbo.ogg",
			"assets/audio/piggy_firefighters/alarm_land_2_turbo.m4a"
		],
		"gain": 0.959,
		"durationMs": 502.9,
		"priority": 7,
		"maxInstances": 3,
		"cooldownMs": 0,
		"loop": false
	},
	"alarm_land_3_turbo": {
		"id": "alarm_land_3_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/alarm_land_3_turbo.ogg",
			"assets/audio/piggy_firefighters/alarm_land_3_turbo.m4a"
		],
		"gain": 1.143,
		"durationMs": 506,
		"priority": 7,
		"maxInstances": 3,
		"cooldownMs": 0,
		"loop": false
	},
	"alarm_land_4_turbo": {
		"id": "alarm_land_4_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/alarm_land_4_turbo.ogg",
			"assets/audio/piggy_firefighters/alarm_land_4_turbo.m4a"
		],
		"gain": 1.093,
		"durationMs": 503.5,
		"priority": 7,
		"maxInstances": 3,
		"cooldownMs": 0,
		"loop": false
	},
	"alarm_land_5_turbo": {
		"id": "alarm_land_5_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/alarm_land_5_turbo.ogg",
			"assets/audio/piggy_firefighters/alarm_land_5_turbo.m4a"
		],
		"gain": 1.122,
		"durationMs": 500.7,
		"priority": 7,
		"maxInstances": 3,
		"cooldownMs": 0,
		"loop": false
	},
	"galarm_glint_turbo": {
		"id": "galarm_glint_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/galarm_glint_turbo.ogg",
			"assets/audio/piggy_firefighters/galarm_glint_turbo.m4a"
		],
		"gain": 1.025,
		"durationMs": 443.5,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 60,
		"loop": false
	},
	"antic_riser_turbo": {
		"id": "antic_riser_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/antic_riser_turbo.ogg",
			"assets/audio/piggy_firefighters/antic_riser_turbo.m4a"
		],
		"gain": 1.029,
		"durationMs": 1187.5,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 400,
		"loop": false
	},
	"antic_riser_2_turbo": {
		"id": "antic_riser_2_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/antic_riser_2_turbo.ogg",
			"assets/audio/piggy_firefighters/antic_riser_2_turbo.m4a"
		],
		"gain": 1.099,
		"durationMs": 1205.7,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 400,
		"loop": false
	},
	"antic_miss_turbo": {
		"id": "antic_miss_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/antic_miss_turbo.ogg",
			"assets/audio/piggy_firefighters/antic_miss_turbo.m4a"
		],
		"gain": 0.93,
		"durationMs": 241.8,
		"priority": 7,
		"maxInstances": 1,
		"cooldownMs": 300,
		"loop": false
	},
	"antic_hit_turbo": {
		"id": "antic_hit_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/antic_hit_turbo.ogg",
			"assets/audio/piggy_firefighters/antic_hit_turbo.m4a"
		],
		"gain": 1.413,
		"durationMs": 440.6,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 300,
		"loop": false
	},
	"trigger_fanfare_turbo": {
		"id": "trigger_fanfare_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/trigger_fanfare_turbo.ogg",
			"assets/audio/piggy_firefighters/trigger_fanfare_turbo.m4a"
		],
		"gain": 1.481,
		"durationMs": 1295.6,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 1000,
		"loop": false
	},
	"backdraft_whoosh_turbo": {
		"id": "backdraft_whoosh_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/backdraft_whoosh_turbo.ogg",
			"assets/audio/piggy_firefighters/backdraft_whoosh_turbo.m4a"
		],
		"gain": 1.234,
		"durationMs": 372.8,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 400,
		"loop": false
	},
	"backdraft_roar_turbo": {
		"id": "backdraft_roar_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/backdraft_roar_turbo.ogg",
			"assets/audio/piggy_firefighters/backdraft_roar_turbo.m4a"
		],
		"gain": 1.049,
		"durationMs": 831.2,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 400,
		"loop": false
	},
	"backdraft_chord_turbo": {
		"id": "backdraft_chord_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/backdraft_chord_turbo.ogg",
			"assets/audio/piggy_firefighters/backdraft_chord_turbo.m4a"
		],
		"gain": 1.577,
		"durationMs": 797.1,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 400,
		"loop": false
	},
	"blaze_mult_2_turbo": {
		"id": "blaze_mult_2_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/blaze_mult_2_turbo.ogg",
			"assets/audio/piggy_firefighters/blaze_mult_2_turbo.m4a"
		],
		"gain": 1.159,
		"durationMs": 517.5,
		"priority": 7,
		"maxInstances": 2,
		"cooldownMs": 60,
		"loop": false
	},
	"blaze_mult_3_turbo": {
		"id": "blaze_mult_3_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/blaze_mult_3_turbo.ogg",
			"assets/audio/piggy_firefighters/blaze_mult_3_turbo.m4a"
		],
		"gain": 1.17,
		"durationMs": 518.3,
		"priority": 7,
		"maxInstances": 2,
		"cooldownMs": 60,
		"loop": false
	},
	"blaze_mult_5_turbo": {
		"id": "blaze_mult_5_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/blaze_mult_5_turbo.ogg",
			"assets/audio/piggy_firefighters/blaze_mult_5_turbo.m4a"
		],
		"gain": 1.154,
		"durationMs": 533.4,
		"priority": 7,
		"maxInstances": 2,
		"cooldownMs": 60,
		"loop": false
	},
	"blaze_mult_10_turbo": {
		"id": "blaze_mult_10_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/blaze_mult_10_turbo.ogg",
			"assets/audio/piggy_firefighters/blaze_mult_10_turbo.m4a"
		],
		"gain": 1.629,
		"durationMs": 753.9,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 60,
		"loop": false
	},
	"sym_win_h1_turbo": {
		"id": "sym_win_h1_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/sym_win_h1_turbo.ogg",
			"assets/audio/piggy_firefighters/sym_win_h1_turbo.m4a"
		],
		"gain": 1.179,
		"durationMs": 554.3,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 90,
		"loop": false
	},
	"sym_win_h2_turbo": {
		"id": "sym_win_h2_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/sym_win_h2_turbo.ogg",
			"assets/audio/piggy_firefighters/sym_win_h2_turbo.m4a"
		],
		"gain": 1.044,
		"durationMs": 549.2,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 90,
		"loop": false
	},
	"sym_win_h3_turbo": {
		"id": "sym_win_h3_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/sym_win_h3_turbo.ogg",
			"assets/audio/piggy_firefighters/sym_win_h3_turbo.m4a"
		],
		"gain": 1.177,
		"durationMs": 538.4,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 90,
		"loop": false
	},
	"sym_win_h4_turbo": {
		"id": "sym_win_h4_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/sym_win_h4_turbo.ogg",
			"assets/audio/piggy_firefighters/sym_win_h4_turbo.m4a"
		],
		"gain": 1.098,
		"durationMs": 543.9,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 90,
		"loop": false
	},
	"sym_win_l1_turbo": {
		"id": "sym_win_l1_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/sym_win_l1_turbo.ogg",
			"assets/audio/piggy_firefighters/sym_win_l1_turbo.m4a"
		],
		"gain": 1.092,
		"durationMs": 557.6,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 90,
		"loop": false
	},
	"sym_win_l2_turbo": {
		"id": "sym_win_l2_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/sym_win_l2_turbo.ogg",
			"assets/audio/piggy_firefighters/sym_win_l2_turbo.m4a"
		],
		"gain": 1.522,
		"durationMs": 504,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 90,
		"loop": false
	},
	"sym_win_l3_turbo": {
		"id": "sym_win_l3_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/sym_win_l3_turbo.ogg",
			"assets/audio/piggy_firefighters/sym_win_l3_turbo.m4a"
		],
		"gain": 1.516,
		"durationMs": 525.6,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 90,
		"loop": false
	},
	"sym_win_l4_turbo": {
		"id": "sym_win_l4_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/sym_win_l4_turbo.ogg",
			"assets/audio/piggy_firefighters/sym_win_l4_turbo.m4a"
		],
		"gain": 1.031,
		"durationMs": 545.4,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 90,
		"loop": false
	},
	"sym_win_w_turbo": {
		"id": "sym_win_w_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/sym_win_w_turbo.ogg",
			"assets/audio/piggy_firefighters/sym_win_w_turbo.m4a"
		],
		"gain": 1.104,
		"durationMs": 454.8,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 90,
		"loop": false
	},
	"line_win_small_turbo": {
		"id": "line_win_small_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/line_win_small_turbo.ogg",
			"assets/audio/piggy_firefighters/line_win_small_turbo.m4a"
		],
		"gain": 1.498,
		"durationMs": 442.3,
		"priority": 7,
		"maxInstances": 1,
		"cooldownMs": 120,
		"loop": false
	},
	"line_win_mid_turbo": {
		"id": "line_win_mid_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/line_win_mid_turbo.ogg",
			"assets/audio/piggy_firefighters/line_win_mid_turbo.m4a"
		],
		"gain": 0.986,
		"durationMs": 650.2,
		"priority": 7,
		"maxInstances": 1,
		"cooldownMs": 120,
		"loop": false
	},
	"total_win_small_turbo": {
		"id": "total_win_small_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/total_win_small_turbo.ogg",
			"assets/audio/piggy_firefighters/total_win_small_turbo.m4a"
		],
		"gain": 1.117,
		"durationMs": 667.3,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"total_win_mid_turbo": {
		"id": "total_win_mid_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/total_win_mid_turbo.ogg",
			"assets/audio/piggy_firefighters/total_win_mid_turbo.m4a"
		],
		"gain": 1.105,
		"durationMs": 810.6,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"total_win_big_turbo": {
		"id": "total_win_big_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/total_win_big_turbo.ogg",
			"assets/audio/piggy_firefighters/total_win_big_turbo.m4a"
		],
		"gain": 0.997,
		"durationMs": 1111.3,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"win_max_turbo": {
		"id": "win_max_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/win_max_turbo.ogg",
			"assets/audio/piggy_firefighters/win_max_turbo.m4a"
		],
		"gain": 1.228,
		"durationMs": 1552.8,
		"priority": 11,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"rung_hit_big_turbo": {
		"id": "rung_hit_big_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rung_hit_big_turbo.ogg",
			"assets/audio/piggy_firefighters/rung_hit_big_turbo.m4a"
		],
		"gain": 1.546,
		"durationMs": 662.8,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"sign_impact_big_turbo": {
		"id": "sign_impact_big_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/sign_impact_big_turbo.ogg",
			"assets/audio/piggy_firefighters/sign_impact_big_turbo.m4a"
		],
		"gain": 1.865,
		"durationMs": 492.6,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"rung_hit_huge_turbo": {
		"id": "rung_hit_huge_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rung_hit_huge_turbo.ogg",
			"assets/audio/piggy_firefighters/rung_hit_huge_turbo.m4a"
		],
		"gain": 1.778,
		"durationMs": 736.3,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"sign_impact_huge_turbo": {
		"id": "sign_impact_huge_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/sign_impact_huge_turbo.ogg",
			"assets/audio/piggy_firefighters/sign_impact_huge_turbo.m4a"
		],
		"gain": 1.463,
		"durationMs": 286.5,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"rung_hit_mega_turbo": {
		"id": "rung_hit_mega_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rung_hit_mega_turbo.ogg",
			"assets/audio/piggy_firefighters/rung_hit_mega_turbo.m4a"
		],
		"gain": 1.689,
		"durationMs": 796.5,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"sign_impact_mega_turbo": {
		"id": "sign_impact_mega_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/sign_impact_mega_turbo.ogg",
			"assets/audio/piggy_firefighters/sign_impact_mega_turbo.m4a"
		],
		"gain": 1.5,
		"durationMs": 380.6,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"rung_hit_epic_turbo": {
		"id": "rung_hit_epic_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rung_hit_epic_turbo.ogg",
			"assets/audio/piggy_firefighters/rung_hit_epic_turbo.m4a"
		],
		"gain": 1.211,
		"durationMs": 890.1,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"sign_impact_epic_turbo": {
		"id": "sign_impact_epic_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/sign_impact_epic_turbo.ogg",
			"assets/audio/piggy_firefighters/sign_impact_epic_turbo.m4a"
		],
		"gain": 1.737,
		"durationMs": 542.3,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"rung_hit_max_turbo": {
		"id": "rung_hit_max_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rung_hit_max_turbo.ogg",
			"assets/audio/piggy_firefighters/rung_hit_max_turbo.m4a"
		],
		"gain": 1.306,
		"durationMs": 1100.8,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"sign_impact_max_turbo": {
		"id": "sign_impact_max_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/sign_impact_max_turbo.ogg",
			"assets/audio/piggy_firefighters/sign_impact_max_turbo.m4a"
		],
		"gain": 1.489,
		"durationMs": 666.7,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"burst_water_turbo": {
		"id": "burst_water_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/burst_water_turbo.ogg",
			"assets/audio/piggy_firefighters/burst_water_turbo.m4a"
		],
		"gain": 1.962,
		"durationMs": 558.3,
		"priority": 7,
		"maxInstances": 2,
		"cooldownMs": 0,
		"loop": false
	},
	"burst_embers_turbo": {
		"id": "burst_embers_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/burst_embers_turbo.ogg",
			"assets/audio/piggy_firefighters/burst_embers_turbo.m4a"
		],
		"gain": 1.431,
		"durationMs": 533.2,
		"priority": 7,
		"maxInstances": 2,
		"cooldownMs": 0,
		"loop": false
	},
	"burst_badges_turbo": {
		"id": "burst_badges_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/burst_badges_turbo.ogg",
			"assets/audio/piggy_firefighters/burst_badges_turbo.m4a"
		],
		"gain": 1.291,
		"durationMs": 344.6,
		"priority": 7,
		"maxInstances": 2,
		"cooldownMs": 0,
		"loop": false
	},
	"burst_coins_turbo": {
		"id": "burst_coins_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/burst_coins_turbo.ogg",
			"assets/audio/piggy_firefighters/burst_coins_turbo.m4a"
		],
		"gain": 1.423,
		"durationMs": 756,
		"priority": 7,
		"maxInstances": 2,
		"cooldownMs": 0,
		"loop": false
	},
	"burst_gold_turbo": {
		"id": "burst_gold_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/burst_gold_turbo.ogg",
			"assets/audio/piggy_firefighters/burst_gold_turbo.m4a"
		],
		"gain": 1.454,
		"durationMs": 808.2,
		"priority": 7,
		"maxInstances": 2,
		"cooldownMs": 0,
		"loop": false
	},
	"rung_flare_turbo": {
		"id": "rung_flare_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rung_flare_turbo.ogg",
			"assets/audio/piggy_firefighters/rung_flare_turbo.m4a"
		],
		"gain": 1.165,
		"durationMs": 448,
		"priority": 7,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"rung_land_turbo": {
		"id": "rung_land_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rung_land_turbo.ogg",
			"assets/audio/piggy_firefighters/rung_land_turbo.m4a"
		],
		"gain": 1.557,
		"durationMs": 670.4,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"rung_out_turbo": {
		"id": "rung_out_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rung_out_turbo.ogg",
			"assets/audio/piggy_firefighters/rung_out_turbo.m4a"
		],
		"gain": 1.122,
		"durationMs": 445.9,
		"priority": 6,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"rescue_enter_turbo": {
		"id": "rescue_enter_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rescue_enter_turbo.ogg",
			"assets/audio/piggy_firefighters/rescue_enter_turbo.m4a"
		],
		"gain": 1.118,
		"durationMs": 1188.8,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 1000,
		"loop": false
	},
	"inferno_enter_turbo": {
		"id": "inferno_enter_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/inferno_enter_turbo.ogg",
			"assets/audio/piggy_firefighters/inferno_enter_turbo.m4a"
		],
		"gain": 1.212,
		"durationMs": 816.8,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 1000,
		"loop": false
	},
	"hose_start_turbo": {
		"id": "hose_start_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/hose_start_turbo.ogg",
			"assets/audio/piggy_firefighters/hose_start_turbo.m4a"
		],
		"gain": 0.955,
		"durationMs": 560.1,
		"priority": 7,
		"maxInstances": 2,
		"cooldownMs": 60,
		"loop": false
	},
	"hose_end_turbo": {
		"id": "hose_end_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/hose_end_turbo.ogg",
			"assets/audio/piggy_firefighters/hose_end_turbo.m4a"
		],
		"gain": 0.878,
		"durationMs": 541.5,
		"priority": 6,
		"maxInstances": 2,
		"cooldownMs": 60,
		"loop": false
	},
	"steam_turbo": {
		"id": "steam_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/steam_turbo.ogg",
			"assets/audio/piggy_firefighters/steam_turbo.m4a"
		],
		"gain": 0.566,
		"durationMs": 755.7,
		"priority": 5,
		"maxInstances": 2,
		"cooldownMs": 80,
		"loop": false
	},
	"room_down_turbo": {
		"id": "room_down_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/room_down_turbo.ogg",
			"assets/audio/piggy_firefighters/room_down_turbo.m4a"
		],
		"gain": 0.904,
		"durationMs": 442.2,
		"priority": 7,
		"maxInstances": 3,
		"cooldownMs": 40,
		"loop": false
	},
	"rescue_tada_1_turbo": {
		"id": "rescue_tada_1_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rescue_tada_1_turbo.ogg",
			"assets/audio/piggy_firefighters/rescue_tada_1_turbo.m4a"
		],
		"gain": 0.964,
		"durationMs": 549.1,
		"priority": 8,
		"maxInstances": 2,
		"cooldownMs": 120,
		"loop": false
	},
	"rescue_tada_2_turbo": {
		"id": "rescue_tada_2_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rescue_tada_2_turbo.ogg",
			"assets/audio/piggy_firefighters/rescue_tada_2_turbo.m4a"
		],
		"gain": 0.987,
		"durationMs": 537.5,
		"priority": 8,
		"maxInstances": 2,
		"cooldownMs": 120,
		"loop": false
	},
	"rescue_tada_3_turbo": {
		"id": "rescue_tada_3_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rescue_tada_3_turbo.ogg",
			"assets/audio/piggy_firefighters/rescue_tada_3_turbo.m4a"
		],
		"gain": 0.978,
		"durationMs": 547.6,
		"priority": 8,
		"maxInstances": 2,
		"cooldownMs": 120,
		"loop": false
	},
	"rescue_tada_4_turbo": {
		"id": "rescue_tada_4_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rescue_tada_4_turbo.ogg",
			"assets/audio/piggy_firefighters/rescue_tada_4_turbo.m4a"
		],
		"gain": 1.032,
		"durationMs": 559.2,
		"priority": 8,
		"maxInstances": 2,
		"cooldownMs": 120,
		"loop": false
	},
	"rescue_tada_5_turbo": {
		"id": "rescue_tada_5_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rescue_tada_5_turbo.ogg",
			"assets/audio/piggy_firefighters/rescue_tada_5_turbo.m4a"
		],
		"gain": 1.009,
		"durationMs": 558.3,
		"priority": 8,
		"maxInstances": 2,
		"cooldownMs": 120,
		"loop": false
	},
	"rescue_tada_6_turbo": {
		"id": "rescue_tada_6_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rescue_tada_6_turbo.ogg",
			"assets/audio/piggy_firefighters/rescue_tada_6_turbo.m4a"
		],
		"gain": 1.038,
		"durationMs": 554.8,
		"priority": 8,
		"maxInstances": 2,
		"cooldownMs": 120,
		"loop": false
	},
	"rescue_tada_7_turbo": {
		"id": "rescue_tada_7_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rescue_tada_7_turbo.ogg",
			"assets/audio/piggy_firefighters/rescue_tada_7_turbo.m4a"
		],
		"gain": 1.057,
		"durationMs": 554.1,
		"priority": 8,
		"maxInstances": 2,
		"cooldownMs": 120,
		"loop": false
	},
	"rescue_tada_8_turbo": {
		"id": "rescue_tada_8_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rescue_tada_8_turbo.ogg",
			"assets/audio/piggy_firefighters/rescue_tada_8_turbo.m4a"
		],
		"gain": 1.085,
		"durationMs": 554.4,
		"priority": 8,
		"maxInstances": 2,
		"cooldownMs": 120,
		"loop": false
	},
	"prize_coins_turbo": {
		"id": "prize_coins_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/prize_coins_turbo.ogg",
			"assets/audio/piggy_firefighters/prize_coins_turbo.m4a"
		],
		"gain": 1.482,
		"durationMs": 757.8,
		"priority": 8,
		"maxInstances": 2,
		"cooldownMs": 60,
		"loop": false
	},
	"prize_coins_big_turbo": {
		"id": "prize_coins_big_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/prize_coins_big_turbo.ogg",
			"assets/audio/piggy_firefighters/prize_coins_big_turbo.m4a"
		],
		"gain": 1.634,
		"durationMs": 999.4,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 200,
		"loop": false
	},
	"building_cleared_turbo": {
		"id": "building_cleared_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/building_cleared_turbo.ogg",
			"assets/audio/piggy_firefighters/building_cleared_turbo.m4a"
		],
		"gain": 1.084,
		"durationMs": 1204.9,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 1000,
		"loop": false
	},
	"siren_pass_turbo": {
		"id": "siren_pass_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/siren_pass_turbo.ogg",
			"assets/audio/piggy_firefighters/siren_pass_turbo.m4a"
		],
		"gain": 0.868,
		"durationMs": 1027.4,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 1000,
		"loop": false
	},
	"block_slide_turbo": {
		"id": "block_slide_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/block_slide_turbo.ogg",
			"assets/audio/piggy_firefighters/block_slide_turbo.m4a"
		],
		"gain": 1.168,
		"durationMs": 699,
		"priority": 7,
		"maxInstances": 1,
		"cooldownMs": 300,
		"loop": false
	},
	"spins_added_turbo": {
		"id": "spins_added_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/spins_added_turbo.ogg",
			"assets/audio/piggy_firefighters/spins_added_turbo.m4a"
		],
		"gain": 1.3,
		"durationMs": 550.7,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 200,
		"loop": false
	},
	"last_spin_turbo": {
		"id": "last_spin_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/last_spin_turbo.ogg",
			"assets/audio/piggy_firefighters/last_spin_turbo.m4a"
		],
		"gain": 1.45,
		"durationMs": 668.7,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 1000,
		"loop": false
	},
	"rescue_total_small_turbo": {
		"id": "rescue_total_small_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rescue_total_small_turbo.ogg",
			"assets/audio/piggy_firefighters/rescue_total_small_turbo.m4a"
		],
		"gain": 0.944,
		"durationMs": 755.6,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"inferno_total_small_turbo": {
		"id": "inferno_total_small_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/inferno_total_small_turbo.ogg",
			"assets/audio/piggy_firefighters/inferno_total_small_turbo.m4a"
		],
		"gain": 1.061,
		"durationMs": 752.2,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"rescue_total_mid_turbo": {
		"id": "rescue_total_mid_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rescue_total_mid_turbo.ogg",
			"assets/audio/piggy_firefighters/rescue_total_mid_turbo.m4a"
		],
		"gain": 1.125,
		"durationMs": 944.7,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"inferno_total_mid_turbo": {
		"id": "inferno_total_mid_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/inferno_total_mid_turbo.ogg",
			"assets/audio/piggy_firefighters/inferno_total_mid_turbo.m4a"
		],
		"gain": 1.046,
		"durationMs": 999.8,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"rescue_total_big_turbo": {
		"id": "rescue_total_big_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/rescue_total_big_turbo.ogg",
			"assets/audio/piggy_firefighters/rescue_total_big_turbo.m4a"
		],
		"gain": 1.143,
		"durationMs": 983.4,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"inferno_total_big_turbo": {
		"id": "inferno_total_big_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/inferno_total_big_turbo.ogg",
			"assets/audio/piggy_firefighters/inferno_total_big_turbo.m4a"
		],
		"gain": 1.289,
		"durationMs": 754.6,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"alarm_call_ring_turbo": {
		"id": "alarm_call_ring_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/alarm_call_ring_turbo.ogg",
			"assets/audio/piggy_firefighters/alarm_call_ring_turbo.m4a"
		],
		"gain": 1.165,
		"durationMs": 635.3,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 500,
		"loop": false
	},
	"alarm_card_flip_turbo": {
		"id": "alarm_card_flip_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/alarm_card_flip_turbo.ogg",
			"assets/audio/piggy_firefighters/alarm_card_flip_turbo.m4a"
		],
		"gain": 1.581,
		"durationMs": 376.3,
		"priority": 7,
		"maxInstances": 1,
		"cooldownMs": 200,
		"loop": false
	},
	"alarm_outcome_rescue_turbo": {
		"id": "alarm_outcome_rescue_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/alarm_outcome_rescue_turbo.ogg",
			"assets/audio/piggy_firefighters/alarm_outcome_rescue_turbo.m4a"
		],
		"gain": 1.064,
		"durationMs": 879.3,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"alarm_outcome_inferno_turbo": {
		"id": "alarm_outcome_inferno_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/alarm_outcome_inferno_turbo.ogg",
			"assets/audio/piggy_firefighters/alarm_outcome_inferno_turbo.m4a"
		],
		"gain": 1.18,
		"durationMs": 1110.8,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"alarm_outcome_false_turbo": {
		"id": "alarm_outcome_false_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/alarm_outcome_false_turbo.ogg",
			"assets/audio/piggy_firefighters/alarm_outcome_false_turbo.m4a"
		],
		"gain": 0.785,
		"durationMs": 666.7,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"dog_bark_turbo": {
		"id": "dog_bark_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/dog_bark_turbo.ogg",
			"assets/audio/piggy_firefighters/dog_bark_turbo.m4a"
		],
		"gain": 0.947,
		"durationMs": 456.4,
		"priority": 7,
		"maxInstances": 1,
		"cooldownMs": 300,
		"loop": false
	},
	"backdraft_spins_start_turbo": {
		"id": "backdraft_spins_start_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/backdraft_spins_start_turbo.ogg",
			"assets/audio/piggy_firefighters/backdraft_spins_start_turbo.m4a"
		],
		"gain": 0.942,
		"durationMs": 1111.1,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 1000,
		"loop": false
	},
	"backdraft_spins_end_turbo": {
		"id": "backdraft_spins_end_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/backdraft_spins_end_turbo.ogg",
			"assets/audio/piggy_firefighters/backdraft_spins_end_turbo.m4a"
		],
		"gain": 1.521,
		"durationMs": 1008.8,
		"priority": 9,
		"maxInstances": 1,
		"cooldownMs": 0,
		"loop": false
	},
	"shutter_slam_turbo": {
		"id": "shutter_slam_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/shutter_slam_turbo.ogg",
			"assets/audio/piggy_firefighters/shutter_slam_turbo.m4a"
		],
		"gain": 1.868,
		"durationMs": 436.5,
		"priority": 8,
		"maxInstances": 1,
		"cooldownMs": 300,
		"loop": false
	},
	"shutter_haul_1_turbo": {
		"id": "shutter_haul_1_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/shutter_haul_1_turbo.ogg",
			"assets/audio/piggy_firefighters/shutter_haul_1_turbo.m4a"
		],
		"gain": 1.11,
		"durationMs": 245.4,
		"priority": 6,
		"maxInstances": 1,
		"cooldownMs": 60,
		"loop": false
	},
	"shutter_haul_2_turbo": {
		"id": "shutter_haul_2_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/shutter_haul_2_turbo.ogg",
			"assets/audio/piggy_firefighters/shutter_haul_2_turbo.m4a"
		],
		"gain": 1.098,
		"durationMs": 239.1,
		"priority": 6,
		"maxInstances": 1,
		"cooldownMs": 60,
		"loop": false
	},
	"shutter_haul_3_turbo": {
		"id": "shutter_haul_3_turbo",
		"bus": "sfx",
		"files": [
			"assets/audio/piggy_firefighters/shutter_haul_3_turbo.ogg",
			"assets/audio/piggy_firefighters/shutter_haul_3_turbo.m4a"
		],
		"gain": 1.016,
		"durationMs": 296.3,
		"priority": 6,
		"maxInstances": 1,
		"cooldownMs": 60,
		"loop": false
	}
};

export type CueId = keyof typeof CUES;
