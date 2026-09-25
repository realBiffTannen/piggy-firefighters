#!/usr/bin/env python3
"""PIGGY FIREFIGHTERS audio ROSTER (2026-09-25) — the single editable source of the cue list.

    python3 audio/tools/roster.py            # (re)write prompts.json, jobs.json, plans.json and audio/cues.json
    python3 audio/tools/roster.py --check    # validate only (prompt limits, banned words, coverage), write nothing

Writes
  audio/tools/prompts.json   SFX prompt SOURCE, donor shape: {name: {s, influence, loop, group, palette, prompt, ships}}
                             + `_palettes` (the palette suffixes) + `_note`
  audio/tools/jobs.json      compiled SFX jobs for gen_audio.mjs: prompt + palette suffix, route, duration, influence,
                             the donor-measured character-cost estimate, and which cue ids the draw feeds
  audio/tools/plans.json     music composition plans for gen_audio.mjs (music_v1 composition_plan: globals carry
                             BPM / key / hook / rhythm rules; 4 sections of (loop/4 + margin); full ensemble from beat
                             one; a turnaround back to the hook; negatives) + the bed metadata build_audio.py reads
  audio/cues.json            the registry (donor schema: $schema_note, grid, mix, transitions, cues[]). MERGED: roster
                             fields are refreshed, build/mix fields (gain, durationMs once built, measured, mix, build,
                             loopPoints) are kept, so re-running this never throws away a measured build.

Every id here is a frontend contract id once the runtime seam is wired; `replaces` names the donor id the current
(ported) runtime still plays at that moment, and `seam` the call site that should play the new id.
Rules enforced here (docs/AUDIO_DESIGN_NOTES.md, CLAUDE.md, the family's rejection lessons):
  * every SFX prompt + palette <= 450 characters (API limit, checked before any call);
  * no theme leaks: no siren / police / construction / hard hat / lantern / dragon / wolf / pig / fire engine words in any
    prompt or plan (the SFX model keys on the noun even in a negative: describe the two-tone call musically);
  * every moment in GAME_CONTRACT.md / PIGGY_FIREFIGHTERS_THEME.md §4-6 has a cue (COVERAGE below);
  * a `_turbo` variant for every one-shot longer than 0.7 s (derived, no extra draw);
  * reward chains rise (mix.py enforces the measured version).
"""
import json, math, os, re, sys, time

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.environ.get('PF_AUDIO_ROOT') or os.path.join(TOOLS, '..', '..'))
GAME = 'piggy_firefighters'
ROUND = 'pf_0925'
BASE_BPM, BONUS_BPM, RUNG_BPM = 92, 100, 100


def loop_s(bars, bpm): return bars * 4 * 60.0 / bpm


# --------------------------------------------------------------------------------------------------- cost model
# Measured on the donor's own ledger (LUCKY audio/source-record.json, round lucky_0923, 161 draws):
#   SFX: character-cost header == round_half_up(11 x duration_seconds) on all 138 draws (0.5 s -> 6 ... 14 s -> 154).
#   MUSIC (no per-call header): account counter moved 17,202 over the pass, SFX headers summed 1,996, so 15,206
#   characters for 1,106 s of planned music = 13.75 characters per planned second (music_v1, composition plans).
SFX_CHARS_PER_S = 11.0
MUSIC_CHARS_PER_S = 15206 / 1106.0
QUOTA_FLOOR = 25000


def sfx_cost(s): return int(math.floor(SFX_CHARS_PER_S * s + 0.5))
def music_cost(ms): return int(math.ceil(ms / 1000.0 * MUSIC_CHARS_PER_S))


# --------------------------------------------------------------------------------------------------- palettes
PALETTES = {
    'mech': ' Cartoon fire-station palette: brass bell, chrome, rubber hose, water, wooden ladder, leather. Dry, close, no voice, no music.',
    'mus': ' Firehouse brass-band palette: trumpets, trombones, French horn, tuba, glockenspiel, brass fire bell, snare; C major; warm, bright, controlled highs, dry, no voice.',
    'fire': ' Friendly cartoon fire: bright whooshing flame, warm crackle, glowing embers; bouncy, never scary. Dry, close, no voice, no music.',
    'water': ' Cartoon firefighting water: rubber hose, brass nozzle, spray, droplets, steam. Dry, close, no voice, no music.',
    'fx': ' Comic cartoon game sound effect. Dry, no words, no voice, no music bed, no background noise, clean tail.',
    'tone': ' Dry, no voice, no music bed, no background noise, immediate onset.',
    'dog': ' Cartoon game sound effect. Dry, close, no human voice, no words, no music, no background noise.',
    'amb': '',
}
BANNED = [r'\bsirens?\b', r'police', r'construct', r'hard[- ]?hat', r'lantern', r'dragon', r'\bwolf', r'\bpigs?\b', r'oink',
          r'fire[- ]engine', r'emergency', r'ambulance', r'stake', r'lucky', r'\bhat\b']

# --------------------------------------------------------------------------------------------------- SFX draws
DRAWS = {}


def draw(name, s, palette, group, prompt, influence=0.72, loop=False):
    assert name not in DRAWS, name
    DRAWS[name] = dict(s=s, influence=influence, loop=loop, group=group, palette=palette, prompt=prompt)


