#!/usr/bin/env python3
"""Derive the Spine LOD pages (A3): static/assets/spine/<rig>/ (the rig lane's exports, READ-ONLY here) ->
static/assets/spine-lod/<rig>/.

For every rig two atlases are written next to their pages:

  <rig>.atlas        the original atlas text with ONLY the page filename lines changed .png -> .webp, plus
                     <page>.webp: WebP lossless (exact), pixel-identical to the PNG.
  <rig>.half.atlas   the same text with the page lines -> <page>.half.webp and EVERY OTHER LINE INTACT: the
                     `size:` line stays at the export size, so spine-core's normalised region UVs
                     (TextureAtlas: u = x / page.width) still map onto the half-size page. <page>.half.webp is
                     exactly half the width and height, lossless, resized in premultiplied space (RGBa -> LANCZOS
                     -> RGBA) so no dark fringe bleeds out of the transparent surround.

The .json skeletons are not copied: game/assets.ts keeps pointing at the originals and only swaps the atlas.
The rig exports themselves are never touched. Re-run after any rig re-export.

    python3 tools/perf/derive_spine_lod.py            # all rigs
    python3 tools/perf/derive_spine_lod.py pf_chief   # one rig
"""
from __future__ import annotations

import os
import sys

from PIL import Image, ImageChops

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
APP = os.path.join(ROOT, "apps", "piggy_firefighters")
SRC = os.path.join(APP, "static", "assets", "spine")
OUT = os.path.join(APP, "static", "assets", "spine-lod")
RIGS = ("pf_chief", "pf_dog", "pf_rookie", "pf_rescued")


def page_line_indices(lines: list[str]) -> list[int]:
    """A page block starts with the page filename on a line of its own (first line, or after a blank line)."""
    out = []
    for i, line in enumerate(lines):
        if line.strip().lower().endswith(".png") and (i == 0 or lines[i - 1].strip() == ""):
            out.append(i)
    return out


def rewrite_atlas(text: str, suffix: str) -> tuple[str, list[str]]:
    lines = text.split("\n")
    pages = []
    for i in page_line_indices(lines):
        name = lines[i].strip()
        pages.append(name)
        lines[i] = name[: -len(".png")] + suffix
    return "\n".join(lines), pages


def save_lossless(img: Image.Image, path: str) -> int:
    img.save(path, "WEBP", lossless=True, exact=True, method=6)
    return os.path.getsize(path)


def half_premultiplied(img: Image.Image) -> Image.Image:
    w, h = img.size
    assert w % 2 == 0 and h % 2 == 0, (w, h)
    return img.convert("RGBa").resize((w // 2, h // 2), Image.LANCZOS).convert("RGBA")


def derive(rig: str) -> dict:
    src_dir = os.path.join(SRC, rig)
    out_dir = os.path.join(OUT, rig)
    os.makedirs(out_dir, exist_ok=True)
    atlas_path = os.path.join(src_dir, f"{rig}.atlas")
    with open(atlas_path, encoding="utf-8") as fh:
        text = fh.read()

    full_text, pages = rewrite_atlas(text, ".webp")
    half_text, pages2 = rewrite_atlas(text, ".half.webp")
    assert pages == pages2 and pages, (rig, pages)

    with open(os.path.join(out_dir, f"{rig}.atlas"), "w", encoding="utf-8") as fh:
        fh.write(full_text)
    with open(os.path.join(out_dir, f"{rig}.half.atlas"), "w", encoding="utf-8") as fh:
        fh.write(half_text)

    stats = {"rig": rig, "pages": [], "png": 0, "full": 0, "half": 0}
    for page in pages:
        png_path = os.path.join(src_dir, page)
        stem = page[: -len(".png")]
        with Image.open(png_path) as im:
            img = im.convert("RGBA")
        full_path = os.path.join(out_dir, f"{stem}.webp")
        half_path = os.path.join(out_dir, f"{stem}.half.webp")
        full_bytes = save_lossless(img, full_path)
        # pixel identity check on the lossless page
        with Image.open(full_path) as back:
            diff = ImageChops.difference(back.convert("RGBA"), img).getbbox()
        assert diff is None, f"{full_path} is not pixel-identical to {png_path}"
        half_bytes = save_lossless(half_premultiplied(img), half_path)
        with Image.open(half_path) as back:
            assert back.size == (img.width // 2, img.height // 2), (half_path, back.size)
        png_bytes = os.path.getsize(png_path)
        stats["pages"].append((page, img.size, png_bytes, full_bytes, half_bytes))
        stats["png"] += png_bytes
        stats["full"] += full_bytes
        stats["half"] += half_bytes
    return stats


def verify(rig: str) -> None:
    """Page count, names and `size:` lines of both derived atlases match the source atlas."""
    src = open(os.path.join(SRC, rig, f"{rig}.atlas"), encoding="utf-8").read().split("\n")
    src_pages = page_line_indices(src)
    for suffix, atlas in ((".webp", f"{rig}.atlas"), (".half.webp", f"{rig}.half.atlas")):
        lines = open(os.path.join(OUT, rig, atlas), encoding="utf-8").read().split("\n")
        assert len(lines) == len(src), (atlas, "line count")
        for i, line in enumerate(src):
            if i in src_pages:
                expected = line.strip()[: -len(".png")] + suffix
                assert lines[i].strip() == expected, (atlas, i, lines[i], expected)
                assert os.path.exists(os.path.join(OUT, rig, expected)), (atlas, expected, "page missing")
                assert lines[i + 1].startswith("size:") and lines[i + 1] == src[i + 1], (atlas, i + 1, "size line")
            else:
                assert lines[i] == line, (atlas, i, "line changed")


def main(argv: list[str]) -> int:
    rigs = tuple(argv) or RIGS
    totals = {"png": 0, "full": 0, "half": 0}
    for rig in rigs:
        st = derive(rig)
        verify(rig)
        for page, size, png_b, full_b, half_b in st["pages"]:
            print(f"{rig}/{page:<20} {size[0]}x{size[1]}  png {png_b:>9,}  webp {full_b:>9,} ({full_b / png_b - 1:+.0%})  half {half_b:>9,} ({half_b / png_b - 1:+.0%})")
        for k in totals:
            totals[k] += st[k]
    print(f"TOTAL png {totals['png']:,}  lossless webp {totals['full']:,}  half {totals['half']:,}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
