# PIGGY FIREFIGHTERS — Sound Bible

Owner: AUDIO lane. Status: **v2, 2026-09-25: BUILT.** 107 ElevenLabs draws (11 music, 96 SFX; ledger
`audio/source-record.json`) -> 232 cue ids x 2 codecs = 464 shipped files in
`apps/piggy_firefighters/static/assets/audio/piggy_firefighters/` (30 MB), `cueManifest.ts` regenerated (232 cues).
`measure.py` **PASS: false on ONE named draw defect** (`base_loop_a` chug 4.14 > 3; its redraw is requested, §10);
every other acceptance check passes (§11). **Human listening NOT RUN (§9).** Theme: `docs/PIGGY_FIREFIGHTERS_THEME.md` §6.
Rules: `docs/AUDIO_DESIGN_NOTES.md`, `CLAUDE.md`. Per-cue map (moment -> cue -> file -> seam -> owner): `docs/AUDIO_MAP.md`
(generated). Pipeline: `audio/README.md`. Every sound is drawn fresh for this title (ElevenLabs) or synthesised by our own
tools; no donor sound file is used (the donor's untracked `static/assets/audio/lucky/` — 388 files — was purged by
`build_audio.py --purge-donor` before the first write).

## 1. Musical identity

Station 13 of the Piggy Fire Department at dusk, played by a **warm firehouse brass band with slot polish**: trumpets,
trombones, French horn, tuba, clarinet / flugelhorn, **glockenspiel**, vibraphone, a brass fire bell, snare, bass drum,
toms and timpani for the hot moments. Heroic-comic, never grim: pleasant first (the panel rule — abrasive gets muted), the
"cheese factor" kept as a feature (march oom-pah, bugle calls, a two-tone horn figure), polished enough to match the art.
No voice anywhere in this pass (VO is a later, toggleable option, §8).

- **Grid:** base beds **92 BPM**; Rescue / Inferno and the win-rung beds **100 BPM**; 4/4; key **C major pentatonic**
  (C D E G A). The Inferno bed centres on **A** over the same five notes (A minor pentatonic): darker and hotter with no
  note outside the set, so every ladder and key-fit still holds. Loops are whole bars, sample-exact on their own grid:
  32 bars for the primary beds (base 83.478 s, bonus 76.8 s), 16 planned for the Backdraft Spins layer (41.739 s; ships as 12 bars = 31.304 s until its redraw, §2.2), 8 for the rung
  beds (19.2 s), 4 for the anticipation layer (10.435 s). (The brief's "32 bars ~ 90 s" is not reachable at 92-96 BPM:
  32 bars are 80.0-83.5 s there; 92 BPM gives the longest bed in range.)
- **Signature hook — the station call:** **G4 C5 E5 G5 | A5 G5 E5 C5** (one note per beat; a bugle call on the natural-horn
  notes, answered by a pentatonic fall to the tonic). The music model cannot play dictated notes (family evidence: 2-5 of
  16 beats matched), so the hook is SYNTHESISED deterministically (`audio/tools/hook_layer.py`) at each bed's tempo and mixed
  in at bars 1-4 and 17-20 of every 32-bar bed and bars 1-4 of the rung beds, 3-4 dB under the bed. Colours: base A
  glockenspiel · base B vibraphone · Rescue bugle (synth brass) · Inferno low bugle · rungs glock -> bugle -> bugle -> bell
  -> bell. Its first bar (G C E G) is also the **pickup** on up to 17 fanfares (glockenspiel eighths at 132 BPM, -5 dB; only on
  a fanfare whose own content measures >= 0.6 C-pentatonic) — and it
  is what resolves the alarm ladder (§4).
- **As built:** the hook sits in every bed at its registered colour and level (base A glock +1 oct -4 dB, base B vibes
  +1 oct -4 dB, Rescue bugle -3.5 dB, Inferno bugle -1 oct -3.5 dB, rung beds glock / bugle / bugle / bell / bell -4 .. -3 dB),
  mixed at the RMS of the bed bars it lands on. The pickup landed on **15 of 17** fanfares (G5 C6 E6 G6 glock eighths,
  132 BPM, -5 dB): `trigger_fanfare` (C-pent 0.98), both entries, `backdraft_spins_start`, `building_cleared`, the three big
  totals, rung hits HUGE / MEGA / EPIC, `win_max`, both good Alarm Call outcomes, `spins_added`. Refused (content not in C
  pentatonic, a pickup would clash): `rung_hit_big` (0.52), `rung_hit_max` (0.58).

## 2. Beds (music bus) — `audio/tools/plans.json`

