#!/usr/bin/env python3
"""Build the rig part deliveries (r2) under art-src/animation/parts/<rig>/ from the raw paid outputs in
art-src/generated/rig_<rig>/ (local, deterministic, free; raw outputs, masters and sheets are never modified).

  python3 art-src/animation/parts/build_parts.py [--rig pf_chief ...] [--refit]

r2 (2026-09-25) replaces r1's connected-component clustering of the sheets with FIXED-GRID extraction
(`cut_sheets.py` + `<rig>/sheets.layout.json`, read from each sheet by eye) and derives the layers r1 got wrong from
the registered pixels at master scale (`derive_r2.py` + `<rig>/derive.layout.json`):
  * body_no_head_no_arms no longer repeats the legs; coat_tails (chief, rookie) and leg_right/leg_left are cut from
    the registered body itself, soles on y 1440 (r1: a separately edited coat and legs, registered undersized)
  * helmet_front is cut from the master's own pixels (r1 left a light seam over the head)
  * the chief's raised arms are rotated about their shoulder pivots so the fingertips stay on the canvas
  * Ember's legs are cut into four layers; the rescued skins are cut into the template's slots
  * the rookie head_blank is re-fitted to head_no_helmet (r1 locked onto the eye at s 0.345)
Same-framing parts keep their r1 fit (recorded in registration.json) and are re-placed from the raw output
(bit-identical to r1); `--refit` re-runs the r1 colour fit instead.

Every file is written to a temporary file in its own directory and renamed into place (atomic); a file whose decoded
pixels did not change is not rewritten. The run prints every path it changed.
"""
import argparse
import json
import os
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import derive_r2 as D  # noqa: E402
from cut_sheets import cut_sheet, load_layout  # noqa: E402
from register_parts import CANVAS, FEET_X, FEET_Y, feet, fit, master_shift, place, rgba  # noqa: E402

REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
GEN = os.path.join(REPO, "art-src", "generated")
QA = os.path.join(REPO, "qa", "art", "parts")
CHANGED = []

# same-framing parts: raw name -> (output name, split names left->right in IMAGE order or None). r2: the raw `legs`
# and `coat_tails` edits of the bipeds are superseded by layers cut from the registered body (kept here for --refit
# provenance only; their r1 fits stay in registration.json under `superseded`).
SAME = {
    "pf_chief": {"body_no_head_no_arms": ("body_no_head_no_arms", None), "head_no_helmet": ("head_no_helmet", None),
                 "head_blank": ("head_blank", None), "helmet_only": ("helmet_only", None),
                 "arms_down": ("arms_down", ["arm_right", "arm_left"])},
    "pf_rookie": {"body_no_head_no_arms": ("body_no_head_no_arms", None), "head_no_helmet": ("head_no_helmet", None),
                  "head_blank": ("head_blank", None), "helmet_only": ("helmet_only", None),
                  "arms_down": ("arms_down", ["arm_right", "arm_left"])},
    "pf_dog": {"body_no_head_no_legs_r2": ("body_no_head_no_legs", None), "head_no_helmet": ("head_no_helmet", None),
               "helmet_only": ("helmet_only", None), "legs": ("legs", None)},
    "pf_rescued": {"body_no_head_no_arms": ("body_no_head_no_arms", None), "head": ("head", None),
                   "head_blank": ("head_blank", None), "arms_down": ("arms_down", ["arm_right", "arm_left"]),
                   "skin_grandma": ("skin_grandma", None), "skin_twins": ("skin_twins", None),
                   "skin_dad": ("skin_dad", None), "skin_baby": ("skin_baby", None), "skin_teen": ("skin_teen", None)},
}
SUPERSEDED = {"pf_chief": ["legs", "coat_tails"], "pf_rookie": ["legs", "coat_tails"], "pf_rescued": ["legs"]}
YRANGE = {"head_no_helmet": (0.0, 0.5), "head_blank": (0.0, 0.5), "head": (0.0, 0.5), "helmet_only": (0.0, 0.4),
          "legs": (0.5, 1.0)}
SRANGE = {"helmet_only": (0.7, 1.4), "body_no_head_no_arms": (0.6, 1.6), "body_no_head_no_legs": (0.6, 1.6),
          "legs": (0.5, 1.6)}
# rig stacking order for the reassembly check (back to front)
ORDER = {"pf_chief": ["leg_right", "leg_left", "coat_tails", "body_no_head_no_arms", "arm_left", "head_no_helmet",
                      "helmet_front", "arm_right"],
         "pf_rookie": ["leg_right", "leg_left", "coat_tails", "body_no_head_no_arms", "arm_left", "head_no_helmet",
                       "helmet_front", "arm_right"],
         "pf_dog": ["leg_hind_left", "leg_front_left", "leg_hind_right", "leg_front_right", "body_no_head_no_legs",
                    "head_no_helmet", "helmet_front"],
         "pf_rescued": ["leg_right", "leg_left", "body_no_head_no_arms", "arm_left", "head", "arm_right"]}
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


