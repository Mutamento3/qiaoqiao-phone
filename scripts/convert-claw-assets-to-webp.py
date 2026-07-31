#!/usr/bin/env python3
"""把 public/claw-machine-assets 下的 PNG 转成 WebP（不删除原 PNG）。"""

from PIL import Image
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(BASE_DIR, 'public', 'claw-machine-assets')


def convert_to_webp(path, quality=85):
    out_path = path.rsplit('.', 1)[0] + '.webp'
    if os.path.exists(out_path):
        print(f'Skip existing {out_path}')
        return
    img = Image.open(path)
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    img.save(out_path, 'WEBP', quality=quality, method=6)
    print(f'Converted {path} -> {out_path}')


def main():
    for root, dirs, files in os.walk(ASSETS_DIR):
        for fname in files:
            if fname.endswith('.png'):
                convert_to_webp(os.path.join(root, fname), quality=85)
    print('All PNG assets converted to WebP.')


if __name__ == '__main__':
    main()
