#!/usr/bin/env python3
"""Audit the PIGGY FIREFIGHTERS runtime art (static/assets/<family>/**) before registration / upload.

Per image file:
  * no donor pixels: FAIL if byte-identical to ANY file of the LUCKY donor runtime tree or to any art-src/reference file
  * exact pixel size and mode from the expectation table (RGBA = genuine alpha: alpha 0 and 255 both present,
    transparent pixels exist, no painted checkerboard; sprite families also need four clear corners;
    RGB = fully opaque)
  * reel symbols: the ink box (alpha > 24) of every base symbol hits the family box (square: larger side 88 % +/- 1;
    tall: 86 % of the width or 92 % of the height, +/- 1)
Per family:
  * manifest coverage: every file a manifest names exists, every image in a manifest's dir is named by it (no orphans)
  * the expected inventory: a missing expected file is PENDING (FAIL with --require)
  * budgets: ambient/ <= 1.5 MB, splash/ webp payload <= 1.2 MB
Never touches files; writes qa/art/verify_art.txt + verify_art.json (or --report). Exit 1 on any FAIL.
Agent checks only - not human sign-off.

Usage: python3 tools/art/verify_art.py [--families sprites,buycards] [--root <assets root>] [--require]
"""
import argparse
import fnmatch
import json
import os
import re
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from art_common import (DONOR_STATIC, QA, REFS, RUNTIME_FAMILIES, STATIC, alpha_report, fill_ratio,  # noqa: E402
                        rel, sha256_file)

