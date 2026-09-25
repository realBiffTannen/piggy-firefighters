#!/usr/bin/env python3
"""Read saved thumbnail files without changing them. PASS is structural, not art approval."""
import argparse
import hashlib
import json
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    Image = None

ROOT = Path(__file__).resolve().parents[3]
FORMATS = {'3_4': (1536, 2048), '16_9': (2048, 1152)}
MIN_ALPHA_FRACTION = .01


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def file_record(path):
    result = {'file': path.name, 'status': 'PASS', 'issues': []}
    if not path.exists():
        result.update(status='BLOCKED', issues=['Required final file is missing.'])
    elif not path.is_file():
        result.update(status='FAIL', issues=['Expected a regular file.'])
    return result


def check_image(path, expected_size, role):
    result = file_record(path)
    if result['status'] != 'PASS':
        return result
    if Image is None:
        result.update(status='BLOCKED', issues=['Pillow is unavailable; no image validation performed.'])
        return result
    try:
        result['sha256'] = digest(path)
        with Image.open(path) as image:
            result.update(format=image.format, mode=image.mode, size=list(image.size))
            if image.format != 'PNG':
                result['issues'].append('Actual file encoding must be PNG.')
            if image.size != tuple(expected_size):
                result['issues'].append(f'Expected dimensions {expected_size[0]} × {expected_size[1]}.')
            image.verify()
        # Avoid decoding an unexpected giant file merely to diagnose its dimensions.
        if result['issues']:
            result['status'] = 'FAIL'
            return result
        with Image.open(path) as image:
            image.load()
            result['transparency_metadata'] = 'transparency' in image.info
            if role in ('background', 'preview') and result['transparency_metadata']:
                result['issues'].append('Opaque backgrounds/previews must omit tRNS transparency metadata, even if its transparent color is unused.')
            if role == 'background' and image.mode != 'RGB':
                result['issues'].append('Background must use PNG RGB, not palette/grayscale/RGBA.')
            if role == 'foreground' and image.mode != 'RGBA':
                result['issues'].append('Foreground must use PNG RGBA with real alpha.')
            if role == 'preview' and image.mode not in ('RGB', 'RGBA'):
                result['issues'].append('Flattened preview must use RGB or fully opaque RGBA.')
            if image.mode == 'RGBA':
                alpha = image.getchannel('A')
                histogram = alpha.histogram()
                pixels = image.width * image.height
                transparent, opaque = histogram[0] / pixels, histogram[255] / pixels
                bounds = alpha.getbbox()
                result['alpha'] = {
                    'minimum': alpha.getextrema()[0], 'maximum': alpha.getextrema()[1],
                    'transparent_fraction': transparent, 'opaque_fraction': opaque,
                    'partial_fraction': sum(histogram[1:255]) / pixels,
                    'visible_bounds': list(bounds) if bounds else None,
                }
                if role == 'foreground':
                    if transparent < MIN_ALPHA_FRACTION:
                        result['issues'].append('Useful alpha requires at least 1% fully transparent pixels; an opaque matte or token transparent pixel is insufficient.')
                    if opaque < MIN_ALPHA_FRACTION:
                        result['issues'].append('Useful alpha requires at least 1% fully opaque pixels for the character interior.')
                elif role == 'preview' and opaque != 1:
                    result['issues'].append('Flattened preview must be completely opaque.')
    except (OSError, ValueError, SyntaxError, Image.DecompressionBombError) as error:
        result['issues'].append(f'Unreadable or invalid image: {type(error).__name__}.')
    if result['issues']:
        result['status'] = 'FAIL'
    return result


def check_document(path, provenance=False):
    result = file_record(path)
    if result['status'] != 'PASS':
        return result
    try:
        content = path.read_text(encoding='utf-8')
        if not content.strip():
            raise ValueError('empty document')
        if provenance:
            data = json.loads(content)
            if not isinstance(data, (dict, list)) or not data:
                raise ValueError('expected a nonempty JSON object or array')
        result['sha256'] = digest(path)
    except (OSError, UnicodeError, ValueError):
        result.update(status='FAIL', issues=['Expected readable nonempty UTF-8' + (' JSON object or array.' if provenance else ' text.')])
    return result


def validate(directory):
    files = [check_image(directory / f'{role}_{ratio}.png', size, role)
             for ratio, size in FORMATS.items() for role in ('foreground', 'background', 'preview')]
    files.extend([check_document(directory / 'instructions.md'),
                  check_document(directory / 'source-record.json', provenance=True)])
    statuses = {entry['status'] for entry in files}
    return {
        'status': 'FAIL' if 'FAIL' in statuses else 'BLOCKED' if 'BLOCKED' in statuses else 'PASS',
        'scope': 'Saved-file structure and provenance-file presence only; not visual or release acceptance.',
        'directory': str(directory.resolve()), 'files': files,
        'manual_review': 'NOT RUN: provenance contents/authenticity and recorded final hashes; original single character; matching identity; restrained palette; composition; anatomy; edges; small-size appeal; color management; platform upload.',
        'alpha_rule': 'Foreground: at least 1% alpha=0 and 1% alpha=255. This rejects uniform/token alpha, not painted matte spill or bad cutouts.',
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, default=ROOT / 'thumbnail', help='Final delivery folder (default: repository thumbnail/).')
    parser.add_argument('--json', action='store_true', help='Emit JSON measurements, SHA-256s and explicit acceptance limits.')
    args = parser.parse_args()
    report = validate(args.directory)
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(f"{report['status']}: {report['scope']}")
        for entry in report['files']:
            details = '; '.join(entry['issues']) or f"{entry.get('mode', 'document')} {entry.get('size', '')}".strip()
            print(f"{entry['status']:7} {entry['file']}: {details}")
        print(report['manual_review'])
    return {'PASS': 0, 'FAIL': 1, 'BLOCKED': 2}[report['status']]


if __name__ == '__main__':
    raise SystemExit(main())