# UI / HUD
draw('ui_click_1', 0.5, 'mech', 'ui', 'One soft friendly button click: a small polished chrome toggle switch flicked once, rounded and clean, about 60 ms of sound then silence, controlled highs, no reverb, no tail.')
draw('ui_click_2', 0.5, 'mech', 'ui', 'One soft button click, a touch lighter and higher than a standard click: a small chrome toggle tapped once, about 55 ms then silence, no reverb, no tail.')
draw('ui_click_3', 0.5, 'mech', 'ui', 'One soft button click, a touch rounder and lower than a standard click: a leather-padded chrome switch pressed once, about 65 ms then silence, no reverb, no tail.')
draw('bet_change', 0.5, 'mech', 'ui', 'One tiny ratchet tick of a brass hose-reel dial turning one notch, soft and rounded, about 70 ms, no reverb, no tail.')
draw('ante_on', 0.8, 'mus', 'ui', 'Boost switched on: a brass valve lever clicks into place and a small brass bell answers with two quick rising notes G then C, bright and friendly, about 400 ms, clean tail.')
draw('ante_off', 0.8, 'mus', 'ui', 'Boost switched off: a brass valve lever clicks back and a small brass bell plays two soft falling notes C then G, gentle, about 350 ms, clean tail.')
draw('alert_insufficient', 0.8, 'mech', 'ui', 'One restrained low double knock on a thick wooden station door, soft and polite, not alarming, about 300 ms, no ring, no beeps.')
draw('buy_confirm', 0.8, 'mech', 'ui', 'A confident purchase confirm: a brass rubber stamp pressed firmly onto a wooden desk and one small bell ding, neutral and tidy, about 350 ms, clean tail.')
# reels
draw('spin_start', 0.8, 'mech', 'reels', 'A short snappy pickup as slot reels start: a quick pull of a chrome lever with a soft rubber-hose flick, light and bouncy, about 250 ms, no machinery hum, clean tail.')
draw('spin_whoosh', 0.8, 'fx', 'reels', 'A soft airy downward whoosh as slot reels start spinning, like a quick gust past an open garage door, smooth and gentle, about 400 ms, controlled highs.')
draw('reel_spin_loop', 3.0, 'mech', 'reels', 'Seamless loop of slot reels spinning: a soft fast even ticking of a brass hose reel turning, over a light airy whirr, steady level from start to end, no accents, no ending.', influence=0.75, loop=True)
draw('reel_stop_1', 0.5, 'mech', 'reels', 'One rounded reel-stop thunk: a wooden ladder rung knocked once with a padded mallet, woody and warm with a clear low pitch, a soft detent, about 120 ms, no reverb.')
draw('wild_land', 0.8, 'mus', 'reels', 'The wild symbol lands: a firm leather helmet thump plus one bright brass bugle blip on C, confident and cheerful, about 350 ms, clean tail.')
draw('alarm_land_src', 0.8, 'mech', 'alarm', 'One brass alarm bell struck twice quickly, ding-ding, bright and clear with a warm ring, the clapper hits cleanly, about 500 ms, natural short decay, no electric buzzer.')
draw('galarm_glint', 0.8, 'fx', 'alarm', 'A golden sparkle glint: a short shimmering bright chime swell with a soft metallic twinkle, warm and precious, about 450 ms, clean tail.')
draw('dead_spin_settle', 0.6, 'mech', 'reels', 'One very soft muted thump, like a rubber boot set down gently on a wooden floor, calm and neutral, about 150 ms, no ring, clean tail.')
# anticipation / trigger
draw('antic_riser', 2.6, 'mus', 'anticipation', 'Rising tension riser: a snare-drum roll swelling steadily, a brass alarm bell ringing faster and faster, and a low brass swell climbing in pitch from G, about 2.4 seconds, ending at its peak with no final hit.')
draw('antic_miss', 1.0, 'mus', 'anticipation', 'A gentle neutral settle after a near miss: a soft muted trumpet plays two relaxed notes G then E and a light brushed snare tap, calm and friendly, not sad, about 600 ms, clean tail.')
draw('antic_hit', 0.8, 'mus', 'anticipation', 'A bright tension peak: a sharp cymbal choke and one ringing brass bell strike, energetic and open, unresolved, about 400 ms, clean tail.')
draw('trigger_fanfare', 2.6, 'mus', 'trigger', 'Triumphant fire-station bonus fanfare: a brass bell clangs, then trumpets and trombones play a bright rising call G C E G landing on a big C major chord with a snare roll and cymbal, heroic and happy, about 2.4 seconds, clean tail.')
# Backdraft (base) and Blaze Wilds
draw('backdraft_whoosh', 1.0, 'fire', 'backdraft', 'A fast bright flash-whoosh of cartoon flame sweeping left to right across the screen, airy and exciting, about 700 ms, clean tail, no explosion.')
draw('backdraft_roar', 2.0, 'fire', 'backdraft', 'A friendly cartoon flame roar: a warm rolling wave of fire billowing up and settling, with a soft crackle of embers, powerful but not scary, about 1.8 seconds, clean tail.')
draw('backdraft_chord', 1.6, 'mus', 'backdraft', 'One bright heroic brass chord hit on C major with a glockenspiel sparkle on top and a cymbal swell, shining and triumphant, about 1.2 seconds, clean tail.')
draw('blaze_ignite', 0.6, 'fire', 'backdraft', 'One small cartoon flame igniting: a quick soft fwoomp of fire catching with a tiny spark crackle, bright and bouncy, about 300 ms, clean tail.')
draw('blaze_mult_src', 0.8, 'mus', 'backdraft', 'A multiplier badge lights up: a brass badge clank with a quick bright flame flare and a ringing bell note, punchy and cheerful, about 450 ms, clean tail.')
draw('blaze_mult_10', 1.4, 'mus', 'backdraft', 'The biggest multiplier hit: a heavy brass badge slam, a big flame flare and a bright brass stab on a C major chord with bells, exciting and triumphant, about 1 second, clean tail.')
# symbol wins (one per paying symbol, GAME_CONTRACT.md §3)
draw('sym_win_h1', 1.0, 'mech', 'symwin', 'Fire truck win: a bright brass truck bell clanging twice and a short cheerful two-note chrome horn toot, lively, about 800 ms, clean ending.')
draw('sym_win_h2', 1.0, 'mech', 'symwin', 'Fire helmet win: a firm leather helmet thump and a shining brass shield ringing like a small bell, proud and bright, about 700 ms, clean ending.')
draw('sym_win_h3', 1.0, 'mech', 'symwin', 'Axe and pry-bar win: two steel firefighting tools crossed with a clean ringing clink and a bright metallic shimmer, about 700 ms, clean ending.')
draw('sym_win_h4', 1.0, 'mech', 'symwin', 'Extinguisher win: a short playful pressurised puff of spray and a brass valve ding, bouncy, about 700 ms, clean ending.')
draw('sym_win_l1', 1.0, 'water', 'symwin', 'Brass nozzle win: a quick brass nozzle twist squeak and a small bright water spurt, cheerful, about 600 ms, clean ending.')
draw('sym_win_l2', 1.0, 'water', 'symwin', 'Water bucket win: a wooden bucket knock and a playful water slosh with one droplet plip, about 600 ms, clean ending.')
draw('sym_win_l3', 1.0, 'mech', 'symwin', 'Ladder win: a quick wooden ladder rattle, three rungs clacking upward in a light rising run, about 600 ms, clean ending.')
draw('sym_win_l4', 1.0, 'mech', 'symwin', 'Boots win: two chunky rubber boot stomps with a soft squeak, comic and bouncy, about 500 ms, clean ending.')
draw('sym_win_w', 1.0, 'mus', 'symwin', 'Wild win: a brass bugle plays a short bright rising flourish C E G and a brass badge dings, proud and cheerful, about 900 ms, clean ending.')
# line wins and win tiers
draw('line_win_small', 0.8, 'mus', 'wins', 'Small line win: a light glockenspiel two-note chime E then G with a soft brass bell touch, pleasant, about 450 ms, clean tail.')
draw('line_win_mid', 1.2, 'mus', 'wins', 'Medium line win: a glockenspiel run C E G C with a warm muted trumpet note and a bell ding, brighter and fuller, about 800 ms, clean tail.')
draw('total_win_small', 1.2, 'mus', 'wins', 'Small total-win stinger: a modest happy three-note trumpet figure rising C E G with a glockenspiel sparkle, about 900 ms, clean tail.')
draw('total_win_mid', 1.6, 'mus', 'wins', 'Medium total-win stinger: trumpets and trombones play a bright rising C E G C with a snare flam and a bell, clearly bigger than a small win, about 1.3 seconds, clean tail.')
draw('total_win_big', 2.2, 'mus', 'wins', 'Big total-win stinger: an exciting brass band flourish, trumpets, trombones, tuba, glockenspiel and a crash cymbal, rising G C E G to a full C major chord, clearly the biggest of three, about 2 seconds, clean tail.')
draw('win_max', 4.0, 'mus', 'wins', 'MAXIMUM WIN, the fullest celebration: brass bells clanging, a full brass band fanfare, timpani, cymbals and glockenspiel, the bugle call exploding into a grand C major finale, about 3.6 seconds.')
draw('count_ticker_src', 0.5, 'tone', 'winrungs', 'One single very short soft bright tick: a tiny glockenspiel blip on C, about 40 milliseconds of sound.')
# win rungs (keys and burst names are the ones components/WinRungs.svelte already plays)
draw('rung_hit_big', 1.2, 'mus', 'winrungs', 'Win tier stinger: a confident brass stab and snare hit on a C major chord with a bell ding, medium size, about 0.8 seconds, clean tail.')
draw('rung_hit_huge', 1.4, 'mus', 'winrungs', 'Bigger win tier stinger: a brass band stab with trumpets and trombones on C major, a crash cymbal and two bell clangs, bigger than the last, about 1 second, clean tail.')
draw('rung_hit_mega', 1.6, 'mus', 'winrungs', 'Mega win tier stinger: full brass and tuba hit a big C major chord with timpani, crash cymbal and bright bells ringing, powerful, about 1.2 seconds, clean tail.')
draw('rung_hit_epic', 1.8, 'mus', 'winrungs', 'Epic win tier stinger: a soaring high trumpet call over a full brass C major chord, a timpani roll into a hit, bells and cymbals, very big, about 1.4 seconds, clean tail.')
draw('rung_hit_max', 2.2, 'mus', 'winrungs', 'Maximum win tier stinger: the whole brass band and timpani slam a huge C major chord, bells and glockenspiel ringing, the biggest of all, about 1.8 seconds, clean tail.')
draw('sign_impact_big', 1.0, 'mech', 'winrungs', 'A painted wooden sign drops and lands with a solid woody thunk and a small brass rattle, about 400 ms, clean tail.')
draw('sign_impact_huge', 1.0, 'mech', 'winrungs', 'A brass-framed wooden sign drops and lands with a heavier woody thunk and a ringing brass rattle, about 500 ms, clean tail.')
draw('sign_impact_mega', 1.0, 'mech', 'winrungs', 'A big brass plaque drops and lands with a deep metallic clang and a short bell ring, about 600 ms, clean tail.')
draw('sign_impact_epic', 1.0, 'mech', 'winrungs', 'A huge brass-and-chrome plaque slams down with a deep ringing clang and a cymbal-like shimmer, about 700 ms, clean tail.')
draw('sign_impact_max', 1.2, 'mech', 'winrungs', 'A giant golden plaque slams down with a massive warm clang, a bell ring and a bright shimmer, the heaviest of all, about 900 ms, clean tail.')
draw('burst_water', 1.0, 'water', 'winrungs', 'A cheerful splash burst: a quick spray of water droplets pattering outward, light and sparkly, about 600 ms, clean tail.')
draw('burst_embers', 1.0, 'fire', 'winrungs', 'A burst of bright embers: a soft pop and a sparkly crackle of glowing sparks flying out, about 600 ms, clean tail.')
draw('burst_badges', 1.2, 'mech', 'winrungs', 'A burst of brass badges: a handful of small brass badges clattering and jingling outward, bright, about 800 ms, clean tail.')
draw('burst_coins', 1.4, 'mech', 'winrungs', 'A burst of coins: a quick shower of bright coins spilling and jingling outward, about 1 second, clean tail.')
draw('burst_gold', 1.6, 'mech', 'winrungs', 'A huge burst of gold coins and bells: a big shower of gold coins pouring out with small bells ringing, rich and bright, about 1.3 seconds, clean tail.')
draw('rung_flare', 0.8, 'fx', 'winrungs', 'A quick rising sparkle swoosh, bright and airy, like a flare lighting up, about 450 ms, clean tail.')
draw('rung_land', 1.2, 'mus', 'winrungs', 'The count-up lands: a satisfying brass stab and a bell ding on a C major chord, final and complete, about 800 ms, clean tail.')
draw('rung_out', 0.8, 'fx', 'winrungs', 'A soft falling swoosh as a sign slides away, gentle and airy, about 400 ms, clean tail.')
# Rescue Spins / Inferno Rescue
draw('rescue_enter', 2.4, 'mus', 'rescue', 'Rescue bonus entry flourish: a two-tone French horn call alternating high C and low G, a snare roll and a bright brass bell, launching into an upbeat heroic brass chord, about 2.2 seconds, clean tail.')
draw('inferno_enter', 2.6, 'mus', 'rescue', 'Inferno bonus entry flourish: low trombones and tuba swell with timpani and a roaring cartoon flame, then bright trumpets rise to a heroic C major chord with bells, hotter and bigger, about 2.4 seconds, clean tail.')
draw('hose_start', 1.0, 'water', 'rescue', 'A fire hose opens: a brass valve turns with a squeak and water surges through a rubber hose into a strong spray, about 800 ms, still spraying at the end.')
draw('hose_loop', 4.0, 'water', 'rescue', 'Seamless loop of a strong steady water spray from a fire hose nozzle, an even rushing hiss with soft droplet spatter, steady level from start to end, no accents, no ending.', influence=0.75, loop=True)
draw('hose_end', 1.0, 'water', 'rescue', 'A fire hose shuts off: the spray cuts with a brass valve clunk, a short sputter and a few water drips, about 700 ms, clean tail.')
draw('steam', 1.4, 'water', 'rescue', 'A soft warm steam hiss as water hits hot embers, a gentle puff fading out with a faint sizzle, about 1 second, clean tail.')
draw('room_down', 1.0, 'fire', 'rescue', 'A flame gets smaller: a soft downward fwump of fire shrinking with a quick sizzle, friendly, about 600 ms, clean tail.')
draw('rescue_tada_src_lo', 1.0, 'mus', 'rescue', 'A two-note brass ta-da: a short low trombone pickup note then a longer bright held note a fourth higher, warm and cheerful, about 700 ms, clean tail.')
draw('rescue_tada_src_mid', 1.0, 'mus', 'rescue', 'A two-note brass ta-da: a short French horn pickup note then a longer bright held note a fourth higher, warm and cheerful, about 700 ms, clean tail.')
draw('rescue_tada_src_hi', 1.0, 'mus', 'rescue', 'A two-note brass ta-da: a short trumpet pickup note then a longer bright held note a fourth higher, bright and cheerful, about 700 ms, clean tail.')
draw('prize_coins', 1.4, 'mech', 'rescue', 'An instant prize: a quick shower of bright coins dropping into a brass bucket with a happy jingle, about 1 second, clean tail.')
draw('prize_coins_big', 2.0, 'mech', 'rescue', 'A big instant prize: a generous pouring shower of gold coins into a brass bucket with small bells ringing, rich and exciting, about 1.6 seconds, clean tail.')
draw('building_cleared', 2.4, 'mus', 'rescue', 'Building cleared: brass bells ring and the brass band plays a bright proud rising phrase G C E G to a C major chord with a cymbal, heroic and happy, about 2 seconds, clean tail.')
draw('siren_pass', 2.4, 'mus', 'rescue', 'A cartoon two-tone horn call passing by: a French horn and a trumpet alternate high C and low G twice, friendly and musical, bending gently down in pitch at the end as it goes past, about 2 seconds, clean tail.')
draw('block_slide', 1.4, 'mech', 'rescue', 'A big wooden set piece slides in on rollers: a smooth heavy rumble gliding left, then a soft solid stop thunk, about 1.1 seconds, clean tail.')
draw('spins_added', 1.0, 'mus', 'rescue', 'Extra spins awarded: a bright brass bell ding-ding and a quick rising glockenspiel run C E G C, cheerful, about 700 ms, clean tail.')
draw('last_spin', 1.2, 'mus', 'rescue', 'Last spin notice: a single brass bell strike and a soft two-note muted trumpet call G then C, attentive but calm, about 800 ms, clean tail.')
draw('rescue_total_small', 1.4, 'mus', 'rescue', 'Rescue complete, small total: a warm brass phrase rising C E G with a bell ding, satisfied and friendly, about 1.1 seconds, clean tail.')
draw('rescue_total_mid', 2.0, 'mus', 'rescue', 'Rescue complete, medium total: trumpets and trombones play a proud rising G C E G to a C major chord with a snare roll and a bell, clearly bigger, about 1.7 seconds, clean tail.')
draw('rescue_total_big', 2.8, 'mus', 'rescue', 'Rescue complete, big total: the full brass band with timpani, crash cymbals and bells plays a grand heroic finale on C major, clearly the biggest of three, about 2.5 seconds, clean tail.')
draw('inferno_total_small', 1.4, 'mus', 'rescue', 'Hot rescue complete, small total: a soft flame whoosh under a warm low-brass phrase rising A C E, landing bright on C, satisfied, about 1.1 seconds, clean tail.')
draw('inferno_total_mid', 2.0, 'mus', 'rescue', 'Hot rescue complete, medium total: a flame roar under trombones and trumpets rising G C E G to a C major chord with timpani and a bell, clearly bigger, about 1.7 seconds, clean tail.')
draw('inferno_total_big', 2.8, 'mus', 'rescue', 'Hot rescue complete, big total: a huge warm flame roar, full low and high brass, timpani, crash cymbals and bells in a grand heroic C major finale, clearly the biggest of three, about 2.5 seconds, clean tail.')
# Alarm Call
draw('alarm_call_ring', 1.4, 'mech', 'alarmcall', 'A dispatch call comes in: a brass desk bell rings in a quick bright double ring, then a chrome switch clicks, about 1 second, clean tail, no electric buzzer.')
draw('alarm_card_flip', 0.8, 'mech', 'alarmcall', 'A stiff card flips over quickly on a wooden desk: a crisp paper flick and a soft tap as it lands, about 350 ms, clean tail.')
draw('alarm_outcome_rescue', 1.8, 'mus', 'alarmcall', 'Good news stinger: a bright brass call G C E G and a bell ring landing on C major, confident and happy, about 1.4 seconds, clean tail.')
draw('alarm_outcome_inferno', 2.2, 'mus', 'alarmcall', 'Great news stinger: a low brass swell into bright trumpets and bells on a big C major chord with a flame whoosh, bigger and hotter, about 1.8 seconds, clean tail.')
draw('alarm_outcome_false', 1.2, 'mus', 'alarmcall', 'A neutral no-call cue: a soft muted trumpet plays a relaxed G then E and a light woodblock tap, calm and matter-of-fact, not sad, not a fail sound, about 800 ms, clean tail.')
draw('dog_bark', 0.8, 'dog', 'alarmcall', 'A small friendly cartoon puppy gives two short happy barks, woof woof, bright and cute, about 500 ms, clean tail.')
# Backdraft Spins bookends
draw('backdraft_spins_start', 2.2, 'mus', 'backdraftspins', 'Hot bonus start: a flame roars up as trumpets and trombones stab a bright C major chord with timpani and a cymbal, exciting, about 1.8 seconds, clean tail.')
draw('backdraft_spins_end', 2.0, 'mus', 'backdraftspins', 'Hot bonus finish: flames settle with a soft crackle as the brass band plays a warm resolving C major chord with a bell, satisfied, about 1.6 seconds, clean tail.')
# ambience + scene transitions
draw('ambient_station_loop', 14.0, 'amb', 'ambience', 'Seamless loop of a calm cartoon fire station at dusk heard from inside the truck bay: a soft evening breeze, a gentle distant city hum, a hose reel creaking now and then, a far water drip and faint friendly birds, peaceful, even level. No voices, no music.', influence=0.6, loop=True)
draw('shutter_slam', 1.0, 'mech', 'transition', 'A big steel roll-up garage door slams shut at the floor: a heavy rattling metal crash settling into a solid thud, full-bodied low-mid, moderate undistorted level, about 700 ms, clean tail.')
draw('shutter_haul_1', 0.8, 'mech', 'transition', 'A steel roll-up garage door is hauled up a short way: a quick rattling clatter of metal slats rolling, about 400 ms, clean tail.')
draw('shutter_haul_2', 0.8, 'mech', 'transition', 'A steel roll-up garage door lifts another bit: a lighter rattling clatter of metal slats with a chain clink, about 400 ms, clean tail.')
draw('shutter_haul_3', 0.8, 'mech', 'transition', 'A steel roll-up garage door rolls fully open: a longer rattling run of metal slats ending with a soft stop clunk, about 600 ms, clean tail.')

