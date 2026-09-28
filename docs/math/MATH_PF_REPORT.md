# Piggy Firefighters — production math report

## v1.3 production (2026-09-28, owner re-price; accepted, audited, promoted)

**PASS against GAME_CONTRACT v1.3, frozen at `math-freeze-v2` (`10ef51124dd8d7fac81ae11c148e952012177e3f`).** Owner instruction of
2026-09-28: ALARM BOOST `ante` 3x the bet for exactly 5x the natural chance of each bonus, a second tier FIVE-ALARM BOOST
`super_ante` 5x for exactly 15x, Alarm Call 15x, Rescue Spins 25x, Backdraft Spins 50x, Inferno Rescue 100x, max win
20,000x in every mode, 100,000 simulation trials per mode. Production ran on 2026-09-28 (launched 14:56:13 UTC) with the
pinned interpreter `math/env/bin/python` (Python 3.12.14, NumPy 2.2.5, SciPy 1.15.3, zstandard 0.23.0), eight workers under
`tools/codex/run_guard.py` (`qa/codex/math/v2-production-memory.json`: COMPLETE, group_empty, peak aggregate RSS 1,117 MiB of
5,120), and completed with exit 0 in 2,121 s: `report.json.candidate_status == "PASS"`, `source_unchanged == true`, no
platform violation in any mode. Output tree `math/games/piggy_firefighters/library/production-100k/` (gitignored).

The independent audit `qa/codex/math/audit_publication.py` (updated to the v1.3 plan: seven modes, factors 1/5/15, Alarm
144/9, cap 2,000,000, 100k/10k/100k) returned **PASS** — `qa/codex/math/v2-audit.json`, sha256 `2eb5213b033c4038841163f590caca9dc1f3d018761d37658d0969df30468c4c`: 740,000
trials, 1,520,001 rows, 960,000 canonical bank links, every frozen source byte equal to the tag, every book/LUT/link/trial
hash, all statistical, route and cap gates. Promotion: `tools/math/promote_publish.py` copied `index.json`, seven
`books_<mode>.jsonl.zst` and seven `lookUpTable_<mode>_0.csv` byte for byte to `math/publish/` (sha256 on both sides, LUT
rows equal to the report) and wrote `MANIFEST.json` (sha256 `988b20d96c8ead74feb09c80ea6ca984b03ca0539d22681b98ed228d014e05a9`; index sha256 `5aa72518f50ce1f7640db2109191158880303dbc9ae1272b22c741021c586edf`). Books are gitignored.

### What changed in the model (freeze v1 → v2)
- `MODE_COSTS` 1 / 3 / 5 / 50 / 15 / 25 / 100, `WINCAP` 20,000, `ANTE_FACTORS` {base 1, ante 5, super_ante 15} applied to the
  same exact natural factors (90/9/1 starting-spin classes over 2,310,000); reel set `BRS` = `BRA`'s strips under its own
  name so the client can tell the tier from the reveal.
- Bonus prices: FR0 carries 27 wilds per reel (was 24) and FRI 15 (was 14) so the organic 10-spin means land at the set
  prices (production: Rescue 23.58x organic vs 24.175 target, Inferno 98.10x vs 96.7; the bank solver closes the rest).
- Alarm Call at 15x: Inferno fixed at 9/300, Rescue solved to 144/300, False Alarm 147/300 (exact 0.967 x 15).
- The ante tiers' non-bonus fits pin the >= 40x-cost tail at 0.75 (etl40b limit 0.9); ante SD/cost pinned at 8.0, super
  ante left to the least-change solution (7.37). An exact integer guard (`enforce_rtp_ceiling`) moves units from the
  highest-paying non-bonus rows when a fit lands above the 0.967 ceiling (0 units needed in production).
- Cap route books pay 2,000,000; the Backdraft Spins cap is two full 9,875x spins plus a 250x remainder.

### Per-mode measured figures (exact from the promoted integer LUTs)

