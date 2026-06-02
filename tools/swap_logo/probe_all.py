"""Auto-detect logo bbox on flat-faced files; save header crops for angled files."""
from PIL import Image
import numpy as np
from pathlib import Path

SHOTS = Path(r"C:\claudeworkspace\sajumoon\web\user\public\img\스크린샷")
OUT = Path(r"C:\claudeworkspace\sajumoon\tools\swap_logo\_inspect")
OUT.mkdir(parents=True, exist_ok=True)

# Flat files with logo: app header is white, logo is leftmost purple/dark cluster.
# We'll search a tight horizontal band and find the left dark cluster.
FLAT = {
    "T01-1.png":   {"band_y": (690, 810), "search_x": (400, 1200)},
    "iOS_01.png":  {"band_y": None, "search_x": None},      # will probe
    "iOS_01-1.png":{"band_y": None, "search_x": None},
}

def probe_flat(name, band_y=None, search_x=None):
    img = Image.open(SHOTS / name).convert("RGB")
    arr = np.array(img)
    w, h = img.size
    print(f"\n== {name} {img.size} ==")

    # Default scan band: 18%-32% of height, left 60% of width
    if band_y is None:
        band_y = (int(h*0.16), int(h*0.30))
    if search_x is None:
        search_x = (int(w*0.18), int(w*0.55))

    y0, y1 = band_y
    x0, x1 = search_x

    strip = arr[y0:y1, x0:x1]
    mask = (strip < 200).any(axis=2)
    ys, xs = np.where(mask)
    if len(xs) == 0:
        print("  no dark pixels found")
        return
    print(f"  band y={band_y} x={search_x}")
    print(f"  dark x orig = {x0+xs.min()}..{x0+xs.max()}")
    print(f"  dark y orig = {y0+ys.min()}..{y0+ys.max()}")
    # Save tight crop for visual check
    ox0 = max(0, int(x0+xs.min())-10)
    oy0 = max(0, int(y0+ys.min())-10)
    ox1 = min(w, int(x0+xs.max())+10)
    oy1 = min(h, int(y0+ys.max())+10)
    img.crop((ox0, oy0, ox1, oy1)).save(OUT / f"_{name}")

for name, cfg in FLAT.items():
    probe_flat(name, cfg["band_y"], cfg["search_x"])

# For angled phones/tablets: save mid-resolution previews so we can pick corner points
ANGLED = ["T00_01.png", "T00_02.png", "iOS_00_1.png", "iOS_00_2.png"]
for name in ANGLED:
    img = Image.open(SHOTS / name)
    img.thumbnail((1200, 1200))
    img.save(OUT / f"thumb_{name}")
    print(f"thumb {name}: {img.size}")