# --------------------------------------------------------------------------------------------------- music plans
NEG_COMMON = ['vocals', 'singing', 'choir', 'speech', 'shouting', 'crowd noise', 'chanting', 'sad', 'scary', 'horror', 'aggressive',
              'dubstep', 'EDM drop', 'trap hi-hats', 'heavy rock drums', 'electric guitar', 'distorted guitar', 'long intro', 'fade in',
              'fade out', 'tempo change', 'key change', 'rubato', 'free time', 'silence', 'strummed eighth-note chords',
              'constant eighth-note chugging', 'busy hi-hats', 'busy snare rolls', 'harsh piercing high notes', 'shrill whistles',
              'out of tune brass', 'circus calliope', 'kazoo']
NEG_BRIGHT = NEG_COMMON + ['dark', 'minor key']
NEG_LAYER = ['vocals', 'singing', 'speech', 'fade in', 'fade out', 'tempo change', 'key change', 'silence', 'strumming', 'chugging',
             'harsh piercing high notes', 'shrill whistles', 'melody', 'crash cymbal', 'resolution']
HOOK_LINE = 'signature hook: a bright bugle call G C E G answered by a falling A G E C, {who} every 8 bars, cheerful and hummable, resolving to C'
QUARTERS = 'the rhythm section plays ONLY on the quarter-note beats, nothing in between'
PLANS = {}


def plan(name, cue, bpm, bars, target, hook, positive, negative, sections, model='music_v1'):
    PLANS[name] = dict(model=model, cue=cue, bpm=bpm, bars=bars, loop_s=round(loop_s(bars, bpm), 4), targetLUFS=target, hook=hook,
                       positive=positive, negative=negative, sections=sections)


def sec(name, ms, *pos): return dict(name=name, duration_ms=ms, positive=list(pos))


plan('pf_base92a', 'base_loop_a', BASE_BPM, 32, -15.5, ['glock', 1, [0, 16], -4.0], [
    'cheerful cartoon firehouse brass march for a slot machine, a friendly fire station at dusk', 'instrumental', f'{BASE_BPM} BPM',
    '4/4 time', 'key of C major', 'C major pentatonic melody (C D E G A)', HOOK_LINE.format(who='played by the glockenspiel with a muted trumpet'),
    'oom-pah march groove: tuba on beats one and three, horns and trombones on beats two and four',
    'light snare on two and four, a short snare roll only at phrase ends', 'trumpets, trombones, French horn, tuba, clarinet, glockenspiel, small brass bell accents',
    QUARTERS, 'warm, pleasant, polished modern slot game production, steady tempo, never harsh', 'full ensemble from the very first beat'],
    NEG_BRIGHT, [
        sec('A hook statement', 23000, 'glockenspiel and muted trumpet play the signature hook G C E G / A G E C twice', 'oom-pah groove', 'starts on beat one'),
        sec('B clarinet answer', 23000, 'the clarinet takes a new answering melody, trombones and horns comp on two and four', 'same groove'),
        sec('A hook return', 23000, 'trumpets play the hook with the glockenspiel doubling an octave up', 'small brass bell accents at phrase ends'),
        sec('C lift and turnaround', 23000, 'the French horn states the hook softly and the trumpets answer',
            "a two-bar turnaround that lands back on the hook's first note so the loop closes")])
