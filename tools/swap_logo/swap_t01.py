"""T01.png — swap old logo with new logo.png"""
from PIL import Image, ImageDraw
from pathlib import Path

ROOT = Path(r"C:\claudeworkspace\sajumoon\web\user\public\img")
SHOTS = ROOT / "스크린샷"
OUT = Path(r"C:\claudeworkspace\sajumoon\tools\swap_logo\_out")
OUT.mkdir(parents=True, exist_ok=True)

base = Image.open(SHOTS / "T01.png").convert("RGBA")
new_logo = Image.open(ROOT / "logo.png").convert("RGBA")

# Old logo bbox in T01: ~ (545, 710, 860, 795). Add padding for safe mask.
mask_x0, mask_y0, mask_x1, mask_y1 = 535, 700, 875, 805
# Sample header bg (well clear of logo + icons) — pixel between logo and search icon.
sample = base.getpixel((1000, 740))[:3]
print("bg sample:", sample)

overlay = base.copy()
draw = ImageDraw.Draw(overlay)
draw.rectangle((mask_x0, mask_y0, mask_x1, mask_y1), fill=sample + (255,))

# Resize new logo to match old logo's visual size. Old ~ 315x85.
target_h = 95
ratio = new_logo.size[0] / new_logo.size[1]  # 152/50 = 3.04
target_w = int(target_h * ratio)
resized = new_logo.resize((target_w, target_h), Image.LANCZOS)
print("new logo size:", resized.size)

# Paste at left-aligned position matching the old logo start.
paste_x = mask_x0 + 10
paste_y = mask_y0 + ((mask_y1 - mask_y0) - target_h) // 2
overlay.alpha_composite(resized, (paste_x, paste_y))

result = overlay.convert("RGB")
result.save(OUT / "T01.png", quality=95)

# Save quick preview
preview = result.crop((350, 680, 1300, 820))
preview.save(OUT / "T01_preview.png")
print("done")