SYM = ["H1", "H2", "H3", "H4", "L1", "L2", "L3", "L4", "W", "W_blaze", "ALARM", "GALARM"]
MOODS = ["base", "backdraft", "rescue", "inferno"]
# (glob relative to the assets root, size or None, mode, flags)
RULES = [
    ("sprites/symbolsCartoon/sym_*.webp", (384, 384), "RGBA", {"corners", "box_sq"}),
    ("sprites/symbolsCartoonTall/symT_*.webp", (384, 500), "RGBA", {"corners", "box_tall"}),
    ("environment/*_landscape.webp", (2039, 1000), "RGB", set()),
    ("environment/*_portrait.webp", (1242, 2208), "RGB", set()),
    ("ui_scene/board_frame.webp", (1497, 946), "RGBA", set()),
    ("ui_scene/cell_backplate.webp", (963, 645), "RGBA", set()),
    ("ui_scene/cell_frame_*.webp", (384, 384), "RGBA", {"corners"}),
    ("features/rescue/room_*.webp", None, "RGBA", set()),
    ("features/rescue/block_facade*.webp", None, "RGB", set()),
    ("features/rescue/*.webp", None, "RGBA", {"corners"}),
    ("ambient/plate_*_landscape.webp", (1536, 1024), "RGB", set()),
    ("ambient/plate_*_portrait.webp", (1024, 1536), "RGB", set()),
    ("buycards/*.webp", (768, 512), "RGB", set()),
    ("splash/card_*.webp", (768, 768), "RGB", set()),
    ("splash/shutter_slats_tile.webp", (1024, 512), "RGB", set()),
    ("splash/shutter_bottom_bar.webp", (1024, 115), "RGB", set()),
    ("maxwin/max_win_card_16x9.webp", (1600, 900), "RGB", set()),
    ("maxwin/max_win_card_portrait.webp", (900, 1400), "RGB", set()),
    ("winrungs/signs/*.webp", (1200, 728), "RGBA", set()),
    ("winrungs/coins/coin_sheet.webp", (1024, 512), "RGBA", {"corners"}),
    ("winrungs/pieces/*_sheet.webp", (1024, 384), "RGBA", {"corners"}),
    ("winrungs/fx/flare_horizontal.webp", (1024, 128), "RGBA", {"corners"}),
    ("winrungs/fx/ring_shockwave.webp", (512, 512), "RGBA", {"corners"}),
    ("winrungs/fx/glint_4point.webp", (256, 256), "RGBA", {"corners"}),
    ("winrungs/fx/dust_puff.webp", (256, 256), "RGBA", {"corners", "additive"}),
    ("winrungs/fx/light_ray_wedge.webp", (256, 512), "RGBA", {"additive"}),
    ("branding/wordmark.png", (1366, 654), "RGBA", {"corners"}),
    ("branding/wordmark_small.webp", (683, 327), "RGBA", {"corners"}),
    ("ui_scene/*.webp", None, "ANY", set()),
    ("features/*.webp", None, "ANY", set()),
]
EXPECTED = (
    [f"sprites/symbolsCartoon/sym_{s}.webp" for s in SYM]
    + [f"sprites/symbolsCartoonTall/symT_{s}.webp" for s in SYM]
    + [f"environment/{m}_{o}.webp" for m in MOODS for o in ("landscape", "portrait")]
    + ["ui_scene/board_frame.webp", "ui_scene/frame.meta.json", "ui_scene/cell_backplate.webp"]
    + [f"ui_scene/cell_frame_{k}.webp" for k in ("plain", "win", "locked")] + ["ui_scene/line_plate.webp"]
    + [f"features/rescue/room_{r}_{st}.webp" for r in range(5) for st in ("roaring", "smouldering", "safe", "inferno_roaring", "inferno_smouldering", "inferno_safe")]
    + ["features/rescue/rooms.meta.json", "features/rescue/props.meta.json"]
    + [f"buycards/{k}.webp" for k in ("ante", "backdraft-spins", "alarm-call", "rescue", "inferno")]
    + [f"splash/card_{k}.webp" for k in ("chief", "lines", "backdraft", "alarm", "rescue", "maxwin")]
    + ["splash/shutter_slats_tile.webp", "splash/shutter_bottom_bar.webp"]
    + ["maxwin/max_win_card_16x9.webp", "maxwin/max_win_card_portrait.webp"]
    + [f"winrungs/signs/{r}.webp" for r in ("big", "huge", "mega", "epic", "max")]
    + ["winrungs/coins/coin_sheet.webp", "winrungs/coins/coin_sheet.json"]
    + [f"winrungs/pieces/{p}_sheet.webp" for p in ("coin", "ember", "droplet", "badge")]
    + [f"winrungs/fx/{f}.webp" for f in ("flare_horizontal", "ring_shockwave", "glint_4point", "dust_puff", "light_ray_wedge")]
    + ["branding/wordmark.png", "branding/wordmark_small.webp"]
)
MANIFESTS = {  # manifest -> how to list the files it names (relative to the manifest's dir)
    "sprites/symbolsCartoon/manifest.json": lambda m: list(m.get("files", {}).values()),
    "sprites/symbolsCartoonTall/manifest.json": lambda m: list(m.get("files", {}).values()),
    "splash/manifest.json": lambda m: [c["art"] for c in m.get("cards", [])],
    "maxwin/manifest.json": lambda m: list(m.get("files", {}).values()),
    "winrungs/signs/flat_manifest.json": lambda m: [os.path.basename(v["file"]) for v in m.values()],
    "ui_scene/frame.meta.json": lambda m: ["board_frame.webp"],
    "features/rescue/rooms.meta.json": lambda m: [f for r in m.get("rooms", []) for f in r.get("files", {}).values()] + list(m.get("facade", {}).get("files", {}).values()),
    "features/rescue/props.meta.json": lambda m: [v["file"] for v in m.get("props", {}).values()],
}
BASE_SYMS = {f"sym_{s}.webp" for s in SYM if s != "W_blaze"} | {f"symT_{s}.webp" for s in SYM if s != "W_blaze"}
BUDGETS = {"ambient": 1.5 * 1048576, "splash": 1.2 * 1048576}
IMG = (".webp", ".png", ".jpg")


def rule_for(relp):
    for pat, size, mode, flags in RULES:
        if fnmatch.fnmatch(relp, pat) and (pat.count("/") == relp.count("/")):
            return size, mode, flags
    return None


