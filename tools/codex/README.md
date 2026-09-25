# Local simulation guard

`run_guard.py` launches exactly one command in a new process group and samples the
sum of that group's resident memory every 100 ms. Its default ceiling is 5,120 MiB,
leaving headroom below the agreed 6 GB math limit. It terminates only its own group.
This is a sampled watchdog, not a kernel hard memory limit; simulation workers must
remain in the inherited group. The model runner separately bounds workers and chunks.

Example from the repository root (the model still enforces its own freeze gate):

```sh
python3 tools/codex/run_guard.py --report qa/codex/math/run-guard.json -- \
  /Users/jbull/code/math-sdk/env/bin/python math/games/piggy_firefighters/run.py
```

The guard fails before starting the command if process enumeration is unavailable.
The local sandbox restricts `ps`, so the supervised run needs execution permission
for that operation. The JSON report records peak aggregate RSS, process count,
command exit, termination reason, and whether the owned group was cleaned up.
SIGINT, SIGTERM and SIGHUP enter the cleanup/report path; SIGKILL cannot be handled.
An RSS limit returns 124; an interrupted run returns 128 plus its signal number.

Four bounded lifecycle checks passed on 2026-09-25 UTC: ordinary completion,
nonzero exit propagation, combined parent/child RSS enforcement with a child-ready
handshake, and SIGTERM cleanup. The memory check allocates 80 MiB in each of two
test processes, verifying the sum crosses 120 MiB. Run with process enumeration:

```sh
python3 -m unittest tools/codex/test_run_guard.py -v
```

The first six-mode 10k development run used the earlier guard and completed normally
at 341.375 MiB peak. Production must use the corrected signal-cleanup version.
