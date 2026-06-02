"""Find exact bbox of old logo by skipping tablet bezel shadow."""
from PIL import Image
import numpy as np
from pathlib import Path

SHOTS = Path(r"C:\claudeworkspace\sajumoon\web\user\public\img\스크린샷")
img = Image.open(SHOTS / "T01.png").convert("RGB")
arr = np.array(img)

# Limit to a band well inside the tablet content (skip bezel) and on the left
# half of the screen (logo is top-left of app header, right side has icons).
y0, y1 = 690, 810
x0, x1 = 400, 1200  # skip bezel (~ x<350) and avoid bell/search (~ x>1500)

strip = arr[y0:y1, x0:x1]
# A pixel is "dark" if any channel is < 200 (the logo has both purple and dark text).
mask = (strip < 200).any(axis=2)
ys, xs = np.where(mask)
print(f"dark px count: {len(xs)}")
if len(xs):
    print(f"  x range orig = {x0+xs.min()}..{x0+xs.max()}")
    print(f"  y range orig = {y0+ys.min()}..{y0+ys.max()}")
    ox0 = int(x0 + xs.min()) - 8
    ox1 = int(x0 + xs.max()) + 8
    oy0 = int(y0 + ys.min()) - 6
    oy1 = int(y0 + ys.max()) + 6
    crop = img.crop((ox0, oy0, ox1, oy1))
    crop.save(Path(r"C:\claudeworkspace\sajumoon\tools\swap_logo\_inspect\T01_logo_only.png"))
    print("tight bbox:", (ox0, oy0, ox1, oy1), "size:", crop.size)
