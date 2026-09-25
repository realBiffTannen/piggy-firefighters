#!/usr/bin/env python3
"""Solidify near-opaque interiors of transparent PNG/WEBP layers.

gpt-image transparent outputs carry a maximum alpha of 254 (no fully opaque pixel), which a strict
delivered-layer check (Codex thumbnail validator, 2026-09-25) flags: a foreground must have clean OPAQUE
interiors and soft edges only where the silhouette meets the background. This pass maps alpha >= HI to 255
and leaves the edge band (0 < alpha < HI) untouched, then reports the distribution. Never touches RGB.

Usage: python3 tools/art/alpha_solidify.py [--hi 250] [--check] <file-or-dir> ...
  --check   report only (exit 1 if any file has no fully opaque pixel while having interior pixels)
"""
import argparse, os, sys
import numpy as np
from PIL import Image

EXT = ('.png', '.webp')

def stats(a):
    al = a[..., 3]
    return dict(min=int(al.min()), max=int(al.max()), transparent=float((al == 0).mean()),
                opaque=float((al == 255).mean()), near=float(((al >= 250) & (al < 255)).mean()),
                edge=float(((al > 0) & (al < 250)).mean()))

def solidify(path, hi, check):
    im = Image.open(path)
    if im.mode != 'RGBA':
        print(f'skip (not RGBA): {path}'); return True
    a = np.array(im); before = stats(a)
    bad = before['opaque'] == 0 and (before['near'] > 0)
    if check:
        print(f"{'FLAG' if bad else 'ok  '} {path} alpha max {before['max']} opaque {before['opaque']:.2%} near {before['near']:.2%} edge {before['edge']:.2%}")
        return not bad
    al = a[..., 3]; al[al >= hi] = 255; a[..., 3] = al
    out = Image.fromarray(a, 'RGBA')
    if path.lower().endswith('.webp'):
        out.save(path, 'WEBP', lossless=True, quality=100, method=6, exact=True)
    else:
        out.save(path, 'PNG', optimize=True)
    after = stats(np.array(Image.open(path)))
    print(f"solidified {path}: opaque {before['opaque']:.2%} -> {after['opaque']:.2%}, edge {after['edge']:.2%}, max {after['max']}")
    return True

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('paths', nargs='+'); ap.add_argument('--hi', type=int, default=250); ap.add_argument('--check', action='store_true')
    ns = ap.parse_args(); ok = True
    for p in ns.paths:
        files = [p] if os.path.isfile(p) else [os.path.join(d, f) for d, _, fs in os.walk(p) for f in fs if f.lower().endswith(EXT)]
        for f in sorted(files):
            ok = solidify(f, ns.hi, ns.check) and ok
    sys.exit(0 if ok else 1)

if __name__ == '__main__':
    main()
