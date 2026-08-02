/**
 * 帕瓦小镇道具卡系统
 * 32 张道具卡，5 大类：移动/攻击/防御/资源/特殊
 *
 * 卡牌效果由 store 的 useItemCard() 执行，
 * 这里只定义数据（id/name/desc/type/rarity/usablePhase/targetType/effect）
 *
 * effect 是一个对象，store 根据里面的 action 字段执行对应逻辑
 */

export const ITEM_CARD_TYPES = {
    move:     { name: '移动', color: '#5DADE2', icon: '🐾' },
    attack:   { name: '攻击', color: '#EC7063', icon: '💥' },
    defense:  { name: '防御', color: '#52BE80', icon: '🛡️' },
    resource: { name: '资源', color: '#F4D03F', icon: '💰' },
    special:  { name: '特殊', color: '#BB8FCE', icon: '✨' },
}

export const RARITY = {
    common: { name: '普通', color: '#ABB2B9', weight: 50 },
    rare:   { name: '稀有', color: '#5DADE2', weight: 30 },
    epic:   { name: '史诗', color: '#BB8FCE', weight: 15 },
    legend: { name: '传说', color: '#F4D03F', weight: 5 },
}

export const ITEM_CARDS = [
    // ===== 移动类（8 张）=====
    {
        id: 'remote_dice', name: '遥控骰子', desc: '本回合指定掷出 1-6 点',
        type: 'move', rarity: 'rare', usablePhase: ['rolling'],
        targetType: 'self',
        effect: { action: 'forceDice' },
    },
    {
        id: 'teleport', name: '传送卷轴', desc: '飞到棋盘上任意一个位置',
        type: 'move', rarity: 'epic', usablePhase: ['action'],
        targetType: 'tile',
        effect: { action: 'teleportTo' },
    },
    {
        id: 'backtrack', name: '回溯爪印', desc: '后退 2-5 格',
        type: 'move', rarity: 'common', usablePhase: ['action'],
        targetType: 'self',
        effect: { action: 'moveBack', min: 2, max: 5 },
    },
    {
        id: 'spring_shoes', name: '弹簧鞋', desc: '本回合额外多掷一次骰子',
        type: 'move', rarity: 'rare', usablePhase: ['action'],
        targetType: 'self',
        effect: { action: 'extraRoll' },
    },
    {
        id: 'skateboard', name: '滑板车', desc: '下次移动步数 +2',
        type: 'move', rarity: 'common', usablePhase: ['rolling', 'action'],
        targetType: 'self',
        effect: { action: 'moveBonus', steps: 2 },
    },
    {
        id: 'invisibility', name: '隐形斗篷', desc: '本次经过别人地产不付租金',
        type: 'move', rarity: 'rare', usablePhase: ['rolling'],
        targetType: 'self',
        effect: { action: 'noRentThisTurn' },
    },
    {
        id: 'free_ride', name: '顺风车', desc: '前进到下一个车站',
        type: 'move', rarity: 'common', usablePhase: ['action'],
        targetType: 'self',
        effect: { action: 'goToNextStation' },
    },
    {
        id: 'shortcut', name: '秘密小路', desc: '直接移动到最近的机会格',
        type: 'move', rarity: 'common', usablePhase: ['action'],
        targetType: 'self',
        effect: { action: 'goToNextChance' },
    },

    // ===== 攻击类（8 张）=====
    {
        id: 'banana_peel', name: '香蕉皮', desc: '指定玩家下回合只能走 1-3 格',
        type: 'attack', rarity: 'common', usablePhase: ['action'],
        targetType: 'player',
        effect: { action: 'limitMove', min: 1, max: 3 },
    },
    {
        id: 'steal_paw', name: '偷钱小爪', desc: '从指定玩家处偷 ¥50',
        type: 'attack', rarity: 'common', usablePhase: ['action'],
        targetType: 'player',
        effect: { action: 'stealCash', amount: 50 },
    },
    {
        id: 'demolish_hammer', name: '拆房锤', desc: '拆除指定地产 1 级房屋',
        type: 'attack', rarity: 'rare', usablePhase: ['action'],
        targetType: 'tile_owned_by_others',
        effect: { action: 'demolishHouse' },
    },
    {
        id: 'prank_spray', name: '捣蛋喷雾', desc: '指定玩家本回合不能盖房',
        type: 'attack', rarity: 'common', usablePhase: ['action'],
        targetType: 'player',
        effect: { action: 'blockBuild' },
    },
    {
        id: 'rent_double', name: '租金翻倍卡', desc: '下次收租时租金翻倍',
        type: 'attack', rarity: 'rare', usablePhase: ['action'],
        targetType: 'self',
        effect: { action: 'doubleRentNext' },
    },
    {
        id: 'forced_trade', name: '强制交易卡', desc: '用等额现金强制交换一处地产',
        type: 'attack', rarity: 'epic', usablePhase: ['action'],
        targetType: 'tile_owned_by_others',
        effect: { action: 'forcedTrade' },
    },
    {
        id: 'fog_bomb', name: '迷雾弹', desc: '指定玩家下回合无法使用道具卡',
        type: 'attack', rarity: 'rare', usablePhase: ['action'],
        targetType: 'player',
        effect: { action: 'blockCards' },
    },
    {
        id: 'trap_card', name: '陷阱卡', desc: '在指定地产设陷阱，下位停留者扣 ¥80',
        type: 'attack', rarity: 'common', usablePhase: ['action'],
        targetType: 'tile',
        effect: { action: 'setTrap', amount: 80 },
    },

    // ===== 防御类（6 张）=====
    {
        id: 'shield', name: '护盾', desc: '免疫下一次租金',
        type: 'defense', rarity: 'rare', usablePhase: ['action'],
        targetType: 'self',
        effect: { action: 'shieldRent' },
    },
    {
        id: 'cute_card', name: '撒娇卡', desc: '本回合租金减半',
        type: 'defense', rarity: 'common', usablePhase: ['action'],
        targetType: 'self',
        effect: { action: 'halfRent' },
    },
    {
        id: 'immunity', name: '免罪金牌', desc: '免疫一次入狱',
        type: 'defense', rarity: 'rare', usablePhase: ['rolling'],
        targetType: 'self',
        effect: { action: 'immunityJail' },
    },
    {
        id: 'insurance', name: '保险金', desc: '被收租时返还 50%',
        type: 'defense', rarity: 'common', usablePhase: ['action'],
        targetType: 'self',
        effect: { action: 'rentInsurance' },
    },
    {
        id: 'friendship', name: '友谊条约', desc: '指定玩家 2 回合内不能向你收租',
        type: 'defense', rarity: 'rare', usablePhase: ['action'],
        targetType: 'player',
        effect: { action: 'friendshipTreaty', turns: 2 },
    },
    {
        id: 'counter_claw', name: '反击爪', desc: '被收租时反弹 30% 给对方',
        type: 'defense', rarity: 'rare', usablePhase: ['action'],
        targetType: 'self',
        effect: { action: 'counterClaw', percent: 0.3 },
    },

    // ===== 资源类（6 张）=====
    {
        id: 'gold_can', name: '金罐头', desc: '立即获得 ¥100',
        type: 'resource', rarity: 'common', usablePhase: ['rolling', 'action'],
        targetType: 'self',
        effect: { action: 'addCash', amount: 100 },
    },
    {
        id: 'fish_gift', name: '鱼干大礼包', desc: '立即获得 ¥200',
        type: 'resource', rarity: 'rare', usablePhase: ['rolling', 'action'],
        targetType: 'self',
        effect: { action: 'addCash', amount: 200 },
    },
    {
        id: 'loan', name: '贷款合同', desc: '立即获得 ¥300，之后 3 回合每回合扣 ¥50',
        type: 'resource', rarity: 'common', usablePhase: ['rolling', 'action'],
        targetType: 'self',
        effect: { action: 'loan', amount: 300, perTurn: 50, turns: 3 },
    },
    {
        id: 'lottery', name: '彩票', desc: '50% 获得 ¥150，50% 失去 ¥50',
        type: 'resource', rarity: 'common', usablePhase: ['rolling', 'action'],
        targetType: 'self',
        effect: { action: 'lottery', win: 150, lose: 50 },
    },
    {
        id: 'dividend', name: '投资分红', desc: '立即获得所有自有地产租金总和的 50%',
        type: 'resource', rarity: 'rare', usablePhase: ['action'],
        targetType: 'self',
        effect: { action: 'dividend' },
    },
    {
        id: 'emergency_piggy', name: '紧急存钱罐', desc: '破产时自动触发，获得 ¥300（被动卡）',
        type: 'resource', rarity: 'rare', usablePhase: ['passive'],
        targetType: 'self',
        effect: { action: 'emergencySave', amount: 300 },
    },

    // ===== 特殊类（4 张）=====
    {
        id: 'swap_deed', name: '换房卡', desc: '和一名玩家交换一处地产',
        type: 'special', rarity: 'epic', usablePhase: ['action'],
        targetType: 'player',
        effect: { action: 'swapProperty' },
    },
    {
        id: 'freeze', name: '冻结卡', desc: '冻结某地产 1 回合，期间不收租',
        type: 'special', rarity: 'rare', usablePhase: ['action'],
        targetType: 'tile_owned_by_self',
        effect: { action: 'freezeProperty', turns: 1 },
    },
    {
        id: 'copy_cat', name: '复制猫', desc: '复制上一张使用过的道具卡效果',
        type: 'special', rarity: 'epic', usablePhase: ['action'],
        targetType: 'self',
        effect: { action: 'copyLastCard' },
    },
    {
        id: 'wishing_star', name: '许愿星', desc: '随机获得 1 张稀有以上道具卡',
        type: 'special', rarity: 'legend', usablePhase: ['action'],
        targetType: 'self',
        effect: { action: 'wishCard' },
    },
]

// 卡牌 id → 数据
export const ITEM_CARD_MAP = Object.fromEntries(ITEM_CARDS.map(c => [c.id, c]))

// 按 id 查卡
export function getItemCard(id) {
    return ITEM_CARD_MAP[id] || null
}

// 随机抽卡（按稀有度权重）
export function drawRandomCard() {
    const weighted = []
    for (const card of ITEM_CARDS) {
        const weight = RARITY[card.rarity]?.weight || 50
        for (let i = 0; i < weight; i++) weighted.push(card)
    }
    return weighted[Math.floor(Math.random() * weighted.length)]
}

// 抽 N 张不重复的卡
export function drawCards(n) {
    const pool = ITEM_CARDS.slice()
    const result = []
    for (let i = 0; i < n && pool.length > 0; i++) {
        const idx = Math.floor(Math.random() * pool.length)
        result.push(pool[idx])
        pool.splice(idx, 1)
    }
    return result
}