| Figure | base | ante | super_ante | backdraft_spins | alarm_call | rescue | inferno |
|---|---:|---:|---:|---:|---:|---:|---:|
| cost (x base bet) | 1.0 | 3.0 | 5.0 | 50.0 | 15.0 | 25.0 | 100.0 |
| RTP (LUT exact) | 0.966999987874 | 0.966999990120 | 0.966999990000 | 0.966999989096 | 0.966999987425 | 0.966999986409 | 0.966999991489 |
| SD / cost | 14.4000 | 8.0000 | 7.3673 | 1.1054 | 2.4845 | 1.5077 | 1.0898 |
| any-win / regular hit / sub-hit | 38.00% / 16.00% / 22.00% | 39.04% / 5.98% / 33.06% | 42.11% / 10.30% / 31.80% | 99.99% / 34.99% / 65.00% | 50.98% / 26.39% / 24.60% | 99.96% / 28.92% / 71.04% | 99.99% / 29.83% / 70.16% |
| Rescue Spins trigger | 1/165 (1 in 165.0) | 1/33 (1 in 33.0) | 1/11 (1 in 11.0) | — | share 144/300 = 48.00% | 1 | — |
| Inferno trigger | 1/2100 (1 in 2,100.0) | 1/420 (1 in 420.0) | 1/140 (1 in 140.0) | — | share 9/300 = 3.00% | — | 1 |
| Backdraft rate | 0.0250000 | 0.0250000 | 0.0250000 | every spin | — | — | — |
| max win 20,000x | 1.3333e-07 (1 in 7,500,000.0) | 6.6667e-07 (1 in 1,500,000.0) | 2.0000e-06 (1 in 500,000.0) | 4.0000e-06 (1 in 250,000.0) | 6.0000e-07 (1 in 1,666,666.7) | 1.0000e-06 (1 in 1,000,000.0) | 4.0000e-06 (1 in 250,000.0) |
| etl10k / etl40b / cvar | 0.0027 / 0.5161 / 335.53 | 0.0133 / 0.7500 / 79.88 | 0.0400 / 0.7500 / 102.87 | 0.0800 / 0.0800 / 11.35 | 0.0120 / 0.1852 / 35.94 | 0.0200 / 0.0394 / 18.03 | 0.0800 / 0.0800 / 12.35 |
| actual simulation trials | 100,000 | 100,000 | 100,000 | 100,000 | 100,000 | 100,000 | 100,000 |
| books / unique | 340,000 / 340,000 | 340,000 / 340,000 | 340,000 / 340,000 | 100,000 / 100,000 | 200,001 / 200,001 | 100,000 / 100,000 | 100,000 / 100,000 |
| minimum weight | 94,117,940 | 1 | 1,411,769,100 | 4,000,000 | 36,000,000 | 1,000,000 | 4,000,000 |

bank rescue_10: trials 100,000, organic mean 23.5764x, weighted target 24.1750x, cap 1.000e-06
bank rescue_12: trials 10,000, organic mean 33.9033x, weighted target 33.9033x, cap 1.478e-04
bank rescue_15: trials 10,000, organic mean 49.7090x, weighted target 49.7090x, cap 6.000e-04
bank inferno_10: trials 100,000, organic mean 98.1035x, weighted target 96.7000x, cap 4.000e-06
bank inferno_12: trials 10,000, organic mean 121.2065x, weighted target 121.2065x, cap 1.478e-04
bank inferno_15: trials 10,000, organic mean 156.8276x, weighted target 156.8276x, cap 6.000e-04
total seconds 2121.215, threads 8, trials 740,000, rows 1,520,001

### Fixtures
22 real-book fixtures (`math/games/piggy_firefighters/fixtures/`, synced verbatim to `server/fixtures/` by
`tools/fixtures/sync_production_fixtures.py`): the 16 of M3 plus `ante_trigger_rescue`, `ante_trigger_inferno`, `ante_win`,
`super_ante_trigger_rescue`, `super_ante_trigger_inferno`, `super_ante_win`. Their ids are publication ids of `math/publish`.

---

# M3 production math report (2026-09-25, v1.2.2 — SUPERSEDED by v1.3 above; kept as history)


