#!/usr/bin/env python3
"""Run one local simulation command in its own group with a conservative RSS limit.

RSS is sampled and summed across the entire owned process group; shared pages can
be counted more than once. This is a fail-closed watchdog, not a kernel hard limit.
The 5120 MiB default leaves headroom below the agreed 6 GB process-tree ceiling.
It never searches for or terminates processes by command name.
"""
import argparse
import json
import os
from pathlib import Path
import signal
import subprocess
import time


class StopRequested(BaseException):
    def __init__(self, signum):
        self.signum = signum


def members(group):
    result = subprocess.run(
        ["ps", "-axo", "pid=,pgid=,rss=,stat="],
        capture_output=True, text=True, check=True, timeout=5,
    )
    rows = []
    for line in result.stdout.splitlines():
        pid, pgid, rss, state = line.split(maxsplit=3)
        if int(pgid) == group and not state.startswith("Z"):
            rows.append((int(pid), int(rss)))
    return rows


def signal_group(group, sig):
    try:
        os.killpg(group, sig)
    except ProcessLookupError:
        pass


def terminate_group(process):
    signal_group(process.pid, signal.SIGTERM)
    deadline = time.monotonic() + 2
    while time.monotonic() < deadline:
        process.poll()
        if not members(process.pid):
            return True
        time.sleep(.05)
    signal_group(process.pid, signal.SIGKILL)
    process.wait(timeout=5)
    for _ in range(20):
        if not members(process.pid):
            return True
        time.sleep(.05)
    return False


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--max-rss-mib", type=float, default=5120)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.command[1:] if args.command[:1] == ["--"] else args.command
    if not command or not 0 < args.max_rss_mib <= 5120:
        parser.error("supply a command and an RSS threshold in (0, 5120] MiB")
    args.report.parent.mkdir(parents=True, exist_ok=True)
    # Prove monitoring works before starting a potentially expensive command.
    try:
        members(os.getpgrp())
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        args.report.write_text(json.dumps({"status": "MONITOR_UNAVAILABLE", "error": str(error),
                                          "command_started": False}, indent=2) + "\n")
        return 1
    started = time.monotonic()
    process = None
    report = {"status": "RUNNING", "max_rss_mib": args.max_rss_mib,
              "peak_rss_mib": 0, "peak_processes": 0, "group_empty": False}
    code = 1
    # Record signals rather than raising asynchronously across Popen: its child
    # handle must be assigned before cleanup. Children inherit no blocked mask.
    termination_signals = {signal.SIGINT, signal.SIGTERM, signal.SIGHUP}
    stop_signal = []
    def request_stop(signum, _frame):
        stop_signal.append(signum)
    old_handlers = {sig: signal.signal(sig, request_stop) for sig in termination_signals}
    try:
        process = subprocess.Popen(command, start_new_session=True)
        report["pid"] = process.pid
        while process.poll() is None:
            if stop_signal:
                raise StopRequested(stop_signal[0])
            owned = members(process.pid)
            rss = sum(row[1] for row in owned) / 1024
            report["peak_rss_mib"] = max(report["peak_rss_mib"], rss)
            report["peak_processes"] = max(report["peak_processes"], len(owned))
            if rss > args.max_rss_mib:
                report["status"], code = "RSS_LIMIT", 124
                break
            time.sleep(.1)
        else:
            code = process.returncode
            report["status"] = "COMPLETE" if code == 0 else "FAILED"
        if stop_signal:
            raise StopRequested(stop_signal[0])
        if report["status"] == "COMPLETE" and members(process.pid):
            report["status"], code = "CHILDREN_LEFT_RUNNING", 1
    except StopRequested as stopped:
        report["status"], code = "INTERRUPTED", 128 + stopped.signum
        report["signal"] = stopped.signum
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        report["status"], code = "MONITOR_FAILED", 1
        report["error"] = str(error)
    finally:
        # Ignore repeated termination while cleaning up the already-owned group.
        for sig in termination_signals:
            signal.signal(sig, signal.SIG_IGN)
        try:
            report["group_empty"] = process is None or terminate_group(process)
            if not report["group_empty"] and code == 0:
                report["status"], code = "CLEANUP_FAILED", 1
        except (OSError, ValueError, subprocess.SubprocessError) as error:
            if process is not None:
                signal_group(process.pid, signal.SIGKILL)
            report["cleanup_error"] = str(error)
            if code == 0:
                code = 1
                report["status"] = "CLEANUP_FAILED"
        report["command_exit_code"] = process.poll() if process else None
        report["elapsed_seconds"] = round(time.monotonic() - started, 3)
        args.report.write_text(json.dumps(report, indent=2) + "\n")
        for sig, handler in old_handlers.items():
            signal.signal(sig, handler)
    return code if code >= 0 else 128 - code


if __name__ == "__main__":
    raise SystemExit(main())
