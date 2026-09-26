#!/usr/bin/env python3
"""A8: subset static/assets/fonts/InterVariable.woff2 (the HUD / splash / rules face declared in src/app.html).

The full Inter Variable (352 KB, 2,937 glyphs, every script) was fetched at boot with font-display: swap, so on a
slow link the splash and HUD painted in the fallback face and swapped late. The game ships one locale (en), so the
face is cut to Latin + the punctuation, currency, arrows, maths, geometric and symbol blocks the HUD copy can reach,
PLUS every non-ASCII code point actually present in the player-facing sources (scanned below). Both variation axes
(opsz, wght) and every layout feature are kept, so the subset renders exactly as the full font for those glyphs.

The full font is not kept in the tree; it is read from git history (FULL_FONT_COMMIT) unless --source names a
file. The ranges used are recorded in tools/perf/README.md between the inter-subset markers.

    python3 tools/perf/subset_inter_font.py [--source /path/to/InterVariable.full.woff2]
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
APP = os.path.join(ROOT, "apps", "piggy_firefighters")
FONT_REL = "apps/piggy_firefighters/static/assets/fonts/InterVariable.woff2"
FONT = os.path.join(ROOT, FONT_REL)
README = os.path.join(ROOT, "tools", "perf", "README.md")
# The last commit that carried the full Inter Variable at FONT_REL.
FULL_FONT_COMMIT = "1dcbc21"

BASE_RANGES = [
    "U+0020-007F",  # Basic Latin
    "U+00A0-00FF",  # Latin-1 Supplement (×, ÷, ©, ®, £, ¥, NBSP, accented Latin)
    "U+0100-017F",  # Latin Extended-A
    "U+2000-206F",  # General punctuation (dashes, quotes, ellipsis, thin/hair spaces)
    "U+20A0-20CF",  # Currency symbols (HUD money formatting)
    "U+2100-214F",  # Letterlike symbols (™, ℓ, №)
    "U+2190-21FF",  # Arrows
    "U+2200-22FF",  # Mathematical operators (−, ×, ≤, ≥, ∞)
    "U+25A0-25FF",  # Geometric shapes (■ ● ▶ ◀ bullets and chevrons)
    "U+2600-27BF",  # Misc symbols + Dingbats (✓ ✕ ★ ☰)
]

# Player-facing sources scanned for non-ASCII code points (node_modules read-only).
SCAN_ROOTS = [
    os.path.join(APP, "src", "i18n"),
    os.path.join(APP, "src", "game", "rulesContent.ts"),
    os.path.join(APP, "src", "hud.config.ts"),
    os.path.join(APP, "src", "components"),
    os.path.join(APP, "node_modules", "@crashgalaxy", "hud", "dist"),
]
SCAN_EXT = {".ts", ".js", ".svelte", ".json", ".css", ".mjs", ".html"}


def scan_codepoints() -> set[int]:
    found: set[int] = set()
    for root in SCAN_ROOTS:
        paths = [root] if os.path.isfile(root) else [
            os.path.join(d, f) for d, _, files in os.walk(root) for f in files if os.path.splitext(f)[1] in SCAN_EXT
        ]
        for path in paths:
            try:
                text = open(path, encoding="utf-8").read()
            except (UnicodeDecodeError, OSError):
                continue
            found.update(ord(ch) for ch in text if ord(ch) > 0x7F)
    return found


def in_base(cp: int) -> bool:
    for r in BASE_RANGES:
        lo, hi = (int(x, 16) for x in r[2:].split("-"))
        if lo <= cp <= hi:
            return True
    return False


def resolve_source(source: str | None) -> str:
    if source:
        return source
    tmp = os.path.join(tempfile.gettempdir(), "InterVariable.full.woff2")
    data = subprocess.run(["git", "-C", ROOT, "show", f"{FULL_FONT_COMMIT}:{FONT_REL}"], check=True, capture_output=True).stdout
    assert len(data) > 300_000, f"git show returned {len(data)} bytes; is {FULL_FONT_COMMIT} the full font?"
    with open(tmp, "wb") as fh:
        fh.write(data)
    return tmp


def update_readme(unicodes: list[str], extra: list[int], size_before: int, size_after: int, glyphs: int) -> None:
    begin, end = "<!-- inter-subset:begin -->", "<!-- inter-subset:end -->"
    extra_txt = ", ".join(f"U+{cp:04X} ({chr(cp)})" for cp in sorted(extra)) or "none"
    block = (
        f"{begin}\n"
        f"Subset written by `tools/perf/subset_inter_font.py` (full font: git `{FULL_FONT_COMMIT}:{FONT_REL}`):\n\n"
        f"- ranges: {', '.join(BASE_RANGES)}\n"
        f"- extra code points found in the player-facing sources outside those ranges: {extra_txt}\n"
        f"- axes opsz + wght kept, `--layout-features='*'`\n"
        f"- {size_before:,} B -> {size_after:,} B, {glyphs} glyphs\n"
        f"{end}"
    )
    text = open(README, encoding="utf-8").read() if os.path.exists(README) else "# tools/perf\n"
    if begin in text and end in text:
        text = text[: text.index(begin)] + block + text[text.index(end) + len(end) :]
    else:
        text = text.rstrip("\n") + "\n\n## Inter subset (A8)\n\n" + block + "\n"
    with open(README, "w", encoding="utf-8") as fh:
        fh.write(text)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", help="full InterVariable.woff2 (default: git show %s)" % FULL_FONT_COMMIT)
    args = ap.parse_args()
    src = resolve_source(args.source)
    size_before = os.path.getsize(src)

    extra = sorted(cp for cp in scan_codepoints() if not in_base(cp))
    unicodes = BASE_RANGES + [f"U+{cp:04X}" for cp in extra]
    out = FONT + ".tmp"
    cmd = [
        sys.executable, "-m", "fontTools.subset", src,
        "--flavor=woff2", "--layout-features=*", "--unicodes=" + ",".join(unicodes),
        "--name-IDs=*", "--notdef-outline", "--recalc-bounds", f"--output-file={out}",
    ]
    subprocess.run(cmd, check=True)
    os.replace(out, FONT)
    size_after = os.path.getsize(FONT)

    from fontTools.ttLib import TTFont
    ft = TTFont(FONT)
    axes = [a.axisTag for a in ft["fvar"].axes] if "fvar" in ft else []
    glyphs = len(ft.getGlyphOrder())
    assert "wght" in axes and "opsz" in axes, f"axes lost: {axes}"
    update_readme(unicodes, extra, size_before, size_after, glyphs)
    print(f"extra code points: {', '.join(f'U+{cp:04X}' for cp in extra) or 'none'}")
    print(f"InterVariable.woff2 {size_before:,} -> {size_after:,} B ({size_after / size_before - 1:+.0%}), {glyphs} glyphs, axes {axes}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
