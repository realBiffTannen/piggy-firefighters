# PIGGY FIREFIGHTERS — audio lane

Owner: AUDIO lane (Claude). Status 2026-09-25: **BUILT, r2 build fixes applied, r3 redraws folded in by measurement, r4
`rung_hit_big` hybrid + bit-identical re-runs (this lane made no paid call; the coordinator drew the 5 redraws).** 107 + 5 draws
-> 232 ids x 2 codecs shipped, manifest regenerated,
measured. `measure.py` **PASS: true, 16 / 16 gates** (files, 8x true peak, seams, grid, pads, chug, sliding self-similarity,
bed tail dip, mono sum, tails, turbo <= 700 ms, ta-da ladder, reel stops on the phone proxy, reward chains on stereo + mono +
phone, alarm top voice, rung beds rising). `base_loop_a` now ships its redraw (chug 1.35); outcomes per redraw in §Redraws;
evidence `audio/qa/redraw_foldin_r3.json`. r4 (§r4): `rung_hit_big` is a hybrid in C (C-pent 0.979, fanfare pickup accepted),
`mix.py` re-runs are sha256-identical; evidence `audio/qa/rung_hit_big_hybrid_r4.json`. **Human listening NOT RUN**.
Direction and measured tables: `assets/SOUND_BIBLE.md`. Per-cue map: `docs/AUDIO_MAP.md` (generated). Design rules:
`docs/AUDIO_DESIGN_NOTES.md`, theme §6, `docs/GAME_CONTRACT.md`.

## Layout

