#!/usr/bin/env python3
"""Self-test of every tools/art tool on SYNTHETIC inputs: no API key used, no paid call, nothing written into the
repo (everything goes to a temp dir; --keep keeps it). gen_art.py is exercised against a local mock of the images
API (tests/mock_api.py) through its test hooks PF_ART_GEN_DIR / PF_ART_API_BASE with a dummy key.

  python3 tools/art/tests/selftest.py [--keep]
"""
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.dirname(HERE)
REPO = os.path.abspath(os.path.join(ART, "..", ".."))
sys.path.insert(0, HERE)
import synthetic  # noqa: E402

results = []


def run(name, args, env=None, expect=0, contains=()):
    e = dict(os.environ)
    e.pop("OPENAI_API_KEY", None)  # the real key never reaches a test
    e.update(env or {})
    p = subprocess.run([sys.executable] + args, cwd=REPO, env=e, capture_output=True, text=True)
    out = p.stdout + p.stderr
    ok = p.returncode == expect and all(c in out for c in contains)
    results.append((ok, name))
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"  (exit {p.returncode})\n{out[-1500:]}"))
    return out


def check(name, cond, detail=""):
    results.append((bool(cond), name))
    print(("PASS " if cond else "FAIL ") + name + (f"  {detail}" if detail and not cond else ""))


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def main():
    keep = "--keep" in sys.argv
    root = tempfile.mkdtemp(prefix="pf-art-selftest-")
    print("temp:", root)
    n = synthetic.build(root)
    check("synthetic sources written", n >= 40, str(n))
    assets, qa = os.path.join(root, "assets"), os.path.join(root, "qa")
    os.makedirs(os.path.join(assets, "splash"), exist_ok=True)
    real_splash = os.path.join(REPO, "apps", "piggy_firefighters", "static", "assets", "splash", "manifest.json")
    if os.path.isfile(real_splash):
        shutil.copy(real_splash, os.path.join(assets, "splash", "manifest.json"))
    t = lambda f: os.path.join(ART, f)  # noqa: E731
    run("derive_symbols (square, BONUS tags, strict 88 % box)",
        [t("derive_symbols.py"), "--map", f"{root}/symbols.map.json", "--out", assets, "--bonus-tag", "--strict",
         "--contact", f"{qa}/symbols.png"], contains=("wrote 16 square tiles",))
    run("derive_symbols_tall (tall + square fallback)",
        [t("derive_symbols_tall.py"), "--map", f"{root}/symbols_tall.map.json", "--from-square", "--square-map",
         f"{root}/symbols.map.json", "--bonus-tag", "--out", assets, "--contact", f"{qa}/tall.png"], contains=("wrote 16 tall tiles",))
    run("make_symbol_labels (specimen + --bonus)", [t("make_symbol_labels.py"), "--specimen", f"{qa}/spec.png", "--bonus",
                                                    "ALARM,GALARM", "--map", f"{root}/symbols.map.json", "--out", assets])
    G = f"{root}/gen/scene"
    scene_map = {f"plate_{m}_{o}": f"{G}/plate_{m}_{o}.png" for m in ("base", "rescue", "inferno") for o in ("16_9", "portrait")}
    scene_map.update(board_frame=f"{G}/board_frame.png", cell_backplate=f"{G}/cell_backplate.png", shutter=f"{G}/shutter.png")
    json.dump(scene_map, open(f"{root}/scene.map.json", "w"))
    run("derive_scene (env, ambient, frame warp, backplate, shutter; backdraft = relight)",
        [t("derive_scene.py"), "--map", f"{root}/scene.map.json", "--relight", "backdraft=base:backdraft", "--out", assets, "--strict"])
    meta = json.load(open(f"{assets}/environment/board_frame.meta.json"))
    check("board frame opening lands on OPEN", abs(meta["x0"] - 212 / 1497) < 0.002 and abs(meta["y1"] - 761 / 946) < 0.002, str(meta))
    sys.path.insert(0, ART)
    import derive_cards

    spec = json.loads(json.dumps(derive_cards.SPEC))
    C = f"{root}/gen/cards/"
    for sec in ("buycards", "splash"):
        for v in spec[sec].values():
            v[0] = C + v[0].split("/")[1] + ".png"
    for v in spec["maxwin"].values():
        v["src"] = C + v["src"].split("/")[1] + ".png"
    json.dump(spec, open(f"{root}/cards.spec.json", "w"))
    run("derive_cards (buycards, splash, maxwin)", [t("derive_cards.py"), "--spec", f"{root}/cards.spec.json", "--out", assets,
                                                    "--contact", f"{qa}/cards.png", "--strict"])
    json.dump({"rung_plaques": f"{root}/gen/winrungs/rung_plaques.png", "rung_pieces": f"{root}/gen/winrungs/rung_pieces.png"},
              open(f"{root}/winrungs.map.json", "w"))
    run("derive_winrungs (titles, signs, pieces, coins, fx)", [t("derive_winrungs.py"), "--map", f"{root}/winrungs.map.json",
                                                               "--out", assets, "--titles-dir", f"{root}/titles",
                                                               "--contact", f"{qa}/pieces.png", "--strict"])
    run("make_wordmark", [t("make_wordmark.py"), "--out", assets, "--master-dir", f"{root}/branding"])
    run("make_thumbnails (PF-THUMB-01 layout + checks)", [t("make_thumbnails.py"), "--hero", f"{root}/gen/thumb/chief_hero.png",
                                                          "--bg", "#1E2A4A", "--wordmark", f"{assets}/branding/wordmark.png",
                                                          "--out", f"{root}/thumbnail"], contains=("14/14 checks pass",))
    run("verify_art on every derived family (0 FAIL, 0 PENDING)", [t("verify_art.py"), "--root", assets, "--require",
                                                                   "--report", f"{qa}/verify.txt"], contains=("FAIL 0 · PENDING 0",))
    # ------------------------------------------------------------------ gen_art against the mock API
    gd, q, log = f"{root}/gen_api", f"{root}/q.txt", f"{root}/mock.log"
    os.makedirs(gd)
    port = free_port()
    open(q, "w").close()
    mock = subprocess.Popen([sys.executable, os.path.join(HERE, "mock_api.py"), str(port), q, log])
    time.sleep(0.8)
    env = {"PF_ART_GEN_DIR": gd, "PF_ART_API_BASE": f"http://127.0.0.1:{port}/v1", "OPENAI_API_KEY": "selftest-dummy"}
    try:
        ref = "art-src/reference/cartoon/paint.png"
        run("gen_art --dry-run needs no key", [t("gen_art.py"), "b0", "h1", "--ref", ref, "--prompt", "x. no text", "--dry-run"],
            env={"PF_ART_GEN_DIR": gd}, contains=('"endpoint": "images/edits"',))
        open(q, "w").write("500\n200\n")
        run("gen_art retries a 500 then succeeds (edits)", [t("gen_art.py"), "b0", "h1", "--transparent", "--ref", ref,
                                                            "--prompt", "x. no text", "--backoff", "0.05"], env=env, contains=("attempt 2",))
        run("gen_art refuses to overwrite", [t("gen_art.py"), "b0", "h1", "--prompt", "x. no text"], env=env, expect=2,
            contains=("already exists",))
        open(q, "w").write("200\n")
        run("gen_art --force keeps the paid original", [t("gen_art.py"), "b0", "h1", "--force", "--prompt", "x. no text",
                                                        "--backoff", "0.05"], env=env)
        check("superseded copy kept", len(os.listdir(f"{gd}/b0/superseded")) == 1)
        open(q, "w").write("400\n200\n")
        run("gen_art fails fast on 400", [t("gen_art.py"), "b0", "bad", "--prompt", "x. no text", "--backoff", "0.05"], env=env,
            expect=1, contains=("not retried",))
        open(q, "w").write("503\n503\n503\n503\n")
        run("gen_art gives up after 4 attempts", [t("gen_art.py"), "b0", "flaky", "--prompt", "x. no text", "--backoff", "0.02"],
            env=env, expect=1, contains=("after 4 attempts",))
        open(q, "w").write("200\n")
        run("gen_art generations endpoint + preamble", [t("gen_art.py"), "b0", "plate", "--size", "1536x1024", "--preamble",
                                                        "art-src/generated/prompts/_style_painting.txt", "--prompt", "Station 13.",
                                                        "--backoff", "0.05"], env=env)
        run("gen_art refuses refs outside art-src", [t("gen_art.py"), "b0", "ext", "--ref", "/etc/hostname", "--prompt", "x"],
            env=env, expect=2, contains=("must live under art-src",))
        open(q, "w").write("\n".join(["200"] * 6))
        procs = [subprocess.Popen([sys.executable, t("gen_art.py"), "b1", f"p{i}", "--prompt", "p. no text", "--backoff", "0.05"],
                                  cwd=REPO, env={**os.environ, **env}, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                 for i in range(6)]
        for p in procs:
            p.wait()
        rows = json.load(open(f"{gd}/source-record.json"))
        raw = open(f"{gd}/source-record.json").read()
        check("record: one row per attempt, parallel appends intact", len(rows) == 15, f"{len(rows)} rows")
        check("record: statuses, costs and usage", {r["status"] for r in rows} == {"OK", "HTTP 500", "HTTP 400", "HTTP 503"}
              and all("cost_estimate_usd" in r for r in rows) and all(r.get("usage") for r in rows if r["status"] == "OK"))
        check("record: no key and scrubbed error bodies", "selftest-dummy" not in raw and "sk-shouldbescrubbed" not in raw)
        calls = [json.loads(line) for line in open(log)]
        check("mock saw multipart edits with image[] and JSON generations",
              any(c["path"].endswith("/images/edits") and "image[]" in c["fields"] and "background" in c["fields"] for c in calls)
              and any(c["path"].endswith("/images/generations") and c["ct"] == "application/json" for c in calls))
    finally:
        mock.terminate()
    ok = sum(r[0] for r in results)
    print(f"\nselftest: {ok}/{len(results)} PASS")
    if keep:
        print("kept:", root)
    else:
        shutil.rmtree(root, ignore_errors=True)
    sys.exit(0 if ok == len(results) else 1)


if __name__ == "__main__":
    main()
