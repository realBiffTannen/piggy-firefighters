#!/usr/bin/env python3
"""Meshy Image-to-3D driver for the rung tumbling pieces (lane E: Claude commissions GLBs, Codex renders them in Blender).

Never prints or writes the API key (MESHY_API_KEY from the environment only). Every paid call and every task read is a row
in art-src/meshy/source-record.json (the lane's paid-generation ledger; CLAUDE.md rule).

  refs                 split art-src/generated/winrungs/rung_pieces.png into one reference PNG per piece (art-src/meshy/ref/)
  create <piece> [..]  POST one image-to-3D task per piece (paid; refuses a piece that already has a task or a GLB)
  poll [<piece> ..]    read task status; on SUCCEEDED download the GLB + thumbnail and write <piece>.json
  balance              print the credit balance
"""
import base64
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from art_common import REPO, components, load_rgba, sort_grid  # noqa: E402

MDIR = os.path.join(REPO, "art-src", "meshy")
REF = os.path.join(MDIR, "ref")
LEDGER = os.path.join(MDIR, "source-record.json")
BASE = "https://api.meshy.ai/openapi/v1"
MODEL = "meshy-5"
# the 2D sheet's grid order (tools/art/derive_winrungs.py ITEMS); the FX pieces (droplet, ember, spark) stay 2D
ITEMS = ["coin", "silver_coin", "helmet", "droplet", "nozzle", "badge", "boot", "hydrant_cap", "ember", "spark"]
SOLID = ["coin", "silver_coin", "helmet", "nozzle", "badge", "boot", "hydrant_cap"]
PARAMS = {"ai_model": MODEL, "should_texture": True, "enable_pbr": False, "should_remesh": True, "topology": "triangle",
          "target_polycount": 20000, "symmetry_mode": "auto"}


def _ctx():
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()


def _key():
    k = os.environ.get("MESHY_API_KEY")
    if not k:
        sys.exit("MESHY_API_KEY not set")
    return k


def _req(path, body=None, method=None, timeout=120):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method or ("POST" if data else "GET"))
    req.add_header("Authorization", f"Bearer {_key()}")
    if data:
        req.add_header("Content-Type", "application/json")
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=timeout, context=_ctx()) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")[:400]
            if e.code in (429, 500, 502, 503, 504) and attempt < 3:
                time.sleep(2 ** (attempt + 1))
                continue
            raise SystemExit(f"meshy {method or 'GET'} {path}: HTTP {e.code} {msg}")
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt < 3:
                time.sleep(2 ** (attempt + 1))
                continue
            raise SystemExit(f"meshy {path}: {e}")


