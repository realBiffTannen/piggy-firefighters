#!/usr/bin/env python3
"""Compose the win-rung plaque sheet that `derive_winrungs.py signs` reads from the TWO paid plaque sheets.

The boards are drawn two sheets high (stacked in one column, ~940 px wide each) instead of five across one sheet
(~280 px each), so the 1139 px title board is only ~1.2x upscaled. This tool is local, deterministic and free: it
copies the RAW pixels of each connected piece (component mask dilated by 4 px, so the derive's single alpha clean
still sees the original anti-aliased ramp) onto one transparent canvas in the layout `signs` expects:

  top row    : boards big, huge, mega (sheet A pieces 1-3), epic, max (sheet B pieces 1-2)
  bottom row : amount bars plain (sheet A piece 4), gold (sheet B piece 3)

The MAX board comes from the accepted redraw `winrungs/rung_plaque_max_r2` (sheet B's crest was ~120 % of the body
height, which would have shrunk the board to 71 % of the title-board width on the fixed sign geometry).

Usage: python3 tools/art/compose_plaques.py [--a winrungs/rung_plaques_a] [--b winrungs/rung_plaques_b] [--max ...]
       [--write art-src/winrungs/plaques/rung_plaques_composite.png]
then:  derive_winrungs.py signs --map '{"rung_plaques": "art-src/winrungs/plaques/rung_plaques_composite.png"}'
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from art_common import REPO, load_rgba, open_rgba, rel, save_png  # noqa: E402


def pieces(name, expect):
    raw = np.array(open_rgba(name))
    clean = load_rgba(name)
    lab, _ = ndi.label(clean[:, :, 3] > 0)
    objs = []
    for i, sl in enumerate(ndi.find_objects(lab)):
        if sl is None or (lab[sl] == i + 1).sum() < 20000:
            continue
        mask = ndi.binary_dilation(lab == i + 1, iterations=4)
        ys, xs = np.nonzero(mask)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        crop = raw[y0:y1, x0:x1].copy()
        crop[~mask[y0:y1, x0:x1]] = 0
        objs.append((y0, Image.fromarray(crop, "RGBA")))
    objs.sort(key=lambda t: t[0])
    if len(objs) != expect:
        raise SystemExit(f"{name}: expected {expect} pieces, found {len(objs)}")
    return [im for _, im in objs]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--a", default="winrungs/rung_plaques_a")
    ap.add_argument("--b", default="winrungs/rung_plaques_b")
    ap.add_argument("--max", default="winrungs/rung_plaque_max_r2",
                    help="accepted single-plaque redraw that replaces sheet B's MAX board ('' keeps sheet B's)")
    ap.add_argument("--write", default=os.path.join(REPO, "art-src", "winrungs", "plaques", "rung_plaques_composite.png"))
    a = ap.parse_args()
    pa, pb = pieces(a.a, 4), pieces(a.b, 3)
    if a.max:  # MAX redraw (compact crest): one plaque alone on its sheet
        pb[1] = pieces(a.max, 1)[0]
    top, bottom = pa[:3] + pb[:2], [pa[3], pb[2]]
    gap = 120
    top_h = max(im.height for im in top)
    W = max(sum(im.width for im in top), sum(im.width for im in bottom)) + gap * 6
    H = top_h + max(im.height for im in bottom) + gap * 3
    can = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    x = gap
    for im in top:  # bottom-aligned so crests rise above the row
        can.paste(im, (x, gap + top_h - im.height))
        x += im.width + gap
    x = gap
    for im in bottom:
        can.paste(im, (x, top_h + gap * 2))
        x += im.width + gap
    os.makedirs(os.path.dirname(os.path.abspath(a.write)), exist_ok=True)
    save_png(can, a.write)
    print(f"{rel(a.write)} {can.size}: boards {[im.size for im in top]} bars {[im.size for im in bottom]}")


if __name__ == "__main__":
    main()
