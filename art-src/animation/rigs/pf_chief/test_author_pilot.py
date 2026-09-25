"""Focused authoring safeguards; these fixtures are geometry, never production art."""
import importlib.util
import math
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("author_pilot.py")


class PilotAuthorTests(unittest.TestCase):
    def author(self):
        self.assertTrue(SCRIPT.is_file(), "Chief pilot authoring implementation is missing")
        spec = importlib.util.spec_from_file_location("author_pilot", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def test_missing_registered_parts_produce_no_output(self):
        author = self.author()
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            with self.assertRaisesRegex(author.Blocked, "registration.json"):
                author.author(root / "parts", root / "pilot")
            self.assertFalse((root / "pilot").exists())

    def test_native_project_is_never_overwritten_by_regeneration(self):
        author = self.author()
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            project = root / "pf_chief.spine"
            project.write_bytes(b"edited native source")
            with self.assertRaisesRegex(author.Blocked, "native"):
                author.author(root / "parts", root)
            self.assertEqual(project.read_bytes(), b"edited native source")

    def test_draft_texture_snapshot_survives_later_source_updates(self):
        author = self.author()
        self.assertTrue(callable(getattr(author, "freeze_source", None)), "Draft textures need immutable copies")
        with tempfile.TemporaryDirectory() as temp:
            source, target = Path(temp) / "source.bin", Path(temp) / "draft.bin"
            source.write_bytes(b"registered source bytes")
            author.freeze_source(source, target)
            source.write_bytes(b"later art delivery")
            self.assertFalse(target.is_symlink())
            self.assertEqual(target.read_bytes(), b"registered source bytes")

    def test_weighted_vertices_preserve_setup_position_under_rotated_bones(self):
        author = self.author()
        transforms = [(0, 0, 0), (10, 20, math.pi / 2)]
        encoded = author.weighted_vertex((10, 30), [(0, 0.25), (1, 0.75)], transforms)
        self.assertEqual(encoded[0], 2)
        self.assertAlmostEqual(sum(encoded[4::4]), 1)
        # Root local (10,30), rotated child local (10,0), same world vertex.
        self.assertEqual(encoded[1:5], [0, 10.0, 30.0, 0.25])
        self.assertEqual(encoded[5], 1)
        self.assertAlmostEqual(encoded[6], 10)
        self.assertAlmostEqual(encoded[7], 0)
        self.assertAlmostEqual(encoded[8], 0.75)

    def test_scale_uses_standing_silhouette_and_origin_is_feet_centre(self):
        author = self.author()
        self.assertEqual(author.canvas_point((512, 1440), 0.3), (0, 0))
        self.assertEqual(author.canvas_point((612, 1340), 0.3), (30, 30))
        self.assertAlmostEqual(author.standing_scale((42, 18, 978, 1441)), 420 / 1423)

    def test_spray_joins_and_event_contact_order(self):
        clips = self.author().spray_clips()
        start, loop, end = [clips[name] for name in ("spray_start", "spray_loop", "spray_end")]
        for bone in loop["bones"]:
            self.assertNotEqual(bone, "root")
            for channel, frames in loop["bones"][bone].items():
                values = lambda frame: {k: v for k, v in frame.items() if k not in ("time", "curve")}
                self.assertEqual(values(start["bones"][bone][channel][-1]), values(frames[0]))
                self.assertEqual(values(frames[-1]), values(frames[0]))
                self.assertEqual(values(end["bones"][bone][channel][0]), values(frames[0]))
        self.assertEqual(start["events"], [{"time": 0.44, "name": "spray_on"}])
        self.assertEqual(end["events"], [{"time": 0, "name": "spray_off"}])
        for clip, duration in ((start, 0.6), (end, 0.5)):
            self.assertEqual(max(frame["time"] for bone in clip["bones"].values()
                                 for frames in bone.values() for frame in frames), duration)

    def test_expression_variants_share_one_slot_without_losing_attachments(self):
        author = self.author()
        surface = {"image": "face", "bone": "root", "slot": "eyes", "setup_attachment": "open",
                   "image_size": [10, 10], "vertices": [
                       {"uv": [0, 0], "point": [512, 1440], "weights": {"root": 1}},
                       {"uv": [0, 10], "point": [512, 1430], "weights": {"root": 1}},
                       {"uv": [10, 10], "point": [522, 1430], "weights": {"root": 1}}],
                   "triangles": [0, 1, 2], "hull": 3}
        layout = {"bones": [{"name": "root", "point": [512, 1440]}], "ik": [],
                  "surfaces": [dict(surface, name="open"), dict(surface, name="closed")]}
        rig = author.build_rig(layout, 1)
        self.assertEqual(rig["slots"], [{"name": "eyes", "bone": "root", "attachment": "open"}])
        self.assertEqual(set(rig["skins"][0]["attachments"]["eyes"]), {"open", "closed"})

    def test_full_performances_preserve_pilot_and_return_to_compatible_pose(self):
        author = self.author()
        self.assertTrue(callable(getattr(author, "full_clips", None)), "Remaining Chief performances are missing")
        clips = author.full_clips()
        durations = {"idle": 5, "idle_alt": 4, "win": 1.2, "big_win": 2.4,
                     "point_reels": .8, "celebrate": 2, "sad": 1.5}
        self.assertEqual(set(clips), set(durations) | set(author.spray_clips()))
        for name, clip in author.spray_clips().items():
            self.assertEqual(clips[name], clip, "Accepted spray curves must remain unchanged")
        for name, duration in durations.items():
            clip = clips[name]
            self.assertNotIn("root", clip["bones"])
            self.assertGreaterEqual(len(clip["bones"]), 2)
            self.assertEqual(max(frame["time"] for tracks in clip["bones"].values()
                                 for frames in tracks.values() for frame in frames), duration)
            for bone, tracks in clip["bones"].items():
                for kind, frames in tracks.items():
                    expected = 1 if kind == "scale" else 0
                    for key, value in frames[-1].items():
                        if key not in ("time", "curve"):
                            self.assertEqual(value, expected, f"{name}/{bone}/{kind} does not settle")


if __name__ == "__main__":
    unittest.main()
