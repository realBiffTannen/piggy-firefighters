#!/usr/bin/env python3
"""r2 derived layers (local, deterministic, free). Every input is re-placed from its raw paid output with the r1 fit
recorded in `<rig>/registration.json` (bit-identical to the r1 files), so re-running never compounds edits.

  split_body     body_no_head_no_arms -> body (no legs; chief/rookie: ends at the belt), coat_tails (belt to hem,
                 cut from the SAME registered body pixels, so it matches the master scale), leg_right/leg_left
                 (the body's own leg pixels, soles moved onto y=1440, hidden tops extended up under the coat)
  helmet_front   master pixels inside the registered helmet silhouette that are helmet-coloured (no seam: the
                 visible helmet IS the master), transparent where the head layer shows
  raised_arms    raised arm rotated about its shoulder pivot just enough to keep the fingertips on the canvas
  dog_legs       Ember's four legs as four layers (marker watershed on the ink ridges; the near front leg owns
                 the outline it shares with the far hind leg)
  skin_slots     each rescued skin cut into the template slots (head/body/arms/legs) on the same canvas
Per-rig parameters (read by eye, recorded with reasons) are in `<rig>/derive.layout.json`.
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from register_parts import CANVAS, FEET_Y, place, rgba  # noqa: E402

REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))


def load(rig, name):
    with open(os.path.join(HERE, rig, name)) as fh:
        return json.load(fh)


def r1_part(rig, name, reg=None):
    """Re-place a registered part from its raw output with the recorded r1 fit (identical to the r1 file)."""
    reg = reg or load(rig, "registration.json")
    v = reg["parts"][name]
    raw = rgba(os.path.join(REPO, v["raw"]))
    out = place(raw, v["fit"], tuple(reg["master"]["raw_shift"]))
    out[out[..., 3] == 0, :3] = 0
    return out


# ---------------------------------------------------------------------------------------------------- colours
def colour_classes(a):
    r, g, b = (a[..., i].astype(int) for i in range(3))
    al = a[..., 3] > 0
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    c = {}
    c["navy"] = al & (b > r + 25) & (b > 50) & (b >= g)
    c["red"] = al & (r > 140) & (g < 100) & (b < 100) & (r > g + 60)
    c["yellow"] = al & (r > 190) & (g > 140) & (b < 130) & (r - b > 90)
    c["grey"] = al & (mx - mn < 18) & (mx >= 38)
    c["cream"] = al & (r > 200) & (g > 170) & (b > 120) & (mx - mn < 95) & ~c["yellow"]
    c["skin"] = al & (r > 175) & (r - g > 45) & (g > 90) & (b > 70) & ~c["red"]
    c["shoe"] = al & (r >= 60) & (r < 185) & (g > 35) & (g < 135) & (b < 105) & (r > g + 15) & (g > b) & (mx >= 80)
    c["ink"] = al & (mx < 80) & ~c["grey"] & ~c["navy"]
    return c


def _nearest_label(assigned, todo):
    """Give every `todo` pixel the label of the nearest pixel with a nonzero label in `assigned`."""
    if not todo.any():
        return assigned
    idx = ndimage.distance_transform_edt(assigned == 0, return_distances=False, return_indices=True)
    out = assigned.copy()
    out[todo] = assigned[idx[0][todo], idx[1][todo]]
    return out


def _interp_cols(vals, W):
    xs = np.nonzero(~np.isnan(vals))[0]
    if len(xs) == 0:
        return vals
    return np.interp(np.arange(W), xs, vals[xs])


# ---------------------------------------------------------------------------------------------------- body split
def split_body(rig, cfg, reg=None):
    """-> dict name -> RGBA canvas array, plus metadata. See the module doc."""
    body = r1_part(rig, "body_no_head_no_arms", reg)
    H, W = body.shape[:2]
    al = body[..., 3] > 0
    c = colour_classes(body)
    yy = np.arange(H)[:, None] * np.ones((1, W), int)
    lower = al & (yy >= cfg["lower_from"])
    band = cfg.get("belt_band")
    U, L = 1, 2
    lab = np.zeros((H, W), np.uint8)
    if cfg["coat"]:
        in_band = (yy >= band[0]) & (yy < band[1])
        up_proper = c["red"] | c["skin"] | (c["grey"] & in_band)
        lo_proper = c["navy"] | ((c["grey"] | c["cream"]) & (yy >= band[1])) | c["shoe"]
        # a yellow band that touches the red coat is the coat's; the trouser bands only touch navy and ink
        yl, ny = ndimage.label(c["yellow"] & lower, structure=np.ones((3, 3)))
        if ny:
            red_near = ndimage.binary_dilation(c["red"], iterations=3)
            hit = np.unique(yl[red_near & (yl > 0)])
            up_proper = up_proper | np.isin(yl, hit[hit > 0])
    else:
        above = yy < cfg["upper_max_y"]  # shirt/tail colours below the hem are slipper highlights, not the body
        up_proper = (c["cream"] | c["skin"]) & above
        lo_proper = c["navy"] | c["shoe"] | c["grey"] | ((c["cream"] | c["skin"]) & ~above)
    lab[lower & up_proper] = U
    lab[lower & lo_proper & ~up_proper] = L
    # yellow bands and anything else coloured go to the nearest proper class; ink too, except that the ink within
    # `hem_ink_px` of the upper class belongs to the upper layer (the coat/shirt hem outline is drawn over the legs)
    rest = lower & (lab == 0)
    near = _nearest_label(lab, rest)
    d_up = ndimage.distance_transform_edt(lab != U)
    ink_like = rest & (c["ink"] | ~(c["yellow"] | c["navy"] | c["red"] | c["cream"] | c["skin"] | c["grey"]))
    near[ink_like & (d_up <= cfg["hem_ink_px"])] = U
    lab = np.where(lower, near, 0).astype(np.uint8)
    lab[al & ~lower] = U
    # tiny leg islands inside the coat (e.g. a grey highlight) go back to the upper layer
    legs_mask = lab == L
    cl, n = ndimage.label(legs_mask, structure=np.ones((3, 3)))
    sizes = np.bincount(cl.ravel())
    keep = [i for i in range(1, n + 1) if sizes[i] >= 3000]
    for i in range(1, n + 1):
        if i not in keep:
            lab[cl == i] = U
    meta = {"legs_components": len(keep)}
    legs_mask = np.isin(cl, keep)
    legs = split_two(legs_mask, body, c["ink"])  # image-left first = the character's RIGHT leg
    meta["legs_split"] = "separate components" if len(keep) == 2 else "joined at the crotch: separate regions below the crotch apex, a vertical cut through the apex above it"
    upper = lab == U
    out = {}
    # belt split (chief/rookie): body keeps everything down to the belt's bottom outline; coat_tails starts at the
    # belt's middle, so its cut edge is hidden under the belt
    tail = np.zeros_like(upper)
    if cfg["coat"]:
        belt = (c["grey"] | c["yellow"]) & (yy >= band[0]) & (yy < band[1]) & upper
        belt_grey = c["grey"] & (yy >= band[0]) & (yy < band[1])
        top = np.full(W, np.nan)
        bot = np.full(W, np.nan)
        for x in range(W):
            ys = np.nonzero(belt_grey[:, x])[0]
            if len(ys) >= 6:
                top[x] = ys.min()
                yb = np.nonzero(belt[:, x])[0].max()
                while yb + 1 < H and c["ink"][yb + 1, x] and yb - ys.max() < 40:
                    yb += 1
                bot[x] = yb
        top_i, bot_i = _interp_cols(top, W), _interp_cols(bot, W)
        bot_i = ndimage.maximum_filter1d(bot_i, 5)
        mid = (top_i + bot_i) / 2.0
        # the tail (skin below the belt) stays with the body
        sk = c["skin"] & upper & (yy >= band[0])
        if sk.any():
            mxv = body[..., :3].max(-1)
            gl, ng = ndimage.label(c["grey"] & (mxv < 120) & in_band, structure=np.ones((3, 3)))
            gsz = np.bincount(gl.ravel())
            belt_big = np.isin(gl, [i for i in range(1, ng + 1) if gsz[i] >= 2000])
            rl, nr = ndimage.label(c["red"] | c["yellow"], structure=np.ones((3, 3)))
            rsz = np.bincount(rl.ravel())
            coatcol = np.isin(rl, [i for i in range(1, nr + 1) if rsz[i] >= 3000]) | belt_big
            d_sk = ndimage.distance_transform_edt(~sk)
            d_coat = ndimage.distance_transform_edt(~coatcol)
            tail = upper & (yy >= band[0]) & ~coatcol & (d_sk <= cfg["tail_ink_px"]) & (d_sk < d_coat)
            tl, nt = ndimage.label(tail, structure=np.ones((3, 3)))
            tsz = np.bincount(tl.ravel())
            tail = np.isin(tl, [i for i in range(1, nt + 1) if tsz[i] >= 300])
            tail = ndimage.binary_fill_holes(tail) & upper
        body_m = upper & ((yy <= bot_i[None, :]) | tail)
        coat_m = upper & (yy >= np.floor(mid)[None, :]) & ~tail
        meta.update({"belt_top_y": [int(np.nanmin(top)), int(np.nanmax(top))],
                     "belt_bottom_y": [int(np.nanmin(bot)), int(np.nanmax(bot))], "tail_px": int(tail.sum())})
        out["coat_tails"] = np.where(coat_m[..., None], body, 0).astype(np.uint8)
    else:
        body_m = upper
    out["body_no_head_no_arms"] = np.where(body_m[..., None], body, 0).astype(np.uint8)
    # legs: the body's own leg pixels, soles moved onto the feet line (integer shift, lossless), hidden top extended
    ys = np.nonzero((legs[0] | legs[1]) & (body[..., 3] > 128))[0]
    dy = int(FEET_Y - ys.max())
    meta["legs_shift_y"] = dy
    names = ["leg_right", "leg_left"]
    both = np.zeros_like(body)
    for nm, m in zip(names, legs):
        leg = np.where(m[..., None], body, 0).astype(np.uint8)
        leg = np.roll(leg, dy, axis=0)
        if dy > 0:
            leg[:dy] = 0
        ext = extend_top(leg, np.roll(upper, dy, axis=0), cfg["leg_extend_px"])
        meta[f"{nm}_extended_px"] = int(ext)
        out[nm] = leg
        both = np.where(leg[..., 3:4] > 0, leg, both)
    out["legs"] = both
    return out, meta


def split_two(mask, img, ink):
    """Split a mask into its two largest parts, left then right. Joined parts (trousers meeting at the crotch) are
    split by a marker watershed on the ink ridge, seeded by the two separate parts found lower down."""
    lab, n = ndimage.label(mask, structure=np.ones((3, 3)))
    sizes = np.bincount(lab.ravel())
    big = [i for i in range(1, n + 1) if sizes[i] >= 3000]
    if len(big) >= 2:
        big = sorted(sorted(big, key=lambda i: -sizes[i])[:2], key=lambda i: np.nonzero(lab == i)[1].mean())
        return [lab == i for i in big]
    ys = np.nonzero(mask.any(axis=1))[0]
    y0, h = ys.min(), ys.max() - ys.min()
    yy = np.arange(mask.shape[0])[:, None]
    for frac in np.arange(0.15, 0.9, 0.05):
        sub, k = ndimage.label(mask & (yy >= y0 + frac * h), structure=np.ones((3, 3)))
        ss = np.bincount(sub.ravel())
        seeds = [i for i in range(1, k + 1) if ss[i] >= 3000]
        if len(seeds) >= 2:
            break
    else:
        raise RuntimeError("could not find two separate legs")
    seeds = sorted(sorted(seeds, key=lambda i: -ss[i])[:2], key=lambda i: np.nonzero(sub == i)[1].mean())
    a_m, b_m = sub == seeds[0], sub == seeds[1]
    # crotch apex: the top of the background gap between the two separate legs
    ycut = int(y0 + frac * h)
    row_a = np.nonzero(a_m[ycut + 2])[0]
    row_b = np.nonzero(b_m[ycut + 2])[0]
    gx = int((row_a.max() + row_b.min()) / 2) if len(row_a) and len(row_b) else int(
        (np.nonzero(a_m.any(axis=0))[0].max() + np.nonzero(b_m.any(axis=0))[0].min()) / 2)
    r0 = ycut + 2
    x_lo = row_a.max() + 1 if len(row_a) else gx
    x_hi = row_b.min() if len(row_b) else gx + 1
    best = None
    for x in range(int(x_lo), int(x_hi)):
        y = r0
        while y > y0 and not mask[y, x]:
            y -= 1
        if best is None or y < best[1]:
            best = (x, y)
    xc, yc = best
    # below the crotch apex the legs are two separate regions; above it they are cut vertically at the apex
    xx = np.arange(mask.shape[1])[None, :]
    low, k2 = ndimage.label(mask & (yy > yc), structure=np.ones((3, 3)))
    ls = np.bincount(low.ravel())
    two = sorted(sorted([i for i in range(1, k2 + 1)], key=lambda i: -ls[i])[:2],
                 key=lambda i: np.nonzero(low == i)[1].mean())
    lab2 = np.zeros(mask.shape, np.int16)
    lab2[low == two[0]] = 1
    lab2[low == two[1]] = 2
    top = mask & (yy <= yc)
    lab2[top & (xx < xc)] = 1
    lab2[top & (xx >= xc)] = 2
    lab2 = _nearest_label(lab2, mask & (lab2 == 0))  # stray specks below the apex
    return [lab2 == 1, lab2 == 2]


def extend_top(leg, covered, height):
    """Extend a leg's top edge straight up by `height` px where it meets the coat/shirt (hidden at rest under that
    layer), repeating the colour a few px below the cut, so a rotating leg never opens a gap under the hem."""
    al = leg[..., 3] > 0
    cols = np.nonzero(al.any(axis=0))[0]
    n = 0
    for x in cols:
        ys = np.nonzero(al[:, x])[0]
        yt = ys.min()
        if yt == 0 or not covered[max(0, yt - 3):yt, x].any():
            continue
        src = leg[min(yt + 3, ys.max()), x].copy()
        y0 = max(0, yt - height)
        leg[y0:yt, x] = src
        n += yt - y0
    return n


# ---------------------------------------------------------------------------------------------------- helmet_front
def _palette(pixels, k, seed=0):
    rng = np.random.default_rng(seed)
    px = pixels.astype(np.float32)
    if len(px) > 20000:
        px = px[rng.choice(len(px), 20000, replace=False)]
    cent = px[rng.choice(len(px), k, replace=False)]
    for _ in range(25):
        lab = np.argmin(((px[:, None, :] - cent[None]) ** 2).sum(-1), axis=1)
        cent = np.array([px[lab == j].mean(0) if (lab == j).any() else cent[j] for j in range(k)])
    return cent


def _min_dist(pixels, pal):
    d = np.full(len(pixels), np.inf, np.float32)
    px = pixels.astype(np.float32)
    for c in pal:
        d = np.minimum(d, np.sqrt(((px - c) ** 2).sum(-1)))
    return d


def helmet_front_v2(rig, cfg, master, reg=None):
    """Layer-ready helmet taken from the MASTER's own pixels, so at rest it is the master and no seam can appear.

    1. palettes: k-means colours of helmet_only and of the head layer (ink excluded)
    2. near the registered helmet (its footprint + `zone_px`), a master pixel is head-coloured when it is clearly
       nearer the head palette and belongs to a sizeable head area (thin shading bands on the shell stay helmet)
    3. the helmet = the helmet-coloured regions of the master that touch the registered helmet's core (the navy
       lining excluded: it sits over the face), plus the ink within `ink_px` of them
    4. no hole at rest: a master pixel next to the helmet that the head layer does not cover is kept too
    5. clean-up: islands under `min_island_frac` of the helmet and thin spurs (head-outline crumbs) are dropped
    Where the master shows the head, the layer is transparent and head_no_helmet shows through."""
    helm = r1_part(rig, "helmet_only", reg)
    head = r1_part(rig, cfg.get("head_part", "head_no_helmet"), reg)
    hr, hg, hb = (helm[..., i].astype(int) for i in range(3))
    ha = helm[..., 3] > 0
    lining = ndimage.binary_closing(ha & (hb > hr + 25) & (hb > 50), iterations=2)
    core = ndimage.binary_erosion(ha & ~lining, iterations=6)
    zone = ndimage.binary_dilation(ha, iterations=cfg["zone_px"])
    # under the brim (the painted lining, eroded `lining_margin_px`) the master shows the face: never helmet
    if cfg.get("lining_margin_px"):
        zone &= ~ndimage.binary_erosion(lining, iterations=cfg["lining_margin_px"])
    mo = master[..., 3] > 0
    lum = master[..., :3].max(-1)
    ink = mo & (lum < 80)
    hp = helm[..., :3][(helm[..., 3] > 200) & (helm[..., :3].max(-1) >= 80) & ~lining]
    kp = head[..., :3][(head[..., 3] > 200) & (head[..., :3].max(-1) >= 80)]
    pal_h, pal_k = _palette(hp, 10), _palette(kp, 10)
    sel = zone & mo & ~ink
    dh = _min_dist(master[..., :3][sel], pal_h)
    dk = _min_dist(master[..., :3][sel], pal_k)
    is_head = np.zeros(master.shape[:2], bool)
    is_head[sel] = dk + cfg["palette_margin"] < dh
    hc = ndimage.binary_opening(is_head, iterations=2)
    cl, n = ndimage.label(hc)
    sizes = np.bincount(cl.ravel())
    hc = np.isin(cl, [i for i in range(1, n + 1) if sizes[i] >= cfg["min_head_area_px"]])
    is_head &= ndimage.binary_dilation(hc, iterations=3)
    helm_col = sel & ~is_head
    cl, n = ndimage.label(helm_col, structure=np.ones((3, 3)))
    touch = np.unique(cl[core & (cl > 0)])
    is_helm = np.isin(cl, touch[touch > 0])
    if cfg.get("white_needs_enclosure"):
        # white fur and a white shell highlight have the same colour: white counts as helmet only inside the shell
        mm = master[..., :3].astype(int)
        white = mo & (mm.min(-1) > 200)
        is_helm &= ~white | ndimage.binary_fill_holes(is_helm & ~white)
    d_helm = ndimage.distance_transform_edt(~is_helm)
    is_helm |= zone & ink & (d_helm <= cfg["ink_px"])
    fill = zone & mo & ~is_helm & ~ndimage.binary_dilation(head[..., 3] > 128, iterations=1) & \
        (d_helm <= cfg["fill_reach_px"])
    keep = is_helm | fill
    out = np.where(keep[..., None], master, 0).astype(np.uint8)
    # the helmet is one piece: drop islands (eye catch-lights, ear-edge crumbs) smaller than `min_island_frac` of it
    lab, n = ndimage.label(out[..., 3] > 0, structure=np.ones((3, 3)))
    if n > 1:
        sizes = np.bincount(lab.ravel())
        small = [i for i in range(1, n + 1) if sizes[i] < max(cfg["min_island_px"], cfg["min_island_frac"] * sizes[1:].max())]
        out[np.isin(lab, small)] = 0
    # thin spurs hanging off the brim (head outline fragments) are cut by an opening that keeps the brim itself
    solid = out[..., 3] > 0
    opened = ndimage.binary_opening(solid, structure=np.ones((3, 3)), iterations=cfg["spur_px"])
    spur = solid & ~ndimage.binary_dilation(opened, structure=np.ones((3, 3)), iterations=cfg["spur_px"] + 1)
    sl, ns = ndimage.label(spur, structure=np.ones((3, 3)))
    if ns:
        ssz = np.bincount(sl.ravel())
        out[np.isin(sl, [i for i in range(1, ns + 1) if ssz[i] >= cfg["spur_min_px"]])] = 0
    out[out[..., 3] == 0, :3] = 0
    return out, {"helmet_px": int(is_helm.sum()), "gap_fill_px": int(fill.sum())}


# ---------------------------------------------------------------------------------------------------- raised arms
def place_affine(part, M, t, size=CANVAS):
    """Like register_parts.place, for a general 2x2 linear map M plus translation t (one resample, premultiplied
    bicubic): canvas point = M @ part point + t."""
    Mi = np.linalg.inv(np.asarray(M, float))
    ti = -Mi @ np.asarray(t, float)
    inv = (Mi[0, 0], Mi[0, 1], ti[0], Mi[1, 0], Mi[1, 1], ti[1])
    pm = part.astype(np.float32)
    pm[..., :3] *= pm[..., 3:4] / 255.0
    chans = [Image.fromarray(pm[..., c]).transform(size, Image.AFFINE, inv, resample=Image.BICUBIC) for c in range(4)]
    out = np.stack([np.array(c) for c in chans], axis=-1)
    a = np.clip(out[..., 3], 0, 255)
    rgb = np.where(a[..., None] > 0, out[..., :3] * 255.0 / np.maximum(a[..., None], 1e-3), 0)
    res = np.concatenate([np.clip(rgb, 0, 255), a[..., None]], axis=-1).astype(np.uint8)
    res[res[..., 3] < 8] = 0
    return res


def raised_arms(rig, cfg, reg=None):
    """Re-place each raised arm with its r1 fit, rotated about its recorded shoulder pivot by the smallest angle
    that keeps every opaque pixel `margin_px` inside the canvas (the shoulder stays exactly where r1 put it)."""
    reg = reg or load(rig, "registration.json")
    ent = reg["parts"]["arms_raised"]
    raw = rgba(os.path.join(REPO, ent["raw"]))
    lab, n = ndimage.label(raw[..., 3] > 40, structure=np.ones((3, 3)))
    sizes = np.bincount(lab.ravel())
    ids = sorted(range(1, n + 1), key=lambda i: -sizes[i])[:2]
    ids = sorted(ids, key=lambda i: np.nonzero(lab == i)[1].mean())
    out, meta = {}, {}
    W, H = CANVAS
    m = cfg["margin_px"]
    both = np.zeros((H, W, 4), np.uint8)
    for nm, i in zip(["arm_right_raised", "arm_left_raised"], ids):
        piece = raw.copy()
        piece[lab != i] = 0
        f = ent["split"][nm]["fit"]
        px, py = ent["split"][nm]["shoulder_pivot"]
        ys, xs = np.nonzero(piece[..., 3] > 0)
        pts = np.stack([xs, ys], 0).astype(float)
        best = None
        for step in range(0, 241):
            for sgn in ((1,) if step == 0 else (1, -1)):
                th = np.radians(sgn * step * 0.25)
                R = np.array([[np.cos(th), -np.sin(th)], [np.sin(th), np.cos(th)]])
                M = R * f["s"]
                t = R @ (np.array([f["tx"], f["ty"]]) - [px, py]) + [px, py]
                q = M @ pts + t[:, None]
                if q[0].min() >= m and q[0].max() <= W - 1 - m and q[1].min() >= m and q[1].max() <= H - 1 - m:
                    best = (sgn * step * 0.25, M, t)
                    break
            if best:
                break
        ang, M, t = best
        placed = place_affine(piece, M, t)
        out[nm] = placed
        both = np.where(placed[..., 3:4] > 0, placed, both)
        meta[nm] = {"rotation_deg_about_shoulder": ang, "shoulder_pivot": [px, py], "s": f["s"],
                    "affine": [[round(M[0, 0], 6), round(M[0, 1], 6), round(float(t[0]), 3)],
                               [round(M[1, 0], 6), round(M[1, 1], 6), round(float(t[1]), 3)]]}
    out["arms_raised"] = both
    return out, meta


# ---------------------------------------------------------------------------------------------------- dog legs
def dog_legs(rig, cfg, reg=None):
    """Cut Ember's four-leg layer into one layer per leg. Separate legs are separate components; where one leg
    overlaps another (the near front leg in front of the far hind leg) a marker watershed on the ink ridge splits
    them from one seed per leg (derive.layout.json), then the FRONT leg takes back the outline it shares with the
    leg behind it (ink within `outline_px` of its own fur). The hidden part of a rear leg is not painted."""
    legs = r1_part(rig, "legs", reg)
    al = legs[..., 3] > 0
    lum = legs[..., :3].max(-1)
    # the outline is dark red-brown (green channel ~0); the black spots are dark grey and count as fur here
    ink = al & (lum < 90) & (legs[..., 1] < cfg.get("outline_max_green", 14))
    names = list(cfg["seeds"])
    markers = np.zeros(al.shape, np.int16)
    markers[~al] = -1
    yy, xx = np.mgrid[:al.shape[0], :al.shape[1]]
    for k, nm in enumerate(names, 1):
        x, y = cfg["seeds"][nm]
        disc = ((xx - x) ** 2 + (yy - y) ** 2 <= 64) & al & ~ink
        if not disc.any():
            raise RuntimeError(f"seed {nm} is not inside fur")
        markers[disc] = k
    ws = ndimage.watershed_ift(np.where(ink, 255, 0).astype(np.uint8), markers)
    lab = np.where(al, np.maximum(ws, 0), 0).astype(np.int16)
    lab = _nearest_label(lab, al & (lab == 0))
    # a leg's pixels must stay within its own connected component of the layer
    comp, _ = ndimage.label(al, structure=np.ones((3, 3)))
    for k, nm in enumerate(names, 1):
        x, y = cfg["seeds"][nm]
        lab[(lab == k) & (comp != comp[y, x])] = 0
    lab = _nearest_label(lab, al & (lab == 0))
    for front, behind in cfg.get("front_of", {}).items():
        kf, kb = names.index(front) + 1, names.index(behind) + 1
        fur = (lab == kf) & ~ink
        d = ndimage.distance_transform_edt(~fur)
        lab[(lab == kb) & ink & (d <= cfg["outline_px"])] = kf
    out, meta = {}, {}
    for k, nm in enumerate(names, 1):
        m = lab == k
        cl, n = ndimage.label(m, structure=np.ones((3, 3)))
        if n > 1:  # stray islands go to their neighbour
            sizes = np.bincount(cl.ravel())
            big = int(np.argmax(sizes[1:])) + 1
            lab[m & (cl != big)] = 0
    lab = _nearest_label(lab, al & (lab == 0))
    for k, nm in enumerate(names, 1):
        out[nm] = np.where((lab == k)[..., None], legs, 0).astype(np.uint8)
        ys, xs = np.nonzero(lab == k)
        meta[nm] = {"bbox": [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1],
                    "px": int((lab == k).sum())}
    return out, meta


# ---------------------------------------------------------------------------------------------------- skin slots
SLOT_FRONT = ["arm_right", "head", "arm_left", "body", "leg_right", "leg_left"]  # front-most first


def template_label_map(masks):
    """Every canvas pixel -> the template slot that owns it: the front-most mask containing it, else the nearest."""
    H, W = next(iter(masks.values())).shape
    lab = np.zeros((H, W), np.int16)
    for k, nm in reversed(list(enumerate(SLOT_FRONT, 1))):
        lab[masks[nm]] = k
    return _nearest_label(lab, lab == 0)


def _poly_mask(poly, shape):
    from PIL import ImageDraw
    im = Image.new("L", (shape[1], shape[0]), 0)
    ImageDraw.Draw(im).polygon([tuple(p) for p in poly], fill=1)
    return np.array(im, bool)


def skin_slots(skin, masks, cfg, overrides=()):
    """Cut one full-figure skin into the template's slots on the same canvas.

    The drawing is split into CELLS (flat-colour regions bounded by ink). A cell goes whole to one slot when
    >= `cell_major` of it lies in that template slot (the template label map: front-most template mask, else the
    nearest), or to its majority slot when it is small (<= `small_cell_px`: a finger, a stripe); a large cell
    straddling two slots is split pixel-wise on the template boundary. An override polygon
    (derive.layout.json) claims every cell whose majority lies inside it, and the ink inside it: this keeps each
    skin's extras on the right slot (grandma's cat and dress, dad's robe skirt and the piggyback twin stay on the body; the lower twin's head
    is the head). Ink goes to the front-most slot among the cells within `ink_px` (the front part owns a shared
    outline), else the nearest. Islands under `island_px` join the neighbouring slot they touch most. Legs get the
    same hidden top extension as the template legs."""
    al = skin[..., 3] > 0
    r, g, b = (skin[..., i].astype(int) for i in range(3))
    ink = al & (np.maximum(np.maximum(r, g), b) < cfg["ink_lum"]) & (r >= b)
    TL = template_label_map(masks)
    cells, n = ndimage.label(al & ~ink)  # 4-connected: a thin ink line separates cells
    lab = np.zeros(al.shape, np.int16)
    idx = np.arange(1, n + 1)
    polys = [(SLOT_FRONT.index(o["slot"]) + 1, _poly_mask(o["polygon"], al.shape)) for o in overrides
             if o.get("mode", "cells") == "cells"]
    counts = np.stack([ndimage.sum(TL == k, cells, idx) for k in range(1, len(SLOT_FRONT) + 1)], 1)
    size = counts.sum(1)
    pcount = [ndimage.sum(pm, cells, idx) for _, pm in polys]
    for j in range(n):
        m_id = j + 1
        if size[j] == 0:
            continue
        claimed = None
        for (k, _), pc in zip(polys, pcount):
            if pc[j] > 0.5 * size[j]:
                claimed = k
                break
        if claimed is None and (counts[j].max() >= cfg["cell_major"] * size[j] or size[j] <= cfg["small_cell_px"]):
            claimed = int(np.argmax(counts[j])) + 1  # a small cell (finger, stripe) is never split
        if claimed is not None:
            lab[cells == m_id] = claimed
    split = (lab == 0) & al & ~ink
    lab[split] = TL[split]
    # ink inside a cells-mode override polygon belongs to that polygon's slot (first polygon wins, as for cells)
    for k, pm in reversed(polys):
        lab[pm & ink] = k
    # pixel overrides: every non-ink pixel inside the polygon (optionally only non-skin colours) joins the slot
    for o in overrides:
        if o.get("mode") != "pixels":
            continue
        pm = _poly_mask(o["polygon"], al.shape) & al & ~ink
        if o.get("not_skin"):
            pm &= ~((r > 190) & (g > 110) & (b > 90) & (r - g >= 45) & (r - g < 110))  # pig pink
        else:
            pm |= _poly_mask(o["polygon"], al.shape) & ink
        if o.get("only_from"):  # re-assign only pixels that the rules gave to these slots
            pm &= np.isin(lab, [SLOT_FRONT.index(x) + 1 for x in o["only_from"]])
        lab[pm] = SLOT_FRONT.index(o["slot"]) + 1
    # ink: the front-most slot among the cells within ink_px, else the nearest
    todo = ink & (lab == 0)
    near = _nearest_label(lab, todo)
    for k in range(1, len(SLOT_FRONT) + 1):
        close = todo & (ndimage.distance_transform_edt(lab != k) <= cfg["ink_px"])
        near[close & (lab == 0)] = k
        lab[close] = k
        todo &= ~close
    lab[todo] = near[todo]
    # crumbs: a slot's small islands (outline arcs cut off by a boundary) join the neighbouring slot they touch most
    for _ in range(2):
        for k in range(1, len(SLOT_FRONT) + 1):
            cl, n = ndimage.label(lab == k, structure=np.ones((3, 3)))
            if n < 2:
                continue
            sizes = np.bincount(cl.ravel())
            main = int(np.argmax(sizes[1:])) + 1
            for i in range(1, n + 1):
                if i == main or sizes[i] >= cfg["island_px"]:
                    continue
                isl = cl == i
                ring = ndimage.binary_dilation(isl, iterations=2) & ~isl & (lab > 0) & (lab != k)
                if ring.any():
                    lab[isl] = np.bincount(lab[ring]).argmax()
    out = {}
    for k, nm in enumerate(SLOT_FRONT, 1):
        out[nm] = np.where((lab == k)[..., None], skin, 0).astype(np.uint8)
    for nm in ("leg_right", "leg_left"):
        extend_top(out[nm], lab == SLOT_FRONT.index("body") + 1, cfg["leg_extend_px"])
    return out, lab
