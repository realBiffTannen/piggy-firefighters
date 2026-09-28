# Piggy Firefighters — math submission handoff

**Status: v1.3 PRODUCTION COMPLETE / AUDITED / PROMOTED (2026-09-28).** Owner re-price of 2026-09-28: seven modes — `base` 1x,
`ante` ALARM BOOST 3x (exactly 5x the natural chance of each bonus), `super_ante` FIVE-ALARM BOOST 5x (exactly 15x), `alarm_call`
15x, `rescue` 25x, `backdraft_spins` 50x, `inferno` 100x — max win **20,000x base bet in every mode**, contract v1.3, model frozen
at annotated tag `math-freeze-v2` = commit **`10ef51124dd8d7fac81ae11c148e952012177e3f`**. Production (100,000 simulation trials per mode, 10,000 per auxiliary
class: 740,000 trials → 1,520,001 publication rows, eight workers under the memory guard, 2,121 s, peak 1,117 MiB) exited 0 with
`candidate_status == "PASS"` and `source_unchanged == true`; the independent audit `qa/codex/math/audit_publication.py` returned
PASS (`qa/codex/math/v2-audit.json`, sha256 `2eb5213b033c4038841163f590caca9dc1f3d018761d37658d0969df30468c4c`); the fifteen-file payload (index + seven books + seven LUTs) is
promoted to `math/publish/` with `MANIFEST.json` (sha256 `988b20d96c8ead74feb09c80ea6ca984b03ca0539d22681b98ed228d014e05a9`), sha256 equal on both sides for every file
(`qa/submission/math_package_manifest.json`, 1,568,941,459 bytes); contract §9 and `docs/math/MATH_PF_REPORT.md` carry the
measured figures. Fixtures: 22 real books synced to `server/fixtures/` (index sha256 `4e947f658751793fa612ed9dc03da91c7daa35efa29891c02526e287e5a37b56`).

| Mode ID | Player title / selection | Charged cost × base bet | Actual trials | Publication rows |
|---|---|---:|---:|---:|
| `base` | Default spin | 1 | 100,000 nonbonus source trials | 340,000 |
| `ante` | ALARM BOOST (activate tier 1) | 3 | 100,000 nonbonus source trials | 340,000 |
| `super_ante` | FIVE-ALARM BOOST (activate tier 2) | 5 | 100,000 nonbonus source trials | 340,000 |
| `backdraft_spins` | BACKDRAFT SPINS buy | 50 | 100,000 | 100,000 |
| `alarm_call` | ALARM CALL buy | 15 | 100,000 weighted draws | 200,001 |
| `rescue` | RESCUE SPINS buy | 25 | 100,000 | 100,000 |
| `inferno` | INFERNO RESCUE buy | 100 | 100,000 | 100,000 |

Buy cards appear in ascending price: Alarm Call 15×, Rescue 25×, Backdraft 50×, Inferno 100×; the two ante tiers are the HUD's
ante chooser (one at a time, CONFIRM before arming). The output tree is
`/Users/jbull/code/piggy-firefighters/math/games/piggy_firefighters/library/production-100k/` (gitignored). Everything below this
line is the 2026-09-25 M3 handoff (v1.2.2, 15,000x, 350k trials) and is SUPERSEDED; kept as history.

---


**Status: M3 COMPLETE / AUDITED / PROMOTED (2026-09-25).** Production exited 0 with `candidate_status == "PASS"`; the independent audit `qa/codex/math/audit_publication.py` returned PASS (`qa/codex/math/m3-audit.json`); the thirteen-file payload is promoted to `math/publish/` with `MANIFEST.json`; contract §9 is populated. Measured figures: `docs/math/MATH_PF_REPORT.md`. External integration and release gates (last section) remain open.

