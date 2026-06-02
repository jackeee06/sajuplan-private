"""Visualize the search strip to understand what's catching dark pixels."""
from PIL import Image
from pathlib import Path
SHOTS = Path(r"C:\claudeworkspace\sajumoon\web\user\public\img\스크린샷")
img = Image.open(SHOTS / "T01.png").convert("RGB")
# Wide strip across the header
crop = img.crop((350, 680, 1700, 820))
crop.save(Path(r"C:\claudeworkspace\sajumoon\tools\swap_logo\_inspect\T01_full_header.png"))
print("saved size:", crop.size)