def _ledger(row):
    rows = json.load(open(LEDGER)) if os.path.exists(LEDGER) else []
    row = {"at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), **row}
    rows.append(row)
    tmp = LEDGER + ".tmp"
    with open(tmp, "w") as f:
        json.dump(rows, f, indent=1)
    os.replace(tmp, LEDGER)


def balance():
    b = _req("/balance").get("balance")
    print(f"balance {b}")
    return b


def refs():
    from PIL import Image
    os.makedirs(REF, exist_ok=True)
    comps = sort_grid(components(load_rgba("winrungs/rung_pieces"), 3000), 2)
    if len(comps) != len(ITEMS):
        raise SystemExit(f"rung_pieces: expected {len(ITEMS)} items, found {len(comps)}")
    for name, c in zip(ITEMS, comps):
        im = Image.fromarray(c["arr"], "RGBA")  # art_common.components: {box, arr (isolated RGBA crop), area}
        side = int(max(im.size) * 1.12)
        canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        canvas.alpha_composite(im, ((side - im.width) // 2, (side - im.height) // 2))
        canvas = canvas.resize((1024, 1024), Image.LANCZOS)
        out = os.path.join(REF, f"{name}.png")
        canvas.save(out + ".tmp", "PNG")
        os.replace(out + ".tmp", out)
        print(f"ref {name} {im.size} -> {os.path.relpath(out, REPO)}")


def create(names):
    os.makedirs(MDIR, exist_ok=True)
    for name in names:
        if name not in SOLID:
            raise SystemExit(f"{name}: not a solid piece (3D set: {SOLID})")
        task_file = os.path.join(MDIR, f"{name}.task")
        if os.path.exists(task_file) or os.path.exists(os.path.join(MDIR, f"{name}.glb")):
            print(f"{name}: task or GLB exists; not re-issued (no speculative rerolls)")
            continue
        ref = os.path.join(REF, f"{name}.png")
        with open(ref, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        before = _req("/balance").get("balance")
        body = {"image_url": f"data:image/png;base64,{b64}", **PARAMS}
        try:
            res = _req("/image-to-3d", body)
        except SystemExit as e:
            _ledger({"kind": "image-to-3d", "name": name, "ref": os.path.relpath(ref, REPO), "params": PARAMS,
                     "status": "error", "error": str(e), "balance_before": before})
            raise
        tid = res.get("result") or res.get("id")
        with open(task_file, "w") as f:
            f.write(tid)
        after = _req("/balance").get("balance")
        _ledger({"kind": "image-to-3d", "name": name, "ref": os.path.relpath(ref, REPO), "params": PARAMS, "task": tid,
                 "status": "created", "balance_before": before, "balance_after": after,
                 "cost_estimate_credits": (before - after) if (before is not None and after is not None) else None})
        print(f"created {name} task={tid[:8]}... balance {before} -> {after}")


def poll(names, wait=False):
    pending = [n for n in names if os.path.exists(os.path.join(MDIR, f"{n}.task"))
               and not os.path.exists(os.path.join(MDIR, f"{n}.glb"))]
    while pending:
        for name in list(pending):
            tid = open(os.path.join(MDIR, f"{name}.task")).read().strip()
            res = _req(f"/image-to-3d/{tid}")
            st = res.get("status")
            print(f"{name}: {st} progress={res.get('progress')}")
            if st == "SUCCEEDED":
                out = os.path.join(MDIR, f"{name}.glb")
                with urllib.request.urlopen(res["model_urls"]["glb"], timeout=600, context=_ctx()) as r, open(out + ".tmp", "wb") as f:
                    f.write(r.read())
                os.replace(out + ".tmp", out)
                thumb = res.get("thumbnail_url")
                if thumb:
                    tp = os.path.join(MDIR, f"{name}_meshy_thumb.png")
                    with urllib.request.urlopen(thumb, timeout=300, context=_ctx()) as r, open(tp + ".tmp", "wb") as f:
                        f.write(r.read())
                    os.replace(tp + ".tmp", tp)
                meta = {k: res.get(k) for k in ("id", "status", "ai_model", "consumed_credits", "created_at", "finished_at")}
                meta.update({"glb": os.path.relpath(out, REPO), "bytes": os.path.getsize(out),
                             "ref": os.path.relpath(os.path.join(REF, f"{name}.png"), REPO), "params": PARAMS})
                with open(os.path.join(MDIR, f"{name}.json"), "w") as f:
                    json.dump(meta, f, indent=1)
                _ledger({"kind": "image-to-3d", "name": name, "task": tid, "status": "succeeded",
                         "consumed_credits": res.get("consumed_credits"), "glb": meta["glb"], "bytes": meta["bytes"]})
                print(f"  -> {meta['glb']} {meta['bytes']} B credits={res.get('consumed_credits')}")
                pending.remove(name)
            elif st in ("FAILED", "CANCELED", "EXPIRED"):
                _ledger({"kind": "image-to-3d", "name": name, "task": tid, "status": st.lower(),
                         "error": res.get("task_error")})
                print("  task error:", json.dumps(res.get("task_error", {})))
                os.replace(os.path.join(MDIR, f"{name}.task"), os.path.join(MDIR, f"{name}.task.{st.lower()}"))
                pending.remove(name)
        if pending and wait:
            time.sleep(45)
        elif pending:
            break


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "help"
    args = sys.argv[2:]
    if cmd == "refs":
        refs()
    elif cmd == "create":
        create(args or SOLID)
    elif cmd == "poll":
        wait = "--wait" in args
        poll([a for a in args if a != "--wait"] or SOLID, wait)
    elif cmd == "balance":
        balance()
    else:
        print(__doc__)