plan('pf_base92b', 'base_loop_b', BASE_BPM, 32, -15.5, ['vibes', 1, [0, 16], -4.0], [
    'relaxed cartoon firehouse brass tune for a slot machine, an easygoing afternoon at the fire station', 'instrumental', f'{BASE_BPM} BPM',
    '4/4 time', 'key of C major', 'C major pentatonic melody (C D E G A)', HOOK_LINE.format(who='played by the vibraphone and a flugelhorn'),
    'easy straight groove: brushed snare and woodblock on two and four, a walking tuba on quarter notes',
    'flugelhorn, clarinet, vibraphone, soft trombone section, tuba, brushes', QUARTERS,
    'warm, pleasant, polished modern slot game production, steady tempo, never harsh', 'full ensemble from the very first beat'],
    NEG_BRIGHT, [
        sec('A vibraphone hook', 23000, 'vibraphone and flugelhorn play the signature hook G C E G / A G E C twice', 'brushes and walking tuba', 'starts on beat one'),
        sec('B trombone chorale', 23000, 'soft trombones play a warm new chorale melody while the clarinet answers', 'same groove'),
        sec('A flugelhorn hook', 23000, 'the flugelhorn leads the hook with the vibraphone an octave up', 'woodblock accents at phrase ends'),
        sec('C clarinet turnaround', 23000, 'the clarinet plays a light counter-line over the hook',
            "a two-bar turnaround that lands back on the hook's first note so the loop closes")])
plan('pf_rescue100', 'rescue_loop', BONUS_BPM, 32, -15.5, ['bugle', 0, [0, 16], -3.5], [
    'driving heroic cartoon rescue soundtrack for a slot machine bonus, the fire crew racing to save the day', 'instrumental', f'{BONUS_BPM} BPM',
    '4/4 time', 'key of C major', 'C major pentatonic melody (C D E G A)', HOOK_LINE.format(who='played by bright trumpets'),
    "a two-tone horn figure alternating high C and low G in half notes, the crew's musical call to action, woven into the arrangement",
    'driving march: snare on two and four, tuba and bass drum on one and three, tom fills only at phrase ends',
    'trumpets, trombones, French horns, tuba, glockenspiel, snare, bass drum, a crash cymbal at section starts', QUARTERS,
    'energetic, heroic, exciting, polished slot bonus production, steady tempo', 'full ensemble from the very first beat'],
    NEG_BRIGHT, [
        sec('A hook and horn call', 21000, 'trumpets play the signature hook G C E G / A G E C twice, the two-tone horn figure answers', 'starts on beat one'),
        sec('B heroic climb', 21000, 'trombones and horns play a rising heroic line, energy climbs', 'same driving groove'),
        sec('A full-band hook', 21000, 'the whole band states the hook with the glockenspiel doubling on top', 'cymbal accents at phrase starts'),
        sec('C horn call turnaround', 21000, 'the two-tone horn figure returns over the groove',
            "a two-bar turnaround that lands back on the hook's first note so the loop closes")])
plan('pf_inferno100', 'inferno_loop', BONUS_BPM, 32, -15.2, ['bugle', -1, [0, 16], -3.5], [
    'hot urgent heroic cartoon rescue soundtrack for the top slot bonus, a blazing night rescue under a red sky, exciting but never scary',
    'instrumental', f'{BONUS_BPM} BPM', '4/4 time', 'A minor pentatonic (A C D E G), the same five notes as C major pentatonic',
    'centred on A with bright C major lifts at phrase ends', HOOK_LINE.format(who='played by low trombones, then by high trumpets'),
    'big low brass: trombones and tuba; taiko-like toms and timpani on quarter notes; a low string ostinato on quarter notes; tubular bells',
    QUARTERS, 'heroic urgency, powerful and warm, polished slot bonus production, steady tempo', 'full ensemble from the very first beat'],
    NEG_COMMON + ['dissonant', 'chromatic clusters', 'spooky', 'menacing'], [
        sec('A low brass hook', 21000, 'low trombones and tuba play the signature hook over toms and timpani', 'starts on beat one'),
        sec('B toms and strings drive', 21000, 'the low string ostinato and toms drive while horns answer', 'energy climbs'),
        sec('A trumpets take the hook', 21000, 'high trumpets play the hook with tubular bells, a bright C major lift', 'same groove'),
        sec('C bells and turnaround', 21000, 'tubular bells and trombones trade the call',
            "a two-bar turnaround that lands back on the hook's first note so the loop closes")])
plan('pf_antic92', 'anticipation_layer', BASE_BPM, 4, -16.0, None, [
    'slot machine anticipation layer that plays over another track', 'instrumental', f'{BASE_BPM} BPM', '4/4 time',
    'key of C major, sitting on G, the dominant, unresolved',
    'a snare-drum roll swelling in waves each bar, a brass bell tremolo on G and D, a low tuba pedal on G, no melody, steady level',
    'starts immediately on beat one'], NEG_LAYER, [
        sec('layer', 16000, 'steady swelling snare roll, bell tremolo on G and D, tuba pedal on G, even level throughout')])
plan('pf_backdraft92', 'backdraft_spins_layer', BASE_BPM, 16, -16.0, None, [
    'hot percussion and brass layer for a slot bonus that plays over another track, cartoon flames and excitement', 'instrumental',
    f'{BASE_BPM} BPM', '4/4 time', 'key of C major',
    'taiko-like toms and bass drum on quarter notes, a crackling fire-shaker texture, short low brass stabs on beat one every two bars, rising glockenspiel sparkles',
    'no melody', 'steady level', 'starts immediately on beat one'], NEG_LAYER, [
        sec('layer A', 24000, 'toms on quarter notes and the fire-shaker texture, low brass stabs every two bars'),
        sec('layer B', 24000, 'same groove, glockenspiel sparkles rising, the brass stabs answered by horns')])
RUNG_DESC = {
    'big': ('cartoon firehouse slot big win celebration loop', 'played by the glockenspiel and trumpets',
            'happy brass march groove on quarter notes, bass drum, snare on two and four, small cymbal accents', 'joyful'),
    'huge': ('cartoon firehouse slot huge win celebration loop, bigger than a big win', 'played by trumpets and trombones',
             'full brass band march groove on quarter notes, crash cymbals at phrase starts, brass bell accents', 'joyful and bigger'),
    'mega': ('cartoon firehouse slot mega win celebration loop, much bigger', 'played by high trumpets and horns',
             'full brass band with timpani on quarter notes, crash cymbals, brass bells', 'powerful and exciting'),
    'epic': ('cartoon firehouse slot epic win celebration loop, huge', 'played by soaring high trumpets',
             'full brass band, timpani rolls into phrase starts, tubular bells, crash cymbals', 'soaring and triumphant'),
    'max': ('cartoon firehouse slot maximum win celebration loop, the biggest of all', 'played by the full brass band and bells',
            'full brass band, timpani, crash cymbals, tubular bells and glockenspiel all together on quarter notes', 'ecstatic'),
}
RUNG_HOOK = {'big': ['glock', 1, [0], -4.0], 'huge': ['bugle', 0, [0], -4.0], 'mega': ['bugle', 0, [0], -3.5], 'epic': ['bell', 1, [0], -3.5], 'max': ['bell', 1, [0], -3.0]}
RUNG_LUFS = {'big': -15.2, 'huge': -15.0, 'mega': -14.8, 'epic': -14.6, 'max': -14.4}
for k, (desc, who, groove, mood) in RUNG_DESC.items():
    plan(f'pf_rung100_{k}', f'rung_bed_{k}', RUNG_BPM, 8, RUNG_LUFS[k], RUNG_HOOK[k], [
        desc, 'instrumental', f'{RUNG_BPM} BPM', '4/4 time', 'key of C major', 'C major pentatonic', HOOK_LINE.format(who=who), groove,
        f'{mood}, steady tempo', 'starts immediately on beat one'],
        ['vocals', 'singing', 'speech', 'shouting', 'crowd noise', 'fade in', 'fade out', 'tempo change', 'key change', 'silence', 'strumming',
         'chugging', 'busy hi-hats', 'harsh piercing high notes', 'shrill whistles', 'dark', 'minor key', 'electric guitar', 'EDM drop'],
        [sec('loop', 24000, 'the hook twice, then a turnaround back to its first note')])

# --------------------------------------------------------------------------------------------------- the cue roster
CUES = {}
FILES = lambda cid: [f'assets/audio/{GAME}/{cid}.ogg', f'assets/audio/{GAME}/{cid}.m4a']
# typical runtime caps (family values): (priority, maxInstances, cooldownMs)
CAPS = {'ui': (3, 4, 40), 'reel_stop': (5, 2, 20), 'land': (6, 2, 40), 'alarm': (7, 3, 0), 'symwin': (6, 2, 90), 'linewin': (7, 1, 120),
        'riser': (8, 1, 400), 'trigger': (9, 1, 1000), 'total': (8, 1, 0), 'ticker': (5, 6, 15), 'rung': (9, 1, 0), 'impact': (8, 1, 0),
        'burst': (7, 2, 0), 'feature': (8, 1, 200), 'entry': (9, 1, 1000), 'bed': (10, 1, 0), 'layer': (9, 1, 0), 'amb': (2, 1, 0)}


def cue(cid, event, family, caps, *, bus='sfx', source=None, derive=None, loop=False, transition='', seam='', replaces=None,
        duck=None, gate=None, planned_s=None, tempo=None, bars=None, turbo=True, key=None):
    assert cid not in CUES, cid
    p, mi, cd = CAPS[caps] if isinstance(caps, str) else caps
    if planned_s is None:
        if source in DRAWS: planned_s = DRAWS[source]['s']
        elif derive and derive.get('from') in DRAWS: planned_s = DRAWS[derive['from']]['s']
        elif derive and derive.get('from') in CUES: planned_s = CUES[derive['from']]['planned_s']
    c = dict(id=cid, event=event, bus=bus, files=FILES(cid), gain=1.0, durationMs=round(planned_s * 1000, 1) if planned_s else 0,
             priority=p, maxInstances=mi, cooldownMs=cd, loop=loop, family=family, planned_s=planned_s)
    if transition: c['transition'] = transition
    if source: c['source'] = source
    if derive: c['derive'] = derive
    if seam: c['seam'] = seam
    if replaces: c['replaces'] = replaces
    if duck: c['duck'] = duck
    if gate: c['gate'] = gate
    if tempo: c['tempoBpm'] = tempo
    if bars: c['bars'] = bars
    if key: c['key'] = key
    c['_turbo'] = turbo
    CUES[cid] = c
    return c


