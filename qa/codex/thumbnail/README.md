# Saved thumbnail handoff gate

From the repository root, using the already installed Python/Pillow:

```sh
python3 tools/codex/thumbnail/validate_thumbnail.py
python3 tools/codex/thumbnail/validate_thumbnail.py --json > qa/codex/thumbnail/saved-files-report.json
python3 -m unittest discover -s tools/codex/thumbnail -p 'test_*.py'
```

`--directory /absolute/final/folder` selects another delivered folder. The tool
reads images and metadata without editing them. Exit codes: **0 PASS** (file
structure only), **1 FAIL** (invalid delivered file), **2 BLOCKED** (missing
required delivery or Pillow). A malformed file takes precedence over missing
files, while each file retains its individual status. No package installation,
generation call, source-image copy or image conversion is performed.

The six exact PNG names and master dimensions come from
`thumbnail/instructions.md`: portrait 1536 × 2048; landscape 2048 × 1152.
Foregrounds must really be `RGBA`, with at least 1% fully transparent pixels and
1% fully opaque pixels. This generous structural threshold rejects empty,
opaque, uniformly translucent and token-transparency files. It does **not**
prove that the cutout is good. Backgrounds must really be `RGB`. Previews may be
`RGB` or completely opaque `RGBA`. The checker decodes/verifies the saved PNGs,
reports alpha statistics/bounds and computes actual SHA-256s.
Backgrounds and previews also reject PNG `tRNS` transparency metadata, including
an unused transparent color key: an `RGB` mode label alone does not prove opacity.

`instructions.md` must be readable and nonempty. `source-record.json` must be
readable, valid, nonempty JSON object/array. This checks **provenance presence**
only: no record schema has been agreed, and JSON validity cannot establish
authenticity. Do not infer full provenance approval from structural PASS.

## Required manual review when Claude delivers

- Compare both final PNG pairs/previews with the approved original character:
  exactly one pig firefighter, no extra silhouettes/reflections/animals; same
  face, anatomy, costume, emblem and illustrated style across both ratios.
- Inspect face, hands, prop, helmet, silhouette and alpha edges at full size on
  light, dark and intended-color backgrounds. Reject matte spill, checkerboard
  pixels, clipping, halos and smeared detail. Essential features stay 5% inside
  the canvas; full-canvas layers align at `(0, 0)` without independent cropping.
- Review the composed portrait at **120 × 160** and landscape at **320 × 180**.
  Confirm immediate face/helmet readability, deliberate recomposition, hero on
  the landscape right, quiet title space, and clean rounded-corner crops.
- Confirm one dominant background hue with at most two related supporting
  tones by artistic inspection, not a naive pixel-color count. Record the final
  background RGB/hex value, verify sRGB delivery, and keep wordmark separate.
- Verify each preview represents its matching aligned foreground/background.
  No baked title, approval/rating claim, watermark or donor imagery may appear.
- Read the actual source record: model/tool, prompts, references, original
  source paths, generation owner and final hashes. Compare the final hashes
  with this checker's measured SHA-256s; verify provenance against the accepted
  originals and record the handoff commit. Never put credentials in the record.
- Fill the measured delivery record in `thumbnail/instructions.md` through its
  owning lane. Human art approval and platform-editor upload remain separate.

Current artwork status: **BLOCKED** until the six final PNGs and source record
arrive. Art quality, character count, palette, provenance authenticity and
platform acceptance: **NOT RUN**. See `saved-files-report.json` for the current
on-disk measurements.

Validator verification: **PASS**, seven focused synthetic tests under the locally
installed Pillow 12.2.0. They cover useful alpha, uniform/token alpha, RGB versus
RGBA channels, saved RGB+tRNS transparency, opaque previews, exact dimensions, disguised/truncated PNGs and
missing/empty provenance. Fixtures exist only in temporary directories.
