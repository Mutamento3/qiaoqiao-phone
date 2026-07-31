/**
 * 白底图自动抠像工具
 * 使用 Canvas 色差法：检测白色/接近白色的像素并设为透明
 * 适用于白底产品图/玩偶图
 */

/**
 * 对白底图进行抠像，生成透明背景 PNG
 * @param {string} dataUrl - 原图 base64 data URL
 * @param {Object} options - 配置
 * @param {number} [options.threshold=230] - 白色判定阈值 (0-255)，越大越严格
 * @param {number} [options.feather=2] - 边缘羽化范围（像素），抗锯齿
 * @param {number} [options.maxSize=300] - 输出最大尺寸（像素）
 * @returns {Promise<string>} 透明背景 PNG data URL
 */
export function removeWhiteBackground(dataUrl, options = {}) {
    const { threshold = 230, feather = 2, maxSize = 300 } = options

    return new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
            try {
                // 缩放到合理尺寸
                let w = img.width
                let h = img.height
                if (w > maxSize || h > maxSize) {
                    const scale = maxSize / Math.max(w, h)
                    w = Math.round(w * scale)
                    h = Math.round(h * scale)
                }

                const canvas = document.createElement('canvas')
                canvas.width = w
                canvas.height = h
                const ctx = canvas.getContext('2d')
                ctx.drawImage(img, 0, 0, w, h)

                const imageData = ctx.getImageData(0, 0, w, h)
                const data = imageData.data

                // 1. 检测白色背景像素并设为透明
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i]
                    const g = data[i + 1]
                    const b = data[i + 2]

                    // 计算像素的"白度"：RGB 三通道都高才算白
                    const whiteness = (r + g + b) / 3
                    const maxChannel = Math.max(r, g, b)
                    const minChannel = Math.min(r, g, b)

                    // 如果三通道都高于阈值且差异不大（排除高饱和度亮色）
                    if (minChannel > threshold && (maxChannel - minChannel) < 30) {
                        // 完全白色 -> 透明
                        data[i + 3] = 0
                    } else if (whiteness > threshold - feather * 10) {
                        // 过渡区域 -> 半透明（羽化抗锯齿）
                        const alpha = Math.max(0, Math.min(255,
                            Math.round((255 - whiteness) / (feather * 10) * 255)
                        ))
                        data[i + 3] = Math.min(data[i + 3], alpha)
                    }
                }

                ctx.putImageData(imageData, 0, 0)

                // 2. 输出为 PNG（保留透明通道）
                const result = canvas.toDataURL('image/png')
                resolve(result)
            } catch (e) {
                reject(new Error('抠像处理失败: ' + e.message))
            }
        }
        img.onerror = () => reject(new Error('图片加载失败，无法抠像'))
        img.src = dataUrl
    })
}

/**
 * 检测图片是否为白底图（用于提示用户）
 * @param {string} dataUrl - 图片 data URL
 * @returns {Promise<boolean>} 是否为白底图
 */
export async function isWhiteBackgroundImage(dataUrl) {
    return new Promise((resolve) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas')
                const size = 50 // 采样尺寸
                canvas.width = size
                canvas.height = size
                const ctx = canvas.getContext('2d')
                ctx.drawImage(img, 0, 0, size, size)
                const data = ctx.getImageData(0, 0, size, size).data

                // 采样四角像素判断是否为白底
                const corners = [
                    [0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1],
                ]
                let whiteCount = 0
                for (const [x, y] of corners) {
                    const idx = (y * size + x) * 4
                    const avg = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
                    if (avg > 220) whiteCount++
                }
                resolve(whiteCount >= 3) // 4角中至少3角为白
            } catch {
                resolve(false)
            }
        }
        img.onerror = () => resolve(false)
        img.src = dataUrl
    })
}
