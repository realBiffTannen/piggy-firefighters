#!/usr/bin/env python3
"""PIGGY FIREFIGHTERS — PROCEDURAL PLACEHOLDER ART (frontend port, 2026-09-25).

Every file this script writes is a stand-in drawn from primitives with Pillow in the theme palette
(docs/PIGGY_FIREFIGHTERS_THEME.md §1): no donor art, no generated imagery, no paid calls. The art lane replaces
each file with the real asset at the SAME path, size and framing (inventory: docs/FRONTEND_NOTES.md §Placeholders).

    python3 tools/placeholder/make_placeholders.py      # writes apps/piggy_firefighters/static/assets/placeholder/**

Deterministic (fixed seeds), idempotent.
"""
import json
import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'apps', 'piggy_firefighters', 'static', 'assets', 'placeholder')
FONT = os.path.join(ROOT, 'apps', 'piggy_firefighters', 'static', 'assets', 'fonts', 'LilitaOne', 'LilitaOne-Regular.ttf')

# theme palette (theme §1)
RED = (215, 38, 43)
BRASS = (233, 178, 59)
YELLOW = (245, 210, 60)
CREAM = (244, 233, 210)
SMOKE = (124, 138, 160)
NAVY = (30, 42, 74)
FLAME = (255, 122, 26)
INK = (58, 34, 19)
WHITE = (255, 255, 255)
BLACK = (22, 18, 16)
DARKRED = (140, 20, 26)
STEEL = (170, 180, 192)


def font(size):
    try:
        return ImageFont.truetype(FONT, size)
    except OSError:
        return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', size)