# ------------------------------------------------------------------------------------------------ atomic writes
def rel(path):
    return os.path.relpath(path, REPO)


def write_png(arr, path, mode="RGBA"):
    """Atomic PNG write (temp file in the same directory, then os.replace). Skips the write when the decoded pixels
    already on disk are identical. Returns the repo-relative path."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    a = np.asarray(arr).copy()
    if mode == "RGBA":
        a[a[..., 3] == 0, :3] = 0
    if os.path.exists(path):
        try:
            with Image.open(path) as old:
                if old.mode == mode and old.size == (a.shape[1], a.shape[0]) and np.array_equal(np.array(old), a):
                    return rel(path)
        except Exception:  # noqa: BLE001  (an unreadable file is rewritten)
            pass
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".tmp_", suffix=".png")
    os.close(fd)
    try:
        Image.fromarray(a, mode).save(tmp, format="PNG", optimize=True)
        with Image.open(tmp) as chk:
            chk.load()
        os.chmod(tmp, 0o644)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)
    CHANGED.append(rel(path))
    return rel(path)


def write_img(im, path):
    return write_png(np.array(im), path, im.mode)


def write_json(obj, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    text = json.dumps(obj, indent=2) + "\n"
    if os.path.exists(path) and open(path).read() == text:
        return rel(path)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".tmp_", suffix=".json")
    with os.fdopen(fd, "w") as fh:
        fh.write(text)
    os.chmod(tmp, 0o644)
    os.replace(tmp, path)
    CHANGED.append(rel(path))
    return rel(path)


def load_png(path):
    return np.array(Image.open(path).convert("RGBA"))


# ------------------------------------------------------------------------------------------------ QA renders
def overlay(master, part, path):
    bg = Image.fromarray(master).convert("RGBA")
    white = Image.new("RGBA", bg.size, (255, 255, 255, 255))
    base = Image.blend(white, Image.alpha_composite(white, bg), 0.35)
    base.alpha_composite(Image.fromarray(part))
    write_img(base.convert("RGB").resize((CANVAS[0] // 2, CANVAS[1] // 2), Image.LANCZOS), path)


def stack(layers, shape):
    out = Image.new("RGBA", (shape[1], shape[0]), (0, 0, 0, 0))
    for arr in layers:
        out.alpha_composite(Image.fromarray(arr))
    return np.array(out)


def reassembly(rig, master, layers, path):
    st = stack([layers[n] for n in ORDER[rig] if n in layers], master.shape)
    side = Image.new("RGB", (CANVAS[0], CANVAS[1] // 2), (128, 128, 128))
    for i, arr in enumerate([master, st]):
        im = Image.fromarray(arr).resize((CANVAS[0] // 2, CANVAS[1] // 2), Image.LANCZOS)
        side.paste(im, (i * CANVAS[0] // 2, 0), im)
    d = ImageDraw.Draw(side)
    d.line([(0, FEET_Y // 2), (CANVAS[0], FEET_Y // 2)], fill=(200, 0, 0), width=1)
    f = ImageFont.truetype(FONT, 14)
    d.text((6, 4), f"{rig} master", fill=(255, 255, 0), font=f)
    d.text((CANVAS[0] // 2 + 6, 4), "r2.1 layers: " + " > ".join(n for n in ORDER[rig] if n in layers), fill=(255, 255, 0),
           font=ImageFont.truetype(FONT, 10))
    write_img(side, path)
    m = master[..., 3] > 128
    s = st[..., 3] > 128
    return round(float((m & s).sum() / max(1, (m | s).sum())), 4)


def _trim(a, pad=2):
    ys, xs = np.nonzero(a[..., 3] > 0)
    return a[max(0, ys.min() - pad):ys.max() + 1 + pad, max(0, xs.min() - pad):xs.max() + 1 + pad]


def contact(tiles, path, title, zoom, max_w=3000):
    """Labelled contact sheet: every tile (name, RGBA array, caption) at `zoom`, file name under it, mid-grey ground."""
    f_name = ImageFont.truetype(FONT, 22)
    f_cap = ImageFont.truetype(FONT, 15)
    f_title = ImageFont.truetype(FONT, 28)
    pad, lab_h = 24, 50
    ims = []
    for name, arr, cap in tiles:
        im = Image.fromarray(arr)
        if zoom != 1:
            im = im.resize((max(1, round(im.width * zoom)), max(1, round(im.height * zoom))), Image.LANCZOS)
        w = max(im.width, int(f_name.getlength(name)) + 4, int(f_cap.getlength(cap)) + 4)
        ims.append((name, im, cap, w))
    width = max(max_w, max(w for *_, w in ims) + 2 * pad)
    rows, row, x = [], [], pad
    for t in ims:
        if row and x + t[3] + pad > width:
            rows.append(row)
            row, x = [], pad
        row.append(t)
        x += t[3] + pad
    rows.append(row)
    top = 70
    height = top + sum(max(t[1].height for t in r) + lab_h + pad for r in rows) + pad
    sheet = Image.new("RGBA", (width, height), (128, 128, 128, 255))
    d = ImageDraw.Draw(sheet)
    d.text((pad, 20), title, fill=(255, 255, 255), font=f_title)
    y = top
    for r in rows:
        h = max(t[1].height for t in r)
        x = pad
        for name, im, cap, w in r:
            ox = x + (w - im.width) // 2
            d.rectangle([ox - 1, y - 1, ox + im.width, y + im.height], outline=(104, 104, 104))
            sheet.alpha_composite(im, (ox, y))
            d.text((x, y + h + 4), name, fill=(0, 0, 0), font=f_name)
            d.text((x, y + h + 29), cap, fill=(40, 40, 40), font=f_cap)
            x += w + pad
        y += h + lab_h + pad
    return write_img(sheet.convert("RGB"), path)


def letter_piece(plate, pieces_dir, c):
    """Letter a blank shield plate with tools/art/letter_shield.py (the one treatment of ART_HERO.md), via temporary
    files in the pieces directory; returns the lettered RGBA array (written atomically by the caller)."""
    import importlib.util
    spec = importlib.util.spec_from_file_location("letter_shield", os.path.join(REPO, "tools", "art", "letter_shield.py"))
    ls = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ls)
    fd_in, tmp_in = tempfile.mkstemp(dir=pieces_dir, prefix=".tmp_", suffix=".png")
    fd_out, tmp_out = tempfile.mkstemp(dir=pieces_dir, prefix=".tmp_", suffix=".png")
    os.close(fd_in)
    os.close(fd_out)
    try:
        Image.fromarray(plate, "RGBA").save(tmp_in, format="PNG")
        ls.letter(tmp_in, tmp_out, c["text"], c["fill"], c["dy"])
        arr = load_png(tmp_out)
    finally:
        for t in (tmp_in, tmp_out):
            if os.path.exists(t):
                os.remove(t)
    return arr, {"text": c["text"], "fill": c["fill"], "dy": c["dy"]}


# ------------------------------------------------------------------------------------------------ build
def place_master(rig, raw_dir):
    m_raw = rgba(os.path.join(raw_dir, f"master_{rig}.png"))
    band = 0.05 if rig == "pf_dog" else 0.02
    sx, sy = master_shift(m_raw, band)
    m = np.zeros_like(m_raw)
    H, W = m_raw.shape[:2]
    m[max(0, sy):min(H, H + sy), max(0, sx):min(W, W + sx)] = \
        m_raw[max(0, -sy):min(H, H - sy), max(0, -sx):min(W, W - sx)]
    m[m[..., 3] == 0, :3] = 0
    return m_raw, m, (sx, sy), band


def split_components(placed, names):
    m = placed[..., 3] > 40
    lab, n = ndimage.label(m, structure=np.ones((3, 3)))
    sizes = np.bincount(lab.ravel())
    ids = sorted(range(1, n + 1), key=lambda i: -sizes[i])[:len(names)]
    ids = sorted(ids, key=lambda i: np.nonzero(lab == i)[1].mean())
    out = {}
    for nm, i in zip(names, ids):
        p = placed.copy()
        p[lab != i] = 0
        out[nm] = p
    return out


def build(rig, refit=False):
    raw_dir = os.path.join(GEN, f"rig_{rig}")
    out_dir = os.path.join(HERE, rig)
    old = json.load(open(os.path.join(out_dir, "registration.json")))
    dcfg = json.load(open(os.path.join(out_dir, "derive.layout.json")))
    rec = {"rig": rig, "version": "r2", "revision": "r2.1 (2026-09-25: verifier fixes, local re-processing, no paid call)",
           "canvas": list(CANVAS), "feet_y": FEET_Y, "feet_x": FEET_X, "parts": {}, "pieces": {}, "superseded": {}}
    m_raw, master, (sx, sy), band = place_master(rig, raw_dir)
    mpath = os.path.join(out_dir, f"master_{rig}.png")
    on_disk = load_png(mpath)
    if not np.array_equal(on_disk, master):
        raise RuntimeError(f"{rig}: the master on disk differs from the integer shift of the raw master")
    y1, cx = feet(master, band)
    ys, xs = np.nonzero(master[..., 3] > 128)
    rec["master"] = {"file": rel(mpath), "raw_shift": [sx, sy], "raw": rel(os.path.join(raw_dir, f"master_{rig}.png")),
                     "bbox": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())],
                     "height_px": int(ys.max() - ys.min() + 1), "feet_measured": [round(cx, 1), y1],
                     "note": "immutable input: verified identical to the integer shift of the raw master, not rewritten"}
    if rig == "pf_rookie":
        rec["master"]["crown_note"] = ("the helmet crown sits on y 0: the raw master's top rows are y 40-42 with alpha "
                                       "<= 44/255 (faint antialias), so one faint row is lost; the sole line must stay on "
                                       "y 1440, so the master is not moved (moving it 12 px down would put the soles "
                                       "on y 1452); helmet_only keeps its crown from y 1")
    L = {}  # every canvas layer by name
    # 1. same-framing parts: r1 fit re-placed from the raw output (or re-fitted with --refit)
    for rawname, (outname, split) in SAME[rig].items():
        rawp = os.path.join(raw_dir, f"{rawname}.png")
        p = rgba(rawp)
        if refit and not rawname.startswith("skin_"):
            f = fit(m_raw, p, yrange=YRANGE.get(rawname), srange=SRANGE.get(rawname, (0.35, 1.6)))
            f["mode"] = "colour"
        else:
            f = old["parts"][outname]["fit"]
        shift = (0, 0) if f.get("frame") == "canvas" else (sx, sy)
        placed = place(p, f, shift)
        placed[placed[..., 3] == 0, :3] = 0
        snap = 0
        if rawname.startswith("skin_"):
            # r2.1: every skin stands on the feet line: its lowest alpha>128 row (the contract's feet measure, as for
            # the master) is moved onto y 1440 by a whole-pixel shift (r2 accepted 'identity: soles within 6 px')
            snap = FEET_Y - feet(placed)[0]
            if snap:
                placed = np.roll(placed, snap, axis=0)
                if snap > 0:
                    placed[:snap] = 0
                else:
                    placed[snap:] = 0
        L[outname] = placed
        rec["parts"][outname] = {"raw": rel(rawp), "fit": f, "file": rel(os.path.join(out_dir, f"{outname}.png"))}
        if rawname.startswith("skin_"):
            rec["parts"][outname]["sole_snap_px"] = int(snap)
        if split:
            rec["parts"][outname]["split"] = {}
            for nm, arr in split_components(placed, split).items():
                L[nm] = arr
                rec["parts"][outname]["split"][nm] = rel(os.path.join(out_dir, f"{nm}.png"))
    for nm in SUPERSEDED.get(rig, []):
        if nm in old.get("parts", {}) and "raw" in old["parts"][nm]:
            rec["superseded"][nm] = {"raw": old["parts"][nm]["raw"], "fit": old["parts"][nm]["fit"],
                                     "why": {"legs": "r1 registered the separate legs edit undersized (soles on y 1395) "
                                                     "and body_no_head_no_arms repeated the legs; r2 cuts the legs from "
                                                     "the registered body",
                                             "coat_tails": "r1 kept the coat edit's raw scale (hem-aligned only), far "
                                                           "narrower than the body's hem; r2 cuts the coat tails from the "
                                                           "registered body"}[nm]}
        elif nm in old.get("superseded", {}):
            rec["superseded"][nm] = old["superseded"][nm]
    # 2. rookie head_blank re-fit against the registered head_no_helmet
    if "head_blank_refit" in dcfg:
        c = dcfg["head_blank_refit"]
        rawp = os.path.join(raw_dir, "head_blank.png")
        prev = old["parts"]["head_blank"]["fit"]
        if prev.get("frame") == "canvas" and not refit:
            f = prev
        else:
            f = fit(L[c["target"]], rgba(rawp), q=c["q"], srange=tuple(c["srange"]), mode=c["mode"])
            f.update({"mode": f"colour fit against the registered {c['target']} (r2 refit)", "frame": "canvas",
                      "r1_fit": prev if prev.get("frame") != "canvas" else prev.get("r1_fit")})
        placed = place(rgba(rawp), f, (0, 0))
        placed[placed[..., 3] == 0, :3] = 0
        L["head_blank"] = placed
        rec["parts"]["head_blank"] = {"raw": rel(rawp), "fit": f, "why": c["why"],
                                      "file": rel(os.path.join(out_dir, "head_blank.png"))}
    # 2b. r2.1 (chief, rescued): head_blank re-seated on the registered head (a similarity correction applied on top of
    # the r1 fit, measured on the nostrils and the jaw/chin outline and read back on an overlay)
    if "head_blank_adjust" in dcfg:
        c = dcfg["head_blank_adjust"]
        rawp = os.path.join(raw_dir, "head_blank.png")
        prev = old["parts"]["head_blank"]["fit"]
        base = prev.get("r1_fit", prev)
        s0, t0 = base["s"], np.array([base["tx"] + sx, base["ty"] + sy])
        a_, cc_, d_ = c["scale"], np.array(c["about"], float), np.array([c["dx"], c["dy"]], float)
        t1 = a_ * (t0 - cc_) + cc_ + d_
        f = {"s": float(a_ * s0), "tx": float(t1[0]), "ty": float(t1[1]), "frame": "canvas",
             "mode": "r2.1: r1 colour fit + similarity correction (head_blank_adjust in derive.layout.json)",
             "r1_fit": base}
        placed = place(rgba(rawp), f, (0, 0))
        placed[placed[..., 3] == 0, :3] = 0
        L["head_blank"] = placed
        rec["parts"]["head_blank"] = {"raw": rel(rawp), "fit": f, "why": c["why"], "adjust": c,
                                      "file": rel(os.path.join(out_dir, "head_blank.png"))}
    # 3. body split: body without legs (+ coat tails) and single legs at master scale
    if "split_body" in dcfg:
        c = dcfg["split_body"]
        parts, meta = D.split_body(rig, c, old)
        for nm in ["body_no_head_no_arms", "coat_tails", "leg_right", "leg_left", "legs"]:
            if nm in parts:
                L[nm] = parts[nm]
        rec["parts"]["body_no_head_no_arms"].update({
            "r2": "legs (and for the coat wearers the coat below the belt) removed: the legs are their own layers now, "
                  "so nothing repeats", "split_meta": {k: v for k, v in meta.items()}, "params": c})
        for nm in ["coat_tails", "legs", "leg_right", "leg_left"]:
            if nm not in parts:
                continue
            ys_, xs_ = np.nonzero(parts[nm][..., 3] > 128)
            rec["parts"][nm] = {"derived_from": "body_no_head_no_arms (registered, master scale)",
                                "file": rel(os.path.join(out_dir, f"{nm}.png")),
                                "bbox": [int(xs_.min()), int(ys_.min()), int(xs_.max()), int(ys_.max())],
                                "size": [int(np.ptp(xs_)) + 1, int(np.ptp(ys_)) + 1]}
        if "coat_tails" in parts:
            rec["parts"]["coat_tails"]["method"] = ("the registered body's pixels from the belt's middle line down to "
                                                    "the hem (the cut edge hides under the belt); the tail stays on the "
                                                    "body")
            rec["parts"]["coat_tails"]["params"] = c
        for nm in ("leg_right", "leg_left"):
            rec["parts"][nm]["method"] = (f"the registered body's own leg pixels (navy/boot regions below the "
                                          f"{'coat hem' if c['coat'] else 'shirt hem'}), moved {meta['legs_shift_y']} px "
                                          f"so the soles sit on y {FEET_Y}; the top is extended up to "
                                          f"{c['leg_extend_px']} px under the hem (hidden overlap for rotation)")
            rec["parts"][nm]["soles_y"] = int(np.nonzero(parts[nm][..., 3] > 128)[0].max())
        rec["parts"]["legs"]["method"] = "leg_right + leg_left on one layer"
    # 3b. r2.1 (rookie): coat_tails and the legs from the MASTER's own pixels; the master's tail replaces the redraw's
    if "lower_from_master" in dcfg:
        c = dcfg["lower_from_master"]
        parts, meta = D.lower_from_master(rig, c, master, L)
        tail = parts.pop("tail_master")
        body = L["body_no_head_no_arms"].copy()
        btail = D.tail_mask(body, body[..., 3] > 0, c["belt_band"][0], c)
        body[btail] = 0
        L["body_no_head_no_arms"] = np.where(tail[..., 3:4] > 0, tail, body).astype(np.uint8)
        meta["body_tail_removed_px"] = int(btail.sum())
        rec["parts"]["body_no_head_no_arms"]["r2_1_tail"] = (
            "the redraw's own curly tail (10-15 px left of the master's) is replaced by the master's tail pixels, so "
            "at rest one tail shows, where the master has it")
        L.update(parts)
        for nm in ("coat_tails", "legs", "leg_right", "leg_left"):
            ys_, xs_ = np.nonzero(parts[nm][..., 3] > 128)
            rec["parts"][nm] = {"derived_from": f"master_{rig} (r2.1: the master's own pixels)",
                                "file": rel(os.path.join(out_dir, f"{nm}.png")),
                                "bbox": [int(xs_.min()), int(ys_.min()), int(xs_.max()), int(ys_.max())],
                                "size": [int(np.ptp(xs_)) + 1, int(np.ptp(ys_)) + 1],
                                "method": D.lower_from_master.__doc__.strip().split("\n\n")[0], "params": c,
                                "meta": meta, "r2_superseded": c["why"]}
            if nm.startswith("leg_"):
                rec["parts"][nm]["soles_y"] = int(ys_.max())
    # 4. helmet_front from the master's own pixels (chief, rookie); the dog keeps r1's
    if "helmet_front" in dcfg:
        hf, meta = D.helmet_front_v2(rig, dcfg["helmet_front"], master, old)
        L["helmet_front"] = hf
        rec["parts"]["helmet_front"] = {"derived_from": "master_" + rig + " inside the registered helmet_only",
                                        "method": D.helmet_front_v2.__doc__.strip().split("\n\n")[0],
                                        "params": dcfg["helmet_front"], "meta": meta,
                                        "file": rel(os.path.join(out_dir, "helmet_front.png"))}
    elif rig == "pf_dog":
        L["helmet_front"] = load_png(os.path.join(out_dir, "helmet_front.png"))
        rec["parts"]["helmet_front"] = old["parts"]["helmet_front"]
    # 4b. r2.1: a layer drawn wider than the master (chief/rookie far sleeve, the shoulders behind it, the rookie's
    # collar) loses what shows at rest outside the master's silhouette; the cut is closed with the master's own outline
    if "edge_to_master" in dcfg:
        c = dcfg["edge_to_master"]
        for nm in c["layers"]:  # front-most first, so each layer's cover is already final
            order = ORDER[rig]
            cover = np.zeros(master.shape[:2], bool)
            for f in order[order.index(nm) + 1:]:
                cover |= L[f][..., 3] > 128
            L[nm], meta = D.edge_to_master(L[nm], master, cover, c)
            key = "arms_down" if nm in ("arm_left", "arm_right") else nm
            rec["parts"][key].setdefault("r2_1_edge_to_master", {})[nm] = dict(
                meta, method=D.edge_to_master.__doc__.strip(), params=c)
        if any(nm in ("arm_left", "arm_right") for nm in c["layers"]):
            L["arms_down"] = stack([L["arm_left"], L["arm_right"]], master.shape)
    # 5. raised arms
    if rig in ("pf_chief", "pf_rookie"):
        if "raised_arms" in dcfg:
            parts, meta = D.raised_arms(rig, dcfg["raised_arms"], old)
            ent = dict(old["parts"]["arms_raised"])
            ent["r2"] = dcfg["raised_arms"]["why"]
            for nm, v in meta.items():
                ent["split"][nm] = dict(ent["split"][nm], **v)
            rec["parts"]["arms_raised"] = ent
        else:
            parts = {nm: load_png(os.path.join(out_dir, f"{nm}.png"))
                     for nm in ("arms_raised", "arm_right_raised", "arm_left_raised")}
            rec["parts"]["arms_raised"] = old["parts"]["arms_raised"]
        L.update(parts)
    # 6. dog legs
    if "dog_legs" in dcfg:
        parts, meta = D.dog_legs(rig, dcfg["dog_legs"], old, master, L["body_no_head_no_legs"])
        if "legs" in parts:
            L["legs"] = parts.pop("legs")
            rec["parts"]["legs"]["r2_1"] = ("the far front leg's hidden top that showed beside the chest at rest is "
                                            "clipped here too (legs.png stays the union of the four leg layers)")
        L.update(parts)
        rec["parts"]["legs"]["split"] = {nm: rel(os.path.join(out_dir, f"{nm}.png")) for nm in parts}
        rec["parts"]["legs"]["split_method"] = D.dog_legs.__doc__.strip()
        rec["parts"]["legs"]["split_meta"] = meta
        rec["parts"]["legs"]["split_params"] = dcfg["dog_legs"]
        for nm in parts:
            rec["parts"][nm] = {"derived_from": "legs (registered, master scale; one layer per leg)",
                                "file": rel(os.path.join(out_dir, f"{nm}.png")), "bbox": meta[nm]["bbox"],
                                "side": ("near (image-left, his RIGHT)" if nm.endswith("_right") else
                                         "far (image-right, his LEFT)")}
    # 7. rescued skins -> template slots
    if "skin_slots" in dcfg:
        c = dcfg["skin_slots"]
        masks = {"head": L["head"][..., 3] > 128, "body": L["body_no_head_no_arms"][..., 3] > 128,
                 "arm_right": L["arm_right"][..., 3] > 128, "arm_left": L["arm_left"][..., 3] > 128}
        for nm in ("leg_right", "leg_left"):  # the visible leg (the hidden top extension is not a template slot)
            masks[nm] = (L[nm][..., 3] > 128) & ~(L["body_no_head_no_arms"][..., 3] > 128)
        slot_file = {"head": "head", "body": "body_no_head_no_arms", "arm_right": "arm_right", "arm_left": "arm_left",
                     "leg_right": "leg_right", "leg_left": "leg_left"}
        tint = {"head": (255, 0, 255), "body": (0, 220, 255), "arm_right": (255, 255, 0), "arm_left": (255, 140, 0),
                "leg_right": (0, 255, 0), "leg_left": (60, 90, 255)}
        maps = []
        tj = D.slot_joints(masks)
        joints = {"template": tj}
        for sk in ("grandma", "twins", "dad", "baby", "teen"):
            skin = L[f"skin_{sk}"]
            slots, lab = D.skin_slots(skin, masks, c, c["overrides"].get(sk, []))
            ent = rec["parts"][f"skin_{sk}"]
            ent["specks_dropped_px"] = D.skin_slots.last_dropped
            sj = D.slot_joints({nm: lab == D.SLOT_FRONT.index(nm) + 1 for nm in ("head", "arm_right", "arm_left")})
            joints[sk] = {nm: {"canvas": v, "offset_from_template": ([round(v[0] - tj[nm][0], 1), round(v[1] - tj[nm][1], 1)]
                                                                     if v and tj.get(nm) else None)}
                          for nm, v in sj.items()}
            ent["joints"] = joints[sk]
            ent["slots"] = {}
            for slot, arr in slots.items():
                nm = f"skins/{sk}/{slot_file[slot]}"
                L[nm] = arr
                ent["slots"][slot_file[slot]] = rel(os.path.join(out_dir, nm + ".png"))
            ent["slot_overrides"] = c["overrides"].get(sk, [])
            t = skin.astype(float)
            for k, slot in enumerate(D.SLOT_FRONT, 1):
                mk = lab == k
                t[mk, :3] = t[mk, :3] * 0.55 + np.array(tint[slot]) * 0.45
            im = Image.new("RGBA", CANVAS, (128, 128, 128, 255))
            im.alpha_composite(Image.fromarray(t.astype(np.uint8)))
            maps.append((sk, im.resize((CANVAS[0] // 2, CANVAS[1] // 2), Image.LANCZOS)))
        rec["skin_slots"] = {"method": D.skin_slots.__doc__.strip(), "params": {k: v for k, v in c.items() if k != "overrides"},
                             "joints": joints, "joints_method": D.slot_joints.__doc__.strip(),
                             "slot_names": list(slot_file.values()),
                             "qa": rel(os.path.join(QA, f"{rig}_skin_slots_r2.png"))}
        sheet = Image.new("RGB", (len(maps) * CANVAS[0] // 2, CANVAS[1] // 2 + 70), (128, 128, 128))
        d = ImageDraw.Draw(sheet)
        fnt = ImageFont.truetype(FONT, 20)
        for i, (sk, im) in enumerate(maps):
            sheet.paste(im.convert("RGB"), (i * CANVAS[0] // 2, 0))
            d.text((i * CANVAS[0] // 2 + 8, CANVAS[1] // 2 + 6), f"skin_{sk}", fill=(0, 0, 0), font=fnt)
        x = 8
        for slot in D.SLOT_FRONT:
            d.rectangle([x, CANVAS[1] // 2 + 40, x + 18, CANVAS[1] // 2 + 58], fill=tint[slot])
            d.text((x + 24, CANVAS[1] // 2 + 38), slot_file[slot], fill=(0, 0, 0), font=fnt)
            x += 60 + int(fnt.getlength(slot_file[slot]))
        write_img(sheet, os.path.join(QA, f"{rig}_skin_slots_r2.png"))
    # 8. write every canvas layer (atomic, only when changed) + overlays of the r2 layers
    # r2.1: no canvas layer keeps a detached island under 30 px (4-connected: a pixel touching its layer only
    # diagonally counts as detached); masters and the full-figure skins are reference images and stay as placed
    rec["islands_dropped"] = {}
    for nm in list(L):
        if nm.startswith("skin_"):
            continue
        L[nm], dropped = D.drop_islands(L[nm], 30)
        # a layer re-read from disk (rookie raised arms) had its islands dropped on an earlier run: keep that record
        dropped = dropped or old.get("islands_dropped", {}).get(nm)
        if dropped:
            rec["islands_dropped"][nm] = dropped
    for nm, arr in L.items():
        write_png(arr, os.path.join(out_dir, nm + ".png"))
        if not nm.startswith("skins/"):  # r2.1: every canvas layer's overlay is current (skin slots: the slot map)
            overlay(master, arr, os.path.join(QA, f"{rig}_{nm}.png"))
    # 9. sheets: fixed-grid cut
    layout = load_layout(rig)
    for sh, sl in layout["sheets"].items():
        sheet_path = os.path.join(out_dir, sl["file"])
        a = load_png(sheet_path)
        cells, info = cut_sheet(a, sl, layout.get("speck_px", 64))
        pieces = {}
        fam_of = {c["label"]: c["family"] for r in sl["rows"] for c in r["cells"]}
        for r_i, row in enumerate(sl["rows"]):
            for c_i, cell in enumerate(row["cells"]):
                nm = cell["label"]
                v = cells[nm]
                if "error" in v:
                    raise RuntimeError(f"{rig}/{sh}/{nm}: {v['error']}")
                fam = fam_of[nm]
                sc = sl["scales"][fam]
                pieces[nm] = {"file": write_png(v["_arr"], os.path.join(out_dir, "pieces", f"{nm}.png")),
                              "size": v["size"], "sheet_origin": v["sheet_origin"], "cell": v["cell"],
                              "grid": [r_i, c_i], "rule": v["rule"], "components_kept": v["components_kept"],
                              "dropped": v["dropped"], "scale_family": fam, "scale_to_canvas": sc["scale_to_canvas"]}
                v["_file"] = pieces[nm]["file"]
        rec["pieces"][sh] = {"sheet": rel(sheet_path), "raw": rel(os.path.join(raw_dir, f"{sh}.png")),
                             "layout": rel(os.path.join(out_dir, "sheets.layout.json")),
                             "cutter": "fixed grid (cut_sheets.py): component centroid -> cell, then the cell's rule",
                             "sheet_scale_to_canvas": None, "scales": sl["scales"], "components": info["components"],
                             "specks_ignored": info["specks"], "outside_every_cell": info["outside_every_cell"],
                             "pieces": pieces, "missing": []}
    # 9b. r2.1 derived pieces (derive.layout.json "pieces"): cut from an already cut piece, same sheet origin and scale
    for nm, c in dcfg.get("pieces", {}).items():
        src_sheet = next(sh for sh, v in rec["pieces"].items() if c["from"] in v["pieces"])
        src = rec["pieces"][src_sheet]["pieces"][c["from"]]
        src_arr = load_png(os.path.join(REPO, src["file"]))
        if c["method"] == "mask_jaw":
            arr, meta = D.head_no_jaw(src_arr, c)
            how = D.head_no_jaw.__doc__.strip()
        elif c["method"] == "letter_shield":
            arr, meta = letter_piece(src_arr, os.path.join(out_dir, "pieces"), c)
            how = ("tools/art/letter_shield.py (ART_HERO.md shield rule: Alfa Slab One, ink #3B2313, one hard brass shadow "
                   "#B8862B, numerals at `fill` of the plate's opaque-bbox height, centred, offset `dy`), run on this plate")
        else:
            raise ValueError(c["method"])
        rec["pieces"][src_sheet]["pieces"][nm] = dict(
            {k: src[k] for k in ("sheet_origin", "cell", "grid", "scale_family", "scale_to_canvas")},
            file=write_png(arr, os.path.join(out_dir, "pieces", f"{nm}.png")), size=[arr.shape[1], arr.shape[0]],
            rule=f"derived ({c['method']})", components_kept=None, dropped=[], derived_from=src["file"],
            method=how, params={k: v for k, v in c.items() if k != "why"}, why=c["why"], meta=meta)
    # 10. QA: reassembly, labelled contact sheets
    iou = reassembly(rig, master, L, os.path.join(QA, f"{rig}_reassembly.png"))
    rec["qa"] = {"reassembly": rel(os.path.join(QA, f"{rig}_reassembly.png")), "reassembly_iou": iou,
                 "pieces_contact": rel(os.path.join(QA, f"{rig}_pieces_r2.png")),
                 "layers_contact": rel(os.path.join(QA, f"{rig}_layers_r2.png"))}
    tiles = []
    for sh, v in rec["pieces"].items():
        for nm, pv in v["pieces"].items():
            arr = load_png(os.path.join(REPO, pv["file"]))
            if pv.get("derived_from"):
                cap = f"{sh} r{pv['grid'][0]}c{pv['grid'][1]} | {pv['rule']} from pieces/" + \
                      f"{os.path.basename(pv['derived_from'])} | x{pv['scale_to_canvas']}"
            else:
                cap = f"{sh} r{pv['grid'][0]}c{pv['grid'][1]} | {pv['rule']} | kept {pv['components_kept']}" + \
                      (f", dropped {len(pv['dropped'])}" if pv["dropped"] else "") + f" | x{pv['scale_to_canvas']}"
            tiles.append((f"pieces/{nm}.png", arr, cap))
    contact(tiles, os.path.join(QA, f"{rig}_pieces_r2.png"),
            f"{rig} r2.1 sheet pieces at 2x (piece pixels x2), fixed-grid cut; caption: sheet row/col | rule | kept"
            f" components | scale_to_canvas", 2.0)
    ltiles = []
    for nm in sorted(L):
        arr = L[nm]
        if not (arr[..., 3] > 0).any():
            continue
        ys_, xs_ = np.nonzero(arr[..., 3] > 0)
        ltiles.append((nm + ".png", _trim(arr), f"canvas bbox x {xs_.min()}-{xs_.max()} y {ys_.min()}-{ys_.max()}"))
    contact(ltiles, os.path.join(QA, f"{rig}_layers_r2.png"),
            f"{rig} r2.1 canvas layers (1024x1536, feet y 1440) trimmed to their alpha box, shown at 0.5x", 0.5,
            max_w=2600)
    write_json(rec, os.path.join(out_dir, "registration.json"))
    known = {nm for v in rec["pieces"].values() for nm in v["pieces"]}
    for f in sorted(os.listdir(os.path.join(out_dir, "pieces"))):
        if f.endswith(".png") and not f.startswith(".tmp_") and f[:-4] not in known:
            print(f"WARN {rig}/pieces/{f} is not a registered piece (stale: remove it)")
    return rec


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--rig", nargs="*", default=["pf_chief", "pf_rookie", "pf_dog", "pf_rescued"])
    ap.add_argument("--refit", action="store_true", help="re-run the r1 colour fits instead of reusing them")
    a = ap.parse_args()
    for r in a.rig:
        rec = build(r, a.refit)
        print(r, "master h", rec["master"]["height_px"], "reassembly IoU", rec["qa"]["reassembly_iou"])
        for sh, v in rec["pieces"].items():
            print("  ", sh, "pieces", len(v["pieces"]), "outside cells", len(v["outside_every_cell"]))
    print("CHANGED", len(CHANGED))
    for p in CHANGED:
        print("  ", p)