NO_CELEBRATION = 'only when the round total is ABOVE the bet (no celebration at or below the bet)'
# --- beds (music bus)
for pn, pl in PLANS.items():
    is_layer = pl['cue'] in ('anticipation_layer', 'backdraft_spins_layer')
    ev = {'base_loop_a': 'presentation:base (tune A)', 'base_loop_b': 'presentation:base (tune B, alternates with A)',
          'rescue_loop': 'presentation:rescue (Rescue Spins)', 'inferno_loop': 'presentation:inferno (Inferno Rescue)',
          'anticipation_layer': 'anticipation: layer on while any reel anticipates (2 alarms down, reels still to stop)',
          'backdraft_spins_layer': 'presentation:backdraftSpins layer over the base bed (backdraftSpinsStart .. backdraftSpinsEnd)'}.get(pl['cue'])
    if pl['cue'].startswith('rung_bed_'): ev = f"winRungs:bed:{pl['cue'][9:]}"
    rep = {'base_loop_a': 'base_loop', 'rescue_loop': 'hold_build_loop', 'inferno_loop': 'golden_build_loop', 'rung_bed_huge': 'rung_bed_super'}.get(pl['cue'])
    seam = {'base_loop_a': 'presentationDirector.baseBeds[0] / unlock()', 'base_loop_b': 'presentationDirector.baseBeds[1] (watchBase A<->B)',
            'rescue_loop': "presentationDirector.bonusIntro('rescue')", 'inferno_loop': "presentationDirector.bonusIntro('inferno')",
            'anticipation_layer': 'gameSound.anticipationOn/Off -> addLayer/removeLayer',
            'backdraft_spins_layer': 'NEW: addLayer on backdraftSpinsStart, removeLayer on backdraftSpinsEnd'}.get(pl['cue'], 'WinRungs.svelte setBed()')
    tr = ('additive stem, phase-aligned under the primary bed; 300 ms fades' if is_layer else
          'win-rungs bed, one primary bed at a time; 260 ms rung-to-rung, 700 ms back to the scene bed' if pl['cue'].startswith('rung_bed_') else
          'primary bed; equal-power crossfade 600-1200 ms, incoming bed at the outgoing bed\'s loop phase (same grid) or its bar 1')
    cue(pl['cue'], ev, 'bed', 'layer' if is_layer else 'bed', bus='music', source=f'{pn}__1', loop=True, transition=tr, seam=seam,
        replaces=rep, planned_s=pl['loop_s'], tempo=pl['bpm'], bars=pl['bars'], turbo=False,
        key='C major (pentatonic)' if pl['cue'] != 'inferno_loop' else 'A minor pentatonic = C major pentatonic notes')

# --- UI / HUD
for i in (1, 2, 3):
    cue(f'ui_click_{i}', f'ui:button (alternate {i}/3, round-robin)', 'ui', 'ui', source=f'ui_click_{i}', seam="HUD sfxCues.general / UiSound speed tier",
        replaces='ui_click' if i == 1 else f'ui_click_{i}')
cue('bet_change', 'ui:bet change (rate 1.12 up / 0.9 down)', 'ui', (3, 2, 60), source='bet_change', seam='UiSound.svelte')
cue('ante_on', 'ui:ALARM BOOST on', 'ui', (4, 1, 150), source='ante_on', seam='UiSound.svelte')
cue('ante_off', 'ui:ALARM BOOST off', 'ui', (4, 1, 150), source='ante_off', seam='UiSound.svelte')
cue('alert_insufficient', 'ui:insufficient balance (once per entry)', 'ui', (6, 1, 1500), source='alert_insufficient', seam='AlertSound.svelte')
cue('buy_confirm', 'ui:feature buy confirmed (neutral, not a celebration)', 'ui', (6, 1, 300), source='buy_confirm', seam='NEW: buy card confirm')
# --- reels
cue('spin_start', 'spin:press', 'reels', (5, 1, 80), source='spin_start', seam='HUD sfxCues.spinPress / gameSound.spinPress')
cue('spin_whoosh', 'spin:reels kick', 'reels', (4, 1, 80), source='spin_whoosh', seam='soundOnce bridge after spin_start')
cue('reel_spin_loop', 'reels:travel loop (skipped in Super Turbo)', 'reels', (4, 1, 0), source='reel_spin_loop', loop=True, seam='gameSound.reelsStart/Stop', turbo=False)
cue('reel_stop_1', 'reel:stop[0] (ladder root, tonic-snapped to C)', 'reel_stop', 'reel_stop', source='reel_stop_1', seam='gameSound.reelStop(0)',
    derive={'op': 'snap', 'target': 'C'})
for i, st in zip(range(2, 6), (2, 4, 7, 9)):
    cue(f'reel_stop_{i}', f'reel:stop[{i - 1}] (ladder +{st} st: {"CDEGA"[i - 1]})', 'reel_stop', 'reel_stop', seam=f'gameSound.reelStop({i - 1})',
        derive={'from': 'reel_stop_1', 'op': 'ladder', 'semis': st})
cue('reel_stop_turbo', 'reel:stop merged (Turbo / Super Turbo: ONE stop for the whole board)', 'reel_stop', (5, 1, 120),
    seam='gameSound.reelStop at turboLevel >= 1', replaces='reel_stop_3 (coalesced)', derive={'from': 'reel_stop_1', 'op': 'stack', 'of': ['reel_stop_1', 'reel_stop_3', 'reel_stop_5']}, turbo=False)
cue('wild_land', 'reel:W lands (Chief Hamm)', 'land', 'land', source='wild_land', seam='gameSound.wildLand')
# alarm ladder: ii -> V -> V7 -> V9 -> V13, top voice rising A4 D5 F5 A5 B5; ONLY trigger_fanfare resolves it (to C)
ALARM_CHORDS = {1: ('ii (Dm)', [62, 65, 69]), 2: ('V (G)', [67, 71, 74]), 3: ('V7 (G7)', [67, 71, 74, 77]),
                4: ('V9 (G9, no root)', [71, 74, 77, 81]), 5: ('V13 (leading tone on top)', [74, 77, 81, 83])}
for n, (lab, notes) in ALARM_CHORDS.items():
    cue(f'alarm_land_{n}', f'alarm:land (n-th alarm this spin = {n}{"+" if n == 5 else ""}), {lab}, unresolved', 'alarm', 'alarm',
        seam='gameSound.hatLand(count) -> alarmLand(count)', replaces='hat_land_1..3 + hat_ladder_n', planned_s=0.9,
        derive={'from': 'alarm_land_src', 'op': 'hybrid-chord', 'chord': notes, 'strikeSemis': [0, 1, 2, 3, 4][n - 1]},
        transition='the strike is the drawn bell; the chord is synthesised (chime) so the harmony is exact; NEVER key-fitted (F/B are the tension)')
cue('galarm_glint', 'alarm:GOLDEN ALARM glint (layered over alarm_land_n; never implies a near miss)', 'alarm', (6, 2, 60), source='galarm_glint',
    seam='gameSound.goldenHatLand', replaces='ghat_glint')
cue('dead_spin_settle', 'finalWin 0, base game, no alarms (soft settle instead of dead air)', 'reels', (3, 1, 200), source='dead_spin_settle', seam='gameSound.deadSpin')
# --- anticipation (honest: only while the trigger is still possible) + trigger
cue('antic_riser', 'anticipation:first anticipating reel (held; stopHeld on resolve)', 'riser', 'riser', source='antic_riser',
    seam='gameSound.anticipationRiser -> playHeld', gate='only while a trigger (or a bigger award) is still possible')
cue('antic_riser_2', 'anticipation:second anticipating reel (stepped up +2 st, held)', 'riser', 'riser',
    derive={'from': 'antic_riser', 'op': 'pitch', 'semis': 2}, seam='gameSound.anticipationRiser (2nd reel)', gate='only while a trigger (or a bigger award) is still possible')
cue('antic_miss', 'anticipation:resolve MISS (neutral, never a fail sound)', 'riser', (7, 1, 300), source='antic_miss', seam='gameSound.anticipationResolve(false)', replaces='tension_miss')
cue('antic_hit', 'anticipation:resolve HIT (peak accent; the trigger_fanfare resolves)', 'riser', (8, 1, 300), source='antic_hit', seam='gameSound.anticipationResolve(true)', replaces='tension_hit')
cue('trigger_fanfare', 'trigger: 3+ alarms (resolves the alarm ladder to C)', 'trigger', 'trigger', source='trigger_fanfare', seam='gameSound.triggerFanfare',
    duck={'db': 4.5, 'holdMs': 1400})
# --- Backdraft + Blaze Wilds
cue('backdraft_whoosh', 'backdraft:flash sweep', 'backdraft', (8, 1, 400), source='backdraft_whoosh', seam='audioDirector.backdraft (1/3)')
cue('backdraft_roar', 'backdraft:flame roar', 'backdraft', (8, 1, 400), source='backdraft_roar', seam='NEW audioDirector.backdraft (2/3)')
cue('backdraft_chord', 'backdraft:bright chord as the cells ignite', 'backdraft', (8, 1, 400), source='backdraft_chord', seam='NEW audioDirector.backdraft (3/3)',
    duck={'db': 3, 'holdMs': 260, 'releaseMs': 420})
cue('blaze_ignite', 'backdraft:cell ignites [0] (ladder root: drawn fwoomp + tuned C5 ping)', 'blaze', (7, 3, 40), seam='audioDirector.blazeIgnite(0)',
    source='blaze_ignite', derive={'op': 'hybrid-ping', 'note': 72})
for i, note in zip(range(2, 6), (74, 76, 79, 81)):
    cue(f'blaze_ignite_{i}', f'backdraft:cell ignites [{i - 1}] (ping {["D5", "E5", "G5", "A5"][i - 2]})', 'blaze', (7, 3, 40),
        seam=f'audioDirector.blazeIgnite({i - 1})', derive={'from': 'blaze_ignite', 'op': 'hybrid-ping', 'note': note})
