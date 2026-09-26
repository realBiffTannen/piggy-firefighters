# tools/perf — derived performance assets

Mechanical derivations for the low-end quality tiers (`src/game/quality.svelte.ts` selects them; nothing here
changes gameplay, copy, math or art content). Sources are never modified: the rig exports under
`static/assets/spine/**` and the art masters under `static/assets/**` stay as the art / rig lanes shipped them.
Every script is deterministic and idempotent; re-run the matching step after its source changes.

| step | script | source (read-only) | writes |
| --- | --- | --- | --- |
| A3 Spine LOD | `derive_spine_lod.py` | `static/assets/spine/<rig>/<rig>.atlas` + PNG pages (pf_chief, pf_dog, pf_rookie, pf_rescued) | `static/assets/spine-lod/<rig>/<rig>.atlas` + `<page>.webp` (lossless, pixel-identical) and `<rig>.half.atlas` + `<page>.half.webp` (half width/height, lossless, `size:` line intact so spine-core's normalised UVs still map) |
| H-06 LOD textures | `derive_lod_textures.py` | the 19 plates listed in the script (environment, win-rung signs, max-win cards, three splash cards, Inferno buy card) | `static/assets/lod/<same relative path>` at `LOD_SCALE` 0.625 (premultiplied LANCZOS; lossless in -> lossless out, lossy in -> WebP q90) and regenerates `src/game/lod.generated.ts` (`LOD_SCALE`, sorted `LOD_FILES`) |
| A8 Inter subset | `subset_inter_font.py` | the full Inter Variable from git history (`1dcbc21`), or `--source` | `static/assets/fonts/InterVariable.woff2` (subset, both axes, all layout features); the ranges block below |
| A7 gold page | `convert_gold_font_page.py` | `static/assets/fonts/interGold/interGold.png` | `interGold.webp` (lossless, pixel-identical), the `file=` page attribute in `interGold.xml`; deletes the PNG |

Requirements: Python 3 with Pillow (12.x) and fontTools (4.6x). Run from anywhere:

```sh
python3 tools/perf/derive_spine_lod.py
python3 tools/perf/derive_lod_textures.py
python3 tools/perf/subset_inter_font.py
python3 tools/perf/convert_gold_font_page.py
```

## Notes per step

- **A3.** The `.json` skeletons are not copied; `game/assets.ts` keeps the original skeleton and only swaps the atlas
  path (`spine-lod/<rig>/<rig>.atlas` everywhere, `<rig>.half.atlas` when the static tier is not `high`).
  spine-pixi loads pages through Pixi's texture loader (WebP accepted); region UVs come from the atlas `size:`
  line, which the half atlas keeps at the export size. The script re-checks page count, page names and `size:`
  lines of both derived atlases against the source atlas and that the lossless page decodes pixel-identical.
  Re-run after every rig re-export (the rig lane owns `static/assets/spine/**`).
- **H-06.** Only plates without pixel meta and without a lossless master are derived; facades, board frame, cells
  and symbols are NOT in the list (their meta is in pixels of the master). Alpha is kept (the signs).
- **A8.** The scan for extra code points covers `src/i18n/**`, `src/game/rulesContent.ts`, `src/hud.config.ts`,
  `src/components/**` and `node_modules/@crashgalaxy/hud/dist/**` (read-only). A new locale or new symbols in the
  copy: re-run (the scan picks them up) and check the range list below still covers what the HUD formats.
- **A7.** `tools/art/make_inter_gold_font.py` regenerates `interGold.png` and an `.xml` naming it: run
  `convert_gold_font_page.py` again after it, otherwise the build ships the PNG page (437 KB vs 184 KB).

## Inter subset (A8)

<!-- inter-subset:begin -->
Subset written by `tools/perf/subset_inter_font.py` (full font: git `1dcbc21:apps/piggy_firefighters/static/assets/fonts/InterVariable.woff2`):

- ranges: U+0020-007F, U+00A0-00FF, U+0100-017F, U+2000-206F, U+20A0-20CF, U+2100-214F, U+2190-21FF, U+2200-22FF, U+25A0-25FF, U+2600-27BF
- extra code points found in the player-facing sources outside those ranges: U+2500 (─)
- axes opsz + wght kept, `--layout-features='*'`
- 352,240 B -> 133,908 B, 1108 glyphs
<!-- inter-subset:end -->
