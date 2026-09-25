# PIGGY FIREFIGHTERS — Sound Bible

Owner: AUDIO lane. Status: **v1 direction, 2026-09-25. Roster, prompts and composition plans written; no sound drawn yet.
Human listening NOT RUN (§9).** Theme: `docs/PIGGY_FIREFIGHTERS_THEME.md` §6. Rules: `docs/AUDIO_DESIGN_NOTES.md`,
`CLAUDE.md`. Per-cue map (id -> moment -> seam -> sounds like): `docs/AUDIO_MAP.md` (generated). Pipeline: `audio/README.md`.
Every sound is drawn fresh for this title (ElevenLabs) or synthesised by our own tools; no donor sound file is used.

## 1. Musical identity

Station 13 of the Piggy Fire Department at dusk, played by a **warm firehouse brass band with slot polish**: trumpets,
trombones, French horn, tuba, clarinet / flugelhorn, **glockenspiel**, vibraphone, a brass fire bell, snare, bass drum,
toms and timpani for the hot moments. Heroic-comic, never grim: pleasant first (the panel rule — abrasive gets muted), the
"cheese factor" kept as a feature (march oom-pah, bugle calls, a two-tone horn figure), polished enough to match the art.
No voice anywhere in this pass (VO is a later, toggleable option, §8).

- **Grid:** base beds **92 BPM**; Rescue / Inferno and the win-rung beds **100 BPM**; 4/4; key **C major pentatonic**
  (C D E G A). The Inferno bed centres on **A** over the same five notes (A minor pentatonic): darker and hotter with no
  note outside the set, so every ladder and key-fit still holds. Loops are whole bars, sample-exact on their own grid:
  32 bars for the primary beds (base 83.478 s, bonus 76.8 s), 16 for the Backdraft Spins layer (41.739 s), 8 for the rung
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

## 5. Mix

- Buses: music -14 LUFS, sfx -16 LUFS; primary beds mastered to their LUFS target at gain 1.0; every file <= -1.0 dBTP
  after its real codec (both Opus and AAC). The whole mix lands around -14 LUFS.
- SFX gains come ONLY from measurement (`mix.py`): loudest 400 ms of the shipped file vs the family target — ambience -40,
  reel loop -30, UI -27, stops -22, landings -20, events at the bed (-18 .. -20), rewards above it and **strictly rising**:
  alarm ladder -20 -> -18 (0.5 dB steps) · riser -18 < riser 2 -17.5 · multipliers -18 / -17.5 / -17 / -16 · ta-da ladder
  -19 -> -15.5 · line -19 < -18 · totals -18 < -16.5 < -15 (Inferno +0.5) · rung hits -16 -> -14 · signs, bursts rising ·
  entries Backdraft Spins -15.5 < Rescue -15 < Inferno -14.5 · Alarm Call false -20 < rescue -15.5 < inferno -14.5 ·
  total big -15 < rung max -14 < **MAX WIN -13.5**. Neutral cues (miss, false alarm, dead-spin settle) sit under the bed.
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
Quota guard: stop at 25,000 characters remaining. Estimate: ~8,900 characters for the whole pass (§ `audio/README.md`).

## 8. Deferred

- **Voiceover** (theme §6: Chief Hamm "Move out!", "Nice save!"): needs its own toggle in the HUD and a TTS / voice-design
  pass; not in this roster.
- Symbol-landing sounds per reel (the donor's `sym_land_*`) are not drawn: the tonic stop ladder carries the landing, and a
  second hit per reel adds repetition. Revisit after listening.

## 9. Listening pass — NOT RUN

Nothing has been drawn, so nothing has been heard. The first listen (headphones AND a phone speaker, mono) must cover: the
synthesised hook over each bed (does the glock / bugle / bell sit, or poke out?); the synth-brass hook colour (cheesy in a
good way, or cheap?); base A vs B (really two tunes?); the loop points of every bed; the alarm ladder climbing into the
fanfare (does the resolution land?); the riser step-up and the neutral miss; the ta-da ladder (formant shift on the shifted
rungs?); ignition and multiplier pings (too tinkly when five fire at once?); the two-tone horn call (musical, not a real
siren?); Ember's bark (cute, not grating after 50 false alarms?); key-fitted and turbo (time-scaled) fanfares for WSOLA
smear; and the whole set for fatigue over a 30-minute session.