for m, note in ((2, 72), (3, 76), (5, 79)):
    cue(f'blaze_mult_{m}', f'backdraftSpins:Blaze Wild x{m} lands / line multiplier sum pop', 'blaze_mult', (7, 2, 60),
        seam='NEW: backdraft cell mult badge / winInfo.meta.lineMultiplier pop', derive={'from': 'blaze_mult_src', 'op': 'hybrid-ping', 'note': note})
cue('blaze_mult_10', 'backdraftSpins:Blaze Wild x10 lands (biggest)', 'blaze_mult', (8, 1, 60), source='blaze_mult_10',
    seam='NEW: backdraft cell mult badge x10', derive={'op': 'hybrid-chord', 'chord': [84, 88, 91]}, duck={'db': 3, 'holdMs': 200})
# --- symbol wins + line wins + totals
for s in ('h1', 'h2', 'h3', 'h4', 'l1', 'l2', 'l3', 'l4', 'w'):
    cue(f'sym_win_{s}', f'winInfo:line win symbol {s.upper()}', 'symwin', 'symwin', source=f'sym_win_{s}', seam='gameSound.symbolWin(symbol)', gate=NO_CELEBRATION)
cue('line_win_small', 'winInfo:lines total > 1x and < 3x bet', 'linewin', 'linewin', source='line_win_small', seam='gameSound.linesWin', replaces='way_win_small',
    gate=NO_CELEBRATION, duck={'db': 3, 'holdMs': 120})
cue('line_win_mid', 'winInfo:lines total >= 3x bet', 'linewin', 'linewin', source='line_win_mid', seam='gameSound.linesWin', replaces='way_win_mid',
    gate=NO_CELEBRATION, duck={'db': 3, 'holdMs': 150})
cue('total_win_small', 'setWin:round total small (> 1x bet, below BIG)', 'total', 'total', source='total_win_small', seam='gameSound.win', gate=NO_CELEBRATION, duck={'db': 4, 'holdMs': 300})
cue('total_win_mid', 'setWin:round total medium', 'total', 'total', source='total_win_mid', seam='gameSound.win', gate=NO_CELEBRATION, duck={'db': 4.5, 'holdMs': 400})
cue('total_win_big', 'setWin:round total large (just under BIG WIN rungs)', 'total', 'total', source='total_win_big', seam='gameSound.win', gate=NO_CELEBRATION, duck={'db': 5, 'holdMs': 600})
cue('win_max', 'wincap: MAX WIN 15,000x (cap level ONLY)', 'total', (11, 1, 0), source='win_max', seam='WinRungs MAX card / audioDirector.total(cap)',
    gate='the capped round only', duck={'db': 6, 'holdMs': 1200})
cue('count_ticker_1', 'winRungs:countTick[0] (C5, ladder root)', 'ticker', 'ticker', derive={'from': 'count_ticker_src', 'op': 'hybrid-ping-ladder', 'semis': 0},
    seam='WinRungs count phase (every 150 ms)', planned_s=0.25)
CLAD = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26]
for i in range(2, 13):
    cue(f'count_ticker_{i}', f'winRungs:countTick[{i - 1}] (+{CLAD[i - 1]} st, resampled: shorter as it rises)', 'ticker', 'ticker',
        derive={'from': 'count_ticker_1', 'op': 'ladder-resample', 'semis': CLAD[i - 1]}, seam='WinRungs count phase', planned_s=round(0.25 / 2 ** (CLAD[i - 1] / 12), 3))
for k in ('big', 'huge', 'mega', 'epic', 'max'):
    cue(f'rung_hit_{k}', f'winRungs:hit {k.upper()}', 'rung', 'rung', source=f'rung_hit_{k}', seam='WinRungs.svelte', replaces='rung_hit_super' if k == 'huge' else None)
    cue(f'sign_impact_{k}', f'winRungs:sign lands {k.upper()}', 'impact', 'impact', source=f'sign_impact_{k}', seam='WinRungs.svelte')
for b, k in (('water', 'big'), ('embers', 'huge'), ('badges', 'mega'), ('coins', 'epic'), ('gold', 'max')):
    cue(f'burst_{b}', f'winRungs:burst ({k.upper()} rung)', 'burst', 'burst', source=f'burst_{b}', seam='WinRungs.svelte RUNGS[].burstCue')
cue('rung_flare', 'winRungs:count-up starts / rung about to flip', 'rung', (7, 1, 0), source='rung_flare', seam='WinRungs.svelte')
cue('rung_land', 'winRungs:count-up lands', 'rung', 'rung', source='rung_land', seam='WinRungs.svelte')
cue('rung_out', 'winRungs:sign leaves', 'rung', (6, 1, 0), source='rung_out', seam='WinRungs.svelte')
# --- Rescue Spins / Inferno Rescue
cue('rescue_enter', 'rescueStart {bonus: rescue}: entry flourish', 'entry', 'entry', source='rescue_enter', seam="presentationDirector.bonusIntro('rescue')",
    replaces='bonus_entry_hold', duck={'db': 4.5, 'holdMs': 350})
cue('inferno_enter', 'rescueStart {bonus: inferno}: entry flourish', 'entry', 'entry', source='inferno_enter', seam="presentationDirector.bonusIntro('inferno')",
    replaces='bonus_entry_golden', duck={'db': 4.5, 'holdMs': 450})
cue('hose_start', 'douse:spray starts (W on reel r)', 'hose', (7, 2, 60), source='hose_start', seam='audioDirector.douse (start)', replaces='hose_spray')
cue('hose_loop', 'douse:spray sustain (sfx loop while the arc is visible)', 'hose', (6, 2, 0), source='hose_loop', loop=True, seam='NEW startSfxLoop/stopSfxLoop', turbo=False)
cue('hose_end', 'douse:spray ends', 'hose', (6, 2, 60), source='hose_end', seam='NEW audioDirector.douse (end)')
cue('steam', 'douse:steam (spray on a rescued room, or as a fire goes out)', 'hose', (5, 2, 80), source='steam', seam='NEW audioDirector.steam')
cue('room_down', 'douse:room fire level drops by 1', 'hose', (7, 3, 40), source='room_down', seam='NEW audioDirector.roomDown')
TADA = [('lo', 0), ('lo', 2), ('lo', 4), ('mid', 0), ('mid', 2), ('hi', 0), ('hi', 2), ('hi', 4)]
TADA_NOTE = ['C', 'D', 'E', 'G', 'A', "C'", "D'", "E'"]
for i, (src, st) in enumerate(TADA, 1):
    cue(f'rescue_tada_{i}', f'douse.rescues: rescue ta-da at multiplier x{i}{"+" if i == 8 else ""} (held note {TADA_NOTE[i - 1]})', 'tada', (8, 2, 120),
        derive={'from': f'rescue_tada_src_{src}', 'op': 'snap-ladder', 'semis': st}, seam='audioDirector.rescue(multiplier)')
cue('prize_coins', 'douse.rescues[].prize (Inferno): instant prize coin shower, 5-20x', 'prize', (8, 2, 60), source='prize_coins', seam='audioDirector.prize', replaces='rescue_prize')
cue('prize_coins_big', 'douse.rescues[].prize (Inferno): instant prize 50-100x', 'prize', (9, 1, 200), source='prize_coins_big', seam='audioDirector.prize(big)',
    duck={'db': 4, 'holdMs': 300})
cue('building_cleared', 'buildingCleared: all five rooms rescued', 'rescue', 'entry', source='building_cleared', seam='audioDirector.buildingCleared', duck={'db': 4.5, 'holdMs': 900})
cue('siren_pass', 'buildingCleared: the truck moves on (two-tone horn call)', 'rescue', (8, 1, 1000), source='siren_pass', seam='audioDirector.buildingCleared', replaces='siren')
cue('block_slide', 'buildingCleared: the next block slides in', 'rescue', (7, 1, 300), source='block_slide', seam='NEW audioDirector.blockSlide')
cue('spins_added', 'douse.spinsAdded / buildingCleared +5 spins', 'rescue', (8, 1, 200), source='spins_added', seam='audioDirector.extraSpin', replaces='extra_spin',
    duck={'db': 3, 'holdMs': 150, 'releaseMs': 300})
cue('last_spin', 'bonus:last spin', 'rescue', (8, 1, 1000), source='last_spin', seam='audioDirector.lastSpin')
for sz in ('small', 'mid', 'big'):
    cue(f'rescue_total_{sz}', f'rescueEnd {{bonus: rescue}}: total {sz}', 'total', (9, 1, 0), source=f'rescue_total_{sz}', seam='audioDirector.total(winLevel) (rescue)',
        replaces=f'total_win_{sz}', gate=NO_CELEBRATION, duck={'db': 4.5, 'holdMs': 400})
    cue(f'inferno_total_{sz}', f'rescueEnd {{bonus: inferno}}: total {sz}', 'total', (9, 1, 0), source=f'inferno_total_{sz}', seam='audioDirector.total(winLevel) (inferno)',
        replaces=f'total_win_{sz}', gate=NO_CELEBRATION, duck={'db': 4.5, 'holdMs': 400})
# --- Alarm Call
cue('alarm_call_ring', 'alarmCall: the dispatch bell rings as the card appears', 'alarmcall', (8, 1, 500), source='alarm_call_ring', seam='audioDirector.alarmRing', replaces='alarm_ring')
cue('alarm_card_flip', 'alarmCall: the card flips', 'alarmcall', (7, 1, 200), source='alarm_card_flip', seam='NEW audioDirector.alarmFlip')
cue('alarm_outcome_rescue', 'alarmCall {outcome: rescue}', 'alarmcall', (9, 1, 0), source='alarm_outcome_rescue', seam="audioDirector.alarmReveal('rescue')",
    replaces='alarm_award', duck={'db': 4, 'holdMs': 600})
cue('alarm_outcome_inferno', 'alarmCall {outcome: inferno}', 'alarmcall', (9, 1, 0), source='alarm_outcome_inferno', seam="audioDirector.alarmReveal('inferno')",
    replaces='alarm_award', duck={'db': 4.5, 'holdMs': 700})
cue('alarm_outcome_false', 'alarmCall {outcome: falseAlarm} (neutral: wins nothing, no celebration)', 'alarmcall', (8, 1, 0), source='alarm_outcome_false',
    seam="audioDirector.alarmReveal('falseAlarm')", replaces='false_alarm')
