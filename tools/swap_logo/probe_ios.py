"""Find logo bbox on iOS_01 / iOS_01-1 — phone screen header is inside the device."""
from PIL import Image
import numpy as np
from pathlib import Path

SHOTS = Path(r"C:\claudeworkspace\sajumoon\web\user\public\img\스크린샷")
OUT = Path(r"C:\claudeworkspace\sajumoon\tools\swap_logo\_inspect")

for name in ["iOS_01.png", "iOS_01-1.png", "T01-1.png"]:
    img = Image.open(SHOTS / name).convert("RGB")
    w, h = img.size
    # Save horizontal slices to locate the phone header
    # For iPhone 1242x2688: phone occupies ~y=600..2300. Header inside ~y=900-1050.
    # For tablet T01-1 2048x2732: header ~y=700-810 (same as T01).
    if "T01" in name:
        crop = img.crop((300, 680, 1700, 820))
    else:
        # iPhone — header band ~ y=900..1080, x=200..1050
        crop = img.crop((180, 880, 1100, 1100))
    crop.save(OUT / f"hdr_{name}")
    print(f"{name} hdr crop:", crop.size)
