#!/usr/bin/env python3
"""Derive the PIGGY FIREFIGHTERS win-celebration textures. Subcommands (default: all, in this order):

  titles  art-src/winrungs/titles/title_<rung>.png (+ _outlined.svg, _live.svg): BIG WIN / HUGE WIN / MEGA WIN /
          EPIC WIN / MAX WIN lettered LOCALLY in Alfa Slab One (never generated): gold face, stepped brass side
          extrusion, dark-brown ink outline, one per-rung accent keyline (theme palette; flame orange = win FX).
  signs   winrungs/signs/<rung>.webp 1200x728 on the family's flat_manifest geometry (title board centre (600,338.3)
          size 1139.4x364.3, amount plank centre (600,634.2) size 901.7x187.2) + signs/flat_manifest.json. Boards and
          amount bars come from ONE transparent sheet (default: the local composite written by compose_plaques.py from
          the paid sheets winrungs/rung_plaques_a + _b + rung_plaque_max_r2: five blank boards on
          the top row in rung order big, huge, mega, epic, max; two blank amount bars below: plain, gold). A board
          taller than the board rect (a crest) is width-fitted and bottom-aligned. Hung on procedural brass chains.
          The amount is runtime text; the title is the baked local lettering from `titles`.
  pieces  winrungs/pieces/<name>_sheet.webp (cell 128, 8 cols, 24 frames = 1024x384, 24 fps) + <name>.json from one
          transparent "5-by-2 grid with wide empty gaps" sheet (default winrungs/rung_pieces), split by connected
          components row by row. Flat things (coins, badge) flip about their axis; the rest tumble in-plane with a
          little foreshortening (2D spin, the family's accepted route).
  coins   winrungs/coins/coin_sheet.webp 1024x512 (32 frames of 128) + coin_sheet.json (TexturePacker-style Pixi
          sheet, animation "coin") for the `coins` spriteSheet (WinCoins) - its own dir, so it never collides with
          the 24-frame tumbling piece winrungs/pieces/coin_sheet.webp.
  fx      winrungs/fx/{flare_horizontal 1024x128, ring_shockwave 512, glint_4point 256, dust_puff 256,
          light_ray_wedge 256x512}.webp - procedural warm-white additive textures (tinted per rung at runtime).

Usage: python3 tools/art/derive_winrungs.py [titles signs pieces coins fx] [--map m.json] [--out <assets root>]
       [--titles-dir art-src/winrungs/titles] [--plank-w 901.7] [--items coin,silver_coin,...]
"""
import argparse
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from art_common import (FONT, INK, P, QA, REPO, components, contact_sheet, exists_src, load_rgba,  # noqa: E402
                        out_root, piece_image, prepare_out, rel, save_png, save_webp, sort_grid, src_path, write_json)

RUNGS = ["big", "huge", "mega", "epic", "max"]
TITLES = {"big": "BIG WIN", "huge": "HUGE WIN", "mega": "MEGA WIN", "epic": "EPIC WIN", "max": "MAX WIN"}
CREAM, GOLD_FACE = P["hose_cream"], (250, 206, 96, 255)
BRASS, BRASS_D, BRASS_DEEP = P["brass_gold"], (190, 136, 34, 255), (150, 100, 20, 255)
ACCENT = {"big": P["hydrant_yellow"], "huge": P["engine_red"], "mega": P["dusk_navy"],
          "epic": P["flame_orange"], "max": P["flame_orange"]}
