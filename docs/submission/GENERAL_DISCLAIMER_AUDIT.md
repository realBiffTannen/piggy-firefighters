# Piggy Firefighters general disclaimer audit

**PASS on text identity — the game's disclaimer paragraph is byte-identical to the last bound live read of the official template.** Audited 2026-09-25 (afternoon EDT) by lane S (submission kit). Product files were read only; nothing under `apps/` was edited.

## Official source and retrieval

The official template is the [Engine General Game Disclaimer](https://stake-engine.com/docs/approval-guidelines/general-disclaimer). Three sources bear on today's comparison; only the first two are live reads, and neither was performed by this lane's tool:

1. **Coordinator's re-scrape, 2026-09-25 11:55 EDT** (recorded in the lane brief): the live page was rendered and `rulesContent.ts` matches it verbatim, closing line "TM and © 2026 Engine.".
2. **LUCKY's bound live read, 2026-09-23 ≈19:36 EDT** (`/Users/jbull/code/lucky/docs/submission/GENERAL_DISCLAIMER_AUDIT.md`): the rendered live page's paragraph was hashed to SHA-256 `ec5f997f27964a30e2c1535fa618e173d899546d06846f44efaa1b069d75e8ee` (466 Unicode characters / 467 UTF-8 bytes).
3. **This lane's single fetch, 2026-09-25 ≈12:30 EDT**: the text extractor returned only the page's loading shell (Engine wordmark and "Loading…"), the same behaviour LUCKY's audit recorded for its first attempt. It was not retried (owner's instruction: one probe, no over-testing). It therefore adds no fresh live evidence.

The comparison below hashes the game's paragraph and matches it against source 2's bound hash; source 1 is the most recent human-visible live read and agrees.

## Exact comparison and source locations

`generalDisclaimer` in `apps/piggy_firefighters/src/game/rulesContent.ts` holds two string literals, `std` and `social`. Both were extracted and hashed:

| Check | Result |
| --- | --- |
| `std` literal SHA-256 | `ec5f997f27964a30e2c1535fa618e173d899546d06846f44efaa1b069d75e8ee` |
| `social` literal SHA-256 | `ec5f997f27964a30e2c1535fa618e173d899546d06846f44efaa1b069d75e8ee` |
| `std` == `social` | yes (the template itself is already free of cash vocabulary; the social variant needs no substitution) |
| Length | 466 Unicode characters / 467 UTF-8 bytes (the © is two bytes), no trailing newline |
| Equal to the bound live-page hash (2026-09-23) | **yes** |
| Platform name | "Engine" only; the older two-word name appears nowhere in the paragraph |
| Prohibited social terms (bet, pay, cash, money, stake, wager, buy, credit, fund, currency, deposit, withdraw) | none present in the paragraph |

The paragraph, verbatim (466 characters):

> Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Engine.

| Source location | Result | Drift |
| --- | --- | --- |
| `apps/piggy_firefighters/src/game/rulesContent.ts:27-28` — provenance comment ("VERBATIM … audited against the platform template; re-verify at every submission") | Comment only | None |
| `apps/piggy_firefighters/src/game/rulesContent.ts:30` — `generalDisclaimer.std` | Exact match | None |
| `apps/piggy_firefighters/src/game/rulesContent.ts:32` — `generalDisclaimer.social` | Exact match | None |
| `apps/piggy_firefighters/src/game/rulesContent.ts:94` — `isSocial()` floor (launch flag, jurisdiction answer or sweeps wallet) | Selects `social`; identical text either way | None |
| `apps/piggy_firefighters/src/game/rulesContent.ts:324-328` — `general` section ("GENERAL INFORMATION") uses `t(generalDisclaimer)` | Single consumer | No separate stale disclaimer |
| `apps/piggy_firefighters/src/i18n/messagesMap/en.ts` (11 lines) | `HOME`, `GAME_TITLE` only | No disclaimer entry or override |
| `apps/piggy_firefighters/src/i18n/messagesMap/index.ts:12-19` | English-only catalogue, merged UI maps filtered to game-owned locales | No game disclaimer override; no second locale can show another paragraph |
| `apps/piggy_firefighters/src/i18n/i18nDerived.ts` (13 lines) | `home`, `notTranslated` accessors only | No disclaimer accessor |
| `apps/piggy_firefighters/src/**` grep for `malfunction` / `disclaimer` (ts, svelte) | Only `rulesContent.ts` | No other source text |
| Vendored `@crashgalaxy/hud` 1.0.3 package (`node_modules/.pnpm/@crashgalaxy+hud@file+…`) grep for "Malfunction voids" | No hit | The HUD carries no default paragraph that could render in place of the game's |

## Source snapshot

SHA-256 of the complete files at the audit timestamp (HEAD `c111822`):

| File | SHA-256 |
| --- | --- |
| `apps/piggy_firefighters/src/game/rulesContent.ts` | `5bd45c5a2d957db7c58da1cde58e5828fcec9a15ad0cdaa679114bbea8fec7ee` |
| `apps/piggy_firefighters/src/i18n/i18nDerived.ts` | `8cdcfa3115e7b8f5e577fb8b10d472f6155d1ecb162026138d9ccd225ea2d843` |
| `apps/piggy_firefighters/src/i18n/messagesMap/en.ts` | `eff9ae4ba9cd81c731ef34028df2cf4d7db947af40400a6f4d0a25dcf2008221` |
| `apps/piggy_firefighters/src/i18n/messagesMap/index.ts` | `92266e32239d42261a12edaa64d5b54a9db082afb1a76e76633246107db628c8` |

## Evidence boundary

This is a source-text comparison against the last bound live read (2026-09-23) plus the coordinator's later visual re-scrape (2026-09-25 11:55 EDT). It does not establish that the final `game/dist` renders the paragraph, that it is readable on every viewport, or that Engine has approved the submission; those belong to the final-build and human gates in `PRE_UPLOAD_CHECKLIST.md`. If this lane's fetch tool is retried and the live page renders, re-hash its paragraph and record the result here; if the platform changes the template or the game's paragraph changes before submission, redo the comparison.

No product edits, build, tests, game runtime interaction, upload or paid call were performed for this audit. Only this document was written.