cue('dog_bark', 'alarmCall falseAlarm: Ember barks at the cat (neutral)', 'alarmcall', (7, 1, 300), source='dog_bark', seam='NEW audioDirector.emberBark')
# --- Backdraft Spins bookends
cue('backdraft_spins_start', 'backdraftSpinsStart {spins: 5}', 'entry', 'entry', source='backdraft_spins_start', seam='NEW audioDirector.backdraftSpinsStart',
    duck={'db': 4.5, 'holdMs': 350})
cue('backdraft_spins_end', 'backdraftSpinsEnd {amount}', 'total', (9, 1, 0), source='backdraft_spins_end', seam='NEW audioDirector.backdraftSpinsEnd',
    gate='plays for every end; use total/rung cues for the amount (no extra celebration at or below the cost)', duck={'db': 4, 'holdMs': 400})
# --- ambience + transitions
cue('ambient_station_loop', 'base scene ambience (Station 13 at dusk)', 'amb', 'amb', source='ambient_station_loop', loop=True, seam='audioManager.startSfxLoop after warmAll',
    replaces='ambient_site_loop', turbo=False)
cue('shutter_slam', 'scene:bay door slam (feature entry/exit cover)', 'transition', (8, 1, 300), source='shutter_slam', seam='audioDirector.shutterSlam',
    duck={'db': 4, 'holdMs': 220, 'releaseMs': 380})
for n in (1, 2, 3):
    cue(f'shutter_haul_{n}', f'scene:bay door haul {n}/3', 'transition', (6, 1, 60), source=f'shutter_haul_{n}', seam=f'audioDirector.shutterHaul({n})')

# --- turbo variants: every one-shot SFX longer than 0.7 s (derived by time-scale; soundtrack never sped up)
for cid in list(CUES):
    c = CUES[cid]
    # HUD feedback (family 'ui') is not on the spin cadence, so turbo never changes it: no variant (ante / alert / buy).
    if c['bus'] != 'sfx' or c['loop'] or c['family'] == 'ui' or not c.pop('_turbo', True) or not c.get('planned_s') or c['planned_s'] <= 0.7: continue
    f = 0.55 if c['planned_s'] < 1.5 else 0.5
    t = cue(f'{cid}_turbo', f'{c["event"]} [TURBO]', c['family'], (c['priority'], c['maxInstances'], c['cooldownMs']),
            derive={'from': cid, 'op': 'turbo', 'timeScale': f}, planned_s=round(c['planned_s'] * f, 3), turbo=False,
            seam=f'{c.get("seam", "")} when isTurbo()'.strip())
    t.pop('_turbo', None)
    if c.get('duck'): t['duck'] = c['duck']
    if c.get('gate'): t['gate'] = c['gate']
    c['turboVariant'] = f'{cid}_turbo'
for c in CUES.values(): c.pop('_turbo', None)

# --------------------------------------------------------------------------------------------------- coverage
COVERAGE = {  # moment (GAME_CONTRACT.md / THEME §4-6 / AUDIO_DESIGN_NOTES) -> ids that voice it
    'spin press + kick': ['spin_start', 'spin_whoosh'], 'reel travel': ['reel_spin_loop'],
    'reel stops 1-5 (all different)': [f'reel_stop_{i}' for i in range(1, 6)], 'turbo merged stop': ['reel_stop_turbo'],
    'wild lands': ['wild_land'], 'alarm lands 1/2/3+ rising, unresolved': [f'alarm_land_{i}' for i in range(1, 6)], 'golden alarm': ['galarm_glint'],
    'anticipation layer + riser (steps up)': ['anticipation_layer', 'antic_riser', 'antic_riser_2'], 'honest miss / hit': ['antic_miss', 'antic_hit'],
    'trigger fanfare (resolves)': ['trigger_fanfare'], 'Backdraft whoosh + roar + chord': ['backdraft_whoosh', 'backdraft_roar', 'backdraft_chord'],
    'Blaze Wild ignition per cell': ['blaze_ignite'] + [f'blaze_ignite_{i}' for i in range(2, 6)],
    'multiplier hits x2/x3/x5/x10 rising': ['blaze_mult_2', 'blaze_mult_3', 'blaze_mult_5', 'blaze_mult_10'],
    'line wins per symbol': [f'sym_win_{s}' for s in ('h1', 'h2', 'h3', 'h4', 'l1', 'l2', 'l3', 'l4', 'w')], 'line win tiers': ['line_win_small', 'line_win_mid'],
    'win tiers': ['total_win_small', 'total_win_mid', 'total_win_big'], 'count-up ladder': [f'count_ticker_{i}' for i in range(1, 13)],
    'count-up start / land / out': ['rung_flare', 'rung_land', 'rung_out'],
    'big-win rungs + rising beds': [f'rung_hit_{k}' for k in ('big', 'huge', 'mega', 'epic', 'max')] + [f'rung_bed_{k}' for k in ('big', 'huge', 'mega', 'epic', 'max')],
    'rung signs + bursts': [f'sign_impact_{k}' for k in ('big', 'huge', 'mega', 'epic', 'max')] + ['burst_water', 'burst_embers', 'burst_badges', 'burst_coins', 'burst_gold'],
    'MAX WIN (cap only)': ['win_max'], 'Rescue entry': ['rescue_enter', 'rescue_loop'], 'Inferno entry': ['inferno_enter', 'inferno_loop'],
    'hose spray start/loop/end + steam': ['hose_start', 'hose_loop', 'hose_end', 'steam'], 'room level-down': ['room_down'],
    'rescue ta-da stepping up with the multiplier': [f'rescue_tada_{i}' for i in range(1, 9)], 'instant prize coin shower': ['prize_coins', 'prize_coins_big'],
    'building cleared + two-tone call + new block': ['building_cleared', 'siren_pass', 'block_slide'], 'spins added': ['spins_added'], 'last spin': ['last_spin'],
    'Rescue / Inferno end totals': [f'rescue_total_{s}' for s in ('small', 'mid', 'big')] + [f'inferno_total_{s}' for s in ('small', 'mid', 'big')],
    'Alarm Call ring + card flip + outcomes (False Alarm neutral + Ember bark)': ['alarm_call_ring', 'alarm_card_flip', 'alarm_outcome_rescue', 'alarm_outcome_inferno', 'alarm_outcome_false', 'dog_bark'],
    'Backdraft Spins bookends + layer': ['backdraft_spins_start', 'backdraft_spins_end', 'backdraft_spins_layer'],
    'base beds A/B (32 bars each)': ['base_loop_a', 'base_loop_b'], 'dead spin settle (neutral)': ['dead_spin_settle'],
    'HUD clicks / bet / ante / insufficient / buy': ['ui_click_1', 'ui_click_2', 'ui_click_3', 'bet_change', 'ante_on', 'ante_off', 'alert_insufficient', 'buy_confirm'],
    'ambience': ['ambient_station_loop'], 'scene transition (bay door)': ['shutter_slam', 'shutter_haul_1', 'shutter_haul_2', 'shutter_haul_3'],
}

# --------------------------------------------------------------------------------------------------- compile + validate
def feeds(draw_name):
    out = [cid for cid, c in CUES.items() if c.get('source') == draw_name or (c.get('derive') or {}).get('from') == draw_name]
    return sorted(set(out))


def validate():
    errs = []
    for n, d in DRAWS.items():
        full = d['prompt'] + PALETTES[d['palette']]
        if len(full) > 450: errs.append(f'{n}: prompt {len(full)} chars > 450')
        if not (0.5 <= d['s'] <= 30): errs.append(f'{n}: duration {d["s"]} outside 0.5..30 s')
        if not (0.0 <= d['influence'] <= 1.0): errs.append(f'{n}: influence')
        if not feeds(n): errs.append(f'{n}: draw feeds no cue')
    texts = [(n, d['prompt']) for n, d in DRAWS.items()] + [(n, json.dumps(p['positive'] + p['negative'] + p['sections'])) for n, p in PLANS.items()]
    texts += [(k, v) for k, v in PALETTES.items()]
    for n, t in texts:
        for rx in BANNED:
            if re.search(rx, t, re.I): errs.append(f'{n}: banned word /{rx}/')
    for n, p in PLANS.items():
        tot = sum(s['duration_ms'] for s in p['sections']) / 1000.0; bar = 4 * 60.0 / p['bpm']
        if tot < p['loop_s'] + bar: errs.append(f'{n}: sections {tot:.1f} s < loop {p["loop_s"]:.1f} s + 1 bar')
        if not any('first beat' in s or 'beat one' in s for s in p['positive']): errs.append(f'{n}: no "from the first beat" rule')
        if p['bars'] >= 32 and len(p['sections']) != 4: errs.append(f'{n}: 32-bar bed needs 4 sections')
        if p['cue'] not in ('anticipation_layer', 'backdraft_spins_layer') and not any('turnaround' in ' '.join(s['positive']) for s in p['sections']):
            errs.append(f'{n}: no turnaround')
        for s in p['sections']:
            if not (3000 <= s['duration_ms'] <= 120000): errs.append(f'{n}: section length')
    for m, ids in COVERAGE.items():
        for cid in ids:
            if cid not in CUES: errs.append(f'coverage "{m}": {cid} not in roster')
    for cid, c in CUES.items():
        d = c.get('derive') or {}
        if not c.get('source') and not d.get('from'): errs.append(f'{cid}: no source/derivation')
        if c.get('source') and c['bus'] == 'sfx' and c['source'] not in DRAWS: errs.append(f'{cid}: source {c["source"]} not drawn')
        if d.get('from') and d['from'] not in DRAWS and d['from'] not in CUES: errs.append(f'{cid}: derives from unknown {d["from"]}')
    return errs


