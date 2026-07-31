/**
 * 娃娃机概率与物理判定引擎
 * 负责玩偶布局生成、抓取概率计算、结果判定
 */

/**
 * 生成娃娃机内部玩偶布局
 * 使用 2 行网格排列，前排大、后排小，避免重叠乱放
 * @param {Array} dolls - 玩偶数组（来自 clawMachinesData.getMachineDolls）
 * @param {number} count - 布局玩偶数量（默认 12）
 * @returns {Array} 布局数组 [{ id, dollId, name, image, x, y, rotation, scale, zIndex }]
 */
export function generateDollLayout(dolls, count = 12) {
    const layout = []
    const usableDolls = dolls.filter(d => d.image) // 排除没贴图的
    if (usableDolls.length === 0) return layout

    // 玻璃罩内部有效区域（百分比坐标）
    // 背景图顶部被裁剪 22% 后，玻璃罩底部约在容器 80% 处
    const AREA = {
        xMin: 26,
        xMax: 74,
        backY: 64, // 后排 y 基准
        frontY: 74, // 前排 y 基准
    }

    // 每行固定 6 列，均匀分布
    const COLS = 6
    const xStep = (AREA.xMax - AREA.xMin) / (COLS - 1)

    for (let i = 0; i < count; i++) {
        const doll = usableDolls[i % usableDolls.length]
        const isFront = i < 6 // 前排 6 个，后排 6 个
        const col = i % 6

        // 基础列位置
        const baseX = AREA.xMin + col * xStep
        const baseY = isFront ? AREA.frontY : AREA.backY

        // 轻微随机抖动，避免呆板
        const x = baseX + (Math.random() - 0.5) * 3
        const y = baseY + (Math.random() - 0.5) * 2.5

        // 透视：前排大、后排小
        const scale = isFront ? 0.95 + Math.random() * 0.2 : 0.72 + Math.random() * 0.12

        layout.push({
            layoutId: `layout-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            dollId: doll.id,
            name: doll.name,
            image: doll.image,
            x,
            y,
            rotation: (Math.random() - 0.5) * 12, // -6 ~ +6 度
            scale,
            zIndex: 0,
        })
    }

    // 按 y 排序，y 大的（前排）zIndex 高，压在后排上面
    layout.sort((a, b) => b.y - a.y)
    layout.forEach((d, i) => { d.zIndex = i + 10 })

    return layout
}

/**
 * 计算抓取概率
 * @param {Object} config
 * @param {string} config.mode - 'self' | 'ai'
 * @param {number} config.baseRate - 基础概率 (0-1)
 * @param {number} config.alignment - 爪子与最近玩偶的对齐度 (0-1)，1=完美对准
 * @param {number} config.aiSkill - AI技能等级 (0-1)，仅 ai 模式
 * @param {number} config.luckBonus - 运气加成 (0-0.3)
 * @returns {number} 最终概率 (0-1)
 */
export function calculateGrabProbability(config) {
    const {
        mode = 'self',
        baseRate = 0.3,
        alignment = 0.5,
        aiSkill = 0.5,
        luckBonus = 0,
    } = config

    let probability = baseRate

    if (mode === 'self') {
        // 自己玩：对齐度影响大（对准就有大概率抓到）
        probability += alignment * 0.5
    } else {
        // AI玩：技能等级影响
        probability += aiSkill * 0.2
    }

    // 运气加成
    probability += luckBonus

    // 限制在合理范围
    return Math.max(0.05, Math.min(0.85, probability))
}

/**
 * 判定抓取结果
 * @param {number} probability - 概率 (0-1)
 * @returns {boolean} 是否抓中
 */
export function determineGrabResult(probability) {
    return Math.random() < probability
}

/**
 * 根据爪子位置找到最近的玩偶
 * 水平对齐权重更高（用户只能左右移动爪子）
 * @param {Array} layout - 玩偶布局
 * @param {number} clawX - 爪子 x 位置 (0-100)
 * @param {number} clawY - 爪子 y 位置 (0-100)
 * @returns {Object|null} 最近的玩偶 + 对齐度
 */
export function findNearestDoll(layout, clawX, clawY) {
    if (!layout || layout.length === 0) return null

    let nearest = null
    let minDist = Infinity

    for (const doll of layout) {
        const dx = doll.x - clawX
        const dy = doll.y - clawY
        // 水平权重 1.5，让用户左右对准更容易感知
        const dist = Math.sqrt(dx * dx * 1.5 + dy * dy)
        if (dist < minDist) {
            minDist = dist
            nearest = doll
        }
    }

    if (!nearest) return null

    // 对齐度：爪子与玩偶的距离
    // 距离=0 时 alignment=1，距离>=15% 容器宽度时 alignment=0
    // 列间距约 9.6%，15% 半径保证对准列即可抓到，稍偏也有机会
    const catchRadius = 15
    const alignment = Math.max(0, 1 - minDist / catchRadius)

    return { doll: nearest, alignment, distance: minDist }
}

/**
 * AI 操作序列模拟
 * 生成 AI 角色的操作过程（移动路径 + 下勾时机）
 * @param {Object} config
 * @param {number} config.targetX - 目标 x 位置 (0-100)
 * @param {number} config.startX - 起始 x 位置 (0-100)
 * @param {number} config.aiSkill - AI技能 (0-1)
 * @param {number} config.speed - 操作速度倍率 (1=正常)
 * @returns {Array} 操作步骤序列 [{ type, x, duration }]
 */
export function simulateAIOperation(config) {
    const {
        targetX = 50,
        startX = 50,
        aiSkill = 0.5,
        speed = 1,
    } = config

    const steps = []
    let currentX = startX

    // AI 技能越高，操作越精准（少抖动）
    const jitterAmount = (1 - aiSkill) * 8 // 技能低=抖动大
    const stepCount = 3 + Math.floor((1 - aiSkill) * 4) // 技能低=步骤多

    // 玻璃罩内有效水平范围
    const X_MIN = 22
    const X_MAX = 78

    // 模拟 AI 移动过程
    for (let i = 0; i < stepCount; i++) {
        const progress = (i + 1) / stepCount
        const targetAtStep = startX + (targetX - startX) * progress
        // 加入抖动
        const jitter = (Math.random() - 0.5) * jitterAmount * (1 - progress)
        currentX = targetAtStep + jitter

        steps.push({
            type: 'move',
            x: Math.max(X_MIN, Math.min(X_MAX, currentX)),
            duration: (400 + Math.random() * 300) / speed,
        })
    }

    // 最终位置（AI 技能影响精准度）
    const finalError = (1 - aiSkill) * (Math.random() - 0.5) * 8
    steps.push({
        type: 'move',
        x: Math.max(X_MIN, Math.min(X_MAX, targetX + finalError)),
        duration: 300 / speed,
    })

    // 下勾
    steps.push({
        type: 'drop',
        x: steps[steps.length - 1].x,
        duration: 800 / speed,
    })

    return steps
}

/**
 * 生成一次完整的抓取结果
 * @param {Object} config
 * @param {Array} config.layout - 玩偶布局
 * @param {number} config.clawX - 爪子x位置
 * @param {number} config.clawY - 爪子y位置
 * @param {string} config.mode - 'self'|'ai'
 * @param {number} config.baseRate - 基础概率
 * @param {number} config.aiSkill - AI技能
 * @returns {Object} { success, doll, probability, alignment }
 */
export function resolveGrab(config) {
    const {
        layout = [],
        clawX = 50,
        clawY = 70,
        mode = 'self',
        baseRate = 0.3,
        aiSkill = 0.5,
    } = config

    const nearest = findNearestDoll(layout, clawX, clawY)

    if (!nearest) {
        return { success: false, doll: null, probability: 0, alignment: 0 }
    }

    const probability = calculateGrabProbability({
        mode,
        baseRate,
        alignment: nearest.alignment,
        aiSkill,
        luckBonus: Math.random() * 0.1, // 随机运气
    })

    const success = determineGrabResult(probability)

    return {
        success,
        doll: success ? nearest.doll : null,
        probability,
        alignment: nearest.alignment,
    }
}
