"""Swap old logo on the 4 flat-faced screenshots with the new logo.png.
Logo height = 86 (= prior 95 × 0.9, per user feedback)."""
from PIL import Image, ImageDraw
from pathlib import Path

ROOT = Path(r"C:\claudeworkspace\sajumoon\web\user\public\img")
SHOTS = ROOT / "스크린샷"
OUT = Path(r"C:\claudeworkspace\sajumoon\tools\swap_logo\_out")
OUT.mkdir(parents=True, exist_ok=True)

new_logo = Image.open(ROOT / "logo.png").convert("RGBA")
ratio = new_logo.size[0] / new_logo.size[1]

# Per-file mask + paste + size config.
# logo_h: height in px. iPhone files at 56 (35% smaller than tablet's 86) per user feedback.
JOBS = {
    "T01.png":     {"mask": (535, 700, 875, 805),  "paste_x": 548, "logo_h": 86},
    "T01-1.png":   {"mask": (525, 695, 870, 810),  "paste_x": 540, "logo_h": 86},
    "iOS_01.png":  {"mask": (280, 975, 615, 1085), "paste_x": 295, "logo_h": 56},
    "iOS_01-1.png":{"mask": (280, 965, 615, 1085), "paste_x": 295, "logo_h": 56},
}

for name, cfg in JOBS.items():
    src = SHOTS / name
    base = Image.open(src).convert("RGBA")
    mx0, my0, mx1, my1 = cfg["mask"]
    sample_x = min(mx1 + 80, base.size[0] - 5)
    sample_y = (my0 + my1) // 2
    bg = base.getpixel((sample_x, sample_y))[:3]
    overlay = base.copy()
    ImageDraw.Draw(overlay).rectangle((mx0, my0, mx1, my1), fill=bg + (255,))

    lh = cfg["logo_h"]
    lw = int(lh * ratio)
    resized = new_logo.resize((lw, lh), Image.LANCZOS)
    px = cfg["paste_x"]
    py = my0 + ((my1 - my0) - lh) // 2
    overlay.alpha_composite(resized, (px, py))
    out_path = OUT / name
    overlay.convert("RGB").save(out_path, quality=95)
    print(f"  {name}: logo {lw}x{lh} bg={bg} paste=({px},{py})")
