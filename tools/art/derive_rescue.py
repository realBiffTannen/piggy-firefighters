#!/usr/bin/env python3
"""Derive the PIGGY FIREFIGHTERS Rescue-scene sprites and the reel-cell UI sprites from accepted gpt-image outputs
(art-src/generated/scene/**, never modified). Subcommands (default: all):

  rooms   features/rescue/room_<r>_<state>.webp + room_<r>_inferno_<state>.webp (r = reel 0..4 left to right;
          state = roaring (fire level 2) | smouldering (1) | safe (0)), block_facade.webp + block_facade_inferno.webp,
          rooms.meta.json. Each state painting is a same-framing edit of its plate (scene/plate_rescue_16_9 or
          scene/plate_inferno_16_9): it is registered back onto the plate (ECC affine on the static parts), colour-matched
          (per-channel gain/offset fitted on the static parts), then every room keeps only the pixels that changed and
          touch its window (feathered), so a room sprite laid over the plate at its box shows the state and nothing else.
          All six states of a room share ONE box, so the runtime swaps textures without moving anything.
  props   features/rescue/{ladder_segment, ladder_top, jump_sheet, badge_blank, spins_plate_blank, hose_nozzle,
          hose_segment, water_jet, water_splash, steam_puff}.webp + props.meta.json (ladder segment = whole rung periods,
          seamless vertical repeat; hose segment = seamless horizontal repeat; blank plates are lettered at runtime)
  cells   ui_scene/cell_frame_{plain,win,locked}.webp 384x384 + ui_scene/line_plate.webp + ui_scene/cells.meta.json

Sources: SRC below (art-src/generated/scene/*), --map <json> overrides any key.
--out <assets root> redirects every write (tests / staging); --contact <png> writes a review sheet.
"""
import argparse
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from art_common import (exists_src, load_rgb, load_rgba, out_root, prepare_out, rel, save_webp, src_path,  # noqa: E402
                        write_json)

STATES = (("roaring", 2), ("smouldering", 1), ("safe", 0))
# accepted sources (override any key with --map <json>); state paintings are same-framing edits of their plate
SRC = {
    "plate_rescue": "scene/plate_rescue_16_9", "plate_inferno": "scene/plate_inferno_16_9",
    "rescue_roaring": "scene/rooms_fire2", "rescue_smouldering": "scene/rooms_fire1", "rescue_safe": "scene/rooms_safe",
    "inferno_roaring": "scene/inferno_rooms_fire2", "inferno_smouldering": "scene/inferno_rooms_fire1",
    "inferno_safe": "scene/inferno_rooms_safe",
    "portrait_rescue": "scene/plate_rescue_portrait", "portrait_inferno": "scene/plate_inferno_portrait",
    "props_a": "scene/rescue_props_a", "props_b": "scene/rescue_props_b", "ui_frames": "scene/ui_frames",
}


def sets():
    return {m: (SRC[f"plate_{m}"], {st: SRC[f"{m}_{st}"] for st, _ in STATES}) for m in ("rescue", "inferno")}


ENV_LAND, ENV_PORT = (2039, 1000), (1242, 2208)


# ------------------------------------------------------------------------------------------------- geometry
def window_interiors(rgb, top_frac=0.5):
    """The five dark open-window interiors in the upper half of a plate, left to right: [(x0,y0,x1,y1)]."""
    a = np.asarray(rgb).astype(int)
    H, W, _ = a.shape
    m = (a.mean(2) < 45) & (a[:, :, 2] >= a[:, :, 0])
    m[int(H * top_frac):] = False
    lab, _ = ndi.label(m)
    boxes = []
    for i, sl in enumerate(ndi.find_objects(lab)):
        if sl is None:
            continue
        w, h = sl[1].stop - sl[1].start, sl[0].stop - sl[0].start
        if (lab[sl] == i + 1).sum() > 1500 and w < W * 0.2 and 0.4 < w / h < 1.6:
            boxes.append((sl[1].start, sl[0].start, sl[1].stop, sl[0].stop))
    boxes.sort()
    if len(boxes) != 5:
        raise SystemExit(f"expected 5 window interiors, found {len(boxes)}: {boxes}")
    return boxes