def ensure(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    return path


def save(img, rel, quality=88):
    path = ensure(os.path.join(OUT, rel))
    if rel.endswith('.png'):
        img.save(path, optimize=True)
    else:
        img.save(path, 'WEBP', quality=quality, method=6)
    return path


def text_center(d, xy, text, size, fill, stroke=INK, sw=None, anchor='mm'):
    f = font(size)
    d.text(xy, text, font=f, fill=fill, anchor=anchor, stroke_width=sw if sw is not None else max(2, size // 12), stroke_fill=stroke)


def rr(d, box, r, fill=None, outline=None, width=1):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


# ---------------------------------------------------------------------------------------------- symbols
TILE = 384
PAD = int(TILE * 0.068)


def plate(color, rim=INK, inner=None):
    img = Image.new('RGBA', (TILE, TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    box = (PAD, PAD, TILE - PAD, TILE - PAD)
    rr(d, (box[0] + 6, box[1] + 10, box[2] + 6, box[3] + 10), 58, fill=(0, 0, 0, 90))
    rr(d, box, 58, fill=color, outline=rim, width=12)
    rr(d, (box[0] + 18, box[1] + 18, box[2] - 18, box[1] + 90), 36, fill=inner or tuple(min(255, c + 40) for c in color))
    return img, d


def id_tag(d, sid):
    text_center(d, (TILE - PAD - 44, TILE - PAD - 34), sid, 44, CREAM, INK, 5)


def draw_truck(d):
    rr(d, (70, 150, 314, 272), 18, fill=RED, outline=INK, width=9)
    rr(d, (220, 118, 314, 200), 14, fill=RED, outline=INK, width=9)
    rr(d, (236, 132, 298, 180), 8, fill=(170, 220, 255), outline=INK, width=6)
    for x in (80, 120, 160, 200):
        d.line((x, 140, x + 20, 118), fill=BRASS, width=10)
    d.line((70, 128, 230, 128), fill=STEEL, width=10)
    for cx in (120, 262):
        d.ellipse((cx - 34, 238, cx + 34, 306), fill=BLACK, outline=INK, width=6)
        d.ellipse((cx - 14, 258, cx + 14, 286), fill=STEEL)
    text_center(d, (150, 212), '13', 46, BRASS, INK, 5)


def draw_helmet(d):
    d.pieslice((72, 110, 312, 330), 180, 360, fill=RED, outline=INK, width=10)
    d.rectangle((60, 214, 324, 244), fill=RED, outline=INK, width=9)
    d.polygon([(162, 128), (222, 128), (236, 196), (148, 196)], fill=BRASS, outline=INK)
    d.ellipse((176, 146, 208, 178), fill=YELLOW, outline=INK, width=4)
    d.line((192, 110, 192, 214), fill=DARKRED, width=6)


def draw_axe(d):
    d.line((100, 300, 290, 110), fill=RED, width=22)
    d.line((100, 300, 290, 110), fill=INK, width=4)
    d.polygon([(240, 90), (320, 110), (300, 170), (262, 140)], fill=STEEL, outline=INK)
    d.line((290, 300, 100, 110), fill=BLACK, width=18)
    d.polygon([(84, 96), (130, 90), (118, 128)], fill=BLACK, outline=INK)
    for p in ((195, 205), (150, 250), (240, 160)):
        d.ellipse((p[0] - 8, p[1] - 8, p[0] + 8, p[1] + 8), fill=BRASS, outline=INK)


def draw_extinguisher(d):
    rr(d, (140, 130, 244, 320), 46, fill=RED, outline=INK, width=10)
    rr(d, (160, 96, 224, 134), 10, fill=BRASS, outline=INK, width=8)
    d.line((224, 112, 290, 140, 300, 220), fill=BLACK, width=14, joint='curve')
    d.ellipse((160, 170, 224, 234), fill=CREAM, outline=INK, width=6)
    d.line((192, 202, 210, 186), fill=(40, 170, 70), width=6)


def draw_nozzle(d):
    d.arc((70, 120, 250, 300), 0, 330, fill=CREAM, width=26)
    d.arc((70, 120, 250, 300), 0, 330, fill=INK, width=4)
    d.polygon([(230, 150), (320, 118), (330, 150), (240, 186)], fill=BRASS, outline=INK)
    d.ellipse((310, 110, 340, 160), fill=YELLOW, outline=INK, width=4)


def draw_bucket(d):
    d.polygon([(110, 140), (274, 140), (250, 316), (134, 316)], fill=(176, 116, 64), outline=INK)
    for y in (190, 250):
        d.line((118, y, 266, y), fill=INK, width=8)
    d.ellipse((110, 122, 274, 160), fill=(80, 160, 230), outline=INK, width=8)
    d.arc((120, 70, 264, 200), 200, 340, fill=INK, width=8)
    d.ellipse((230, 70, 256, 100), fill=(80, 160, 230), outline=INK, width=4)


def draw_ladder(d):
    for x in (130, 250):
        d.line((x, 80, x - 20, 320), fill=(196, 140, 80), width=22)
        d.line((x, 80, x - 20, 320), fill=INK, width=3)
    for i in range(6):
        y = 100 + i * 40
        d.line((130 - i * 3, y, 250 - i * 3, y), fill=BRASS, width=12)


def draw_boots(d):
    for ox in (0, 110):
        d.polygon([(90 + ox, 110), (150 + ox, 110), (150 + ox, 260), (200 + ox, 262), (200 + ox, 312), (90 + ox, 312)], fill=BLACK, outline=INK)
        d.rectangle((90 + ox, 180, 150 + ox, 196), fill=YELLOW)
        d.rectangle((90 + ox, 290, 200 + ox, 300), fill=YELLOW)


def draw_pig_face(d, cx, cy, r):
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(246, 170, 170), outline=INK, width=9)
    d.polygon([(cx - r * 0.9, cy - r * 0.55), (cx - r * 0.55, cy - r * 1.1), (cx - r * 0.25, cy - r * 0.8)], fill=(236, 150, 150), outline=INK)
    d.polygon([(cx + r * 0.9, cy - r * 0.55), (cx + r * 0.55, cy - r * 1.1), (cx + r * 0.25, cy - r * 0.8)], fill=(236, 150, 150), outline=INK)
    d.ellipse((cx - r * 0.38, cy - r * 0.05, cx + r * 0.38, cy + r * 0.45), fill=(236, 130, 140), outline=INK, width=6)
    for sx in (-0.15, 0.15):
        d.ellipse((cx + sx * r - 7, cy + r * 0.15, cx + sx * r + 7, cy + r * 0.3), fill=INK)
    for sx in (-0.42, 0.42):
        d.ellipse((cx + sx * r - 11, cy - r * 0.42, cx + sx * r + 11, cy - r * 0.2), fill=INK)


def draw_wild(img, d, blaze=False):
    # Chief Hamm bust: white helmet with a brass "13" shield, pig face
    draw_pig_face(d, 192, 150, 84)
    d.pieslice((104, 30, 280, 170), 180, 360, fill=WHITE, outline=INK, width=9)
    d.rectangle((96, 96, 288, 112), fill=WHITE, outline=INK, width=6)
    d.polygon([(176, 44), (208, 44), (214, 88), (170, 88)], fill=BRASS, outline=INK)
    # WILD banner at exactly symbolMotion WILD_BANNER.square (x 62, y 204, w 262, h 98)
    rr(d, (62, 204, 62 + 262, 204 + 98), 22, fill=RED, outline=INK, width=9)
    text_center(d, (62 + 131, 204 + 52), 'WILD', 70, CREAM, INK, 6)
    if blaze:
        rnd = random.Random(7)
        over = Image.new('RGBA', img.size, (0, 0, 0, 0))
        od = ImageDraw.Draw(over)
        for _ in range(26):
            x = rnd.randint(30, 354)
            y = rnd.randint(40, 360)
            r = rnd.randint(14, 34)
            col = rnd.choice([FLAME, YELLOW, (255, 80, 20)])
            od.polygon([(x, y - r * 2), (x + r, y + r * 0.4), (x - r, y + r * 0.4)], fill=col + (150,))
        over = over.filter(ImageFilter.GaussianBlur(3))
        img.alpha_composite(over)
        d2 = ImageDraw.Draw(img)
        rr(d2, (PAD, PAD, TILE - PAD, TILE - PAD), 58, outline=FLAME, width=14)
        text_center(d2, (192, 346), 'BLAZE', 34, YELLOW, INK, 4)


def draw_bell(d, gold=False):
    body = (242, 196, 64) if gold else BRASS
    box = (250, 205, 90) if gold else RED
    rr(d, (96, 238, 288, 318), 16, fill=box, outline=INK, width=9)
    d.pieslice((110, 92, 274, 300), 180, 360, fill=body, outline=INK, width=9)
    d.rectangle((110, 190, 274, 214), fill=body, outline=INK, width=8)
    d.ellipse((176, 206, 208, 238), fill=INK)
    d.ellipse((180, 74, 204, 98), fill=body, outline=INK, width=5)
    for a in (-1, 1):
        d.arc((192 - 130, 60, 192 + 130, 250), 200 if a < 0 else 300, 240 if a < 0 else 340, fill=YELLOW if not gold else WHITE, width=8)


SYMBOLS = {
    'H1': (NAVY, draw_truck),
    'H2': ((60, 70, 110), draw_helmet),
    'H3': ((78, 58, 48), draw_axe),
    'H4': ((56, 84, 104), draw_extinguisher),
    'L1': ((52, 110, 150), draw_nozzle),
    'L2': ((70, 130, 100), draw_bucket),
    'L3': ((150, 100, 60), draw_ladder),
    'L4': ((110, 110, 120), draw_boots),
}


def make_symbols():
    for sid, (col, fn) in SYMBOLS.items():
        img, d = plate(col)
        fn(d)
        id_tag(d, sid)
        save(img, f'symbols/{sid.lower()}.webp')
    img, d = plate((200, 60, 40), inner=(230, 90, 60))
    draw_wild(img, d)
    save(img, 'symbols/w.webp')
    img, d = plate((200, 60, 40), inner=(230, 90, 60))
    draw_wild(img, d, blaze=True)
    save(img, 'symbols/w_blaze.webp')
    img, d = plate((110, 24, 30), inner=(150, 40, 44))
    draw_bell(d)
    text_center(d, (192, 346), 'ALARM', 34, CREAM, INK, 4)
    save(img, 'symbols/alarm.webp')
    img, d = plate((150, 110, 20), rim=(90, 60, 10), inner=(200, 160, 40))
    draw_bell(d, gold=True)
    text_center(d, (192, 346), 'GOLDEN', 34, WHITE, INK, 4)
    save(img, 'symbols/galarm.webp')


# ------------------------------------------------------------------------------------------------- fx
def make_fx():
    # gold nine-slice cell frame (384 src, 100 px corner — Anticipation / SymbolSprite)
    img = Image.new('RGBA', (384, 384), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rr(d, (6, 6, 378, 378), 60, outline=INK, width=26)
    rr(d, (10, 10, 374, 374), 56, outline=BRASS, width=16)
    rr(d, (22, 22, 362, 362), 46, outline=YELLOW, width=5)
    save(img, 'fx/cell_frame.webp')
    # 4-point glint
    img = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = 128
    d.polygon([(c, 6), (c + 16, c - 16), (250, c), (c + 16, c + 16), (c, 250), (c - 16, c + 16), (6, c), (c - 16, c - 16)], fill=(255, 244, 200, 255))
    img = img.filter(ImageFilter.GaussianBlur(2))
    d = ImageDraw.Draw(img)
    d.ellipse((c - 18, c - 18, c + 18, c + 18), fill=WHITE + (255,))
    save(img, 'fx/glint_4point.webp')
    # horizontal flare
    img = Image.new('RGBA', (1024, 128), (0, 0, 0, 0))
    px = img.load()
    for x in range(1024):
        for y in range(128):
            fx_ = 1 - abs(x - 512) / 512
            fy = max(0.0, 1 - abs(y - 64) / 64)
            a = int(255 * (fx_ ** 1.5) * (fy ** 3))
            px[x, y] = (255, 200, 120, a)
    save(img, 'fx/flare_horizontal.webp')
    # shockwave ring
    img = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i in range(10):
        d.ellipse((20 + i, 20 + i, 492 - i, 492 - i), outline=(255, 190, 90, 60 + i * 18), width=2)
    img = img.filter(ImageFilter.GaussianBlur(1.5))
    save(img, 'fx/ring_shockwave.webp')


# ---------------------------------------------------------------------------------------------- rungs
RUNGS = [('big', 'BIG WIN', (30, 70, 140)), ('huge', 'HUGE WIN', (30, 110, 60)), ('mega', 'MEGA WIN', (90, 50, 140)), ('epic', 'EPIC WIN', (170, 30, 40)), ('max', 'MAX WIN', (120, 90, 10))]


def make_rungs():
    # 1200 x 728 sign: header board around y 338, a plank for the amount at y 634 (820 wide) — WinRungs SIGN
    for key, label, col in RUNGS:
        img = Image.new('RGBA', (1200, 728), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        rr(d, (80, 150, 1120, 520), 60, fill=col, outline=INK, width=18)
        rr(d, (110, 180, 1090, 260), 30, fill=tuple(min(255, c + 50) for c in col))
        for x in (140, 1060):
            d.ellipse((x - 22, 470, x + 22, 514), fill=BRASS, outline=INK, width=6)
        text_center(d, (600, 338), label, 150, YELLOW if key != 'max' else WHITE, INK, 12)
        rr(d, (190, 576, 1010, 692), 40, fill=(40, 24, 14), outline=BRASS, width=10)
        # flames licking the header (fire theme)
        for i in range(9):
            x = 160 + i * 110
            d.polygon([(x, 160), (x + 40, 60 + (i % 3) * 20), (x + 80, 160)], fill=FLAME, outline=INK)
        save(img, f'rungs/sign_{key}.webp')
    # tumbling piece sheets: 8 cols x 3 rows of 128 px cells (24 frames)
    pieces = {
        'coin': lambda d, a: (d.ellipse((64 - 44 * abs(math.cos(a)), 20, 64 + 44 * abs(math.cos(a)) + 1, 108), fill=YELLOW, outline=INK, width=5)),
        'ember': lambda d, a: d.polygon([(64 + 40 * math.cos(a + k * 2.1), 64 + 40 * math.sin(a + k * 2.1)) for k in range(3)], fill=FLAME, outline=INK),
        'droplet': lambda d, a: (d.ellipse((34, 48, 94, 108), fill=(90, 170, 240), outline=INK, width=5), d.polygon([(64 + 30 * math.sin(a) * 0.3, 14), (38, 66), (90, 66)], fill=(90, 170, 240))),
        'badge': lambda d, a: d.polygon([(64 + 44 * math.cos(a + k * math.pi / 3) * (1 if k % 2 else 0.55), 64 + 44 * math.sin(a + k * math.pi / 3) * (1 if k % 2 else 0.55)) for k in range(6)], fill=BRASS, outline=INK),
    }
    for name, fn in pieces.items():
        sheet = Image.new('RGBA', (1024, 384), (0, 0, 0, 0))
        for i in range(24):
            cell = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
            fn(ImageDraw.Draw(cell), i / 24 * math.tau)
            sheet.alpha_composite(cell, ((i % 8) * 128, (i // 8) * 128))
        save(sheet, f'rungs/piece_{name}_sheet.webp')
    # max-win cards (title-free art: clear sky on the left / top for the runtime words)
    for key, (w, h) in {'landscape': (1600, 900), 'portrait': (900, 1400)}.items():
        img = gradient(w, h, (40, 20, 40), (200, 70, 20))
        d = ImageDraw.Draw(img)
        cx, cy = (int(w * 0.72), int(h * 0.62)) if key == 'landscape' else (w // 2, int(h * 0.64))
        for i in range(24):
            a = i / 24 * math.tau
            d.line((cx, cy, cx + math.cos(a) * w, cy + math.sin(a) * w), fill=(255, 160, 60), width=18)
        draw_pig_face(d, cx, cy, int(min(w, h) * 0.2))
        save(img.convert('RGB'), f'rungs/maxwin_card_{key}.webp')


def gradient(w, h, top, bottom):
    img = Image.new('RGBA', (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        d.line((0, y, w, y), fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)) + (255,))
    return img


# ---------------------------------------------------------------------------------------------- coins
def make_coins():
    sheet = Image.new('RGBA', (1024, 512), (0, 0, 0, 0))
    frames = {}
    names = []
    for i in range(32):
        cell = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
        d = ImageDraw.Draw(cell)
        k = abs(math.cos(i / 32 * math.tau))
        hw = max(4, 46 * k)
        d.ellipse((64 - hw, 18, 64 + hw, 110), fill=(242, 190, 50), outline=INK, width=5)
        if k > 0.4:
            text_center(d, (64, 64), '13', int(36 * k) + 4, (255, 236, 150), INK, 3)
        x, y = (i % 8) * 128, (i // 8) * 128
        sheet.alpha_composite(cell, (x, y))
        name = f'pff_coin_{i:02d}.png'
        names.append(name)
        frames[name] = {'frame': {'x': x, 'y': y, 'w': 128, 'h': 128}, 'rotated': False, 'trimmed': False,
                        'spriteSourceSize': {'x': 0, 'y': 0, 'w': 128, 'h': 128}, 'sourceSize': {'w': 128, 'h': 128}}
    save(sheet, 'coins/coin_sheet.webp')
    meta = {'frames': frames, 'animations': {'coin': names},
            'meta': {'app': 'tools/placeholder/make_placeholders.py', 'version': '1.0', 'image': 'coin_sheet.webp', 'format': 'RGBA8888', 'size': {'w': 1024, 'h': 512}, 'scale': '1'}}
    with open(ensure(os.path.join(OUT, 'coins', 'coin_sheet.json')), 'w') as f:
        json.dump(meta, f, indent=1)


# ------------------------------------------------------------------------------------------- scenes
def skyline(img, ground, color, rnd, windows=None):
    d = ImageDraw.Draw(img)
    w, h = img.size
    x = 0
    while x < w:
        bw = rnd.randint(int(w * 0.05), int(w * 0.11))
        bh = rnd.randint(int(h * 0.15), int(h * 0.42))
        d.rectangle((x, ground - bh, x + bw, ground), fill=color)
        if windows:
            for wy in range(ground - bh + 16, ground - 12, 34):
                for wx in range(x + 10, x + bw - 16, 26):
                    if rnd.random() < 0.45:
                        d.rectangle((wx, wy, wx + 12, wy + 16), fill=windows)
        x += bw + rnd.randint(4, 30)


def make_backgrounds():
    moods = {
        'base': ((30, 42, 74), (230, 120, 70), (40, 38, 60), (255, 214, 120)),
        'rescue': ((10, 14, 34), (60, 40, 90), (20, 20, 36), (255, 190, 90)),
        'inferno': ((40, 6, 10), (210, 60, 20), (30, 10, 12), (255, 150, 40)),
    }
    for mood, (top, bottom, city, win) in moods.items():
        for orient, (w, h) in {'landscape': (2048, 1024), 'portrait': (1080, 1920)}.items():
            rnd = random.Random(sum(map(ord, mood + orient)))
            img = gradient(w, h, top, bottom)
            ground = int(h * 0.78)
            skyline(img, ground, city, rnd, win)
            d = ImageDraw.Draw(img)
            d.rectangle((0, ground, w, h), fill=(52, 40, 44))
            d.rectangle((0, ground, w, ground + 10), fill=(90, 70, 70))
            if mood == 'base':
                # Station 13 truck bay silhouette, centre (the reels sit over it)
                bx0, bx1 = int(w * 0.18), int(w * 0.82)
                d.rectangle((bx0, int(h * 0.3), bx1, ground), fill=(120, 40, 34))
                d.rectangle((bx0 + 30, int(h * 0.36), bx1 - 30, ground), fill=(70, 30, 30))
            if mood == 'inferno':
                for _ in range(90):
                    x = rnd.randint(0, w)
                    y = rnd.randint(0, ground)
                    r = rnd.randint(2, 5)
                    d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 140 + rnd.randint(0, 80), 40))
            save(img.convert('RGB'), f'scene/bg_{mood}_{orient}.webp', quality=80)


def make_scene():
    # bay-door shutter: 1024 x 512 tileable slats + 1024 x 115 bottom bar (SceneShutter TILE / BAR)
    img = Image.new('RGB', (1024, 512), (180, 30, 36))
    d = ImageDraw.Draw(img)
    for y in range(0, 512, 64):
        d.rectangle((0, y, 1024, y + 58), fill=(205, 42, 46))
        d.rectangle((0, y + 4, 1024, y + 14), fill=(232, 90, 90))
        d.rectangle((0, y + 58, 1024, y + 63), fill=(100, 14, 20))
    save(img, 'scene/shutter_slats_tile.webp')
    save(img, 'splash/shutter_slats_tile.webp')
    img = Image.new('RGB', (1024, 115), (60, 60, 66))
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, 1024, 20), fill=(150, 156, 170))
    for x in range(0, 1024, 64):
        d.polygon([(x, 40), (x + 32, 40), (x + 64, 100), (x + 32, 100)], fill=YELLOW)
    d.rectangle((0, 100, 1024, 115), fill=(30, 30, 34))
    save(img, 'scene/shutter_bottom_bar.webp')
    save(img, 'splash/shutter_bottom_bar.webp')
    # mode-card art (768 x 768, no text)
    for key, top, bottom in (('rescue', (20, 26, 60), (120, 50, 90)), ('inferno', (60, 6, 10), (240, 90, 20)), ('backdraft', (40, 20, 20), (255, 122, 26)), ('alarm', (30, 42, 74), (215, 38, 43))):
        img = gradient(768, 768, top, bottom)
        d = ImageDraw.Draw(img)
        if key in ('rescue', 'inferno'):
            rr(d, (190, 170, 578, 700), 12, fill=(90, 50, 40), outline=INK, width=10)
            for i in range(5):
                x = 214 + i * 70
                d.rectangle((x, 250, x + 50, 330), fill=(255, 150, 40) if i % 2 == 0 else (255, 210, 110), outline=INK, width=5)
        elif key == 'backdraft':
            for i in range(14):
                x = 40 + i * 52
                d.polygon([(x, 700), (x + 26, 260 + (i % 4) * 60), (x + 52, 700)], fill=FLAME, outline=INK)
        else:
            draw_bell(d)
        save(img.convert('RGB'), f'scene/card_{key}.webp')


# --------------------------------------------------------------------------------------------- splash
SPLASH_CARDS = ['chief', 'lines', 'backdraft', 'alarm', 'rescue', 'maxwin']


def make_splash():
    rnd = random.Random(99)
    for i, cid in enumerate(SPLASH_CARDS):
        img = gradient(768, 768, (30, 42, 74), [(215, 38, 43), (124, 138, 160), (255, 122, 26), (233, 178, 59), (60, 40, 90), (200, 70, 20)][i])
        d = ImageDraw.Draw(img)
        if cid == 'chief':
            draw_pig_face(d, 384, 420, 180)
            d.pieslice((200, 150, 568, 420), 180, 360, fill=WHITE, outline=INK, width=12)
        elif cid == 'lines':
            for r in range(3):
                for c in range(5):
                    rr(d, (84 + c * 124, 214 + r * 124, 184 + c * 124, 314 + r * 124), 16, fill=(40, 50, 90), outline=INK, width=6)
            d.line([(134 + c * 124, 264 + [1, 0, 2, 0, 1][c] * 124) for c in range(5)], fill=YELLOW, width=14, joint='curve')
        elif cid == 'backdraft':
            for k in range(16):
                x = rnd.randint(0, 768)
                d.polygon([(x - 40, 768), (x, rnd.randint(200, 500)), (x + 40, 768)], fill=FLAME, outline=INK)
        elif cid == 'alarm':
            d.rectangle((0, 0, 768, 768), fill=None)
            sub = Image.new('RGBA', (384, 384), (0, 0, 0, 0))
            draw_bell(ImageDraw.Draw(sub))
            img.alpha_composite(sub.resize((600, 600)), (84, 84))
        elif cid == 'rescue':
            rr(d, (184, 120, 584, 740), 12, fill=(90, 50, 40), outline=INK, width=12)
            for i in range(5):
                d.rectangle((210 + i * 72, 220, 262 + i * 72, 300), fill=(255, 160, 50), outline=INK, width=5)
        else:
            for k in range(20):
                a = k / 20 * math.tau
                d.line((384, 384, 384 + math.cos(a) * 600, 384 + math.sin(a) * 600), fill=(255, 200, 80), width=20)
            draw_pig_face(d, 384, 384, 150)
        save(img.convert('RGB'), f'splash/card_{cid}.webp', quality=80)
    # wordmark (transparent) — the real one is the art lane's; this carries the title text only
    img = Image.new('RGBA', (1366, 654), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    text_center(d, (683, 220), 'PIGGY', 220, CREAM, INK, 16)
    text_center(d, (683, 450), 'FIREFIGHTERS', 170, (255, 196, 60), INK, 14)
    save(img, 'branding/wordmark.png')


# ------------------------------------------------------------------------------------------- buycards
BUYCARDS = {'ante': ((30, 42, 74), (215, 38, 43)), 'backdraft-spins': ((40, 20, 20), (255, 122, 26)), 'alarm-call': ((30, 42, 74), (233, 178, 59)), 'rescue': ((20, 26, 60), (120, 50, 90)), 'inferno': ((60, 6, 10), (240, 90, 20))}


def make_buycards():
    for key, (top, bottom) in BUYCARDS.items():
        img = gradient(768, 512, top, bottom)
        d = ImageDraw.Draw(img)
        # subject in the middle horizontal band (the HUD shows only the middle ~4:1 strip)
        if key in ('rescue', 'inferno'):
            for i in range(5):
                d.rectangle((174 + i * 90, 206, 234 + i * 90, 306), fill=(255, 150, 40) if key == 'inferno' or i % 2 else (255, 214, 120), outline=INK, width=6)
        elif key == 'backdraft-spins':
            for i in range(12):
                x = 40 + i * 60
                d.polygon([(x, 330), (x + 30, 170 + (i % 3) * 30), (x + 60, 330)], fill=FLAME, outline=INK)
        elif key == 'alarm-call':
            sub = Image.new('RGBA', (384, 384), (0, 0, 0, 0))
            draw_bell(ImageDraw.Draw(sub))
            img.alpha_composite(sub.resize((230, 230)), (269, 141))
        else:
            for i in range(3):
                sub = Image.new('RGBA', (384, 384), (0, 0, 0, 0))
                draw_bell(ImageDraw.Draw(sub))
                img.alpha_composite(sub.resize((160, 160)), (150 + i * 170, 176))
        save(img.convert('RGB'), f'buycards/{key}.webp', quality=82)


if __name__ == '__main__':
    make_symbols()
    make_fx()
    make_rungs()
    make_coins()
    make_backgrounds()
    make_scene()
    make_splash()
    make_buycards()
    total = 0
    count = 0
    for dp, _, fs in os.walk(OUT):
        for f in fs:
            total += os.path.getsize(os.path.join(dp, f))
            count += 1
    print(f'placeholders: {count} files, {total / 1024:.0f} KB under {OUT}')