**M3 PASS against GAME_CONTRACT v1.2.2, frozen at `math-freeze-v1` (`38a6c2f75d6b624eab2ae4efbcd55ed467075127`).**
Production ran on 2026-09-25 (launched 04:29:39 UTC) with the pinned interpreter `math/env/bin/python`
(Python 3.12.14, NumPy 2.2.5, SciPy 1.15.3, zstandard 0.23.0; `math/requirements-production.lock`), two workers,
and completed with exit 0: `report.json.candidate_status == "PASS"`, `source_unchanged == true`. The memory guard
(`qa/codex/math/m3-production-memory.json`) reports `COMPLETE`, `group_empty`, peak aggregate RSS **627.34 MiB** of
the 5120 MiB threshold, four processes, **5,381.2 s** elapsed (producer wall clock 5,378.9 s). The output tree
`math/games/piggy_firefighters/library/production-350k/` occupies 4,779,328 KiB (4.6 GiB) including the internal
audit artefacts (metadata, bank links, alarm trials, six canonical banks).

The independent read-only audit `qa/codex/math/audit_publication.py` (exact integer/Fraction moments, no SDK, no
simulation) returned **PASS** on 2026-09-25 — evidence `qa/codex/math/m3-audit.json`. It verified 1,840,000
actual trials, 3,630,001 publication rows, 2,180,000 canonical bank links, 76 frozen source files (tag SHA equals
the launch SHA; every current byte equals the frozen byte), every book/LUT/bank-link/trial hash, and all statistical,
route and cap gates below. Coverage boundary: compressed books are hash-checked, not replayed; event legality and
uniqueness are the frozen producer's recorded checks (`weights_status PASS`, `unique_events == rows`,
`duplicate_events == 0` in every mode and bank).

Production report SHA256: `4fccb1b7d95ebbd4c09a5509fe3c2be944016e64b3c4ba535250cb9c3a64164e`.
Index SHA256: `6d758b5ba5a070178caa43a762d19f883f9511eb2c306d8f6cb5f2f5222d82ac`.

## Promotion

The thirteen-file Engine payload (`index.json`, six `books_<mode>.jsonl.zst`, six `lookUpTable_<mode>_0.csv`) was
copied byte for byte to `math/publish/` and SHA256-compared on both sides (all thirteen equal; LUT line counts equal
the reported rows). `math/publish/MANIFEST.json` lists every file with bytes, sha256 and rows, the freeze identity,
the report/audit hashes, trial counts and the per-mode figures. LUTs, `index.json` and the manifest are committed;
the books are gitignored (`math/publish/books_*.jsonl.zst`, 3.6 GB) and regenerable from the production tree.

## Per-mode measured figures (exact from the promoted integer LUTs)

Amounts are x100 of the base bet; every LUT payout is a multiple of 10 (0.1x) within 0…1,500,000 (15,000x cap).
RTP and SD are measured against each mode's own charged cost.

| Figure | base | ante | backdraft_spins | alarm_call | rescue | inferno |
|---|---:|---:|---:|---:|---:|---:|
| cost (x base bet) | 1 | 1.5 | 50 | 12 | 18 | 90 |
| RTP (LUT exact) | 0.966999990027 | 0.966999990137 | 0.966999987505 | 0.966999990540 | 0.966999990206 | 0.966999991690 |
| SD / cost | 14.4000000006 | 9.4999999947 | 0.9775273377 | 2.4409600761 | 1.4391144104 | 1.0387386985 |
| any-win | 38.000% | 37.074% | 99.993% | 54.634% | 99.938% | 99.983% |
| regular hit (≥ 1x cost) | 16.000% | 6.159% | 34.916% | 27.206% | 30.528% | 30.388% |
| sub-hit (< 1x cost) | 22.000% | 30.915% | 65.078% | 27.429% | 69.410% | 69.595% |
| Rescue Spins probability | 1/165 = 0.0060606 | 2/165 = 0.0121212 | — | 155/300 = 0.516667 | 1 | — |
| Inferno probability | 1/2100 = 0.00047619 | 1/1050 = 0.00095238 | — | 9/300 = 0.03 | — | 1 |
| Backdraft probability | 0.0250000 (1/40, residual 5e-14) | 0.0250000 (1/40, residual 1.4e-11) | 1 (every spin) | — | — | — |
| cap probability (15,000x) | 1.3333e-7 (1 in 7.5M) | 2.6667e-7 (1 in 3.75M) | 4e-6 (1 in 250,000) | 6.3667e-7 (1 in 1.57M) | 1e-6 (1 in 1,000,000) | 4e-6 (1 in 250,000) |
| prob5k / prob10k (platform scaled) | 1.33e-7 / 1.33e-7 | 2.67e-7 / 2.67e-7 | 4e-6 / 4e-6 | 6.37e-7 / 6.37e-7 | 1e-6 / 1e-6 | 4e-6 / 4e-6 |
| etl10k (≤ 0.8) | 0.002000 | 0.004000 | 0.060000 | 0.009550 | 0.015000 | 0.060000 |
| etl40b (≤ 0.9) | 0.517790 | 0.750000 | 0.060000 | 0.157199 | 0.020232 | 0.060000 |
| cvar (≤ 800) | 378.4915 | 157.3436 | 11.3143 | 36.4702 | 15.3595 | 12.2300 |
| total integer weight | 2,310,000 × 10¹² | 2,310,000 × 10¹² | 10¹² | 300 × 10¹² | 10¹² | 10¹² |
| minimum weight | 95,732,420 | 191,464,840 | 2,817,110 | 22,370,211 | 1,000,000 | 2,485,579 |
| actual simulation trials | 200,000 nonbonus | 200,000 nonbonus | 350,000 | 350,000 weighted draws | 350,000 | 350,000 |
| publication rows / unique | 940,000 / 940,000 | 940,000 / 940,000 | 350,000 / 350,000 | 700,001 / 700,001 | 350,000 / 350,000 | 350,000 / 350,000 |
| duplicate events | 0 | 0 | 0 | 0 | 0 | 0 |
| producer seconds | 1,482.8 | 1,409.1 | 104.3 | 1,221.7 | 143.7 | 161.2 |

