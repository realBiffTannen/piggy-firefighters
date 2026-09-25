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
		"gain": 0.402,
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
		"gain": 0.555,
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
		"gain": 0.64,
		"durationMs": 128.6,
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
		"gain": 1.351,
		"durationMs": 334.3,
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
		"gain": 0.915,
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
		"gain": 0.516,
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
		"gain": 1.841,
		"durationMs": 793.4,
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
		"gain": 1.086,
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
		"gain": 1.474,
		"durationMs": 485.4,
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
		"gain": 1.136,
		"durationMs": 800.5,
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
		"gain": 1.213,
		"durationMs": 424.9,
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
		"gain": 0.494,
		"durationMs": 607.8,
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
		"gain": 1.03,
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
		"gain": 0.649,
		"durationMs": 600,
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
		"gain": 0.646,
		"durationMs": 600,
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
		"gain": 0.649,
		"durationMs": 600,
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
		"gain": 0.65,
		"durationMs": 600,
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
		"gain": 0.649,
		"durationMs": 600,
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
		"gain": 0.843,
		"durationMs": 612,
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
		"gain": 1.033,
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
		"gain": 0.88,
		"durationMs": 1543.1,
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
		"gain": 0.774,
		"durationMs": 1552.5,
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
		"gain": 1.168,
		"durationMs": 1539.5,
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
		"gain": 1,
		"durationMs": 1548.4,
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
		"gain": 1.102,
		"durationMs": 1542.7,
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
		"gain": 0.714,
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
		"gain": 0.344,
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
		"gain": 0.915,
		"durationMs": 2546.7,
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
		"gain": 0.968,
		"durationMs": 2531,
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
		"gain": 0.886,
		"durationMs": 1010,
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
		"gain": 1.26,
		"durationMs": 785.5,
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
		"gain": 1.138,
		"durationMs": 2558.7,
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
		"gain": 0.846,
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
		"gain": 0.753,
		"durationMs": 2000,
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
		"gain": 1.793,
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
		"gain": 1.454,
		"durationMs": 1339.8,
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
		"gain": 1.409,
		"durationMs": 1350,
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
		"gain": 1.343,
		"durationMs": 1366.5,
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
		"gain": 1.341,
		"durationMs": 1364.6,
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
		"gain": 1.401,
		"durationMs": 1349.7,
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
		"gain": 0.972,
		"durationMs": 1600,
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
		"gain": 0.995,
		"durationMs": 1600,
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
		"gain": 1.063,
		"durationMs": 1600,
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
		"gain": 1.272,
		"durationMs": 1515,
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
		"gain": 1.042,
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
		"gain": 0.962,
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
		"gain": 0.858,
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
		"gain": 1.501,
		"durationMs": 942.4,
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
		"gain": 0.723,
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
		"gain": 0.778,
		"durationMs": 1000,
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
		"gain": 1.263,
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
		"gain": 0.766,
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
		"gain": 1.148,
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
		"gain": 1.02,
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
		"gain": 0.823,
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
		"gain": 1.411,
		"durationMs": 3050.5,
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
		"gain": 0.564,
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
		"gain": 0.563,
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
		"gain": 0.562,
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
			"assets/audio/piggy_firefighters/count_ticker_10.ogg",
			"assets/audio/piggy_firefighters/count_ticker_10.m4a"
		],
		"gain": 0.563,
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
		"gain": 0.561,
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
		"gain": 0.563,
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
		"gain": 1.278,
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
		"gain": 1.001,
		"durationMs": 606.5,
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
		"gain": 1.276,
		"durationMs": 1500,
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
		"gain": 1.125,
		"durationMs": 1000,
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
		"gain": 1.095,
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
		"gain": 1.294,
		"durationMs": 693,
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
		"gain": 1.136,
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
		"gain": 1.498,
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
		"gain": 1.585,
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
		"gain": 2,
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
		"gain": 1.169,
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
		"gain": 1.639,
		"durationMs": 972.4,
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
		"gain": 1.027,
		"durationMs": 601.1,
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
		"gain": 1.326,
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
		"gain": 1.39,
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
		"gain": 0.793,
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
		"gain": 1.774,
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
		"gain": 0.794,
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
		"gain": 1.021,
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
		"gain": 1.36,
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
		"gain": 0.824,
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
		"gain": 0.768,
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
		"gain": 0.405,
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
		"gain": 0.652,
		"durationMs": 1000,
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
		"gain": 0.707,
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
		"gain": 0.719,
		"durationMs": 1000,
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
		"gain": 0.728,
		"durationMs": 992.9,
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
		"gain": 0.738,
		"durationMs": 1000,
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
		"gain": 0.749,
		"durationMs": 1000,
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
		"gain": 0.857,
		"durationMs": 988,
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
		"gain": 0.817,
		"durationMs": 976.3,
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
		"gain": 0.867,
		"durationMs": 956,
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
		"gain": 1.706,
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
		"gain": 1.144,
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
		"gain": 0.998,
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
		"gain": 0.689,
		"durationMs": 2400,
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
		"gain": 1.053,
		"durationMs": 1246.1,
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
		"gain": 1.296,
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
		"gain": 1.057,
		"durationMs": 1203.5,
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
		"gain": 0.614,
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
		"gain": 0.919,
		"durationMs": 2000,
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
		"gain": 0.812,
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
		"gain": 0.855,
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
		"gain": 1.021,
		"durationMs": 1500,
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
		"gain": 1.875,
		"durationMs": 800,
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
		"gain": 0.966,
		"durationMs": 1746.3,
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
		"gain": 0.976,
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
		"gain": 0.687,
		"durationMs": 1200,
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
		"gain": 0.656,
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
		"gain": 0.736,
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
		"gain": 1.635,
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
		"gain": 0.599,
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
		"gain": 1.667,
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
		"gain": 0.977,
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
		"gain": 1.156,
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
		"gain": 1.38,
		"durationMs": 247.9,
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
		"gain": 0.701,
		"durationMs": 347.2,
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
		"gain": 1.38,
		"durationMs": 450.3,
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
		"gain": 1.233,
		"durationMs": 700,
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
		"gain": 1.091,
		"durationMs": 684.6,
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
		"gain": 1.641,
		"durationMs": 695.9,
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
		"gain": 1.429,
		"durationMs": 693.3,
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
		"gain": 1.547,
		"durationMs": 691.5,
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
		"gain": 1.024,
		"durationMs": 446.4,
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
		"gain": 1.002,
		"durationMs": 1287.5,
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
		"gain": 1.064,
		"durationMs": 1272.3,
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
		"gain": 1.126,
		"durationMs": 564,
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
		"gain": 1.809,
		"durationMs": 442.6,
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
		"gain": 1.486,
		"durationMs": 700,
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
		"gain": 1.194,
		"durationMs": 383.5,
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
		"gain": 0.969,
		"durationMs": 700,
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
		"gain": 1.529,
		"durationMs": 698.6,
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
		"gain": 1.565,
		"durationMs": 694.4,
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
		"gain": 1.585,
		"durationMs": 692.7,
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
		"gain": 1.722,
		"durationMs": 692.7,
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
		"gain": 1.939,
		"durationMs": 679.5,
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
		"gain": 1.422,
		"durationMs": 554.2,
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
		"durationMs": 551.1,
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
		"gain": 1.171,
		"durationMs": 534.5,
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
		"gain": 1.086,
		"durationMs": 562.4,
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
		"gain": 1.062,
		"durationMs": 558.8,
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
		"gain": 1.512,
		"durationMs": 520.5,
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
		"gain": 0.951,
		"durationMs": 557.2,
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
		"gain": 0.998,
		"durationMs": 555.8,
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
		"gain": 1.728,
		"durationMs": 451.1,
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
		"gain": 0.985,
		"durationMs": 666.9,
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
		"gain": 1.521,
		"durationMs": 662.8,
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
		"gain": 1.296,
		"durationMs": 700,
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
		"gain": 1.139,
		"durationMs": 700,
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
		"gain": 1.533,
		"durationMs": 700,
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
		"gain": 1.312,
		"durationMs": 667.1,
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
		"gain": 1.164,
		"durationMs": 347.6,
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
		"gain": 1.805,
		"durationMs": 631.2,
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
		"gain": 1.016,
		"durationMs": 551.9,
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
		"gain": 1.576,
		"durationMs": 687.9,
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
		"gain": 1.545,
		"durationMs": 391,
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
		"gain": 1.226,
		"durationMs": 700,
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
		"gain": 2,
		"durationMs": 561.5,
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
		"gain": 1.766,
		"durationMs": 700,
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
		"gain": 1.82,
		"durationMs": 661.2,
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
		"gain": 1.603,
		"durationMs": 561.4,
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
		"gain": 1.578,
		"durationMs": 542.4,
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
		"gain": 1.332,
		"durationMs": 341,
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
		"gain": 1.524,
		"durationMs": 700,
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
		"gain": 1.466,
		"durationMs": 700,
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
		"gain": 1.168,
		"durationMs": 453.4,
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
		"gain": 1.576,
		"durationMs": 650.2,
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
		"gain": 1.119,
		"durationMs": 444.6,
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
		"gain": 1.136,
		"durationMs": 700,
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
		"gain": 1.519,
		"durationMs": 682.2,
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
		"gain": 0.959,
		"durationMs": 558.9,
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
		"gain": 0.865,
		"durationMs": 562.5,
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
		"gain": 0.583,
		"durationMs": 700,
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
		"gain": 0.891,
		"durationMs": 554.1,
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
		"gain": 0.961,
		"durationMs": 536.4,
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
		"gain": 0.978,
		"durationMs": 559,
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
		"gain": 0.994,
		"durationMs": 546.3,
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
		"gain": 1.006,
		"durationMs": 541,
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
		"gain": 1.024,
		"durationMs": 560.3,
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
		"gain": 1.176,
		"durationMs": 544.2,
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
		"gain": 1.119,
		"durationMs": 552.2,
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
		"gain": 1.189,
		"durationMs": 517.3,
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
		"gain": 1.508,
		"durationMs": 673.4,
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
		"gain": 1.526,
		"durationMs": 700,
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
		"gain": 1.056,
		"durationMs": 700,
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
		"gain": 1.235,
		"durationMs": 700,
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
		"gain": 1.269,
		"durationMs": 673.4,
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
		"gain": 1.702,
		"durationMs": 558,
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
		"gain": 1.449,
		"durationMs": 671.4,
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
		"gain": 0.805,
		"durationMs": 700,
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
		"gain": 1.044,
		"durationMs": 693.5,
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
		"gain": 1.408,
		"durationMs": 700,
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
		"gain": 1.048,
		"durationMs": 700,
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
		"gain": 1.229,
		"durationMs": 700,
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
		"gain": 1.385,
		"durationMs": 670.6,
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
		"gain": 1.163,
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
		"gain": 1.437,
		"durationMs": 441.5,
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
		"gain": 1.062,
		"durationMs": 700,
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
		"gain": 1.104,
		"durationMs": 700,
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
		"gain": 0.783,
		"durationMs": 668.8,
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
		"gain": 0.964,
		"durationMs": 452.7,
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
		"gain": 0.959,
		"durationMs": 700,
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
		"gain": 1.538,
		"durationMs": 700,
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
		"gain": 1.579,
		"durationMs": 436.6,
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
		"gain": 1.113,
		"durationMs": 256.6,
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
		"gain": 1.14,
		"durationMs": 246,
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
		"gain": 1.012,
		"durationMs": 296.4,
		"priority": 6,
		"maxInstances": 1,
		"cooldownMs": 60,
		"loop": false
	}
};

export type CueId = keyof typeof CUES;
