/**
 * Pure local OCR service based on Tesseract.js (WebAssembly, 离线可用).
 * 不消耗任何 API 次数, 首次加载时从 CDN 下载库和中文模型, 之后走缓存.
 *
 * 依赖: tesseract.js (通过 CDN 动态加载, 不打包进主 bundle)
 * 模型: chi_sim (简体中文) + eng (英文, 兜底)
 */

// CDN 地址 (jsdelivr, 国内访问相对稳定)
const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/tesseract.min.js'
const MODEL_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.0/wasm'

let tesseractPromise = null // 缓存加载 Promise, 避免重复加载

/**
 * 懒加载 Tesseract.js UMD 脚本 + 初始化 Worker
 * @returns {Promise<{recognize: Function, terminate: Function}>}
 */
async function loadTesseract() {
    if (tesseractPromise) return tesseractPromise

    tesseractPromise = (async () => {
        // 1. 动态注入 <script> 加载 tesseract.js UMD 包
        if (!window.Tesseract) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script')
                script.src = TESSERACT_CDN
                script.async = true
                script.onload = resolve
                script.onerror = () => reject(new Error('[Tesseract] 加载 CDN 脚本失败'))
                document.head.appendChild(script)
            })
        }

        const Tesseract = window.Tesseract
        if (!Tesseract) {
            throw new Error('[Tesseract] window.Tesseract 未定义')
        }

        // 2. 创建 Worker (指定 CDN 路径, 这样模型和 wasm 也从 CDN 加载)
        //    langPath 指向模型文件目录, 下载后会被 Tesseract 自动缓存到 IndexedDB
        const worker = await Tesseract.createWorker('chi_sim+eng', 1, {
            langPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0',
            corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.0/tesseract-core-simd.js',
            logger: m => {
                if (m.status === 'recognizing text') {
                    // console.log('[Tesseract] progress:', Math.round(m.progress * 100) + '%')
                }
            },
        })

        return {
            recognize: async (imageDataUrl) => {
                const { data } = await worker.recognize(imageDataUrl)
                return data?.text || ''
            },
            terminate: () => worker.terminate(),
        }
    })()

    return tesseractPromise
}

/**
 * 重置加载缓存 (用于重新加载 / 清理)
 */
export function resetTesseract() {
    tesseractPromise = null
}

/**
 * 本地 OCR: 识别图片上的文字 (不消耗任何外部 API)
 * @param {string} imageDataUrl - data URL (支持 data:image/...)
 * @returns {Promise<{ text: string, progress?: string }>} 
 *          text: 清理后的识别结果 (限 30 字)
 */
export async function recognizeTextLocal(imageDataUrl) {
    try {
        const tess = await loadTesseract()
        const rawText = await tess.recognize(imageDataUrl)

        // 清理: 去换行/多余空白/标点干扰, 限 30 字
        const cleaned = rawText
            .replace(/\n+/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/[,.。，!！?？、:：;；"'']/g, '')
            .replace(/[|丨]/g, '')
            .trim()
            .slice(0, 30)

        console.log('[Tesseract OCR] recognized:', cleaned || '(empty)')
        return { text: cleaned }
    } catch (e) {
        console.error('[Tesseract OCR] failed:', e)
        return { text: '', error: e.message || String(e) }
    }
}

/**
 * 预热: 提前下载模型 (用户首次点 OCR 才触发, 或设置页主动触发)
 * 不阻塞, 后台静默加载
 */
export function preloadTesseract() {
    loadTesseract().catch(() => {})
}