Exact rational RTPs from the audit: base 797774991771971549/825000000000000000, ante
11168849886085007411/11550000000000000000, backdraft_spins 241749996876209/250000000000000, alarm_call
90656249113117/93750000000000, rescue 58019999412367/60000000000000, inferno 290099997506899/300000000000000 — all
inside the contract band [0.9665, 0.9670]. Base SD 14.4000 sits in its band 13.38–15.44 (aim 14.4); ante 9.5000 in
8.79–10.14 (aim 9.5). Base any-win 38% / regular 16% / sub-hit 22% meet 33–40% / 12–18% / ≥ 15%.

Base and ante nonbonus solver fits closed at max relative error 1.03e-10 (21 iterations) and 1.89e-9 (42
iterations); the Backdraft Spins fit at 4.4e-15 (5 iterations). Derived organic buy costs recorded by the producer:
rescue 18.14x (charged 18x), inferno 90.30x (charged 90x), backdraft_spins 49.50x (charged 50x); the last fraction
is closed on the bonus books, never on the bought/natural split.

### Payload hashes (sha256, promoted bytes equal production bytes)

| Mode | `books_<mode>.jsonl.zst` | bytes | `lookUpTable_<mode>_0.csv` | bytes |
|---|---|---:|---|---:|
| base | `a99461ac74deda54e2b7187724369ea42d90de16197ed2acc4d42b85a5f8a6be` | 912,009,754 | `73bd42fbc2b9f6c25ff992ce8c9f1b34a80983bd0a7ddbde0896b082cd9e95e8` | 22,041,327 |
| ante | `bbdca092385ef6179071de3ac62bc83cd649c7555dbec1dd5adee28a597601fc` | 912,826,613 | `67909bf1b34b5c7e797ad946e8b3c7682fb94f840a87c45d54719a8d108ab235` | 22,100,950 |
| backdraft_spins | `89a0fddb65247b6e9062b0945af6f56e86980cd61447554deb0fbda88d1cdfe1` | 187,904,416 | `858f2227b762690fbfe1d42297a3566de385e0ce4449254f8bfd405748433831` | 6,900,657 |
| alarm_call | `24d548cee921eb3351724bff32766ecc708e2cf8466e7dc51395ffcf17ed5e3e` | 795,277,191 | `020e56183dbffc859a05ae5171e151d8c38fff89e935a2b5514db16939bd2381` | 14,862,375 |
| rescue | `8d6718567353e9e855aec809a7e414c50c16d3c082593e396493e560c2dcd28f` | 372,117,903 | `c4983ed172b8ef579e505a5c5543dd563c11972dd1cae24dbc7040e3e4b30e84` | 6,729,365 |
| inferno | `9d6660c9baece6dc5a16b8c9a0f637c6fba9b3ee7eeae710721ae65cb35b3d40` | 421,285,974 | `6beec9ce9b7b01523bb140c6a229b45c5911f3083eb1499c740526664eb59a96` | 6,971,875 |

