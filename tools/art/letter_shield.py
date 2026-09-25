#!/usr/bin/env python3
"""Letter the Station 13 helmet shield locally (one treatment everywhere).

gpt-image cannot letter reliably, so every generated shield is BLANK brass; this tool draws "13" in Alfa Slab One,
dark-brown ink (#3B2313) with one hard brass-shadow tone (#B8862B) offset down-right, centred on the shield piece's
opaque region (its alpha bounding box), leaving the plate's own bevel untouched. Used for: the Chief rig piece
(pieces/shield_plate.png -> pieces/shield_13.png), the reel WILD badge shield and the thumbnail hero, so the
identity matches everywhere (art-src/ART_HERO.md shield rule).

Usage: python3 tools/art/letter_shield.py <shield_piece.png> <out.png> [--text 13] [--fill 0.42] [--dy 0.02]
  --fill  cap height of the numerals as a fraction of the shield's opaque-bbox height (default 0.42)
  --dy    vertical offset of the numeral centre as a fraction of bbox height (+ = down; default 0.02)
"""
import argparse, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

FONT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-src', 'branding', 'fonts', 'AlfaSlabOne-Regular.ttf')
INK = (0x3B, 0x23, 0x13, 255)
SHADOW = (0xB8, 0x86, 0x2B, 255)

def letter(src, out, text, fill, dy):
    im = Image.open(src).convert('RGBA')
    a = np.array(im)[..., 3]
    ys, xs = np.where(a > 128)
    if len(xs) == 0:
        sys.exit(f'no opaque region in {src}')
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    bw, bh = x1 - x0 + 1, y1 - y0 + 1
    target = fill * bh
    size = int(target)
    font = ImageFont.truetype(FONT, size)
    # scale so the CAP HEIGHT (digits) equals target
    bbox = font.getbbox(text)
    cap = bbox[3] - bbox[1]
    size = max(8, int(size * target / max(cap, 1)))
    font = ImageFont.truetype(FONT, size)
    bbox = font.getbbox(text)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    cx = x0 + bw / 2 - (bbox[0] + tw / 2)
    cy = y0 + bh / 2 + dy * bh - (bbox[1] + th / 2)
    layer = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    off = max(2, int(size * 0.06))
    d.text((cx + off, cy + off), text, font=font, fill=SHADOW)
    d.text((cx, cy), text, font=font, fill=INK)
    # keep the lettering strictly inside the plate's opaque region (no ink over transparent pixels)
    la = np.array(layer)
    la[..., 3] = np.where(a > 128, la[..., 3], 0)
    layer = Image.fromarray(la, 'RGBA')
    res = Image.alpha_composite(im, layer)
    res.save(out, 'PNG', optimize=True)
    print(f'lettered {os.path.basename(src)} -> {out}: bbox {bw}x{bh}, font {size}px, text "{text}"')

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('out'); ap.add_argument('--text', default='13'); ap.add_argument('--fill', type=float, default=0.42); ap.add_argument('--dy', type=float, default=0.02)
    ns = ap.parse_args(); letter(ns.src, ns.out, ns.text, ns.fill, ns.dy)
