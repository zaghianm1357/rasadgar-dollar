#!/usr/bin/env python3
"""آماده‌سازی لوگوی BIG TRADER (upload/logo3.png)
خروجی‌ها:
  - public/logo3.png            → نسخه وب (۲۴۰ پیکسل، PNG شفاف)
  - scripts/standalone/logo-b64.txt → base64 نسخه فشرده ۱۴۴ پیکسل برای فایل مستقل
اگر گوشه‌های تصویر مات (پس‌زمینه سفید) باشند، ماسک دایره‌ای اعمال می‌شود.
"""
from PIL import Image, ImageDraw
import base64, io, os

SRC = "/home/z/my-project/upload/logo3.png"
WEB_OUT = "/home/z/my-project/public/logo3.png"
B64_OUT = "/home/z/my-project/scripts/standalone/logo-b64.txt"

img = Image.open(SRC).convert("RGBA")
w, h = img.size
print(f"source: {w}x{h}")

# بررسی شفافیت گوشه‌ها — اگر مات بود، ماسک دایره‌ای بزن (لوگو نشان دایره‌ای است)
corners = [img.getpixel((2, 2)), img.getpixel((w - 3, 2)), img.getpixel((2, h - 3)), img.getpixel((w - 3, h - 3))]
opaque_corners = sum(1 for p in corners if p[3] > 200)
print(f"opaque corners: {opaque_corners}/4")
if opaque_corners >= 3:
    # برش مربعی مرکز + ماسک دایره‌ای
    side = min(w, h)
    left, top = (w - side) // 2, (h - side) // 2
    img = img.crop((left, top, left + side, top + side))
    side = img.size[0]
    mask = Image.new("L", (side * 4, side * 4), 0)
    d = ImageDraw.Draw(mask)
    d.ellipse((0, 0, side * 4 - 1, side * 4 - 1), fill=255)
    mask = mask.resize((side, side), Image.LANCZOS)
    img.putalpha(mask)
    print("circular mask applied")

os.makedirs(os.path.dirname(WEB_OUT), exist_ok=True)

# نسخه وب — ۲۴۰ پیکسل
web = img.resize((240, 240), Image.LANCZOS)
web.save(WEB_OUT, "PNG", optimize=True)
print(f"web: {WEB_OUT} {os.path.getsize(WEB_OUT) / 1024:.1f} KB")

# نسخه مستقل — ۱۴۴ پیکسل برای base64
st = img.resize((144, 144), Image.LANCZOS)
buf = io.BytesIO()
st.save(buf, "PNG", optimize=True)
data = buf.getvalue()
b64 = base64.b64encode(data).decode("ascii")
with open(B64_OUT, "w") as f:
    f.write(b64)
print(f"standalone b64: {B64_OUT} {len(b64) / 1024:.1f} KB (png {len(data) / 1024:.1f} KB)")
