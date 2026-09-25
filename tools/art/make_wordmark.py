#!/usr/bin/env python3
"""PIGGY FIREFIGHTERS wordmark (local vector lettering; no network, no paid calls).

Two lines in Alfa Slab One (SIL OFL 1.1, art-src/branding/fonts/AlfaSlabOne-Regular.ttf) with the family's
treatment - coloured faces, stepped side extrusion down-right, thick dark-brown ink outline, counters filled with
ink - and ONE accent: a fire ladder (engine-red rails, brass rungs) running behind PIGGY.
  PIGGY          hydrant-yellow face, deep engine-red extrusion
  FIREFIGHTERS   hose-cream face, brass extrusion

Outputs (RGBA, genuine alpha, exactly 1366x654 - Splash sizes it at a 0.479 aspect):
  static/assets/branding/wordmark.png          (runtime; --out redirects the assets root)
  art-src/branding/wordmark_master.png          (master copy; --master-dir redirects)
  art-src/branding/wordmark.svg                 editable master: live-text group + outlined glyph paths in groups
                                                ladder-accent / outline-extrusion / ink-outline / typography-faces
Usage: python3 tools/art/make_wordmark.py [--out <assets root>] [--master-dir art-src/branding] [--thumbnail-copy]
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from art_common import FONT, INK, P, REPO, alpha_report, out_root, prepare_out, rel, save_png  # noqa: E402

W, H, SS = 1366, 654, 3
MARGIN = 44
LINES = [
    # text, face, extrusion (front, back), extrusion depth px, ink stroke px, tracking px
    ("PIGGY", P["hydrant_yellow"], ((196, 30, 36, 255), (140, 18, 22, 255)), 18, 18, 8),
    ("FIREFIGHTERS", P["hose_cream"], (P["brass_gold"], (176, 122, 28, 255)), 16, 16, 4),
]
RAIL, RAIL_D, RUNG = P["engine_red"], (150, 20, 24, 255), P["brass_gold"]
GAP = 26  # px between the lines' ink


def advance(font, ch):
    return font.getlength(ch)


def line_width(text, size, track):
    f = ImageFont.truetype(FONT, size)
    return sum(advance(f, c) for c in text) + track * (len(text) - 1)


def layout():
    """Font sizes, glyph x positions and baselines (1x px) for both lines, shared by the PNG and the SVG."""
    avail = W - 2 * MARGIN
    t2, _, (e2, _), ex2, st2, tr2 = LINES[1]
    s2 = 100
    while line_width(t2, s2 + 1, tr2) + ex2 + 2 * st2 <= avail:
        s2 += 1
    t1, _, _, ex1, st1, tr1 = LINES[0]
    s1 = int(s2 * 1.55)
    while line_width(t1, s1, tr1) + ex1 + 2 * st1 > avail * 0.72:
        s1 -= 1
    from fontTools.ttLib import TTFont  # metrics for the cap height

    tt = TTFont(FONT)
    cap_ratio = getattr(tt["OS/2"], "sCapHeight", 0) / tt["head"].unitsPerEm or 0.7
    cap1, cap2 = s1 * cap_ratio, s2 * cap_ratio
    ladder_pad = 0.34 * cap1  # the ladder's rails stick out above / below PIGGY's caps
    total = ladder_pad + cap1 + st1 + GAP + st2 + cap2 + max(ex1, ex2) + st2
    top = (H - total) / 2 + ladder_pad
    base1 = top + cap1
    base2 = base1 + st1 + GAP + st2 + cap2
    out = []
    for (text, face, extr, depth, stroke, track), size, base in zip(LINES, (s1, s2), (base1, base2)):
        f = ImageFont.truetype(FONT, size)
        w = line_width(text, size, track)
        x = (W - w - depth) / 2
        xs = []
        for c in text:
            xs.append(x)
            x += advance(f, c) + track
        out.append({"text": text, "size": size, "xs": xs, "base": base, "cap": size * cap_ratio, "w": w,
                    "face": face, "extr": extr, "depth": depth, "stroke": stroke, "track": track})
    return out


def ladder_geom(l1):
    """Ladder behind line 1: rails above and below the cap band, rungs every ~0.42 cap."""
    x0 = l1["xs"][0] - 70
    x1 = l1["xs"][0] + l1["w"] + l1["depth"] + 70
    cap = l1["cap"]
    top_rail = (l1["base"] - cap - 0.30 * cap, l1["base"] - cap - 0.08 * cap)
    bot_rail = (l1["base"] - 0.02 * cap, l1["base"] + 0.20 * cap)
    step = 0.42 * cap
    rungs = []
    x = x0 + step * 0.5
    while x < x1 - step * 0.3:
        rungs.append(x)
        x += step
    return x0, x1, top_rail, bot_rail, rungs, 0.12 * cap


def draw_ladder(img, lay, k):
    d = ImageDraw.Draw(img)
    x0, x1, tr, br, rungs, rw = ladder_geom(lay[0])
    o = 10
    for rx in rungs:  # rungs first (behind the rails)
        d.rectangle([(rx - rw / 2 - o) * k, (tr[1] - 4) * k, (rx + rw / 2 + o) * k, (br[0] + 4) * k], fill=INK)
        d.rectangle([(rx - rw / 2) * k, tr[1] * k, (rx + rw / 2) * k, br[0] * k], fill=RUNG)
    for y0, y1 in (tr, br):
        d.rounded_rectangle([(x0 - o) * k, (y0 - o) * k, (x1 + o) * k, (y1 + o) * k], radius=int(14 * k), fill=INK)
        d.rounded_rectangle([x0 * k, y0 * k, x1 * k, y1 * k], radius=int(8 * k), fill=RAIL)
        d.rectangle([(x0 + 8) * k, (y1 - (y1 - y0) * 0.32) * k, (x1 - 8) * k, (y1 - 3) * k], fill=RAIL_D)
        d.line([((x0 + 14) * k, (y0 + 5) * k), ((x1 - 14) * k, (y0 + 5) * k)], fill=(240, 120, 110, 255), width=int(3 * k))


def make_png():
    lay = layout()
    k = SS
    img = Image.new("RGBA", (W * k, H * k), (0, 0, 0, 0))
    draw_ladder(img, lay, k)
    d = ImageDraw.Draw(img)
    for L in lay:
        f = ImageFont.truetype(FONT, L["size"] * k)
        sw = L["stroke"] * k
        front, back = L["extr"]
        for i in range(L["depth"] * k, 0, -k):
            col = back if i > L["depth"] * k // 2 else front
            for c, x in zip(L["text"], L["xs"]):
                d.text((x * k + i, L["base"] * k + i), c, font=f, fill=col, stroke_width=sw, stroke_fill=col, anchor="ls")
        for c, x in zip(L["text"], L["xs"]):
            d.text((x * k, L["base"] * k), c, font=f, fill=INK, stroke_width=sw, stroke_fill=INK, anchor="ls")
        for c, x in zip(L["text"], L["xs"]):
            d.text((x * k, L["base"] * k), c, font=f, fill=L["face"], anchor="ls")
        # counters are ink (never the extrusion or the ladder showing through)
        mask = Image.new("L", img.size, 0)
        md = ImageDraw.Draw(mask)
        for c, x in zip(L["text"], L["xs"]):
            md.text((x * k, L["base"] * k), c, font=f, fill=255, stroke_width=sw, stroke_fill=255, anchor="ls")
        m = np.array(mask) > 127
        holes = ndimage.binary_fill_holes(m) & ~m
        if holes.any():
            a = np.array(img)
            a[holes] = INK
            img = Image.fromarray(a, "RGBA")
            d = ImageDraw.Draw(img)
    img = img.resize((W, H), Image.LANCZOS)
    bb = img.getbbox()
    assert bb[0] > 4 and bb[1] > 4 and bb[2] < W - 4 and bb[3] < H - 4, ("wordmark touches the canvas edge", bb)
    return img, lay


def make_svg(lay):
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.ttLib import TTFont

    hexc = lambda c: "#%02X%02X%02X" % c[:3]  # noqa: E731
    tt = TTFont(FONT)
    upem, cmap, gs = tt["head"].unitsPerEm, tt.getBestCmap(), tt.getGlyphSet()
    groups = []
    for L in lay:
        sc = L["size"] / upem
        paths = []
        for c, x in zip(L["text"], L["xs"]):
            pen = SVGPathPen(gs)
            gs[cmap[ord(c)]].draw(pen)
            paths.append((pen.getCommands(), f"translate({x:.2f},{L['base']:.2f}) scale({sc:.5f},{-sc:.5f})"))
        groups.append((L, paths))

    def g(paths, fill, extra=""):
        return "\n".join(f'      <path transform="{t}" d="{d}" fill="{fill}" {extra}/>' for d, t in paths)

    x0, x1, tr, br, rungs, rw = ladder_geom(lay[0])
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
         "  <title>PIGGY FIREFIGHTERS wordmark</title>",
         "  <desc>Editable master (tools/art/make_wordmark.py). Font: Alfa Slab One (SIL OFL 1.1, fonts/"
         "AlfaSlabOne-Regular.ttf). Groups: live-text, ladder-accent, outline-extrusion, ink-outline, typography-faces.</desc>",
         '  <defs><style>@font-face{font-family:"Alfa Slab One";src:url("fonts/AlfaSlabOne-Regular.ttf");}'
         f'.pf-live{{font-family:"Alfa Slab One",serif;stroke:{hexc(INK)};paint-order:stroke;}}</style></defs>',
         '  <g id="live-text" display="none">']
    for L, _ in groups:
        o.append(f'    <text class="pf-live" x="{L["xs"][0]:.1f}" y="{L["base"]:.1f}" font-size="{L["size"]}" '
                 f'letter-spacing="{L["track"]}" fill="{hexc(L["face"])}" stroke-width="{2 * L["stroke"]}">{L["text"]}</text>')
    o += ["  </g>", '  <g id="ladder-accent">']
    for rx in rungs:
        o.append(f'    <rect x="{rx - rw / 2:.1f}" y="{tr[1]:.1f}" width="{rw:.1f}" height="{br[0] - tr[1]:.1f}" '
                 f'fill="{hexc(RUNG)}" stroke="{hexc(INK)}" stroke-width="10"/>')
    for y0, y1 in (tr, br):
        o.append(f'    <rect x="{x0:.1f}" y="{y0:.1f}" width="{x1 - x0:.1f}" height="{y1 - y0:.1f}" rx="8" '
                 f'fill="{hexc(RAIL)}" stroke="{hexc(INK)}" stroke-width="20"/>')
    o += ["  </g>", '  <g id="outline-extrusion">']
    for L, paths in groups:
        front, back = L["extr"]
        for off in range(L["depth"], 0, -2):
            col = hexc(back) if off > L["depth"] // 2 else hexc(front)
            o += [f'    <g transform="translate({off},{off})">',
                  g(paths, col, f'stroke="{col}" stroke-width="{2 * L["stroke"]}" stroke-linejoin="round"'), "    </g>"]
    o += ["  </g>", '  <g id="ink-outline">']
    for L, paths in groups:
        o.append(g(paths, hexc(INK), f'stroke="{hexc(INK)}" stroke-width="{2 * L["stroke"]}" stroke-linejoin="round"'))
    o += ["  </g>", '  <g id="typography-faces">']
    for L, paths in groups:
        o.append(g(paths, hexc(L["face"])))
    o += ["  </g>", "</svg>"]
    return "\n".join(o)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default="", help="assets root override")
    ap.add_argument("--master-dir", default=os.path.join(REPO, "art-src", "branding"))
    ap.add_argument("--thumbnail-copy", action="store_true", help="also write thumbnail/wordmark.png (title mock)")
    a = ap.parse_args()
    png, lay = make_png()
    dst = os.path.join(prepare_out(os.path.join(out_root(a.out), "branding")), "wordmark.png")
    outs = [dst, os.path.join(a.master_dir, "wordmark_master.png")]
    if a.thumbnail_copy:
        outs.append(os.path.join(REPO, "thumbnail", "wordmark.png"))
    for p in outs:
        save_png(png, p)
    try:
        svg = make_svg(lay)
        os.makedirs(a.master_dir, exist_ok=True)
        open(os.path.join(a.master_dir, "wordmark.svg"), "w").write(svg)
        outs.append(os.path.join(a.master_dir, "wordmark.svg"))
    except ImportError:
        print("fontTools missing (pip install fonttools): SVG master skipped")
    rep = alpha_report(png)
    print("wordmark", png.size, "sizes", [L["size"] for L in lay], "bbox", png.getbbox(),
          "alpha", rep["alpha_min"], rep["alpha_max"], "transparent %.2f" % rep["transparent"])
    for p in outs:
        print("  ->", rel(p))


if __name__ == "__main__":
    main()