The game is `piggy_firefighters`, a 5×3 reel game with 20 fixed paylines. The contract is `docs/GAME_CONTRACT.md` v1.2.2. The approved model is frozen at annotated tag `math-freeze-v1`, commit **`38a6c2f75d6b624eab2ae4efbcd55ed467075127`**. Amounts in books and LUTs are integers in hundredths of the **base bet**, not hundredths of a feature's price. Gross return is capped at **15,000× base bet in every mode**; valid final payouts are multiples of 10 (0.1× base bet).

## Modes, trials and publication rows

| Mode ID | Player title / selection | Charged cost × base bet | M3 actual trials | Expected publication rows |
|---|---|---:|---:|---:|
| `base` | Default spin | 1 | 200,000 nonbonus source trials | 940,000 |
| `ante` | ALARM BOOST toggle | 1.5 | 200,000 nonbonus source trials | 940,000 |
| `backdraft_spins` | BACKDRAFT SPINS buy | 50 | 350,000 | 350,000 |
| `alarm_call` | ALARM CALL buy | 12 | 350,000 weighted draws | 700,001 |
| `rescue` | RESCUE SPINS buy | 18 | 350,000 | 350,000 |
| `inferno` | INFERNO RESCUE buy | 90 | 350,000 | 350,000 |

Four additional canonical banks — Rescue with 12 or 15 starting spins and Inferno with 12 or 15 starting spins — each require **10,000 actual trials**. Total M3 work is **1,840,000 actual simulation trials** and **3,630,001 publication rows** across the six modes. The six internal banks contain 740,000 source books; these are reused by publications and are not additional independent trials.

Alarm Call's publication contains the complete 350,000-row Rescue bank, complete 350,000-row Inferno bank, and **one** false-alarm book. Its 350,000 actual trials sample the composed integer-weight law with replacement; repeat selections are expected and must be reported separately from distinct publication rows. Each natural mode publishes 200,000 nonbonus books plus all 740,000 canonical bank books behind genuine zero-line-win trigger prefixes.

Buy cards appear in ascending price: Alarm Call 12×, Rescue 18×, Backdraft 50×, Inferno 90×. The final publication index must match frontend mode IDs and costs; the ante toggle remains separate.

## Expected files and package boundary

The launched output destination is:

`/Users/jbull/code/piggy-firefighters/math/games/piggy_firefighters/library/production-350k/`

The generator writes a consumable `index.json` only after its final validation passes. The expected Engine math payload consists of that index and these twelve files:

| Mode | Event books | Integer-weight LUT |
|---|---|---|
| base | `books_base.jsonl.zst` | `lookUpTable_base_0.csv` |
| ante | `books_ante.jsonl.zst` | `lookUpTable_ante_0.csv` |
| backdraft_spins | `books_backdraft_spins.jsonl.zst` | `lookUpTable_backdraft_spins_0.csv` |
| alarm_call | `books_alarm_call.jsonl.zst` | `lookUpTable_alarm_call_0.csv` |
| rescue | `books_rescue.jsonl.zst` | `lookUpTable_rescue_0.csv` |
| inferno | `books_inferno.jsonl.zst` | `lookUpTable_inferno_0.csv` |

`index.json` has a `modes` array containing `name`, `cost`, `events` and `weights` for exactly those six IDs. Each LUT is headerless CSV: `book_id,positive_integer_weight,payout_x100`. Publication IDs must be contiguous from 0 within each mode; mode row counts need not be equal.

Retain these expected internal audit artifacts separately from the thirteen-file Engine payload:

- `report.json` and `metadata_<mode>.csv` for each of the six mode IDs.
- `bank_links_base.csv`, `bank_links_ante.csv`, `bank_links_alarm_call.csv`.
- `trials_alarm_call.csv`, recording actual trial ID, selected publication ID, route and payout.
- `banks/books_<bonus>_<spins>.jsonl.zst` and `banks/weights_<bonus>_<spins>.csv` for all six combinations of `bonus ∈ {rescue,inferno}` and `spins ∈ {10,12,15}`.

