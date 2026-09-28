#!/usr/bin/env python3
"""Letter the department crest onto the blank shield of a card painting (derived source, no paid call).

gpt-image cannot letter reliably (tools/art/letter_shield.py), so the Chief's splash card was painted with a BLANK
white shield. This tool finds that white face (a near-white blob flood-filled from a seed inside it), and letters the
fictional department on it in Alfa Slab One, dark-brown ink (#3B2313) with the one hard brass-shadow tone (#B8862B)
offset down-right — the same treatment as the "13" on every helmet shield — as three lines fitted to the shield's
local width: the town, the big station number, the department.

  python3 tools/art/letter_card_crest.py cards/card_chief cards/card_chief_crest --seed 1123,400 \
      --lines "TROTTERVILLE|13|FIRE DEPT."

The output PNG is a DERIVED source under art-src/generated (never a paid output): derive_cards.py's splash spec reads
it for splash/card_chief.webp. The raw painting is never modified.
"""
import argparse, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from art_common import GEN, rel, src_path  # noqa: E402

FONT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-src', 'branding', 'fonts', 'AlfaSlabOne-Regular.ttf')
INK = (0x3B, 0x23, 0x13, 255)
SHADOW = (0xB8, 0x86, 0x2B, 255)


def face_mask(im, seed, white=222):
    a = np.asarray(im.convert('RGB')).astype(np.int16)
    m = (a.min(axis=2) >= white)
    lab, n = ndimage.label(m)
    sx, sy = seed
    k = lab[sy, sx]
    if k == 0:
        sys.exit(f'seed {seed} is not on a near-white pixel')
    return lab == k


def fit_font(text, target_cap, max_w):
    size = max(8, int(target_cap))
    font = ImageFont.truetype(FONT, size)
    bb = font.getbbox(text)
    cap = bb[3] - bb[1]
    size = max(8, int(size * target_cap / max(cap, 1)))
    font = ImageFont.truetype(FONT, size)
    bb = font.getbbox(text)
    if bb[2] - bb[0] > max_w:  # too wide for the shield here: shrink to the local width
        size = max(8, int(size * max_w / (bb[2] - bb[0])))
        font = ImageFont.truetype(FONT, size)
        bb = font.getbbox(text)
    return font, bb


def letter(src, out, seed, lines, fills, ys, width_share, shadow_frac):
    im = Image.open(src).convert('RGBA')
    m = face_mask(im, seed)
    rows, cols = np.where(m)
    y0, y1, x0, x1 = rows.min(), rows.max(), cols.min(), cols.max()
    bh = y1 - y0 + 1
    d = ImageDraw.Draw(im)
    sh = max(1, round(bh * shadow_frac))
    for text, fill, fy in zip(lines, fills, ys):
        cy = y0 + fy * bh
        # the shield's opaque width at this height (its own outline, so the text stays inside the bevel)
        band = m[int(cy - bh * 0.04):int(cy + bh * 0.04) + 1]
        widths = [(np.where(r)[0].max() - np.where(r)[0].min() + 1) for r in band if r.any()]
        local_w = min(widths) if widths else (x1 - x0)
        local_cx = (np.where(m[int(cy)])[0].min() + np.where(m[int(cy)])[0].max()) / 2 if m[int(cy)].any() else (x0 + x1) / 2
        font, bb = fit_font(text, fill * bh, local_w * width_share)
        tw, th = bb[2] - bb[0], bb[3] - bb[1]
        px, py = local_cx - bb[0] - tw / 2, cy - bb[1] - th / 2
        d.text((px + sh, py + sh), text, font=font, fill=SHADOW)
        d.text((px, py), text, font=font, fill=INK)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im.convert('RGB').save(out, 'PNG', optimize=True)
    print(f'{rel(out)} <- {rel(src)}  shield face bbox x{x0}-{x1} y{y0}-{y1}  lines {lines}')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('src'); ap.add_argument('out', help='name under art-src/generated (".png" added)')
    ap.add_argument('--seed', default='1123,400', help='x,y of a pixel inside the blank shield face')
    ap.add_argument('--lines', default='TROTTERVILLE|13|FIRE DEPT.')
    ap.add_argument('--fills', default='0.11,0.34,0.11', help='cap height per line, fraction of the face height')
    ap.add_argument('--ys', default='0.20,0.52,0.80', help='line centre per line, fraction of the face height from its top')
    ap.add_argument('--width', type=float, default=0.78, help='share of the local shield width a line may use')
    ap.add_argument('--shadow', type=float, default=0.012)
    a = ap.parse_args()
    out = a.out if a.out.lower().endswith('.png') else a.out + '.png'
    out = out if os.path.isabs(out) else os.path.join(GEN, out)
    letter(src_path(a.src), out, tuple(int(v) for v in a.seed.split(',')), a.lines.split('|'),
           [float(v) for v in a.fills.split(',')], [float(v) for v in a.ys.split(',')], a.width, a.shadow)


if __name__ == '__main__':
    main()