Composition plans (`music_v1`): globals carry tempo, key, the hook description, the instrumentation and the rhythm rule
("the rhythm section plays ONLY on the quarter-note beats") plus "full ensemble from the very first beat"; 4 named
sections of (loop / 4 + margin) — A hook statement / B new answering material / A' hook return, re-orchestrated / C lift
and a two-bar turnaround back to the hook's first note — so a 32-bar bed is 32 composed bars, never one 8-bar idea
dressed up (the family's *Bad sound design* tag: 16.7 s beds, one 8-bar loop EQ'd into "32 bars"). Negatives carry the
known failure modes: long intro, fade in/out, tempo/key change, silence, strummed eighths, constant chugging, busy
hi-hats/snare rolls, harsh highs, shrill whistles, vocals/choir/crowd, circus calliope, kazoo.

| Cue | Plan | Arrangement | Target |
|---|---|---|---|
| `base_loop_a` | `pf_base92a` | bright oom-pah march: muted trumpet + glockenspiel hook, clarinet answer, trumpets return, French horn turnaround | -15.5 LUFS |
| `base_loop_b` | `pf_base92b` | a different tune for long sessions: vibraphone + flugelhorn hook, brushes + walking tuba, trombone chorale | -15.5 LUFS |
| `rescue_loop` | `pf_rescue100` | driving heroic march; a **two-tone horn figure (high C / low G, half notes)** as the crew's call — the "siren" is musical, never a real siren | -15.5 LUFS |
| `inferno_loop` | `pf_inferno100` | hotter and darker: low brass, taiko-like toms, timpani, string ostinato, tubular bells, A-centred with C-major lifts | -15.2 LUFS |
| `anticipation_layer` | `pf_antic92` | additive stem: swelling snare roll, bell tremolo on G/D, tuba pedal on G (the dominant, unresolved) | layer -21 dBFS |
| `backdraft_spins_layer` | `pf_backdraft92` | additive stem over the base bed: toms, fire-shaker texture, low brass stabs, rising glockenspiel | layer -20 dBFS |
| `rung_bed_big` -> `max` | `pf_rung100_*` | 8-bar celebrations, each bigger (glock/trumpet -> full band -> timpani -> soaring trumpets -> everything) | -15.2 / -15.0 / -14.8 / -14.6 / -14.4 LUFS |

