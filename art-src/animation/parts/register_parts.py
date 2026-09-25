#!/usr/bin/env python3
"""Register same-framing rig-part edits to their rig master (local, deterministic, free).

gpt-image edits do not keep pixel framing: a kept part may come back shifted or rescaled (the head-only edit is
often enlarged). This tool finds, for every part, the similarity transform (uniform scale s + translation, no
rotation) that best lays the part's dark-brown ink over the master's ink, then writes the part onto the COMMON
CANVAS of its rig:

  canvas 1024x1536 RGBA, feet line y = FEET_Y (1440), feet centre x = FEET_X (512)

The master itself is only translated by whole pixels (lossless). Parts are resampled once (Lanczos) by the fitted
scale. Raw model outputs in art-src/generated/rig_<rig>/ are never modified.

Library use: fit(master_rgba, part_rgba) -> dict(s, tx, ty, score); place(part, fit, shift) -> RGBA canvas.
"""
import numpy as np
from PIL import Image
from scipy import ndimage

CANVAS = (1024, 1536)
FEET_Y = 1440
FEET_X = 512


def rgba(path):
    im = Image.open(path).convert("RGBA")
    a = np.array(im)
    al = a[..., 3].astype(np.float32)
    al = np.clip((al - 20) * 255.0 / (240 - 20), 0, 255)  # model alpha tops out at 254; cut the faint halo
    a[..., 3] = al.astype(np.uint8)
    a[a[..., 3] == 0, :3] = 0
    return a


def ink(a):
    rgb = a[..., :3].astype(np.int32)
    lum = rgb.max(axis=2)
    return ((a[..., 3] > 128) & (lum < 95)).astype(np.float32)


def feet(a):
    """Bottom alpha row (sole line) and the horizontal centre of the soles (bottom 2 % of the figure)."""
    al = a[..., 3] > 128
    ys, xs = np.nonzero(al)
    y1 = ys.max()
    band = al[max(0, y1 - int(0.02 * (y1 - ys.min()))):y1 + 1]
    bx = np.nonzero(band.any(axis=0))[0]
    return int(y1), float((bx.min() + bx.max()) / 2.0)


def master_shift(a):
    y1, cx = feet(a)
    return int(round(FEET_X - cx)), int(FEET_Y - y1)


def _resize(arr, s, order=1):
    return ndimage.zoom(arr, s, order=order, prefilter=False)


def _fftcorr(big, small):
    """valid-ish cross-correlation via FFT: out[y,x] = sum small[i,j]*big[y+i,x+j] (circular, big padded)."""
    H = big.shape[0] + small.shape[0]
    W = big.shape[1] + small.shape[1]
    Fb = np.fft.rfft2(big, (H, W))
    Fs = np.fft.rfft2(small[::-1, ::-1], (H, W))
    c = np.fft.irfft2(Fb * Fs, (H, W))
    # index (y + sh - 1, x + sw - 1) holds placement of small's top-left at (y, x)
    return c[small.shape[0] - 1:, small.shape[1] - 1:]


def fit(master, part, scales=None, q=4):
    """Return best {s, tx, ty, score}: part pixel (x, y) maps to master pixel (s*x + tx, s*y + ty)."""
    if scales is None:
        scales = np.exp(np.linspace(np.log(0.35), np.log(1.6), 70))
    mi = ink(master)
    pi = ink(part)
    pal = (part[..., 3] > 128).astype(np.float32)
    ys, xs = np.nonzero(pal)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    pi_c, pal_c = pi[y0:y1, x0:x1], pal[y0:y1, x0:x1]
    mq = _resize(mi, 1.0 / q)
    mq_d = ndimage.grey_dilation(mq, size=(3, 3))
    best = None
    for s in scales:
        f = s / q
        p = _resize(pi_c, f)
        if p.shape[0] < 4 or p.shape[1] < 4 or p.shape[0] > mq.shape[0] * 1.3 or p.shape[1] > mq.shape[1] * 1.3:
            continue
        pa = _resize(pal_c, f)
        pd = ndimage.grey_dilation(p, size=(3, 3))
        n_p = p.sum() + 1e-6
        prec = _fftcorr(mq_d, p) / n_p
        rec_num = _fftcorr(mq, pd)
        rec_den = _fftcorr(mq, pa) + 1e-6
        rec = np.clip(rec_num / rec_den, 0, 1)
        sc = prec * rec
        # only placements that keep the part on the master canvas (allow 10 % overhang)
        H = mq.shape[0] - int(p.shape[0] * 0.9)
        W = mq.shape[1] - int(p.shape[1] * 0.9)
        if H <= 0 or W <= 0:
            continue
        sc = sc[:H, :W]
        k = np.unravel_index(np.argmax(sc), sc.shape)
        v = float(sc[k])
        if best is None or v > best[0]:
            best = (v, s, k[1] * q, k[0] * q)
    v, s, ox, oy = best
    # refine at full resolution: scale +-3 %, translation +-6 px
    mi_d = ndimage.grey_dilation(mi, size=(3, 3))
    bestf = None
    for s2 in s * np.linspace(0.97, 1.03, 13):
        p = _resize(pi_c, s2)
        n_p = p.sum() + 1e-6
        for dy in range(-6, 7, 2):
            for dx in range(-6, 7, 2):
                X, Y = int(ox + dx), int(oy + dy)
                if X < 0 or Y < 0:
                    continue
                hh = min(p.shape[0], mi.shape[0] - Y)
                ww = min(p.shape[1], mi.shape[1] - X)
                if hh <= 0 or ww <= 0:
                    continue
                o = (mi_d[Y:Y + hh, X:X + ww] * p[:hh, :ww]).sum() / n_p
                if bestf is None or o > bestf[0]:
                    bestf = (o, s2, X, Y)
    o, s2, X, Y = bestf
    for dy in (-1, 0, 1):  # 1 px polish
        for dx in (-1, 0, 1):
            pass
    return {"s": float(s2), "tx": float(X - s2 * x0), "ty": float(Y - s2 * y0), "precision": round(float(o), 4),
            "coarse_score": round(v, 4)}


def place(part, f, shift=(0, 0), size=CANVAS):
    """Warp the part by the fit, then translate by the master's canvas shift. Returns an RGBA uint8 array."""
    im = Image.fromarray(part)
    # premultiply to avoid dark fringes when resampling
    pm = part.astype(np.float32)
    pm[..., :3] *= pm[..., 3:4] / 255.0
    s, tx, ty = f["s"], f["tx"] + shift[0], f["ty"] + shift[1]
    inv = (1.0 / s, 0, -tx / s, 0, 1.0 / s, -ty / s)
    chans = [Image.fromarray(pm[..., c]).transform(size, Image.AFFINE, inv, resample=Image.BICUBIC) for c in range(4)]
    out = np.stack([np.array(c) for c in chans], axis=-1)
    a = np.clip(out[..., 3], 0, 255)
    rgb = np.where(a[..., None] > 0, out[..., :3] * 255.0 / np.maximum(a[..., None], 1e-3), 0)
    res = np.concatenate([np.clip(rgb, 0, 255), a[..., None]], axis=-1).astype(np.uint8)
    res[res[..., 3] < 8] = 0
    return res
