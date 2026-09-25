# Piggy Firefighters — bounded pre-freeze math contract audit

Audit date: 2026-09-25 UTC. Scope: the draft game contract, Claude's initial mailbox handoff, and the latest locally available Piggy Workers donor math publication. No simulations ran; no model, donor, or production artifact was changed. This note records a read-only audit, not approval of game math or a production run.

## Findings to resolve before `math-freeze-v1`

### P1 — Backdraft Spins cannot reach the required 15,000x

`docs/GAME_CONTRACT.md:26,51–56,116–118` specifies five spins, 20 fixed lines, only the highest award on a line, highest line pay 25x, and no Rescue or multiplier. Its mathematical upper bound is therefore `5 × 20 × 25x = 2,500x`, even allowing ideal boards. This conflicts with `docs/GAME_CONTRACT.md:44` requiring the max win to be reachable in every mode, and with the 15,000x requirement in `docs/codex/FROM_CLAUDE.md:26`.

Question for Claude: amend the Backdraft mechanic and matching events/copy before freezing so a legitimate book can reach 15,000x. Weighting cannot repair this structural upper bound.

### P1 — Volatility targets use superseded donor data

`docs/GAME_CONTRACT.md:38–41` and `docs/codex/FROM_CLAUDE.md:27` use donor v2.4 SD/cost values 34.83 base and 21.46 ante. These are present in `/Users/jbull/code/piggy-builders-3/docs/MATH_V24_REPORT.md:154–171`, but donor v2.7 regenerated all modes after reducing the cap to 50,000x. Its committed `math/publish/MANIFEST.json:196–208` reports base 20.582 and ante 13.519. Fresh calculation from the committed LUTs confirms those later figures; details below.

The existing firefighter base band 22.6–26.1 would increase volatility relative to this latest locally available donor, instead of reducing it 25–35%. The contract explicitly allows re-deriving the band when later v2.7 evidence is found.

Question for Claude: bind the freeze to the v2.7 donor commit and LUT hashes below, and replace the bands with base **13.3783–15.4365** and ante **8.7874–10.1393**. Apply the same baseline correction to all design/handoff documents.

### P2 — Trigger counts above five are undefined

`docs/GAME_CONTRACT.md:24` defines a 5×3 board, `:65–66` permits ALARM/GALARM on all reels, and `:74` triggers on 3+ alarms, but `:84–85` only maps 3/4/5 alarms to 10/12/15 spins. No declared spacing restriction guarantees at most five combined alarms.

Question for Claude: define the last tier as 5+ alarms → 15 spins, or explicitly guarantee and verify that every circular three-symbol window of BR0/BRA contains at most one combined ALARM/GALARM. This is a contract ambiguity; absent model/reels prevent proving which interpretation was intended.

## Exact donor evidence and verification

Repository: `/Users/jbull/code/piggy-builders-3`.

- Verified donor v2.7 commit: `e3ff80d54c5c8033312fa6cf79661617b3ae94f7`.
- Local HEAD at inspection: `febec487c93e973b06448bf1c9854da00eb00c05`.
- Cached `origin/main` at inspection: `036f5ecbfd0a8a273f23edefc9b959c5aa1c8d32`. No fetch was performed by this audit, so this is not a claim about fresh remote state.
- The donor working checkout is dirty and its `math/` files are deleted. All publication reads used `git show <revision>:<path>`; nothing was restored or written in that repository.
- `git show HEAD:math/publish/MANIFEST.json` and `git show origin/main:math/publish/MANIFEST.json` both expose the v2.7 publication: 1,000,000 simulations per mode, packaged 2026-09-20 12:05 EDT, 50,000x cap.
- Arithmetic verification read the two LUTs and manifest at the exact v2.7 commit above. It did not read compressed books, run an optimizer, simulate rounds, or evaluate platform approval.

| Mode | Committed LUT path | Rows | Expected SHA256 from manifest | Actual SHA256 | Match |
|---|---|---:|---|---|---|
| base | `math/publish/lookUpTable_base_0.csv` | 1,000,000 | `9f799bfd1422f60f277a8ccbe96d2689f10e0ef92ce30cf155192cd8e72b31d0` | `9f799bfd1422f60f277a8ccbe96d2689f10e0ef92ce30cf155192cd8e72b31d0` | PASS |
| ante | `math/publish/lookUpTable_ante_0.csv` | 1,000,000 | `8d440220e94967070fd9d17e986e7278a16fa6130b12c073e511c632428cd1d3` | `8d440220e94967070fd9d17e986e7278a16fa6130b12c073e511c632428cd1d3` | PASS |

Each CSV row is parsed as integer `(simulation_id, weight, payout_x100)`. With `sw = Σweight`, `sx = Σ(weight × payout_x100)`, and `sx2 = Σ(weight × payout_x100²)`, the calculations were:

```text
RTP = (sx / sw) / 100 / cost
SD/cost = sqrt((sx2 / sw) - (sx / sw)^2) / 100 / cost
25–35% reduction band = [0.65 × donor_SD, 0.75 × donor_SD]
```

Integer moments were accumulated using Python arbitrary-precision integers before division; cost was read from the same manifest (base 1.0, ante 3.0).

| Mode | RTP calculated | SD/cost calculated | Lower bound (35% lower) | Upper bound (25% lower) |
|---|---:|---:|---:|---:|
| base | 0.9669999976138446 | 20.581961915119575 | 13.378275244827725 | 15.43647143633968 |
| ante | 0.9669999999999993 | 13.51900203878514 | 8.787351325210341 | 10.139251529088856 |

Reproduction method (read-only; the recorded audit executed equivalent Python):

```python
import csv, hashlib, io, json, math, subprocess

repo = '/Users/jbull/code/piggy-builders-3'
ref = 'e3ff80d54c5c8033312fa6cf79661617b3ae94f7'

def show(path):
    return subprocess.check_output(['git', '-C', repo, 'show', f'{ref}:{path}'])

manifest = json.loads(show('math/publish/MANIFEST.json'))
for mode in ('base', 'ante'):
    filename = f'lookUpTable_{mode}_0.csv'
    data = show(f'math/publish/{filename}')
    n = sw = sx = sx2 = 0
    for row in csv.reader(io.StringIO(data.decode())):
        _, weight, payout = map(int, row)
        n += 1
        sw += weight
        sx += weight * payout
        sx2 += weight * payout * payout
    cost = manifest['mode_costs'][mode]
    sd = math.sqrt(sx2 / sw - (sx / sw) ** 2) / 100 / cost
    print(mode, n, hashlib.sha256(data).hexdigest(),
          manifest['files'][filename]['sha256'],
          sx / sw / 100 / cost, sd, [sd * .65, sd * .75])
```

## Readiness boundary

At inspection, firefighter `git ls-tree --name-only HEAD math/games/` listed only `math/games/__init__.py`, and `git tag --list math-freeze-v1` returned no tag. This audit cannot verify unlanded model behavior. Production generation remains **NOT RUN**, pending the model, corrected contract, and announced freeze SHA.