def donor_hashes():
    """sha256 -> donor path for every image / json in the LUCKY runtime tree (audio excluded): catches renamed copies."""
    hs = {}
    if os.path.isdir(DONOR_STATIC):
        for dp, dns, fs in os.walk(DONOR_STATIC):
            dns[:] = [d for d in dns if d != "audio"]
            for f in fs:
                if f.lower().endswith(IMG + (".json",)):
                    hs.setdefault(sha256_file(os.path.join(dp, f)), os.path.relpath(os.path.join(dp, f), DONOR_STATIC))
    return hs


def reference_hashes():
    hs = set()
    for dp, _, fs in os.walk(REFS):
        for f in fs:
            if f.lower().endswith(IMG):
                hs.add(sha256_file(os.path.join(dp, f)))
    return hs


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--families", default=",".join(RUNTIME_FAMILIES))
    ap.add_argument("--root", default=STATIC)
    ap.add_argument("--require", action="store_true", help="a missing expected file is a FAIL, not PENDING")
    ap.add_argument("--report", default=os.path.join(QA, "verify_art.txt"))
    a = ap.parse_args()
    root = os.path.abspath(a.root)
    fams = [f for f in a.families.split(",") if f]
    lines, fails, pend, warns = [], 0, 0, 0
    refs = reference_hashes()
    donor = donor_hashes()
    results = []

    def emit(status, msg):
        nonlocal fails, pend, warns
        fails += status == "FAIL"
        pend += status == "PENDING"
        warns += status == "WARN"
        lines.append(f"[{status}] {msg}")
        results.append({"status": status, "msg": msg})

    for fam in fams:
        base = os.path.join(root, fam)
        files = []
        for dp, _, fs in os.walk(base):
            files += [os.path.relpath(os.path.join(dp, f), root) for f in fs if not f.startswith(".")]
        for relp in sorted(files):
            p = os.path.join(root, relp)
            if relp.endswith(".tmp") or ".tmp" in os.path.basename(relp):
                emit("FAIL", f"{relp}: leftover temp file")
                continue
            h = sha256_file(p)
            if h in donor:
                emit("FAIL", f"{relp}: byte-identical to LUCKY donor {donor[h]} - donor asset would ship")
                continue
            if h in refs:
                emit("FAIL", f"{relp}: identical to an art-src/reference image - reference art would ship")
                continue
            if not relp.lower().endswith(IMG):
                continue
            rule = rule_for(relp)
            im = Image.open(p)
            if rule is None:
                emit("WARN", f"{relp}: {im.size[0]}x{im.size[1]} {im.mode} - no expectation rule (new file?)")
                continue
            size, mode, flags = rule
            problems = []
            if size and tuple(im.size) != tuple(size):
                problems.append(f"size {im.size} != {tuple(size)}")
            rep = alpha_report(im)
            if mode == "RGBA" or (mode == "ANY" and rep.get("has_alpha") and rep.get("alpha_min", 255) < 255):
                if not rep.get("has_alpha"):
                    problems.append(f"mode {im.mode}, needs genuine alpha")
                elif rep["alpha_min"] != 0 or rep["painted_checker"]:
                    problems.append(f"no genuine transparency (alpha min {rep['alpha_min']}, checker {rep['painted_checker']})")
                elif rep["alpha_max"] < 255 and "additive" not in flags:
                    problems.append(f"alpha never reaches 255 (max {rep['alpha_max']}): source alpha not normalised")
                elif "corners" in flags and not rep["corners_clear"]:
                    problems.append(f"corners not transparent {rep['corners']}")
            elif mode in ("RGB", "ANY"):
                if rep.get("has_alpha") and rep.get("alpha_min", 255) < 255:
                    problems.append("expected fully opaque RGB, found transparency")
            if "box_sq" in flags and os.path.basename(relp) in BASE_SYMS:
                fw, fh = fill_ratio(im.convert("RGBA"))
                if abs(max(fw, fh) - 0.88) > 0.012:
                    problems.append(f"ink box {max(fw, fh):.3f} != 0.88")
            if "box_tall" in flags and os.path.basename(relp) in BASE_SYMS:
                fw, fh = fill_ratio(im.convert("RGBA"))
                if not (abs(fw - 0.86) <= 0.012 or abs(fh - 0.92) <= 0.012) or fw > 0.872 or fh > 0.932:
                    problems.append(f"ink box {fw:.3f} x {fh:.3f} misses the 86 x 92 box")
            emit("FAIL" if problems else "ok", f"{relp} {im.size[0]}x{im.size[1]} {im.mode}" + (f" -> {problems}" if problems else ""))
        # manifests of this family
        for mp, lister in MANIFESTS.items():
            if not mp.startswith(fam + "/"):
                continue
            full = os.path.join(root, mp)
            if not os.path.isfile(full):
                continue
            try:
                named = set(lister(json.load(open(full))))
            except Exception as e:
                emit("FAIL", f"{mp}: unreadable ({e})")
                continue
            d = os.path.dirname(full)
            missing = sorted(n for n in named if not os.path.isfile(os.path.join(d, n)))
            present = {f for f in os.listdir(d) if f.lower().endswith(IMG)}
            orphans = sorted(present - named) if not mp.endswith(("frame.meta.json", "rooms.meta.json", "props.meta.json")) else []
            if mp == "splash/manifest.json":  # shutter tiles are named in its "shutter" block
                sm = json.load(open(full)).get("shutter", {})
                orphans = [o for o in orphans if o not in sm.values()]
            if mp.startswith("winrungs/") or mp.startswith("environment/"):
                orphans = []  # dirs shared by several manifests / expectation rules
            status = "FAIL" if missing else ("WARN" if orphans else "ok")
            emit(status, f"{mp}: names {len(named)} files; missing {missing}; orphans {orphans}")
        if fam == "winrungs":  # every piece json / the coins sheet json must describe its sheet exactly
            for jd, key in (("winrungs/pieces", "sheet"), ("winrungs/coins", None)):
                d = os.path.join(root, jd)
                for jf in sorted(os.listdir(d)) if os.path.isdir(d) else []:
                    if not jf.endswith(".json"):
                        continue
                    m = json.load(open(os.path.join(d, jf)))
                    sheet = m.get(key) if key else m.get("meta", {}).get("image")
                    wh = (m.get("w"), m.get("h")) if key else tuple(m.get("meta", {}).get("size", {}).values())
                    sp = os.path.join(d, sheet or "")
                    got = Image.open(sp).size if sheet and os.path.isfile(sp) else None
                    ok = got is not None and tuple(got) == tuple(wh)
                    emit("ok" if ok else "FAIL", f"{jd}/{jf}: sheet {sheet} {got} vs json {wh}")
        for relp in EXPECTED:
            if relp.startswith(fam + "/") and not os.path.isfile(os.path.join(root, relp)):
                emit("FAIL" if a.require else "PENDING", f"{relp}: expected, not produced yet")
        if fam in BUDGETS and os.path.isdir(base):
            tot = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(base) for f in fs
                      if fam != "splash" or f.endswith(".webp"))
            emit("FAIL" if tot > BUDGETS[fam] else "ok", f"{fam}/ payload {tot / 1048576:.2f} MB (budget {BUDGETS[fam] / 1048576:.1f} MB)")
    summary = f"FAIL {fails} · PENDING {pend} · WARN {warns} · ok {sum(r['status'] == 'ok' for r in results)}"
    txt = "\n".join(lines) + f"\n\n{summary}\n(agent checks only - not human sign-off)\n"
    os.makedirs(os.path.dirname(os.path.abspath(a.report)), exist_ok=True)
    open(a.report, "w").write(txt)
    json.dump({"root": rel(root), "families": fams, "summary": summary, "results": results},
              open(re.sub(r"\.txt$", "", a.report) + ".json", "w"), indent=1)
    print(txt if len(txt) < 6000 else txt[-6000:])
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
