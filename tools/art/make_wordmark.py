#!/usr/bin/env python3
"""PIGGY FIREFIGHTERS wordmark (local vector lettering; no network, no paid calls).

Two lines in Alfa Slab One (SIL OFL 1.1, art-src/branding/fonts/AlfaSlabOne-Regular.ttf) with the family's
treatment - coloured faces, stepped side extrusion down-right, thick dark-brown ink outline, counters filled with
ink - and ONE accent (--accent): `shield` (default) = a fire-helmet front shield (brass rim, engine-red panel, cream
cross, one hard shadow tone, no lettering) standing left of PIGGY; `ladder` = a fire ladder running behind PIGGY.
  PIGGY          hydrant-yellow face, deep engine-red extrusion
  FIREFIGHTERS   hose-cream face, brass extrusion

Outputs (RGBA, genuine alpha, exactly 1366x654 - Splash sizes it at a 0.479 aspect):
  static/assets/branding/wordmark.png          (runtime; --out redirects the assets root)
  static/assets/branding/wordmark_small.webp   (half size 683x327, lossless WEBP, for small UI/loader use)
  art-src/branding/wordmark_master.png          (master copy; --master-dir redirects)
  art-src/branding/wordmark.svg                 editable master: live-text group + outlined glyph paths in groups
                                                shield-accent|ladder-accent / outline-extrusion / ink-outline /
                                                typography-faces
Usage: python3 tools/art/make_wordmark.py [--accent shield|ladder] [--out <assets root>] [--master-dir art-src/branding]
       [--thumbnail-copy]
"""
import argparse
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from art_common import FONT, INK, P, REPO, alpha_report, out_root, prepare_out, rel, save_png, save_webp  # noqa: E402

W, H, SS = 1366, 654, 3
MARGIN = 44
LINES = [
    # text, face, extrusion (front, back), extrusion depth px, ink stroke px, tracking px
    ("PIGGY", P["hydrant_yellow"], ((196, 30, 36, 255), (140, 18, 22, 255)), 18, 18, 8),
    ("FIREFIGHTERS", P["hose_cream"], (P["brass_gold"], (176, 122, 28, 255)), 16, 16, 4),
]
RAIL, RAIL_D, RUNG = P["engine_red"], (150, 20, 24, 255), P["brass_gold"]
GAP = 26  # px between the lines' ink
ACCENT = "shield"  # set from --accent in main()
SHIELD_H, SHIELD_W, SHIELD_GAP = 1.40, 0.84, 34  # x cap1, x shield height, px between shield ink and P ink
SHIELD_RIM, SHIELD_RIM_D = P["brass_gold"], (176, 122, 28, 255)
SHIELD_PANEL, SHIELD_PANEL_D = P["engine_red"], (150, 20, 24, 255)


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
        if ACCENT == "shield" and text == LINES[0][0]:  # centre the group [shield | gap | PIGGY]
            sw = SHIELD_W * SHIELD_H * size * cap_ratio
            x = (W - (sw + SHIELD_GAP + w + depth)) / 2 + sw + SHIELD_GAP
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


def shield_poly(l1, inset=0.0, n=48):
    """Helmet front shield left of line 1: arched top, straight flanks, curved taper to a bottom point (1x px)."""
    cap = l1["cap"]
    h = SHIELD_H * cap
    w = SHIELD_W * h
    cx = l1["xs"][0] - SHIELD_GAP - w / 2
    top = l1["base"] - cap / 2 - h / 2 - 0.08 * cap
    w2, h2 = w / 2 - inset, h - 2 * inset
    t0 = top + inset
    arch = 0.16 * h2
    pts = []
    for i in range(n + 1):  # top arch, left to right
        a = math.pi * i / n
        pts.append((cx - w2 * math.cos(a), t0 + arch * (1 - math.sin(a))))
    flank = t0 + arch + 0.40 * h2
    pts.append((cx + w2, flank))
    for i in range(1, n + 1):  # right curve to the point
        t = i / n
        pts.append((cx + w2 * (1 - t) ** 1.35, flank + (t0 + h2 - flank) * math.sin(t * math.pi / 2)))
    for i in range(n - 1, -1, -1):  # mirror up the left side
        t = i / n
        pts.append((cx - w2 * (1 - t) ** 1.35, flank + (t0 + h2 - flank) * math.sin(t * math.pi / 2)))
    pts.append((cx - w2, flank))
    return pts, cx, top, w, h


def cross_poly(cx, cy, r):
    """Four-arm flared cross (fire-service emblem shape, no lettering)."""
    pts = []
    for q in range(4):
        a = q * math.pi / 2 - math.pi / 2
        for da, rr in ((-0.16, 0.30), (-0.34, 1.0), (0.0, 0.80), (0.34, 1.0), (0.16, 0.30)):
            pts.append((cx + r * rr * math.cos(a + da), cy + r * rr * math.sin(a + da)))
    return pts