FACE_FOR = {r: GOLD_FACE for r in ["big", "huge", "mega", "epic", "max"]}  # gold face, dark ink outline (boards carry dark panels)
EXTR_FOR = {"big": 18, "huge": 18, "mega": 18, "epic": 26, "max": 26}
TITLES_DIR = os.path.join(REPO, "art-src", "winrungs", "titles")
SIGN_W, SIGN_H = 1200, 728
BOARD = [600.0, 338.3, 1139.4, 364.3]  # cx, cy, w, h
PLANK = [600.0, 634.2, 901.7, 187.2]
ITEMS = ["coin", "silver_coin", "helmet", "droplet", "nozzle", "badge", "boot", "hydrant_cap", "ember", "spark"]
FLIP = {"coin", "silver_coin", "badge"}
CREST = ("epic", "max")  # boards whose painting carries a crest above the plaque (width-fit, bottom-aligned)
CELL, COLS, FRAMES, FPS = 128, 8, 24, 24
DEFAULT_MAP = {"rung_plaques": "art-src/winrungs/plaques/rung_plaques_composite.png",  # tools/art/compose_plaques.py
               "rung_pieces": "winrungs/rung_pieces"}


# ------------------------------------------------------------------------------------------------ titles
def title_png(text, accent, face=CREAM, extr=18, px=200, track=4, ss=3):
    f = ImageFont.truetype(FONT, px * ss)
    W, H = int(len(text) * px * 0.9 + 400) * ss, int(px * 2.2) * ss
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    widths = [d.textbbox((0, 0), ch, font=f)[2] - d.textbbox((0, 0), ch, font=f)[0] if ch != " " else int(px * 0.3 * ss)
              for ch in text]
    total = sum(widths) + track * ss * (len(text) - 1)
    x, top, chars = W / 2 - total / 2, int(px * 0.45) * ss, []
    for ch, w in zip(text, widths):
        bb = d.textbbox((0, 0), ch, font=f)
        chars.append((ch, x - bb[0]))
        x += w + track * ss
    stroke = max(6, int(px * 0.05)) * ss
    for ch, gx in chars:  # accent keyline, outermost
        if ch != " ":
            d.text((gx, top), ch, font=f, fill=accent, stroke_width=stroke + 10 * ss, stroke_fill=accent)
    for i in range(extr * ss, 0, -2):  # stepped brass extrusion down-right
        col = BRASS if i > extr * ss * 2 // 3 else (BRASS_D if i > extr * ss // 3 else BRASS_DEEP)
        for ch, gx in chars:
            if ch != " ":
                d.text((gx + i, top + i), ch, font=f, fill=col, stroke_width=stroke, stroke_fill=col)
    for ch, gx in chars:
        if ch != " ":
            d.text((gx, top), ch, font=f, fill=INK, stroke_width=stroke, stroke_fill=INK)
    for ch, gx in chars:
        if ch != " ":
            d.text((gx, top), ch, font=f, fill=face)
    bb = img.getbbox()
    pad = 20 * ss
    img = img.crop((max(0, bb[0] - pad), max(0, bb[1] - pad), min(W, bb[2] + pad), min(H, bb[3] + pad)))
    return img.resize((img.width // ss, img.height // ss), Image.LANCZOS)


def title_svgs(rung, text, accent, face, extr, px=200, track=4):
    try:
        from fontTools.pens.svgPathPen import SVGPathPen
        from fontTools.ttLib import TTFont
    except ImportError:
        return None, None
    hexc = lambda c: "#%02X%02X%02X" % c[:3]  # noqa: E731
    tt = TTFont(FONT)
    upem, cmap, gs, hmtx = tt["head"].unitsPerEm, tt.getBestCmap(), tt.getGlyphSet(), tt["hmtx"]
    sc = px / upem
    w = sum((hmtx[cmap[ord(c)]][0] * sc if ord(c) in cmap else px * 0.3) + track for c in text) - track
    W, H = int(w + 120), int(px * 1.5)
    base = px * tt["hhea"].ascent / upem + 40
    x, paths = (W - w) / 2, []
    for ch in text:
        g = cmap.get(ord(ch))
        if g is None:
            x += px * 0.3 + track
            continue
        pen = SVGPathPen(gs)
        gs[g].draw(pen)
        paths.append((pen.getCommands(), f"translate({x:.2f},{base:.2f}) scale({sc:.5f},{-sc:.5f})"))
        x += hmtx[g][0] * sc + track

    def group(fill, extra=""):
        return "\n".join(f'    <path transform="{t}" d="{d}" fill="{fill}" {extra}/>' for d, t in paths)

    o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
         f"  <title>{text} - Piggy Firefighters win rung title ({rung})</title>",
         "  <desc>Outlined Alfa Slab One (SIL OFL 1.1): gold face, brass side, dark-brown ink, accent keyline.</desc>",
         '  <g id="accent-keyline">', group(hexc(accent), f'stroke="{hexc(accent)}" stroke-width="34" stroke-linejoin="round"'),
         "  </g>", '  <g id="outline-extrusion">']
    for off in range(extr, 0, -2):
        col = hexc(BRASS) if off > extr * 2 // 3 else (hexc(BRASS_D) if off > extr // 3 else hexc(BRASS_DEEP))
        o += [f'   <g transform="translate({off},{off})">', group(col, f'stroke="{col}" stroke-width="6"'), "   </g>"]
    o += ["  </g>", '  <g id="ink-outline">', group(hexc(INK), f'stroke="{hexc(INK)}" stroke-width="16" stroke-linejoin="round"'),
          "  </g>", '  <g id="face">', group(hexc(face)), "  </g>", "</svg>"]
    live = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
            f"  <title>{text} - live text ({rung})</title>",
            '  <defs><style>@font-face{font-family:"Alfa Slab One";src:url("../../branding/fonts/AlfaSlabOne-Regular.ttf");}'
            f'.t{{font-family:"Alfa Slab One",serif;fill:{hexc(face)};stroke:{hexc(INK)};stroke-width:14;'
            f"paint-order:stroke;text-anchor:middle;font-size:{px}px;}}</style></defs>",
            f'  <text class="t" x="{W / 2:.1f}" y="{base:.1f}" letter-spacing="{track}">{text}</text>', "</svg>"]
    return "\n".join(o), "\n".join(live)


