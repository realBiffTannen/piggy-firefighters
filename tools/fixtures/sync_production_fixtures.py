#!/usr/bin/env python3
"""Sync the mock RGS fixtures (server/fixtures/) from the math lane's real-book fixtures (contract v1.3, 2026-09-28).

    python3 tools/fixtures/sync_production_fixtures.py [--production <tree with report.json>]

Copies math/games/piggy_firefighters/fixtures/*.json byte for byte, removes fixture books that the math index no
longer names, rewrites index.json's `fixtures` entries (name/mode/cost/file from the math index; id/criteria/
payoutMultiplier/events from each book) and `source.production_report_sha256`, and refreshes the note. The
`cap`, `modes` and `costs` fields are kept as written (the frontend lane maintains them; a mismatch with the math
index fails loudly).
"""
import argparse, hashlib, json, shutil
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
MATH_FIX = REPO / 'math/games/piggy_firefighters/fixtures'
OUT = REPO / 'server/fixtures'


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--production', type=Path, default=REPO / 'math/games/piggy_firefighters/library/production-100k')
    a = ap.parse_args()
    math_index = json.load(open(MATH_FIX / 'index.json'))
    index = json.load(open(OUT / 'index.json'))
    costs = index['costs']
    entries = []
    wanted = set()
    for e in math_index['fixtures']:
        if e['mode'] not in costs or float(costs[e['mode']]) != float(e['cost']):
            raise SystemExit(f"{e['name']}: mode {e['mode']} cost {e['cost']} differs from server index costs {costs.get(e['mode'])}")
        src = MATH_FIX / e['file']
        book = json.load(open(src))
        shutil.copyfile(src, OUT / e['file'])
        wanted.add(e['file'])
        entries.append({'name': e['name'], 'mode': e['mode'], 'cost': e['cost'], 'file': e['file'], 'id': book['id'],
                        'criteria': book['criteria'], 'payoutMultiplier': book['payoutMultiplier'],
                        'events': [ev['type'] for ev in book['events']]})
        cap = int(index['cap']) * 100
        if book['payoutMultiplier'] > cap:
            raise SystemExit(f"{e['name']}: payout {book['payoutMultiplier']} above the cap {cap}")
    for stale in OUT.glob('*.json'):
        if stale.name not in wanted and stale.name not in ('index.json', 'source-record.json'):
            stale.unlink()
            print('removed stale fixture', stale.name)
    shutil.copyfile(MATH_FIX / 'source-record.json', OUT / 'source-record.json')
    index['fixtures'] = entries
    index['modes'] = list(dict.fromkeys(index['modes']))
    report = a.production / 'report.json'
    index['source']['production_report_sha256'] = sha256(report) if report.is_file() else None
    index['note'] = ('PIGGY FIREFIGHTERS production fixtures: verbatim copies of math/games/piggy_firefighters/fixtures/*.json '
                     '(real model books whose ids are production publication ids of math/publish, tag math-freeze-v2, contract v1.3, '
                     'synced 2026-09-28 by tools/fixtures/sync_production_fixtures.py). Entry fields name/mode/cost/file follow the '
                     'math index; id/criteria/payoutMultiplier/events are read from each book. Seven modes incl. super_ante, 20,000x cap.')
    (OUT / 'index.json').write_text(json.dumps(index, indent=1) + '\n')
    print(f'synced {len(entries)} fixtures; index sha256 {sha256(OUT / "index.json")}')


if __name__ == '__main__':
    main()
