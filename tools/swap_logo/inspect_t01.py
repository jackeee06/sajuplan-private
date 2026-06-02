"""Crop the header area of T01.png to locate the old logo exact bbox."""
from PIL import Image
from pathlib import Path

SHOTS = Path(r"C:\claudeworkspace\sajumoon\web\user\public\img\스크린샷")
OUT = Path(r"C:\claudeworkspace\sajumoon\tools\swap_logo\_inspect")
OUT.mkdir(parents=True, exist_ok=True)

img = Image.open(SHOTS / "T01.png")
print("size:", img.size)

# Tablet content roughly: top header inside the bezel. Crop upper-left band.
# T01 size 2048x2732. The tablet inside ~ x:200..1850, y:400..2400.
# Logo is at top-left of inner content, ~ y=480-620, x=280-700
crop = img.crop((250, 700, 1100, 950))
crop.save(OUT / "T01_header.png")
print("header saved:", crop.size)
