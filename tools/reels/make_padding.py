#!/usr/bin/env python3
"""Derive apps/piggy_firefighters/src/game/config.ts `paddingReels` from the frozen math reel CSVs.

    python3 tools/reels/make_padding.py          # rewrite the block in config.ts
    python3 tools/reels/make_padding.py --check  # exit 1 when config.ts differs from the CSVs

Source (read-only, math lane): math/games/piggy_firefighters/reels/{BR0,BRA,BRB,FR0,FRI}.csv, one row per stop,
one column per reel. Legend (game/reels/spinReels.svelte.ts LEGEND): 1-4 = H1-H4, a-d = L1-L4, W, s = ALARM,
g = GALARM. Padding is decoration only: the board that stops is always the book's.
"""
import csv
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REELS = ROOT / 'math/games/piggy_firefighters/reels'
CONFIG = ROOT / 'apps/piggy_firefighters/src/game/config.ts'
SETS = [('basegame', 'BR0'), ('antegame', 'BRA'), ('freegame', 'FR0'), ('backdraftgame', 'BRB'), ('infernogame', 'FRI')]
CODE = {'H1': '1', 'H2': '2', 'H3': '3', 'H4': '4', 'L1': 'a', 'L2': 'b', 'L3': 'c', 'L4': 'd', 'W': 'W',
        'ALARM': 's', 'GALARM': 'g'}


def strips(name):
    with open(REELS / f'{name}.csv', newline='') as fh:
        rows = [row for row in csv.reader(fh) if row]
    reels = len(rows[0])
    return [''.join(CODE[row[r].strip()] for row in rows) for r in range(reels)]


def block():
    out = ['\tpaddingReels: {']
    for key, name in SETS:
        out.append(f'\t\t// {key} <- math/games/piggy_firefighters/reels/{name}.csv (tools/reels/make_padding.py)')
        out.append(f'\t\t{key}: [')
        out.extend(f"\t\t\t'{s}'," for s in strips(name))
        out.append('\t\t],')
    out.append('\t},')
    return '\n'.join(out)


def main():
    src = CONFIG.read_text()
    pat = re.compile(r'\tpaddingReels: \{\n.*?\n\t\},', re.S)
    if not pat.search(src):
        sys.exit('paddingReels block not found in config.ts')
    new = pat.sub(lambda _m: block(), src, count=1)
    if '--check' in sys.argv:
        if new != src:
            print('FAIL: config.ts paddingReels differ from math/games/piggy_firefighters/reels/*.csv')
            sys.exit(1)
        print('OK: paddingReels match the reel CSVs')
        return
    CONFIG.write_text(new)
    print('paddingReels rewritten from', ', '.join(n for _k, n in SETS))


if __name__ == '__main__':
    main()