def estimate():
    sfx = sum(sfx_cost(d['s']) for d in DRAWS.values())
    mus = sum(music_cost(sum(s['duration_ms'] for s in p['sections'])) for p in PLANS.values())
    mus_s = sum(sum(s['duration_ms'] for s in p['sections']) for p in PLANS.values()) / 1000.0
    worst = sfx + mus + mus + int(0.25 * sfx) + 60   # every plan redrawn once + a quarter of the SFX redrawn + quota GETs
    return dict(sfxDraws=len(DRAWS), sfxSeconds=round(sum(d['s'] for d in DRAWS.values()), 1), sfxChars=sfx, musicPlans=len(PLANS),
                musicSeconds=round(mus_s, 1), musicChars=mus, expectedChars=sfx + mus, worstCaseChars=worst,
                worstCaseAt2xMusicRate=sfx + 2 * (2 * mus) + int(0.25 * sfx),
                ratios={'sfxCharsPerSecond': SFX_CHARS_PER_S, 'musicCharsPerPlannedSecond': round(MUSIC_CHARS_PER_S, 3),
                        'source': 'donor ledger LUCKY audio/source-record.json round lucky_0923: 138 SFX headers (round-half-up 11 x s); '
                                  'account moved 17,202 over 161 draws, SFX headers 1,996 -> music 15,206 / 1,106 planned s'},
                quotaFloor=QUOTA_FLOOR)


def write():
    now = time.strftime('%Y-%m-%dT%H:%M:%S')
    est = estimate()
    prompts = {'_note': f'PIGGY FIREFIGHTERS SFX prompt source (generated by audio/tools/roster.py {now}; edit roster.py, not this file). '
                        'Full prompt sent = prompt + _palettes[palette] (<= 450 chars). `ships`: the cue ids this draw feeds.',
               '_palettes': PALETTES}
    jobs = {'_note': 'Compiled SFX jobs for audio/tools/gen_audio.mjs (generated by roster.py). est_chars = donor-measured '
                     'round_half_up(11 x s). Draws land in audio/cues_pcm/<name>.wav; the ledger is audio/source-record.json.',
            '_estimate': est}
    for n, d in DRAWS.items():
        prompts[n] = dict(d, ships=feeds(n))
        full = d['prompt'] + PALETTES[d['palette']]
        jobs[n] = dict(route='sfx', cue=n, feeds=feeds(n), s=d['s'], group=d['group'], loop=d['loop'], influence=d['influence'],
                       palette=d['palette'], prompt=full, chars=len(full), est_chars=sfx_cost(d['s']))
    plans = {'_note': ('PIGGY FIREFIGHTERS music composition plans (generated by roster.py). gen_audio.mjs sends '
                       '{composition_plan: {positive_global_styles, negative_global_styles, sections[]}, model_id, respect_sections_durations: true}; '
                       'draws are named <plan>__N. Tempo/key are prompt text, so build_audio.py time-scales each draw onto its grid and cuts whole bars '
                       'sample-exact; the hook (G C E G | A G E C) is synthesised and mixed in because the model cannot play dictated notes. '
                       'Sections sum to >= loop length + 1 bar. A measured-defect redraw is a NEW plan name <plan>_v2 with `redrawOf` and a `defect` '
                       'line, chosen in bed_overrides.json; never a blind re-roll.'),
             '_estimate': {k: est[k] for k in ('musicPlans', 'musicSeconds', 'musicChars', 'ratios')}}
    for n, p in PLANS.items():
        plans[n] = dict(p, est_chars=music_cost(sum(s['duration_ms'] for s in p['sections'])))
    # keep any redraw plans a later pass added by hand (name_v2 etc.)
    old_plans_path = f'{TOOLS}/plans.json'
    if os.path.exists(old_plans_path):
        for n, p in json.load(open(old_plans_path)).items():
            if not n.startswith('_') and n not in plans and p.get('redrawOf'): plans[n] = p
    json.dump(prompts, open(f'{TOOLS}/prompts.json', 'w'), indent=1)
    json.dump(jobs, open(f'{TOOLS}/jobs.json', 'w'), indent=1)
    json.dump(plans, open(f'{TOOLS}/plans.json', 'w'), indent=1)
    # ---- cues.json (merge)
    path = f'{ROOT}/audio/cues.json'
    old = json.load(open(path)) if os.path.exists(path) else {'cues': []}
    by = {c['id']: c for c in old.get('cues', [])}
    KEEP = ('gain', 'measured', 'mix', 'build', 'loopPoints')
    out = []
    for cid, c in CUES.items():
        prev = by.get(cid, {}); n = dict(c)
        for k in KEEP:
            if k in prev: n[k] = prev[k]
        if prev.get('build'): n['durationMs'] = prev['durationMs']; n['status'] = 'built'
        else:
            n['status'] = 'planned'
            if n['loop']: n['loopPoints'] = {'startMs': 0, 'endMs': n['durationMs'], 'sampleAccurate': True, 'planned': True}
        out.append(n)
    dropped = sorted(set(by) - set(CUES))
    doc = {
        '$schema_note': ('PIGGY FIREFIGHTERS audio registry (roster by audio/tools/roster.py, 2026-09-25; build/mix fields by build_audio.py / mix.py). '
                         'One entry per cue; ids are the frontend contract and never change once wired. buses: music|sfx. files: ogg (Opus 160k) first, '
                         'm4a (AAC-LC 160k) second. gain = pre-duck cue trim set from measurement (mix.py); the player master/music/sfx volume sits OUTSIDE '
                         'ducking. status planned = roster only (durationMs is the PLANNED length), built = mastered and measured. `replaces` = the donor id '
                         'the ported runtime still plays at that moment; `seam` = where the new id should be played; `duck` = suggested duck call; `gate` = '
                         'when the cue may play. Generated runtime projection: apps/piggy_firefighters/src/game/audio/cueManifest.ts (gen_manifest.mjs).'),
        'grid': {'tempoBpm': BASE_BPM, 'targetBpm': BASE_BPM, 'key': 'C major (major-pentatonic lead)', 'meter': '4/4',
                 'bonusBpm': {p['cue']: p['bpm'] for p in PLANS.values()},
                 'hook': {'midi': [67, 72, 76, 79, 81, 79, 76, 72], 'notes': 'G4 C5 E5 G5 | A5 G5 E5 C5', 'role': 'bugle call + pentatonic answer; its first bar is the pickup that resolves the alarm ladder'},
                 'note': (f'Base beds {BASE_BPM} BPM (32 bars = {loop_s(32, BASE_BPM):.3f} s), Rescue / Inferno {BONUS_BPM} BPM (32 bars = '
                          f'{loop_s(32, BONUS_BPM):.3f} s), win-rung beds {RUNG_BPM} BPM (8 bars = {loop_s(8, RUNG_BPM):.3f} s), anticipation layer 4 bars @ {BASE_BPM}, '
                          f'Backdraft Spins layer 16 bars @ {BASE_BPM}. Every loop sample-exact on its own grid (kit.stage_for). The signature hook is synthesised and '
                          'mixed into every 32-bar bed at bars 1-4 / 17-20 and into the rung beds at bars 1-4 (build_audio.py).')},
        'mix': {'musicBusLUFS': -14, 'sfxBusLUFS': -16, 'maxTruePeak_dBTP': -1.0, 'duckDb': [3, 6], 'duckAttackMs': [40, 80], 'duckReleaseMs': [250, 500],
                'bedLUFS': {p['cue']: p['targetLUFS'] for p in PLANS.values()},
                'rules': ['one primary bed outside a bounded crossfade', 'one major celebration at a time',
                          'cap simultaneous SFX; enforce cooldown/maxInstances', 'no ducking on ordinary clicks, stops or landings; duck the music under every win cue',
                          'no celebration when the round return is at or below the bet (neutral cue or nothing)',
                          'anticipation only while a trigger (or a bigger award) is still possible; a miss resolves neutrally',
                          'the alarm ladder (ii-V) resolves ONLY on trigger_fanfare', 'MAX WIN cue for the capped round only',
                          'turbo merges the reel stops into reel_stop_turbo and uses *_turbo variants; the soundtrack is never sped up',
                          'every sound cue also has a visual cue (muted phones)']},
        'transitions': {
            'baseToBonus': 'alarms land -> trigger_fanfare (duck) -> bay-door shutter (shutter_slam/hauls) -> rescue_enter|inferno_enter (duck) -> '
                           'rescue_loop|inferno_loop, 600 ms equal-power crossfade; ambience off (900 ms)',
            'bonusToBase': 'rescueEnd -> rescue_total_*|inferno_total_* or win rungs -> shutter -> base_loop_a/b (the OTHER tune from the one left), 900 ms, ambience back on',
            'backdraftSpins': 'backdraft_spins_start (duck) + backdraft_spins_layer added over the base bed; per spin backdraft_* + blaze_*; backdraft_spins_end, layer removed',
            'alarmCall': 'alarm_call_ring -> anticipation_layer on -> alarm_card_flip -> alarm_outcome_* (false: neutral + dog_bark) -> layer off -> bonus entry or base',
            'winRungs': 'rung_bed_<tier> replaces the scene bed (one bed at a time, 260 ms between rungs, 700 ms back); hits/signs/bursts per rung; count_ticker every 150 ms',
            'turbo': 'tempo stable; *_turbo variants and reel_stop_turbo; skip reel_spin_loop in Super Turbo; never speed the soundtrack',
            'idempotency': 'skip/replay/resume/teardown cancels stale scheduled sources and restores the correct bed once; tiny gain ramps on start/stop'},
        'cues': out}
    if os.path.exists(path):
        doc = {**{k: v for k, v in old.items() if k not in ('cues',)}, **doc}
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(doc, open(path, 'w'), indent=1)
    return est, dropped


if __name__ == '__main__':
    errs = validate()
    for e in errs: print('ERROR', e)
    est = estimate()
    print(json.dumps(est, indent=1))
    n_turbo = sum(1 for c in CUES if c.endswith('_turbo'))
    print(f'{len(DRAWS)} SFX draws, {len(PLANS)} music plans -> {len(CUES)} cue ids ({n_turbo} turbo variants, '
          f'{sum(1 for c in CUES.values() if c["bus"] == "music")} music)')
    if errs: sys.exit(1)
    if '--check' not in sys.argv:
        est, dropped = write()
        print('wrote prompts.json, jobs.json, plans.json, audio/cues.json', ('dropped: ' + ', '.join(dropped)) if dropped else '')
