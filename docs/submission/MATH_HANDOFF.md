# Piggy Firefighters — math submission handoff

**Status: M3 RUNNING; production acceptance and submission are pending.** This handoff was prepared from the frozen contract, model/report schema, M1 evidence and launch metadata. The active production output tree was not inspected. Expected counts and filenames below are requirements, not claims that generation or acceptance has completed.

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

Promotion of validated files to `math/publish/`, a final SHA256 manifest, submission archive and any Engine upload are **pending**. No staging or upload is implied by this document. The coordinator must compare promoted bytes and index references against the accepted production source files.

## Production acceptance checklist

Every unchecked item below remains pending for M3. M1 success does not fill a production acceptance box.

- [ ] **Completion and runtime:** production exits 0; `report.json.candidate_status == "PASS"`; memory guard reports `COMPLETE`, `command_exit_code == 0`, `group_empty == true`, and peak aggregate RSS below 5120 MiB. Record actual elapsed time, peak memory and disk usage without substituting M1 values.
- [ ] **Frozen provenance:** launch freeze SHA matches the tag; production `source_sha256` covers the frozen model, reels, tools, vendored SDK and requirements files; `source_unchanged == true`; recorded interpreter/dependencies are Python 3.12.14, NumPy 2.2.5, SciPy 1.15.3 and zstandard 0.23.0. Preserve the pinned `math/requirements-production.lock`.
- [ ] **Counts and uniqueness:** verify 1,840,000 actual trials and 3,630,001 publication rows with the table's per-mode/class counts. Every mode has contiguous unique IDs, the expected number of distinct event sequences, zero duplicate events, and positive integer LUT weights. Check metadata and LUT payouts against the books. Audit Alarm Call trial counts independently from its composed rows.
- [ ] **Accounting and legal max:** payouts are within 0…1,500,000 x100 units and divisible by 10; credited `setWin` totals and final book payout agree; per-line wins agree with `winInfo.totalWin`; event indices are contiguous. Each mode contains a positive-weight, genuine 15,000× source outcome. Natural trigger prefixes award zero before the canonical bonus; all displayed prizes/line amounts are already cap-clipped.
- [ ] **Weighted statistics:** independently recompute from the persisted integer LUTs. Every mode's RTP is in [0.9665, 0.9670], with finite statistics, valid probabilities, ETL10k ≤ 0.8, ETL40b ≤ 0.9, CVaR ≤ 800, reported probability5k ≤ 0.01 and probability10k ≤ 0.005. Verify base SD/cost 13.38–15.44, ante 8.79–10.14; base any-win 33–40%, regular-hit 12–18%, sub-hit ≥ 15%. Preserve both empirical simulation summaries and exact weighted-law figures with distinct labels.
- [ ] **Shared full-event law:** verify the expected **2,180,000** composed-row links: 740,000 each in base/ante and 700,000 in Alarm Call. Canonical hashes normalize only event indices and `rescueStart.source`; every other bonus event must agree. Each final weight must equal its canonical bank weight multiplied by the route/class factor. No separate natural or Alarm Call bonus tilt is permitted.
- [ ] **Route and cap laws:** confirm base Rescue 1/165 and Inferno 1/2100, ante exactly twice each, and Backdraft approximately 1/40 in both within solver/integerization tolerance. Alarm Call shares must be Rescue 155/300, Inferno 9/300 and false-alarm 136/300. Verify designed cap probabilities and common starting-class weights from the final LUTs; do not infer million-round rare-event frequencies from raw sample counts.
- [ ] **Hashes and promotion:** independently check the reported book/LUT/bank-link hashes, runtime fixture provenance and final package manifest. Promote only accepted files; verify all thirteen payload files and index paths in the destination. Populate contract §9 from accepted M3 measurements, preserving the frozen rules.

The source mixture has bank budget 10¹². Rescue, Inferno and Backdraft Spins each have total weight 10¹²; Alarm Call uses 300×10¹²; base/ante each use 2,310,000×10¹². Natural starting-class shares are 90%/9%/1% for 10/12/15 spins. Ten-spin cap masses are 1e-6 for Rescue and 4e-6 for Inferno; common 12-spin and 15-spin banks use 0.000147785136 and 0.0006. Their mixture targets base ≈ 1/7.5 million, with ante doubled. Backdraft Spins uses 4e-6, and Alarm Call's route mixture gives 6.366666666666667e-7. These are frozen design values to verify, not measured M3 results presented in advance.

## Evidence already available — development only

M1 passed 30 focused tests and 13 SDK tests. Its supported-runtime run produced 118,001 unique publication rows from 64,000 actual trials and verified 68,000 full-event/common-weight composition links. Its six RTP/tail/contract gates and independent integer/Fraction audit passed. Details and development metrics are in `docs/math/M1_REPORT.md`, `qa/codex/math/m1-supported-report.json`, `m1-supported-memory.json` and `m1-fixtures-audit.json`.

Launch metadata records production start at **2026-09-25T04:29:39.994897+00:00**, two workers and the 5120 MiB owned-process guard. It establishes the launched configuration, not completed production results. The coordinator owns job supervision; no output-tree reads or frozen-source changes are authorized while generation is active.

## External integration and release gates — pending

- [ ] Engine ingestion accepts the final math package, all six mode costs and book/LUT/index references; hosted round selection, charged cost, wallet credit and round settlement agree with the books.
- [ ] Frontend replay on the actual submitted package verifies all mode routes, 10/12/15-spin starts, room resets, added spins, prizes, cap accounting, reconnect/replay and the final 15,000× meter. Standard padded positions and custom visible-board positions render correctly.
- [ ] Desktop and physical-device/mobile checks verify viewport/layout, input, normal/turbo/skip behavior and audio. Development fixtures or local browser playback do not establish hosted Engine or physical-device acceptance.
- [ ] Presentation honors charged-cost celebration precedence: no celebratory rig/audio/plate when gross return is at or below the selected mode's cost. Animation, original art/audio provenance, thumbnail deliverables and the intended three-star quality review remain separate release evidence.
- [ ] Final submission/archive hashes, deployment/build provenance and external reviewer/Engine approval are recorded by the coordinator. A locally passing math run is not external approval or a star rating.
