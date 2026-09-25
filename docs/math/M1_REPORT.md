# Piggy Firefighters M1 — accepted development candidate

**M1 PASS against GAME_CONTRACT v1.2.2.** The model was subsequently frozen at `math-freeze-v1` (`38a6c2f75d6b624eab2ae4efbcd55ed467075127`); production launched on 2026-09-25 at 04:29:39 UTC and has not yet completed. This report records development evidence only. The final supported-runtime run completed 64,000 actual simulation trials and produced 118,001 unique publication rows. All six modes pass the configured RTP, tail-risk and contract gates. The common conditional bonus law is preserved through full-event banks and exact integer mixture weights.

The authoritative development output is `/Users/jbull/code/piggy-firefighters/math/games/piggy_firefighters/library/dev-supported/`. A commit-safe report snapshot is `qa/codex/math/m1-supported-report.json`; logs and memory proof are `m1-supported.log` and `m1-supported-memory.json` in the same QA directory. Earlier `library/dev` and `library/dev-v12` outputs are superseded historical evidence.

## Final evidence

- **PASS:** 30 focused calculation, accounting, bank, solver, freeze and launch-gate tests; 13 SDK tests. Interpreter: `math/env/bin/python`, Python 3.12.14, NumPy 2.2.5, SciPy 1.15.3, zstandard 0.23.0. See `docs/math/RUNTIME.md` and `math/requirements-production.lock`.
- **PASS:** 118,001 contiguous unique publication IDs, 118,001 unique event sequences, zero duplicates, positive integer weights, valid 0.1x denomination, cap and final/spin/line accounting.
- **PASS:** 68,000 composed bonus rows checked against canonical full-event hashes; all corresponding weights are exact integer multiples of the common bank weights. Canonical hashing removes only event indices and the wrapper's `rescueStart.source`.
- **PASS:** independent persisted-file audit using exact integer/Fraction calculations confirmed all LUT rows, payouts, hashes, mixture factors and scalar statistics. This audit did not regenerate outcomes.
- **PASS:** all 76 model, reel, tool, vendored SDK and dependency-file hashes unchanged during the final run and during the subsequent fixture audit.
- **PASS:** process-group guard exit 0; aggregate RSS peak **351.125 MiB**, four processes, **159.916 seconds**, empty process group afterward. Threshold 5120 MiB, below the 6 GiB allocation.
- Final output occupies **155,448,407 bytes**. Supported report SHA256: `1d8f911c650e4395eba0ccfa3d9610edef6089102040a4e5a093487a8e734ef5`.
- **PASS:** all 16 real-source fixtures refreshed and audited, with publication ID separated from source-bank simulation seed and trigger-prefix provenance. Evidence: `qa/codex/math/m1-fixtures-audit.json`. No front-end, live RGS, device or external approval is claimed by this math report.

## Counts and weighted statistics

| Publication | Fresh trials | Published rows | Cost | RTP | SD / cost | ETL40b |
|---|---:|---:|---:|---:|---:|---:|
| base | 10,000 nonbonus | 34,000 | 1 | 0.966999990029 | 14.4000000013 | 0.5210491042 |
| ante | 10,000 nonbonus | 34,000 | 1.5 | 0.966999990001 | 9.5000000000 | 0.7500000000 |
| backdraft_spins | 10,000 | 10,000 | 50 | 0.966999993193 | 0.9976636663 | 0.0600000000 |
| alarm_call | 10,000 weighted draws | 20,001 | 12 | 0.966999990224 | 2.4116791343 | 0.1743411829 |
| rescue | 10,000 | 10,000 | 18 | 0.966999990288 | 1.4369347669 | 0.0150000000 |
| inferno | 10,000 | 10,000 | 90 | 0.966999990004 | 0.9995474858 | 0.0600000000 |

Four additional banks `(rescue,12)`, `(rescue,15)`, `(inferno,12)`, `(inferno,15)` each contain 1,000 fresh trials. Together with the two 10-spin banks they provide 24,000 bank books. Each natural publication embeds those same 24,000 books behind genuine zero-line-win trigger boards. The zero award leaves the full 15,000x cap headroom unchanged.

