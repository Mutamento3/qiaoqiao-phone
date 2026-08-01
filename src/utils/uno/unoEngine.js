// UNO 引擎：纯逻辑（牌堆生成 / 匹配规则 / 发牌 / 洗牌 / 颜色 / 多种规则变体）
// 不依赖 Vue / Pinia，便于在 store 与 AI 中复用。

export const COLORS = ['red', 'yellow', 'green', 'blue']
// 座位标签，最多 8 人：0 固定是用户，其余按环形分布
export const SEAT_LABELS = ['南', '东南', '东', '东北', '北', '西北', '西', '西南']
export const POSITION_NAMES = ['south', 'se', 'east', 'ne', 'north', 'nw', 'west', 'sw']

export const RULE_MODES = {
    classic: { name: '经典', stacking: false, jumpIn: false, sevenO: false, dump: false },
    stacking: { name: '叠加', stacking: true, jumpIn: false, sevenO: false, dump: false },
    jumpin: { name: '抢出', stacking: false, jumpIn: true, sevenO: false, dump: false },
    seveno: { name: '七零', stacking: false, jumpIn: false, sevenO: true, dump: false },
    extreme: { name: '极限', stacking: true, jumpIn: true, sevenO: true, dump: false },
    dump: { name: '同色连出', stacking: false, jumpIn: false, sevenO: false, dump: true }
}

// 各颜色对应的展示信息（供 Vue 组件渲染卡面）
export const COLOR_META = {
    red: { name: '红', hex: '#fb7185' },
    yellow: { name: '黄', hex: '#fbbf24' },
    green: { name: '绿', hex: '#4ade80' },
    blue: { name: '蓝', hex: '#60a5fa' },
    wild: { name: '万能', hex: '#c084fc' }
}

const SYMBOLS = {
    number: (v) => String(v),
    skip: '⊘',
    reverse: '⇄',
    draw2: '+2',
    wild: '★',
    wild4: '+4'
}

const LABELS = {
    number: (v) => String(v),
    skip: '跳过',
    reverse: '反转',
    draw2: '+2',
    wild: '变色',
    wild4: '+4'
}

function makeCard(color, type, value, uid) {
    return {
        id: `c${uid}`,
        color, // 'red'|'yellow'|'green'|'blue'|'wild'
        type,  // 'number'|'skip'|'reverse'|'draw2'|'wild'|'wild4'
        value, // 仅 number 有值
        symbol: typeof SYMBOLS[type] === 'function' ? SYMBOLS[type](value) : SYMBOLS[type],
        label: typeof LABELS[type] === 'function' ? LABELS[type](value) : LABELS[type]
    }
}

// 生成标准 108 张 UNO 牌
export function createDeck() {
    const deck = []
    let uid = 0
    for (const color of COLORS) {
        deck.push(makeCard(color, 'number', 0, uid++))
        for (let v = 1; v <= 9; v++) {
            deck.push(makeCard(color, 'number', v, uid++))
            deck.push(makeCard(color, 'number', v, uid++))
        }
        for (const t of ['skip', 'reverse', 'draw2']) {
            deck.push(makeCard(color, t, null, uid++))
            deck.push(makeCard(color, t, null, uid++))
        }
    }
    for (let i = 0; i < 4; i++) {
        deck.push(makeCard('wild', 'wild', null, uid++))
        deck.push(makeCard('wild', 'wild4', null, uid++))
    }
    return deck
}

// Fisher–Yates 洗牌（返回新数组）
export function shuffle(deck) {
    const a = deck.slice()
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
}

// 判断 card 是否可打（基于当前生效颜色与弃牌堆顶牌）
export function canPlay(card, topCard, currentColor) {
    if (card.type === 'wild' || card.type === 'wild4') return true
    if (card.color === currentColor) return true
    if (!topCard) return false
    if (card.type === 'number' && topCard.type === 'number' && card.value === topCard.value) return true
    if (card.type !== 'number' && card.type === topCard.type) return true
    return false
}

// 判断抢出（jump-in）：与顶牌完全相同（颜色、类型、数字都相同）
export function canJumpIn(card, topCard) {
    if (!topCard || card.type !== topCard.type) return false
    if (card.color !== topCard.color) return false
    if (card.type === 'number' && card.value !== topCard.value) return false
    return true
}

export function getPlayableCards(hand, topCard, currentColor) {
    return hand.filter((c) => canPlay(c, topCard, currentColor))
}

// 发牌：每人 7 张；翻出第一张非万能牌作为初始弃牌堆顶
// 返回 { hands: [[],...], deck, discard, currentColor, firstCard }
export function dealInitial(deck, playerCount) {
    const d = shuffle(deck)
    const hands = Array.from({ length: playerCount }, () => [])
    let idx = 0
    for (let i = 0; i < 7; i++) {
        for (let p = 0; p < playerCount; p++) {
            hands[p].push(d[idx++])
        }
    }
    const rest = d.slice(idx)
    // 找到第一张非万能牌作为起手牌
    let firstIndex = rest.findIndex((c) => c.type !== 'wild' && c.type !== 'wild4')
    if (firstIndex === -1) firstIndex = 0
    const firstCard = rest.splice(firstIndex, 1)[0]
    const currentColor = firstCard.color === 'wild' ? COLORS[Math.floor(Math.random() * 4)] : firstCard.color
    return {
        hands,
        deck: rest,
        discard: [firstCard],
        currentColor,
        firstCard
    }
}

export function topCardOf(state) {
    return state.discard[state.discard.length - 1] || null
}

// 牌堆抽空时，把弃牌堆（除顶牌）洗回牌堆
export function reshuffleIfEmpty(state) {
    if (state.deck.length > 0) return
    const top = state.discard.pop()
    const rest = shuffle(state.discard)
    state.discard = [top]
    state.deck = rest
}

// 描述牌（供日志）
export function describeCard(card) {
    if (!card) return ''
    if (card.type === 'wild') return '变色'
    if (card.type === 'wild4') return '+4'
    const colorName = COLOR_META[card.color]?.name || ''
    return `${colorName}${card.label}`
}

// 特殊规则：7/0 交换/传递手牌
export function applySevenZero(state, card, playerIndex) {
    if (!state.rules?.sevenO) return
    if (card.type !== 'number') return
    const n = state.hands.length
    if (card.value === 7) {
        // 7：与当前 direction 的下家交换手牌
        const target = (playerIndex + state.direction + n) % n
        const tmp = state.hands[playerIndex]
        state.hands[playerIndex] = state.hands[target]
        state.hands[target] = tmp
        state.log.unshift(`🔄 ${state.playerNames?.[playerIndex] || ''} 与 ${state.playerNames?.[target] || ''} 交换手牌`)
    } else if (card.value === 0) {
        // 0：所有人按 direction 传递手牌
        const handsCopy = state.hands.slice()
        for (let i = 0; i < n; i++) {
            const from = (i - state.direction + n) % n
            state.hands[i] = handsCopy[from]
        }
        state.log.unshift(`🔄 所有人按顺序传递手牌`)
    }
}
