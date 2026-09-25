#!/usr/bin/env python3
"""Synthetic stand-ins for gpt-image outputs (NO API, NO spend): exercise every art tool deterministically.
Mimics the model's quirks: alpha tops out at 254, a faint coloured halo (alpha 40-120), stray edge specks."""
import json, os, sys, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

T = G = None  # set by build(root)
INK = (42, 26, 16)
RED, BRASS, YEL, CREAM, SMOKE, NAVY, FLAME = (215, 38, 43), (233, 178, 59), (245, 210, 60), (244, 233, 210), (124, 138, 160), (30, 42, 74), (255, 122, 26)
rng = np.random.default_rng(3)


def quirks(im, halo=True, specks=True):
    """alpha max 254, a glow halo, specks on the edge"""
    a = np.array(im)
    alpha = a[:, :, 3].astype(np.float32)
    if halo:
        glow = np.array(Image.fromarray(alpha.astype(np.uint8)).filter(ImageFilter.GaussianBlur(10))).astype(np.float32)
        ring = (glow > 5) & (alpha == 0)
        a[ring, 0], a[ring, 1], a[ring, 2] = 255, 200, 120
        alpha = np.where(ring, np.clip(glow * 0.45, 0, 120), alpha)
    alpha = np.minimum(alpha, 254)
    a[:, :, 3] = alpha.astype(np.uint8)
    im = Image.fromarray(a, "RGBA")
    if specks:
        d = ImageDraw.Draw(im)
        for _ in range(6):
            x, y = int(rng.integers(0, im.width - 4)), int(rng.choice([2, im.height - 6]))
            d.rectangle([x, y, x + 3, y + 3], fill=INK + (254,))
    return im


def blob(size, box, fill, shape="ellipse", ink=16, panel=None, flames=False, extra=None):
    W, H = size
    im = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x0, y0, x1, y1 = box
    if flames:
        for i in range(14):
            cx = x0 + (x1 - x0) * (i + 0.5) / 14
            h = (y1 - y0) * (0.25 + 0.2 * math.sin(i * 1.7))
            d.polygon([(cx - 40, y0 + 60), (cx, y0 - h), (cx + 40, y0 + 60)], fill=INK + (255,))
            d.polygon([(cx - 28, y0 + 60), (cx, y0 - h + 22), (cx + 28, y0 + 60)], fill=FLAME + (255,))
    getattr(d, "rounded_rectangle" if shape == "rect" else shape)(
        [x0, y0, x1, y1], **({"radius": 60} if shape == "rect" else {}), fill=INK + (255,))
    getattr(d, "rounded_rectangle" if shape == "rect" else shape)(
        [x0 + ink, y0 + ink, x1 - ink, y1 - ink], **({"radius": 50} if shape == "rect" else {}), fill=fill + (255,))
    # one hard shadow tone
    d.ellipse([x0 + (x1 - x0) * 0.55, y0 + (y1 - y0) * 0.55, x1 - ink * 2, y1 - ink * 2],
              fill=tuple(int(c * 0.72) for c in fill) + (255,))
    if extra:
        extra(d)
    if panel:
        px0, py0, px1, py1 = panel
        d.rounded_rectangle([px0 - 12, py0 - 12, px1 + 12, py1 + 12], radius=18, fill=INK + (255,))
        d.rounded_rectangle([px0, py0, px1, py1], radius=10, fill=(250, 248, 244, 255))
        d.line([px0 + 30, py0 + 30, px0 + 90, py0 + 40], fill=(214, 212, 208, 255), width=4)  # faint mark
    return quirks(im)


def save(im, rel):
    p = os.path.join(G, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p)
    return p


