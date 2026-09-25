#!/usr/bin/env python3
"""Read-only Firefighters v1.1 static export gate; recorded motion review is separate."""
import argparse
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / "tools/codex/animation"))
from validate_rig import read_json, validate  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rig", choices=("pf_chief", "pf_rookie", "pf_dog", "pf_rescued"),
                        help="Check one rig; default checks all four")
    parser.add_argument("--runtime-root", type=Path,
                        default=ROOT / "apps/piggy_firefighters/static/assets/spine",
                        help="Export root; override only for isolated preflight/tests")
    args = parser.parse_args()
    requirement_path = ROOT / "qa/codex/animation/requirements.json"
    report = {"status": "FAIL", "scope": "STATIC CONTRACT PREFLIGHT ONLY", "motion_craft": "NOT RUN",
              "runtime_render": "NOT RUN", "requirements": str(requirement_path), "rigs": {}}
    try:
        requirements = read_json(requirement_path)
        selected = [args.rig] if args.rig else ["pf_chief", "pf_rookie", "pf_dog", "pf_rescued"]
        for rig in selected:
            folder = args.runtime_root / rig
            result = validate(rig, folder / f"{rig}.json", folder / f"{rig}.atlas", requirements=requirements[rig])
            result["requirements"] = f"{requirement_path}#{rig}"
            report["rigs"][rig] = result
        states = {result["status"] for result in report["rigs"].values()}
        report["status"] = "FAIL" if "FAIL" in states else "BLOCKED" if "BLOCKED" in states else "PASS"
    except (OSError, ValueError, TypeError, KeyError) as error:
        report["issues"] = [f"Invalid production requirements: {error}"]
    print(json.dumps(report, indent=2))
    return {"PASS": 0, "FAIL": 1, "BLOCKED": 2}[report["status"]]


if __name__ == "__main__":
    raise SystemExit(main())
