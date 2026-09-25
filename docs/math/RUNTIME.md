# Local math runtime

Use `/Users/jbull/code/piggy-firefighters/math/env/bin/python` for further development
verification and production. This is a project-local virtual environment created from
the bundled Python **3.12.14**, with **NumPy 2.2.5**, **SciPy 1.15.3** and
**zstandard 0.23.0**. Exact installed packages are in `math/requirements-production.lock`.
`pip check` passes. The previous shared SDK environment was not modified.

The previous environment combined Python 3.14.6 with NumPy 2.2.5. The latter officially
supports Python 3.10–3.13 ([release notes](https://numpy.org/devdocs/release/2.2.5-notes.html)).
A local regression exposed mutation during chained large-array arithmetic in that
combination. It corrupted report fields; independent integer/Fraction calculations
confirmed the saved development LUT figures. It must not be used for production.

The selected replacement is within both packages' supported ranges: SciPy 1.15 supports
Python 3.10–3.13 and the selected NumPy version
([SciPy toolchain table](https://docs.scipy.org/doc/scipy/dev/toolchain.html)).
Reporting also uses integer totals and scalar reductions, so critical statistics do not
depend on the fragile temporary-array behavior. Runtime compatibility and regression
checks supplement, rather than replace, the frozen-source and publication gates.

Recreate in this checkout using Python 3.12 and the exact lockfile:

```sh
python3.12 -m venv math/env
math/env/bin/python -m pip install -r math/requirements-production.lock
math/env/bin/python -m pip check
```

The local interpreter was obtained from the Codex bundled workspace runtime; no system
Python or other project's virtual environment was changed. Production evidence must
record its own interpreter/package versions and use the owned-process RSS watchdog.
