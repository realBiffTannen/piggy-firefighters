"""Small in-memory/scratch image regressions; never creates game artwork."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

from PIL import Image

MODULE_PATH = Path(__file__).with_name('validate_thumbnail.py')
SPEC = importlib.util.spec_from_file_location('validate_thumbnail', MODULE_PATH)
validator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(validator)


class ThumbnailValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def check(self, image, role='foreground', size=(20, 20)):
        target = self.root / 'sample.png'
        image.save(target, format='PNG')
        return validator.check_image(target, size, role)

    def test_useful_rgba_alpha_passes_and_reports_measurements(self):
        image = Image.new('RGBA', (20, 20), (0, 0, 0, 0))
        image.paste((220, 150, 70, 255), (5, 5, 15, 15))
        result = self.check(image)
        self.assertEqual(result['status'], 'PASS')
        self.assertEqual(result['alpha']['transparent_fraction'], .75)
        self.assertEqual(result['alpha']['opaque_fraction'], .25)
        self.assertEqual(result['alpha']['visible_bounds'], [5, 5, 15, 15])

    def test_uniform_alpha_and_token_transparency_fail(self):
        for alpha in (0, 128, 255):
            with self.subTest(alpha=alpha):
                self.assertEqual(self.check(Image.new('RGBA', (20, 20), (10, 20, 30, alpha)))['status'], 'FAIL')
        almost_opaque = Image.new('RGBA', (20, 20), (10, 20, 30, 255))
        almost_opaque.putpixel((0, 0), (0, 0, 0, 0))
        self.assertEqual(self.check(almost_opaque)['status'], 'FAIL')

    def test_background_must_really_be_rgb(self):
        self.assertEqual(self.check(Image.new('RGB', (20, 20)), 'background')['status'], 'PASS')
        self.assertEqual(self.check(Image.new('RGBA', (20, 20), (0, 0, 0, 255)), 'background')['status'], 'FAIL')

    def test_preview_must_be_opaque_and_exact_size(self):
        self.assertEqual(self.check(Image.new('RGB', (20, 20)), 'preview')['status'], 'PASS')
        self.assertEqual(self.check(Image.new('RGBA', (20, 20)), 'preview')['status'], 'FAIL')
        self.assertEqual(self.check(Image.new('RGB', (19, 20)), 'preview')['status'], 'FAIL')

    def test_saved_rgb_trns_is_not_an_opaque_background_or_preview(self):
        target = self.root / 'rgb_with_trns.png'
        Image.new('RGB', (20, 20), (10, 20, 30)).save(target, format='PNG', transparency=(10, 20, 30))
        with Image.open(target) as saved:
            self.assertEqual(saved.mode, 'RGB')
            self.assertIn('transparency', saved.info)
            self.assertEqual(saved.convert('RGBA').getchannel('A').getextrema(), (0, 0))
        for role in ('background', 'preview'):
            with self.subTest(role=role):
                result = validator.check_image(target, (20, 20), role)
                self.assertEqual(result['status'], 'FAIL')
                self.assertTrue(any('tRNS' in issue for issue in result['issues']))

    def test_file_extension_cannot_disguise_non_png(self):
        target = self.root / 'sample.png'
        Image.new('RGB', (20, 20)).save(target, format='JPEG')
        self.assertEqual(validator.check_image(target, (20, 20), 'background')['status'], 'FAIL')
        Image.new('RGB', (20, 20)).save(target, format='PNG')
        target.write_bytes(target.read_bytes()[:-16])
        self.assertEqual(validator.check_image(target, (20, 20), 'background')['status'], 'FAIL')

    def test_missing_delivery_is_blocked_and_empty_provenance_fails(self):
        self.assertEqual(validator.validate(self.root)['status'], 'BLOCKED')
        (self.root / 'source-record.json').write_text('{}')
        report = validator.validate(self.root)
        self.assertEqual(report['status'], 'FAIL')
        record = next(item for item in report['files'] if item['file'] == 'source-record.json')
        self.assertEqual(record['status'], 'FAIL')


if __name__ == '__main__':
    unittest.main()