def cmd_titles(titles_dir, **_):
    os.makedirs(titles_dir, exist_ok=True)
    for rung in RUNGS:
        png = title_png(TITLES[rung], ACCENT[rung], FACE_FOR[rung], EXTR_FOR[rung])
        save_png(png, os.path.join(titles_dir, f"title_{rung}.png"))
        outlined, live = title_svgs(rung, TITLES[rung], ACCENT[rung], FACE_FOR[rung], EXTR_FOR[rung])
        if outlined:
            open(os.path.join(titles_dir, f"title_{rung}_outlined.svg"), "w").write(outlined)
            open(os.path.join(titles_dir, f"title_{rung}_live.svg"), "w").write(live)
        print(f"title {rung}: {png.size}{'' if outlined else ' (fontTools missing: no SVG)'} -> {rel(titles_dir)}")


# ------------------------------------------------------------------------------------------------- signs
def chains(can, xs, y1, y0=None):
    """Brass chain links from the top edge (or y0) down to y1 (ink outline, one hard highlight)."""
    d = ImageDraw.Draw(can)
    lw, lh = 30, 46
    for x in xs:
        y, k = (-lh // 2 if y0 is None else y0), 0
        while y < y1:
            if k % 2 == 0:  # face-on oval link
                d.ellipse([x - lw // 2, y, x + lw // 2, y + lh], outline=INK, width=13)
                d.ellipse([x - lw // 2 + 4, y + 4, x + lw // 2 - 4, y + lh - 4], outline=BRASS, width=6)
                d.arc([x - lw // 2 + 5, y + 5, x + lw // 2 - 5, y + lh - 5], 200, 250, fill=(255, 236, 170, 255), width=3)
            else:  # edge-on link
                d.rounded_rectangle([x - 7, y, x + 7, y + lh], radius=6, fill=INK)
                d.rounded_rectangle([x - 3, y + 4, x + 3, y + lh - 4], radius=3, fill=BRASS_D)
            y += lh - 14
            k += 1


def body_rows(im, frac=0.85):
    """First and last row (exclusive) whose opaque span covers >= frac of the image width: the plaque body."""
    a = np.array(im.getchannel("A")) > 128
    full = np.nonzero(a.sum(1) >= frac * im.width)[0]
    return (int(full[0]), int(full[-1]) + 1) if len(full) else (0, im.height)


def cmd_signs(srcs, root, titles_dir, plank_w, crest_set, pending, **_):
    if not exists_src(srcs["rung_plaques"]):
        pending.append(f"signs <- {srcs['rung_plaques']}")
        return
    comps = components(load_rgba(srcs["rung_plaques"]), 20000)
    parts = sort_grid(comps, 2)
    if len(parts) != 7:
        raise SystemExit(f"rung_plaques: expected 5 boards + 2 bars, found {len(parts)} pieces")
    boards, bars = [piece_image(c) for c in parts[:5]], [piece_image(c) for c in parts[5:]]
    out = prepare_out(os.path.join(root, "winrungs", "signs"))
    bcx, bcy, bw, bh = BOARD
    pcx, pcy, _, ph = PLANK
    pw = plank_w
    man = {}
    for i, rung in enumerate(RUNGS):
        board, bar = boards[i], bars[0 if i < 3 else 1]
        can = Image.new("RGBA", (SIGN_W, SIGN_H), (0, 0, 0, 0))
        crest = rung in crest_set
        aspect = board.height / board.width
        if not crest and abs(aspect / (bh / bw) - 1) > 0.25:
            print(f"  {rung}: WARNING board aspect {aspect:.2f} vs rect {bh / bw:.2f} - it is stretched to the rect; "
                  f"ask for a ~{bw / bh:.1f}:1 blank plaque")
        if crest:  # width-fit (never taller than the space above the rect's bottom), bottom-aligned on the rect
            s = min(bw / board.width, (bcy + bh / 2) / board.height)
            bb = board.resize((max(1, round(board.width * s)), max(1, round(board.height * s))), Image.LANCZOS)
            y = round(bcy + bh / 2 - bb.height)
        else:
            bb = board.resize((round(bw), round(bh)), Image.LANCZOS)
            y = round(bcy - bh / 2)
        b0, b1 = body_rows(bb)  # the plaque body (full-width rows), below any crest
        chains(can, [round(bcx - bw * 0.36), round(bcx + bw * 0.36)], y + b0 + 30)
        chains(can, [round(pcx - pw * 0.33), round(pcx + pw * 0.33)], round(pcy), y0=y + b1 - 40)  # board -> plank
        can.alpha_composite(bar.resize((round(pw), round(ph)), Image.LANCZOS), (round(pcx - pw / 2), round(pcy - ph / 2)))
        can.alpha_composite(bb, (round(bcx - bb.width / 2), y))
        tp = os.path.join(titles_dir, f"title_{rung}.png")
        if not os.path.exists(tp):
            raise SystemExit(f"missing {rel(tp)}: run `derive_winrungs.py titles` first")
        t = Image.open(tp).convert("RGBA")
        cy = y + (b0 + b1) / 2  # centred on the plaque body's inner panel, not on the crest
        s = min(bw * 0.68 / t.width, (b1 - b0) * 0.50 / t.height)  # inside the inner panel with a margin
        t = t.resize((round(t.width * s), round(t.height * s)), Image.LANCZOS)
        can.alpha_composite(t, (round(bcx - t.width / 2), round(cy - t.height / 2)))
        n = save_webp(can, os.path.join(out, f"{rung}.webp"), quality=92)
        man[rung] = {"file": f"signs/{rung}.webp", "w": SIGN_W, "h": SIGN_H, "plank": [pcx, pcy, round(pw, 1), ph],
                     "board": BOARD, "crest": bool(crest), "title_centre": [bcx, round(cy, 1)],
                     "board_body_y": [y + b0, y + b1]}
        print(f"winrungs/signs/{rung}.webp {can.size} {n} B crest={crest}")
    write_json(os.path.join(out, "flat_manifest.json"), man)


# ------------------------------------------------------------------------------------------------ pieces
def spin_frames(im, n, cell, flip):
    """Fake 3D tumble from one flat piece: flat things flip about the vertical axis (x-scale by |cos|, darker mirrored
    back), the rest rotate in-plane with 0.78-1.0 y-foreshortening; at most 86 % of the cell."""
    frames = []
    w, h = im.size
    s = (cell * 0.86) / (max(w, h) if flip else math.hypot(w, h))
    base = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    back = ImageEnhance.Brightness(base.transpose(Image.FLIP_LEFT_RIGHT)).enhance(0.82)
    for i in range(n):
        t = 2 * math.pi * i / n
        if flip:
            c = math.cos(t)
            src = base if c >= 0 else back
            fr = src.resize((max(1, round(src.width * max(0.08, abs(c)))), src.height), Image.LANCZOS)
            fr = fr.rotate(-18 + 10 * math.sin(t), expand=True, resample=Image.BICUBIC)
        else:
            sy = 0.78 + 0.22 * abs(math.cos(t * 0.5 + 0.4))
            fr = base.resize((base.width, max(1, round(base.height * sy))), Image.LANCZOS)
            fr = fr.rotate(-math.degrees(t), expand=True, resample=Image.BICUBIC)
        if fr.width > cell or fr.height > cell:
            k = min(cell / fr.width, cell / fr.height)
            fr = fr.resize((max(1, int(fr.width * k)), max(1, int(fr.height * k))), Image.LANCZOS)
        c = Image.new("RGBA", (cell, cell))
        c.alpha_composite(fr, ((cell - fr.width) // 2, (cell - fr.height) // 2))
        frames.append(c)
    return frames


def pack(frames, cols=COLS, cell=CELL):
    rows = math.ceil(len(frames) / cols)
    sheet = Image.new("RGBA", (cols * cell, rows * cell))
    for i, fr in enumerate(frames):
        sheet.alpha_composite(fr, ((i % cols) * cell, (i // cols) * cell))
    return sheet


def load_pieces(srcs, items):
    comps = sort_grid(components(load_rgba(srcs["rung_pieces"]), 3000), 2)
    if len(comps) != len(items):
        raise SystemExit(f"rung_pieces: expected {len(items)} separate items, found {len(comps)} (need wide gaps)")
    return {name: piece_image(c) for name, c in zip(items, comps)}


def cmd_pieces(srcs, root, items, pending, contact, **_):
    if not exists_src(srcs["rung_pieces"]):
        pending.append(f"pieces <- {srcs['rung_pieces']}")
        return
    pcs = load_pieces(srcs, items)
    out = prepare_out(os.path.join(root, "winrungs", "pieces"))
    tiles = []
    for name, im in pcs.items():
        frames = spin_frames(im, FRAMES, CELL, name in FLIP)
        sheet = pack(frames)
        n = save_webp(sheet, os.path.join(out, f"{name}_sheet.webp"), quality=90)
        meta = {"sheet": f"{name}_sheet.webp", "w": sheet.width, "h": sheet.height, "bytes": n, "frames": FRAMES,
                "fps": FPS, "cell": CELL, "cols": COLS, "rows": sheet.height // CELL, "pivot": [0.5, 0.5], "loop": True,
                "route": f"2D spin ({'flip' if name in FLIP else 'tumble'}) of {rel(src_path(srcs['rung_pieces']))}"}
        write_json(os.path.join(out, f"{name}.json"), meta)
        tiles.append((name, frames[0]))
        print(f"winrungs/pieces/{name}_sheet.webp {sheet.size} {FRAMES} frames {n} B")
    if contact:  # the family's 96 px blind test: every piece must read as its object at 96 and 48 px
        print("blind-test sheet ->", rel(contact_sheet(tiles, contact, cell=160, small=(96, 48))))


def cmd_coins(srcs, root, items, pending, **_):
    if not exists_src(srcs["rung_pieces"]):
        pending.append(f"coins <- {srcs['rung_pieces']}")
        return
    coin = load_pieces(srcs, items)[items[0]]
    frames = spin_frames(coin, 32, CELL, True)
    sheet = pack(frames)
    out = prepare_out(os.path.join(root, "winrungs", "coins"))
    n = save_webp(sheet, os.path.join(out, "coin_sheet.webp"), quality=90)
    names = [f"pff_coin_{i:02d}.png" for i in range(32)]
    fr = {nm: {"frame": {"x": (i % COLS) * CELL, "y": (i // COLS) * CELL, "w": CELL, "h": CELL}, "rotated": False,
               "trimmed": False, "spriteSourceSize": {"x": 0, "y": 0, "w": CELL, "h": CELL},
               "sourceSize": {"w": CELL, "h": CELL}} for i, nm in enumerate(names)}
    write_json(os.path.join(out, "coin_sheet.json"), {
        "frames": fr, "animations": {"coin": names},
        "meta": {"app": "tools/art/derive_winrungs.py coins", "version": "1.0", "image": "coin_sheet.webp",
                 "format": "RGBA8888", "size": {"w": sheet.width, "h": sheet.height}, "scale": "1"}})
    print(f"winrungs/coins/coin_sheet.webp {sheet.size} 32 frames {n} B + coin_sheet.json (animation 'coin')")


# ---------------------------------------------------------------------------------------------------- fx
def _grid(w, h):
    ys, xs = np.mgrid[0:h, 0:w]
    return xs.astype(np.float64), ys.astype(np.float64)


def _warm(alpha, hot=None):
    hot = alpha if hot is None else hot
    return np.stack([255 * np.ones_like(alpha), 255 - 40 * (1 - hot), 255 - 120 * (1 - hot), alpha * 255], -1)


def fx_textures():
    """Piggy Firefighters' own additive set (warm-white, tinted per rung at runtime): a flare with a thin second
    streak, a WATER-RIPPLE double ring, an 8-point sparkle, a cool STEAM puff and a searchlight wedge with three
    inner beams. Parameters differ from the family donor's so no texture can coincide with a donor file."""
    out = {}
    x, y = _grid(1024, 128)
    dx, dy = (x - 512) / 512, (y - 64) / 64
    a = np.clip(np.exp(-(dy ** 2) / (2 * 0.05 ** 2)) * np.exp(-(dx ** 2) / (2 * 0.5 ** 2))
                + 0.35 * np.exp(-((dy + 0.22) ** 2) / (2 * 0.015 ** 2)) * np.exp(-(dx ** 2) / (2 * 0.32 ** 2))
                + np.exp(-((dx ** 2) / 0.45 + (dy ** 2) / 0.2)) * 0.3 + np.exp(-((dx ** 2) / 0.015 + (dy ** 2) / 0.4)) * 0.55, 0, 1)
    a[:, [0, -1]] = 0
    a[[0, -1], :] = 0
    out["flare_horizontal"] = _warm(a, np.clip(a * 1.3, 0, 1))
    x, y = _grid(512, 512)
    r = np.hypot(x - 256, y - 256) / 256
    a = np.clip(np.exp(-((r - 0.80) ** 2) / (2 * 0.04 ** 2)) + 0.45 * np.exp(-((r - 0.62) ** 2) / (2 * 0.025 ** 2))
                + 0.25 * np.exp(-((r - 0.78) ** 2) / (2 * 0.12 ** 2)), 0, 1)
    a[r > 0.99] = 0
    out["ring_shockwave"] = _warm(a)
    x, y = _grid(256, 256)
    dx, dy = (x - 128) / 128, (y - 128) / 128
    u, v = (dx + dy) / np.sqrt(2), (dx - dy) / np.sqrt(2)
    main = (np.exp(-(dy ** 2) / (2 * 0.014 ** 2)) * np.exp(-(dx ** 2) / (2 * 0.46 ** 2))
            + np.exp(-(dx ** 2) / (2 * 0.014 ** 2)) * np.exp(-(dy ** 2) / (2 * 0.46 ** 2)))
    diag = 0.45 * (np.exp(-(v ** 2) / (2 * 0.01 ** 2)) * np.exp(-(u ** 2) / (2 * 0.22 ** 2))
                   + np.exp(-(u ** 2) / (2 * 0.01 ** 2)) * np.exp(-(v ** 2) / (2 * 0.22 ** 2)))
    a = np.clip(main + diag + np.exp(-(np.hypot(dx, dy) ** 2) / (2 * 0.06 ** 2)), 0, 1)
    a[np.hypot(dx, dy) > 0.99] = 0
    out["glint_4point"] = _warm(a, np.clip(a * 1.4, 0, 1))
    rng = np.random.default_rng(1313)
    r = np.hypot(x - 128, y - 136) / 124
    noise = np.zeros_like(r)
    for _ in range(7):
        px, py = rng.uniform(0.28, 0.72, 2) * 256
        rad = rng.uniform(0.10, 0.24) * 256
        noise += np.exp(-(((x - px) ** 2 + (y - py) ** 2) / (2 * rad ** 2)))
    a = np.clip(np.clip(1 - r, 0, 1) ** 1.4 * (0.45 + 0.55 * noise / noise.max()), 0, 1) * 0.8
    a[np.hypot(x - 128, y - 128) > 127] = 0
    out["dust_puff"] = np.stack([240 * np.ones_like(a), 246 * np.ones_like(a), 250 * np.ones_like(a), a * 255], -1)
    x, y = _grid(256, 512)
    t = y / 512
    half = (0.05 + 0.40 * t) * 256
    body = np.clip(1 - np.abs(x - 128) / half, 0, 1) ** 1.2
    beams = 1 + 0.35 * np.cos((x - 128) / half * np.pi * 3) ** 8
    a = np.clip(body * beams * (1 - t) ** 0.7, 0, 1) * 0.85
    a[:, [0, -1]] = 0
    out["light_ray_wedge"] = _warm(a)
    return out


def cmd_fx(root, **_):
    out = prepare_out(os.path.join(root, "winrungs", "fx"))
    for name, arr in fx_textures().items():
        im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")
        n = save_webp(im, os.path.join(out, f"{name}.webp"), lossless=True)
        print(f"winrungs/fx/{name}.webp {im.size} {n} B")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", nargs="*", help="titles | signs | pieces | coins | fx (default: all)")
    ap.add_argument("--map", default="", help='json {"rung_plaques": "...", "rung_pieces": "..."}')
    ap.add_argument("--out", default="")
    ap.add_argument("--titles-dir", default=TITLES_DIR)
    ap.add_argument("--plank-w", type=float, default=PLANK[2])
    ap.add_argument("--items", default=",".join(ITEMS), help="names of the 10 pieces in sheet order (row by row)")
    ap.add_argument("--crest", default=",".join(CREST), help="rungs whose board painting has a crest above it")
    ap.add_argument("--contact", default=os.path.join(QA, "winrung_pieces_blindtest.png"))
    ap.add_argument("--strict", action="store_true")
    a = ap.parse_args()
    every = ["titles", "signs", "pieces", "coins", "fx"]
    if [c for c in a.cmd if c not in every]:
        ap.error(f"subcommands are {every}")
    srcs = dict(DEFAULT_MAP)
    if a.map:
        srcs.update(json.load(open(a.map)))
    kw = dict(srcs=srcs, root=out_root(a.out), titles_dir=os.path.abspath(a.titles_dir), plank_w=a.plank_w,
              items=[s for s in a.items.split(",") if s], pending=[], contact=a.contact,
              crest_set={s for s in a.crest.split(",") if s})
    for c in a.cmd or every:
        {"titles": cmd_titles, "signs": cmd_signs, "pieces": cmd_pieces, "coins": cmd_coins, "fx": cmd_fx}[c](**kw)
    if kw["pending"]:
        print("PENDING (no accepted source yet):", "; ".join(kw["pending"]))
    if a.strict and kw["pending"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
