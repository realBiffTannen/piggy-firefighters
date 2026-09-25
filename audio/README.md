# PIGGY FIREFIGHTERS — audio lane

Owner: AUDIO lane (Claude). Status 2026-09-25: **tooling, roster, prompts and plans ready; no sound drawn yet (0 draws,
0 characters spent).** Direction: `assets/SOUND_BIBLE.md`. Per-cue map: `docs/AUDIO_MAP.md` (generated). Design rules:
`docs/AUDIO_DESIGN_NOTES.md`, theme §6, `docs/GAME_CONTRACT.md`.

## Layout

| Path | What |
|---|---|
| `audio/cues.json` | THE registry (donor schema: `$schema_note`, `grid`, `mix`, `transitions`, `cues[]`). 232 ids: 11 music (beds, layers, rung beds), 127 SFX, 94 `_turbo` variants. Roster fields come from `tools/roster.py`; build fields (`gain`, `measured`, `mix`, `build`, `loopPoints`, built `durationMs`) from the build and mix passes. `status: planned` = roster only. |
| `audio/source-record.json` | Paid-generation ledger (JSON array). EVERY ElevenLabs call (draw, failure, quota read) appends one row. Empty now: no call has been made. |
| `audio/PROVENANCE.jsonl` | Same rows, one per line (created by the first call). |
| `audio/cues_pcm/` | Raw lossless draws (`<name>.wav`, `<plan>__N.wav`), git-ignored. |
| `audio/masters/` | 24-bit 44.1 kHz stereo masters, one per cue (the rebuild source; committed). `masters/_src/` = ladder sources and pre-pickup copies (never shipped). |
| `audio/runtime/` | Encoded working copies, git-ignored (sha-identical to static). |
| `apps/piggy_firefighters/static/assets/audio/piggy_firefighters/` | What ships: `<id>.ogg` (Opus 160k, 48 kHz) + `<id>.m4a` (AAC-LC 160k, 44.1 kHz). |
| `apps/piggy_firefighters/src/game/audio/cueManifest.ts` | Generated runtime projection (`Bus`, `CueDef`, `GRID`, `MIX`, `CUES`, `CueId`), same shape as the donor's. |
| `audio/qa/` | Evidence: `music_draws_measured.json`, `build_report_*.json`, `mix_pass.csv`, `mix_ladder.json`, `measure_all.json`, `cues_table.csv`, `beds_table.md`, `review_montage.mp3`. |

## Tools (`audio/tools/`)

| Tool | Role |
|---|---|
| `roster.py` | **The single editable source**: every SFX draw (prompt, palette, duration, influence), every music composition plan, every cue id (moment, bus, priority / maxInstances / cooldown, seam, the donor id it replaces, duck, gate, derivation). Writes `prompts.json`, `jobs.json`, `plans.json` and merges `audio/cues.json`. Validates: prompt + palette <= 450 chars, banned theme words (no siren / police / construction / hard hat / lantern / dragon / wolf / pig / fire-engine nouns in any prompt or plan), sections >= loop + 1 bar, "full ensemble from beat one", turnaround, coverage of every contract/theme moment. `--check` validates only. |
| `gen_audio.mjs` | ElevenLabs caller (family `gen_lucky.mjs`, relative ROOT). SFX `POST /v1/sound-generation?output_format=pcm_44100` `{text, duration_seconds, model_id: eleven_text_to_sound_v2, prompt_influence, loop}`; music `POST /v1/music?output_format=pcm_44100` `{composition_plan, model_id: music_v1, respect_sections_durations: true}`. Key from `ELEVENLABS_API_KEY` only (never printed / written). 450-char guard, **no redraw without `--force --reason "<measured defect>"`**, CONC <= 2, ledger + jsonl for every call incl. failures, true-channel WAV headers, `--dry-run`, **quota guard** (below). |
| `build_audio.py` | `music | sfx | derived | shots | turbo | all [--only a,b] [--purge-donor]`: beds (tempo-fit, whole-bar sample-exact cut, periodic section ride, synthesised hook, LUFS landing +-0.1 LU, cyclic-context limiter, codec-guard padding), SFX mastering (trim, key-fit, tonic snap, hybrid tuned layers), derived ladders, fanfare pickups (idempotent), turbo variants. Writes masters, runtime, static, cues.json. Refuses to write static while the donor's untracked `static/assets/audio/lucky/` exists (`--purge-donor` deletes only untracked donor folders). |
| `mix.py` | Family gain ladder (loudest-400 ms RMS of the shipped .ogg -> per-cue `gain`, clamp [0.12, 2.0], re-master > +6 dB), strictly-rising reward chains (alarm ladder, ta-da ladder, multipliers, totals, rung hits / signs / bursts, entries, Alarm Call outcomes, reward -> MAX, rung-bed LUFS). |
| `gen_manifest.mjs` | `audio/cues.json` -> `cueManifest.ts`. Default lists only cues whose ogg AND m4a exist (the runtime never fetches a 404); `--all` lists every roster id; `--out` writes elsewhere. |
| `measure.py` | Acceptance on the shipped files, both codecs: TP <= -1 dBTP, LUFS, loop seams on the decoded files, whole-bar grid exactness, codec-guard pads cyclic, bed chug ratio, 8-bar section self-similarity (the "one 8-bar loop dressed as 32 bars" tag), bed tail dip, rung-bed LUFS rising. `measure.py draws` grades raw music draws (short / quiet intro / dropout / chug / out of key / tempo / near-copy) before a source is chosen. |
| `audio_map.py` | Generates `docs/AUDIO_MAP.md` (works before and after the build). |
| `montage.py` | 75 s review montage at registered gains (a listening aid for the human pass). |
| `kit.py`, `loopkit.py`, `beat_tools.py`, `keyfit.py`, `hook_layer.py`, `limit_loop.py` | DSP / codec kit (family code; `kit.py` adds the RIFF-chunk loader, the static-folder guard, the cyclic limiter and the codec guard), loop DSP, onset envelope, 10-cent key-fit, the Firefighters hook + timbres, cyclic ffmpeg limiter. |
| `bed_overrides.json` | Which draw ships per bed when it is not the plan's first draw (measured decisions only). Empty. |

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

## Not done / known limits

- No draw, no master, no static file yet; `cueManifest.ts` is still the ported donor manifest (it is regenerated by
  `gen_manifest.mjs` after the build — generating it now would list 232 missing files).
- The donor's untracked `apps/piggy_firefighters/static/assets/audio/lucky/` (388 files) is still there; the build deletes
  it (`--purge-donor`) before its first write.
- Human listening: NOT RUN (nothing to hear yet). See SOUND_BIBLE §9 for what the first listen must cover.
