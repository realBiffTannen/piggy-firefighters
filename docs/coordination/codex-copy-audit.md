# Codex copy audit — lane F

Snapshot: `fee4055`, compared with `docs/GAME_CONTRACT.md` v1.2 and the theme bible. Read-only source audit of
rules/help, splash, names, HUD feature cards/config, English catalogue and related displayed win labels.
Only this audit file was created. No frontend edits, broad asset scan, browser run or new tests.
Frontend locations below are relative to `apps/piggy_firefighters/src/`; HUD dependency locations are
relative to `apps/piggy_firefighters/`. All line numbers were read from this snapshot.

## Actionable findings for Claude

1. **P1 — buy prices remain at v1.0 values.** `apps/piggy_firefighters/src/game/config.ts:22-25` supplies
   Backdraft **25x**, Alarm Call **40x**, Rescue **60x**, Inferno **300x**. These flow into the HUD through
   `game/generatedConfig.ts:17-18` and into the rules at `game/rulesContent.ts:278`. Contract v1.2 §2 instead
   records **50x target / 12x / 18x / 90x**. These v1.2 figures are **provisional, not final published costs**:
   Backdraft may change if the target cannot meet the legal cap route, and the final publication index is
   authoritative. Align the candidate with the agreed math checkpoint, then lock every displayed/charged
   amount to the final index; also replace stale cost comments at `config.ts:5-7` and `hud.config.ts:9-13`.

2. **P1 — inherited feature win labels contradict the agreed thresholds.** `game/roundTier.ts:42-51` still
   sets feature BIG/HUGE/MEGA/EPIC at **50x/100x/500x/2,000x**, used by
   `game/rescue/rescueDirector.ts:258-261,327-329`. Contract §8 (`docs/GAME_CONTRACT.md:186-191`) requires
   **15x/30x/50x/100x** for every round, client-derived, and one rung sequence on the round total.
   `game/bookEventHandlerMap.ts:99-113` still reads booked `winLevel` and can show rungs during individual
   feature spins; `roundTier.ts:99-105` also gives booked levels authority. Consolidate the agreed round-total
   thresholds before describing the displayed presentation as contract-compliant. This is a retained donor
   behavior, not merely an obsolete source comment.

3. **P2 — numeric animation-tier mapping needs one explicit decision.** Contract §8 has five named rungs
   (BIG, HUGE, MEGA, EPIC, MAX), while `docs/ANIMATION_CONTRACT.md:77` gives `tier: 0..5`, with 0 at/below bet,
   1 small, and 5 max. That leaves too few distinct values for a separate small-win tier plus all five rungs.
   Current `game/anim/rigLogic.ts:64,82` interprets tier 1 as `win`, tier >1 as `big_win`, and starts the win
   plate at tier >=2; legacy screen levels are 6..10 (`game/winLevelMap.ts:49-92`). Claude must specify the
   numeric mapping, including ordinary wins between 1x and 15x, then align broadcasts, labels, audio and rig
   consumers. No runtime threshold edits were made in this audit.

4. **P2 — Backdraft help contradicts its own feature card.** `game/rulesContent.ts:208` says Backdraft
   “never [happens] inside a feature,” but `:266` and the Backdraft Spins buy card promise it every spin.
   Scope the exclusion to **Rescue Spins and Inferno Rescue**, and explicitly preserve the guaranteed
   Backdraft Spins behavior (contract §4 vs §7).

5. **P2 — WILD explanation overstates placement/substitution.** `game/rulesContent.ts:168-169` says WILDs
   occupy all five reels “in the features”; ordinary reel WILDs remain on reels 2–5 in **Backdraft Spins**,
   while Rescue/Inferno use all five (contract §3). Distinguish ordinary WILD placement from ignited Blaze
   Wilds, which may occur on reel 1. `components/splash/copy.ts:95` also says the chief replaces “every
   symbol”; use “every paying symbol” / a social-safe “every line-win symbol” so alarms are excluded.

6. **P2 — provisional price synchronization will change the prescribed card order.** Contract §2 orders
   Backdraft, Alarm Call, Rescue, Inferno. The installed HUD sorts by price in
   `node_modules/@crashgalaxy/hud/dist/host/CrashGalaxyHud.svelte:227-229` and
   `.../components/JewelFeatureBuy.svelte:56-59`. Adopting 50/12/18/90 produces Alarm Call, Rescue, Backdraft,
   Inferno regardless of config insertion order. Agree the intended order and use a supported HUD seam or
   package change if the contract order must remain; do not alter internal mode ids or fake prices to sort.

## Copy held pending measured math

`game/rulesContent.ts:68-83` contains explicit `MEASURED TODO` trigger/route frequencies, rendered at
`:208,227,245,255`, while `:302` presents **96.70% in every mode** from a fixed target string. Contract §9
remains blank. Replace placeholders and target RTP with publication-derived figures/provenance before a
release candidate; this audit does **not** treat current provisional simulation output as published proof.
Paytable amounts at `game/config.ts:59,73-80` match the current contract table but remain subject to its
measured-math handoff. For clarity across ante/buy modes, change “total bet/play amount” in
`game/rulesContent.ts:153-154` to **base bet/base play amount**, consistent with contract §1 and `:128-129`.

## Bounded findings on terminology

The inspected player strings use **Engine**, the correct Piggy Firefighters cast and mode names, **20 fixed
left-to-right lines**, and **15,000x**. No player-visible police/construction/LUCKY/lantern/dragon wording
was found in these surfaces. The `LUCKY` mention at `rulesContent.ts:11` is a comment, not displayed copy;
`scatter` metadata for non-paying alarms is valid and does not make this a scatter-pay game. This is not an
asset-provenance, rendered-locale, full-package or animation acceptance claim.
