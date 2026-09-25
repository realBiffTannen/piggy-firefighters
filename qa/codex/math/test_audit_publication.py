"""Small synthetic checks only; never reads any simulation output directory."""
import csv
import hashlib
import json
import math
import subprocess
import sys
from pathlib import Path
import tempfile
import unittest

try:
    import audit_publication as audit
except ImportError:
    audit = None


def write_rows(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', newline='') as stream:
        csv.writer(stream, lineterminator='\n').writerows(rows)


class AuditTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(audit, 'Standalone completed-output audit is not implemented')
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)

    def test_incomplete_guard_refuses_before_output_or_launch_reads(self):
        guard = self.root / 'guard.json'
        guard.write_text(json.dumps({'status': 'RUNNING'}))
        with self.assertRaisesRegex(audit.AuditError, 'guard'):
            audit.preflight(self.root / 'missing-output', guard, self.root / 'missing-launch.json')

    def test_incomplete_report_is_refused_after_completed_guard(self):
        output = self.root / 'output'
        output.mkdir()
        (output / 'report.json').write_text(json.dumps({'candidate_status': 'RUNNING'}))
        guard = self.root / 'guard.json'
        guard.write_text(json.dumps({'status': 'COMPLETE', 'group_empty': True,
            'command_exit_code': 0, 'pid': 123, 'peak_rss_mib': 50, 'max_rss_mib': 5120}))
        launch = self.root / 'launch.json'
        launch.write_text(json.dumps({'process_group': 123, 'output': str(output), 'rss_limit_mib': 5120}))
        with self.assertRaisesRegex(audit.AuditError, 'PASS'):
            audit.preflight(output, guard, launch)

    def test_exact_moments_and_inclusive_cvar_quantile_tie(self):
        lut, meta = self.root / 'lut.csv', self.root / 'meta.csv'
        write_rows(lut, [(0, 9990, 0), (1, 9, 100), (2, 1, 1500000)])
        write_rows(meta, [(0, 0, 'none', False), (1, 100, 'none', True), (2, 1500000, 'inferno', False)])
        result = audit.scan_lut(lut, meta, audit.Fraction(1), 3)
        stats = result.figures()
        self.assertEqual(result.moment1, 1500900)
        self.assertAlmostEqual(stats['rtp'], 1.5009)
        self.assertAlmostEqual(stats['sd_over_cost'], math.sqrt(22500.0009 - 1.5009**2))
        self.assertEqual(stats['any_win'], .001)
        self.assertEqual(stats['cap_probability'], .0001)
        self.assertEqual(stats['etl10k'], 1.5)
        # Exactly99.9% is at zero. SDK CVaR includes every outcome tied at its
        # selected quantile; it does not fractionally trim to the top0.1%.
        self.assertEqual(stats['cvar'], 1.5009)

    def test_lut_metadata_mismatch_and_nonpositive_weight_fail(self):
        lut, meta = self.root / 'lut.csv', self.root / 'meta.csv'
        write_rows(lut, [(0, 1, 0)])
        write_rows(meta, [(0, 100, 'none', False)])
        with self.assertRaisesRegex(audit.AuditError, 'payout'):
            audit.scan_lut(lut, meta, audit.Fraction(1), 1)
        write_rows(lut, [(0, 0, 100)])
        with self.assertRaisesRegex(audit.AuditError, 'weight'):
            audit.scan_lut(lut, meta, audit.Fraction(1), 1)

    def test_nonfinite_report_number_and_wrong_launch_guard_are_rejected(self):
        with self.assertRaisesRegex(audit.AuditError, 'number'):
            audit.same_number(1, float('nan'), 'rtp')
        output = self.root / 'must-not-be-read'
        guard = self.root / 'guard.json'
        guard.write_text(json.dumps({'status': 'COMPLETE', 'group_empty': True,
            'command_exit_code': 0, 'pid': 123, 'peak_rss_mib': 50, 'max_rss_mib': 5120}))
        launch = self.root / 'launch.json'
        launch.write_text(json.dumps({'process_group': 456, 'output': str(output), 'rss_limit_mib': 5120}))
        with self.assertRaisesRegex(audit.AuditError, 'process group'):
            audit.preflight(output, guard, launch)

    def test_trial_csv_must_match_selected_publication_payout(self):
        plan = audit.Plan(main=2, auxiliary=2, natural=3)
        path = self.root / 'trials_alarm_call.csv'
        write_rows(path, [('trial_id', 'published_book_id', 'outcome', 'payout_x100'),
                         (0, 0, 'falseAlarm', 0), (1, 4, 'inferno', 1000)])
        stored = {'simulation_trials': 2, 'trial_outcome_counts': {'falseAlarm': 1, 'inferno': 1},
                  'distinct_trial_book_ids': 2, 'empirical_trial_mean_x': 5,
                  'empirical_trial_second_moment_x2': 50, 'trials_sha256': audit.digest(path)}
        self.assertEqual(audit.audit_trials(self.root, plan, stored, [0, 0, 100, 0, 1000])['trials'], 2)
        with self.assertRaisesRegex(audit.AuditError, 'payout/route'):
            audit.audit_trials(self.root, plan, stored, [0, 0, 100, 0, 2000])

    def test_source_report_and_current_inputs_must_match_the_freeze(self):
        paths = {'math/games/piggy_firefighters/gamestate.py': 'version = 1\n',
                 'math/src/__init__.py': '', 'math/utils/__init__.py': '',
                 'math/requirements.txt': '', 'math/requirements-production.lock': 'scipy==1.15.3\n'}
        for relative, content in paths.items():
            path = self.root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
        def git(*args):
            return subprocess.check_output(['git', '-C', str(self.root), '-c', 'user.name=Audit Test',
                '-c', 'user.email=audit@example.invalid', '-c', 'commit.gpgsign=false', *args],
                text=True, stderr=subprocess.DEVNULL).strip()
        git('init')
        git('add', 'math')
        git('commit', '-m', 'tiny synthetic freeze')
        git('tag', '-a', 'math-freeze-v1', '-m', 'synthetic test')
        launch = {'freeze_tag': 'math-freeze-v1', 'freeze_sha': git('rev-parse', 'HEAD'), 'interpreter': sys.executable}
        report = {'source_sha256': {p.removeprefix('math/'): audit.digest(self.root / p) for p in paths},
                  'runtime': {**audit.RUNTIME, 'executable': sys.executable}}
        self.assertEqual(audit.verify_sources(self.root, launch, report)['verified_source_files'], 5)
        (self.root / 'math/src/__init__.py').write_text('changed = True\n')
        with self.assertRaisesRegex(audit.AuditError, 'source bytes changed'):
            audit.verify_sources(self.root, launch, report)

    def test_validated_index_bytes_cannot_change_during_audit(self):
        index = self.root / 'index.json'
        index.write_text('{"modes":[{"name":"base","cost":1}]}\n')
        parsed, snapshot = audit.load_json_snapshot(index)
        self.assertEqual(parsed['modes'][0]['cost'], 1)
        index.write_text('{"modes":[{"name":"base","cost":99}]}\n')
        with self.assertRaisesRegex(audit.AuditError, 'changed during audit'):
            audit.verify_evidence_snapshot({str(index): snapshot})

    def test_streamed_links_require_actual_bank_weight_times_factor(self):
        plan = audit.Plan(main=2, auxiliary=2, natural=3)
        banks = {}
        publication = [(i, 1, 0) for i in range(plan.natural)]
        links = [audit.LINK_COLUMNS]
        for key, factor in audit.BASE_FACTORS.items():
            bonus, spins = key
            rows = [(0, 999999000000, 0), (1, 1000000, 1500000)]
            write_rows(self.root / 'banks' / f'weights_{bonus}_{spins}.csv', rows)
            hashes = [hashlib.sha256(f'{bonus}:{spins}:{i}'.encode()).hexdigest() for i in range(2)]
            banks[f'{bonus}_{spins}'] = {'full_event_bank_sha256': hashlib.sha256(b''.join(bytes.fromhex(h) for h in hashes)).hexdigest()}
            for (bank_id, weight, payout), fingerprint in zip(rows, hashes):
                published_id = len(publication)
                publication.append((published_id, weight * factor, payout))
                links.append((published_id, bonus, spins, bank_id, fingerprint, weight, factor, weight * factor))
        write_rows(self.root / 'lookUpTable_base_0.csv', publication)
        write_rows(self.root / 'bank_links_base.csv', links)
        self.assertEqual(audit.audit_links(self.root, 'base', plan, banks)['rows'], 12)
        publication[-1] = (publication[-1][0], publication[-1][1] + 1, publication[-1][2])
        write_rows(self.root / 'lookUpTable_base_0.csv', publication)
        with self.assertRaisesRegex(audit.AuditError, 'weight'):
            audit.audit_links(self.root, 'base', plan, banks)


if __name__ == '__main__':
    unittest.main()