Outside that output directory, retain `qa/codex/math/m3-launch.json`, `m3-production.log` and the completed `m3-production-memory.json`. The real-source fixture index and provenance live under `math/games/piggy_firefighters/fixtures/`; they are integration evidence rather than independent production trials.

Promotion to `math/publish/` is **done** (2026-09-25): all thirteen payload files were copied byte for byte and SHA256-compared on both sides (equal); `math/publish/MANIFEST.json` records bytes, sha256 and rows per file, the freeze identity, report/audit hashes and per-mode figures. LUTs, `index.json` and the manifest are committed; the books are gitignored. Submission archive and Engine upload remain the coordinator's.

## Production acceptance checklist

Every unchecked item below remains pending for M3. M1 success does not fill a production acceptance box.

- [x] **Completion and runtime:** VERIFIED 2026-09-25 (audit preflight). Exit 0; `candidate_status == "PASS"`; guard `COMPLETE`, `command_exit_code 0`, `group_empty true`; peak aggregate RSS **627.34 MiB** (four processes) of 5120 MiB; elapsed **5,381.2 s** (producer 5,378.9 s); output tree **4,779,328 KiB** (4.6 GiB) including internal audit artefacts.
- [x] **Frozen provenance:** VERIFIED (audit `verify_sources`). `math-freeze-v1` resolves to `38a6c2f75d6b624eab2ae4efbcd55ed467075127` = launch SHA; report `source_sha256` covers exactly the 76 frozen files and every current byte equals the frozen byte; `source_unchanged == true`; runtime Python 3.12.14 / NumPy 2.2.5 / SciPy 1.15.3 / zstandard 0.23.0 from `math/env/bin/python`.
- [x] **Counts and uniqueness:** VERIFIED 1,840,000 actual trials (350,000 × 4 + 10,000 × 4 + 200,000 × 2) and 3,630,001 publication rows (940,000 / 940,000 / 350,000 / 700,001 / 350,000 / 350,000; LUT line counts equal); contiguous ids from 0, positive integer weights, metadata ids/payouts/routes equal the LUTs and the canonical layout; Alarm Call's 350,000 trials re-read from `trials_alarm_call.csv` (158,644 / 180,775 / 10,581; 151,712 distinct ids). Distinct event sequences and zero duplicates are the producer's recorded evidence (`unique_events == rows`, `duplicate_events == 0`); the books were hash-checked, not replayed.
- [ ] **Accounting and legal max:** PARTIALLY verified. From the LUTs: every payout is within 0…1,500,000 and divisible by 10, and every mode carries a positive-weight 15,000× outcome (rescue id 0, backdraft_spins id 0 are the fixture cap books). Event-level accounting (`setWin` totals, `winInfo.totalWin`, contiguous event indices, zero-award trigger prefixes, cap-clipped prizes) is the producer's recorded gate (`weights_status PASS`) and was not independently replayed in this pass.
- [x] **Weighted statistics:** VERIFIED by exact integer/Fraction recomputation from the persisted LUTs. RTP base 0.966999990027, ante 0.966999990137, backdraft_spins 0.966999987505, alarm_call 0.966999990540, rescue 0.966999990206, inferno 0.966999991690 (all in [0.9665, 0.9670]); SD/cost base 14.4000 (band 13.38–15.44), ante 9.5000 (8.79–10.14); base any-win 38.00% / regular 16.00% / sub-hit 22.00%; etl10k max 0.060, etl40b max 0.750, cvar max 378.49, prob5k/prob10k max 4e-6. Every reported figure equals the recomputed one to 1e-11 relative.
- [x] **Shared full-event law:** VERIFIED 2,180,000 links (740,000 base, 740,000 ante, 700,000 alarm_call): each published weight equals its bank weight × factor (base 12,600 / 1,260 / 140 and 990 / 99 / 11; ante double; alarm 155 / 9), payouts equal, and the ordered canonical event digests equal every bank report's `full_event_bank_sha256`; `rescue`/`inferno` publication bytes equal their 10-spin bank bytes.
- [x] **Route and cap laws:** VERIFIED exactly from the LUTs: base Rescue 1/165, Inferno 1/2100; ante 2/165, 2/2100; Backdraft 0.0250000 in both (residual ≤ 1.5e-11); Alarm Call 155/300 / 9/300 / 136/300; cap masses rescue 1e-6, inferno 4e-6, backdraft_spins 4e-6, alarm_call 191/(300 × 10⁶) = 6.3667e-7, base 1/7,500,000, ante 1/3,750,000; bank cap masses 1e-6 / 1.47785136e-4 / 6e-4 per class.
- [x] **Hashes and promotion:** VERIFIED. All six book hashes/sizes, six LUT hashes, six bank book/weight hashes, three bank-link hashes and the alarm trial hash equal the report; the thirteen promoted files in `math/publish/` hash-match the production tree and `index.json` names exactly those files at costs 1 / 1.5 / 50 / 12 / 18 / 90; `MANIFEST.json` written; the sixteen production fixtures' ids resolve to their `payoutMultiplier` in the promoted LUTs (16/16) and are copied to `server/fixtures/`; contract §9 populated with the measured figures, all other contract lines unchanged.

