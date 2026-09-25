#!/usr/bin/env python3
"""PIGGY FIREFIGHTERS paid image generation (OpenAI gpt-image) - the ONLY tool in this repo that spends money.

One call = one raw PNG at art-src/generated/<batch>/<name>.png (never modified afterwards; derive_*.py read it)
plus one provenance row PER HTTP ATTEMPT (successes AND failures: a refused call may still bill) appended to
art-src/generated/source-record.json under an exclusive file lock with an atomic replace.

Merged from the family's three donor copies (LUCKY gen_art_a: record + cost + status + usage + flock + atomic write;
gen_art_b: never overwrite an output; piggy-police gen_batch: 4 attempts with 8*n s back-off, fail fast on
400/401/403, /v1/images/generations when there is no reference image).

  with references -> POST https://api.openai.com/v1/images/edits        multipart, each ref as image[]
  no references   -> POST https://api.openai.com/v1/images/generations  JSON
  fields: model (default gpt-image-2.5-sunburst), prompt, size, n=1, quality (default high),
          background=transparent with --transparent

The key is read from the environment variable OPENAI_API_KEY only. It is never printed, logged or written; error
bodies are the API's JSON and are scrubbed of anything key-shaped before they are stored.

Usage:
  python3 tools/art/gen_art.py <batch> <name> --size 1024x1024 [--transparent] \
      [--ref art-src/reference/cartoon/pig.png ...] \
      (--prompt "..." | --prompt-file art-src/generated/prompts/<batch>_<name>.txt) \
      [--preamble art-src/generated/prompts/_style_sprite.txt] [--note "..."] [--force] [--dry-run]

  --dry-run   validate everything and print the request plan; no network, no key needed, nothing recorded
  --force     redraw an existing name: the old PNG is moved to <batch>/superseded/ (paid art is never deleted)
Exit codes: 0 ok / dry run, 1 API or network failure (recorded), 2 usage error (nothing sent).
"""
import argparse
import base64
import fcntl
import hashlib
import json
import mimetypes
import os
import re
import ssl
import sys
import tempfile
import time
import urllib.error
import urllib.request

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
GEN_DIR = os.path.join(REPO, "art-src", "generated")
API_BASE = "https://api.openai.com/v1"
DEFAULT_MODEL = "gpt-image-2.5-sunburst"
SIZES = ("1024x1024", "1024x1536", "1536x1024", "1536x2048", "2048x1152")  # last two: PF-THUMB-01 native-size trial
# conservative list-price estimate per high-quality output incl. reference-image input tokens (USD)
COST_EST = {"1024x1024": 0.21, "1024x1536": 0.30, "1536x1024": 0.30, "1536x2048": 0.50, "2048x1152": 0.50}
ATTEMPTS = 4
FAIL_FAST = (400, 401, 403)
NAME_RE = re.compile(r"^[a-z0-9][a-z0-9_\-]{0,80}$")
KEYISH = re.compile(r"(sk-[A-Za-z0-9_\-]{8,}|Bearer\s+[A-Za-z0-9_\-\.]{8,})")


def rel(p):
    ap = os.path.abspath(p)
    return os.path.relpath(ap, REPO) if ap.startswith(REPO + os.sep) else ap


def scrub(text):
    return KEYISH.sub("[redacted]", text or "")


def multipart(fields, files):
    boundary = "----pfbnd" + base64.urlsafe_b64encode(os.urandom(9)).decode()
    body = bytearray()
    for k, v in fields:
        body += f"--{boundary}\r\n".encode()
        body += f'Content-Disposition: form-data; name="{k}"\r\n\r\n'.encode()
        body += f"{v}\r\n".encode()
    for k, path in files:
        ctype = mimetypes.guess_type(path)[0] or "image/png"
        with open(path, "rb") as f:
            data = f.read()
        body += f"--{boundary}\r\n".encode()
        body += (f'Content-Disposition: form-data; name="{k}"; filename="{os.path.basename(path)}"\r\n'
                 f"Content-Type: {ctype}\r\n\r\n").encode()
        body += data + b"\r\n"
    body += f"--{boundary}--\r\n".encode()
    return bytes(body), boundary


def ssl_ctx():
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()


def lock_path(record):
    # the lock lives outside the repo (nothing to ignore or commit), one lock per record file
    h = hashlib.sha1(os.path.abspath(record).encode()).hexdigest()[:12]
    return os.path.join(tempfile.gettempdir(), f"pf-source-record-{h}.lock")


