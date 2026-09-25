# Piggy Firefighters — game contract (v1.2.2 — DRAFT until the MATH FREEZE commit)

v1.2.2 (2026-09-25): win-tier precedence — tier 0 whenever W ≤ S (charged cost), then base-bet floors (§8).
v1.2.1 (2026-09-25, Codex copy audit F): card order = ascending price, Backdraft scope and WILD placement wording made exact (§2–§4).
v1.2 (2026-09-25, Codex M2): shared canonical bonus banks, simulation trials vs publication rows (§2).
v1.1 (2026-09-25, after Codex's pre-freeze audit PF-20260925-02): Backdraft Spins carries additive multiplier Blaze
Wilds so 15,000x is genuinely reachable (§7); volatility bands re-derived from the donor's latest v2.7 LUTs (§2);
5+ alarms award 15 spins (§4); `backdraft` event gains an optional per-cell `mult` (§8).

Single source of truth for math, runtime book events, UI copy and help screens. Player-facing title
**PIGGY FIREFIGHTERS**; internal game id `piggy_firefighters`. Platform name in player copy is **Engine**
(never "Stake Engine"). Owner brief (2026-09-25): a **line-based** game in the Piggy family look and feel with a
firefighting theme, **max win 15,000x**, **25–35% lower volatility than piggy-builders-3**, other math at the
lanes' discretion. Numeric parameters marked *(tuned)* are owned by the math lane and become final only when
measured from published books. The contract itself (rules, ids, event names, shapes) is owned by Claude and is
FROZEN by the commit tagged `math-freeze-v1`; after that tag only §9 (measured figures) may change without a
new contract version.

## 1. Definitions

`B` base bet · `S` cost of the selected mode · `W` total gross return of the whole round including its bonus.
RTP = `E[W]/S`; volatility = `SD(W/S)`; sub-hit = `0 < W < S`; regular hit = `W >= S`; any-win = `W > 0`. All
prizes below are multiples of `B` ("x"). Book amounts are integers ×100 of `B`; LUT payouts are multiples of 10
(0.1x). Every mode pays at most **15,000x** (`wincap`); a round whose gross return would exceed it is capped
and emits `wincap`.

## 2. Modes (authoritative ids; costs derived, RTP 96.7% every mode)

| Mode id | Cost `S` | Kind (HUD) | Player title | What it is |
|---|---|---|---|---|
| `base` | 1x | default spin | — | 5 reels × 3 rows, **20 fixed lines**, left to right. Backdraft modifier. 3+ ALARM trigger Rescue Spins; ≥1 GOLDEN ALARM among them → Inferno Rescue. |
| `ante` | 1.5x | activate toggle | **ALARM BOOST** | Reel set `BRA`: **exactly 2x** the base probability of each bonus (Rescue Spins and Inferno Rescue separately); Backdraft rate unchanged. |
| `backdraft_spins` | 50x *(tuned target; M1 organic 109x — see note)* | buy card | **BACKDRAFT SPINS** | 5 spins on reel set `BRB` (no alarms); **every spin gets a Backdraft** of 3–5 Blaze Wilds *(tuned weights)*, each carrying a **multiplier x2/x3/x5/x10** *(tuned)*; a line's win is multiplied by the SUM of the Blaze Wild multipliers on it (§7). |
| `alarm_call` | 12x *(derived, M1)* | buy card | **ALARM CALL** | One card: Rescue Spins (share solved to close RTP, ≈50%) / Inferno Rescue (**3% fixed**) / **False Alarm** (the rest; pays 0). An awarded bonus plays exactly like the bought one. |
| `rescue` | 18x *(derived, M1)* | buy card | **RESCUE SPINS** | Direct buy of the tier-1 bonus, 10 spins (§5). |
| `inferno` | 90x *(derived, M1)* | buy card | **INFERNO RESCUE** | Direct buy of the tier-2 bonus, 10 spins (§6). Also reachable naturally (GOLDEN ALARM) and from Alarm Call. |

Buy costs are DERIVED: `cost = mean(bonus) / 0.967`, rounded to a whole multiple of the bet the HUD can show, then
the bonus reel densities are tuned so the mean lands on `0.967 × cost` exactly (the solver closes the last
fraction with a tilt on the bonus books, never on the bought/natural split). **Pricing decision after Codex's M1
(2026-09-25):** the organic means of the frozen rules are adopted for `rescue` (17.58x → **18x**), `inferno`
(87.10x → **90x**) and `alarm_call` (≈ **12x**, Rescue share solved, Inferno 3% fixed). `backdraft_spins` came out at
109x organically, which would price the modifier buy above the flagship; the math lane instead TUNES it toward a
**50x** target by lowering the Blaze multiplier weights (e.g. `{2: 68, 3: 24, 5: 6, 10: 2}`) and/or the ignition
weights (within 3–5), keeping `mult 10` at ≥ 1.5% weight so the cap route stays legal; if 50x ± 10% cannot be met
without breaking reachability, the derived organic cost is adopted instead and recorded here. Final costs are
whatever `math/publish/index.json` carries after the freeze; the frontend reads them from `config.ts`, which must
match that file byte for byte. Mode order in the HUD sheet = **ascending price** (the installed HUD sorts buy cards by price; no seam is
faked): Alarm Call (12x), Rescue Spins (18x), Backdraft Spins (50x), Inferno Rescue (90x); Alarm Boost is the ante
toggle. Every displayed and charged amount comes from the final `math/publish/index.json`, never from a comment.

**Bonus law and publication counts (v1.2, 2026-09-25, Codex M2).** An awarded bonus plays exactly like the bought
one: the FULL conditional event law of a bonus (every spin, douse, rescue, prize, spins added) is identical
whether it was bought, triggered naturally or awarded by Alarm Call, per **starting-spin class** (10-spin = the
bought class and every 3-alarm trigger; 12-spin = 4 alarms; 15-spin = 5+ alarms; Rescue and Inferno separately).
The math lane implements this with **shared canonical bonus banks**: one bank of bonus outcome books per (bonus,
class) with COMMON weights; `rescue`/`inferno` publish their 10-spin bank; `alarm_call` composes its rows from the
same banks; `base`/`ante` embed bank books behind their trigger boards and solve ONLY their non-bonus line
outcomes (the real 500x H1 strip windows supply the base variance). A weaker "same payout histogram" law is NOT
accepted. **Simulation trials vs publication rows:** the owner's "350,000 simulations per bonus mode" is the number
of actual simulation trials per bonus mode; publication row counts follow from the law — `alarm_call` publishes
350,000 Rescue rows + 350,000 Inferno rows + 1 False Alarm row = **700,001 rows** (one false-alarm book carries that
route's whole mass, §7), `rescue`/`inferno` 350,000 each, `backdraft_spins` 350,000, `base`/`ante` their non-bonus
books plus the embedded bank rows. Every row within a mode file is unique; the same bank book may appear in
several mode files by construction.

Targets (base and ante measured against their own cost):
- RTP exact from the LUT in `[0.9665, 0.9670]` for every mode.
- **Volatility (owner rule):** base `SD/cost` **25–35% below piggy-builders-3's latest published base figure**.
  Codex recomputed the donor v2.7 LUTs (commit `e3ff80d54c5c8033312fa6cf79661617b3ae94f7`, hashes match its
  MANIFEST): base SD/cost **20.5820**, ante **13.5190**. Target bands: **base 13.38–15.44 (aim 14.4)**, **ante
  8.79–10.14 (aim 9.5)**. (v1.0 quoted the v2.4 report's 34.83 / 21.46, which are superseded.)
- Base any-win 33–40%, regular hit (≥ 1x) 12–18%, sub-hit ≥ 15% *(tuned)*.
- Platform limits (checked by the math lane on every mode): etl10k ≤ 0.8, etl40b ≤ 0.9, cvar ≤ 800, unique
  books, payouts multiples of 0.1x, no cost multiplier above 1000x, **max win genuinely reachable in every mode by
  the rules below — no scripted book may pay the cap through an outcome the rules cannot produce.** Reachability:
  base/ante via a natural Rescue/Inferno (unbounded multiplier, buildings reset), `rescue`/`inferno` likewise,
  `alarm_call` through its bonus routes, `backdraft_spins` through multiplier Blaze Wilds (§7; Codex's proof on
  the real line table: a full-H1 `BRB` window with all five middle-row cells ignited at x10 pays 9,875x in one
  spin, so two such spins in five reach the cap — the model keeps genuine strip stops for the capped fixture).
- Natural trigger rates *(tuned targets)*: Rescue Spins 1 in 150–180 base spins; Inferno Rescue 1 in 1,800–2,500;
  Backdraft 1 in 35–50; ante exactly 2x for both bonuses. Max win: base ≈ 1 in 5–10 million; bought Inferno
  1 in 250,000; bought Rescue 1 in 1,000,000; Alarm Call = its route mix.

## 3. Symbols and paytable (20 lines, pays in x TOTAL bet per line)

Only the highest win on each line pays; wins on different lines add. W substitutes for every paying symbol and
pays as H1 on a line of its own. Lines pay left to right from reel 1.

| Id | Player name | Role | 3 / 4 / 5 *(tuned)* |
|---|---|---|---|
| `H1` | **Fire Truck** (red ladder engine) | high | 1.5 / 5 / 25 |
| `H2` | **Fire Helmet** (red, brass badge) | high | 1.0 / 3 / 12 |
| `H3` | **Axe & Halligan** (crossed) | high | 0.6 / 2 / 8 |
| `H4` | **Extinguisher** (brass) | high | 0.5 / 1.5 / 5 |
| `L1` | **Brass Nozzle** (coiled hose) | low | 0.3 / 0.8 / 2.5 |
| `L2` | **Water Bucket** | low | 0.2 / 0.6 / 2 |
| `L3` | **Ladder** | low | 0.2 / 0.5 / 1.5 |
| `L4` | **Fire Boots** | low | 0.1 / 0.4 / 1.2 |
| `W` | **Chief Hamm — WILD** (pig fire chief holding a WILD badge) | wild; substitutes for every PAYING symbol (never for ALARM/GALARM); reel W stop on reels 2–5 in base, ante and Backdraft Spins (`BR0`/`BRA`/`BRB`) and on all five reels in Rescue/Inferno (`FR0`/`FRI`); a Backdraft may ignite a Blaze Wild on ANY reel including reel 1 | 1.5 / 5 / 25 (as H1) |
| `ALARM` | **Fire Alarm** (brass alarm bell, red glow) | scatter, non-paying, base/ante reels only, all reels | — |
| `GALARM` | **Golden Alarm** (gold bell, rare) | scatter, non-paying, counts as an ALARM in every way; routes the trigger to Inferno Rescue | — |

Blaze Wilds created by a Backdraft (§4) are ordinary `W` in the evaluated board; the frontend draws them on fire.
Reel sets: `BR0` base, `BRA` ante, `BRB` Backdraft Spins (no ALARM/GALARM), `FR0` Rescue Spins, `FRI` Inferno
Rescue (no ALARM/GALARM in either; W on all five reels).

## 4. Base game

**Spin.** The reels stop; if the board shows 3+ alarms (ALARM + GALARM) the line wins are paid, then the bonus
starts (§5/§6). Otherwise a **Backdraft** may occur (probability *(tuned)*; only on a base/ante spin showing fewer
than 3 alarms; **never inside Rescue Spins or Inferno Rescue**; in Backdraft Spins it happens on EVERY spin, §7): a flash of flame sweeps the reels and **2–5 cells ignite into Blaze Wilds** — chosen uniformly among cells
that are not W, ALARM or GALARM, on any reel including reel 1; count weights `{2: 45, 3: 35, 4: 15, 5: 5}`
*(tuned)*. Line wins are then evaluated ONCE, on the board after the Backdraft. Book order: `reveal` (board as
the reels stopped) → `backdraft` → `winInfo` (positions may reference ignited cells) → `setWin` → `setTotalWin`.

**Anticipation.** The reveal carries the SDK `anticipation` array: after 2 alarms have landed with reels still
to stop, the remaining reels slow with the tension cue (docs/AUDIO_MAP.md). Never on a spin that cannot trigger.

**Trigger.** 3 / 4 / **5 or more** alarms → **10 / 12 / 15** spins (a reel window can show more than one alarm;
the math lane may space alarms ≥ 3 stops apart on the strips so at most one shows per reel, but the rule above
holds either way). No GALARM among them → Rescue Spins; ≥1 GALARM →
Inferno Rescue (more than one changes nothing). A GALARM on a spin with fewer than 3 alarms is just an alarm
that did not trigger; the frontend may glint it but never implies a near miss the book does not contain. Book
order on a trigger: `reveal` → `winInfo`/`setWin` (if any) → `setTotalWin` → `freeSpinTrigger` → `rescueStart`.

## 5. Rescue Spins (tier 1)

Above the reels stands a burning **apartment block with five rooms, one above each reel**. Every room starts at
**fire level 2**. Bonus reel set `FR0` (W on all reels, no alarms, so no retrigger). Per spin, after the reels
stop and before line wins are evaluated:
1. **Douse.** Every W on reel `r` sprays room `r`: its fire level drops by 1 (two W on one reel drop it by 2). A
   W on an already-rescued room sprays steam and does nothing more.
2. **Rescue.** A room reaching level 0 is RESCUED: a pig is carried down the ladder, the **global multiplier rises
   by +1** (starts at x1) and **+1 spin** is added.
3. **Building cleared.** When all five rooms are rescued in the same or an earlier spin, the crew moves to the
   **next building**: all rooms re-lit at level 2, **+5 spins**, multiplier kept (it never resets).
4. **Pay.** Line wins of THIS spin are multiplied by the multiplier AFTER this spin's rescues.
The bonus ends when spins run out or the cap is reached. The multiplier has no ceiling; the 15,000x cap has.

## 6. Inferno Rescue (tier 2)

Rescue Spins with: reel set `FRI` *(tuned, fewer wilds than the level-1 rooms would otherwise make it too rich)*,
rooms at **fire level 1** (one W rescues a room), **+2 multiplier** per rescue, **+1 spin** per rescue, **+5 spins**
per building cleared, and every rescued pig also carries an **instant prize** drawn from `{5: 50, 10: 30, 20: 14,
50: 5, 100: 1}` x *(tuned)*, paid immediately and NOT multiplied. Same events with `bonus: "inferno"`.
**Cap clipping.** Every amount written into a book (`douse.rescues[].prize`, line wins, `setWin`, `setTotalWin`) is
already clipped to the remaining headroom under 15,000x, so the frontend adds what the book says and never draws
an uncapped figure; raw pre-cap totals, if the math lane records them, are optional metadata the client ignores.

## 7. Alarm Call and Backdraft Spins

**Alarm Call** (`alarm_call`): `alarmCall {outcome}` is the first event after `reveal`-less round start;
`outcome ∈ {"rescue", "inferno", "falseAlarm"}`. `rescue`/`inferno` continue with `rescueStart` (source
`alarmCall`, 10 spins) exactly like the bought bonus; `falseAlarm` continues with `setTotalWin 0` → `finalWin 0`.

**Backdraft Spins** (`backdraft_spins`): `backdraftSpinsStart {spins: 5}`, then per spin `reveal` (reel set BRB,
`gameType: "freegame"`) → `backdraft` (count weights `{3: 50, 4: 35, 5: 15}` *(tuned)*; every ignited cell carries
`mult` drawn from `{2: 60, 3: 30, 5: 8, 10: 2}` *(tuned)*) → `winInfo`/`setWin` → `updateFreeSpin` → `setTotalWin`;
then `backdraftSpinsEnd {amount}` → `finalWin`. No alarms, no Rescue. **Multiplier rule:** a line's win is
multiplied by the SUM of the `mult` values of the Blaze Wilds it uses (a line using no Blaze Wild pays x1; reel W
carry no multiplier); `winInfo.meta.lineMultiplier` carries the applied sum and `winWithoutMult` the raw pay.
Base/ante Backdrafts (§4) stay plain (x1) so the base game keeps its low volatility. (A "full screen of x10 Blaze
Wilds" is impossible with 3–5 ignitions; the reachability proof is the one in §2.)

**Alarm Call uniqueness.** The False Alarm route has exactly one distinct event sequence, so the published
`alarm_call` books carry ONE false-alarm book holding that route's whole LUT probability mass; every other book
id is a distinct real bonus outcome. The frontend treats a false alarm as a normal 0-return round.

## 8. Book events (runtime contract)

Standard SDK events keep their SDK shapes (`reveal`, `winInfo`, `setWin`, `setTotalWin`, `freeSpinTrigger`,
`updateFreeSpin`, `freeSpinEnd`, `wincap`, `finalWin`). Cell positions in custom events are 0-based
`{reel, row}` on the visible 5x3 board (no padding offset). Amounts are integers ×100 of `B`.

| Event | Shape | When |
|---|---|---|
| `backdraft` | `{cells: [{reel,row,mult?}], count}` — `mult` present only in Backdraft Spins (§7) | after `reveal`, before `winInfo`, base/ante/Backdraft Spins |
| `alarmCall` | `{outcome}` | first event of an `alarm_call` round |
| `rescueStart` | `{bonus: "rescue"\|"inferno", source: "natural"\|"buy"\|"alarmCall", spins, rooms: [{reel, fire}], multiplier: 1}` | after `freeSpinTrigger` (natural) or as the first bonus event (buy / Alarm Call) |
| `douse` | `{sprays: [{reel, from, to}], rescues: [{reel, prize?}], multiplier, spinsAdded, spinsLeft}` | every bonus spin after `reveal`, before `winInfo`; may be empty (`sprays: []`) so the frontend cadence is uniform |
| `buildingCleared` | `{building, spinsAdded: 5, spinsLeft}` — `building` is the 1-based ordinal of the building JUST CLEARED (1 for the first); the next building is `building + 1` | right after the `douse` that rescued the last room |
| `rescueEnd` | `{amount, multiplier, rescued, buildings}` | after the last spin's `setTotalWin`, before `freeSpinEnd` |
| `backdraftSpinsStart` / `backdraftSpinsEnd` | `{spins}` / `{amount}` | Backdraft Spins bookends |

Event order when capped: `… winInfo → wincap → setWin → setTotalWin → (rescueEnd) → freeSpinEnd → finalWin`;
the frontend shows the capped 15,000x on every meter (the family's r6 lesson: never draw an uncapped total).

**Win-tier rule (one table for every round; denominators and precedence pinned v1.2.2).** With `B` the base bet and
`S` the charged cost of the selected mode (§1), the celebration tier is derived CLIENT-SIDE from the booked round
total `W` (family ruling 2026-09-24):
1. **Precedence — the stake check first:** if `W ≤ S` the round is **tier 0** (neutral: ordinary accounting stays
   visible — win meter, line highlights, balance — but no celebratory rig clip, audio stinger or plate). This is the
   "no celebration at or below the stake" rule of `docs/AUDIO_DESIGN_NOTES.md` applied to what the player actually
   paid: a 1.5x ante spin returning 1.2x, or a 90x Inferno buy returning 50x, is tier 0 even though 50x clears the
   MEGA floor.
2. **Then the floors, in BASE-BET units (`W/B`), never in cost units:** ordinary win (tier 1) when `S < W < 15B`;
   BIG WIN ≥ 15B (tier 2); HUGE WIN ≥ 30B (3); MEGA WIN ≥ 50B (4); EPIC WIN ≥ 100B (5); MAX WIN at the 15,000x cap
   (6) — for base rounds and for Rescue/Inferno/Backdraft Spins/Alarm Call totals alike.
The SDK `winLevel` fields in `setWin`/`freeSpinEnd` are informational; the client never reads them for
presentation. Per-spin wins inside a bonus get the ordinary win presentation and count into the running total;
rungs play once, on the round total. The numbering 0..6 is the `animBeat winTier` numbering
(`docs/ANIMATION_CONTRACT.md`).

## 9. Measured figures (math lane fills from published books)

| Figure | base | ante | backdraft_spins | alarm_call | rescue | inferno |
|---|---|---|---|---|---|---|
| RTP (LUT exact) | | | | | | |
| SD / cost | | | | | | |
| any-win / regular hit / sub-hit | | | | | | |
| Rescue Spins trigger | | | — | share | — | — |
| Inferno trigger | | | — | 3% | — | — |
| Backdraft rate | | | every spin | — | — | — |
| max win 15,000x | | | | | | |
| etl10k / etl40b / cvar | | | | | | |
| books / unique | | | | | | |
