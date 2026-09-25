# PIGGY FIREFIGHTERS — Sound Bible

Owner: AUDIO lane. Status: **v5, 2026-09-25: BUILT, r2 build fixes applied, r3 redraws folded in by measurement, r4 `rung_hit_big` hybrid + bit-identical re-runs** (this lane
made no paid call; the coordinator drew the 5 redraws, ledgered). 107 + 5 ElevenLabs draws (ledger `audio/source-record.json`)
-> 232 cue ids x 2 codecs = 464 shipped files in `apps/piggy_firefighters/static/assets/audio/piggy_firefighters/` (30 MB),
`cueManifest.ts` regenerated (232 cues). `measure.py` **PASS: true, 16 / 16 gates** (§11): `base_loop_a` ships its redraw
(chug 3.77 -> 1.35); the Inferno and Backdraft redraws measured worse and were rejected; `rung_hit_big` ships its redraw,
since r4 as a hybrid in C (drawn stab + synthesised brass / chime C-E-G chord: C-pent 0.979, pickup accepted; §15); the
`sym_win_l4` redraw was worse, v1 restored and voiced for phones offline (§10, §14). `mix.py` re-runs are sha256-identical (§15).
**Human listening NOT RUN (§9).** Theme: `docs/PIGGY_FIREFIGHTERS_THEME.md` §6. Rules: `docs/AUDIO_DESIGN_NOTES.md`, `CLAUDE.md`.
Per-cue map (contract §8 event -> cues; moment -> cue -> file -> seam -> owner): `docs/AUDIO_MAP.md` (generated). Pipeline:
`audio/README.md`. Every sound is drawn fresh for this title (ElevenLabs) or synthesised by our own tools; no donor sound
file is used (the donor's untracked `static/assets/audio/lucky/` — 388 files — was purged by `build_audio.py --purge-donor`
before the first write).

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
  mixed at the RMS of the bed bars it lands on; since r2 the hook layer is widened by LEVEL only (identical signal, L x 1.08,
  R x 0.92: mono-safe, §13) and every synthesised note ends in a release (no click at note ends). The pickup (G5 C6 E6 G6
  glock eighths, 132 BPM, -5 dB) is now used WHOLE and rings out (1.18 s + 0.3 s tail): it landed on **15 of 17** fanfares:
  `trigger_fanfare` (C-pent 0.98), both entries, `backdraft_spins_start`, `building_cleared`, the three big totals, rung hits
  BIG (r4 hybrid, C-pent 0.979) / HUGE / MEGA / EPIC, `win_max`, both good Alarm Call outcomes (`rung_hit_big` +200 ms,
  `rung_hit_huge` +158 ms and `inferno_total_big` +71 ms of silence appended so the pickup rings out). Refused: `rung_hit_max` (0.58) — content not in C
  pentatonic — and `spins_added` (1.0 s: too short for the whole pickup; r1 sliced the pickup mid-note there; the cue already
  carries its own glock run C E G C).

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
| `base_loop_a` | `pf_base92a` (ships `pf_base92a_v2__1`, r3) | bright oom-pah march: muted trumpet + glockenspiel hook, clarinet answer, trumpets return, French horn turnaround | -15.5 LUFS |
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
| `pf_base92a_v2__1` (r3) | 91.95 | **-13.2** | — | 92.000 | 0.732 | 1.52 | 0.756 | **SHIPS** (base A): one defect, a quiet 1-bar intro, skipped (start bar 1) |
| `pf_base92b__1` | 91.95 | -6.9 | 89 (closing decay) | 91.996 | 0.868 | 1.25 | 0.738 | good |
| `pf_rescue100__1` | 83.96 | -5.9 | 81 (closing decay) | 100.000 | 0.656 | 0.93 | 0.634 | good (2-bar softer intro, handled) |
| `pf_inferno100__1` | 83.96 | -3.3 | 81 (closing decay) | 100.000 | **0.546** | 1.15 | 0.742 | out of key (C minor/dorian): **ships at -3 st** (beat its redraw on the built loop, §2.2) |
| `pf_inferno100_v2__1` (r3) | 83.96 | -3.0 | 78-81 (closing decay from 77.5 s) | 100.000 | **0.598** | 0.46 | 0.775 | A-centred but B-heavy (A .22 B .17); **rejected by measurement** on the built loop (§2.2) |
| `pf_antic92__1` | 16.02 | -2.3 | 13-14 (closing decay) | 93.75 (ambiguous) | 0.821 | 0.93 | — | good (tempo unmeasurable on a roll: plan's 92 used) |
| `pf_backdraft92__1` | 48.02 | **-25.4** | 2-4 + 45-46 | 91.996 | 0.715 | 0.79 | 0.179 | 5.3 s near-silent head, only 15 bars of material: **ships 12 bars** |
| `pf_backdraft92_v2__1` (r3) | 48.02 | **-25.2** | 46 | 91.996 | **0.547** | **4.06** | 0.431 | **rejected by measurement** (worse: chug, out of key, same silent head); not built |
| `pf_rung100_big__1` .. `max__1` | 24.01 | -1.9 .. +0.6 | — | 100.0 (huge 100.05) | 0.73-0.95 | 0.25-0.95 | — | good |

"Dropout" at the very end of every draw is the model's closing decay; `build_audio.material_end()` now finds it (last 250 ms
window within 15 dB of the body median) and the loop is never cut into it.

### 2.2 Build decisions per bed (`audio/tools/bed_overrides.json`, each with its measured `why`)

- `base_loop_a` (r3): **`pf_base92a_v2__1` from draw bar 1.** Built from bar 0 / 1 / 2 in a scratch root with the shipping
  `bed()`: bar 0 needed `bar_lift` +5.6 dB on the intro bar and still left the loop head 4.7 dB under its tail at 1000 ms
  (every pass would restart on the intro), grid / sliding self-sim 0.757 / 0.840; **bar 1 ships**: no lift needed (quietest
  bar 2.0 dB under the median), head-tail 1.1 / 0.3 / -1.1 dB at 50 / 250 / 1000 ms, self-sim 0.834 / 0.838, chug 1.35,
  C-pent 0.756, limiter 0.25 %; bar 2 self-sim 0.859 / 0.871. The loop ends at 86.1 s, before the draw's decay (90.5 s).
  (r1/r2 shipped `pf_base92a__1` from bar 1 + a +5.8 dB lift: chug 3.77, C-pent 0.59, limiter 37.6 %.)
