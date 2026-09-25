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


def _labels(master, part, k=10):
    """Quantise the master's opaque colours to k labels and give every opaque pixel of both images its nearest
    label (-1 = transparent). Colour agreement is a far stronger registration cue than ink alone: the rookie's thin
    coat and a helmet brim both look like 'dense ink' to an ink-only score."""
    mo = master[..., 3] > 128
    pix = master[..., :3][mo].astype(np.float32)
    rng = np.random.default_rng(0)
    c = pix[rng.choice(len(pix), size=min(len(pix), 20000), replace=False)]
    cent = c[rng.choice(len(c), size=k, replace=False)]
    for _ in range(25):
        lab = np.argmin(((c[:, None, :] - cent[None]) ** 2).sum(-1), axis=1)
        cent = np.array([c[lab == j].mean(0) if (lab == j).any() else cent[j] for j in range(k)])

    def assign(a):
        out = np.full(a.shape[:2], -1, np.int16)
        o = a[..., 3] > 128
        px = a[..., :3][o].astype(np.float32)
        out[o] = np.argmin(((px[:, None, :] - cent[None]) ** 2).sum(-1), axis=1)
        return out
    return assign(master), assign(part), k


def fit(master, part, scales=None, q=4, yrange=None, srange=(0.35, 1.6)):
    """Return best {s, tx, ty, score}: part pixel (x, y) maps to master pixel (s*x + tx, s*y + ty).

    Score = colour-label agreement precision x recall (per-label FFT correlation at 1/q resolution), then a local
    refinement at 1/2 resolution. yrange=(lo, hi): the placed part's vertical centre must fall within lo..hi of the
    master's height; srange limits the scale search."""
    if scales is None:
        scales = np.exp(np.linspace(np.log(srange[0]), np.log(srange[1]), 60))
    ml, pl, k = _labels(master, part)
    ys, xs = np.nonzero(pl >= 0)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    pl_c = pl[y0:y1, x0:x1]

    def stacks(lab, f, dil):
        chans = []
        for j in range(k):
            ch = (lab == j).astype(np.float32)
            if f != 1:
                ch = ndimage.zoom(ch, f, order=1, prefilter=False)
            if dil:
                ch = ndimage.grey_dilation(ch, size=(dil, dil))
            chans.append(ch)
        return chans

    def search(qq, scale_list, window=None):
        M = stacks(ml, 1.0 / qq, 3)
        Ma = sum(stacks(ml, 1.0 / qq, 0))
        best = None
        for s_ in scale_list:
            P = stacks(pl_c, s_ / qq, 0)
            Pa = sum(P)
            if Pa.shape[0] < 4 or Pa.shape[1] < 4 or Pa.shape[0] > Ma.shape[0] * 1.3 or Pa.shape[1] > Ma.shape[1] * 1.3:
                continue
            n_p = Pa.sum() + 1e-6
            num = sum(_fftcorr(M[j], P[j]) for j in range(k) if P[j].any())
            den = _fftcorr(np.clip(Ma, 0, 1), Pa) + 1e-6
            sc = (num / n_p) * np.clip(num / den, 0, 1)
            H = Ma.shape[0] - int(Pa.shape[0] * 0.9)
            W = Ma.shape[1] - int(Pa.shape[1] * 0.9)
            if H <= 0 or W <= 0:
                continue
            sc = sc[:H, :W].copy()
            if yrange is not None:
                cy = np.arange(H) + Pa.shape[0] / 2.0
                sc[(cy < yrange[0] * Ma.shape[0]) | (cy > yrange[1] * Ma.shape[0]), :] = -1
            if window is not None:
                (wx, wy, r) = window
                mask = np.full(sc.shape, -1.0)
                ya, yb = max(0, int(wy / qq) - r), min(H, int(wy / qq) + r + 1)
                xa, xb = max(0, int(wx / qq) - r), min(W, int(wx / qq) + r + 1)
                mask[ya:yb, xa:xb] = 0
                sc = np.where(mask == 0, sc, -1)
            kk = np.unravel_index(np.argmax(sc), sc.shape)
            v = float(sc[kk])
            if best is None or v > best[0]:
                best = (v, float(s_), kk[1] * qq, kk[0] * qq)
        return best

    v, s, ox, oy = search(q, scales)
    v2, s2, X, Y = search(2, s * np.linspace(0.96, 1.04, 9), window=(ox, oy, 6))
    return {"s": float(s2), "tx": float(X - s2 * x0), "ty": float(Y - s2 * y0), "score": round(float(v2), 4),
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