def symbols():
    m, mt = {}, {}
    cols = {"h1": RED, "h2": RED, "h3": BRASS, "h4": BRASS, "l1": CREAM, "l2": (160, 110, 60), "l3": (190, 140, 80), "l4": (40, 40, 40)}
    for i, (k, c) in enumerate(cols.items()):
        # deliberately NOT uniform in size: the tile step must fit every one to the same 88 % box
        w = 700 + 30 * i
        h = 760 - 25 * i
        m[k.upper()] = save(blob((1024, 1024), (512 - w // 2, 512 - h // 2, 512 + w // 2, 512 + h // 2), c,
                                 "rect" if i % 2 else "ellipse"), f"symbols/sym_sq_{k}.png")
        mt[k.upper()] = save(blob((1024, 1536), (512 - w // 2, 768 - int(h * 0.7), 512 + w // 2, 768 + int(h * 0.7)), c,
                                  "rect" if i % 2 else "ellipse"), f"symbols/sym_tall_{k}.png")
        if i < 4:  # pose B: a little bigger / tilted
            b = blob((1024, 1024), (512 - w // 2 - 30, 512 - h // 2 - 20, 512 + w // 2 + 30, 512 + h // 2 + 20), YEL,
                     "rect" if i % 2 else "ellipse")
            m[f"{k.upper()}_b"] = save(b.rotate(8, resample=Image.BICUBIC), f"symbols/sym_sq_{k}_b.png")
    panel = (300, 560, 724, 700)
    m["W"] = save(blob((1024, 1024), (170, 120, 854, 900), (240, 170, 170), "ellipse", panel=panel), "symbols/sym_sq_w.png")
    m["W_blaze"] = save(blob((1024, 1024), (170, 160, 854, 900), (240, 170, 170), "ellipse", panel=panel, flames=True), "symbols/sym_sq_w_blaze.png")
    mt["W"] = save(blob((1024, 1536), (170, 200, 854, 1300), (240, 170, 170), "ellipse", panel=(300, 800, 724, 960)), "symbols/sym_tall_w.png")
    bell = lambda d: d.ellipse([400, 250, 624, 470], fill=YEL + (255,), outline=INK + (255,), width=14)
    m["ALARM"] = save(blob((1024, 1024), (220, 180, 804, 860), RED, "rect", extra=bell), "symbols/sym_sq_alarm.png")
    m["GALARM"] = save(blob((1024, 1024), (220, 180, 804, 860), BRASS, "rect", extra=bell), "symbols/sym_sq_galarm.png")
    json.dump(m, open(os.path.join(T, "symbols.map.json"), "w"), indent=1)
    json.dump(mt, open(os.path.join(T, "symbols_tall.map.json"), "w"), indent=1)


def painting(size, base, accent, seed=0, band=None):
    """opaque 'painting': sky + ground + a few shapes; keeps busy detail out of `band` (x0,y0,x1,y1 fractions)"""
    W, H = size
    r = np.random.default_rng(seed)
    im = Image.new("RGB", size, base)
    d = ImageDraw.Draw(im)
    d.rectangle([0, int(H * 0.62), W, H], fill=tuple(int(c * 0.6) for c in base))
    for _ in range(18):
        x, y = int(r.integers(0, W)), int(r.integers(0, H))
        if band and band[0] * W < x < band[2] * W and band[1] * H < y < band[3] * H:
            continue
        s = int(r.integers(40, 180))
        d.rounded_rectangle([x, y, x + s, y + s], radius=20, fill=accent, outline=INK, width=8)
    d.ellipse([W * 0.42, H * 0.3, W * 0.58, H * 0.62], fill=(240, 170, 170), outline=INK, width=10)  # the focal "face"
    return im


def scene():
    for mood, base, acc in (("base", (58, 70, 120), RED), ("rescue", (24, 30, 60), YEL), ("inferno", (120, 30, 20), FLAME)):
        save(painting((1536, 1024), base, acc, 1), f"scene/plate_{mood}_16_9.png")
        save(painting((1024, 1536), base, acc, 2), f"scene/plate_{mood}_portrait.png")
    # truck-panel frame: outer edge inset, an opening, a top rail with a 97 px repeating rivet pattern
    im = Image.new("RGBA", (1536, 1024), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    ox0, oy0, ox1, oy1 = 40, 60, 1496, 980
    ix0, iy0, ix1, iy1 = 250, 250, 1290, 810
    d.rounded_rectangle([ox0, oy0, ox1, oy1], radius=40, fill=INK + (255,))
    d.rounded_rectangle([ox0 + 14, oy0 + 14, ox1 - 14, oy1 - 14], radius=30, fill=RED + (255,))
    d.rectangle([ix0 - 14, iy0 - 14, ix1 + 14, iy1 + 14], fill=INK + (255,))
    d.rectangle([ix0, iy0, ix1, iy1], fill=(0, 0, 0, 0))
    for x in range(ox0 + 30, ox1 - 30, 97):
        d.ellipse([x, 110, x + 30, 140], fill=BRASS + (255,), outline=INK + (255,), width=5)
    save(quirks(im, halo=False), "scene/board_frame.png")
    im = Image.new("RGBA", (1536, 1024), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([60, 120, 1476, 1000], radius=30, fill=NAVY + (254,), outline=INK + (254,), width=12)
    save(im, "scene/cell_backplate.png")
    # bay-door shutter: 1024x1536 opaque, slats with a 78 px period, a beam at the bottom
    im = Image.new("RGB", (1024, 1536), (0, 0, 0))
    d = ImageDraw.Draw(im)
    for y in range(0, 1360, 78):
        d.rectangle([0, y, 1024, y + 70], fill=(200, 60, 55))
        d.rectangle([0, y + 8, 1024, y + 20], fill=(230, 110, 100))
        d.rectangle([0, y + 70, 1024, y + 78], fill=INK)
    d.rectangle([0, 1370, 1024, 1536], fill=BRASS)
    d.rectangle([0, 1370, 1024, 1380], fill=INK)
    for x in (60, 900):
        d.ellipse([x, 1420, x + 70, 1490], outline=INK, width=12)
    save(im, "scene/shutter.png")


def cards():
    for i, k in enumerate(("ante", "backdraft", "alarm", "rescue", "inferno", "chief", "lines")):
        save(painting((1536, 1024), (40 + 20 * i, 60, 110), [RED, BRASS, YEL, SMOKE, FLAME, RED, BRASS][i], 10 + i), f"cards/card_{k}.png")
    save(painting((1536, 1024), (200, 150, 40), RED, 30, band=(0.0, 0.0, 0.5, 1.0)), "cards/maxwin_16_9.png")
    save(painting((1024, 1536), (200, 150, 40), RED, 31, band=(0.0, 0.0, 1.0, 0.42)), "cards/maxwin_portrait.png")


def winrungs():
    im = Image.new("RGBA", (1536, 1024), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cols = [RED, BRASS, SMOKE, NAVY, YEL]
    for i, c in enumerate(cols):  # five boards on the top row
        x = 30 + i * 300
        d.rounded_rectangle([x, 80, x + 270, 330], radius=30, fill=INK + (254,))
        d.rounded_rectangle([x + 14, 94, x + 256, 316], radius=22, fill=c + (254,))
        if i >= 3:  # crest above the board
            d.polygon([(x + 70, 82), (x + 135, 20), (x + 200, 82)], fill=INK + (254,))
            d.polygon([(x + 90, 80), (x + 135, 36), (x + 180, 80)], fill=BRASS + (254,))
    for j, c in enumerate(((90, 70, 60), BRASS)):  # two amount bars on the bottom row
        x = 180 + j * 620
        d.rounded_rectangle([x, 640, x + 560, 760], radius=40, fill=INK + (254,))
        d.rounded_rectangle([x + 12, 652, x + 548, 748], radius=32, fill=c + (254,))
    save(quirks(im, specks=False), "winrungs/rung_plaques.png")
    im = Image.new("RGBA", (1536, 1024), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for i in range(10):
        cx, cy = 150 + (i % 5) * 300, 260 + (i // 5) * 480
        c = [BRASS, SMOKE, RED, (90, 170, 230), BRASS, YEL, (40, 40, 40), RED, FLAME, YEL][i]
        if i in (0, 1, 5):
            d.ellipse([cx - 110, cy - 110, cx + 110, cy + 110], fill=INK + (254,))
            d.ellipse([cx - 96, cy - 96, cx + 96, cy + 96], fill=c + (254,))
            d.ellipse([cx - 40, cy - 60, cx + 10, cy - 20], fill=CREAM + (254,))
        else:
            d.rounded_rectangle([cx - 80, cy - 120, cx + 80, cy + 120], radius=30, fill=INK + (254,))
            d.rounded_rectangle([cx - 68, cy - 108, cx + 68, cy + 108], radius=22, fill=c + (254,))
    save(quirks(im), "winrungs/rung_pieces.png")


def thumbs():
    im = Image.new("RGBA", (1024, 1536), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([212, 500, 812, 1536 + 200], fill=INK + (254,))  # body bleeds off the bottom (bust)
    d.ellipse([226, 514, 798, 1536 + 186], fill=RED + (254,))
    d.ellipse([262, 170, 762, 640], fill=INK + (254,))
    d.ellipse([276, 184, 748, 626], fill=(245, 175, 175, 254))  # face
    d.chord([240, 110, 784, 420], 180, 360, fill=INK + (254,))
    d.chord([254, 124, 770, 406], 180, 360, fill=(240, 240, 235, 254))  # white helmet
    d.ellipse([470, 150, 554, 234], fill=BRASS + (254,), outline=INK + (254,), width=8)  # shield
    save(quirks(im, specks=False), "thumb/chief_hero.png")


def build(root):
    """Write every synthetic source under <root>/gen and the id->path maps under <root>. Returns the file count."""
    global T, G
    T, G = root, os.path.join(root, "gen")
    symbols(); scene(); cards(); winrungs(); thumbs()
    return sum(len(f) for _, _, f in os.walk(G))


if __name__ == "__main__":
    print("synthetic sources:", build(os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else ".")))
