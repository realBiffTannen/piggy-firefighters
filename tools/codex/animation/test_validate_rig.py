"""Synthetic boundary regressions; no game assets or Spine editor required."""
import copy
import json
import struct
import subprocess
import sys
import tempfile
import unittest
import zlib
from pathlib import Path


SCRIPT = Path(__file__).with_name("validate_rig.py")
WRAPPER = Path(__file__).resolve().parents[3] / "art-src/animation/tools/check_contract.py"


def png(width=16, height=16):
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress((b"\x00" + b"\x00" * width * 4) * height)) + chunk(b"IEND", b""))


class RigValidationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.folder = Path(self.tmp.name)
        self.skeleton = {
            "skeleton": {"spine": "4.2.43"},
            "bones": [{"name": "root"}, {"name": "body", "parent": "root"}],
            "slots": [{"name": "body", "bone": "body", "attachment": "body"}],
            "skins": [{"name": "default", "attachments": {"body": {"body": {"width": 16, "height": 16}}}}],
            "events": {"land": {}},
            "animations": {"idle": {
                "bones": {"body": {"rotate": [{"value": 0}, {"time": 1, "value": 2}]}},
                "events": [{"time": 0.5, "name": "land"}],
            }},
        }
        self.atlas = "page.png\nsize: 16,16\nfilter: Linear,Linear\npma: false\nbody\nbounds: 0,0,16,16\n"
        (self.folder / "page.png").write_bytes(png())

    def run_validator(self, *, requirements=None, write_json=True):
        self.assertTrue(SCRIPT.is_file(), "Read-only rig validator has not been implemented")
        if write_json:
            (self.folder / "rig.json").write_text(json.dumps(self.skeleton))
        (self.folder / "rig.atlas").write_text(self.atlas)
        args = [sys.executable, str(SCRIPT), "--rig", "example", "--json", str(self.folder / "rig.json"),
                "--atlas", str(self.folder / "rig.atlas")]
        if requirements is not None:
            (self.folder / "requirements.json").write_text(json.dumps(requirements))
            args += ["--requirements", str(self.folder / "requirements.json")]
        before = {p.name: p.read_bytes() for p in self.folder.iterdir()}
        result = subprocess.run(args, capture_output=True, text=True)
        self.assertEqual(before, {p.name: p.read_bytes() for p in self.folder.iterdir()}, "Validator mutated inputs")
        self.assertEqual(result.stderr, "", result.stderr)
        return result.returncode, json.loads(result.stdout)

    def assert_failure(self, fragment):
        code, report = self.run_validator()
        self.assertEqual((code, report["status"]), (1, "FAIL"))
        self.assertTrue(any(fragment in issue for issue in report["issues"]), report)

    def test_valid_mini_rig_passes_static_only(self):
        code, report = self.run_validator(requirements={"clips": ["idle"], "skins": ["default"], "events": ["land"]})
        self.assertEqual((code, report["status"]), (0, "PASS"))
        self.assertEqual(report["motion_craft"], "NOT RUN")
        self.assertEqual(report["moving_bones_by_clip"], {"idle": ["body"]})

    def test_legacy_angle_cannot_count_as_rotation_motion(self):
        self.skeleton["animations"]["idle"]["bones"]["body"]["rotate"] = [
            {"angle": 0}, {"time": 1, "angle": 20}]
        self.assert_failure("unsupported bone keyframe")

    def test_bone_timeline_names_are_case_sensitive_like_runtime(self):
        self.skeleton["animations"]["idle"]["bones"]["body"] = {
            "Rotate": [{"value": 0}, {"time": 1, "value": 20}]}
        self.assert_failure("unsupported bone timeline")

    def test_legacy_slot_color_timeline_fails_even_with_valid_bone_motion(self):
        self.skeleton["animations"]["idle"]["slots"] = {"body": {
            "color": [{"color": "ffffffff"}, {"time": 1, "color": "ffffff00"}]}}
        self.assert_failure("unsupported slot timeline")

    def test_rgba_slot_timeline_and_value_rotation_pass(self):
        self.skeleton["animations"]["idle"]["slots"] = {"body": {
            "rgba": [{"color": "ffffffff"}, {"time": 1, "color": "ffffff80"}]}}
        code, report = self.run_validator()
        self.assertEqual((code, report["status"]), (0, "PASS"))
        self.assertEqual(report["moving_bones_by_clip"], {"idle": ["body"]})

    def test_empty_clip_fails(self):
        self.skeleton["animations"]["idle"] = {}
        self.assert_failure("idle")

    def test_second_skin_missing_attachment_fails(self):
        other = copy.deepcopy(self.skeleton["skins"][0])
        other["name"] = "second"
        other["attachments"]["body"]["body"]["path"] = "missing-art"
        self.skeleton["skins"].append(other)
        self.assert_failure("missing-art")

    def test_root_travel_fails_even_when_pose_also_animates(self):
        self.skeleton["animations"]["idle"]["bones"]["root"] = {"translate": [{"x": 0}, {"time": 1, "x": 12}]}
        self.assert_failure("root")

    def test_version_mismatch_fails(self):
        self.skeleton["skeleton"]["spine"] = "4.3.23"
        self.assert_failure("4.2")

    def test_missing_export_is_blocked(self):
        code, report = self.run_validator(write_json=False)
        self.assertEqual((code, report["status"]), (2, "BLOCKED"))

    def test_missing_png_is_blocked(self):
        (self.folder / "page.png").unlink()
        code, report = self.run_validator()
        self.assertEqual((code, report["status"]), (2, "BLOCKED"))

    def test_oversized_page_fails(self):
        self.atlas = self.atlas.replace("16,16", "2049,16", 1)
        (self.folder / "page.png").write_bytes(png(2049, 16))
        self.assert_failure("2048")

    def test_explicit_requirements_detect_missing_clip_skin_event(self):
        code, report = self.run_validator(requirements={"clips": ["catch"], "skins": ["twins"], "events": ["flip"]})
        self.assertEqual((code, report["status"]), (1, "FAIL"))
        for name in ("catch", "twins", "flip"):
            self.assertTrue(any(name in issue for issue in report["issues"]), report)

    def test_negative_timeline_time_fails(self):
        self.skeleton["animations"]["idle"]["bones"]["body"]["rotate"][1]["time"] = -1
        self.assert_failure("time")

    def test_nonnumeric_bone_pose_fails(self):
        self.skeleton["animations"]["idle"]["bones"]["body"]["rotate"][1]["value"] = "two"
        self.assert_failure("numeric")

    def test_unknown_animated_bone_fails(self):
        self.skeleton["animations"]["idle"]["bones"]["missing-bone"] = {"rotate": [{"value": 2}]}
        self.assert_failure("missing-bone")

    def test_root_bezier_excursion_fails_with_neutral_endpoint_keys(self):
        self.skeleton["animations"]["idle"]["bones"]["root"] = {
            "rotate": [{"value": 0, "curve": [0.2, 30, 0.8, 30]}, {"time": 1, "value": 0}]}
        self.assert_failure("root")

    def test_required_anchor_must_exist_as_a_bone(self):
        code, report = self.run_validator(requirements={"anchors": ["nozzle_tip"]})
        self.assertEqual((code, report["status"]), (1, "FAIL"))
        self.assertTrue(any("nozzle_tip" in issue for issue in report["issues"]), report)

    def test_two_moving_bones_requirement_rejects_single_bone_clip(self):
        code, report = self.run_validator(requirements={"min_moving_bones": 2})
        self.assertEqual((code, report["status"]), (1, "FAIL"))
        self.assertTrue(any("idle" in issue and "2" in issue for issue in report["issues"]), report)

    def test_two_moving_bones_and_existing_anchor_pass(self):
        self.skeleton["bones"].append({"name": "head", "parent": "body"})
        self.skeleton["animations"]["idle"]["bones"]["head"] = {"rotate": [{"value": 0}, {"time": 1, "value": 4}]}
        code, report = self.run_validator(requirements={"anchors": ["head"], "min_moving_bones": 2, "events": ["land"]})
        self.assertEqual((code, report["status"]), (0, "PASS"))
        self.assertEqual(report["moving_bones_by_clip"], {"idle": ["body", "head"]})
        self.assertEqual(report["motion_craft"], "NOT RUN")

    def test_declared_but_unkeyed_required_event_fails(self):
        del self.skeleton["animations"]["idle"]["events"]
        code, report = self.run_validator(requirements={"events": ["land"]})
        self.assertEqual((code, report["status"]), (1, "FAIL"))
        self.assertTrue(any("land" in issue and "keyed" in issue for issue in report["issues"]), report)

    def test_static_nonempty_pose_does_not_count_as_moving_bone(self):
        self.skeleton["animations"]["idle"]["bones"]["body"]["rotate"][1]["value"] = 0
        self.assert_failure("moving")

    def test_production_wrapper_reports_all_missing_rigs_blocked(self):
        self.assertTrue(WRAPPER.is_file(), "Production contract wrapper has not been implemented")
        result = subprocess.run([sys.executable, "-B", str(WRAPPER), "--runtime-root", str(self.folder / "absent")],
                                capture_output=True, text=True)
        self.assertEqual(result.stderr, "", result.stderr)
        report = json.loads(result.stdout)
        self.assertEqual((result.returncode, report["status"]), (2, "BLOCKED"))
        self.assertEqual(set(report["rigs"]), {"pf_chief", "pf_rookie", "pf_dog", "pf_rescued"})
        self.assertTrue(all(rig["status"] == "BLOCKED" for rig in report["rigs"].values()))


if __name__ == "__main__":
    unittest.main()
