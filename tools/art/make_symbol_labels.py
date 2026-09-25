#!/usr/bin/env python3
"""Local lettering for the special reel symbols (gpt-image cannot letter: we never generate text).

  WILD  - lettered onto the BLANK badge Chief Hamm holds (the prompt asks for a flat, empty, near-white panel;
          a red badge with --wild-style cream-on-red works too). The badge is found as the largest connected
          component of the panel colour; faint marks the model left inside it are painted out; WILD is set at
          0.70 x panel height, at most 0.88 x panel width.
  BONUS - a swallow-tail tag across the foot of the Fire Alarm / Golden Alarm (owner rule in the family: "label the
          specials so nobody has to guess"). Square tiles re-fit to the 88 % box; tall tiles compose alarm above,
          tag at the foot, at the tall box aspect.

Face: Alfa Slab One (art-src/branding/fonts/AlfaSlabOne-Regular.ttf, SIL OFL 1.1) with the family's treatment -
coloured face, thick dark-brown ink outline, a drop edge. Palette from docs/PIGGY_FIREFIGHTERS_THEME.md.

Library (imported by derive_symbols.py / derive_symbols_tall.py): text_layer, ribbon, find_panel, letter_wild,
bonus_square, bonus_tall, TAGS.

CLI:
  python3 tools/art/make_symbol_labels.py --bonus ALARM,GALARM [--out <assets root>] [--map sources.json]
        re-tiles sprites/symbolsCartoon/sym_<ID>.webp WITH the BONUS tag (run AFTER derive_symbols.py)
  python3 tools/art/make_symbol_labels.py --letter-wild <raw.png> --write <lettered.png> [--wild-style ...]
  python3 tools/art/make_symbol_labels.py --specimen <out.png>          lettering specimen for review
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from art_common import FONT, INK, P, STATIC, fit_to_box, guard_out, ink_bbox, load_clean, rel, save_png, save_webp  # noqa: E402

SS = 4  # supersample
BOX = 0.88  # square symbol ink box (derive_symbols --pad 0.068)
CREAM = P["hose_cream"]
RED = P["engine_red"]
BRASS = P["brass_gold"]
YELLOW = P["hydrant_yellow"]
DEEP_RED = (140, 18, 22, 255)
PALE_BRASS = (255, 226, 140, 255)
# BONUS tag per scatter: (tag face, tag edge / tails, lower stripe, letter fill)
TAGS = {
    "ALARM": (BRASS, DEEP_RED, PALE_BRASS, RED),       # red box + brass bell -> brass tag, red letters
    "GALARM": (RED, DEEP_RED, BRASS, CREAM),           # gold bell + gold box -> engine-red tag, cream letters
}
WILD_STYLES = {
    # panel colour mode, letter fill
    "red-on-cream": ("white", RED),
    "cream-on-red": ("red", CREAM),
}


def _font(px):
    if not os.path.exists(FONT):
        raise SystemExit(f"missing lettering face {rel(FONT)} (copy AlfaSlabOne-Regular.ttf + OFL there)")
    return ImageFont.truetype(FONT, max(4, int(px)))


def text_layer(txt, height_px, fill=CREAM, ink=INK, stroke=0.07, track=0.07, drop=0.07):
    """Letter `txt` in the slab face: drop edge, then an ink-outlined coloured face; tight RGBA crop."""
    f = _font(height_px * SS)
    sw = max(2, int(height_px * SS * stroke))
    widths = [f.getbbox(ch)[2] - f.getbbox(ch)[0] for ch in txt]
    gap = int(height_px * SS * track)
    W = sum(widths) + gap * (len(txt) - 1) + sw * 4
    H = int(height_px * SS * 1.6) + sw * 4
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x = sw * 2
    for ch, w in zip(txt, widths):
        bb = f.getbbox(ch)
        if ch != " ":
            d.text((x - bb[0], sw * 2 + int(height_px * SS * drop)), ch, font=f, fill=ink, stroke_width=sw, stroke_fill=ink)
            d.text((x - bb[0], sw * 2), ch, font=f, fill=fill, stroke_width=sw, stroke_fill=ink)
        x += (w if ch != " " else int(height_px * SS * 0.3)) + gap
    im = im.crop(im.getbbox())
    return im.resize((max(1, im.width // SS), max(1, im.height // SS)), Image.LANCZOS)


def ribbon(width, height, face, edge, stripe=None):
    """Swallow-tail tag: folded tails behind, rounded main band with a light top band and an optional stripe."""
    W, H = width * SS, height * SS
    im = Image.new("RGBA", (W, H + int(H * 0.35)), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    o = max(3, int(H * 0.09))
    tail = int(H * 0.55)
    top, bot, mid = int(H * 0.28), int(H * 1.28), int(H * 0.78)
    for side in (0, 1):
        x0 = 0 if side == 0 else W - tail * 2
        if side == 0:
            pts = [(x0 + tail // 2, mid), (x0, top), (x0 + tail * 2, top), (x0 + tail * 2, bot), (x0, bot)]
        else:
            pts = [(x0, top), (x0 + tail * 2, top), (x0 + tail * 2 - tail // 2, mid), (x0 + tail * 2, bot), (x0, bot)]
        d.polygon(pts, fill=edge, outline=INK)
        d.line(pts + [pts[0]], fill=INK, width=o)
    d.rounded_rectangle((tail, 0, W - tail, H), radius=int(H * 0.18), fill=face, outline=INK, width=o)
    hi = tuple(min(255, c + 38) for c in face[:3]) + (255,)
    d.rounded_rectangle((tail + o * 2, o * 2, W - tail - o * 2, int(H * 0.42)), radius=int(H * 0.12), fill=hi)
    if stripe:
        d.rounded_rectangle((tail + o, H - int(H * 0.2) - o, W - tail - o, H - o), radius=int(H * 0.08), fill=stripe)
    return im.resize((im.width // SS, im.height // SS), Image.LANCZOS)


def find_panel(im, mode="white", rgb=None, tol=60):
    """The blank badge: largest opaque connected component of near-white (min channel > 225) or of colour `rgb`
    (default engine red) within `tol`. Returns (mask, (x0, y0, x1, y1)) or (None, None)."""
    a = np.array(im.convert("RGBA")).astype(int)
    opaque = a[:, :, 3] > 250
    if mode == "white":
        m = (a[:, :, :3].min(axis=2) > 225) & opaque
    else:
        ref = np.array((rgb or RED)[:3])
        m = (np.abs(a[:, :, :3] - ref).sum(axis=2) < tol) & opaque
    lab, n = ndimage.label(m)
    if n == 0:
        return None, None
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    panel = lab == (int(np.argmax(sizes)) + 1)
    ys, xs = np.where(panel)
    return panel, (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)


def letter_wild(im, style="red-on-cream", word="WILD", min_area=0.004):
    """Letter WILD on the blank badge. Returns (lettered RGBA, panel box in source px)."""
    mode, fill = WILD_STYLES[style]
    panel, box = find_panel(im, mode)
    if panel is None or panel.sum() < min_area * im.width * im.height:
        raise SystemExit(f"no blank {mode} badge panel found (ask for a flat, empty, {mode} panel facing the viewer)")
    x0, y0, x1, y1 = box
    pw, ph = x1 - x0, y1 - y0
    a = np.array(im.convert("RGBA"))
    # flatten the panel: faint low-contrast marks the generator left inside the blank badge are painted out with the
    # badge's own median colour (never the badge's dark outline or its trim)
    inner = ndimage.binary_fill_holes(panel)
    col = np.median(a[panel][:, :3], axis=0)
    diff = np.abs(a[:, :, :3].astype(int) - col.astype(int)).sum(axis=2)
    lum = a[:, :, :3].astype(int).min(axis=2)
    faint = inner & ~panel & (diff < 120) & (lum > 60)
    faint = faint & ndimage.binary_erosion(inner, iterations=max(1, min(pw, ph) // 40))
    a[faint, :3] = col.astype(np.uint8)
    out = Image.fromarray(a, "RGBA")
    t = text_layer(word, ph * 0.70, fill=fill, ink=INK)
    if t.width > pw * 0.88:
        t = t.resize((int(pw * 0.88), max(1, int(t.height * pw * 0.88 / t.width))), Image.LANCZOS)
    out.alpha_composite(t, ((x0 + x1) // 2 - t.width // 2, (y0 + y1) // 2 - t.height // 2))
    print(f"  WILD: badge {box} ({style}), {int(faint.sum())} faint px flattened, lettering {t.size}")
    return out, box


def _tag_composite(obj, canvas_w, canvas_h, obj_h_frac, tag_w_frac, tag_h_frac, text_frac, colours):
    face, edge, stripe, letters = colours
    can = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    k = min(canvas_w / obj.width, canvas_h * obj_h_frac / obj.height)
    o = obj.resize((max(1, round(obj.width * k)), max(1, round(obj.height * k))), Image.LANCZOS)
    can.alpha_composite(o, ((canvas_w - o.width) // 2, 0))
    rb = ribbon(int(canvas_w * tag_w_frac), int(canvas_w * tag_h_frac), face, edge, stripe)
    ry = canvas_h - rb.height
    sh = Image.new("RGBA", can.size, (0, 0, 0, 0))
    sh.alpha_composite(rb, ((canvas_w - rb.width) // 2, ry + max(2, canvas_w // 128)))
    sh = sh.filter(ImageFilter.GaussianBlur(max(2, canvas_w // 170)))
    dark = Image.new("RGBA", can.size, (20, 10, 5, 255))
    dark.putalpha(sh.split()[3].point(lambda v: int(v * 0.35)))
    can.alpha_composite(dark)
    can.alpha_composite(rb, ((canvas_w - rb.width) // 2, ry))
    t = text_layer("BONUS", canvas_w * text_frac, fill=letters)
    if t.width > rb.width * 0.72:
        t = t.resize((int(rb.width * 0.72), max(1, int(t.height * rb.width * 0.72 / t.width))), Image.LANCZOS)
    can.alpha_composite(t, ((canvas_w - t.width) // 2, ry + int(canvas_w * tag_h_frac * 0.5) - t.height // 2 - 1))
    return can


def bonus_square(obj, sym_id, tile=384, box=BOX):
    """Alarm above (~80 % of the height), BONUS tag over its foot, the pair re-fitted to the 88 % box."""
    obj = obj.crop(ink_bbox(obj))
    S = 1024
    can = _tag_composite(obj, S, S, 0.80, 0.94, 0.235, 0.132, TAGS[sym_id])
    return fit_to_box(can, tile, tile, box, box)[0]


def bonus_tall(obj, sym_id, tw=384, th=500, fill_w=0.86, fill_h=0.92):
    """Tall tile: alarm across the width at the top, BONUS tag at the foot, composed at the box aspect."""
    obj = obj.crop(ink_bbox(obj))
    S = 1024
    CH = int(S * (th * fill_h) / (tw * fill_w))
    # the alarm spans the width (at most 0.95 x S tall); the tag sits at the foot with air between them
    can = _tag_composite(obj, S, CH, 0.95 * S / CH, 0.94, 0.26, 0.146, TAGS[sym_id])
    return fit_to_box(can, tw, th, fill_w, fill_h)[0]


def specimen(out):
    rows = [text_layer("WILD", 120, fill=RED), text_layer("WILD", 120, fill=CREAM), text_layer("BONUS", 90, fill=RED)]
    tags = []
    for sid in TAGS:
        face, edge, stripe, letters = TAGS[sid]
        rb = ribbon(420, 100, face, edge, stripe)
        t = text_layer("BONUS", 52, fill=letters)
        rb.alpha_composite(t, ((rb.width - t.width) // 2, 50 - t.height // 2))
        tags.append(rb)
    items = rows + tags
    W = max(i.width for i in items) + 40
    H = sum(i.height + 20 for i in items) + 20
    sheet = Image.new("RGBA", (W * 2, H), (0, 0, 0, 255))
    for col, bg in enumerate(((244, 240, 232, 255), (30, 42, 74, 255))):
        panel = Image.new("RGBA", (W, H), bg)
        y = 20
        for i in items:
            panel.alpha_composite(i, (20, y))
            y += i.height + 20
        sheet.alpha_composite(panel, (col * W, 0))
    save_png(sheet.convert("RGB"), out)
    print("specimen ->", rel(out), sheet.size)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--bonus", default="", help="comma list of ALARM,GALARM to re-tile with the BONUS tag")
    ap.add_argument("--tall", action="store_true", help="--bonus also writes the tall symT_ tiles")
    ap.add_argument("--map", default="", help="symbol source map json (same as derive_symbols.py --map)")
    ap.add_argument("--out", default="", help="assets root override (default apps/piggy_firefighters/static/assets)")
    ap.add_argument("--letter-wild", default="", help="raw W master to letter")
    ap.add_argument("--write", default="", help="output PNG for --letter-wild")
    ap.add_argument("--wild-style", default="red-on-cream", choices=sorted(WILD_STYLES))
    ap.add_argument("--specimen", default="")
    a = ap.parse_args()
    if a.specimen:
        specimen(a.specimen)
    if a.letter_wild:
        im = load_clean(a.letter_wild)
        out, box = letter_wild(im, a.wild_style)
        dst = a.write or os.path.splitext(a.letter_wild)[0] + "_lettered.png"
        save_png(out, dst)
        print("lettered ->", rel(dst), "badge", box)
    if a.bonus:
        import derive_symbols as ds  # the same source map and output naming as the derive step

        root = os.path.abspath(a.out) if a.out else STATIC
        srcs = ds.load_map(a.map)
        for sid in [s.strip().upper() for s in a.bonus.split(",") if s.strip()]:
            if sid not in TAGS:
                raise SystemExit(f"--bonus takes {sorted(TAGS)}, got {sid}")
            if sid not in srcs or not ds.exists_src(srcs[sid]):
                print(f"  {sid}: no source ({srcs.get(sid)}), skipped")
                continue
            obj = load_clean(srcs[sid])
            sq = bonus_square(obj, sid)
            dst = os.path.join(root, "sprites", "symbolsCartoon", f"sym_{sid}.webp")
            guard_out(dst)
            save_webp(sq, dst, lossless=True, quality=100)
            print(f"  {sid}: BONUS tag -> {rel(dst)} ink {ink_bbox(sq)}")
            if a.tall:
                tl = bonus_tall(obj, sid)
                dstt = os.path.join(root, "sprites", "symbolsCartoonTall", f"symT_{sid}.webp")
                save_webp(tl, dstt, lossless=True, quality=100)
                print(f"  {sid}: BONUS tag tall -> {rel(dstt)} ink {ink_bbox(tl)}")
            ds.mark_manifest(os.path.join(root, "sprites", "symbolsCartoon", "manifest.json"), f"sym_{sid}", "bonus_tag")
            if a.tall:
                ds.mark_manifest(os.path.join(root, "sprites", "symbolsCartoonTall", "manifest.json"), f"symT_{sid}", "bonus_tag")


if __name__ == "__main__":
    main()