Alarm Call publishes both complete 10-spin banks and **one** false-alarm book. Its 10,000 actual simulation trials independently draw from that integer-weight publication law, with replacement: 4,579 false alarms, 5,134 Rescue, 287 Inferno and 4,279 distinct selected book IDs. The empirical mean was 11.53168x; the weighted law's mean is approximately 11.604x. Composed rows and repeated sampled outcomes are not represented as new independent bonus simulations.

Base any-win / regular-hit / sub-hit probabilities are **38% / 16% / 22%**. Base Rescue and Inferno rates are exactly **1/165** and **1/2100**; ante doubles each exactly. Backdraft is approximately 1/40 in each natural mode (integerization residual below 1.4e-12). Correct SD bands are base **13.38–15.44**, ante **8.79–10.14**.

## Shared bonus law and cap calibration

Each canonical bank has integer budget `B = 1,000,000,000,000`. Direct buys publish the 10-spin bank unchanged. Natural publications have total weight `2,310,000 × B`. Base bank multipliers are:

| Bonus | 10 spins | 12 spins | 15 spins |
|---|---:|---:|---:|
| Rescue | 12,600 | 1,260 | 140 |
| Inferno | 990 | 99 | 11 |

Ante uses exactly twice every multiplier. This establishes 90% / 9% / 1% starting-class shares and exact route rates. The optimizer fits **only nonbonus** rows to residual RTP, variance, hit and tail targets; it never independently tilts a natural or Alarm Call bonus book.

Alarm Call factors are Rescue155, Inferno9, false-alarm136, over `300 × B`: Rescue31/60, Inferno3%, false-alarm45⅓%. These shares follow the approved 18x/90x/12x costs.

Ten-spin bank cap probabilities are Rescue1e-6 and Inferno4e-6. The common 12-spin banks use `0.000147785136`; the common 15-spin banks use `0.0006`. Their exact integer masses, natural class frequencies and route rates imply base cap probability `1.3333333325714285e-7` (approximately 1/7.5 million), with ante exactly doubled. Alarm Call's cap probability is `6.366666666666667e-7`. Backdraft Spins uses4e-6.

These are **designed publication probabilities on legitimate source outcomes**, not empirical estimates of rare-event frequency from 10k trials. Longer-class cap calibration is explicit; there is no independently injected natural cap book or wrapper-specific reweighting. Bank-link CSVs identify every source book, canonical event hash, bank weight, mixture factor and final weight.

## Mechanics, pricing and fixtures

The model uses the local SDK's state, Book, SymbolStorage and ordinary Lines calculator, and the frontend's exact 20 one-based paylines. Backdraft's additive cell multipliers require comparing fully multiplied W-prefix/substitution candidates; that calculation is implemented locally with SDK event shapes. Every reel CSV is original deterministic source data; no donor file or shared SDK file was modified.

Rescue/Inferno run until spins expire or the ordinary cap is reached. A 10,000-spin integrity guard raises rather than accepting a truncated round. Prize credits are clipped before line credits. `douse.rescues[].rawPrize` and `winInfo.wins[].meta.uncappedWin` appear only as optional trace metadata for clipped credits. Standard win/trigger positions use padded rows; custom cells use visible-board coordinates. `buildingCleared.building` starts at completed building1.

Organic means over 9,999 ordinary main-bank trials, excluding each reserved legitimate cap path:

| Buy | Organic mean | Derived cost at target RTP | Approved cost |
|---|---:|---:|---:|
| Rescue | 17.5781178118x | 18.1779917203x | 18x |
| Inferno | 87.0945694569x | 90.0667738962x | 90x |
| Backdraft Spins | 48.4579557956x | 50.1116404309x | 50x |

Backdraft **generation weights** are cell counts3/4/5 =92/6/2, multipliers2/3/5/10 =96.5/1/1/1.5. Final book weighting may shift the published marginal frequencies; these percentages are not claimed as player-facing final probabilities. All listed values remain possible.