- `rescue_loop`: start at draw bar 1; bar 0 of the loop lifted +2.5 dB.
- `inferno_loop`: `semis: -3` — whole-mix rubberband transposition (formants kept, length kept) from C minor/dorian onto A
  (A dorian: key-fit share 0.47 -> 0.76, C-pent 0.55 -> 0.78). +2 st (D dorian) measured 0.68 / 0.70 and moves the centre
  off A, so -3 it is. **r3: kept over `pf_inferno100_v2__1` by measurement** — three candidates built with the shipping
  `bed()`, v1 -3 st / v2 raw / v2 -2 st (the best key-fit within +-2 st; every other rotation moves the centre off A):
  C/A-minor-pent 0.780 / 0.634 / 0.704, chug 1.55 / 0.97 / 0.95 (all << 3), grid self-sim 0.650 / 0.689 / 0.681, sliding
  0.652 / 0.765 / 0.697, limiter load 2.94 / 0.0 / 0.0 %, head-tail at 250 ms 4.4 / 8.2 / 8.6 dB (v2's material ends at
  77.5 s, 0.7 s after the 32-bar loop, so its closing decay sits at the seam). v1 wins key, both self-similarities and the
  seam; v2 wins only chug (a defect in neither) and limiter load.
- `anticipation_layer`: entry at 0.778 s (first sample within 12 dB of the draw's peak after a 0.65 s pre-roll);
  `bpmOverride: 92` — a continuous roll gives the onset comb nothing to lock to (93.75 / 81.1 / 89-90 from three methods).
- `backdraft_spins_layer`: entry at 5.286 s (after a 5.2 s near-silent head; a lone crackle pop at 4.64 s is skipped) and
  **12 bars** (31.304 s) instead of 16: the draw holds 15.0 bars; 12 = three 4-bar phrases, even, so the two-bar brass stabs
  stay on the base bed's grid (the runtime phase-aligns a layer modulo its own loop). **r3: `pf_backdraft92_v2__1` rejected
  by measurement** (graded worse: chug 4.06, C-pent 0.547, the same -25 dB head), so this stays; a 16-bar layer is open.
- Every bed: the start is nudged by at most +-2 ms (measured nudges -1.43 .. +1.75 ms; a 16th note at 92 BPM is 163 ms) to
  the smallest raw adjacent-sample step at the seam, so the head-blend seam is continuous AND measures clean on a loud noisy
  downbeat (the Backdraft layer's shaker + tom had measured 0.243 against a body p99.9 of 0.118 before the nudge).
- `rung_bed_big`, `rung_bed_mega` (r2, `tailFill`): the loop's last half-bar sat in the draw's 2-bar phrase-end breath (big:
  last beat -17.9 dB under the median beat, head-tail +25.0 / 6.8 dB at 250 / 1000 ms; mega: last 0.4 s at -14 .. -21 dB,
  +20.6 dB at 250 ms), repeating every 19.2 s under the whole count-up. The end of bar 4 (the literal same phrase position)
  carries the same breath in both draws (a fill from it measured -15.8 -> -15.8 dB on mega), so beats 31-32 are filled from
  the end of bar 7 (beats 27-28, which lead into a downbeat without a breath) through a 30 ms splice and a head blend re-made
  from the fill's own continuation (seam continuous, grid exact). Now: last 400 ms -3.0 / -1.6 dB re the median, head-tail
  10.7 / 4.5 dB (big) and 6.4 / 2.4 dB (mega) at 250 / 1000 ms. Bar 6 keeps its breath (the phrasing inside the loop).
- Every draw (beds and SFX, r2): a zero-phase 20 Hz high-pass before any cut (draw DC offsets up to 0.017; Opus's own DC
  reject turned a faded-to-zero `line_win_small` into a slow -48 dBFS step tail).
- `bar_lift` (new): a bar more than 4 dB under the loop's median bar level is raised toward median - 2.5 dB (max +8 dB),
  ramping up over its first half beat (the seam stays at unity gain) and down over its last beat (the next downbeat is never
  boosted). Lifted: base B bars 1-2 +2.8 / +4.3, Rescue bar 1 +2.5 (r3: base A needs none from bar 1 of its redraw).

### 2.3 Beds as shipped (`audio/qa/beds_table.md`, decoded .ogg / .m4a)

| bed | grid BPM | bars | loop s | samples exact | shipped BPM ogg / m4a | I LUFS ogg | TP ogg / m4a | wrap ogg / m4a (body p99.9) | head-tail dB 250 / 1000 ms | chug | section self-sim max | C-pent | source |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| base_loop_a | 92 | 32 | 83.4783 | True | 91.95 / 91.95 | -15.5 | -2.05 / -1.72 | 0.03389 / 0.03748 (0.06948) | 0.33 / -1.11 | 1.347 | 0.834 | 0.756 | pf_base92a_v2__1 |
| base_loop_b | 92 | 32 | 83.4783 | True | 91.95 / 91.95 | -15.5 | -2.05 / -2.0 | 0.00501 / 0.01041 (0.0681) | 7.19 / -1.45 | 1.074 | 0.741 | 0.874 | pf_base92b__1 |
| rescue_loop | 100 | 32 | 76.8 | True | 100.0 / 100.0 | -15.5 | -2.16 / -2.2 | 0.00592 / 0.01953 (0.14817) | 1.38 / 0.84 | 1.077 | 0.663 | 0.688 | pf_rescue100__1 |
| inferno_loop | 100 | 32 | 76.8 | True | 100.0 / 100.0 | -15.2 | -1.9 / -1.76 | 0.00918 / 0.01059 (0.10014) | 4.41 / 0.78 | 1.547 | 0.65 | 0.78 | pf_inferno100__1 |
| anticipation_layer | 92 | 4 | 10.4348 | True | 102.55 / 102.55 | -16.0 | -2.55 / -2.49 | 0.00294 / 0.01262 (0.09136) | -1.77 / -0.66 | 0.961 | None | 0.813 | pf_antic92__1 |
| backdraft_spins_layer | 92 | 12 | 31.3044 | True | 91.95 / 91.95 | -16.0 | -1.61 / -1.73 | 0.00289 / 0.02165 (0.11597) | 5.45 / -0.09 | 0.85 | None | 0.715 | pf_backdraft92__1 |
| rung_bed_big | 100 | 8 | 19.2 | True | 100.0 / 100.0 | -15.2 | -1.75 / -1.78 | 0.02036 / 0.0636 (0.16722) | 10.7 / 4.45 | 1.072 | None | 0.846 | pf_rung100_big__1 |
| rung_bed_huge | 100 | 8 | 19.2 | True | 100.0 / 100.0 | -15.0 | -1.87 / -1.87 | 0.00684 / 0.02004 (0.14187) | 11.24 / 1.69 | 0.965 | None | 0.848 | pf_rung100_huge__1 |
| rung_bed_mega | 100 | 8 | 19.2 | True | 100.0 / 100.0 | -14.8 | -2.93 / -2.9 | 0.00229 / 0.00389 (0.15869) | 6.42 / 2.39 | 0.32 | None | 0.845 | pf_rung100_mega__1 |
| rung_bed_epic | 100 | 8 | 19.2 | True | 100.0 / 100.0 | -14.6 | -4.3 / -4.42 | 0.01355 / 0.00806 (0.08817) | -0.69 / -0.81 | 0.887 | None | 0.784 | pf_rung100_epic__1 |
| rung_bed_max | 100 | 8 | 19.2 | True | 100.0 / 100.0 | -14.4 | -1.74 / -1.38 | 0.00172 / 0.01766 (0.08901) | 25.59 / 4.22 | 0.527 | None | 0.954 | pf_rung100_max__1 |

Limiter (cyclic, ceiling -2.0 dBFS on every bed): fraction of samples under gain reduction rung MAX 0.299, rung BIG 0.207,
Inferno 0.029, base A 0.0025 (r3 redraw; the r2 interim draw ran 0.376), the rest <= 0.016 (listen for squash on rung MAX, §9). Head-tail at 50-250 ms on the rung beds is beat phase (a
downbeat hit vs the gap before the next downbeat; rung MAX's +25.6 dB at 250 ms is its stab-and-gap rhythm); at 1000 ms every
bed is <= 6 dB (gate, §11). Sliding 8-bar self-similarity (r2, §11): base A 0.84 band / 0.77 chroma (r3; r2 interim 0.81 / 0.88), base B 0.74 / 0.56,
Rescue **0.86 / 0.88 at a 12-bar lag** (bars 9-16 vs 21-28: under the 0.90 bar, but a real repeat — listen, §9), Inferno
0.65 / 0.58.

## 3. SFX families (sfx bus) — `audio/tools/roster.py` (prompts) / `prompts.json`

Palettes (suffixes on every prompt): **mech** "cartoon fire-station: brass bell, chrome, rubber hose, water, wooden
ladder, leather; dry, close, no voice, no music" · **mus** firehouse brass band in C · **fire** friendly cartoon flame,
never scary · **water** hose / nozzle / spray / steam · **fx** comic cartoon · **tone** · **dog** · **amb**.

| Family | Sound |
|---|---|
| HUD | chrome toggle clicks (3 alternates), a hose-reel dial tick for bet change, a brass valve + two-note bell for ALARM BOOST on/off, a polite double door-knock for insufficient balance, a rubber stamp + bell for a buy (neutral) |
| Reels | lever pull + hose flick (spin), airy whoosh, **brass hose-reel ticking loop** while the reels travel, **wooden ladder-rung thunk + tuned wood knock C5 D5 E5 G5 A5** stops as a tonic ladder (§4), `reel_stop_turbo` = one merged stop |
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
  gave an A-major-pentatonic ladder with C# and F#). Reel stops C D E G A (drawn thunk pitched with the ladder + a tuned wood knock C5 D5 E5 G5 A5 rendered per stop); ignitions C5 D5 E5 G5 A5 and
  the x2/x3/x5 badges C5 / E5 / G5 as drawn character + a synthesised tuned ping (the model cannot hit a pitch); the ta-da
  ladder C4 D4 E4 G4 A4 C5 D5 E5 from brass sources labelled by their FUNDAMENTAL (subharmonic summation, `kit.shs_f0`: r1
  labelled two of them by their loudest partial and the ladder fell a minor sixth at rung 3 -> 4), each cleaned to its own
  harmonic series (a rung is one note) and shifted with the formant-preserving rubberband transposition; the count-up ticker a hybrid C5 blip resampled up the pentatonic.
- **The alarm ladder is deliberately NOT pentatonic** (Rahn's unresolved progression, panel notes 04:38): alarm 1 = ii (Dm),
  2 = V (G), 3 = V7, 4 = V9, 5 = V13 with the leading tone on top; top voice A4 -> D5 -> F5 -> A5 -> B5, weighted +6 dB over the inner
  voices (r2) so it leads on the mono sum (the loudest partial, or 1.1 dB under it on alarm 3). Chords are
  synthesised (exact harmony) under the drawn bell strike, never key-fitted. **Only `trigger_fanfare` resolves it** — its
  pickup begins on G and lands on C. The ladder is honest: alarm 3 IS the trigger; alarms 4-5 add spins (12 / 15).
- Every other clearly pitched draw is key-fitted onto C pentatonic (`keyfit.py`: 10-cent chroma, +-2 st, only clearly tonal
  cues, only clear gains); noise-like cues are left alone.

### 4.1 Ladders and key-fit as built (`audio/qa/build_report_all.json`, `cues.json` `build`)

| Ladder | Built from | Notes (as measured / synthesised) |
|---|---|---|
| Reel stops 1-5 | drawn thunk (tonic-snapped -1.15 st, HP 45 Hz; `masters/_src/reel_stop_thunk`) pitched 0 / +2 / +4 / +7 / +9 st (length kept) as the low body + a synthesised **wood** knock (marimba bar 1 : 3.93 : 9.2) rendered at each stop's own note **C5 D5 E5 G5 A5**, its level solved per stop (+7.0 / +5.5 / +6.0 / +5.0 / +4.5 dB over the thunk) until the 400 Hz phone proxy sits within 1.5 dB of the stereo level; rings out to 0.6 s | r1 voiced the knock at C4-A4 (262-440 Hz), under a phone speaker's band: through the proxy stops 1-2 sat UNDER the running `reel_spin_loop` and the ladder rose 12 dB (-40.3 .. -28.2 dBFS effective). Now loudest partial C5 D5 E5 G5 A5 on the mono sum, centroid 460 / 485 / 559 / 651 / 697 Hz; effective phone level -23.4 / -23.5 / -23.4 / -23.4 / -23.5 dBFS = `reel_spin_loop` (-30.0) + 6.5 dB, spread 0.09 dB. `reel_stop_turbo` = stops 1 + 3 + 5 stacked, 6 ms roll |
| Alarm 1-5 | 70 ms drawn bell strike (HP 700 Hz) + synthesised chime chord, top voice +6 dB, rendered 1.6 s with a natural decay and rung out (< -50 dB re peak, cos^2 60 ms; 1.54 s) | Dm D4 F4 A4 · G G4 B4 D5 · G7 G4 B4 D5 F5 · V9 (no root) B4 D5 F5 A5 · V13 colour D5 F5 A5 B5 — NOT key-fitted; resolved only by `trigger_fanfare` (retuned -24 c, C-pent 0.98, G C E G pickup). Top voice on the mono sum: A4 0.0 / D5 0.0 / F5 -1.1 / A5 0.0 / B5 0.0 dB re the loudest partial (r1: alarm 3's F5 -11 dB) |
| Blaze ignitions 1-5 | drawn fwoomp + tuned glock/chime ping, -3 dB, rendered 1.6 s (damped, tau ~0.3 s) and rung out | C5 D5 E5 G5 A5; 1.34-1.35 s (r1: 0.62 s ending on a hard cut, ping at -25 dB) |
| Multipliers | drawn clank + tuned ping, rung out; x10 own draw + chime chord | x2 C5 · x3 E5 · x5 G5 (1.6 s; r1 0.95 s into a 20 ms fade at -18 dB) · x10 C6 E6 G6 + glock G6 (1.52 s) |
| Rung hit BIG (r4) | the x10 recipe: drawn stab + snare, split at 2.5 kHz — under it snapped +2.26 st to C4 by its dominant partial (229.6 Hz) and cleaned to C4's harmonic series, above it as drawn — at -3 dB, + brass (bugle) C4 E4 G4 held 0.32 s + chime C5 E5 G5 + glock G5, rolled up 30 ms per voice, top voice +4 dB, peak = the drawn peak, rung out 1.30 s | C-pent 0.979 (body alone 0.664; r3 key-fit -1 st 0.525), SHS C4, tonality 0.989; pickup G5 C6 E6 G6 accepted (file 1.50 s) into `rung_bed_big` |
| Ta-da 1-8 | three brass sources labelled by SHS fundamental: lo **C4** (261.3 Hz), mid **G4** (391.6 Hz), hi **C4** (drawn 349.6 Hz, snapped -5.02 st); each cleaned to its own harmonic series (`kit.harmonic_only`, chord tones -18 dB: mid is a G7sus4 stab whose F / C would become Bb / F at rung 6, C-pent 0.53 -> 0.97) | **C4 D4 E4** from lo (0 / +2 / +4 st), **G4 A4** from mid (0 / +2), **C5 D5 E5** from mid (+5 / +7 / +9), rubberband formant-preserving; shipped SHS 59.99 / 61.99 / 63.99 / 66.99 / 68.98 / 71.95 / 73.95 / 75.98 (gate: strictly rising). hi is retired (same register as lo; `roster.RETIRED_SOURCES`). r1 labelled lo C5 / hi C6 by their loudest partials and built rungs 4-8 from hi: perceived C4 D4 E4 G3 A3 C4 D4 E4 |
| Count-up 1-12 | hybrid C5 glock/chime blip + 15 ms drawn click (HP 1 kHz, -8 dB), resampled; each tick ends in a release over its last 45 % | C5 D5 E5 G5 A5 C6 D6 E6 G6 A6 C7 D7, 250 -> 56 ms |
| Riser 2 | `antic_riser` (+2.31 st key-fit) + 2 st | stepped, same length |

Key-fit (12 cues moved, all measured in key after — r3's 13th, `rung_hit_big` -1.0 st (a Bb stab, C-pent 0.525), is the r4 hybrid above instead; r1's `alarm_outcome_false` -2.0 st is gone: its drawn channels
were anti-phase, r2 ships the stronger channel as mono and that measures in key): `ante_on` -0.23, `buy_confirm` -2.21, `antic_riser` +2.31,
`antic_miss` -0.26, `antic_hit` +2.24, `trigger_fanfare` -0.24, `sym_win_h1` +0.70, `rung_hit_huge` +2.0, `rescue_enter` +1.0,
`last_spin` -2.0, `alarm_outcome_rescue` +2.0 st; **`sym_win_h2` split-band** (new): its analysis
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
- **Three listening conditions (r2).** Every cue is measured as its loudest 400 ms three ways (`kit.levels`): **st** the
  per-channel stereo power (headphones; the family targets above are set on it), **mono** the (L+R)/2 sum (a phone speaker,
  a mono Bluetooth box) and **phone** that sum through a 4th-order 400 Hz high-pass (a phone speaker's band). r1's claim
  "every chain strictly rising (16/16)" held **only on headphones**: measured on the r1 files at their r1 gains, 10 of 16
  chains fell somewhere in mono or on the phone proxy (alarm ladder mono -21.0 / -21.3 / -20.8 / -21.6 / -21.6; rung hits
  -16.0 / -16.7 / -17.6 / -18.0 / -14.9; totals -18.1 / -17.1 / -17.7; total big -17.7 > rung max -14.9 > MAX WIN -17.0;
  bursts water -19.0 > embers -20.8; multipliers -19.4 / -19.5 / -19.7 / -18.5). The causes were build-side: partly
  anti-phase draws and a 0.4 ms delay on every synthesised layer (§13). `mix.py` now solves ONE gain per cue so that every
  chain rises by >= 0.25 dB on **st AND mono AND phone** (a joint linear programme over all chains: minimise 10 x the largest
  deviation from the family target + the sum of deviations, within the [0.12, 2.0] clamp); `_turbo` variants follow their
  parent and their own 15 chains are solved the same way.
- **Measured (`audio/qa/mix_ladder.json`, effective = file x gain, dBFS)**: 223 cues levelled, 0 unmatched, 0 clamped off
  target, **16 / 16 chains + 15 / 15 turbo chains strictly rising on all three conditions**. st / mono / phone:
  alarm -20.0 .. -18.0 (0.5 dB steps) / -20.0 .. -18.0 / -21.6 -19.9 -19.6 -18.6 -18.0 · riser -18.0 < -17.5 (mono -18.3 <
  -17.8, phone -23.3 < -22.6) · multipliers -18.0 -17.5 -17.0 -15.6 / -18.0 -17.5 -17.0 -16.4 / -18.3 -17.6 -17.0 -16.8 ·
  line -19 < -18 · totals -18.0 -16.5 -15.0 / -18.1 -17.1 -15.7 / -18.8 -17.3 -16.4 · Rescue totals -18.9 -16.5 -14.5 /
  -20.1 -16.6 -16.3 / -20.7 -20.5 -17.4 · Inferno totals -17.5 -16.0 -14.5 / -18.6 -17.4 -15.3 / -29.8 -17.6 -16.7 · rung hits
  -17.2 -15.9 -15.0 -14.5 -11.8 / -17.2 -16.9 -15.6 -15.3 -12.8 / -17.9 -17.0 -16.8 -15.7 -15.4 (r4 `rung_hit_big` hybrid; r3 phone -21.6) · signs -21.1 -20.2 -16.3 -14.7
  -14.5 / -21.1 -20.8 -16.6 -14.7 -14.5 / -21.5 -21.2 -20.9 -20.7 -18.1 · bursts -20.8 -18.3 -18.0 -17.5 -17.0 (mono / phone
  the same order) · ta-da -19.0 .. -15.5 (0.5 dB steps on all three) · prizes -18.0 < -16.5 · entries -15.5 -15.3 -13.4 /
  -17.3 -16.3 -14.6 / -18.4 -16.4 -16.1 · Alarm Call -20.0 -15.5 -14.5 / -20.0 -17.0 -14.9 / -20.0 -17.0 -15.7 · total big
  -15.0 < rung max -11.8 < **MAX WIN -11.6** (mono -15.7 < -12.8 < -12.1, phone -16.4 < -15.4 < -12.3) · rung beds -15.2 /
  -15.0 / -14.8 / -14.6 / -14.4 LUFS. Chain nudges over the family target (the price of rising on all three): signs -2.6 /
  -2.2 / +1.2 / +2.3 / +2.0 dB (bass-heavy MEGA / EPIC / MAX impacts lose 4-6 dB through the phone proxy), rung hits -1.1 /
  -0.4 / 0 / 0 / +2.2, `win_max` +1.9, bursts water -1.8, Rescue totals -0.9 / 0 / +0.5, `inferno_enter` +1.2, `blaze_mult_10` +0.4, the rest
  <= 0.25. Alternates level-matched: stops 0.01 dB (phone 0.09), ignitions 0.0 (phone 0.21), hauls 0.0 (phone 0.22); the
  three UI clicks match on st / mono but spread 3.95 dB on the phone proxy (listen, §9).
- **Mono compatibility (r2, gate)**: every cue in both codecs has inter-channel correlation >= 0 and loses <= 3 dB of its
  loudest 400 ms in the (L+R)/2 sum (worst now `burst_embers` corr 0.26, 2.26 dB; r1 had 35 cues over: `alarm_outcome_false`
  corr -0.74 lost 8.6 dB). Drawn cues with corr < 0.2 are M/S-narrowed (side x 0.5, the mono sum unchanged: `antic_hit`,
  `blaze_ignite`, `sym_win_h4`, `sym_win_l1`, `line_win_small`, `line_win_mid`, `total_win_big`, `win_max`, `rung_hit_mega`,
  `rung_hit_epic`, `hose_end`, `rescue_total_small`, `inferno_total_big`, `alarm_outcome_inferno`, the ticker click);
  `alarm_outcome_false` (-0.74) ships its stronger channel as mono.
- **Re-master law (`mix.py`)**: a cue needing > +6 dB of gain is re-mastered from the BUILD's master (kept in
  `audio/masters/_src/_premix/` with the sha of what mix.py wrote, so re-running mix.py never stacks a second raise), with a
  4x-oversampled tanh soft clip at -3 dBFS first when its crest factor exceeds 16 dB (crackle / pops: a look-ahead limiter
  pumps on every pop), then the -1.5 dBFS limiter, up to 4 passes. 16 cues (4 base, 12 turbo): `burst_embers` +15.7 dB
  (crest 27.8 dB: the draw is sparse full-scale pops at -25 dB RMS), `sign_impact_huge` +6.5, `alert_insufficient` +5.7,
  `sym_win_l3` +3.5, turbo variants +3.4 .. +14.4. r3: `rung_hit_big` itself no longer needs one (its redraw sits +5.2 dB
  hotter raw; r2 needed +4.7 dB); r4: neither does `rung_hit_big_turbo` (was +9.4; the hybrid's gain is 1.047 / turbo 1.454).
  r4: the re-masters are reproducible (§15: `enc_wav` rounding; `burst_embers` / `_turbo` moved once, +15.38 -> +15.74 /
  +13.91 -> +14.40 dB, when the rounding changed). Listen for grit (§9).
- **No celebration at or below the stake** — contract §8 win-tier rule, client-derived from the booked round total W: W <= S
  (S = the CHARGED cost of the selected mode: 1x base, 1.5x ALARM BOOST, the buy price for a bought feature) is tier 0 (a
  neutral cue or nothing) and takes precedence over every floor; then tier 1 S < W < 15B (`total_win_*`, `rescue_total_*`,
  `inferno_total_*`), BIG >= 15B, HUGE >= 30B, MEGA >= 50B, EPIC >= 100B (the rungs), MAX = the 15,000x cap (`win_max`, the
  capped round only). The table per event is `docs/AUDIO_MAP.md` §Contract §8 event -> cues.

## 6. Ducking, transitions, turbo

Duck the music 3-6 dB (attack 40-80 ms, release 250-500 ms) under every win cue, entry flourish, building cleared, big
prize and total; never on clicks, stops or landings (per-cue `duck` hints in `audio/cues.json`). Base -> bonus: alarms ->
fanfare -> bay-door shutter -> entry flourish -> bonus bed (600 ms equal-power crossfade), ambience off; bonus -> base: total
or rungs -> shutter -> the other base tune (900 ms), ambience back. Win rungs replace the scene bed (one bed at a time).
Turbo: `reel_stop_turbo` merges the stops, `*_turbo` variants (time-scaled 0.5-0.55, pitch kept) for every one-shot over
0.7 s except HUD feedback, **capped at 0.70 s** (r2; r1 had 32-33 variants over, `win_max_turbo` 1.55 s): a variant that
would run long is re-scaled to fit when that factor is >= 0.4 (21 cues, 0.41-0.53), otherwise it keeps its first 0.58 s and
a 120 ms exponential release (17 cues); longest now 698.6 ms (`backdraft_chord_turbo`). Exempt, recorded as
`turboCapExempt` on the cue: `antic_riser_turbo` / `antic_riser_2_turbo` (1.19 / 1.21 s) — held risers the runtime stops
itself (stopHeld on resolve), so their file length never extends the turbo cadence. The soundtrack is never sped up. Every sound cue also has a visual cue (muted phones).

## 7. Provider / provenance

ElevenLabs, lossless `pcm_44100`: SFX `eleven_text_to_sound_v2` (`prompt_influence` 0.6-0.75, `loop: true` for loops),
music `music_v1` composition plans. `audio/tools/gen_audio.mjs` ledgers EVERY call (draw, failure, quota read) to
`audio/source-record.json` + `audio/PROVENANCE.jsonl`: endpoint, model, prompt / plan, params, prompt sha256, byte sha256,
character-cost header, cost estimate, output path, status. Key from the environment only. No redraw without a named,
measured defect (`--force --reason`), one redraw per defect, the better draw by measurement ships (`bed_overrides.json`).
Quota guard: stop at 25,000 characters remaining. **Spent**: the whole pass (107 draws, 0 failures) moved the account
194,478 -> 185,542 characters (8,936; SFX headers 1,566); the 5 redraws (§10; issued by the coordinator with `--force --reason`,
this lane made no call) moved it 185,542 -> **184,277 at the last read**; that read reflects only the first redraw (1,265), the
counter had not yet moved for the other four: the ledger's `est_chars` for all 5 total **3,104** (1,265 + 1,155 + 660 + 13 + 11),
so the next read should show about **182,438**. The ledger holds
**132 rows**: 98 SFX ok (96 + 2 redraws), 14 music ok (11 + 3 redraws), 20 quota reads, 0 failures.
The build, mix, measure and montage are offline (no call).

## 8. Deferred

- **Voiceover** (theme §6: Chief Hamm "Move out!", "Nice save!"): needs its own toggle in the HUD and a TTS / voice-design
  pass; not in this roster.
- Symbol-landing sounds per reel (the donor's `sym_land_*`) are not drawn: the tonic stop ladder carries the landing, and a
  second hit per reel adds repetition. Revisit after listening.

## 9. Listening pass — NOT RUN

Everything is built and machine-measured, but **nobody has listened yet**; no seat grants the audio rung without it. Render
`python3 audio/tools/montage.py` -> `audio/qa/review_montage.mp3` (75 s, 93 distinct cues at their registered gains, -16.1 LUFS,
-1.5 dBTP; cue sheet `review_montage.json`) and listen on headphones AND a phone speaker (mono). Must cover:
- the synthesised hook over each bed (does the glock / vibes / bugle / bell sit, or poke out?); the synth-bugle colour
  (cheesy in a good way, or cheap?); base A vs B (two tunes? — A is now its r3 redraw, from bar 1);
- **the Inferno bed after its -3 st rubberband transposition** (phasiness / smeared transients?);
- the lifted quiet bars (base B bars 1-2, Rescue bar 1): natural, or a noisy lift?;
- every loop point, especially `rung_bed_big` / `rung_bed_mega` (r2 tail fill from bar 7) and the 12-bar Backdraft layer;
- rung MAX (30 % of samples in limiting) and the soft-clipped re-masters (`burst_embers` +15.7 dB, `burst_embers_turbo`,
  `sign_impact_huge`, `alert_insufficient`): squash or grit?;
- the alarm ladder climbing into the fanfare (does the resolution land?); the riser step-up and the neutral miss;
- ignition and multiplier pings (too tinkly when five fire at once?); `sym_win_h2` split-band ring; `rung_hit_max` against the rung beds (its pitch
  content is not C pentatonic, 0.58); **`rung_hit_big` (r4 hybrid)**: does the synthesised brass / chime chord still read as the
  drawn stab + snare BIG WIN stinger, or as a synth pad? the stab's low band moved +2.26 st (rubberband): smeared? the pickup into
  `rung_bed_big`: one gesture, or two?;
- **r2 changes to hear**: the reel stops' new C5-A5 wood knock over the thunk (x5 per spin: pleasant, or tinkly? audible on the
  phone over the reel loop?); the ta-da ladder now C4 .. E5 with rungs 4-8 from the horn source cleaned to one note (does the
  harmonic mask sound processed? the +5 / +7 / +9 st rubberband rungs?); the alarm chords now ring out 1.54 s with the top
  voice leading (muddy when 3-5 overlap?); ignition / multiplier pings now ring 1.3-1.6 s (a pentatonic cluster when five
  ignite?); the rung BIG / MEGA loop points (the last half-bar now comes from bar 7: a natural lead into the downbeat?);
  **`rescue_loop`'s 12-bar repeat** (bars 9-16 vs 21-28, band r 0.86,
  beat-chroma r 0.88: under the 0.90 near-copy bar, but is it heard as a repeat?); `inferno_total_small` on a phone (-29.8
  dBFS through the 400 Hz proxy, 12 dB under its stereo level: a flame whoosh under low brass); the three UI clicks on a phone
  (3.95 dB apart there); the turbo fanfares cut to 0.58 s + release (abrupt?);
- the two-tone horn call (musical, not a real siren?); Ember's bark (cute after 50 false alarms?); turbo (time-scaled)
  fanfares for WSOLA smear; **`sym_win_l4`** (r3: the drawn sub stomp + a synthesised A4 wood knock for phones — a boot stomp,
  or a knock? too close to the reel stops' C5-A5 knocks?); fatigue over a 30-minute session.

## 10. Redraws — drawn by the coordinator, folded in by measurement (r3, 2026-09-25)

Music redraws are NEW plans (`<plan>_v2`, `redrawOf` + `defect` in `audio/tools/plans.json`, preserved by `roster.py`, never
swept by `--all`); each changes only the plan text that the defect names. SFX redraws overwrite `<name>.wav` (the first take
kept as `<name>__v1.wav`). Each was measured against the take it would replace with the shipping code; the better one ships.
Evidence: `audio/qa/redraw_foldin_r3.json`; commands and full outcomes: `audio/README.md` §Redraws.

| Cue | Defect (measured, r2) | Redraw measured | Ships |
|---|---|---|---|
| `base_loop_a` | chug 3.99 raw / 3.77 shipped; C-pent 0.559; sections 2-3 r 0.906; intro -10.5 dB | `pf_base92a_v2__1`: chug 1.52, C-pent 0.732, max section r 0.756; one defect, a 1-bar intro at -13.2 dB | **the redraw, from bar 1**: chug 1.35, C-pent 0.756, self-sim 0.834 / sliding 0.838, limiter 0.25 % |
| `inferno_loop` | C minor/dorian, C-pent 0.546 | `pf_inferno100_v2__1`: C-pent 0.598 raw; built loop 0.634 raw / 0.704 at -2 st vs v1 -3 st 0.780; self-sim, sliding and seam all worse (§2.2) | **v1 at -3 st** (redraw rejected) |
| `backdraft_spins_layer` | 5.3 s near-silent head, 15.0 bars of material | `pf_backdraft92_v2__1`: same head (-25.2 dB), chug 4.06, C-pent 0.547 | **v1, 12 bars** (redraw rejected) |
| `rung_hit_big` | C-pent 0.525, tonality 0.53, pickup refused, +4.7 dB soft-clip re-master | tonality 0.679, +5.2 dB hotter, C-pent 0.520; a Bb3 stab (SHS 233.1 Hz), not the C asked | **the redraw**, key-fit -1 st: C-pent 0.525, SHS A3, tonality 0.553, no re-master (gain 1.54); pickup still refused; **r4: a hybrid in C** (§15): C-pent 0.979, pickup accepted |
| `sym_win_l4` | ~100 % of energy under 200 Hz: phone proxy -53.4 dBFS effective | same defect (phone gap 34.0 vs 34.5 dB), 4.9 dB quieter, out of key (F / F#, C-pent 0.217 vs 0.813) | **v1 restored** + a tuned A4 wood knock solved on the phone proxy (§14): -21.5 dBFS effective, within 2.44 dB of every other symbol win; C-pent 0.996 |

No further redraw is requested. The offline option r3 left open — `rung_hit_big` as a hybrid (the `blaze_mult_10` recipe) — is
built in r4 (§15); a 16-bar Backdraft layer needs a third draw.

## 11. Acceptance as measured (`python3 audio/tools/measure.py` -> `audio/qa/measure_all.json`, 2026-09-25)

| Check | Result |
|---|---|
| ids x codecs present | 232 x 2 = 464 / 464; static == runtime sha256 for all 464 |
| True peak, decoded Opus AND AAC, **8x oversampled** at the codec's native rate, unrounded (r2) | max **-1.23 dBTP** (r4; r3 -1.21), 0 over -1.0 (r1 shipped `spins_added.ogg` -0.96, `rung_hit_big.m4a` -0.97, `rescue_total_big.ogg` -0.98: ebur128 prints one decimal; now -3.00 / -1.18 / -1.23) |
| Loops seam-clean (wrap <= body p99.9, both codecs) | 14 / 14 (11 beds, reel spin, hose, ambience) |
| Whole-bar grid exact (samples) | 11 / 11 beds (92 BPM x 32 = 3,681,392 samples; 100 x 32 = 3,386,880; 92 x 4 = 460,174; 92 x 12 = 1,380,522; 100 x 8 = 846,720) |
| Codec-guard pads cyclic | 11 / 11 |
| Chug (8th/quarter, 300-1200 Hz) <= 3 | **11 / 11** (r3: `base_loop_a` 3.77 -> 1.35 on its redraw; max now Inferno 1.55) |
| Self-similarity, 8-bar grid sections < 0.90 | 4 / 4 32-bar beds (max 0.834 base A) |
| **Self-similarity, sliding** 8-bar windows at every half beat, cyclic, band spectrogram AND beat chroma (z-scored per pitch class) < 0.90 (r2) | 4 / 4: base A 0.84 / 0.77 (r3), base B 0.74 / 0.56, **Rescue 0.86 / 0.88 (12-bar lag, bars 9-16 vs 21-28; listen)**, Inferno 0.65 / 0.58 |
| Bed tail dip: head-tail at 1000 ms <= 6 dB (r2: a gate) | 11 / 11 (rung BIG 6.8 -> 4.5, rung MEGA 2.4 after the tail fills) |
| Bed LUFS vs target (+-1) | 11 / 11: base A -15.5, B -15.5, Rescue -15.5, Inferno -15.2, layers -16.0 / -16.0 |
| Rung beds strictly rising | -15.2 < -15.0 < -14.8 < -14.6 < -14.4 LUFS |
| **Mono sum** (r2): corr >= 0 and loudest-400 ms loss <= 3 dB, every cue, both codecs | 464 / 464 (r1: 35 cues failed) |
| **Tails** (r2): one-shots, master + both codecs: the 10 ms ending 10 ms before the last sample <= -40 dB re peak, \|last sample\| < 0.002 | 218 / 218 one-shots (r1: 29 failed — alarm 1-5, ignitions, multipliers, `spins_added`, `line_win_small`, `count_ticker_12` ...) |
| **Turbo <= 700 ms** audible (r2) | 92 / 92 capped variants (longest 698.6 ms); 2 held risers exempt (`turboCapExempt`) |
| **Ta-da ladder SHS fundamental strictly rising** (r2) | C4 D4 E4 G4 A4 C5 D5 E5 (59.99 .. 75.98) |
| **Reel stops on the phone proxy** (r2): each >= `reel_spin_loop` + 6 dB, within 1 dB | -23.4 .. -23.5 dBFS vs -30.0 (+6.5 dB), spread 0.09 dB (r1 -40.3 .. -28.2) |
| **Reward chains on st + mono + phone** (r2, also re-checked by measure.py from the shipped files x gains) | 16 / 16 (+ 15 / 15 turbo in mix.py) |
| **Alarm top voice** within 3 dB of the loudest partial, mono sum (r2) | 5 / 5 (A4 0.0, D5 0.0, F5 -1.1, A5 0.0, B5 0.0 dB) |
| **Symbol wins on the phone proxy** (r3, measured, not a gate) | 9 / 9 within 2.44 dB: -19.02 .. -21.46 dBFS effective (`sym_win_l4` -53.43 -> -21.46) |
| **Rung hit BIG in key** (r4, measured, not a gate) | C-pent 0.979 (r3 0.525), pickup accepted; rung-hit chain rising on st / mono / phone: -17.16 -15.86 -15.00 -14.51 -11.83 / -17.19 -16.94 -15.59 -15.34 -12.76 / -17.89 -17.03 -16.78 -15.65 -15.40 |
| **Re-runs bit-identical** (r4, checked, not a gate) | `mix.py` twice in a row: 275 / 275 master WAVs incl. `_src` at the check (273 now: two stale `_premix` copies removed), 464 / 464 shipped, 464 / 464 runtime, `cues.json` / `mix_pass.csv` / `mix_ladder.json` sha256-identical |
| **PASS** | **true** — 16 / 16 gates (`measure_all.json` summary.failingGates = [], r4 2026-09-25) |

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
and the registry is written atomically (a failed dump can no longer truncate `cues.json`). r4: every step is also
REPRODUCIBLE — re-running the build or `mix.py` on the same inputs gives sha256-identical masters and shipped files (§15), and
no intermediate file is left in `audio/runtime` (`kit.scratch()`).

## 13. r2 build fixes (2026-09-25; offline, no paid call)

Each defect was measured on the r1 shipped files; each fix is in the build / mix / measure code and gated in §11.

| Defect (r1, measured) | Fix | Now |
|---|---|---|
| Ta-da ladder did not step up: sources labelled by their loudest partial (lo "C5", hi "C6" = their 2nd / 4th harmonics of C4), rungs 4-8 built from hi: perceived C4 D4 E4 G3 A3 C4 D4 E4 | `kit.shs_f0` (subharmonic summation) labels and snaps every ta-da source by its fundamental; planner = smallest UPWARD shift (lo 0/2/4, mid 0/2/5/7/9); rubberband formant-preserving shifts; sources cleaned to their own harmonic series (`kit.harmonic_only`; mid is a G7sus4 stab); hi retired | C4 D4 E4 G4 A4 C5 D5 E5 (SHS gate) |
| 0.4 ms (17-sample) inter-channel delay on every synthesised layer (hook in every bed, pickups, alarm chords, pings, wood knock): a mono comb with notches at 1250 / 3750 / 6250 Hz; alarm ladder flat in mono, hook bars -1 dB extra in mono | `hook_layer.stereo()` = level-only width (identical signal, L x 1.08, R x 0.92) | hook bars now lose 0.21-0.44 dB in mono vs 0.26-0.72 for the other bars (r1 1.35-1.64 vs 0.29-0.71); alarm mono -20.0 .. -18.0 rising |
| Anti-phase draws (`alarm_outcome_false` corr -0.74, `line_win_mid` -0.31, `sym_win_l1` -0.33, `sym_win_h4` -0.23 ...) and chains that rose only on headphones | `kit.narrow` (corr < 0.2 -> side x 0.5; < -0.5 -> stronger channel as mono) on every draw; `mix.py` solves the chains on st + mono + phone | mono gate 464 / 464; 16 / 16 chains on all three (§5) |
| Reel stops under a phone speaker's band (knock C4-A4): proxy -40.3 .. -28.2 dBFS effective, stops 1-2 under the reel loop | knock one octave up (C5 D5 E5 G5 A5), rendered per stop, level solved on the 400 Hz proxy; thunk kept as the low body | -23.4 .. -23.5 dBFS (+6.5 dB over the loop), spread 0.09 dB |
| Truncated / clicking ends: `blaze_ignite` hard cut, `spins_added` pickup sliced mid-note, multipliers / alarms into 20-40 ms fades at -18 / -20 dB, `line_win_small` / `burst_badges` rings cut by a 25 ms fade, hook notes cut at note end | layers rendered 1.6 s with a natural decay + `kit.ring_out` (< -50 dB re peak, cap 1.6 s, cos^2 60 ms); `trim()` gives a loud tail a 200 ms exponential release; the pickup is used whole or refused; `hook_layer.tone()` ends every note in a release; 20 Hz DC block on every draw (Opus DC-reject step tails) | tails gate: all one-shots (r1: 29 failed) |
| 32-33 `_turbo` variants over 0.7 s (`win_max_turbo` 1.55 s) | `build_audio.turbo()` cap: re-scale to fit (factor >= 0.4) or head 0.58 s + 120 ms release; held risers exempt (recorded) | longest 698.6 ms |
| `alarm_land_3` barely above alarm 2 (same triad, added F5 11 dB under the loudest partial) | top voice weighted +6 dB in `hybrid_chord` | F5 -1.1 dB re the loudest partial; top line A4 D5 F5 A5 B5 leads |
| True peak -0.96 / -0.97 / -0.98 dBTP shipped (ebur128 rounds to -1.0) | `kit.true_peak` (8x, native rate, unrounded) in `ship()`, target -1.3, ceiling -1.1 | max -1.18 dBTP over 464 files |
| `docs/AUDIO_MAP.md`: `setTotalWin` / `freeSpinTrigger` / `updateFreeSpin` / `freeSpinEnd` never named; totals labelled "> 1x bet" | `audio_map.py` emits a contract §8 event -> cues table (all 17 events) with the W vs S precedence and the tier floors; roster events carry the tier rule | every event named; 0 unknown ids |
| `rung_bed_big` / `rung_bed_mega` loop tail in the phrase-end breath (+25.0 / +20.6 dB head-tail at 250 ms) | `tailFill` from the end of bar 7 (bar 4 carries the same breath) | +10.7 / +6.4 dB at 250 ms, 4.5 / 2.4 at 1000 ms |
| Self-similarity gate compared only grid-aligned 8-bar sections | `measure.selfsim_sliding` (half-beat hop, cyclic, band + beat chroma) | Rescue's 12-bar repeat found (0.86 / 0.88, < 0.90): listening item |

## 14. r3 redraw fold-in (2026-09-25; offline, no paid call)

| Change | Why (measured) | Now |
|---|---|---|
| `bed_overrides.json` `base_loop_a` -> `pf_base92a_v2__1`, start bar 1 | the only failing gate (chug 3.77) and four more named defects of v1; bar 1 chosen over bar 0 / 2 by head-tail and self-similarity (§2.2) | chug 1.35, C-pent 0.756, PASS 16 / 16 |
| Inferno and Backdraft redraws rejected | both measured worse on the built loop / the draw grade (§2.2, §10) | v1 ships for both (`why` recorded) |
| `cues_pcm/sym_win_l4.wav` = the `__v1` take (the redraw kept as `__v2`) | the redraw kept the named defect and was out of key | v1 body |
| `build_audio.PHONE_VOICE` / `phone_voice()`: drawn sub-heavy one-shot + a tuned knock on its onset, level solved on the 400 Hz proxy to st - phone <= `gap_db` (the reel-stop recipe, per cue) | `sym_win_l4` read -53.4 dBFS on the phone proxy vs -19.0 .. -20.8 for the other symbol wins; A4 wood (the thump's own pitch class, an octave under the reel-stop knocks); gap 2.5 dB, because A4 loses ~1.6 dB through the proxy and a 1.5 dB target buried the stomp 30 dB under the knock | knock +8.5 dB over the stomp's onset; gap 2.46 dB; -21.46 dBFS effective |
| `build_audio.py` `--only` runs MERGE into `qa/build_report_<mode>.json` | a partial rebuild replaced the whole report with its subset | full report kept, `onlyRuns` appended |
| Atomic writes: `kit.write_text` / `write_json` for every JSON / CSV / Markdown output of build / mix / measure / map / montage; `gen_manifest.mjs` temp + rename; `ship()` copies into static via temp + rename | a crash mid-write could leave a truncated QA file, map, manifest or shipped file | — |

## 15. r4 (2026-09-25; offline, no paid call): `rung_hit_big` hybrid, bit-identical re-runs

Evidence: `audio/qa/rung_hit_big_hybrid_r4.json`.

| Change | Why (measured) | Now |
|---|---|---|
| `build_audio.HYBRID_STAB` / `hybrid_stab()`: `rung_hit_big` = drawn stab (split at 2.5 kHz: under it snapped +2.26 st to C4 by its dominant partial and cleaned to C4's harmonic series with `kit.harmonic_only`; above it — snare, bell sizzle — as drawn) at -3 dB + synthesised brass (bugle C4 E4 G4, held 0.32 s) / chime (C5 E5 G5) / glock (G5) chord on its onset, rolled up 30 ms per voice, top voice +4 dB, peak = the drawn peak, rung out 1.30 s (the `blaze_mult_10` recipe) | the redraw is a ~100 ms Bb-ish stab (dominant partial 229.6 Hz, a -45 c neighbour; SHS 233.1 Hz): key-fit -1 st shipped C-pent 0.525 and the pickup was refused. Body candidates (110-2500 Hz C-pent): as drawn 0.520, SHS snap +2.00 st 0.488, dominant-partial snap +2.26 st **0.664**, A3 snap 0.724 (root A under a C chord: not used) | **C-pent 0.979**, SHS C4, tonality 0.989; **pickup accepted** (+200 ms); stinger 1.30 s, file 1.50 s (audible 1.29 s); file st / mono / phone -17.6 / -17.6 / -18.3 dBFS (phone gap 4.4 -> 0.7 dB); gain 1.047; rung-hit chain (and its turbo chain) rising on all three; `rung_hit_big_turbo` x0.46, 654 ms, no re-master (r3 +9.4 dB) |
| `kit.enc_wav`: `np.round(x * 8388608)` clipped to [-8388608, 8388607] (was a truncation of `x * 8388607`) | a decode -> encode round trip moved most samples by 1 LSB, so `mix.py`'s restore-from-`_premix` + re-master drifted and no two runs gave the same masters | a decoded 24-bit master re-encodes to identical PCM; masters identical run to run |
| `kit.enc_runtime`: Ogg muxed with `-fflags +bitexact` | with identical masters, the 16 `.ogg` that `mix.py` re-ships still differed each run: the Ogg muxer draws a random stream serial (decoded audio identical) | `mix.py` x2: 275 masters at the check (273 after the stale `_premix` copies were removed), 464 shipped, 464 runtime, `cues.json`, `mix_pass.csv`, `mix_ladder.json` sha256-identical |
| `kit.scratch()`: intermediate WAVs in one per-process temp dir outside the repo, removed at exit | `_m`, `_p_in` / `_p_out`, `_pb_in` / `_pb_out`, `_ts_in` / `_ts_out.wav` (22 MB) were left in `audio/runtime` by every build | deleted; `audio/runtime` = the 464 encodes only |
| stale `masters/_src/_premix/rung_hit_big*.wav(.json)` removed | r1's +4.73 dB soft-clip re-master copies; `mix.py` no longer raises either cue | — |

One-time shift when the rounding changed: `burst_embers` / `burst_embers_turbo` re-master +15.38 -> +15.74 / +13.91 -> +14.40 dB
(their 4-pass loop stops on the measured `.ogg` level); the other 14 re-masters landed on the same raise (<= 2 LSB). The chain
solver picked a different optimum for two chains it does not constrain tightly (multipliers x5 / x10 +0.25 dB, entries Rescue /
Inferno -0.25 dB); every chain still rises by >= 0.25 dB on st / mono / phone. `measure.py` PASS 16 / 16, max TP -1.23 dBTP.
