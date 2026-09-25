#!/usr/bin/env python3
"""Shared helpers for the PIGGY FIREFIGHTERS art lane (tools/art/*.py).

Adapted from the family's donor helpers (LUCKY tools/art/art_b_common.py + the fit/clean helpers of
derive_symbols.py / derive_symbols_tall.py + derive_scene_b.warp_frame / period, derive_cards_b.window,
derive_scene.relight). Only the code idea is reused; no donor pixels are read or shipped by any tool here.

Pipeline (docs/PIGGY_FIREFIGHTERS_THEME.md, art map section 2):
  paid gpt-image call (tools/art/gen_art.py) -> raw PNG in art-src/generated/<batch>/<name>.png (NEVER edited)
  -> deterministic derive_*.py (this module) -> runtime file in apps/piggy_firefighters/static/assets/<family>/

Rules enforced here:
  * never write into static/assets/{hud,fonts,audio,spine,placeholder} (guard_out)
  * before a derive writes into a runtime family dir, the untracked LUCKY donor copies in it are deleted
    (purge_donor_copies: only files git does not track AND byte-identical to the donor file at the same path)
  * alpha clean-up (the model's alpha tops out at 254 and leaves a faint coloured glow), speck removal, RGB zeroed
    under alpha 0 before any lossy WEBP

CLI (utility):
  python3 tools/art/art_common.py purge-donor sprites buycards [--execute]   # dry run unless --execute
  python3 tools/art/art_common.py alpha <png|webp>...                        # genuine-alpha report
  python3 tools/art/art_common.py contact --out sheet.png <img>...           # light/dark contact sheet
"""
import hashlib
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
APP = os.path.join(REPO, "apps", "piggy_firefighters")
STATIC = os.path.join(APP, "static", "assets")
GEN = os.path.join(REPO, "art-src", "generated")
PROMPTS = os.path.join(GEN, "prompts")
RECORD = os.path.join(GEN, "source-record.json")
REFS = os.path.join(REPO, "art-src", "reference")
FONT = os.path.join(REPO, "art-src", "branding", "fonts", "AlfaSlabOne-Regular.ttf")
QA = os.path.join(REPO, "qa", "art")
# the LUCKY donor's runtime tree: read ONLY to recognise byte-identical donor copies that must not ship
DONOR_STATIC = os.environ.get("PF_DONOR_STATIC", "/home/user/lucky/apps/lucky/static/assets")

# runtime families the art lane writes / families it must never touch
RUNTIME_FAMILIES = ("sprites", "environment", "ambient", "buycards", "splash", "winrungs", "maxwin", "ui_scene",
                    "branding", "features")
PROTECTED_FAMILIES = ("hud", "fonts", "audio", "spine", "placeholder")

# theme bible palette (docs/PIGGY_FIREFIGHTERS_THEME.md section 1); flame orange is for fire / FX only
PALETTE = {
    "engine_red": "#D7262B",
    "brass_gold": "#E9B23B",
    "hydrant_yellow": "#F5D23C",
    "hose_cream": "#F4E9D2",
    "smoke_grey": "#7C8AA0",
    "dusk_navy": "#1E2A4A",
    "flame_orange": "#FF7A1A",
}
INK = (42, 26, 16, 255)  # thick dark-brown ink (never pure black)

ALPHA_CLEAN = 150  # alpha below this -> 0 (the model's faint coloured halo)
SPECK_PX = 150  # alpha components smaller than this are stray specks
INK_ALPHA = 24  # a pixel counts as ink above this alpha (a faint painted shadow must not count)
# request sizes the image API accepts (derive steps own the final pixel size)
API_SIZES = ("1024x1024", "1024x1536", "1536x1024")


# ----------------------------------------------------------------------------------------------- colour
def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def rgba(h, a=255):
    return hex_rgb(h) + (a,)


def rgb_hex(c):
    return "#%02X%02X%02X" % tuple(int(v) for v in c[:3])


P = {k: rgba(v) for k, v in PALETTE.items()}


# ------------------------------------------------------------------------------------------------ paths
def rel(path):
    """Repo-relative path for records (absolute paths outside the repo are kept as-is)."""
    ap = os.path.abspath(path)
    return os.path.relpath(ap, REPO) if ap.startswith(REPO + os.sep) else ap


