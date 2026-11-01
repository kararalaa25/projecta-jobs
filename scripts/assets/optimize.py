"""Regenerate local responsive assets; requires Pillow, fonttools and brotli.
Run: python scripts/assets/optimize.py
Runtime/builds use the committed assets and need no Python dependencies.
"""
from pathlib import Path
from PIL import Image, ImageOps
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parents[2]
images = root / 'public/images'
source = Image.open(images / 'medical-specialist.jpg').convert('RGB')
# Keep the central crop used by object-fit: cover on portrait phones.
for name, sizes in [('medical-specialist', [(960, 540), (1280, 720), (1920, 1080)]),
                    ('medical-specialist-portrait', [(480, 854), (768, 1366)])]:
    for width, height in sizes:
        image = ImageOps.fit(source, (width, height), method=Image.Resampling.LANCZOS, centering=(0.61, 0.5) if 'portrait' in name else (0.5, 0.5))
        for format, quality in [('WEBP', 78), ('AVIF', 58)]:
            image.save(images / f'{name}-{width}.{format.lower()}', format=format, quality=quality)
for path in (root / 'public/fonts').glob('ui-*.woff'):
    font = TTFont(path)
    font.flavor = 'woff2'
    font.save(path.with_suffix('.woff2'))
