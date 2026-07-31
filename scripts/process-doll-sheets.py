#!/usr/bin/env python3
"""
处理娃娃机玩偶合集图：
- 每张 1536x1024 的合集图裁切成 3x2 网格（每格 512x512）
- 取前 5 格（对应 5 个内置玩偶），最后一格自定义跳过
- 对白底做透明抠像，输出 PNG 到 public/claw-machine-assets/dolls/
"""

from PIL import Image
import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT_DIR = os.path.join(BASE_DIR, 'generated-images', 'claw-machine', 'dolls')
OUTPUT_DIR = os.path.join(BASE_DIR, 'public', 'claw-machine-assets', 'dolls')

MACHINES = ['plush', 'figure', 'blindbox', 'block', 'doll', 'toy']


def remove_white_background(img, threshold=40, feather=True):
    """把接近白色的背景抠成透明，边缘羽化。"""
    img = img.convert('RGBA')
    width, height = img.size
    pixels = img.load()

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            # 计算与白色的距离
            dist = ((255 - r) ** 2 + (255 - g) ** 2 + (255 - b) ** 2) ** 0.5
            if dist < threshold:
                # 越接近白色越透明，实现边缘羽化
                alpha = int(255 * (dist / threshold))
                pixels[x, y] = (r, g, b, alpha)
            else:
                pixels[x, y] = (r, g, b, 255)

    return img


def process_sheet(machine_id):
    path = os.path.join(INPUT_DIR, f'{machine_id}.png')
    if not os.path.exists(path):
        print(f'Skip missing sheet: {path}')
        return

    sheet = Image.open(path)
    w, h = sheet.size
    # 期望 1536x1024；若尺寸不同按比例算
    cols = 3
    rows = 2
    cell_w = w // cols
    cell_h = h // rows

    for idx in range(5):  # 只取前 5 个内置玩偶
        col = idx % cols
        row = idx // cols
        left = col * cell_w
        upper = row * cell_h
        right = left + cell_w
        lower = upper + cell_h

        cell = sheet.crop((left, upper, right, lower))
        cell = remove_white_background(cell, threshold=45)

        out_path = os.path.join(OUTPUT_DIR, f'{machine_id}-{idx}.png')
        cell.save(out_path, 'PNG')
        print(f'Saved {out_path}')


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    for machine_id in MACHINES:
        process_sheet(machine_id)
    print('Done.')


if __name__ == '__main__':
    main()