def shield_layers(l1):
    """(polygon, fill) back to front, shared by the PNG and the SVG."""
    outer, cx, top, w, h = shield_poly(l1)
    rim = 0.13 * w
    inner, *_ = shield_poly(l1, inset=rim)
    out = [(outer, SHIELD_RIM)]
    # the one hard shadow tone: right half of the rim
    out.append(([p for p in outer if p[0] >= cx] + [(cx, top + h), (cx, top)],
                SHIELD_RIM_D))
    out.append((inner, SHIELD_PANEL))
    out.append(([p for p in inner if p[0] >= cx] + [(cx, top + h - rim), (cx, top + rim)], SHIELD_PANEL_D))
    cy = top + h * 0.47
    out.append((cross_poly(cx, cy, 0.30 * w), P["hose_cream"]))
    return out, outer, inner, cross_poly(cx, cy, 0.30 * w)


def _stroke_mask(size, pts, half, outside_only=False):
    """Pixels within `half` px of a polygon's boundary (or inside it plus `half` px when outside_only), from a
    distance transform: PIL's wide polylines leave hairline notches at dense vertices, this never does."""
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).polygon(pts, fill=255)
    inside = np.array(m) > 127
    out_d = ndimage.distance_transform_edt(~inside)
    if outside_only:
        return out_d <= half
    return (out_d <= half) & ~(inside & (ndimage.distance_transform_edt(inside) > half))


def draw_shield(img, lay, k):
    layers, outer, inner, cross = shield_layers(lay[0])
    kp = lambda pts: [(x * k, y * k) for x, y in pts]  # noqa: E731
    stroke = lay[0]["stroke"]
    a = np.array(img)
    a[_stroke_mask(img.size, kp(outer), stroke * k, outside_only=True)] = INK
    img.paste(Image.fromarray(a, "RGBA"))
    d = ImageDraw.Draw(img)
    for pts, col in layers:
        d.polygon(kp(pts), fill=col)
    a = np.array(img)
    a[_stroke_mask(img.size, kp(inner), 3.5 * k)] = INK
    a[_stroke_mask(img.size, kp(cross), 3 * k)] = INK
    img.paste(Image.fromarray(a, "RGBA"))


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
    (draw_shield if ACCENT == "shield" else draw_ladder)(img, lay, k)
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

    o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
         "  <title>PIGGY FIREFIGHTERS wordmark</title>",
         f"  <desc>Editable master (tools/art/make_wordmark.py). Font: Alfa Slab One (SIL OFL 1.1, fonts/"
         "AlfaSlabOne-Regular.ttf). Groups: live-text, {ACCENT}-accent, outline-extrusion, ink-outline, typography-faces.</desc>",
         '  <defs><style>@font-face{font-family:"Alfa Slab One";src:url("fonts/AlfaSlabOne-Regular.ttf");}'
         f'.pf-live{{font-family:"Alfa Slab One",serif;stroke:{hexc(INK)};paint-order:stroke;}}</style></defs>',
         '  <g id="live-text" display="none">']
    for L, _ in groups:
        o.append(f'    <text class="pf-live" x="{L["xs"][0]:.1f}" y="{L["base"]:.1f}" font-size="{L["size"]}" '
                 f'letter-spacing="{L["track"]}" fill="{hexc(L["face"])}" stroke-width="{2 * L["stroke"]}">{L["text"]}</text>')
    o += ["  </g>", f'  <g id="{ACCENT}-accent">']
    if ACCENT == "shield":
        layers, outer, inner, cross = shield_layers(lay[0])
        pp = lambda pts: " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)  # noqa: E731
        o.append(f'    <polygon points="{pp(outer)}" fill="{hexc(INK)}" stroke="{hexc(INK)}" '
                 f'stroke-width="{2 * lay[0]["stroke"]}" stroke-linejoin="round"/>')
        for pts, col in layers:
            o.append(f'    <polygon points="{pp(pts)}" fill="{hexc(col)}"/>')
        o.append(f'    <polygon points="{pp(inner)}" fill="none" stroke="{hexc(INK)}" stroke-width="7"/>')
        o.append(f'    <polygon points="{pp(cross)}" fill="none" stroke="{hexc(INK)}" stroke-width="6"/>')
    else:
        x0, x1, tr, br, rungs, rw = ladder_geom(lay[0])
    for rx in (rungs if ACCENT == "ladder" else []):
        o.append(f'    <rect x="{rx - rw / 2:.1f}" y="{tr[1]:.1f}" width="{rw:.1f}" height="{br[0] - tr[1]:.1f}" '
                 f'fill="{hexc(RUNG)}" stroke="{hexc(INK)}" stroke-width="10"/>')
    for y0, y1 in ((tr, br) if ACCENT == "ladder" else ()):
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
    ap.add_argument("--accent", choices=["shield", "ladder"], default="shield")
    ap.add_argument("--thumbnail-copy", action="store_true", help="also write thumbnail/wordmark.png (title mock)")
    a = ap.parse_args()
    global ACCENT
    ACCENT = a.accent
    png, lay = make_png()
    dst = os.path.join(prepare_out(os.path.join(out_root(a.out), "branding")), "wordmark.png")
    outs = [dst, os.path.join(a.master_dir, "wordmark_master.png")]
    if a.thumbnail_copy:
        outs.append(os.path.join(REPO, "thumbnail", "wordmark.png"))
    for p in outs:
        save_png(png, p)
    small = os.path.join(os.path.dirname(dst), "wordmark_small.webp")
    save_webp(png.resize((W // 2, H // 2), Image.LANCZOS), small, lossless=True)
    outs.append(small)
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