def src_path(name, base=GEN):
    """Resolve a generated source: absolute path, repo-relative path, '<batch>/<name>' or a bare name that is
    unique under art-src/generated/** ('.png' is added when missing)."""
    cands = []
    n = name if name.lower().endswith((".png", ".webp", ".jpg")) else name + ".png"
    if os.path.isabs(n):
        cands.append(n)
    else:
        cands += [os.path.join(base, n), os.path.join(REPO, n)]
    for c in cands:
        if os.path.isfile(c):
            return c
    if os.sep not in n and "/" not in n and os.path.isdir(base):
        hits = []
        for dp, dns, fs in os.walk(base):
            dns[:] = [d for d in dns if d not in ("superseded", "prompts")]
            if n in fs:
                hits.append(os.path.join(dp, n))
        if len(hits) == 1:
            return hits[0]
        if len(hits) > 1:
            raise FileNotFoundError(f"{name}: ambiguous, name the batch ({[rel(h) for h in hits]})")
    raise FileNotFoundError(f"source not found: {name}")


def exists_src(name, base=GEN):
    try:
        src_path(name, base)
        return True
    except FileNotFoundError:
        return False


def guard_out(path):
    """Refuse any write into the protected runtime families (hud, fonts, audio, spine, placeholder)."""
    ap = os.path.abspath(path)
    for fam in PROTECTED_FAMILIES:
        root = os.path.join(STATIC, fam)
        if ap == root or ap.startswith(root + os.sep):
            raise SystemExit(f"refusing to write into protected static/assets/{fam}: {rel(ap)}")
    return ap


def _git_tracked(paths):
    if not paths:
        return set()
    out = subprocess.run(["git", "ls-files", "-z", "--"] + [rel(p) for p in paths], cwd=REPO,
                         capture_output=True, text=True).stdout
    return {os.path.join(REPO, p) for p in out.split("\0") if p}


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def donor_copies(dirpath):
    """Untracked files under `dirpath` (inside static/assets) that are byte-identical to the LUCKY donor file at
    the same relative path. Only these are ever purged: our own outputs and other lanes' files never match."""
    ap = os.path.abspath(dirpath)
    if not (ap.startswith(STATIC + os.sep) and os.path.isdir(ap) and os.path.isdir(DONOR_STATIC)):
        return []
    files = []
    for dp, _, fs in os.walk(ap):
        files += [os.path.join(dp, f) for f in fs]
    tracked = _git_tracked(files)
    hits = []
    for f in files:
        if f in tracked:
            continue
        twin = os.path.join(DONOR_STATIC, os.path.relpath(f, STATIC))
        if os.path.isfile(twin) and os.path.getsize(twin) == os.path.getsize(f) and sha256_file(twin) == sha256_file(f):
            hits.append(f)
    return sorted(hits)


def purge_donor_copies(dirpath, execute=True, quiet=False):
    """Delete the untracked LUCKY donor copies in a runtime family dir (task rule: before writing into a family
    dir, delete the donor files in it). Returns the list of (would-be) removed repo-relative paths."""
    guard_out(dirpath)
    hits = donor_copies(dirpath)
    for f in hits:
        if execute:
            os.remove(f)
    if execute:  # drop directories the purge emptied
        for dp, dns, fs in sorted(os.walk(os.path.abspath(dirpath)), key=lambda t: -len(t[0])):
            if dp != os.path.abspath(dirpath) and not os.listdir(dp):
                os.rmdir(dp)
    if hits and not quiet:
        print(f"{'purged' if execute else 'would purge'} {len(hits)} donor copies under {rel(dirpath)}")
    return [rel(h) for h in hits]


def prepare_out(dirpath, purge=True):
    """mkdir an output dir; when it is a runtime family dir, purge the donor copies first."""
    ap = guard_out(dirpath)
    if purge and ap.startswith(STATIC + os.sep):
        fam_root = os.path.join(STATIC, os.path.relpath(ap, STATIC).split(os.sep)[0])
        purge_donor_copies(fam_root, execute=True)
    os.makedirs(ap, exist_ok=True)
    return ap


def out_root(args_out):
    """--out overrides STATIC (tests / staging); the donor purge only ever runs on the real STATIC tree."""
    return os.path.abspath(args_out) if args_out else STATIC


# ---------------------------------------------------------------------------------------------- loading
def open_rgba(name_or_path):
    p = name_or_path if os.path.isfile(str(name_or_path)) else src_path(name_or_path)
    return Image.open(p).convert("RGBA")


