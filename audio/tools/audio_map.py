#!/usr/bin/env python3
"""Generate docs/AUDIO_MAP.md (PIGGY FIREFIGHTERS, family tool LUCKY audio_map_lucky.py adapted 2026-09-25): every cue id ->
game moment -> bus -> length -> gain -> what it sounds like (the prompt / plan it is drawn from, or how it is derived) ->
seam / donor id it replaces -> build notes (key-fit, snap, hybrid, hook pickup, re-master). Works on the ROSTER before any
draw (status planned: lengths are planned) and after the build (status built: measured). Source of truth: audio/cues.json +
audio/tools/prompts.json + plans.json.   usage: python3 audio/tools/audio_map.py"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit as K
ROOT = K.ROOT
doc = json.load(open(f'{ROOT}/audio/cues.json')); cues = doc['cues']
P = json.load(open(f'{K.TOOLS}/prompts.json')); PL = json.load(open(f'{K.TOOLS}/plans.json'))


def short(t, n=150):
    t = t.replace('|', '/'); return t if len(t) <= n else t[:n - 1].rsplit(' ', 1)[0] + ' …'


def sounds(c):
    cid = c['id']; d = c.get('derive') or {}; src = c.get('source')
    if c['bus'] == 'music':
        pn = (c.get('build') or {}).get('source', src or '').rsplit('__', 1)[0]; pl = PL.get(pn, {})
        return short(f"{(c.get('build') or {}).get('bars') or c.get('bars')}-bar loop @ {c.get('tempoBpm')} BPM: " + (pl.get('positive') or [''])[0])
    if src in P: return short(P[src]['prompt'])
    op = d.get('op'); frm = d.get('from'); B = c.get('build') or {}
    kn = (B.get('tonal') or {}).get('knock') if isinstance(B.get('tonal'), dict) else None
    if kn and op == 'ladder': return f"drawn thunk of {frm} pitched +{d.get('semis')} st (low body) + synthesised tuned wood knock {kn} (phone band)"
    if op == 'turbo': return f"{frm} time-scaled x{d.get('timeScale')} (turbo, pitch kept)"
    if op == 'ladder': return f"{frm} pitched +{d.get('semis')} st (tonic ladder C D E G A)"
    if op == 'ladder-resample': return f"{frm} resampled +{d.get('semis')} st (count-up ladder)"
    if op == 'hybrid-chord' and frm: return f"drawn bell strike ({short(P[frm]['prompt'], 60)}) + synthesised chime chord {d.get('chord')}"
    if op == 'hybrid-ping': return f"drawn {frm} + tuned ping MIDI {d.get('note')}"
    if op == 'hybrid-ping-ladder': return f"tuned C5 blip + drawn click ({short(P[frm]['prompt'], 60)})"
    if op == 'snap-ladder': return f"{frm} (snapped brass ta-da) shifted to the rung's held note"
    if op == 'pitch': return f"{frm} pitched +{d.get('semis')} st"
    if op == 'stack': return f"stack of {', '.join(d.get('of', []))} (one merged stop)"
    return op or ''


def notes(c):
    B = c.get('build') or {}; n = []
    k = B.get('key') or {}
    if k.get('semis'): n.append(f"key-fit {k['semis']:+.2f} st")
    if (B.get('pitch') or {}).get('op') == 'pitch-snapped': n.append(f"snap {B['pitch']['semis']:+.2f} st -> {B['pitch']['targetNote']}")
    if B.get('tonal'): n.append(B['tonal'].get('op', 'hybrid'))
    if (B.get('hook') or {}).get('pickup') is True: n.append('hook pickup')
    if B.get('hook') and isinstance(B['hook'], dict) and B['hook'].get('colour'): n.append(f"hook {B['hook']['colour']} bars {[b + 1 for b in B['hook']['bars']]}")
    if B.get('remaster'): n.append(f"re-mastered +{B['remaster']['raised_dB']} dB")
    if c.get('duck'): n.append('duck ' + ', '.join(f'{a} {b}' for a, b in c['duck'].items()))
    if c.get('gate'): n.append('gate: ' + c['gate'])
    return '; '.join(n)


# ---- contract §8 event -> cues (r2, 2026-09-25): every SDK and custom book event of docs/GAME_CONTRACT.md §8, by name
R = lambda p, a, b: [f'{p}{i}' for i in range(a, b + 1)]
TIERS = ('**Win tier (contract §8, client-derived from the booked round total W; S = the CHARGED cost of the selected mode, B = the base bet):** '
         'the stake check comes first: **W <= S is tier 0** (no celebration: no stinger, no rung, no plate; ordinary accounting only) even when '
         'W clears a floor (a 90x Inferno buy returning 50x is tier 0). Then the floors in BASE-BET units: tier 1 S < W < 15B · BIG >= 15B (2) · '
         'HUGE >= 30B (3) · MEGA >= 50B (4) · EPIC >= 100B (5) · MAX = the 15,000x cap (6). The SDK `winLevel` is informational; the client never '
         'reads it for presentation. Per-spin wins inside a bonus get the ordinary win presentation; rungs play once, on the round total.')
EVENTS = [
    ('reveal', 'SDK', 'the board lands (base, ALARM BOOST, every bonus spin)',
     ['spin_start', 'spin_whoosh', 'reel_spin_loop'] + R('reel_stop_', 1, 5) + ['reel_stop_turbo'] + R('alarm_land_', 1, 5) + ['galarm_glint', 'wild_land',
      'anticipation_layer', 'antic_riser', 'antic_riser_2', 'antic_hit', 'antic_miss'],
     'spin_start / spin_whoosh on the spin press, reel_spin_loop while the reels travel; one reel_stop_n per reel (reel_stop_turbo in Turbo); '
     'alarm_land_n on the n-th alarm (ii -> V -> V7 -> V9 -> V13, unresolved); anticipation only while a trigger is still possible, resolved '
     'by antic_hit / antic_miss (neutral)'),
    ('winInfo', 'SDK', 'line wins of the spin', [f'sym_win_{s}' for s in ('h1', 'h2', 'h3', 'h4', 'l1', 'l2', 'l3', 'l4', 'w')] + ['line_win_small', 'line_win_mid'],
     'per-symbol win cue + the line-total cue; never when the round return is at or below the stake (tier 0)'),
    ('setWin', 'SDK', 'the spin win meter', ['line_win_small', 'line_win_mid'] + R('count_ticker_', 1, 12),
     'inside a bonus a per-spin win gets the ordinary win presentation and counts into the running total; the count-up ticks climb the '
     'pentatonic ladder while a meter counts'),
    ('setTotalWin', 'SDK', 'the round total W is booked', ['dead_spin_settle', 'total_win_small', 'total_win_mid', 'total_win_big']
     + [f'rung_hit_{k}' for k in ('big', 'huge', 'mega', 'epic', 'max')] + [f'rung_bed_{k}' for k in ('big', 'huge', 'mega', 'epic', 'max')]
     + [f'sign_impact_{k}' for k in ('big', 'huge', 'mega', 'epic', 'max')] + [f'burst_{k}' for k in ('water', 'embers', 'badges', 'coins', 'gold')]
     + ['rung_flare', 'rung_land', 'rung_out', 'win_max'],
     'tier 0 (W <= S): nothing (dead_spin_settle for a W = 0 base spin with no alarms); tier 1: total_win_small / mid / big (three sizes inside '
     'tier 1; the contract sets no sub-floors, the frontend picks the size); tiers 2-5: the win rungs BIG -> EPIC (rung_hit_* + rung_bed_* + '
     'sign_impact_* + burst_* + flare / land / out + count-up), climbing to the round tier; tier 6: rung_hit_max + rung_bed_max + win_max'),
    ('finalWin', 'SDK', 'the round closes', ['dead_spin_settle', 'total_win_small', 'total_win_mid', 'total_win_big', 'win_max'],
     'same tier rule as setTotalWin (the presentation plays once per round, on whichever of the two the runtime keys it to)'),
    ('freeSpinTrigger', 'SDK', 'a natural 3+ alarm trigger', ['trigger_fanfare', 'shutter_slam', 'shutter_haul_1', 'shutter_haul_2', 'shutter_haul_3'],
     'trigger_fanfare is the ONLY cue that resolves the alarm ladder (its G C E G pickup lands on C); then the bay-door shutter'),
    ('updateFreeSpin', 'SDK', 'the spin counter changes', ['spins_added', 'last_spin'], 'spins_added when spins are added, last_spin when one spin is left'),
    ('freeSpinEnd', 'SDK', 'the bonus closes', [f'rescue_total_{s}' for s in ('small', 'mid', 'big')] + [f'inferno_total_{s}' for s in ('small', 'mid', 'big')]
     + ['backdraft_spins_end'], 'tier 1: rescue_total_* / inferno_total_* by size; tier >= 2: the win rungs instead; Backdraft Spins close on backdraft_spins_end'),
    ('wincap', 'SDK', 'the 15,000x cap is hit', ['win_max', 'rung_hit_max', 'rung_bed_max'], 'the capped round ONLY (tier 6); never for EPIC'),
    ('backdraft', 'custom', 'cells ignite (base / ALARM BOOST / Backdraft Spins)', ['backdraft_whoosh', 'backdraft_roar', 'backdraft_chord', 'blaze_ignite']
     + R('blaze_ignite_', 2, 5) + [f'blaze_mult_{m}' for m in (2, 3, 5, 10)],
     'whoosh -> roar -> chord, one blaze_ignite_n per cell (C5 D5 E5 G5 A5), blaze_mult_x for a cell `mult` (Backdraft Spins only)'),
    ('alarmCall', 'custom', 'first event of an alarm_call round', ['alarm_call_ring', 'alarm_card_flip', 'alarm_outcome_false', 'dog_bark', 'alarm_outcome_rescue', 'alarm_outcome_inferno'],
     'False Alarm is neutral (muted trumpet + two happy barks), never a fail sound; Rescue < Inferno'),
    ('rescueStart', 'custom', 'the bonus starts (natural / buy / Alarm Call)', ['rescue_enter', 'inferno_enter', 'rescue_loop', 'inferno_loop'],
     'the entry flourish, then the feature bed (600 ms equal-power crossfade from the base bed); each feature has its own bed and sting'),
    ('douse', 'custom', 'every bonus spin (may be empty)', ['hose_start', 'hose_loop', 'hose_end', 'steam', 'room_down'] + R('rescue_tada_', 1, 8) + ['prize_coins', 'prize_coins_big', 'spins_added'],
     'hose per spray, room_down per room, rescue_tada_n per rescue at multiplier n (C4 D4 E4 G4 A4 C5 D5 E5), prize coins, spins_added when spinsAdded > 0'),
    ('buildingCleared', 'custom', 'the last room of a building is rescued', ['building_cleared', 'siren_pass', 'block_slide', 'spins_added'],
     'fanfare, the two-tone horn call passing, the next block sliding in, +5 spins'),
    ('rescueEnd', 'custom', 'after the last spin\'s setTotalWin', [f'rescue_total_{s}' for s in ('small', 'mid', 'big')] + [f'inferno_total_{s}' for s in ('small', 'mid', 'big')],
     'the bonus round total W against S: tier 0 nothing, tier 1 rescue_total_* / inferno_total_* by size, tier >= 2 the win rungs'),
    ('backdraftSpinsStart', 'custom', 'Backdraft Spins begin', ['backdraft_spins_start', 'backdraft_spins_layer'], 'start flourish + the additive layer over the base bed'),
    ('backdraftSpinsEnd', 'custom', 'Backdraft Spins end', ['backdraft_spins_end'], 'warm resolving close; the total follows the tier rule'),
]
ids = {c['id'] for c in cues}
unknown = sorted({i for e in EVENTS for i in e[3] if i not in ids})
covered = {i for e in EVENTS for i in e[3]}
built = sum(1 for c in cues if c.get('status') == 'built')
rows = []
for c in cues:
    seam = c.get('seam', '') + (f" (replaces `{c['replaces']}`)" if c.get('replaces') else '')
    ms = c.get('durationMs'); ms = f"{ms:g}" + ('' if c.get('status') == 'built' else ' (planned)')
    base = os.path.basename(c['files'][0]).rsplit('.', 1)[0]; stat = f"apps/{K.GAME}/static/{os.path.dirname(c['files'][0])}"
    have = all(os.path.exists(f"{ROOT}/apps/{K.GAME}/static/{f}") for f in c['files'])
    lp = c.get('loopPoints') or {}
    loopcol = ('loop' + (f" [{lp['startMs']:g}, {lp['endMs']:g}) ms" if lp.get('padSamples') else '')) if c.get('loop') else ''
    rows.append((c.get('event', ''), f"`{c['id']}`", f"`{base}.ogg` / `.m4a`" + ('' if have else ' (missing)'), c['bus'], loopcol, ms, c.get('gain'), sounds(c), seam, notes(c)))
g = doc['grid']
os.makedirs(f'{ROOT}/docs', exist_ok=True)
with open(f'{ROOT}/docs/AUDIO_MAP.md', 'w') as f:
    f.write('# PIGGY FIREFIGHTERS — audio map (generated)\n\n'
            'Generated by `audio/tools/audio_map.py` from `audio/cues.json` (the registry the client loads through the generated '
            '`apps/piggy_firefighters/src/game/audio/cueManifest.ts`), `audio/tools/prompts.json` and `audio/tools/plans.json`. '
            'Do not hand-edit: change `audio/tools/roster.py`, re-run it, then this. Direction and rules: `assets/SOUND_BIBLE.md`; '
            'pipeline: `audio/README.md`.\n\n'
            f"**{len(rows)} cue ids; {built} built, {len(rows) - built} planned.** Files live in `apps/{K.GAME}/static/assets/audio/{K.GAME}/`. Grid: base {g['tempoBpm']} BPM, bonus/rungs "
            f"{sorted(set(v for k, v in g['bonusBpm'].items() if v != g['tempoBpm']))} BPM, key {g['key']}, hook {g['hook']['notes']}. "
            'Gain = pre-duck cue trim from `audio/tools/mix.py` (1.0 until measured). `seam` = where the new id should be played; '
            '`replaces` = the donor id the ported runtime still plays there (the runtime seam is a later frontend task). '
            + ('**Nobody has listened to any of this yet.**' if built else '**Roster only: no sound has been drawn yet.**') + '\n\n')
    f.write('## Owner rules\n\n'
            '- **Audio lane** owns every file this map points at: `audio/**` (registry, tools, masters, QA), '
            f"`apps/{K.GAME}/static/assets/audio/**` (what ships: `<id>.ogg` Opus 160k 48 kHz + `<id>.m4a` AAC-LC 160k 44.1 kHz, "
            'ogg first), the GENERATED `src/game/audio/cueManifest.ts`, this map and `assets/SOUND_BIBLE.md`. A sound changes only by '
            're-running the build (`build_audio.py` -> `mix.py` -> `gen_manifest.mjs` -> `measure.py` -> `audio_map.py`), never by hand, '
            'and never by copying a donor file (the donor LUCKY folder was purged from static; no donor sound ships).\n'
            '- **Frontend lane** owns WHEN a cue plays: the `seam` column names the call site (`audioManager.ts`, `presentationDirector.ts`, '
            '`fx/audioDirector.ts`, `audio/index.ts`, `WinRungs.svelte`, the HUD). Where `replaces` names a donor id, the ported runtime '
            'still asks for that donor id, which is no longer in the manifest (the runtime skips unknown ids silently): wiring the new id '
            'at its seam is a frontend task.\n'
            '- **Ids are the contract**: once wired, an id never changes; a better sound ships under the same id.\n'
            '- **Gains come only from measurement** (`mix.py`: loudest 400 ms of the shipped .ogg vs the family target; every reward chain '
            'strictly rising on the stereo power, the (L+R)/2 mono sum AND a 400 Hz high-pass phone proxy of that sum). Beds keep gain 1.0 '
            'and are mastered to their LUFS target.\n'
            '- **Paid draws** (ElevenLabs) only through `gen_audio.mjs`, ledgered in `audio/source-record.json`; a redraw needs a named, '
            'measured defect (`--force --reason`); the coordinator issues it.\n\n')
    f.write('## Contract §8 event -> cues\n\n' + TIERS + '\n\n| event | kind | when | cues | rule |\n|---|---|---|---|---|\n')
    for ev, kind, when, cl, rule in EVENTS:
        f.write(f"| `{ev}` | {kind} | {when} | {', '.join(f'`{i}`' for i in cl)} | {rule} |\n")
    f.write(f"\nEvery event of contract §8 is listed ({len(EVENTS)}: 9 SDK + 8 custom); ids named here that are not in the registry: "
            f"{unknown or 'none'}. HUD / scene cues outside the book events (ui clicks, bet change, ALARM BOOST toggle, buy, insufficient balance, "
            f"ambience, base beds) are in the table below.\n\n")
    f.write('## Rules every cue follows\n\n' + '\n'.join(f'- {r}' for r in doc['mix']['rules']) + '\n\n')
    f.write('## Transitions\n\n' + '\n'.join(f'- **{k}**: {v}' for k, v in doc['transitions'].items()) + '\n\n')
    f.write('## Moment -> cue -> file\n\n| moment | cue | file | bus | loop | ms | gain | sounds like | seam (frontend call site) | notes |\n|---|---|---|---|---|---|---|---|---|---|\n')
    for r in rows: f.write('| ' + ' | '.join(str(v) for v in r) + ' |\n')
print('wrote docs/AUDIO_MAP.md', len(rows), 'rows', f'({built} built)')
