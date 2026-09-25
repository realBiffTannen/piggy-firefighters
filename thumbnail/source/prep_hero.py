#!/usr/bin/env python3
"""PF-THUMB-01 hero prep (local, free, deterministic): raw paid painting -> tile-ready hero PNG.

1. alpha clean (art_common.load_clean: normalise the 254 ceiling, cut faint glow, drop specks),
2. isolate the BLANK brass helmet shield (flood fill of brass pixels from a seed, bounded by the ink outline),
   letter "13" on it with tools/art/letter_shield.py (the one shield treatment, ART_HERO.md shield rule),
3. solidify alpha >= 250 -> 255 (clean opaque interior; edge ramp untouched).
The raw painting under art-src/generated/thumb/ is never modified.

Usage: python3 thumbnail/source/prep_hero.py <raw.png> <seed_x> <seed_y> <out.png>
"""
import os, subprocess, sys, tempfile
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.join(REPO, 'tools', 'art'))
from art_common import load_clean  # noqa: E402

raw, sx, sy, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
im = load_clean(raw)
a = np.array(im).astype(np.int32)
r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
brass = (al > 200) & (r > 150) & (g > 95) & (b < 150) & (r - b > 90)
lab, n = ndi.label(brass)
k = lab[sy, sx]
if k == 0:
    sys.exit(f'seed ({sx},{sy}) is not on brass')
mask = ndi.binary_fill_holes(lab == k)
ys, xs = np.where(mask)
print(f'shield mask {mask.sum()} px, bbox x {xs.min()}-{xs.max()} y {ys.min()}-{ys.max()}')
piece = np.array(im).copy()
piece[..., 3] = np.where(mask, 255, 0)
with tempfile.TemporaryDirectory() as td:
    pin, pout = os.path.join(td, 'shield.png'), os.path.join(td, 'shield_13.png')
    Image.fromarray(piece, 'RGBA').save(pin)
    subprocess.run([sys.executable, os.path.join(REPO, 'tools', 'art', 'letter_shield.py'), pin, pout], check=True)
    lettered = np.array(Image.open(pout).convert('RGBA'))
res = np.array(im).copy()
res[mask, :3] = lettered[mask, :3]
res[..., 3] = np.where(res[..., 3] >= 250, 255, res[..., 3])
Image.fromarray(res, 'RGBA').save(out, 'PNG', optimize=True)
Image.fromarray((mask * 255).astype(np.uint8)).save(os.path.splitext(out)[0] + '_shieldmask.png')
print('wrote', out)
