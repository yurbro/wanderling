# Make a WebP twin of every PNG under public/art, so the browser can take the
# small one (about a fifth of the size) and fall back to the PNG where WebP is
# not understood. Run after adding or changing any picture:
#   python3 tools/make-webp.py
# Needs Pillow with WebP support (pip install pillow).
import glob, os
from PIL import Image

root = os.path.join(os.path.dirname(__file__), '..', 'public', 'art')
before = after = 0
for png in sorted(glob.glob(os.path.join(root, '**', '*.png'), recursive=True)):
    webp = png[:-4] + '.webp'
    if os.path.exists(webp) and os.path.getmtime(webp) >= os.path.getmtime(png):
        continue
    im = Image.open(png)
    # Lossy at 85 keeps the pencil lines clean; the alpha channel stays exact.
    im.save(webp, 'WEBP', quality=85, method=6)
    before += os.path.getsize(png)
    after += os.path.getsize(webp)
    print(f'{os.path.relpath(webp, root)}: {os.path.getsize(png) // 1024} KB -> {os.path.getsize(webp) // 1024} KB')
print(f'converted {before / 1e6:.1f} MB of PNG into {after / 1e6:.1f} MB of WebP')
