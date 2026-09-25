# Completed production audit

`audit_publication.py` is independent of the game generator, SDK analysis functions and NumPy. It uses exact integer moments/Fractions, scalar tail reductions, streamed CSV joins and streamed SHA256 hashes. It never simulates a round.

**Do not run against any simulation output directory while M3 is active.** The script first requires the matching memory guard to be COMPLETE with exit 0 and an empty process group, then requires a completed PASS report. Its default approved plan is 350,000 trials per bonus mode, 10,000 per auxiliary bank and 200,000 nonbonus trials per natural mode.

After the coordinator confirms completion:

```sh
math/env/bin/python qa/codex/math/audit_publication.py \
  --output math/games/piggy_firefighters/library/production-350k \
  --guard qa/codex/math/m3-production-memory.json \
  --launch qa/codex/math/m3-launch.json \
  --audit-report qa/codex/math/m3-publication-audit.json
```

The audit compares frozen/current source bytes and runtime metadata; all six index IDs/costs/paths; LUT IDs, positive integer weights, payout denomination/cap, metadata, counts, moments, hit/routing probabilities and tails; canonical bank budgets/cap weights; every canonical link's actual weight multiplication, payout and ordered digest; and Alarm Call trial accounting. Report/hash/count mismatches or gate failures return exit 1 and a FAIL result. The audit report is written outside the publication directory.

Event files are hashed as compressed bytes. The audit does **not** replay or independently re-derive full event semantics/uniqueness; those remain explicitly identified frozen-producer evidence. It compares canonical link digests to the completed canonical-bank report. Exact CVaR uses the SDK's inclusive tied-quantile convention; a discrepancy caused by the producer's floating-point cutoff accumulation is reported rather than hidden.

Memory is bounded by the allowed payout support (at most 150,001 distinct 0.1× payout bins per mode), a compact Alarm Call payout array and selection bitset. Whole books or publication families are not retained.

Validation to date: **9 synthetic temporary-fixture tests PASS**. They cover unfinished-run refusal before output reads, mismatched launch/guard identity, exact moments and CVaR ties, malformed LUT/metadata, changed frozen source, canonical weight-factor mismatch and incorrect Alarm trial payouts and mutation of validated index bytes. No simulation output directory was read during implementation or these tests. Production audit is **NOT RUN** until the coordinator invokes it after completion.
