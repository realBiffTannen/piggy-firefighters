# Piggy Firefighters — M3 production math report (accepted, audited, promoted)

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
