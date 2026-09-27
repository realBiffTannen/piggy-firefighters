#!/usr/bin/env python3
"""Derive the win rungs' runtime LIGHT textures: local numpy / Pillow, deterministic, zero paid calls, no donor bytes,
no text, no gloss baked in (every file is white-on-alpha; WinRungs.svelte tints and blends it per rung at runtime).

  winrungs/fx/radial_bloom.webp   256x256  alpha 1 -> .45 at 35 % of the radius -> 0 at the rim (additive, behind the sign)
  winrungs/fx/light_pool.webp     256x256  alpha 1 flat to 40 % of the radius, smoothstep to 0 at the rim (normal blend:
                                           the per-rung pool that recolours the plate around the sign)
  winrungs/fx/vignette.webp       256x256  alpha 0 in the middle -> 1 in the corners (tinted navy, normal blend)
  winrungs/fx/ember_dot.webp       64x64   near-white hot core + soft halo (additive; tinted flame orange)
  winrungs/fx/shine_band.webp     128x512  soft vertical band, feathered ends (additive glint swept across the sign)
  winrungs/fx/sign_glow_<rung>.webp        quarter-scale dilated (MaxFilter 5) + blurred (Gaussian 8) alpha silhouette of
                                           winrungs/signs/<rung>.webp, 28 px padding at quarter scale, lossy q88
                                           (the runtime places it at the sign's centre at scale 4; additive, tinted)

The lineage (tool, inputs + their sha256, parameters, output sha256, cost 0) is written to
art-src/winrungs/source-record.json (model "local-derivation"). The sign_glow files depend on the signs: re-run this
after `derive_winrungs.py signs`.

Usage (from the repo root):
  python3 tools/art/derive_rung_light.py            # write the ten files + the source record
  python3 tools/art/derive_rung_light.py --check    # gate: regenerate in a temp dir and compare with the shipped files
                                                     # and the record; exit 1 on any drift (writes nothing)
  python3 tools/art/derive_rung_light.py --out DIR  # write under DIR/winrungs/fx instead (staging; no record)
"""
import argparse
import hashlib
import json
import os
import sys
import tempfile

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from art_common import REPO, STATIC, guard_out, rel  # noqa: E402

TOOL = "tools/art/derive_rung_light.py"
RECORD = os.path.join(REPO, "art-src", "winrungs", "source-record.json")
RUNGS = ("big", "huge", "mega", "epic", "max")
GLOW_PAD, GLOW_DOWN, GLOW_DILATE, GLOW_BLUR, GLOW_GAMMA, GLOW_Q = 28, 4, 5, 8, 0.85, 88
# --check tolerance for the lossy glow copies (another libwebp build may round a few values differently)
LOSSY_MAX, LOSSY_MEAN = 12, 0.5


def grid(w, h):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    return x + 0.5, y + 0.5