def load_rgba(name, clean=True, thresh=ALPHA_CLEAN):
    """Load a transparent source as an RGBA array: normalise the alpha ramp (the model tops out at 254), cut the
    faint outer glow below `thresh` (short anti-aliased ramp kept at the ink edge), zero RGB under alpha 0."""
    arr = np.array(open_rgba(name))
    a = arr[:, :, 3].astype(np.float32)
    hi = max(1.0, float(a.max()))
    a = np.clip(a * 255.0 / hi, 0, 255)
    if clean:
        a = np.where(a < thresh, 0, np.clip((a - thresh) * 255.0 / (240 - thresh), 0, 255))
    arr[:, :, 3] = a.astype(np.uint8)
    arr[arr[:, :, 3] == 0, :3] = 0
    return arr


def load_clean(name, thresh=ALPHA_CLEAN, speck=SPECK_PX):
    """load_rgba + drop stray specks -> PIL RGBA (the usual first step of every sprite derive)."""
    return clean_specks(Image.fromarray(load_rgba(name, True, thresh), "RGBA"), speck)


def load_rgb(name):
    p = name if os.path.isfile(str(name)) else src_path(name)
    return Image.open(p).convert("RGB")


# --------------------------------------------------------------------------------------- alpha / shapes
def clean_specks(im, min_px=SPECK_PX):
    """Drop alpha components smaller than `min_px` so the bbox is the object's, not a stray pixel's."""
    a = np.array(im.convert("RGBA"))
    alpha = a[:, :, 3]
    lab, n = ndi.label(alpha > 0)
    if n > 1:
        sizes = ndi.sum(np.ones_like(alpha), lab, range(1, n + 1))
        keep = np.zeros(n + 1, bool)
        keep[1:] = sizes >= min_px
        a[:, :, 3] = np.where(keep[lab], alpha, 0)
        a[a[:, :, 3] == 0, :3] = 0
    return Image.fromarray(a, "RGBA")


def components(arr, min_area=2000, pad=3):
    """Connected alpha components [{box:(x0,y0,x1,y1), arr: isolated RGBA crop, area}] (sprite-sheet splitter)."""
    if isinstance(arr, Image.Image):
        arr = np.array(arr.convert("RGBA"))
    lab, _ = ndi.label(arr[:, :, 3] > 0)
    out = []
    for i, sl in enumerate(ndi.find_objects(lab)):
        if sl is None:
            continue
        area = int((lab[sl] == i + 1).sum())
        if area < min_area:
            continue
        y0, y1 = max(0, sl[0].start - pad), min(arr.shape[0], sl[0].stop + pad)
        x0, x1 = max(0, sl[1].start - pad), min(arr.shape[1], sl[1].stop + pad)
        piece = arr[y0:y1, x0:x1].copy()
        piece[lab[y0:y1, x0:x1] != i + 1] = 0
        out.append({"box": (x0, y0, x1, y1), "arr": piece, "area": area})
    return out


def sort_grid(comps, rows):
    """Order components row by row (rows split at the largest gaps between box centres), then left to right."""
    if not comps:
        return comps
    cy = sorted(((c["box"][1] + c["box"][3]) / 2, i) for i, c in enumerate(comps))
    if rows > 1:
        gaps = sorted(range(1, len(cy)), key=lambda j: cy[j][0] - cy[j - 1][0], reverse=True)[:rows - 1]
        cuts = sorted(cy[j][0] for j in gaps)
    else:
        cuts = []
    def row_of(c):
        m = (c["box"][1] + c["box"][3]) / 2
        return sum(m >= t for t in cuts)
    return sorted(comps, key=lambda c: (row_of(c), c["box"][0]))


def piece_image(comp):
    im = Image.fromarray(comp["arr"], "RGBA")
    return im.crop(im.getbbox())


def trim(im):
    bb = im.getbbox()
    return im.crop(bb) if bb else im


def ink_bbox(im, threshold=INK_ALPHA):
    return im.getchannel("A").point(lambda v: 255 if v > threshold else 0).getbbox()