The Backdraft max fixture is seed0, criterion`cap`, using actual BRB stops `[0,0,0,0,0]` on each of two spins. Five middle-row x10 Blaze cells on the actual 20-line table pay9,875x before accumulation. Credited spin amounts are **987500 + 512500 = 1500000** in x100 units. It never uses an impossible full-screen Blaze state. Rescue/Inferno caps use actual FR0/FRI W/W/H1 windows at stop8 on each reel, evaluated with ordinary room, multiplier, spin and payout rules.

Fixture index: `math/games/piggy_firefighters/fixtures/index.json`; provenance: `source-record.json` beside it. All fifteen requested scenarios plus `backdraft_max_win` are present. Natural/Alarm fixtures explicitly identify source bank and simulation seed; natural prefixes identify genuine strip stops and zero prefix award.

## Runtime defect resolved and launch gates

An earlier run used unsupported Python3.14.6/NumPy2.2.5. A reproducible34,000-row expression mutated a live probability array during chained NumPy multiplication: second moment and later hit statistics were corrupted, while an extra array reference avoided the mutation. The focused regression expected SD4.601539217 and observed20.823664339 in that environment. Scalar independent audits showed the old saved LUTs were correct, but the environment was rejected for production.

The final candidate was freshly generated and solved in the supported pinned project environment. Reporting now uses integer totals and `math.fsum`; all six final book and LUT hashes also match the previous candidate. The entry point rejects incompatible interpreter/numerical versions before creating output. Production additionally requires the agreed freeze SHA, exact tracked source paths/bytes including vendored `math/src`, `math/utils` and both requirements files, explicit trial counts and a fresh output directory. Untracked/ignored additions, missing files and changed bytes fail the freeze check. Nonfinite statistics, out-of-range probabilities, contract misses, duplicates and source drift fail before installing fixtures or the consumable index; diagnostic reports remain available.

## M3 launch plan — production evidence pending

Claude/coordinator agreed counts: **350,000 actual trials per bonus mode**, **200,000 nonbonus trials each base/ante**, **10,000 per additional 12/15-spin bank**. Total **1,840,000 actual trials**. Publication rows are Rescue350,000; Inferno350,000; Backdraft350,000; Alarm700,001; base940,000; ante940,000 — **3,630,001 total rows**. Shared auxiliary/source bank files are additional internal artifacts.

The extra nonbonus support improves ordinary-board variety with relatively little cost beside bonus composition. Extrapolating the measured streaming run, allow approximately **75–110 minutes**, **4–6 GiB disk**, and conservatively **under1.5 GiB aggregate working memory**, subject to the enforced5120 MiB process-group guard. These are estimates, not production measurements; keep at least10 GiB free. Run with two workers and do not overlap other math writers.

The coordinator committed the supported model/runtime, obtained Claude's exact acknowledgment, created `math-freeze-v1` and launched this command. Live launch metadata is in `qa/codex/math/m3-launch.json`:

```sh
PF_MATH_FREEZE="$(git rev-parse 'math-freeze-v1^{commit}')"
math/env/bin/python tools/codex/run_guard.py \
  --report qa/codex/math/m3-production-memory.json \
  -- env PF_STAGE=production PF_FREEZE_SHA="$PF_MATH_FREEZE" \
  PF_SIMS=350000 PF_AUX_SIMS=10000 PF_NATURAL_SIMS=200000 PF_THREADS=2 \
  PF_OUTPUT=/Users/jbull/code/piggy-firefighters/math/games/piggy_firefighters/library/production-350k \
  /Users/jbull/code/piggy-firefighters/math/env/bin/python math/games/piggy_firefighters/run.py \
  > qa/codex/math/m3-production.log 2>&1
```

M1 is sufficient for the freeze decision, not a substitute for the requested 350k runs. M3 must measure and validate its own statistics, support, canonical equality, counts, hashes, memory and timing before publication. No completed production package or external approval is claimed here.
