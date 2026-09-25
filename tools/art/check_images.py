#!/usr/bin/env python3
"""Validate that every PNG/WEBP under the given paths is a complete, decodable image with nonzero dimensions.

Why: the coordinator snapshots lane outputs while art jobs are still writing; a partially written file (e.g. a
0-byte PNG) must never reach a commit (Codex found pf_chief/pieces/hand_l_open.png at 0 bytes in e39595e). Run before
`git add`; with --list-bad it prints one bad path per line so the commit flow can exclude them; exit 1 if any.
"""
import argparse, os, sys
from PIL import Image

EXT = ('.png', '.webp')

def check(path):
    try:
        if os.path.getsize(path) == 0:
            return 'zero bytes'
        with Image.open(path) as im:
            im.verify()
        with Image.open(path) as im:
            if 0 in im.size:
                return 'zero dimension'
            im.load()
        return None
    except Exception as e:  # noqa: BLE001
        return str(e)[:80]

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('paths', nargs='+'); ap.add_argument('--list-bad', action='store_true')
    ns = ap.parse_args(); bad = []
    for p in ns.paths:
        files = [p] if os.path.isfile(p) else [os.path.join(d, f) for d, _, fs in os.walk(p) for f in fs if f.lower().endswith(EXT)]
        for f in sorted(files):
            err = check(f)
            if err:
                bad.append((f, err))
    if ns.list_bad:
        for f, _ in bad: print(f)
    else:
        for f, e in bad: print(f'BAD {f}: {e}')
        print(f'checked ok; {len(bad)} bad file(s)')
    sys.exit(1 if bad else 0)

if __name__ == '__main__':
    main()