def append_record(record, row):
    """Append one row under an exclusive flock, atomically (tmp + os.replace). A record that no longer parses is
    never overwritten: the row goes to a .rescue.jsonl sidecar and the call fails loudly."""
    os.makedirs(os.path.dirname(record), exist_ok=True)
    with open(lock_path(record), "w") as lk:
        fcntl.flock(lk, fcntl.LOCK_EX)
        try:
            rows = []
            if os.path.exists(record) and os.path.getsize(record) > 0:
                try:
                    with open(record) as f:
                        rows = json.load(f)
                    if not isinstance(rows, list):
                        raise ValueError("record root is not a list")
                except Exception as e:  # never lose paid-call history
                    with open(record + ".rescue.jsonl", "a") as f:
                        f.write(json.dumps(row) + "\n")
                    raise SystemExit(f"source-record unreadable ({e}); row saved to {rel(record)}.rescue.jsonl")
            rows.append(row)
            tmp = record + f".tmp{os.getpid()}"
            with open(tmp, "w") as f:
                json.dump(rows, f, indent=2)
                f.write("\n")
            os.replace(tmp, record)
        finally:
            fcntl.flock(lk, fcntl.LOCK_UN)


def build_request(api_base, key, model, size, quality, prompt, refs, transparent):
    if refs:
        fields = [("model", model), ("prompt", prompt), ("size", size), ("n", "1"), ("quality", quality)]
        if transparent:
            fields.append(("background", "transparent"))
        body, boundary = multipart(fields, [("image[]", r) for r in refs])
        req = urllib.request.Request(f"{api_base}/images/edits", data=body, method="POST")
        req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
        endpoint = "images/edits"
    else:
        payload = {"model": model, "prompt": prompt, "size": size, "n": 1, "quality": quality}
        if transparent:
            payload["background"] = "transparent"
        req = urllib.request.Request(f"{api_base}/images/generations", data=json.dumps(payload).encode(), method="POST")
        req.add_header("Content-Type", "application/json")
        endpoint = "images/generations"
    if key is not None:
        req.add_header("Authorization", f"Bearer {key}")
    return req, endpoint


