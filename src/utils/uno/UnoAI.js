// UNO AI 决策：从手牌中选牌 / 选颜色。纯函数，无副作用。
// 增加上下文对象，让 AI 能按角色性格、人际关系、局势做决策。
import { getPlayableCards, COLORS, canPlay, topCardOf } from './unoEngine.js'

const RELATION_WEIGHTS = {
    lover: { help: 1.0, hinder: -0.8, protect: 0.9 },
    friend: { help: 0.5, hinder: -0.3, protect: 0.4 },
    neutral: { help: 0, hinder: 0, protect: 0 },
    rival: { help: -0.6, hinder: 0.9, protect: -0.4 },
    enemy: { help: -0.9, hinder: 1.0, protect: -0.8 }
}

// 从角色人设/关系字符串推断关系类型
export function inferRelationship(persona = '', userPersona = '') {
    const text = (persona + ' ' + userPersona).toLowerCase()
    if (/恋|爱|女朋|男朋|宝贝|老公|老婆|亲密|喜欢/.test(text)) return 'lover'
    if (/敌|仇|恨|杀|讨厌|竞争|对手|宿敌/.test(text)) return 'enemy'
    if (/对手|竞争|挑衅|傲/.test(text)) return 'rival'
    if (/友|朋|闺蜜|兄弟|哥|姐|亲切|温柔/.test(text)) return 'friend'
    return 'neutral'
}

// 简单的性格标签推断
export function inferTraits(persona = '') {
    const text = persona.toLowerCase()
    return {
        aggressive: /凶|狠|傲|狂|霸道|挑衅|竞争/.test(text),
        gentle: /温柔|体贴|软|萌|甜|乖/.test(text),
        tricky: /调皮|捣蛋|鬼|狡|诈|皮/.test(text),
        calm: /冷|静|理性|沉稳/.test(text)
    }
}

// 选择要打出的牌；返回 card 或 null（表示需要抽牌）
// context 包含：
//   currentPlayerIndex, players[], handsLengths[], direction,
//   nextPlayerIndex, nextIsUser, userIndex,
//   relationships: { playerIndex -> 'lover'|'friend'|'neutral'|'rival'|'enemy' }
//   personas: { playerIndex -> string }
export function chooseCard(hand, topCard, currentColor, context = {}) {
    const playable = getPlayableCards(hand, topCard, currentColor)
    if (playable.length === 0) return null

    const me = context.currentPlayerIndex ?? 0
    const relation = context.relationships?.[me] || 'neutral'
    const traits = inferTraits(context.personas?.[me] || '')
    const weights = RELATION_WEIGHTS[relation] || RELATION_WEIGHTS.neutral
    const nextIsUser = context.nextIsUser || false
    const nextIdx = context.nextPlayerIndex ?? -1
    const nextHandLen = context.handsLengths?.[nextIdx] ?? 99

    // 计分手：越高的分越想打
    const scoreCard = (card) => {
        let score = 0
        const isWild = card.type === 'wild' || card.type === 'wild4'

        // 基础：万能牌留到后面
        if (isWild) score -= 30
        if (card.type === 'wild4') score -= 10

        // 基础：优先与当前颜色一致（保持颜色主动权）
        if (card.color === currentColor) score += 15

        // 基础：功能牌优先
        if (card.type === 'skip' || card.type === 'reverse' || card.type === 'draw2') score += 8
        // 基础：手牌少时多打分高的功能牌
        if (hand.length <= 3) score += 12

        // 人际关系影响
        if (nextIsUser) {
            // 下家是用户：
            if (card.type === 'skip' || card.type === 'draw2' || card.type === 'wild4') {
                score += weights.hinder * 25 // 对手爱坑，恋人舍不得
            }
            if (card.type === 'reverse') {
                // 反转会让另一家接，复杂化；对手可能用来坑另一家，恋人用来避免坑用户
                score += weights.hinder * 10
            }
        }

        // 用户快赢（剩 1-2 张）时的反应
        const userIdx = context.userIndex ?? 0
        const userHandLen = context.handsLengths?.[userIdx] ?? 99
        if (userHandLen <= 2) {
            if (relation === 'lover' || relation === 'friend') {
                // 帮用户：尽量不打干扰牌，让用户有机会出
                if (card.type === 'skip' || card.type === 'draw2' || card.type === 'wild4') score -= 40
                // 甚至会主动改颜色成用户可能有的颜色（下面颜色选择处理）
            } else if (relation === 'rival' || relation === 'enemy') {
                // 坑用户：狠狠打
                if (card.type === 'skip' || card.type === 'draw2' || card.type === 'wild4') score += 40
            }
        }

        // 自己快赢：优先能出完的牌
        if (hand.length <= 2) {
            score += 50
            // 剩一张时万能牌也能出
            if (isWild) score += 60
        }

        // 性格
        if (traits.aggressive) {
            if (card.type === 'skip' || card.type === 'draw2' || card.type === 'wild4') score += 12
        }
        if (traits.gentle) {
            if (card.type === 'skip' || card.type === 'draw2' || card.type === 'wild4') score -= 12
        }
        if (traits.tricky) {
            // 搞怪型：更爱在还有牌时出万能牌整活
            if (isWild && hand.length > 2) score += 25
        }
        if (traits.calm) {
            // 冷静型：优先数字牌保留功能牌
            if (card.type === 'number') score += 8
        }

        // 下家牌很少时，少出 skip/+2 避免直接送赢？实际应该更针对
        if (nextHandLen <= 2) {
            score += 10
        }

        return score
    }

    playable.sort((a, b) => scoreCard(b) - scoreCard(a))
    return playable[0]
}

// 选择万能牌后的颜色：取手牌（除去刚打出的万能牌）中数量最多的颜色，
// 并结合人际关系（用户快赢时尽量改到用户可能有的颜色）
export function chooseColor(handAfterWild, context = {}) {
    const counts = { red: 0, yellow: 0, green: 0, blue: 0 }
    for (const c of handAfterWild) {
        if (c.color !== 'wild') counts[c.color]++
    }

    let best = 'red'
    let bestN = -1

    const me = context.currentPlayerIndex ?? 0
    const relation = context.relationships?.[me] || 'neutral'
    const userIdx = context.userIndex ?? 0
    const userHandLen = context.handsLengths?.[userIdx] ?? 99

    for (const color of COLORS) {
        let score = counts[color]
        // 用户快赢且关系好时，倾向于选用户喜欢的颜色（这里简化为随机但加权）
        if (userHandLen <= 2 && (relation === 'lover' || relation === 'friend')) {
            score += Math.random() * 3
        }
        if (score > bestN) {
            bestN = score
            best = color
        }
    }

    // 若手中已无彩色牌，随机选一个
    if (bestN <= 0) return COLORS[Math.floor(Math.random() * 4)]
    return best
}

// 是否喊 UNO：AI 默认总是喊；搞怪型偶尔不喊（被抓）
export function shouldCallUno(context = {}) {
    const me = context.currentPlayerIndex ?? 0
    const traits = inferTraits(context.personas?.[me] || '')
    if (traits.tricky && Math.random() < 0.15) return false
    return true
}

// 抢出模式：判断 AI 是否要抢出
export function shouldJumpIn(hand, topCard, context = {}) {
    if (!topCard) return null
    const candidates = hand.filter((c) => c.color === topCard.color && c.type === topCard.type && (c.type !== 'number' || c.value === topCard.value))
    if (candidates.length === 0) return null
    // 简单策略：有就抢，优先功能牌
    const action = candidates.find((c) => c.type !== 'number')
    return action || candidates[0]
}
