// UNO AI 决策：从手牌中选牌 / 选颜色。纯函数，无副作用。
import { getPlayableCards, COLORS } from './unoEngine.js'

// 选择要打出的牌；返回 card 或 null（表示需要抽牌）
// 策略：优先保留万能牌；在可打牌中优先匹配当前颜色；其次按类型权重出牌。
export function chooseCard(hand, topCard, currentColor) {
    const playable = getPlayableCards(hand, topCard, currentColor)
    if (playable.length === 0) return null

    // 非万能可打牌优先
    const nonWild = playable.filter((c) => c.type !== 'wild' && c.type !== 'wild4')
    if (nonWild.length > 0) {
        // 优先打出与当前颜色一致的（维持颜色主动权）
        const sameColor = nonWild.filter((c) => c.color === currentColor)
        if (sameColor.length > 0) {
            // 优先出功能牌（skip/reverse/draw2）以干扰对手，其次出数字牌
            const action = sameColor.find((c) => c.type !== 'number')
            return action || sameColor[0]
        }
        // 否则出任意非万能可打牌（优先功能牌）
        const action = nonWild.find((c) => c.type !== 'number')
        return action || nonWild[0]
    }

    // 只剩万能牌：尽量晚出 wild4，先出普通 wild
    const wild = playable.find((c) => c.type === 'wild')
    const wild4 = playable.find((c) => c.type === 'wild4')
    return wild || wild4
}

// 选择万能牌后的颜色：取手牌（除去刚打出的万能牌）中数量最多的颜色
export function chooseColor(handAfterWild) {
    const counts = { red: 0, yellow: 0, green: 0, blue: 0 }
    for (const c of handAfterWild) {
        if (c.color !== 'wild') counts[c.color]++
    }
    let best = 'red'
    let bestN = -1
    for (const color of COLORS) {
        if (counts[color] > bestN) {
            bestN = counts[color]
            best = color
        }
    }
    // 若手中已无彩色牌，随机选一个
    if (bestN <= 0) return COLORS[Math.floor(Math.random() * 4)]
    return best
}
