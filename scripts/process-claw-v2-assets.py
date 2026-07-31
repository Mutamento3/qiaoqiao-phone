from PIL import Image
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def remove_white_bg(img, threshold=240):
    """把接近白色的背景变成透明，保留阴影渐变"""
    img = img.convert('RGBA')
    data = img.getdata()
    new_data = []
    for r, g, b, a in data:
        # 亮度高于阈值且原图不透明的像素设为透明
        if r > threshold and g > threshold and b > threshold and a > 0:
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append((r, g, b, a))
    img.putdata(new_data)
    return img

def process_claw():
    src = os.path.join(ROOT, 'public/claw-machine-assets/claw/claw_raw.png')
    out = os.path.join(ROOT, 'public/claw-machine-assets/claw/claw.webp')
    img = Image.open(src)
    # 先缩放到合适大小
    img = img.resize((256, 256), Image.LANCZOS)
    img = remove_white_bg(img, threshold=230)
    # 裁掉底部有水印的区域（约8%）
    w, h = img.size
    crop_h = int(h * 0.92)
    img = img.crop((0, 0, w, crop_h))
    img.save(out, 'WEBP', quality=90, method=6)
    print('claw ->', out, img.size)

def process_machines():
    machines_dir = os.path.join(ROOT, 'public/claw-machine-assets/machines-v2')
    for name in ['plush', 'figure', 'blindbox', 'block', 'doll', 'toy']:
        src = os.path.join(machines_dir, f'{name}.png')
        out = os.path.join(machines_dir, f'{name}.webp')
        img = Image.open(src)
        # 机台图缩到 768 高度（足够清晰且体积小）
        ratio = 768 / img.height
        new_size = (int(img.width * ratio), 768)
        img = img.resize(new_size, Image.LANCZOS)
        img.save(out, 'WEBP', quality=85, method=6)
        print(f'{name} ->', out, img.size)

if __name__ == '__main__':
    process_claw()
    process_machines()
    print('done')