| Path | What |
|---|---|
| `audio/cues.json` | THE registry (donor schema: `$schema_note`, `grid`, `mix`, `transitions`, `cues[]`). 232 ids: 11 music (beds, layers, rung beds), 127 SFX, 94 `_turbo` variants. Roster fields come from `tools/roster.py`; build fields (`gain`, `measured`, `mix`, `build`, `loopPoints`, built `durationMs`) from the build and mix passes. `status: planned` = roster only. |
| `audio/source-record.json` | Paid-generation ledger (JSON array). EVERY ElevenLabs call (draw, failure, quota read) appends one row. **132 rows**: 98 SFX ok (96 + 2 redraws), 14 music ok (11 + 3 redraws), 20 quota reads; 0 failures. Account (creator tier) 194,478 characters remaining at the first read -> 185,542 after the 107-draw pass (8,936) -> **184,277 at the last read**. That read reflects only the first redraw (`pf_base92a_v2`, 1,265): the account counter had not yet moved for the other four (the ledger's `est_chars` for all 5 redraws total **3,104** = 1,265 + 1,155 + 660 + 13 + 11), so the next read should show about **182,438**. The 5 redraws were issued by the coordinator (`--force --reason`); the audio lane made no call. |
| `audio/PROVENANCE.jsonl` | Same rows, one per line (created by the first call). |
| `audio/cues_pcm/` | Raw lossless draws (`<name>.wav`, `<plan>__N.wav`), git-ignored. |
| `audio/masters/` | 24-bit 44.1 kHz stereo masters, one per cue (the rebuild source; committed). `masters/_src/` = ladder sources and pre-pickup copies (never shipped). |
| `audio/runtime/` | Encoded working copies, git-ignored (sha-identical to static): exactly the 464 `<id>.ogg` / `<id>.m4a`. r4: the tools' intermediate WAVs (formerly `_m`, `_p_in` / `_p_out`, `_pb_in` / `_pb_out`, `_ts_in` / `_ts_out.wav`, left here after every build) now go to one per-process temp dir outside the repo (`kit.scratch()`, removed at exit); the 7 leftovers were deleted. |
| `apps/piggy_firefighters/static/assets/audio/piggy_firefighters/` | What ships: `<id>.ogg` (Opus 160k, 48 kHz) + `<id>.m4a` (AAC-LC 160k, 44.1 kHz). |
| `apps/piggy_firefighters/src/game/audio/cueManifest.ts` | Generated runtime projection (`Bus`, `CueDef`, `GRID`, `MIX`, `CUES`, `CueId`), same shape as the donor's. |
| `audio/qa/` | Evidence: `music_draws_measured.json`, `build_report_*.json` (a `--only` run merges into the last report, r3), `mix_pass.csv`, `mix_ladder.json`, `measure_all.json`, `cues_table.csv`, `beds_table.md`, `review_montage.mp3`, `redraw_foldin_r3.json` (every redraw candidate as built / measured), `rung_hit_big_hybrid_r4.json` (r4: body candidates, the shipped hybrid, the rung chain, the mix repeatability check). r3: every JSON / CSV / Markdown / TS output of the build / mix / manifest / measure / map / montage steps is written atomically (temp + rename; `kit.write_text` / `write_json`), and `ship()` copies each shipped file into static atomically (masters and runtime encodes are still written in place by ffmpeg and re-made by any rerun; `roster.py` and the `gen_audio.mjs` ledger were not touched). |

## Tools (`audio/tools/`)

| Tool | Role |
|---|---|
| `roster.py` | **The single editable source**: every SFX draw (prompt, palette, duration, influence), every music composition plan, every cue id (moment, bus, priority / maxInstances / cooldown, seam, the donor id it replaces, duck, gate, derivation). Writes `prompts.json`, `jobs.json`, `plans.json` and merges `audio/cues.json`. Validates: prompt + palette <= 450 chars, banned theme words (no siren / police / construction / hard hat / lantern / dragon / wolf / pig / fire-engine nouns in any prompt or plan), sections >= loop + 1 bar, "full ensemble from beat one", turnaround, coverage of every contract/theme moment. `--check` validates only. |
| `gen_audio.mjs` | ElevenLabs caller (family `gen_lucky.mjs`, relative ROOT). SFX `POST /v1/sound-generation?output_format=pcm_44100` `{text, duration_seconds, model_id: eleven_text_to_sound_v2, prompt_influence, loop}`; music `POST /v1/music?output_format=pcm_44100` `{composition_plan, model_id: music_v1, respect_sections_durations: true}`. Key from `ELEVENLABS_API_KEY` only (never printed / written). 450-char guard, **no redraw without `--force --reason "<measured defect>"`**, CONC <= 2, ledger + jsonl for every call incl. failures, true-channel WAV headers, `--dry-run`, **quota guard** (below). |
| `build_audio.py` | `music | sfx | derived | shots | turbo | all [--only a,b] [--purge-donor]`: beds (tempo-fit, whole-bar sample-exact cut, periodic section ride, synthesised hook, LUFS landing +-0.1 LU, cyclic-context limiter, codec-guard padding), SFX mastering (trim, key-fit, tonic snap, hybrid tuned layers), derived ladders, fanfare pickups (idempotent), turbo variants; r4 `HYBRID_STAB` / `hybrid_stab()` (drawn stab split-band snapped + harmonic-only, plus a synthesised brass / chime C-E-G chord: `rung_hit_big`). Writes masters, runtime, static, cues.json. Deterministic: the same inputs give sha-identical masters. Refuses to write static while the donor's untracked `static/assets/audio/lucky/` exists (`--purge-donor` deletes only untracked donor folders). |
| `mix.py` | Family gain ladder (loudest-400 ms RMS of the shipped .ogg -> per-cue `gain`, clamp [0.12, 2.0], re-master > +6 dB). r4: **re-runs are bit-identical** (two consecutive runs: every master WAV incl. `_src` (275 at the check; 273 after the two stale `_premix` copies of `rung_hit_big` / `_turbo` were removed), 464 shipped files, `cues.json`, `mix_pass.csv`, `mix_ladder.json` sha256-identical) since `kit.enc_wav` rounds and the Ogg mux is bitexact. r2: every cue is measured on stereo power, the (L+R)/2 mono sum and a 400 Hz high-pass phone proxy (`kit.levels`), and ONE gain per cue is solved (linear programme, minimise 10 x max + sum of deviations from the family target) so every reward chain (alarm ladder, ta-da ladder, multipliers, totals, rung hits / signs / bursts, entries, Alarm Call outcomes, reward -> MAX; + their `_turbo` chains) rises by >= 0.25 dB on all three; rung-bed LUFS rising. |
| `gen_manifest.mjs` | `audio/cues.json` -> `cueManifest.ts`. Default lists only cues whose ogg AND m4a exist (the runtime never fetches a 404); `--all` lists every roster id; `--out` writes elsewhere. |
| `measure.py` | Acceptance on the shipped files, both codecs: TP <= -1 dBTP (8x oversampled, `kit.true_peak`), LUFS, loop seams on the decoded files, whole-bar grid exactness, codec-guard pads cyclic, bed chug ratio, 8-bar self-similarity on the grid AND sliding (half-beat hop, cyclic, band spectrogram + beat chroma: the "one 8-bar loop dressed as 32 bars" tag at any lag), bed tail dip (gate), rung-bed LUFS rising; r2 gates: mono sum (corr >= 0, loss <= 3 dB), one-shot tails, turbo <= 700 ms, ta-da SHS rising, reel stops on the phone proxy, reward chains on st / mono / phone, alarm top voice (`summary.gates`, `summary.failingGates`). `measure.py draws` grades raw music draws (short / quiet intro / dropout / chug / out of key / tempo / near-copy) before a source is chosen. |
| `audio_map.py` | Generates `docs/AUDIO_MAP.md` (works before and after the build). |
| `montage.py` | 75 s review montage at registered gains (a listening aid for the human pass). |
| `kit.py`, `loopkit.py`, `beat_tools.py`, `keyfit.py`, `hook_layer.py`, `limit_loop.py` | DSP / codec kit (family code; `kit.py` adds the RIFF-chunk loader, the static-folder guard, the cyclic limiter and the codec guard; r2: `true_peak` (8x), `levels` (st / mono / phone), `narrow` (M/S), `release`, `ring_out`, `tail_metrics`, `shs_f0` (subharmonic summation), `harmonic_only`; r4: `enc_wav` rounds `x * 2^23` to the nearest code (clipped to 2^23 - 1) so a decoded master re-encodes to the identical PCM, `enc_runtime` muxes Ogg with `-fflags +bitexact` (fixed stream serial), `scratch()` temp paths), loop DSP, onset envelope, 10-cent key-fit, the Firefighters hook + timbres, cyclic ffmpeg limiter. |
| `bed_overrides.json` | Which draw ships per bed and how it is cut (measured decisions only, each with its `why`): 7 beds (r3: base A = `pf_base92a_v2__1` from bar 1; Rescue start bar; Inferno v1 -3 st, kept over its v2 by measurement; anticipation entry + tempo; Backdraft v1 entry + 12 bars, v2 rejected; r2: rung BIG / MEGA `tailFill` from bar 7). |

## Order of work

```bash
python3 audio/tools/roster.py                                   # roster -> prompts/jobs/plans/cues.json (validated)
node audio/tools/gen_audio.mjs quota                             # read the character quota (ledgered)
node audio/tools/gen_audio.mjs music audio/tools/plans.json --all  # = <plan>__1 of the 11 plans (redraw plans are named explicitly)
python3 audio/tools/measure.py draws                             # named defects -> at most ONE redraw each (a <plan>_v2 plan), bed_overrides.json
node audio/tools/gen_audio.mjs sfx audio/tools/jobs.json --all   # 96 SFX draws
python3 audio/tools/build_audio.py all --purge-donor             # music -> sfx -> derived -> shots -> turbo
python3 audio/tools/mix.py && node audio/tools/gen_manifest.mjs
python3 audio/tools/measure.py && python3 audio/tools/audio_map.py && python3 audio/tools/montage.py
```
Then the runtime seam (frontend task) and a human listening pass on headphones AND a phone speaker. Builds only via
`./tools/build_dist.sh`; audio ships as plain static files.

## Quota guard and cost estimate

`gen_audio.mjs` reads `GET /v1/user/subscription` before the first draw and after every 20 draws. It refuses to start when
`character_limit - character_count - estimated(batch) < 25,000`, stops the batch when the running spend would cross that
floor, and fails CLOSED when the quota read fails. Every reading is a ledger row.

Estimate from the donor's own measured ratios (LUCKY `audio/source-record.json`, round `lucky_0923`): SFX
`character-cost` = round-half-up(11 x seconds) on all 138 donor draws; music (no per-call header) 15,206 characters over
1,106 planned seconds = 13.75 characters per planned second (account moved 17,202 over the 161-draw pass, SFX headers 1,996).

| Pass | Draws | Seconds | Characters |
|---|---|---|---|
| SFX | 96 | 142 | 1,566 |
| Music (11 composition plans) | 11 | 536 | 7,370 |
| **Expected total** | 107 | | **8,936** |
| Worst case: every plan redrawn once + a quarter of the SFX redrawn | | | 16,757 |
| Worst case at 2x the donor music rate | | | 31,437 |

Against ~194,000 characters left this cycle (creator tier) and the 25,000 floor, 169,000 are spendable: the expected pass
uses ~5 % of that and even the doubled worst case ~19 %, leaving >= 162,000 characters (the art lane's OpenAI spend is a
different account). The live quota is read by the tool before the first draw; the 194,000 figure has not been re-read here.

## What has been verified without drawing (2026-09-25)

- `roster.py --check`: 96 prompts all <= 450 chars (max 395), no banned theme word in any prompt / plan / palette, every
  plan's sections >= loop + 1 bar, every contract / theme moment covered.
- **Pipeline smoke test on synthetic stand-in draws** (scratch root via `PF_AUDIO_ROOT`, nothing written to this repo's
  audio folders): `build_audio.py all` -> `mix.py` -> `gen_manifest.mjs` -> `measure.py` -> `audio_map.py` -> `montage.py`
  ran end to end: 232/232 ids x 2 codecs, max TP -1.4 dBTP, 14/14 loops seam-clean in both codecs, 11/11 beds grid-exact,
  pads cyclic, rung beds -15.2 / -15.0 / -14.8 / -14.7 / -14.5 LUFS strictly rising, every reward chain rising,
  measure `PASS: true`. It found and fixed three real defects: AAC's first-frame error (0.15-0.28 against a body p99 of
  0.006-0.009) broke m4a loop seams -> beds now ship with a cyclic 60 ms codec-guard pre/post-roll and loop
  `[loopStartMs, loopEndMs)` (the runtime's `spawnBed` already honours both); rung-bed LUFS landed up to 0.7 LU off target
  -> a +-0.1 LU landing loop; `reel_stop_turbo` had no mix family.
- The runtime audio modules (`audioManager.ts`, `presentationDirector.ts`, `fx/audioDirector.ts`) type-check (`tsc --strict`,
  stubs for `$app/paths` / the HUD type) against both a generated manifest and the `--all` roster manifest.
- `gen_audio.mjs` against a loopback mock with a fake key: ledger rows for ok / 422 failure / quota reads; skip of existing
  draws; `--force` refused without `--reason`; refusal when remaining - batch < 25,000; a mid-batch stop after the 20-draw
  re-read; a non-loopback API override refused; no key text in any file.

- **Draw-ready check (2026-09-25, no calls)**: `roster.py --check` clean and the committed `prompts.json` / `jobs.json` /
  `plans.json` / `cues.json` byte-for-byte what `roster.py` regenerates (notes aside). Independent cross-check of the
  JSON: 232 cues = 90 drawn SFX cues (87 as drawn, 3 draw + tuned layer: `reel_stop_1`, `blaze_ignite`, `blaze_mult_10`)
  + 11 music beds (`source: <plan>__1`, loop length / BPM / bars match the plan) + 131 derived cues (`derive.from`, no
  `source`, no job; 94 `_turbo`, the reel-stop / blaze / ticker / ta-da ladders, the alarm chords, `antic_riser_2`,
  `reel_stop_turbo`), every derivation chain ending on a job. 96 jobs (90 cue draws + 6 ladder sources `*_src*`), each
  with duration 0.5-15 s, prompt + palette <= 450 chars (max 395), influence 0.6 / 0.72 / 0.75, loop flag true on
  exactly the three loop cues. 11 plans: sections 16-24 s, totals 16-92 s, inside the envelope of the donor's 61
  successful composition-plan draws (styles <= 17 / 38, style text <= 191 chars, sections <= 6 x 24 s). `gen_audio.mjs
  music ... --all` used to exit 2 (it passed bare plan names); it now expands to `<plan>__1` and skips `redrawOf` plans.
  Dry runs: `sfx --all` 96 draws ~1,566 characters, `music --all` 11 draws ~7,370 characters.

## Build fixes made in the first real build (2026-09-25)

- `build_audio.py`: `material_end()` (never loop into a draw's closing decay); `onsetAfter` (entry = first sample within
  12 dB of the draw's peak after a quiet pre-roll); `semis` (whole-mix rubberband transposition for a draw in the wrong
  centre); `bars` override; `bar_lift()` (a sparse intro bar the 8-bar ride cannot see); a +-2 ms start nudge to the smallest
  seam step; reel-stop hybrid (thunk + tuned wood knock C4: the drawn thunk was 99-100 % under 200 Hz); snap post-check
  searches +-1.5 st around the expected partial (it had taken the hi ta-da source's 3rd harmonic, putting rungs a fourth off);
  a key-fit that makes the body under 2.5 kHz worse is applied split-band (above 2.5 kHz only) instead; atomic registry write.
- `mix.py`: re-master from the build's master (`masters/_src/_premix` + sha), so re-running never stacks raises; 4x-oversampled
  tanh soft clip before the limiter for crest > 16 dB (crackle pops); up to 4 passes; atomic write.
- `hook_layer.py`: `wood` colour. `audio_map.py`: moment -> cue -> file columns + owner rules. `plans.json`: three `_v2`
  redraw plans. `bed_overrides.json`: five measured bed decisions.

## r2 build fixes (2026-09-25; offline, no paid call; details and before/after in `assets/SOUND_BIBLE.md` §13)

- **Ta-da ladder**: sources labelled / snapped by their SHS fundamental (lo C4, mid G4, hi C4; r1 read lo / hi as C5 / C6),
  cleaned to their own harmonic series (mid is a G7sus4 stab), smallest-upward-shift planner = lo 0/2/4, mid 0/2/5/7/9, rubberband
  formant-preserving; `hi` retired (`roster.RETIRED_SOURCES`). Shipped SHS C4 D4 E4 G4 A4 C5 D5 E5.
- **Mono**: `hook_layer.stereo()` is level-only width (the 0.4 ms delay combed every synthesised layer in mono); every draw with
  corr < 0.2 is M/S-narrowed (side x 0.5), `alarm_outcome_false` (corr -0.74) ships its stronger channel; 20 Hz DC block on
  every draw.
- **Chains** rise on stereo, mono and the 400 Hz phone proxy (`mix.py` LP). **Reel stops**: wood knock one octave up (C5-A5),
  per stop, level solved on the phone proxy (-23.4 dBFS vs the reel loop's -30.0).
- **Tails**: tuned layers rendered 1.6 s + `kit.ring_out`; `trim()` exponential release for loud tails; whole pickup or none
  (`spins_added` refused; `rung_hit_huge` / `inferno_total_big` extended); every synthesised note ends in a release.
- **Turbo** capped at 0.70 s (re-scale >= 0.4, else head 0.58 s + 120 ms release); held risers exempt (`turboCapExempt`).
- **Alarm** top voice +6 dB; **true peak** 8x in `ship()` (target -1.3, ceiling -1.1); **rung BIG / MEGA** tail fill;
  **AUDIO_MAP** contract §8 event table with the W vs S tier rule.

## Redraws (measured defects; drawn by the coordinator 2026-09-25, ledgered; folded in by MEASUREMENT, r3)

The five `--force --reason "<measured defect>"` calls below were issued by the coordinator (rows in `audio/source-record.json`;
this lane made no paid call). Each redraw was then measured against the take it would replace with the same code the build
ships; the better one ships. Evidence: `audio/qa/redraw_foldin_r3.json` (every candidate), `music_draws_measured.json`
(draw grades), `bed_overrides.json` (each bed's `why`).

| Cue | Redraw | Outcome (measured) |
|---|---|---|
| `base_loop_a` | `pf_base92a_v2__1` | **SHIPS** (v1 retired). Draw grade: one defect left (quiet 1-bar intro -13.2 dB) vs v1's five. Built from bar 0 / 1 / 2: bar 1 ships (no bar lift needed, head-tail 1.1 / 0.3 / -1.1 dB at 50 / 250 / 1000 ms; bar 0 needed +5.6 dB lift and left a -4.7 dB head dip at 1 s; bar 2 self-sim 0.859 / 0.871). Shipped: **chug 1.35** (v1 3.77: the failing gate), C-pent 0.756 (0.592), grid self-sim 0.834, sliding 0.838 band / 0.773 chroma (v1 0.81 / 0.88), -15.5 LUFS, TP -2.05 / -1.72 dBTP, seam 0.034 / 0.037 vs body 0.069 (both codecs clean), grid exact 3,681,392 samples, pads cyclic, limiter 0.25 % of samples (v1 37.6 %). |
| `inferno_loop` | `pf_inferno100_v2__1` | **REJECTED by measurement; v1 -3 st keeps shipping.** Built three candidates: v1 -3 st / v2 raw / v2 -2 st (best key-fit within +-2 st; every other rotation moves the centre off A): C/A-minor-pent share **0.780** / 0.634 / 0.704; chug 1.55 / 0.97 / 0.95 (all << 3); grid self-sim **0.650** / 0.689 / 0.681; sliding **0.652** / 0.765 / 0.697; limiter load 2.94 % / 0.0 % / 0.0 %; head-tail at 250 ms **4.4** / 8.2 / 8.6 dB (v2's material ends 0.7 s after the loop: its closing decay sits at the seam). v1 wins key share, both self-similarities and the seam; v2 only chug (not a defect in either) and limiter load. |
| `backdraft_spins_layer` | `pf_backdraft92_v2__1` | **REJECTED by measurement (not built); v1 12 bars keeps shipping.** v2 graded worse: quiet intro -25.2 dB, **chug 4.06**, C-pent 0.547 (out of key), dropout at 46 s (v1 chug 0.79, C-pent 0.715). The 16-bar layer stays an open item. |
| `rung_hit_big` | SFX redraw (first take kept as `cues_pcm/rung_hit_big__v1.wav`) | **SHIPS (better, not in key) -> r4: SHIPS AS A HYBRID IN C** (§r4: drawn stab split-band snapped to C4 + harmonic-only at -3 dB, + synthesised brass / chime C-E-G chord, top voice +4 dB; C-pent **0.979**, pickup **accepted**). r3 outcome: Tonality 0.679 vs 0.525 (now key-fittable), +5.2 dB hotter raw (mix gain 1.54, no soft-clip re-master; v1 needed +4.73 dB), C-pent 0.520 vs 0.525 (equal). Still NOT in key: a Bb3 fundamental (SHS 233.1 Hz; the prompt asked a C chord) with a strong partial ~45 c under Bb. Key-fit (standing rule) -1 st -> shipped C-pent 0.525, SHS fundamental A3 (220.0 Hz), tonality 0.553 after rubberband; an SHS snap to C4 (+2 st) measured key-fit share 0.604 but 110-2500 Hz share 0.462, so not used. **Fanfare pickup refused** (0.525 < 0.6). Rung-hit chain still rises on st / mono / phone (-17.2 / -17.2 / -21.6 dBFS effective). |
| `sym_win_l4` | SFX redraw (kept as `cues_pcm/sym_win_l4__v2.wav`) | **REDRAW WORSE -> v1 RESTORED** (`sym_win_l4.wav` = the `__v1` take). The redraw did not fix the named defect (phone gap 34.0 dB vs v1 34.5: ~100 % of energy under 200 Hz in both), is 4.9 dB quieter raw and out of key (F / F#, C-pent 0.217 vs v1 0.813). Offline fix (no paid call): `build_audio.PHONE_VOICE` = the drawn stomp + a tuned wood knock A4 on its onset (+8.5 dB), level solved on the 400 Hz phone proxy (st - phone 2.46 dB, target <= 2.5; a 1.5 dB target buried the stomp 30 dB under the knock); shipped C-pent 0.996. Effective on the phone proxy **-21.46 dBFS (was -53.43)** vs the other symbol wins -19.02 .. -20.76: within 2.44 dB of all of them. |

```bash
# as issued by the coordinator (for the record)
node audio/tools/gen_audio.mjs music audio/tools/plans.json pf_base92a_v2__1 --force --reason "pf_base92a__1 (base_loop_a): chug 3.99 raw / 3.77 shipped (8th/quarter > 3), C-pent 0.559 (C#/G# smear), near-copy sections 2-3 r 0.906, quiet intro -10.5 dB; measure.py draws 2026-09-25"
node audio/tools/gen_audio.mjs music audio/tools/plans.json pf_inferno100_v2__1 --force --reason "pf_inferno100__1 (inferno_loop): out of key, C minor/dorian (C .24 Bb .17 G .13 Eb .09), C-pent 0.546 < 0.6 instead of A-minor pentatonic; interim ships -3 st rubberband; measure.py draws 2026-09-25"
node audio/tools/gen_audio.mjs music audio/tools/plans.json pf_backdraft92_v2__1 --force --reason "pf_backdraft92__1 (backdraft_spins_layer): quiet intro -25.4 dB (5.3 s near-silent head) and decay from 44.5 s = 15.0 bars of material for a 16-bar layer; interim ships 12 bars; measure.py draws 2026-09-25"
cp audio/cues_pcm/rung_hit_big.wav audio/cues_pcm/rung_hit_big__v1.wav   # keep the first draw: an SFX --force overwrites <name>.wav
node audio/tools/gen_audio.mjs sfx audio/tools/jobs.json rung_hit_big --force --reason "rung_hit_big: prompt asks a C major brass stab; measured C-pent 0.525, top pitch classes A G# A# E G, tonality 0.53 (too noisy to key-fit), fanfare pickup refused, needed a +4.7 dB soft-clip re-master"
cp audio/cues_pcm/sym_win_l4.wav audio/cues_pcm/sym_win_l4__v1.wav
node audio/tools/gen_audio.mjs sfx audio/tools/jobs.json sym_win_l4 --force --reason "sym_win_l4: 99.5% of energy under 200 Hz (200-500 Hz -26 dB, >500 Hz below -39 dB): inaudible on a phone speaker"
# r3 fold-in (offline): v1 restored for sym_win_l4, then
python3 audio/tools/build_audio.py music --only base_loop_a
python3 audio/tools/build_audio.py sfx --only rung_hit_big,sym_win_l4
python3 audio/tools/build_audio.py shots --only rung_hit_big
python3 audio/tools/build_audio.py turbo --only rung_hit_big_turbo,sym_win_l4_turbo
python3 audio/tools/mix.py && node audio/tools/gen_manifest.mjs && python3 audio/tools/measure.py && python3 audio/tools/audio_map.py && python3 audio/tools/montage.py
```
No further redraw is requested by this lane. The `rung_hit_big` hybrid (the offline option r3 left open) is built in r4 (below);
a 16-bar Backdraft layer would need a third draw (no v2 improvement to build on).

## r4 (2026-09-25; offline, no paid call): `rung_hit_big` hybrid, bit-identical re-runs, no scratch files

- **`rung_hit_big` = the `blaze_mult_10` recipe** (`build_audio.HYBRID_STAB` / `hybrid_stab()`; evidence
  `audio/qa/rung_hit_big_hybrid_r4.json`). The drawn take is a ~100 ms stab + snare (-31 dB re peak by 100 ms) whose dominant
  partial is 229.6 Hz (between A3 and Bb3; SHS read 233.1 Hz). Body = the draw, split at 2.5 kHz: the band under it snapped to C4
  by that dominant partial (+2.26 st, rubberband, formants kept) and cleaned to C4's harmonic series (`kit.harmonic_only`), the
  snare / bell sizzle above it as drawn; at -3 dB. Measured body shares (110-2500 Hz C-pent): as drawn 0.520, SHS snap +2.00 st
  0.488, **dominant-partial snap +2.26 st 0.664 (ships)**, A3 snap 0.724 (not used: root A under a C chord). On its onset (11 ms):
  a synthesised chord, brass (bugle) C4 E4 G4 held 0.32 s + chime C5 E5 G5 + glock G5, voices rolled UPWARD 30 ms each, the top
  voice (G) +4 dB, peak = the drawn peak, rung out by 1.30 s. Shipped: **C-pent 0.979**, SHS C4, tonality 0.989 (r3 0.525 /
  A3 / 0.553); **fanfare pickup accepted** (G5 C6 E6 G6, extended 200 ms so it rings out): stinger 1.30 s, file 1.50 s, audible
  1.29 s, rising into `rung_bed_big` (C major pentatonic, 100 BPM, whose bar 0 states the same call). Levels: file st / mono /
  phone -17.6 / -17.6 / -18.3 dBFS (r3 -20.9 / -20.9 / -25.4: the phone gap fell 4.4 -> 0.7 dB), gain 1.047, effective
  -17.16 / -17.19 / -17.89. Rung-hit chain BIG .. MAX st -17.16 -15.86 -15.00 -14.51 -11.83 / mono -17.19 -16.94 -15.59 -15.34
  -12.76 / phone -17.89 -17.03 -16.78 -15.65 -15.40: rising on all three (turbo chain too). `rung_hit_big_turbo` re-scaled x0.46
  to 654 ms (no soft-clip re-master any more; r3 needed +9.4 dB). The stale r1 `_premix` copies of both were removed.
- **Bit-identical re-runs.** `kit.enc_wav` truncated `x * 8388607`, so each decode -> encode round trip moved samples by 1 LSB
  and mix.py's restore-from-`_premix` + re-master drifted; it now uses `np.round(x * 8388608)` clipped to 8388607 (a decoded
  24-bit master re-encodes to identical PCM). That made the masters identical run to run, but 16 re-shipped `.ogg` still
  differed: the Ogg muxer draws a random stream serial per file, so `enc_runtime` now muxes with `-fflags +bitexact`. Checked:
  `mix.py` twice in a row -> every master WAV incl. `_src` (275 at the check, 273 now that the two stale `_premix` copies are
  gone), 464 shipped + 464 runtime files, `cues.json`, `mix_pass.csv`, `mix_ladder.json` sha256-identical (also after the final `rung_hit_big` rebuild; the build itself gave identical masters on a
  second run). One-time shift under the new rounding: `burst_embers` / `_turbo` re-master +15.38 -> +15.74 / +13.91 -> +14.40 dB
  (their 4-pass loop stops on the measured level); the other 14 re-masters landed on the same raise.
- **Scratch files**: the 7 leftovers in `audio/runtime` (`_m`, `_p_in`, `_p_out`, `_pb_in`, `_pb_out`, `_ts_in`, `_ts_out.wav`,
  22 MB) were deleted and can no longer come back (`kit.scratch()`).

```bash
python3 audio/tools/build_audio.py sfx --only rung_hit_big && python3 audio/tools/build_audio.py shots --only rung_hit_big
python3 audio/tools/build_audio.py turbo --only rung_hit_big_turbo
python3 audio/tools/mix.py && node audio/tools/gen_manifest.mjs && python3 audio/tools/measure.py && python3 audio/tools/audio_map.py && python3 audio/tools/montage.py
```

## Not done / known limits

- Human listening: NOT RUN (SOUND_BIBLE §9 lists what the first listen must cover).
- The runtime seam is a frontend task: the ported `audioManager.ts` / `presentationDirector.ts` / `fx/audioDirector.ts` /
  `audio/index.ts` / `WinRungs.svelte` still ask for donor ids (`base_loop`, `hat_land_*`, `way_win_*`, `ui_click`,
  `ambient_site_loop`, `reveal_bed`, `*_build_loop`, `tension_hit`, `sym_land_*` ...), which are no longer in the manifest, so
  those moments are SILENT until each is wired to its new id (`cues.json` `seam` + `replaces`, `docs/AUDIO_MAP.md`). The
  runtime skips unknown ids without throwing. The director's 66,899 ms base-bed swap constant should come from `CUES[bed]`.
- `inferno_loop` ships v1 -3 st (rubberband: listen for phasiness) and `backdraft_spins_layer` 12 bars of v1: both redraws
  measured worse. `rung_hit_big` (r4) is a hybrid: listen whether the synthesised brass / chime chord still reads as the drawn
stab + snare BIG WIN stinger or as a synth pad, and to the 2.26 st rubberband on the stab's low band; `sym_win_l4` carries a
  synthesised A4 wood knock over the drawn stomp so it reads on a phone (listen: stomp or knock?).