def sha256_file(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def white_on_alpha(alpha):
    a = np.clip(alpha, 0, 1)
    arr = np.zeros(a.shape + (4,), np.uint8)
    arr[..., :3] = 255
    arr[..., 3] = np.round(a * 255).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


# ------------------------------------------------------------------------------------------------ textures
def radial_bloom():
    x, y = grid(256, 256)
    r = np.hypot(x - 128, y - 128) / 128
    inner = 1 - 0.55 * np.clip(r / 0.35, 0, 1) ** 1.3
    outer = 0.45 * (1 - np.clip((r - 0.35) / 0.65, 0, 1)) ** 2.2
    a = np.where(r < 0.35, inner, outer)
    a[r >= 1] = 0
    return a


def light_pool():
    x, y = grid(256, 256)
    r = np.hypot(x - 128, y - 128) / 128
    t = np.clip((r - 0.4) / 0.6, 0, 1)
    a = 1 - t * t * (3 - 2 * t)
    a[r >= 1] = 0
    return a


def vignette():
    x, y = grid(256, 256)
    d = np.hypot((x - 128) / 128, (y - 128) / 128) / np.sqrt(2)
    return np.clip((d - 0.22) / 0.78, 0, 1) ** 1.35


def ember_dot():
    x, y = grid(64, 64)
    r = np.hypot(x - 32, y - 32) / 32
    halo = np.exp(-(r ** 2) / (2 * 0.33 ** 2)) * 0.75
    core = np.exp(-(r ** 2) / (2 * 0.1 ** 2))
    a = np.clip(halo + core, 0, 1)
    a[r >= 1] = 0
    return a


def shine_band():
    x, y = grid(128, 512)
    u = (x - 64) / 64
    across = np.exp(-(u ** 2) / (2 * 0.26 ** 2)) + 0.5 * np.exp(-(u ** 2) / (2 * 0.07 ** 2))
    along = np.clip(np.minimum(y, 512 - y) / 110, 0, 1) ** 1.5
    a = np.clip(across * along, 0, 1)
    a[:, [0, -1]] = 0
    return a


def sign_glow(sign_path):
    src = Image.open(sign_path).convert("RGBA")
    w, h = src.size
    qw, qh = w // GLOW_DOWN, h // GLOW_DOWN
    alpha = src.getchannel("A").resize((qw, qh), Image.LANCZOS)
    canvas = Image.new("L", (qw + GLOW_PAD * 2, qh + GLOW_PAD * 2), 0)
    canvas.paste(alpha, (GLOW_PAD, GLOW_PAD))
    canvas = canvas.filter(ImageFilter.MaxFilter(GLOW_DILATE)).filter(ImageFilter.GaussianBlur(GLOW_BLUR))
    a = np.asarray(canvas, np.float32) / 255.0
    return np.clip(a / max(1e-6, float(a.max())), 0, 1) ** GLOW_GAMMA


PROCEDURAL = [  # name, builder, method (for the record)
    ("radial_bloom", radial_bloom, "radial falloff: 1 - 0.55*(r/0.35)^1.3 inside 35 %, 0.45*(1-(r-0.35)/0.65)^2.2 outside, 0 at r>=1"),
    ("light_pool", light_pool, "flat 1 to 40 % of the radius, smoothstep to 0 at the rim"),
    ("vignette", vignette, "clamp((d-0.22)/0.78)^1.35, d = normalised corner distance"),
    ("ember_dot", ember_dot, "gaussian halo (sigma .33, x.75) + gaussian core (sigma .1), cut at r>=1"),
    ("shine_band", shine_band, "two gaussians across x (sigma .26 + .5 x sigma .07), ends feathered over 110 px (^1.5)"),
]


def outputs(signs_dir):
    """[(name, alpha, lossless, inputs, method)] in record order."""
    out = [(n, fn(), True, [], m) for n, fn, m in PROCEDURAL]
    for rung in RUNGS:
        p = os.path.join(signs_dir, f"{rung}.webp")
        out.append((f"sign_glow_{rung}", sign_glow(p), False, [p],
                    f"alpha of the sign, 1/{GLOW_DOWN} scale (LANCZOS), {GLOW_PAD} px pad, MaxFilter({GLOW_DILATE}) dilate, "
                    f"GaussianBlur({GLOW_BLUR}), normalised to max 1, gamma {GLOW_GAMMA}; runtime scale {GLOW_DOWN}"))
    return out


def write(fx_dir, items):
    os.makedirs(fx_dir, exist_ok=True)
    written = []
    for name, alpha, lossless, _inputs, _m in items:
        path = guard_out(os.path.join(fx_dir, f"{name}.webp"))
        im = white_on_alpha(alpha)
        if lossless:
            im.save(path, "WEBP", lossless=True, method=6)
        else:
            im.save(path, "WEBP", quality=GLOW_Q, method=6)
        written.append(path)
    return written


def record(items, fx_dir):
    entries = []
    for name, _alpha, lossless, inputs, method in items:
        path = os.path.join(fx_dir, f"{name}.webp")
        im = Image.open(path)
        entries.append({
            "output": f"apps/piggy_firefighters/static/assets/winrungs/fx/{name}.webp",
            "model": "local-derivation",
            "tool": TOOL,
            "inputs": [{"path": rel(p), "sha256": sha256_file(p)} for p in inputs],
            "method": method,
            "encoding": "webp lossless method 6" if lossless else f"webp lossy q{GLOW_Q} method 6",
            "size": list(im.size),
            "bytes": os.path.getsize(path),
            "sha256": sha256_file(path),
            "cost_estimate_usd": 0,
        })
    return {
        "asset_family": "winrungs/fx runtime light (radial bloom, light pool, vignette, ember, shine band, sign glow copies)",
        "owner_lane": "Claude frontend lane (win rungs)",
        "tool": TOOL,
        "paid_generation": "none: every file is computed locally with numpy + Pillow; no API call, no donor bytes, no text",
        "consumer": "apps/piggy_firefighters/src/components/WinRungs.svelte via src/game/assetsScene.ts (lazy 'winrungs' set)",
        "rerun": "python3 tools/art/derive_rung_light.py (after `derive_winrungs.py signs`, which the sign_glow files derive from)",
        "gate": "python3 tools/art/derive_rung_light.py --check (qa/gate/run.mjs)",
        "cost_estimate_usd_total": 0,
        "entries": entries,
    }


def decoded(path):
    return np.asarray(Image.open(path).convert("RGBA"), np.int16)


def check(signs_dir, fx_dir):
    problems = []
    try:
        rec = json.load(open(RECORD))
    except (OSError, ValueError) as e:
        rec = None
        problems.append(f"source record unreadable: {rel(RECORD)} ({e})")
    by_out = {e["output"]: e for e in (rec or {}).get("entries", [])}
    with tempfile.TemporaryDirectory() as tmp:
        items = outputs(signs_dir)
        write(tmp, items)
        for name, _alpha, lossless, inputs, _m in items:
            shipped, fresh = os.path.join(fx_dir, f"{name}.webp"), os.path.join(tmp, f"{name}.webp")
            key = f"apps/piggy_firefighters/static/assets/winrungs/fx/{name}.webp"
            if not os.path.isfile(shipped):
                problems.append(f"{name}: shipped file missing")
                continue
            a, b = decoded(shipped), decoded(fresh)
            if a.shape != b.shape:
                problems.append(f"{name}: size {a.shape[1]}x{a.shape[0]} != derived {b.shape[1]}x{b.shape[0]}")
            else:
                d = np.abs(a[..., 3] - b[..., 3])
                if lossless and d.max() != 0:
                    problems.append(f"{name}: alpha differs from the derivation (max {d.max()})")
                elif not lossless and (d.max() > LOSSY_MAX or d.mean() > LOSSY_MEAN):
                    problems.append(f"{name}: alpha drift max {d.max()} mean {d.mean():.3f} (limit {LOSSY_MAX}/{LOSSY_MEAN})")
            e = by_out.get(key)
            if rec is not None and e is None:
                problems.append(f"{name}: no entry in {rel(RECORD)}")
            elif e is not None:
                if e.get("sha256") != sha256_file(shipped):
                    problems.append(f"{name}: shipped sha256 != record")
                if e.get("model") != "local-derivation" or e.get("cost_estimate_usd") != 0:
                    problems.append(f"{name}: record must say model local-derivation, cost 0")
                want = {rel(p): sha256_file(p) for p in inputs}
                got = {i.get("path"): i.get("sha256") for i in e.get("inputs", [])}
                if want != got:
                    problems.append(f"{name}: input lineage stale (sign changed? re-run {TOOL})")
        extra = set(by_out) - {f"apps/piggy_firefighters/static/assets/winrungs/fx/{n}.webp" for n, *_ in items}
        if extra:
            problems.append(f"record names unknown outputs: {sorted(extra)}")
    if problems:
        for p in problems:
            print(f"FAIL derive_rung_light: {p}")
        return 1
    print(f"OK derive_rung_light: {len(items)} winrungs/fx light textures re-derived locally and match the shipped files + "
          f"{rel(RECORD)}")
    return 0


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--check", action="store_true", help="re-derive in a temp dir and compare (writes nothing)")
    ap.add_argument("--out", help="assets root to write under (default: the app's static/assets; no record written)")
    args = ap.parse_args(argv)
    signs_dir = os.path.join(STATIC, "winrungs", "signs")
    fx_dir = os.path.join(STATIC, "winrungs", "fx")
    if args.check:
        return check(signs_dir, fx_dir)
    root = os.path.abspath(args.out) if args.out else STATIC
    target = os.path.join(root, "winrungs", "fx")
    items = outputs(signs_dir)
    for p in write(target, items):
        print(f"wrote {rel(p)} ({os.path.getsize(p)} B)")
    if not args.out:
        os.makedirs(os.path.dirname(RECORD), exist_ok=True)
        with open(RECORD, "w") as f:
            json.dump(record(items, target), f, indent=2)
            f.write("\n")
        print(f"wrote {rel(RECORD)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