Base A and B alternate (intended: swap after two passes of the current tune; the ported director still uses the donor's
66,899 ms constant — derive it from `CUES[bed]` loop length when the runtime seam is wired), each feature has its own bed and its own entry sting
(no feature borrows another's cue). Beds ship with a 60 ms **cyclic codec-guard pre/post-roll** and loop
`[loopStartMs, loopEndMs)`: AAC reconstructs a file's first ~1024 samples badly, which would click at every loop in Safari.
One primary bed at a time; layers are phase-aligned additive stems.

### 2.1 The draws, graded before use (`measure.py draws` -> `audio/qa/music_draws_measured.json`)

| Draw | s | intro vs body dB | dropout s | fine BPM | C-pent | chug | 8-bar self-sim max | Grade |
|---|---|---|---|---|---|---|---|---|
| `pf_base92a__1` | 91.95 | **-10.5** | 89 (closing decay) | 92.000 | **0.559** | **3.99** | **0.906** | **REDRAW**: quiet intro, chug, out of key (C#/G# smear), near-copy sections 2-3 |
| `pf_base92b__1` | 91.95 | -6.9 | 89 (closing decay) | 91.996 | 0.868 | 1.25 | 0.738 | good |
| `pf_rescue100__1` | 83.96 | -5.9 | 81 (closing decay) | 100.000 | 0.656 | 0.93 | 0.634 | good (2-bar softer intro, handled) |
| `pf_inferno100__1` | 83.96 | -3.3 | 81 (closing decay) | 100.000 | **0.546** | 1.15 | 0.742 | **REDRAW**: came back in C minor/dorian, not A-minor pentatonic; interim -3 st |
| `pf_antic92__1` | 16.02 | -2.3 | 13-14 (closing decay) | 93.75 (ambiguous) | 0.821 | 0.93 | — | good (tempo unmeasurable on a roll: plan's 92 used) |
| `pf_backdraft92__1` | 48.02 | **-25.4** | 2-4 + 45-46 | 91.996 | 0.715 | 0.79 | 0.179 | **REDRAW**: 5.3 s near-silent head, only 15 bars of material; interim 12 bars |
| `pf_rung100_big__1` .. `max__1` | 24.01 | -1.9 .. +0.6 | — | 100.0 (huge 100.05) | 0.73-0.95 | 0.25-0.95 | — | good |

"Dropout" at the very end of every draw is the model's closing decay; `build_audio.material_end()` now finds it (last 250 ms
window within 15 dB of the body median) and the loop is never cut into it.

### 2.2 Build decisions per bed (`audio/tools/bed_overrides.json`, each with its measured `why`)

- `base_loop_a`: start at draw bar 1 (the draw's 2-bar intro sits 10 dB low and its closing decay starts at 88.25 s, so bar 1
  is the latest 32-bar start); the one quiet bar left is raised +5.8 dB by `bar_lift` (§ below). Interim until `pf_base92a_v2`.
- `rescue_loop`: start at draw bar 1; bar 0 of the loop lifted +2.5 dB.
- `inferno_loop`: `semis: -3` — whole-mix rubberband transposition (formants kept, length kept) from C minor/dorian onto A
  (A dorian: key-fit share 0.47 -> 0.76, C-pent 0.55 -> 0.78). +2 st (D dorian) measured 0.68 / 0.70 and moves the centre
  off A, so -3 it is. Interim until `pf_inferno100_v2`.
- `anticipation_layer`: entry at 0.778 s (first sample within 12 dB of the draw's peak after a 0.65 s pre-roll);
  `bpmOverride: 92` — a continuous roll gives the onset comb nothing to lock to (93.75 / 81.1 / 89-90 from three methods).
- `backdraft_spins_layer`: entry at 5.286 s (after a 5.2 s near-silent head; a lone crackle pop at 4.64 s is skipped) and
  **12 bars** (31.304 s) instead of 16: the draw holds 15.0 bars; 12 = three 4-bar phrases, even, so the two-bar brass stabs
  stay on the base bed's grid (the runtime phase-aligns a layer modulo its own loop). Interim until `pf_backdraft92_v2`.
- Every bed: the start is nudged by at most +-2 ms (measured nudges -1.43 .. +1.75 ms; a 16th note at 92 BPM is 163 ms) to
  the smallest raw adjacent-sample step at the seam, so the head-blend seam is continuous AND measures clean on a loud noisy
  downbeat (the Backdraft layer's shaker + tom had measured 0.243 against a body p99.9 of 0.118 before the nudge).
- `bar_lift` (new): a bar more than 4 dB under the loop's median bar level is raised toward median - 2.5 dB (max +8 dB),
  ramping up over its first half beat (the seam stays at unity gain) and down over its last beat (the next downbeat is never
  boosted). Lifted: base A bar 1 +5.8, base B bars 1-2 +2.8 / +4.3, Rescue bar 1 +2.5.

### 2.3 Beds as shipped (`audio/qa/beds_table.md`, decoded .ogg / .m4a)

| bed | grid BPM | bars | loop s | samples exact | shipped BPM ogg / m4a | I LUFS ogg | TP ogg / m4a | wrap ogg / m4a (body p99.9) | head-tail dB 250 / 1000 ms | chug | section self-sim max | C-pent | source |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| base_loop_a | 92 | 32 | 83.4783 | True | 91.95 / 91.95 | -15.5 | -1.5 / -1.1 | 0.04601 / 0.05635 (0.1221) | -3.76 / -2.95 | 4.144 | 0.864 | 0.56 | pf_base92a__1 |
| base_loop_b | 92 | 32 | 83.4783 | True | 91.95 / 91.95 | -15.5 | -2.0 / -2.0 | 0.00706 / 0.00946 (0.06097) | 7.13 / -1.49 | 1.106 | 0.742 | 0.864 | pf_base92b__1 |
| rescue_loop | 100 | 32 | 76.8 | True | 100.0 / 100.0 | -15.5 | -2.3 / -2.0 | 0.00925 / 0.01619 (0.10023) | 1.38 / 0.84 | 1.006 | 0.642 | 0.671 | pf_rescue100__1 |
| inferno_loop | 100 | 32 | 76.8 | True | 100.0 / 100.0 | -15.2 | -1.7 / -1.7 | 0.00113 / 0.014 (0.07531) | 4.53 / 0.85 | 1.485 | 0.633 | 0.775 | pf_inferno100__1 |
| anticipation_layer | 92 | 4 | 10.4348 | True | 102.55 / 102.55 | -16.0 | -2.4 / -2.4 | 0.00295 / 0.00845 (0.09136) | -1.77 / -0.66 | 0.961 | None | 0.813 | pf_antic92__1 |
| backdraft_spins_layer | 92 | 12 | 31.3044 | True | 91.95 / 91.95 | -16.0 | -1.7 / -1.6 | 0.00382 / 0.02507 (0.11592) | 5.49 / -0.07 | 0.85 | None | 0.715 | pf_backdraft92__1 |
| rung_bed_big | 100 | 8 | 19.2 | True | 100.0 / 100.0 | -15.2 | -1.8 / -1.9 | 0.00063 / 0.00232 (0.1666) | 24.95 / 6.8 | 1.088 | None | 0.822 | pf_rung100_big__1 |
| rung_bed_huge | 100 | 8 | 19.2 | True | 100.0 / 100.0 | -15.0 | -1.9 / -1.9 | 0.02344 / 0.02536 (0.0886) | 11.73 / 2.03 | 0.955 | None | 0.835 | pf_rung100_huge__1 |
| rung_bed_mega | 100 | 8 | 19.2 | True | 100.0 / 100.0 | -14.9 | -3.0 / -3.2 | 0.00041 / 0.00131 (0.0983) | 20.59 / 2.94 | 0.287 | None | 0.828 | pf_rung100_mega__1 |
| rung_bed_epic | 100 | 8 | 19.2 | True | 100.0 / 100.0 | -14.6 | -3.8 / -3.8 | 0.00204 / 0.00968 (0.06984) | -1.18 / -1.22 | 0.869 | None | 0.745 | pf_rung100_epic__1 |
| rung_bed_max | 100 | 8 | 19.2 | True | 100.0 / 100.0 | -14.5 | -1.7 / -1.9 | 0.00544 / 0.00962 (0.05288) | 25.39 / 4.15 | 0.505 | None | 0.947 | pf_rung100_max__1 |

Limiter (cyclic, ceiling -2.0 dBFS on every bed): fraction of samples under gain reduction base A 0.118, rung MAX 0.352,
rung BIG 0.150, Inferno 0.023, the rest <= 0.005 (listen for squash on rung MAX, §9). Head-tail at 50-250 ms on the rung beds
is beat phase (a downbeat hit vs the gap before the next downbeat); at 1000 ms only `rung_bed_big` (6.8 dB) crosses the
6 dB flag: its bar 8 ends in a composed two-beat rest (18.2-19.0 s at -29 .. -40 dB) that the draw itself follows with the
next downbeat — the loop reproduces the drawn phrasing, it is not a decay. Listen (§9).

## 3. SFX families (sfx bus) — `audio/tools/roster.py` (prompts) / `prompts.json`

Palettes (suffixes on every prompt): **mech** "cartoon fire-station: brass bell, chrome, rubber hose, water, wooden
ladder, leather; dry, close, no voice, no music" · **mus** firehouse brass band in C · **fire** friendly cartoon flame,
never scary · **water** hose / nozzle / spray / steam · **fx** comic cartoon · **tone** · **dog** · **amb**.

| Family | Sound |
|---|---|
| HUD | chrome toggle clicks (3 alternates), a hose-reel dial tick for bet change, a brass valve + two-note bell for ALARM BOOST on/off, a polite double door-knock for insufficient balance, a rubber stamp + bell for a buy (neutral) |
| Reels | lever pull + hose flick (spin), airy whoosh, **brass hose-reel ticking loop** while the reels travel, **wooden ladder-rung thunk** stops as a tonic ladder (§4), `reel_stop_turbo` = one merged stop |
| Alarms | a brass alarm bell's double strike over a synthesised chord that climbs **ii -> V -> V7 -> V9 -> V13** (§4); golden alarm = a gold glint layered on top (never implies a near miss) |
| Anticipation | layer + a **held riser** (snare roll, bell ringing faster, low brass climbing from G) that steps up +2 st on the second anticipating reel; **hit** = cymbal choke + bell strike (peak, unresolved); **miss** = a relaxed muted-trumpet G -> E, neutral, never a fail sound |
| Trigger | brass bell clang + trumpets/trombones rising G C E G to a big C chord — the resolution |
| Backdraft | flash-whoosh, friendly flame roar, bright brass C-chord hit; each Blaze Wild **ignition** = a small fwoomp + a tuned ping climbing C5 D5 E5 G5 A5; **multipliers** x2 / x3 / x5 = badge clank + ping C5 / E5 / G5, x10 its own bigger slam with a C6 chord |
| Symbol wins | H1 truck bell + chrome horn toot · H2 helmet thump + ringing brass shield · H3 steel tools clink · H4 extinguisher puff + valve ding · L1 nozzle squeak + spurt · L2 bucket knock + slosh · L3 ladder rungs rising · L4 rubber boot stomps · W bugle flourish C E G + badge |
| Wins | line win small / mid (glockenspiel), total small / mid / big (trumpet figure -> full band), MAX WIN (bells, full band, timpani, finale); count-up = a tuned glockenspiel blip ladder (12 steps, shorter as it rises) |
| Win rungs | brass stabs big -> max, painted sign -> golden plaque impacts, bursts water -> embers -> badges -> coins -> gold (the names `WinRungs.svelte` already plays), flare / land / out |
| Rescue / Inferno | entry flourishes (horn call / low brass + flame), hose start / spray loop / shut-off, steam hiss, a flame shrinking per level, the **two-note brass ta-da** stepping up the scale with the multiplier (8 rungs, C D E G A C' D' E'), coin shower (and a bigger one for 50-100x prizes), building cleared fanfare, the two-tone horn call passing by, the next block sliding in, +spins bell + glock run, last-spin call, totals small / mid / big (Inferno's hotter, with flame) |
| Alarm Call | brass desk bell double ring, card flip, outcome stingers (Rescue / Inferno, bigger for Inferno), **False Alarm = neutral** muted trumpet G -> E + woodblock, and **Ember's two happy barks** |
| Backdraft Spins | flame + brass C-chord start, warm resolving close |
| Scene | steel roll-up bay door slam + three hauls (the feature cover), Station 13 dusk ambience (breeze, distant city hum, a hose reel creak, a far drip, faint birds; no voices) |

No prompt names a real siren, a police car, construction, a hard hat, a lantern, a dragon, a wolf or a pig sound; the
roster refuses such words even as negatives (the SFX model keys on the noun).

## 4. Tonal integrity

- **Every ladder root is snapped to the TONIC** (the family's LUCKY bug: a root snapped to the nearest pentatonic note, A3,
  gave an A-major-pentatonic ladder with C# and F#). Reel stops C D E G A (length preserved); ignitions C5 D5 E5 G5 A5 and
  the x2/x3/x5 badges C5 / E5 / G5 as drawn character + a synthesised tuned ping (the model cannot hit a pitch); the ta-da
  ladder from three snapped brass sources (trombone / horn / trumpet) with the tonic chosen so no rung is shifted more than
  a few semitones (warned otherwise); the count-up ticker a hybrid C5 blip resampled up the pentatonic.
- **The alarm ladder is deliberately NOT pentatonic** (Rahn's unresolved progression, panel notes 04:38): alarm 1 = ii (Dm),
  2 = V (G), 3 = V7, 4 = V9, 5 = V13 with the leading tone on top; top voice A4 -> D5 -> F5 -> A5 -> B5. Chords are
  synthesised (exact harmony) under the drawn bell strike, never key-fitted. **Only `trigger_fanfare` resolves it** — its
  pickup begins on G and lands on C. The ladder is honest: alarm 3 IS the trigger; alarms 4-5 add spins (12 / 15).
- Every other clearly pitched draw is key-fitted onto C pentatonic (`keyfit.py`: 10-cent chroma, +-2 st, only clearly tonal
  cues, only clear gains); noise-like cues are left alone.

### 4.1 Ladders and key-fit as built (`audio/qa/build_report_all.json`, `cues.json` `build`)

| Ladder | Built from | Notes (as measured / synthesised) |
|---|---|---|
| Reel stops 1-5 | `reel_stop_1` = drawn thunk (HP 45 Hz) + synthesised **wood** knock (marimba bar 1 : 3.93 : 9.2, 160 ms) at **C4**, -2 dB; 2-5 pitched +2 / +4 / +7 / +9 st, length kept | **C4 D4 E4 G4 A4**. Why the wood layer: the drawn thunk held 99-100 % of its energy under 200 Hz (inharmonic partials 65 / 91 / 139 / 200 Hz) = close to silent on a phone speaker and no readable pitch; with the layer 200-500 Hz sits at -4.8 dB of the total and the stop measures -21.8 LUFS (was -34.9). `reel_stop_turbo` = C+E+A stack, 6 ms roll |
| Alarm 1-5 | 70 ms drawn bell strike (HP 700 Hz) + synthesised chime chord | Dm D4 F4 A4 · G G4 B4 D5 · G7 G4 B4 D5 F5 · V9 (no root) B4 D5 F5 A5 · V13 colour D5 F5 A5 B5 — NOT key-fitted; resolved only by `trigger_fanfare` (retuned -24 c, C-pent 0.98, G C E G pickup) |
| Blaze ignitions 1-5 | drawn fwoomp + tuned glock/chime ping, -3 dB | C5 D5 E5 G5 A5 |
| Multipliers | drawn clank + tuned ping; x10 own draw + chime chord | x2 C5 · x3 E5 · x5 G5 · x10 C6 E6 G6 + glock G6 |
| Ta-da 1-8 | three snapped brass sources: lo C5 (522 Hz, +0.04 st), mid G4 (391.6 Hz), hi C6 (1401 Hz snapped -5.05 st; verified 1046.5 Hz) | **C5 D5 E5** from lo (0 / +2 / +4 st), **G5 A5 C6 D6 E6** from hi (-5 / -3 / 0 / +2 / +4 st); max shift 5 st. (Fixed in this build: the snap's post-check re-measured a different partial of the hi source — G5, its 3rd harmonic — and the ladder treated a C source as G, which put every rung built from it a fourth off, i.e. an F in the ladder; the check now searches +-1.5 st around the expected partial.) |
| Count-up 1-12 | hybrid C5 glock/chime blip + 15 ms drawn click (HP 1 kHz, -8 dB), resampled | C5 D5 E5 G5 A5 C6 D6 E6 G6 A6 C7 D7, 250 -> 56 ms |
| Riser 2 | `antic_riser` (+2.31 st key-fit) + 2 st | stepped, same length |

Key-fit (13 cues moved, every one measured in key after): `ante_on` -0.23, `buy_confirm` -2.21, `antic_riser` +2.31,
`antic_miss` -0.26, `antic_hit` +2.24, `trigger_fanfare` -0.24, `sym_win_h1` +0.70, `rung_hit_huge` +2.0, `rescue_enter` +1.0,
`last_spin` -2.0, `alarm_outcome_rescue` +2.0, `alarm_outcome_false` -2.0 st; **`sym_win_h2` split-band** (new): its analysis
was steered by a 3.9 kHz shield ring at B7 -33 c while the body under 2.5 kHz was already in key (0.71), and a whole-cue
+1.3 st shift dropped the body to 0.24 — so only the band above 2.5 kHz (zero-phase complement split) is shifted: ring on
C8 -3 c, body unchanged 0.71. A key-fit that would make the body worse is never applied whole.

## 5. Mix

- Buses: music -14 LUFS, sfx -16 LUFS; primary beds mastered to their LUFS target at gain 1.0; every file <= -1.0 dBTP
  after its real codec (both Opus and AAC). The whole mix lands around -14 LUFS.
- SFX gains come ONLY from measurement (`mix.py`): loudest 400 ms of the shipped file vs the family target — ambience -40,
  reel loop -30, UI -27, stops -22, landings -20, events at the bed (-18 .. -20), rewards above it and **strictly rising**:
  alarm ladder -20 -> -18 (0.5 dB steps) · riser -18 < riser 2 -17.5 · multipliers -18 / -17.5 / -17 / -16 · ta-da ladder
  -19 -> -15.5 · line -19 < -18 · totals -18 < -16.5 < -15 (Inferno +0.5) · rung hits -16 -> -14 · signs, bursts rising ·
  entries Backdraft Spins -15.5 < Rescue -15 < Inferno -14.5 · Alarm Call false -20 < rescue -15.5 < inferno -14.5 ·
  total big -15 < rung max -14 < **MAX WIN -13.5**. Neutral cues (miss, false alarm, dead-spin settle) sit under the bed.
- **Measured (`audio/qa/mix_ladder.json`)**: 223 cues levelled, 0 unmatched, 0 clamped off target, **every chain strictly
  rising**: alarm -20 / -19.5 / -19 / -18.5 / -18 · riser -18 < -17.5 · multipliers -18 / -17.5 / -17 / -16 · line -19 < -18 ·
  totals -18 / -16.5 / -15 · Rescue totals -18 / -16.5 / -15 · Inferno totals -17.5 / -16 / -14.5 · rung hits -16 .. -14 ·
  signs -18.5 .. -16.5 · bursts -19 / -18.5 / -18 / -17.5 / -17 · ta-da -19 .. -15.5 · prizes -18 < -16.5 · entries -15.5 /
  -15 / -14.5 · Alarm Call -20 / -15.5 / -14.5 · total big -15 < rung max -14 < MAX WIN -13.5 · rung beds -15.2 / -15.0 /
  -14.9 / -14.6 / -14.5 LUFS. Alternates level-matched (spread 0.0 dB: clicks, hauls, stops, ignitions).
- **Re-master law (`mix.py`)**: a cue needing > +6 dB of gain is re-mastered from the BUILD's master (kept in
  `audio/masters/_src/_premix/` with the sha of what mix.py wrote, so re-running mix.py never stacks a second raise), with a
  4x-oversampled tanh soft clip at -3 dBFS first when its crest factor exceeds 16 dB (crackle / pops: a look-ahead limiter
  pumps on every pop), then the -1.5 dBFS limiter, up to 4 passes. 16 cues (5 base, 11 turbo): `burst_embers` +16.2 dB
  (crest 27.8 dB: the draw is sparse full-scale pops at -25 dB RMS), `rung_hit_big_turbo` +12.7, `sign_impact_huge` +6.4,
  `alert_insufficient` +6.0, `rung_hit_big` +4.3, `sym_win_l3` +3.4, turbo variants +3.1 .. +15.0. Listen for grit (§9).
- **No celebration at or below the stake** (bet x mode cost: 1x base, 1.5x ALARM BOOST, the buy price for a bought
  feature): a neutral cue or nothing. `win_max` for the capped round only.

## 6. Ducking, transitions, turbo

Duck the music 3-6 dB (attack 40-80 ms, release 250-500 ms) under every win cue, entry flourish, building cleared, big
prize and total; never on clicks, stops or landings (per-cue `duck` hints in `audio/cues.json`). Base -> bonus: alarms ->
fanfare -> bay-door shutter -> entry flourish -> bonus bed (600 ms equal-power crossfade), ambience off; bonus -> base: total
or rungs -> shutter -> the other base tune (900 ms), ambience back. Win rungs replace the scene bed (one bed at a time).
Turbo: `reel_stop_turbo` merges the stops, `*_turbo` variants (time-scaled 0.5-0.55, pitch kept) for every one-shot over
0.7 s except HUD feedback; the soundtrack is never sped up. Every sound cue also has a visual cue (muted phones).

## 7. Provider / provenance

ElevenLabs, lossless `pcm_44100`: SFX `eleven_text_to_sound_v2` (`prompt_influence` 0.6-0.75, `loop: true` for loops),
music `music_v1` composition plans. `audio/tools/gen_audio.mjs` ledgers EVERY call (draw, failure, quota read) to
`audio/source-record.json` + `audio/PROVENANCE.jsonl`: endpoint, model, prompt / plan, params, prompt sha256, byte sha256,
character-cost header, cost estimate, output path, status. Key from the environment only. No redraw without a named,
measured defect (`--force --reason`), one redraw per defect, the better draw by measurement ships (`bed_overrides.json`).
Quota guard: stop at 25,000 characters remaining. **Spent**: the whole pass (107 draws, 0 failures) moved the account
194,478 -> 185,542 characters (8,936; SFX headers 1,566); the ledger holds 117 rows (96 SFX ok, 11 music ok, 10 quota reads).
The build, mix, measure and montage are offline (no call).

## 8. Deferred

- **Voiceover** (theme §6: Chief Hamm "Move out!", "Nice save!"): needs its own toggle in the HUD and a TTS / voice-design
  pass; not in this roster.
- Symbol-landing sounds per reel (the donor's `sym_land_*`) are not drawn: the tonic stop ladder carries the landing, and a
  second hit per reel adds repetition. Revisit after listening.

## 9. Listening pass — NOT RUN

Everything is built and machine-measured, but **nobody has listened yet**; no seat grants the audio rung without it. Render
`python3 audio/tools/montage.py` -> `audio/qa/review_montage.mp3` (75 s, 93 distinct cues at their registered gains, -16.5 LUFS,
-1.5 dBTP; cue sheet `review_montage.json`) and listen on headphones AND a phone speaker (mono). Must cover:
- the synthesised hook over each bed (does the glock / vibes / bugle / bell sit, or poke out?); the synth-bugle colour
  (cheesy in a good way, or cheap?); base A vs B (two tunes? — A is an interim draw with a chug, §10);
- **the Inferno bed after its -3 st rubberband transposition** (phasiness / smeared transients?);
- the lifted quiet bars (base A bar 1 +5.8 dB, base B bars 1-2, Rescue bar 1): natural, or a noisy lift?;
- every loop point, especially `rung_bed_big` (composed two-beat rest before its downbeat) and the 12-bar Backdraft layer;
- rung MAX (35 % of samples in limiting) and the soft-clipped re-masters (`burst_embers` +16 dB, `rung_hit_big(_turbo)`,
  `sign_impact_huge`, `alert_insufficient`): squash or grit?;
- the reel-stop ladder (thunk + tuned wood knock C4 D4 E4 G4 A4): pleasant x5 per spin, audible on the phone?;
- the alarm ladder climbing into the fanfare (does the resolution land?); the riser step-up and the neutral miss;
- the ta-da ladder (formant shift on the -5 / -3 st rungs from the hi source?); ignition and multiplier pings (too tinkly
  when five fire at once?); `sym_win_h2` split-band ring; `rung_hit_big` / `rung_hit_max` against the rung beds (their pitch
  content is not C pentatonic, 0.52 / 0.58);
- the two-tone horn call (musical, not a real siren?); Ember's bark (cute after 50 false alarms?); turbo (time-scaled)
  fanfares for WSOLA smear; `sym_win_l4` on a phone (all of its energy is under 200 Hz); fatigue over a 30-minute session.

## 10. Redraws requested (measured defects; the coordinator issues them — this lane made no paid call)

Music redraws are NEW plans (`<plan>_v2`, `redrawOf` + `defect` in `audio/tools/plans.json`, preserved by `roster.py`, never
swept by `--all`); each changes only the plan text that the defect names. When a v2 draw exists: `measure.py draws`, then point
`bed_overrides.json` at `<plan>_v2__1` (drop the interim keys) only if it measures better, and rebuild (§12).

| Cue | Defect (measured) | Interim shipping now | ~chars |
|---|---|---|---|
| `base_loop_a` | chug 3.99 raw / 4.14 shipped; C-pent 0.559 (C#/G#); sections 2-3 r 0.906; intro -10.5 dB | draw bar 1 on, bar 1 lifted; **fails measure** (chug) | 1,265 |
| `inferno_loop` | C minor/dorian, C-pent 0.546 | -3 st rubberband -> A (share 0.78) | 1,155 |
| `backdraft_spins_layer` | 5.3 s near-silent head, 15.0 bars of material | 12-bar layer from the entry | 660 |
| `rung_hit_big` | "C major brass stab" measures C-pent 0.525, top A G# A# E G, tonality 0.53; pickup refused; +4.3 dB soft-clip re-master | as drawn | 13 |
| `sym_win_l4` | 99.5 % of energy under 200 Hz (200-500 Hz -26 dB, > 500 Hz < -39 dB): inaudible on phones | as drawn | 11 |

Commands (exact) are in `audio/README.md` §Redraws. Estimated total ~3,100 characters against 185,542 remaining.

## 11. Acceptance as measured (`python3 audio/tools/measure.py` -> `audio/qa/measure_all.json`, 2026-09-25)

| Check | Result |
|---|---|
| ids x codecs present | 232 x 2 = 464 / 464; static == runtime sha256 for all 464 |
| True peak, decoded Opus AND AAC | max -1.0 dBTP (3 files exactly at -1.0), 0 over |
| Loops seam-clean (wrap <= body p99.9, both codecs) | 14 / 14 (11 beds, reel spin, hose, ambience) |
| Whole-bar grid exact (samples) | 11 / 11 beds (92 BPM x 32 = 3,681,392 samples; 100 x 32 = 3,386,880; 92 x 4 = 460,174; 92 x 12 = 1,380,522; 100 x 8 = 846,720) |
| Codec-guard pads cyclic | 11 / 11 |
| Chug (8th/quarter, 300-1200 Hz) <= 3 | 10 / 11 — **`base_loop_a` 4.14** (redraw) |
| 8-bar section self-similarity < 0.90 | 4 / 4 32-bar beds (max 0.864 base A, 0.742 B, 0.642 Rescue, 0.633 Inferno) |
| Bed LUFS vs target (+-1) | 11 / 11: base A -15.5, B -15.5, Rescue -15.5, Inferno -15.2, layers -16.0 / -16.0 |
| Rung beds strictly rising | -15.2 < -15.0 < -14.9 < -14.6 < -14.5 LUFS |
| Tail dip > 6 dB at 1000 ms (flag, not a gate) | `rung_bed_big` 6.8 (composed rest, §2.3) |
| Reward chains strictly rising (`mix.py`) | 16 / 16 |
| **PASS** | **false** — only `base_loop_a` chug |

## 12. Rebuild order (idempotent; every step re-runnable)

```bash
python3 audio/tools/measure.py draws                   # grade raw music draws -> audio/qa/music_draws_measured.json
python3 audio/tools/build_audio.py all --purge-donor   # music -> sfx -> derived -> shots -> turbo (~3.5 min)
python3 audio/tools/mix.py                             # family gain ladder; re-masters from _premix, never stacks
node audio/tools/gen_manifest.mjs                      # -> apps/piggy_firefighters/src/game/audio/cueManifest.ts
python3 audio/tools/measure.py                         # acceptance, both codecs
python3 audio/tools/audio_map.py                       # -> docs/AUDIO_MAP.md
python3 audio/tools/montage.py                         # -> audio/qa/review_montage.mp3 (listening aid)
```
A partial rebuild (`build_audio.py music --only <bed>` etc.) must still be followed by mix -> manifest -> measure -> map.
`shots` always mixes into the pre-pickup copy (`masters/_src/_prepickup`), `mix.py` re-masters from `masters/_src/_premix`,
and the registry is written atomically (a failed dump can no longer truncate `cues.json`).