def window_frames(rgb, interiors):
    """Outer box of each window's stone/gold frame + sill: walk out from the interior until the brick starts."""
    a = np.asarray(rgb).astype(int)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    brickish = (r > g + 55) & (r > b + 55) & (g < 120)  # saturated red brick (frames are cream / gold / ink)
    out = []
    for x0, y0, x1, y1 in interiors:
        cy, cx = (y0 + y1) // 2, (x0 + x1) // 2
        def run(line, start, step):
            k, streak = start, 0
            while 0 <= k < len(line):
                streak = streak + 1 if line[k] else 0
                if streak >= 6:
                    return k - step * 5
                k += step
            return k
        row, col = brickish[cy], brickish[:, cx]
        fx0, fx1 = run(row, x0, -1), run(row, x1, 1)
        fy0, fy1 = run(col, y0, -1), run(col, y1, 1)
        out.append((int(fx0), int(fy0), int(fx1), int(fy1)))
    return out


def facade_box(rgb, interiors):
    """The block's brick facade from the cornice top to a little below the window row (plate px)."""
    a = np.asarray(rgb).astype(int)
    H, W, _ = a.shape
    y_probe = min(H - 1, interiors[0][3] + 60)
    r, g, b = a[y_probe, :, 0], a[y_probe, :, 1], a[y_probe, :, 2]
    brick = (r > b + 40) & (r > g + 30)
    xs = np.where(brick)[0]
    mid = W // 2
    left = xs[xs < mid].min() if (xs < mid).any() else 0
    right = xs[xs > mid].max() + 1 if (xs > mid).any() else W
    # cornice top: walking up from the centre window's frame, the first run of sky rows (blue >= red; brick, cream
    # stone and the cornice are all red-dominant) marks the top of the building
    frames = window_frames(rgb, interiors)
    cx = (interiors[2][0] + interiors[2][2]) // 2
    col = a[:, cx]
    y, sky_run = frames[2][1] - 1, 0
    while y > 0:
        sky_run = sky_run + 1 if col[y][2] >= col[y][0] else 0
        if sky_run >= 8:
            break
        y -= 1
    top = y + 8
    bottom = min(H, max(f[3] for f in interiors) + 110)
    return int(left), int(max(0, top)), int(right), int(bottom)