`index.json` (906 bytes) lists the six modes with costs 1 / 1.5 / 50 / 12 / 18 / 90 and exactly these file names.

## Shared full-event bonus law

An awarded bonus plays exactly like the bought one: every (bonus, starting-spin class) has ONE canonical bank of
full-event books with common integer weights (budget B = 10¹² each). `rescue` and `inferno` publish their 10-spin
banks unchanged (book and LUT bytes identical to the bank files, verified). `alarm_call` composes 350,000 Rescue rows
+ 350,000 Inferno rows + one false-alarm book (id 0, weight 136 × 10¹²). `base`/`ante` embed all 740,000 bank books
behind genuine zero-line-win trigger boards after their 200,000 nonbonus books (ids 200,000…939,999). Every
composed weight equals the bank weight times its route/class factor; the audit re-derived all 2,180,000 links
(740,000 base, 740,000 ante, 700,000 alarm_call) and matched the ordered canonical event digests to each bank
report's `full_event_bank_sha256`.

| Bank | rows / trials | ordinary mean x | weighted target mean x | cap target | cap actual | base factor | ante factor | alarm factor |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| rescue_10 | 350,000 | 17.5450 | 17.4060 | 1e-6 | 1e-6 | 12,600 | 25,200 | 155 |
| rescue_12 | 10,000 | 24.7375 | 24.7375 | 1.4779e-4 | 1.47785136e-4 | 1,260 | 2,520 | — |
| rescue_15 | 10,000 | 36.2823 | 36.2823 | 6e-4 | 6e-4 | 140 | 280 | — |
| inferno_10 | 350,000 | 87.3171 | 87.0300 | 4e-6 | 4e-6 | 990 | 1,980 | 9 |
| inferno_12 | 10,000 | 107.0852 | 107.0852 | 1.4779e-4 | 1.47785136e-4 | 99 | 198 | — |
| inferno_15 | 10,000 | 137.3164 | 137.3164 | 6e-4 | 6e-4 | 11 | 22 | — |

Bank hashes (books / weights): rescue_10 `8d6718…cd28f` / `c4983e…b30e84`; rescue_12 `ed845d…18440d` /
`e51754…e4bd3fb`; rescue_15 `8001dd…0785df` / `d91e81…722a33`; inferno_10 `9d6660…b35d40` / `6beec9…b59a96`;
inferno_12 `e7714e…501e72` / `93afa3…67d9bd`; inferno_15 `34ce8e…2bff6cc` / `c5e508…a8e9d1` (full digests in
`math/publish/MANIFEST.json` → `banks`). Natural starting-class shares are 90% / 9% / 1% for 10 / 12 / 15 spins;
the resulting cap mixtures are exactly base 1/7,500,000, ante 1/3,750,000, alarm_call 191/(300 × 10⁶).

Route laws verified exactly from the LUTs: base Rescue 1/165 and Inferno 1/2100; ante 2/165 and 2/2100; Alarm Call
Rescue 155/300, Inferno 9/300, false alarm 136/300; Backdraft 1/40 in both natural modes within integerization
tolerance. Alarm Call's 350,000 actual trials (IID integer-weight draws from the composed law, with replacement)
produced 158,644 false alarms, 180,775 Rescue and 10,581 Inferno with 151,712 distinct book ids; empirical mean
11.6187x against the exact law mean 11.604x (`trials_alarm_call.csv`, sha `91bbd992…4183e9`).

## Fixtures

The sixteen real-source fixtures under `math/games/piggy_firefighters/fixtures/` (production ids: e.g.
`base_trigger_rescue` = base id 200001, `base_trigger_inferno` = base id 570001, `alarm_call_inferno` = alarm_call
id 350002) were promoted verbatim to `server/fixtures/` for the mock RGS; each fixture's `id` → promoted-LUT payout
was checked and equals its `payoutMultiplier` (16/16). They are integration evidence, not additional trials.

## What this report does not claim

No Engine ingestion, hosted RGS round settlement, frontend replay on the submitted package, device/mobile check,
external reviewer approval or star rating is established by this math evidence. Those gates remain open in
`docs/submission/MATH_HANDOFF.md`.