def read_prompt(a):
    parts, files = [], []
    for p in a.preamble or []:
        pp = p if os.path.isabs(p) else os.path.join(REPO, p)
        if not os.path.isfile(pp):
            raise SystemExit(f"missing preamble {p}")
        parts.append(open(pp).read().strip())
        files.append(rel(pp))
    if a.prompt_file:
        pf = a.prompt_file if os.path.isabs(a.prompt_file) else os.path.join(REPO, a.prompt_file)
        if not os.path.isfile(pf):
            raise SystemExit(f"missing prompt file {a.prompt_file}")
        parts.append(open(pf).read().strip())
        files.append(rel(pf))
    if a.prompt:
        parts.append(a.prompt.strip())
    prompt = "\n\n".join(x for x in parts if x)
    if not prompt:
        raise SystemExit("empty prompt: give --prompt or --prompt-file")
    return prompt, files


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("batch", help="batch folder under art-src/generated (e.g. b1, symbols, scene)")
    ap.add_argument("name", help="output name (lowercase, [a-z0-9_-]); a redraw takes a NEW name (_r2) or --force")
    ap.add_argument("--size", default="1024x1024", choices=SIZES)
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--quality", default="high", choices=("high", "medium", "low", "auto"))
    ap.add_argument("--transparent", action="store_true", help="background=transparent (sprites)")
    ap.add_argument("--ref", nargs="+", default=[], help="reference PNG(s) -> images/edits (image[]); none -> generations")
    ap.add_argument("--prompt", default="")
    ap.add_argument("--prompt-file", default="")
    ap.add_argument("--preamble", action="append", help="style preamble file(s) prepended to the prompt")
    ap.add_argument("--note", default="", help="why this call exists (named defect for a redraw, batch purpose)")
    ap.add_argument("--force", action="store_true", help="redraw an existing name (old PNG kept under superseded/)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--timeout", type=int, default=900)
    # test hooks (a local mock server + a scratch record); never needed in production
    ap.add_argument("--gen-dir", default=os.environ.get("PF_ART_GEN_DIR", GEN_DIR), help=argparse.SUPPRESS)
    ap.add_argument("--api-base", default=os.environ.get("PF_ART_API_BASE", API_BASE), help=argparse.SUPPRESS)
    ap.add_argument("--backoff", type=float, default=8.0, help=argparse.SUPPRESS)
    a = ap.parse_args(argv)

    gen_dir = os.path.abspath(a.gen_dir)
    record = os.path.join(gen_dir, "source-record.json")
    if not NAME_RE.match(a.batch) or not NAME_RE.match(a.name):
        ap.error("batch and name must match [a-z0-9][a-z0-9_-]*")
    if not a.model.startswith(("gpt-image", "chatgpt-image")):
        ap.error(f"{a.model} is not an image model")
    try:
        prompt, prompt_files = read_prompt(a)
    except SystemExit as e:
        ap.error(str(e))
    refs = []
    for r in a.ref:
        rp = os.path.abspath(r if os.path.isabs(r) else os.path.join(REPO, r))
        if not os.path.isfile(rp):
            ap.error(f"missing reference {r}")
        # provenance rule: references come from this repo's art-src (style refs under art-src/reference, accepted
        # outputs under art-src/generated) - never straight from a donor checkout
        if not (rp.startswith(os.path.join(REPO, "art-src") + os.sep) or rp.startswith(gen_dir + os.sep)):
            ap.error(f"reference must live under art-src/ (copy style refs into art-src/reference/): {r}")
        if os.path.splitext(rp)[1].lower() not in (".png", ".jpg", ".jpeg", ".webp"):
            ap.error(f"reference must be png/jpg/webp: {r}")
        refs.append(rp)
    out = os.path.join(gen_dir, a.batch, f"{a.name}.png")
    if not re.search(r"\bno (text|letters|lettering|words)\b", prompt, re.I):
        print("warning: the prompt has no 'no text' clause (gpt-image cannot letter; letter locally)", file=sys.stderr)

    cost = COST_EST.get(a.size, 0.30)
    plan = {"endpoint": "images/edits" if refs else "images/generations", "model": a.model, "size": a.size,
            "quality": a.quality, "transparent": a.transparent, "refs": [rel(r) for r in refs],
            "output": rel(out), "record": rel(record), "cost_estimate_usd": cost, "prompt_chars": len(prompt),
            "prompt_files": prompt_files, "exists": os.path.exists(out)}
    if a.dry_run:
        print(json.dumps(plan, indent=2))
        print("--- prompt ---\n" + prompt)
        return 0
    if os.path.exists(out) and not a.force:
        print(f"{rel(out)} already exists - accepted outputs are reused; pick a new name (e.g. {a.name}_r2) "
              f"for a named-defect redraw, or --force", file=sys.stderr)
        return 2
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        print("OPENAI_API_KEY is not set in the environment", file=sys.stderr)
        return 2

    base_row = {"asset": a.name, "batch": a.batch, "lane": "ART", "endpoint": plan["endpoint"],
                "requested_model": a.model, "size": a.size, "quality": a.quality, "n": 1,
                "transparent": a.transparent, "prompt": prompt, "prompt_files": prompt_files,
                "reference_paths": [rel(r) for r in refs], "cost_estimate_usd": cost,
                "cost_basis": "conservative per-call estimate; failed attempts are recorded because they may bill",
                "note": a.note}
    t_all = time.time()
    last_err = None
    for attempt in range(1, ATTEMPTS + 1):
        req, endpoint = build_request(a.api_base, key, a.model, a.size, a.quality, prompt, refs, a.transparent)
        t0 = time.time()
        row = dict(base_row, attempt=attempt, ts=time.strftime("%Y-%m-%dT%H:%M:%S"))
        try:
            with urllib.request.urlopen(req, timeout=a.timeout, context=ssl_ctx()) as resp:
                payload = json.load(resp)
            b64 = payload["data"][0]["b64_json"]
            png = base64.b64decode(b64)
        except urllib.error.HTTPError as e:
            body = scrub(e.read().decode("utf-8", "replace"))[:800]
            last_err = f"HTTP {e.code}"
            row.update(status=f"HTTP {e.code}", error=body, seconds=round(time.time() - t0, 1))
            append_record(record, row)
            print(f"attempt {attempt}: HTTP {e.code} {body[:300]}", file=sys.stderr)
            if e.code in FAIL_FAST:
                print(f"FAIL {a.batch}/{a.name}: HTTP {e.code} (not retried)", file=sys.stderr)
                return 1
        except (urllib.error.URLError, TimeoutError, OSError, ValueError, KeyError, IndexError) as e:
            msg = scrub(f"{type(e).__name__}: {e}")[:400]
            last_err = msg
            row.update(status="error", error=msg, seconds=round(time.time() - t0, 1))
            append_record(record, row)
            print(f"attempt {attempt}: {msg}", file=sys.stderr)
        else:
            if not png.startswith(b"\x89PNG"):
                last_err = "response is not a PNG"
                row.update(status="error", error=last_err, seconds=round(time.time() - t0, 1))
                append_record(record, row)
                print(f"attempt {attempt}: {last_err}", file=sys.stderr)
            else:
                os.makedirs(os.path.dirname(out), exist_ok=True)
                superseded = None
                if os.path.exists(out):  # --force: keep the paid original
                    sd = os.path.join(gen_dir, a.batch, "superseded")
                    os.makedirs(sd, exist_ok=True)
                    superseded = os.path.join(sd, f"{a.name}.{time.strftime('%Y%m%dT%H%M%S')}.png")
                    os.replace(out, superseded)
                tmp = out + ".part"
                with open(tmp, "wb") as f:
                    f.write(png)
                os.replace(tmp, out)
                row.update(status="OK", output=rel(out), sha256=hashlib.sha256(png).hexdigest(),
                           actual_model=payload.get("model", a.model), usage=payload.get("usage"),
                           seconds=round(time.time() - t0, 1))
                if superseded:
                    row["superseded"] = rel(superseded)
                append_record(record, row)
                print(f"OK {a.batch}/{a.name} -> {rel(out)} ({row['seconds']}s, attempt {attempt}) "
                      f"model={row['actual_model']} size={a.size} est ${cost:.2f}")
                return 0
        if attempt < ATTEMPTS:
            time.sleep(a.backoff * attempt)
    print(f"FAIL {a.batch}/{a.name}: {last_err} after {ATTEMPTS} attempts ({time.time() - t_all:.0f}s)", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
