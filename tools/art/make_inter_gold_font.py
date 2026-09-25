#!/usr/bin/env python3
"""interGold — PIGGY FIREFIGHTERS' own brass bitmap font, built from Inter Black (SIL OFL, the studio HUD's typeface).

The frontend's win numbers, line pops and meters use the BMFont family "gold" (`goldFont` in game/assets.ts:
static/assets/fonts/interGold/interGold.{xml,png}). This tool writes that font in THIS title's palette so no donor
bytes ship: the brass of the theme bible (docs/PIGGY_FIREFIGHTERS_THEME.md §1) and of the helmet shield rule in
art-src/ART_HERO.md — ink #3B2313, the brass #B8862B family (face #E3AE3C, one hard lighter band #F5D26A on the upper
half, a deeper brass side #B8862B) — flat cel, no gradient, the dark-brown ink outline. Same glyph set, same em size,
same XML layout as the donor tool it was adapted from (LUCKY's tools/art/make_inter_gold_font.py, reference only), so
every `fontFamily: 'gold'` usage keeps working with no component change.

    python3 tools/art/make_inter_gold_font.py            # writes the font + qa/art/interGold_specimen.png

Inter source: static/assets/fonts/InterVariable.woff2 (Pillow with FreeType reads WOFF2 here; `--font` overrides).
Free and local: no paid call, nothing generated.
"""
import argparse
import os

from PIL import Image, ImageChops, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
APP = os.path.join(ROOT, "apps", "piggy_firefighters")
DEFAULT_FONT = os.path.join(APP, "static", "assets", "fonts", "InterVariable.woff2")
OUT = os.path.join(APP, "static", "assets", "fonts", "interGold")
SPECIMEN = os.path.join(ROOT, "qa", "art", "interGold_specimen.png")

SIZE = 184  # px em size in the atlas: the amount is shown up to ~500 px tall on a retina desktop; mipmapped down
STROKE = round(SIZE * 0.082)  # ink outline
SIDE = (0, round(SIZE * 0.064))  # deeper-brass "side" offset (x, y)
# ---- the palette (theme bible §1 brass gold + ART_HERO shield rule) ------------------------------------------------
INK = (0x3B, 0x23, 0x13, 255)  # #3B2313 ink
BRASS_DEEP = (0xB8, 0x86, 0x2B, 255)  # #B8862B the side / shadow brass
BRASS = (0xE3, 0xAE, 0x3C, 255)  # #E3AE3C the face
BRASS_LIGHT = (0xF5, 0xD2, 0x6A, 255)  # #F5D26A one hard lighter band on the upper half of the face
CHARS = [chr(c) for c in range(32, 127)] + list("€£¥¢₹₩₽₺₫₱฿₴₦×•…–—")
PAD = 8  # gutter: the atlas is mipmapped, neighbours must not bleed in


