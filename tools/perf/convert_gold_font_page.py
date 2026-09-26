#!/usr/bin/env python3
"""A7 (page only): interGold.png -> interGold.webp (lossless, exact, pixel-identical), rewrite the page `file=`
attribute in interGold.xml and delete the PNG. Glyph layout, size, outline and the XML metrics are untouched:
Pixi's bitmap-font loader resolves the page next to the .xml through Assets, which accepts WebP.

tools/art/make_inter_gold_font.py regenerates a PNG page (and an .xml naming it); run this step again after it.

    python3 tools/perf/convert_gold_font_page.py
"""
from __future__ import annotations

import os
import re
import sys

from PIL import Image, ImageChops

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FONT_DIR = os.path.join(ROOT, "apps", "piggy_firefighters", "static", "assets", "fonts", "interGold")
XML = os.path.join(FONT_DIR, "interGold.xml")
PNG = os.path.join(FONT_DIR, "interGold.png")
WEBP = os.path.join(FONT_DIR, "interGold.webp")


def main() -> int:
    if not os.path.exists(PNG):
        if os.path.exists(WEBP) and 'file="interGold.webp"' in open(XML, encoding="utf-8").read():
            print("already converted: interGold.webp is the page")
            return 0
        print("interGold.png missing; regenerate it with tools/art/make_inter_gold_font.py first", file=sys.stderr)
        return 1
    with Image.open(PNG) as im:
        img = im.convert("RGBA")
    img.save(WEBP, "WEBP", lossless=True, exact=True, method=6)
    with Image.open(WEBP) as back:
        assert ImageChops.difference(back.convert("RGBA"), img).getbbox() is None, "webp page is not pixel-identical"
    xml = open(XML, encoding="utf-8").read()
    new_xml, n = re.subn(r'(<page id="\d+" file=")interGold\.png(")', r"\1interGold.webp\2", xml)
    assert n == 1, f"expected one page line naming interGold.png, found {n}"
    with open(XML, "w", encoding="utf-8") as fh:
        fh.write(new_xml)
    png_b, webp_b = os.path.getsize(PNG), os.path.getsize(WEBP)
    os.remove(PNG)
    print(f"interGold.png {png_b:,} -> interGold.webp {webp_b:,} ({webp_b / png_b - 1:+.0%}), {img.width}x{img.height}; xml page line rewritten, png deleted")
    return 0


if __name__ == "__main__":
    sys.exit(main())
