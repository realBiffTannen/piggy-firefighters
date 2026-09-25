"""Bounded process-lifecycle tests; never allocate production-scale memory."""
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).with_name("run_guard.py")


class GuardTests(unittest.TestCase):
    def run_guard(self, source, limit=5120):
        self.assertTrue(SCRIPT.is_file(), "Simulation process guard is not implemented")
        with tempfile.TemporaryDirectory() as folder:
            report = Path(folder) / "report.json"
            result = subprocess.run(
                [sys.executable, str(SCRIPT), "--max-rss-mib", str(limit), "--report", str(report),
                 "--", sys.executable, "-c", source],
                capture_output=True, text=True, timeout=12,
            )
            self.assertTrue(report.exists(), result.stderr)
            return result, json.loads(report.read_text())

    def test_success_preserves_stdout_and_reports_peak(self):
        result, report = self.run_guard("import time; print('sim complete', flush=True); time.sleep(.3)")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("sim complete", result.stdout)
        self.assertEqual(report["status"], "COMPLETE")
        self.assertGreater(report["peak_rss_mib"], 0)

    def test_nonzero_process_exit_is_not_reported_complete(self):
        result, report = self.run_guard("raise SystemExit(7)")
        self.assertEqual(result.returncode, 7)
        self.assertEqual(report["status"], "FAILED")

    def test_limit_terminates_owned_group_including_child(self):
        source = ("import subprocess, sys, time; "
                  "p=subprocess.Popen([sys.executable, '-c', "
                  "\"import time; data=bytearray(80*1024*1024); print('ready', flush=True); time.sleep(30)\"], "
                  "stdout=subprocess.PIPE, text=True); p.stdout.readline(); "
                  "print('child', p.pid, flush=True); data=bytearray(80*1024*1024); time.sleep(30)")
        result, report = self.run_guard(source, limit=120)
        self.assertEqual(result.returncode, 124, result.stderr)
        self.assertEqual(report["status"], "RSS_LIMIT")
        self.assertIn("child", result.stdout)
        self.assertGreaterEqual(report["peak_processes"], 2)
        self.assertGreater(report["peak_rss_mib"], 120)
        self.assertTrue(report["group_empty"], report)

    def test_sigterm_cleans_detached_simulation_and_reports_interruption(self):
        with tempfile.TemporaryDirectory() as folder:
            report_path = Path(folder) / "report.json"
            source = "import os,time; print(os.getpgrp(),flush=True); time.sleep(30)"
            guard = subprocess.Popen(
                [sys.executable, str(SCRIPT), "--report", str(report_path), "--", sys.executable, "-c", source],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
            )
            group = None
            try:
                group = int(guard.stdout.readline())
                guard.terminate()
                guard.communicate(timeout=8)
                self.assertEqual(guard.returncode, 143)
                self.assertTrue(report_path.exists(), "SIGTERM lost cleanup/report")
                report = json.loads(report_path.read_text())
                self.assertEqual(report["status"], "INTERRUPTED")
                self.assertEqual(report["signal"], signal.SIGTERM)
                self.assertTrue(report["group_empty"], report)
            finally:
                if group is not None:
                    try:
                        os.killpg(group, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                if guard.poll() is None:
                    guard.kill()
                guard.communicate(timeout=5)


if __name__ == "__main__":
    unittest.main()
