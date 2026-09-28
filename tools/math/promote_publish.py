#!/usr/bin/env python3
"""Promote an audited production tree to math/publish/ (contract v1.3, 2026-09-28).

    python3 tools/math/promote_publish.py --output <production tree> --audit qa/codex/math/v2-audit.json \
        --launch qa/codex/math/v2-launch.json --guard qa/codex/math/v2-production-memory.json

Copies index.json, every books_<mode>.jsonl.zst and lookUpTable_<mode>_0.csv byte for byte (sha256 compared on both
sides, LUT line counts checked against the report), removes stale files of retired modes, and writes MANIFEST.json in
the shape the M3 promotion used. Refuses a tree whose report or audit is not PASS.
"""
import argparse, hashlib, json, os, shutil, sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--output', required=True, type=Path)
    ap.add_argument('--audit', required=True, type=Path)
    ap.add_argument('--launch', required=True, type=Path)
    ap.add_argument('--guard', required=True, type=Path)
    ap.add_argument('--publish', type=Path, default=REPO / 'math/publish')
    a = ap.parse_args()
    out = a.output.resolve()
    report = json.load(open(out / 'report.json'))
    audit = json.load(open(a.audit))
    launch = json.load(open(a.launch))
    guard = json.load(open(a.guard))
    if report.get('candidate_status') != 'PASS' or not report.get('source_unchanged'):
        sys.exit('production report is not a PASS with unchanged sources')
    if audit.get('status') != 'PASS':
        sys.exit('independent audit is not PASS')
    index = json.load(open(out / 'index.json'))
    modes = [m['name'] for m in index['modes']]
    a.publish.mkdir(parents=True, exist_ok=True)
    keep = {'index.json', 'MANIFEST.json'} | {m[k] for m in index['modes'] for k in ('events', 'weights')}
    for stale in a.publish.iterdir():
        if stale.name not in keep:
            stale.unlink()
            print('removed stale', stale.name)
    files = {}
    for name in sorted(keep - {'MANIFEST.json'}):
        src, dst = out / name, a.publish / name
        shutil.copyfile(src, dst)
        digest = sha256(src)
        if sha256(dst) != digest:
            sys.exit(f'copy mismatch {name}')
        entry = {'bytes': dst.stat().st_size, 'sha256': digest}
        if name.startswith('lookUpTable_'):
            mode = name[len('lookUpTable_'):-len('_0.csv')]
            rows = sum(1 for _ in open(dst))
            if rows != report['modes'][mode]['publication_rows']:
                sys.exit(f'{name}: {rows} rows, report says {report["modes"][mode]["publication_rows"]}')
            entry['rows'] = rows
        files[name] = entry
        print('promoted', name, entry)
    figures = {m: {k: report['modes'][m][k] for k in ('cost', 'rtp', 'sd_over_cost', 'any_win', 'regular_hit', 'sub_hit',
               'rescue_probability', 'inferno_probability', 'backdraft_probability', 'cap_probability', 'prob5k', 'prob10k',
               'etl10k', 'etl40b', 'cvar', 'total_weight', 'minimum_weight', 'simulation_trials', 'publication_rows',
               'unique_events', 'duplicate_events', 'seconds')} for m in modes}
    manifest = {
        'game': 'piggy_firefighters',
        'contract': 'docs/GAME_CONTRACT.md v1.3 section 9, Piggy Firefighters, FROZEN at math-freeze-v2, measured 2026-09-28',
        'freeze': {'tag': launch['freeze_tag'], 'sha': launch['freeze_sha'], 'verified_source_files': audit['source']['verified_source_files']},
        'source_output': str(out),
        'production_report': {'path': os.path.relpath(out / 'report.json', REPO), 'sha256': sha256(out / 'report.json'),
                              'candidate_status': report['candidate_status'], 'source_unchanged': report['source_unchanged'], 'stage': report['stage']},
        'independent_audit': {'path': os.path.relpath(a.audit.resolve(), REPO), 'script': 'qa/codex/math/audit_publication.py', 'status': audit['status'],
                              'sha256': sha256(a.audit), 'checked_trial_count': audit['checked_trial_count'],
                              'checked_publication_rows': audit['checked_publication_rows'], 'checked_canonical_links': audit['checked_canonical_links'],
                              'coverage': audit['coverage']},
        'launch': {'path': os.path.relpath(a.launch.resolve(), REPO), 'launched_at_utc': launch['launched_at_utc'], 'workers': launch['workers'],
                   'rss_limit_mib': launch['rss_limit_mib'], 'process_group': launch['process_group']},
        'memory_guard': {'path': os.path.relpath(a.guard.resolve(), REPO), 'status': guard['status'], 'command_exit_code': guard['command_exit_code'],
                         'group_empty': guard['group_empty'], 'peak_rss_mib': guard['peak_rss_mib'], 'max_rss_mib': guard['max_rss_mib'],
                         'peak_processes': guard['peak_processes'], 'elapsed_seconds': guard['elapsed_seconds']},
        'runtime': report['runtime'],
        'production_total_seconds': report['total_seconds'],
        'trials': {k: report[k] for k in ('main_simulation_trials_per_mode', 'auxiliary_trials_per_bank', 'nonbonus_trials_per_natural_mode',
                                          'total_independent_simulation_trials', 'total_published_rows')},
        'expected_count': report['total_published_rows'],
        'excluded_modes': [],
        'committed': 'index.json, lookUpTable_<mode>_0.csv and this MANIFEST.json are committed; books_<mode>.jsonl.zst are gitignored '
                     '(math/publish/books_*.jsonl.zst) and copied from the production tree above, sha256 verified both sides',
        'index': index,
        'files': files,
        'figures': figures,
    }
    (a.publish / 'MANIFEST.json').write_text(json.dumps(manifest, indent=1) + '\n')
    print('MANIFEST.json written;', len(files), 'files;', report['total_published_rows'], 'rows')


if __name__ == '__main__':
    main()
