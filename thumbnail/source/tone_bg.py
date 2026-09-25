#!/usr/bin/env python3
"""PF-THUMB-01 background tone pass (local, free): paid painting -> strict 3-tone low-colour plate.

Median-denoise, split the painting's value range into 3 clusters (1-D k-means on luminance), then paint each cluster
with ONE tone: the dominant cluster becomes the exact dominant hex; the lighter and darker clusters keep their own
measured value/saturation but take the dominant's hue exactly (closely related tones). Mapping runs at 2x and is
downsampled with Lanczos so shape edges stay anti-aliased. The raw painting is never modified.

Usage: python3 thumbnail/source/tone_bg.py <painting.png> '#RRGGBB' <out.png> ['#dark,#light']
  optional 4th arg: fixed dark/light tones shared by both aspects (else measured, re-hued to the dominant).
  Specks are removed with a 15 px median filter on the value-ordered cluster map, then any remaining
  component under 6000 px (at 2x) is absorbed into its surrounding tone.
"""
import colorsys, json, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

src, hexcol, out = sys.argv[1], sys.argv[2], sys.argv[3]
dom = tuple(int(hexcol.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4))
im = Image.open(src).convert('RGB').filter(ImageFilter.MedianFilter(7))
W, H = im.size
big = np.asarray(im.resize((W * 2, H * 2), Image.LANCZOS)).astype(np.float32)
L = big @ np.array([0.299, 0.587, 0.114], np.float32)
c = np.percentile(L, [10, 50, 90]).astype(np.float32)
for _ in range(30):
    lab = np.argmin(np.abs(L[..., None] - c), axis=2)
    c = np.array([L[lab == k].mean() if (lab == k).any() else c[k] for k in range(3)], np.float32)
order = np.argsort(c)
rank = np.empty(3, int); rank[order] = np.arange(3)
lab = order[ndi.median_filter(rank[lab], size=15)]
# the painting's outer 6 % side strips carry textured foliage/noise: re-smooth them with a tall median (61 px)
sw = int(0.06 * lab.shape[1])
for sl in (np.s_[:, :sw], np.s_[:, -sw:]):
    lab[sl] = order[ndi.median_filter(rank[lab[sl]], size=61)]
# absorb remaining specks (components < MIN_PX at 2x) into their surrounding tone
MIN_PX = 6000
for _ in range(3):
    changed = False
    for k in range(3):
        cl, n = ndi.label(lab == k)
        if n == 0:
            continue
        sizes = ndi.sum(np.ones_like(cl), cl, range(1, n + 1))
        objs = ndi.find_objects(cl)
        for i in np.where(sizes < MIN_PX)[0] + 1:
            sl = objs[i - 1]
            sl = tuple(slice(max(0, x.start - 3), x.stop + 3) for x in sl)
            m = cl[sl] == i
            ring = ndi.binary_dilation(m, iterations=2) & ~m
            vals = lab[sl][ring]
            if vals.size:
                lab[sl][m] = np.bincount(vals, minlength=3).argmax()
                changed = True
    if not changed:
        break
means = [big[lab == k].mean(axis=0) for k in range(3)]
counts = [(lab == k).mean() for k in range(3)]
dk = int(np.argmax(counts))
fixed = sys.argv[4].split(',') if len(sys.argv) > 4 else None
hd = colorsys.rgb_to_hsv(*[v / 255 for v in dom])[0]
tones = {}
for k in range(3):
    if k == dk:
        tones[k] = dom
    elif fixed:
        t = fixed[0] if k == order[0] else fixed[1]
        tones[k] = tuple(int(t.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4))
    else:
        _, s, v = colorsys.rgb_to_hsv(*(means[k] / 255))
        tones[k] = tuple(round(x * 255) for x in colorsys.hsv_to_rgb(hd, s, v))
pal = np.array([tones[k] for k in range(3)], np.uint8)
res = Image.fromarray(pal[lab], 'RGB').resize((W, H), Image.LANCZOS)
res.save(out, 'PNG', optimize=True)
hx = lambda t: '#%02X%02X%02X' % tuple(t)
info = {'dominant': hx(dom), 'tones': [hx(tones[k]) for k in order if k != dk],
        'shares_2x': {hx(tones[k]): round(float((lab == k).mean()), 4) for k in range(3)}}
print(json.dumps(info))