def fit_to_box(im, tw, th, fill_w, fill_h, scale=None):
    """Trim to the INK box and fit so the object touches `fill_w` of the width or `fill_h` of the height, whichever
    limits first; centre on a transparent tw x th canvas. Returns (canvas, scale)."""
    bb = ink_bbox(im)
    if bb:
        im = im.crop(bb)
    k = scale if scale is not None else min(tw * fill_w / im.width, th * fill_h / im.height)
    obj = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    if obj.width > tw or obj.height > th:  # a matched pose may spread wider: never clip it
        k2 = min(tw / obj.width, th / obj.height)
        obj = obj.resize((max(1, round(obj.width * k2)), max(1, round(obj.height * k2))), Image.LANCZOS)
    canvas = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    canvas.alpha_composite(obj, ((tw - obj.width) // 2, (th - obj.height) // 2))
    return canvas, k


def trim_pad_square(im, tile, pad):
    """The family's square symbol box: the larger ink side = tile / (1 + 2 * pad) (pad 0.068 -> 88 %)."""
    fill = 1.0 / (1 + 2 * pad)
    return fit_to_box(im, tile, tile, fill, fill)[0]


def matched_scale(a, tw, th, fill_w, fill_h):
    """Pose A's fit factor (used to tile pose B / the Blaze Wild so the win cut never changes size)."""
    ab = a.crop(ink_bbox(a))
    return min(tw * fill_w / ab.width, th * fill_h / ab.height)


def pose_b_matched(a, b, tw, th, fill_w, fill_h):
    return fit_to_box(b, tw, th, fill_w, fill_h, scale=matched_scale(a, tw, th, fill_w, fill_h))[0]


def fill_ratio(im, threshold=INK_ALPHA):
    bb = ink_bbox(im, threshold)
    if not bb:
        return (0.0, 0.0)
    return ((bb[2] - bb[0]) / im.width, (bb[3] - bb[1]) / im.height)


def fit_into(im, size, anchor="center", margin=0.0, scale=None):
    """Contain RGBA `im` in a transparent canvas of `size`, anchored center|bottom|top|left|right.
    Returns (canvas, scale, (x, y))."""
    W, H = size
    iw, ih = im.size
    s = scale if scale is not None else min((W * (1 - 2 * margin)) / iw, (H * (1 - 2 * margin)) / ih)
    nw, nh = max(1, round(iw * s)), max(1, round(ih * s))
    im2 = im.resize((nw, nh), Image.LANCZOS)
    x, y = (W - nw) // 2, (H - nh) // 2
    if anchor == "bottom":
        y = H - nh - round(H * margin)
    elif anchor == "top":
        y = round(H * margin)
    elif anchor == "left":
        x = round(W * margin)
    elif anchor == "right":
        x = W - nw - round(W * margin)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.alpha_composite(im2, (x, y))
    return canvas, s, (x, y)


def cover(im, size, focus=(0.5, 0.5)):
    """Cover-crop an opaque picture to `size` around a focus point (fractions of the source)."""
    W, H = size
    iw, ih = im.size
    s = max(W / iw, H / ih)
    nw, nh = max(W, round(iw * s)), max(H, round(ih * s))
    im2 = im.resize((nw, nh), Image.LANCZOS)
    x = min(max(0, round(nw * focus[0] - W / 2)), nw - W)
    y = min(max(0, round(nh * focus[1] - H / 2)), nh - H)
    return im2.crop((x, y, x + W, y + H))


def window(im, zoom=1.0, fx=0.5, fy=0.5, aspect=1.5):
    """Crop a window of `aspect` (w/h), `zoom` >= 1, centred at (fx, fy) of the painting, clamped inside it."""
    W, H = im.size
    if aspect * H <= W:
        h = H / zoom
        w = h * aspect
    else:
        w = W / zoom
        h = w / aspect
    x = min(max(0, fx * W - w / 2), W - w)
    y = min(max(0, fy * H - h / 2), H - h)
    return im.crop((round(x), round(y), round(x + w), round(y + h)))


def relight(im, mul, gamma=1.0, mix=1.0, add=(0.0, 0.0, 0.0), sat=1.0):
    """Mood variant of one plate: per-channel multiply, gamma, additive cast, saturation, mixed toward the original."""
    arr = np.asarray(im.convert("RGB")).astype(np.float32) / 255.0
    lit = np.clip(arr * np.array(mul, np.float32), 0, 1)
    if gamma != 1.0:
        lit = np.power(lit, gamma)
    lit = np.clip(lit + np.array(add, np.float32), 0, 1)
    if sat != 1.0:
        gray = lit.mean(axis=2, keepdims=True)
        lit = np.clip(gray + (lit - gray) * sat, 0, 1)
    out = np.clip(arr * (1 - mix) + lit * mix, 0, 1)
    return Image.fromarray((out * 255 + 0.5).astype("uint8"), "RGB")


def hard_alpha(im, thresh=ALPHA_CLEAN):
    """0/255 alpha (frames that are sliced at runtime must not carry a soft halo)."""
    a = np.array(im.convert("RGBA"))
    solid = a[:, :, 3] >= thresh
    a[~solid] = 0
    a[:, :, 3] = np.where(solid, 255, 0)
    return Image.fromarray(a, "RGBA")


def warp_sep(arr, xs_src, xs_dst, ys_src, ys_dst, size):
    """Separable piecewise-linear warp (premultiplied, cubic) so measured source knots land on fixed runtime
    geometry: destination x/y knot lists map to source knot lists. Returns an RGBA uint8 array."""
    W, H = size
    gx = np.interp(np.arange(W) + 0.5, xs_dst, xs_src) - 0.5
    gy = np.interp(np.arange(H) + 0.5, ys_dst, ys_src) - 0.5
    GY, GX = np.meshgrid(gy, gx, indexing="ij")
    f = np.asarray(arr).astype(np.float32) / 255.0
    pre = f[:, :, :3] * f[:, :, 3:4]
    out = np.zeros((H, W, 4), np.float32)
    for c in range(3):
        out[:, :, c] = ndi.map_coordinates(pre[:, :, c], [GY, GX], order=3, mode="constant")
    out[:, :, 3] = ndi.map_coordinates(f[:, :, 3], [GY, GX], order=3, mode="constant")
    out = np.clip(out, 0, 1)
    a = out[:, :, 3:4]
    rgb = np.where(a > 1e-4, out[:, :, :3] / np.maximum(a, 1e-4), 0)
    return (np.concatenate([np.clip(rgb, 0, 1), a], axis=2) * 255 + 0.5).astype(np.uint8)


def period(profile, lo, hi):
    """Dominant period of a 1-D profile between lo and hi px (autocorrelation peak)."""
    p = np.asarray(profile, np.float64)
    p = p - p.mean()
    ac = np.correlate(p, p, mode="full")[len(p) - 1:]
    hi = min(hi, len(ac) - 1)
    return lo + int(np.argmax(ac[lo:hi]))


# -------------------------------------------------------------------------------------------- saving
def zero_rgb_under_clear(im):
    arr = np.array(im.convert("RGBA"))
    arr[arr[:, :, 3] == 0, :3] = 0
    return Image.fromarray(arr, "RGBA")


def save_webp(im, path, quality=90, lossless=False):
    guard_out(path)
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    if im.mode == "RGBA":
        im = zero_rgb_under_clear(im)
        im.save(path, "WEBP", quality=quality, method=6, exact=False, lossless=lossless)
    else:
        im.convert("RGB").save(path, "WEBP", quality=quality, method=6, lossless=lossless)
    return os.path.getsize(path)


def save_png(im, path):
    guard_out(path)
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    if im.mode == "RGBA":
        im = zero_rgb_under_clear(im)
    im.save(path, "PNG", optimize=True)
    return os.path.getsize(path)


def _json_default(o):
    if isinstance(o, np.integer):
        return int(o)
    if isinstance(o, np.floating):
        return float(o)
    if isinstance(o, np.ndarray):
        return o.tolist()
    raise TypeError(f"not JSON serialisable: {type(o).__name__}")


def write_json(path, obj, indent=2):
    """Atomic JSON write (numpy scalars allowed); a failed dump never leaves a half-written file behind."""
    guard_out(path)
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    text = json.dumps(obj, indent=indent, default=_json_default) + "\n"
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        f.write(text)
    os.replace(tmp, path)


def expect_size(path, size):
    got = Image.open(path).size
    assert tuple(got) == tuple(size), f"{path}: {got} != {size}"


# ------------------------------------------------------------------------------------------------ QA
def alpha_report(im):
    """Genuine-alpha inspection: mode, alpha extrema, fully transparent share, soft-edge share, clear corners."""
    if isinstance(im, str):
        im = Image.open(im)
    rep = {"mode": im.mode, "size": list(im.size)}
    if im.mode not in ("RGBA", "LA") and not (im.mode == "P" and "transparency" in im.info):
        rep.update(has_alpha=False)
        return rep
    a = np.array(im.convert("RGBA"))[:, :, 3]
    corners = [int(a[0, 0]), int(a[0, -1]), int(a[-1, 0]), int(a[-1, -1])]
    rgb = np.array(im.convert("RGBA"))[:, :, :3].astype(int)
    clear = a == 0
    # a painted checkerboard behind the object shows up as opaque grey/white alternation where it should be clear
    checker = False
    if (a == 255).all():
        g = rgb.mean(axis=2)
        edge = np.concatenate([g[0], g[-1], g[:, 0], g[:, -1]])
        checker = bool(edge.std() > 20 and (np.abs(np.diff(edge)) > 25).mean() > 0.02)
    rep.update(has_alpha=True, alpha_min=int(a.min()), alpha_max=int(a.max()),
               transparent=round(float(clear.mean()), 4), soft_edge=round(float(((a > 0) & (a < 255)).mean()), 4),
               corners=corners, corners_clear=max(corners) == 0, painted_checker=checker,
               genuine=bool(a.min() == 0 and a.max() == 255 and clear.mean() > 0.001 and not checker))
    return rep


def label_font(size=14):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/dejavu/DejaVuSans.ttf",
              "/System/Library/Fonts/Supplemental/Arial.ttf"):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def contact_sheet(items, out, cell=192, small=(85, 40), bgs=((244, 240, 232), (24, 28, 40)), cols=None):
    """QA sheet: each item (label, PIL image or path) at `cell` px plus the reel-scale sizes in `small`, on a light
    AND a dark ground (art map section 8: read at ~85 px desktop / ~40 px phone). Returns the output path."""
    font = label_font(13)
    rows_img = []
    for bg in bgs:
        tiles = []
        for label, im in items:
            if isinstance(im, str):
                im = Image.open(im)
            im = im.convert("RGBA")
            k = cell / max(im.size)
            big = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
            w = cell + sum(s + 8 for s in small) + 8
            t = Image.new("RGB", (w, cell + 22), bg)
            base = Image.new("RGBA", t.size, bg + (255,))
            base.alpha_composite(big, ((cell - big.width) // 2, 22 + (cell - big.height) // 2))
            x = cell + 8
            for s in small:
                k2 = s / max(im.size)
                sm = im.resize((max(1, round(im.width * k2)), max(1, round(im.height * k2))), Image.LANCZOS)
                base.alpha_composite(sm, (x, 22 + (cell - sm.height) // 2))
                x += s + 8
            t = base.convert("RGB")
            ImageDraw.Draw(t).text((4, 3), label[:40], fill=(128, 128, 128), font=font)
            tiles.append(t)
        n = cols or min(len(tiles), 6)
        w0, h0 = tiles[0].size
        rows = (len(tiles) + n - 1) // n
        sheet = Image.new("RGB", (n * w0, rows * h0), bg)
        for i, t in enumerate(tiles):
            sheet.paste(t, ((i % n) * w0, (i // n) * h0))
        rows_img.append(sheet)
    W = max(r.width for r in rows_img)
    out_im = Image.new("RGB", (W, sum(r.height for r in rows_img)), (128, 128, 128))
    y = 0
    for r in rows_img:
        out_im.paste(r, (0, y))
        y += r.height
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    out_im.save(out)
    return out


# ------------------------------------------------------------------------------------------------ CLI
def _main(argv):
    import argparse

    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p1 = sub.add_parser("purge-donor", help="list (or delete with --execute) untracked LUCKY donor copies")
    p1.add_argument("families", nargs="+", choices=RUNTIME_FAMILIES + ("hat3d", "build"))
    p1.add_argument("--execute", action="store_true")
    p2 = sub.add_parser("alpha", help="genuine-alpha report")
    p2.add_argument("files", nargs="+")
    p3 = sub.add_parser("contact", help="light/dark contact sheet at reel scale")
    p3.add_argument("files", nargs="+")
    p3.add_argument("--out", required=True)
    a = ap.parse_args(argv)
    if a.cmd == "purge-donor":
        for fam in a.families:
            hits = purge_donor_copies(os.path.join(STATIC, fam), execute=a.execute, quiet=True)
            print(f"{fam}: {len(hits)} donor copies {'deleted' if a.execute else '(dry run; --execute deletes)'}")
            for h in hits[:200]:
                print("   ", h)
    elif a.cmd == "alpha":
        for f in a.files:
            print(f, json.dumps(alpha_report(f)))
    elif a.cmd == "contact":
        print(contact_sheet([(os.path.basename(f), f) for f in a.files], a.out))


if __name__ == "__main__":
    _main(sys.argv[1:])
