#!/usr/bin/env python3
"""ساخت آیکون‌های PWA از لوگوی BIG TRADER (base64 → PNG در اندازه‌های 180/192/512 + maskable)"""
import base64, io, sys
from PIL import Image

SRC = '/home/z/my-project/scripts/standalone/logo-b64.txt'
OUT = '/home/z/my-project/assets/pages/icons'

raw = open(SRC, 'r', encoding='utf-8').read().strip()
if raw.startswith('data:'):
    raw = raw.split(',', 1)[1]
img = Image.open(io.BytesIO(base64.b64decode(raw))).convert('RGBA')
print('source logo:', img.size)

def save_square(size, name, pad_ratio=0.0, bg=(10, 14, 19, 255)):
    """لوگو را در مربع با پس‌زمینه (برای maskable حاشیه امن) قرار می‌دهد"""
    canvas = Image.new('RGBA', (size, size), bg)
    inner = int(size * (1 - 2 * pad_ratio))
    logo = img.resize((inner, inner), Image.LANCZOS)
    off = (size - inner) // 2
    canvas.alpha_composite(logo, (off, off))
    canvas.save(f'{OUT}/{name}', 'PNG', optimize=True)
    print('→', name, size)

# آیکون‌های معمولی (لوگو با گوشه‌های خودش)
save_square(180, 'icon-180.png')
save_square(192, 'icon-192.png')
save_square(512, 'icon-512.png')
# maskable: ۲۰٪ حاشیه امن + پس‌زمینه پرشده
save_square(512, 'icon-512-maskable.png', pad_ratio=0.18, bg=(16, 24, 30, 255))
print('done')