def build(font_path: str, out_dir: str, specimen_path: str) -> None:
    font = ImageFont.truetype(font_path, SIZE)
    try:
        axes = font.get_variation_axes()
        font.set_variation_by_axes([32 if a["name"] in (b"Optical size", "Optical size") else 900 for a in axes])
    except OSError:
        pass  # a static Inter Black has no axes
    ascent, descent = font.getmetrics()
    line_h = ascent + descent + STROKE * 2 + SIDE[1]
    base = ascent + STROKE

    glyphs = []
    for ch in CHARS:
        adv = round(font.getlength(ch))
        if ch == " ":
            glyphs.append((ch, None, adv))
            continue
        l, t, r, b = font.getbbox(ch, stroke_width=STROKE)
        w, h = r - l + SIDE[0] + 2, b - t + SIDE[1] + 2
        if w <= 2 or h <= 2:
            continue
        ox, oy = -l + 1, -t + 1
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        # the deeper-brass side with its own ink outline, then the face on top
        d.text((ox + SIDE[0], oy + SIDE[1]), ch, font=font, fill=BRASS_DEEP, stroke_width=STROKE, stroke_fill=INK)
        d.text((ox, oy), ch, font=font, fill=BRASS, stroke_width=STROKE, stroke_fill=INK)
        # one hard lighter band on the upper half of the FACE only (flat cel, no gradient)
        face = Image.new("L", (w, h), 0)
        ImageDraw.Draw(face).text((ox, oy), ch, font=font, fill=255)
        band = Image.new("L", (w, h), 0)
        cut = oy + round(ascent * 0.56)
        if cut > 0:
            ImageDraw.Draw(band).rectangle((0, 0, w, min(cut, h)), fill=255)
        mask = ImageChops.multiply(face, band)
        img.paste(Image.new("RGBA", (w, h), BRASS_LIGHT), (0, 0), mask)
        glyphs.append((ch, (img, l, t), adv + 2))

    # shelf-pack into a power-of-two-wide atlas
    W = 2048
    x = y = PAD
    row_h = 0
    placed = []
    for ch, g, adv in glyphs:
        if g is None:
            placed.append((ch, 0, 0, 0, 0, 0, 0, adv))
            continue
        img, l, t = g
        if x + img.width + PAD > W:
            x = PAD
            y += row_h + PAD
            row_h = 0
        placed.append((ch, x, y, img.width, img.height, l - 1, t - 1 + STROKE, adv, img))
        x += img.width + PAD
        row_h = max(row_h, img.height)
    H = 1
    while H < y + row_h + PAD:
        H *= 2
    atlas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for p in placed:
        if len(p) == 9:
            atlas.alpha_composite(p[8], (p[1], p[2]))
    os.makedirs(out_dir, exist_ok=True)
    atlas.save(os.path.join(out_dir, "interGold.png"), optimize=True)

    def esc(c: str) -> str:
        return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}.get(c, c)

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        "<font>",
        f'  <info face="gold" size="{SIZE}" bold="1" italic="0" charset="" unicode="1" stretchH="100" smooth="1" aa="1" padding="0,0,0,0" spacing="{PAD},{PAD}" outline="{STROKE}"/>',
        f'  <common lineHeight="{line_h}" base="{base}" scaleW="{W}" scaleH="{H}" pages="1" packed="0"/>',
        "  <pages>",
        '    <page id="0" file="interGold.png"/>',
        "  </pages>",
        f'  <chars count="{len(placed)}">',
    ]
    for p in placed:
        ch, px, py, w, h, xo, yo, adv = p[:8]
        lines.append(
            f'    <char id="{ord(ch)}" x="{px}" y="{py}" width="{w}" height="{h}" xoffset="{xo}" yoffset="{yo}" xadvance="{adv}" page="0" chnl="15" letter="{esc(ch)}"/>'
        )
    lines += ["  </chars>", "</font>"]
    with open(os.path.join(out_dir, "interGold.xml"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print("interGold:", len(placed), "glyphs, atlas", atlas.size, "lineHeight", line_h, "base", base)

    # specimen for review (dusk navy ground, the board's own colour)
    spec = Image.new("RGBA", (1500, 420), (0x1E, 0x2A, 0x4A, 255))
    lut = {p[0]: p for p in placed}

    def draw(text: str, x0: float, y0: float, scale: float = 1.0) -> None:
        cx = x0
        for c in text:
            p = lut.get(c)
            if not p:
                continue
            if len(p) == 9:
                g = p[8]
                if scale != 1.0:
                    g = g.resize((max(1, round(g.width * scale)), max(1, round(g.height * scale))), Image.LANCZOS)
                spec.alpha_composite(g, (round(cx + p[5] * scale), round(y0 + p[6] * scale)))
            cx += p[7] * scale

    draw("$6.84   1,234,567.89", 30, 10)
    draw("15,000x  €25.00  ×10", 30, 150)
    draw("0123456789 $€£¥ 0.10", 30, 300, 0.6)
    os.makedirs(os.path.dirname(specimen_path), exist_ok=True)
    spec.convert("RGB").save(specimen_path)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--font", default=DEFAULT_FONT, help="Inter variable/black font file (TTF/OTF/WOFF2)")
    ap.add_argument("--out", default=OUT, help="output dir for interGold.{xml,png}")
    ap.add_argument("--specimen", default=SPECIMEN)
    args = ap.parse_args()
    build(args.font, args.out, args.specimen)
