#!/usr/bin/env python3
"""压缩娃娃机图片资源，减小 PWA/移动加载体积。"""

from PIL import Image
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(BASE_DIR, 'public', 'claw-machine-assets')


def optimize_image(path, max_size):
    img = Image.open(path)
    img = img.convert('RGBA')

    # 等比缩放
    w, h = img.size
    if max(w, h) > max_size:
        ratio = max_size / max(w, h)
        new_size = (int(w * ratio), int(h * ratio))
        img = img.resize(new_size, Image.LANCZOS)

    # 保存为优化 PNG
    img.save(path, 'PNG', optimize=True)
    print(f'Optimized {path} -> {img.size}')


def main():
    machines_dir = os.path.join(ASSETS_DIR, 'machines')
    dolls_dir = os.path.join(ASSETS_DIR, 'dolls')

    for fname in os.listdir(machines_dir):
        if fname.endswith('.png'):
            optimize_image(os.path.join(machines_dir, fname), max_size=768)

    for fname in os.listdir(dolls_dir):
        if fname.endswith('.png'):
            optimize_image(os.path.join(dolls_dir, fname), max_size=256)

    print('All assets optimized.')


if __name__ == '__main__':
    main()