The source mixture has bank budget 10¹². Rescue, Inferno and Backdraft Spins each have total weight 10¹²; Alarm Call uses 300×10¹²; base/ante each use 2,310,000×10¹². Natural starting-class shares are 90%/9%/1% for 10/12/15 spins. Ten-spin cap masses are 1e-6 for Rescue and 4e-6 for Inferno; common 12-spin and 15-spin banks use 0.000147785136 and 0.0006. Their mixture targets base ≈ 1/7.5 million, with ante doubled. Backdraft Spins uses 4e-6, and Alarm Call's route mixture gives 6.366666666666667e-7. These are frozen design values to verify, not measured M3 results presented in advance.

## Evidence already available — development only

M1 passed 30 focused tests and 13 SDK tests. Its supported-runtime run produced 118,001 unique publication rows from 64,000 actual trials and verified 68,000 full-event/common-weight composition links. Its six RTP/tail/contract gates and independent integer/Fraction audit passed. Details and development metrics are in `docs/math/M1_REPORT.md`, `qa/codex/math/m1-supported-report.json`, `m1-supported-memory.json` and `m1-fixtures-audit.json`.

Launch metadata records production start at **2026-09-25T04:29:39.994897+00:00**, two workers and the 5120 MiB owned-process guard. Generation completed the same day (guard `COMPLETE`, exit 0); `qa/codex/math/m3-launch.json` still carries its launch-time `"status": "RUNNING"` field because the audit hashes that file as completion evidence and did not require the field — the completed state is recorded by the guard file and the audit report. The production output tree is now immutable evidence; no frozen-source changes are authorized.

## External integration and release gates — pending

- [ ] Engine ingestion accepts the final math package, all six mode costs and book/LUT/index references; hosted round selection, charged cost, wallet credit and round settlement agree with the books.
- [ ] Frontend replay on the actual submitted package verifies all mode routes, 10/12/15-spin starts, room resets, added spins, prizes, cap accounting, reconnect/replay and the final 15,000× meter. Standard padded positions and custom visible-board positions render correctly.
- [ ] Desktop and physical-device/mobile checks verify viewport/layout, input, normal/turbo/skip behavior and audio. Development fixtures or local browser playback do not establish hosted Engine or physical-device acceptance.
- [ ] Presentation honors charged-cost celebration precedence: no celebratory rig/audio/plate when gross return is at or below the selected mode's cost. Animation, original art/audio provenance, thumbnail deliverables and the intended three-star quality review remain separate release evidence.
- [ ] Final submission/archive hashes, deployment/build provenance and external reviewer/Engine approval are recorded by the coordinator. A locally passing math run is not external approval or a star rating.