# ------------------------------------------------------------------------------------------------- registration
def register(edit, base, static_mask):
    """ECC affine edit -> base on the static parts; returns (warped RGB array, 2x3 matrix, correlation)."""
    g_e = cv2.cvtColor(edit, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
    g_b = cv2.cvtColor(base, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
    warp = np.eye(2, 3, dtype=np.float32)
    crit = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6)
    try:
        cc, warp = cv2.findTransformECC(g_b, g_e, warp, cv2.MOTION_AFFINE, crit, static_mask.astype(np.uint8), 5)
    except cv2.error:
        cc = float("nan")
    h, w = base.shape[:2]
    out = cv2.warpAffine(edit, warp, (w, h), flags=cv2.INTER_CUBIC + cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE)
    return out, warp, float(cc)


def colour_match(src, ref, mask):
    """Per-channel least-squares gain/offset (src -> ref) fitted on `mask`; returns the corrected src."""
    out = src.astype(np.float32).copy()
    fit = []
    for c in range(3):
        x, y = src[:, :, c][mask].astype(np.float32), ref[:, :, c][mask].astype(np.float32)
        A = np.stack([x, np.ones_like(x)], 1)
        (k, b), *_ = np.linalg.lstsq(A, y, rcond=None)
        out[:, :, c] = out[:, :, c] * k + b
        fit.append((round(float(k), 4), round(float(b), 2)))
    return np.clip(out, 0, 255).astype(np.uint8), fit


def room_alpha(edit, base, box, win, feather=2.5, thr=38):
    """Alpha for one room inside `box`: changed pixels whose region touches the window, holes filled, feathered;
    the whole window frame is always opaque so every state replaces the same window completely."""
    x0, y0, x1, y1 = box
    e = edit[y0:y1, x0:x1].astype(int)
    b = base[y0:y1, x0:x1].astype(int)
    d = np.abs(e - b).max(2).astype(np.float32)
    d = ndi.gaussian_filter(d, 1.2)
    m = d > thr
    m = ndi.binary_opening(m, iterations=1)
    wx0, wy0, wx1, wy1 = win[0] - x0, win[1] - y0, win[2] - x0, win[3] - y0
    seed = np.zeros_like(m)
    seed[max(0, wy0 - 12):wy1 + 12, max(0, wx0 - 12):wx1 + 12] = True
    lab, _ = ndi.label(ndi.binary_dilation(m, iterations=3))
    keep = np.unique(lab[seed & (lab > 0)])
    m = np.isin(lab, keep[keep > 0]) & ndi.binary_dilation(m, iterations=2)
    m[max(0, wy0):wy1, max(0, wx0):wx1] = True
    m = ndi.binary_fill_holes(ndi.binary_closing(m, iterations=3))
    a = ndi.gaussian_filter(m.astype(np.float32), feather)
    a = np.clip((a - 0.08) / 0.84, 0, 1)
    # never let the feather reach the sprite border (a hard crop edge would show over the plate)
    edge = np.ones_like(a)
    ramp = 6
    for i in range(ramp):
        f = (i + 1) / (ramp + 1)
        edge[i, :] = np.minimum(edge[i, :], f)
        edge[-1 - i, :] = np.minimum(edge[-1 - i, :], f)
        edge[:, i] = np.minimum(edge[:, i], f)
        edge[:, -1 - i] = np.minimum(edge[:, -1 - i], f)
    return (a * edge * 255).astype(np.uint8)


def scale_box(box, src_size, dst_size):
    """Map a plate-px box through derive_scene's cover-crop onto an environment size."""
    sw, sh = src_size
    dw, dh = dst_size
    k = max(dw / sw, dh / sh)
    ox, oy = (sw * k - dw) / 2, (sh * k - dh) / 2
    x0, y0, x1, y1 = box
    return [round(x0 * k - ox, 1), round(y0 * k - oy, 1), round(x1 * k - ox, 1), round(y1 * k - oy, 1)]


def cmd_rooms(root, pending, contact):
    out = prepare_out(os.path.join(root, "features", "rescue"))
    meta = {"generated_by": "tools/art/derive_rescue.py rooms", "states": {n: lvl for n, lvl in STATES},
            "note": ("Room r sits over reel column r. Draw room_<r>_<state>.webp (or room_<r>_inferno_<state>.webp) with its "
                     "top-left at box[0..1] in plate px over the plate (or over the facade at facade_box); every state of "
                     "a room shares the same box. Fire level 2 = roaring, 1 = smouldering, 0 = safe (lit window). Alpha "
                     "outside the changed area is 0, so the plate shows through. Portrait plates: place the same sprites "
                     "centred on portrait.window_centre, scaled by portrait.scale."),
            "rooms": [], "facade": {"files": {}}, "sets": {}}
    SETS = sets()
    if not exists_src(SETS["rescue"][0]):
        pending.append("rooms")
        return
    base_rescue = np.asarray(load_rgb(SETS["rescue"][0]))
    H, W = base_rescue.shape[:2]
    interiors = window_interiors(base_rescue)
    frames = window_frames(base_rescue, interiors)
    pitch = float(np.mean(np.diff([(f[0] + f[2]) / 2 for f in frames])))
    fbox = facade_box(base_rescue, interiors)
    # one shared box per room: half a pitch either side of the window centre, cornice to below the sill
    boxes = []
    for f in frames:
        cx = (f[0] + f[2]) / 2
        x0, x1 = int(round(cx - pitch / 2)), int(round(cx + pitch / 2))
        y0 = max(0, fbox[1] - 24)  # smoke puffs may rise over the cornice
        y1 = min(H, f[3] + 70)  # drips / soot below the sill
        boxes.append((x0, y0, x1, y1))
    sheet = []
    for set_name, (plate_src, states) in SETS.items():
        if not exists_src(plate_src) or not all(exists_src(s) for s in states.values()):
            pending.append(f"rooms:{set_name}")
            continue
        base = np.asarray(load_rgb(plate_src))
        ints = window_interiors(base)
        frs = window_frames(base, ints)
        static = np.ones(base.shape[:2], bool)
        static[max(0, fbox[1] - 80):fbox[3] + 20, fbox[0]:fbox[2]] = False  # everything except the window band
        info = {"plate": rel(src_path(plate_src)), "window_interiors": ints, "window_frames": frs, "states": {}}
        for st, src in states.items():
            edit = np.asarray(load_rgb(src))
            reg, warp, cc = register(edit, base, static)
            reg, fit = colour_match(reg, base, static & (ndi.uniform_filter(base.mean(2), 5) > 0))
            resid = float(np.abs(reg.astype(int) - base.astype(int))[static].mean())
            info["states"][st] = {"source": rel(src_path(src)), "ecc_affine": np.round(warp, 5).tolist(),
                                  "ecc_cc": round(cc, 4), "colour_fit": fit, "static_mean_abs_diff": round(resid, 2)}
            row = []
            for r, (box, win) in enumerate(zip(boxes, frs)):
                a = room_alpha(reg, base, box, win)
                x0, y0, x1, y1 = box
                rgba = np.dstack([reg[y0:y1, x0:x1], a])
                rgba[a == 0, :3] = 0
                name = f"room_{r}_{st}.webp" if set_name == "rescue" else f"room_{r}_inferno_{st}.webp"
                n = save_webp(Image.fromarray(rgba, "RGBA"), os.path.join(out, name), quality=90)
                print(f"features/rescue/{name} {x1 - x0}x{y1 - y0} {n} B")
                row.append(rgba)
            sheet.append((set_name, st, base, row))
        meta["sets"][set_name] = info
        # the facade band (for the runtime's building band above the frame)
        fx0, fy0, fx1, fy1 = fbox
        fac = Image.fromarray(base[fy0:fy1, fx0:fx1], "RGB")
        fname = "block_facade.webp" if set_name == "rescue" else "block_facade_inferno.webp"
        n = save_webp(fac, os.path.join(out, fname), quality=88)
        meta["facade"]["files"][set_name] = fname
        print(f"features/rescue/{fname} {fac.size} {n} B")
    meta["plate_size"] = [W, H]
    meta["facade"]["box"] = list(fbox)
    meta["pitch_px"] = round(pitch, 1)
    for r, (box, win, inn) in enumerate(zip(boxes, frames, interiors)):
        files = {st: f"room_{r}_{st}.webp" for st, _ in STATES}
        files.update({f"inferno_{st}": f"room_{r}_inferno_{st}.webp" for st, _ in STATES})
        files = {k: v for k, v in files.items() if os.path.isfile(os.path.join(out, v))}
        meta["rooms"].append({
            "reel": r, "box": list(box), "size": [box[2] - box[0], box[3] - box[1]],
            "window": list(win), "window_interior": list(inn),
            "box_in_facade": [box[0] - fbox[0], box[1] - fbox[1], box[2] - fbox[0], box[3] - fbox[1]],
            "window_in_facade": [win[0] - fbox[0], win[1] - fbox[1], win[2] - fbox[0], win[3] - fbox[1]],
            "box_in_env_landscape": scale_box(box, (W, H), ENV_LAND),
            "window_in_env_landscape": scale_box(win, (W, H), ENV_LAND),
            "files": files})
    # portrait plates: same sprites, re-centred and scaled onto the portrait windows
    for set_name, psrc in (("rescue", SRC["portrait_rescue"]), ("inferno", SRC["portrait_inferno"])):
        if not exists_src(psrc):
            continue
        prgb = np.asarray(load_rgb(psrc))
        pint = window_interiors(prgb)
        pfr = window_frames(prgb, pint)
        k = float(np.mean([(p[2] - p[0]) / (q[2] - q[0]) for p, q in zip(pfr, frames)]))
        meta.setdefault("portrait", {})[set_name] = {
            "plate": rel(src_path(psrc)), "plate_size": [prgb.shape[1], prgb.shape[0]], "scale": round(k, 4),
            "windows": [list(f) for f in pfr],
            "window_centre": [[round((f[0] + f[2]) / 2, 1), round((f[1] + f[3]) / 2, 1)] for f in pfr],
            "windows_in_env_portrait": [scale_box(f, (prgb.shape[1], prgb.shape[0]), ENV_PORT) for f in pfr],
            "landscape_window_centre": [[round((f[0] + f[2]) / 2, 1), round((f[1] + f[3]) / 2, 1)] for f in frames]}
    write_json(os.path.join(out, "rooms.meta.json"), meta)
    if contact and sheet:
        rooms_contact(sheet, boxes, contact)


def rooms_contact(sheet, boxes, path):
    """Each state composited over its plate (window band), plus the raw sprites on a checker."""
    tiles = []
    for set_name, st, base, row in sheet:
        y0 = min(b[1] for b in boxes)
        y1 = max(b[3] for b in boxes)
        x0, x1 = boxes[0][0] - 20, boxes[-1][2] + 20
        comp = Image.fromarray(base, "RGB").convert("RGBA")
        for (bx0, by0, bx1, by1), rgba in zip(boxes, row):
            comp.alpha_composite(Image.fromarray(rgba, "RGBA"), (bx0, by0))
        band = comp.crop((x0, y0, x1, y1)).convert("RGB")
        chk = Image.new("RGB", (x1 - x0, y1 - y0), (200, 60, 200))
        for (bx0, by0, bx1, by1), rgba in zip(boxes, row):
            chk.paste(Image.fromarray(rgba, "RGBA"), (bx0 - x0, by0 - y0), Image.fromarray(rgba, "RGBA"))
        tiles.append(band)
        tiles.append(chk)
    w = max(t.width for t in tiles)
    h = sum(t.height + 6 for t in tiles)
    c = Image.new("RGB", (w, h), (40, 40, 40))
    y = 0
    for t in tiles:
        c.paste(t, (0, y))
        y += t.height + 6
    c.thumbnail((1400, 4000))
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    c.save(path)
    print(f"contact {path}")


# ------------------------------------------------------------------------------------------------- props
def grouped(src, groups, min_area=150):
    """Split a transparent sheet into named pieces: each component goes to the first group whose predicate accepts
    its centre (so stray droplets stay with their splash)."""
    arr = load_rgba(src)
    lab, _ = ndi.label(arr[:, :, 3] > 0)
    masks = {g: np.zeros(arr.shape[:2], bool) for g, _ in groups}
    for i, sl in enumerate(ndi.find_objects(lab)):
        if sl is None:
            continue
        m = lab == i + 1
        if m[sl].sum() < min_area:
            continue
        cy, cx = (sl[0].start + sl[0].stop) / 2, (sl[1].start + sl[1].stop) / 2
        for g, pred in groups:
            if pred(cx, cy):
                masks[g] |= m
                break
    out = {}
    for g, m in masks.items():
        if not m.any():
            continue
        piece = arr.copy()
        piece[~m] = 0
        im = Image.fromarray(piece, "RGBA")
        out[g] = im.crop(im.getbbox())
    return out


def ladder_tile(im, n=3):
    """Whole-rung-period vertical tile from the straight ladder section: cut mid-gap to mid-gap across n rungs."""
    a = np.asarray(im)
    alpha = a[:, :, 3] > 0
    W = a.shape[1]
    mid = alpha[:, int(W * 0.4):int(W * 0.6)].mean(1)  # rung rows are opaque between the rails
    rows = mid > 0.5
    lab, k = ndi.label(rows)
    centres = [float(np.mean(np.where(lab == i + 1)[0])) for i in range(k)]
    centres = [c for c in centres if 0 < c < len(rows)]
    if len(centres) < n + 2:
        raise SystemExit(f"ladder: found {len(centres)} rungs, need {n + 2}")
    p = float(np.median(np.diff(centres)))
    s = (len(centres) - n) // 2
    y0 = int(round((centres[s - 1] + centres[s]) / 2)) if s >= 1 else int(round(centres[s] - p / 2))
    y1 = int(round(y0 + n * p))
    tile = im.crop((0, y0, im.width, y1))
    padded = Image.new("RGBA", (tile.width + 4, tile.height), (0, 0, 0, 0))  # clear side columns; repeats vertically
    padded.alpha_composite(tile, (2, 0))
    tile = padded
    seam = float(np.abs(np.asarray(tile)[0].astype(int) - np.asarray(tile)[-1].astype(int)).mean())
    rails = np.where(a[y0 + 2, :, 3] > 0)[0]
    return tile, {"rung_period_px": round(p, 1), "rungs_per_tile": n, "seam_mean_abs_diff": round(seam, 2),
                  "rail_span_px": [int(rails.min()) + 2, int(rails.max()) + 3] if len(rails) else None,
                  "side_padding_px": 2}


def hose_tile(im, cut=0.12):
    """Seamless horizontal hose tile: drop the two cut-end ellipses and keep the straight middle."""
    x0, x1 = int(im.width * cut), int(im.width * (1 - cut))
    t = im.crop((x0, 0, x1, im.height))
    padded = Image.new("RGBA", (t.width, t.height + 4), (0, 0, 0, 0))  # clear top/bottom rows; repeats horizontally
    padded.alpha_composite(t, (0, 2))
    t = padded
    a = np.asarray(t).astype(int)
    return t, {"seam_mean_abs_diff": round(float(np.abs(a[:, 0] - a[:, -1]).mean()), 2), "top_bottom_padding_px": 2}


def cmd_props(root, pending):
    need = (SRC["props_a"], SRC["props_b"])
    if not all(exists_src(s) for s in need):
        pending.append("props")
        return
    out = prepare_out(os.path.join(root, "features", "rescue"))
    a = grouped(SRC["props_a"], [
        ("ladder_straight", lambda x, y: x < 420),
        ("ladder_top", lambda x, y: x < 800 and y < 540),
        ("jump_sheet", lambda x, y: x >= 800 and y < 560),
        ("badge_blank", lambda x, y: x < 850),
        ("spins_plate_blank", lambda x, y: True)])
    b = grouped(SRC["props_b"], [
        ("hose_nozzle", lambda x, y: y < 400 and x < 780),
        ("hose_segment", lambda x, y: y < 400),
        ("steam_puff", lambda x, y: x > 1190 and y < 760),
        ("water_jet", lambda x, y: x < 757),
        ("water_splash", lambda x, y: True)])
    meta = {"generated_by": "tools/art/derive_rescue.py props", "sources": [rel(src_path(s)) for s in need], "props": {}}
    for key, im in {**a, **b}.items():
        info = {}
        name = key
        if key == "ladder_straight":
            im, info = ladder_tile(im)
            name = "ladder_segment"
            info["repeat"] = "vertical, unmirrored"
        elif key == "hose_segment":
            im, info = hose_tile(im)
            info["repeat"] = "horizontal, unmirrored"
        elif key in ("badge_blank", "spins_plate_blank"):
            info["label"] = "runtime text (multiplier / spins) centred on the blank cream field"
        n = save_webp(im, os.path.join(out, f"{name}.webp"), quality=92)
        meta["props"][name] = {"file": f"{name}.webp", "size": list(im.size), **info}
        print(f"features/rescue/{name}.webp {im.size} {n} B {info}")
    write_json(os.path.join(out, "props.meta.json"), meta)


# ------------------------------------------------------------------------------------------------- cells
def inner_hole(im):
    a = np.asarray(im)[:, :, 3]
    h, w = a.shape
    cy, cx = h // 2, w // 2
    row, col = a[cy] > 20, a[:, cx] > 20
    l = cx - int(np.argmax(row[:cx][::-1]))
    r = cx + int(np.argmax(row[cx:]))
    t = cy - int(np.argmax(col[:cy][::-1]))
    b = cy + int(np.argmax(col[cy:]))
    return [round(l / w, 4), round(t / h, 4), round(r / w, 4), round(b / h, 4)]


def cmd_cells(root, pending, tile=384, pad=4):
    if not exists_src(SRC["ui_frames"]):
        pending.append("cells")
        return
    out = prepare_out(os.path.join(root, "ui_scene"))
    g = grouped(SRC["ui_frames"], [
        ("line_plate", lambda x, y: y > 600),
        ("plain", lambda x, y: x < 510),
        ("win", lambda x, y: x < 1020),
        ("locked", lambda x, y: True)])
    meta = {"generated_by": "tools/art/derive_rescue.py cells", "source": rel(src_path(SRC["ui_frames"])), "frames": {}}
    for key in ("plain", "win", "locked"):
        im = g[key]
        inner = tile - 2 * pad
        sq = im.resize((inner, inner), Image.LANCZOS)  # the sheet frames are ~4 % off square: fit exactly
        can = Image.new("RGBA", (tile, tile), (0, 0, 0, 0))
        can.alpha_composite(sq, (pad, pad))
        n = save_webp(can, os.path.join(out, f"cell_frame_{key}.webp"), lossless=True)
        meta["frames"][key] = {"file": f"cell_frame_{key}.webp", "size": [tile, tile], "hole": inner_hole(can),
                               "source_aspect": round(im.width / im.height, 4)}
        print(f"ui_scene/cell_frame_{key}.webp {can.size} {n} B hole {meta['frames'][key]['hole']}")
    lp = g["line_plate"]
    n = save_webp(lp, os.path.join(out, "line_plate.webp"), quality=92)
    meta["line_plate"] = {"file": "line_plate.webp", "size": list(lp.size),
                          "label": "runtime line number centred on the blank cream field (lower 60 % of the plate)"}
    print(f"ui_scene/line_plate.webp {lp.size} {n} B")
    write_json(os.path.join(out, "cells.meta.json"), meta)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", nargs="*", help="all (default) | rooms | props | cells")
    ap.add_argument("--map", default="", help="json {key: source} overriding SRC (keys: %s)" % ", ".join(SRC))
    ap.add_argument("--out", default="")
    ap.add_argument("--contact", default="")
    ap.add_argument("--strict", action="store_true")
    a = ap.parse_args()
    root = out_root(a.out)
    if a.map:
        m = json.load(open(a.map))
        bad = sorted(set(m) - set(SRC))
        if bad:
            ap.error(f"--map: unknown keys {bad}")
        SRC.update(m)
    every = ["rooms", "props", "cells"]
    cmds = every if (not a.cmd or "all" in a.cmd) else a.cmd
    pending = []
    for c in cmds:
        if c == "rooms":
            cmd_rooms(root, pending, a.contact)
        elif c == "props":
            cmd_props(root, pending)
        elif c == "cells":
            cmd_cells(root, pending)
        else:
            ap.error(f"unknown subcommand {c}")
    if pending:
        print("PENDING (no accepted source yet):", ", ".join(pending))
    if a.strict and pending:
        sys.exit(1)


if __name__ == "__main__":
    main()
