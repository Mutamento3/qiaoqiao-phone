/**
 * 大富翁棋盘数据（40 格经典布局，中文命名）
 *
 * type:
 *   go       起点（路过/停留发工资）
 *   property 地产（可买、可盖房、收租）
 *   station  车站（租金随持有数量递增）
 *   utility  公共事业（电费/水费，租金随骰子或持有数）
 *   chance   机会卡
 *   chest    命运卡
 *   tax      税收
 *   jail     监狱（仅路过=探监）
 *   gotojail 进监狱
 *   parking  免费停车
 *
 * 租金采用公式化计算（避免 22 张手填表）：
 *   基础租金 baseRent = round(price * 0.08)
 *   若地主持有整组（垄断）：租金 × 2
 *   若盖房 h 栋(1~5，5=旅馆)：rent = round(baseRent * (1 + 0.6*h) * (垄断?2:1))
 *   车站：rent = 25 * 2^(持有车站数-1)  → 25/50/100/200
 *   公共：持有 1 → 骰子总和 * 4；持有 2 → 骰子总和 * 10
 */

export const GROUPS = {
    brown: { name: '棕巷', color: '#8B5A2B' },
    lightblue: { name: '浅蓝湾', color: '#38BDF8' },
    pink: { name: '粉樱', color: '#F472B6' },
    orange: { name: '橙野', color: '#FB923C' },
    red: { name: '红枫', color: '#EF4444' },
    yellow: { name: '金滩', color: '#FACC15' },
    green: { name: '翠林', color: '#22C55E' },
    darkblue: { name: '深蓝港', color: '#3B82F6' },
    station: { name: '车站', color: '#64748B' },
    utility: { name: '公共', color: '#A855F7' },
}

// 棋盘顺时针：起点(0) 在左上角，沿上边向右 → 右边向下 → 下边向左 → 左边向上
export const BOARD = [
    { id: 0, type: 'go', name: '起点' },
    { id: 1, type: 'property', name: '北海道', group: 'brown', price: 60 },
    { id: 2, type: 'chance', name: '机会' },
    { id: 3, type: 'property', name: '青森', group: 'brown', price: 60 },
    { id: 4, type: 'tax', name: '所得税', amount: 200 },
    { id: 5, type: 'station', name: '东京站', price: 200 },
    { id: 6, type: 'property', name: '千叶', group: 'lightblue', price: 100 },
    { id: 7, type: 'chest', name: '命运' },
    { id: 8, type: 'property', name: '埼玉', group: 'lightblue', price: 100 },
    { id: 9, type: 'property', name: '横滨', group: 'lightblue', price: 120 },
    { id: 10, type: 'jail', name: '监狱' },
    { id: 11, type: 'property', name: '名古屋', group: 'pink', price: 140 },
    { id: 12, type: 'utility', name: '电力公司', price: 150 },
    { id: 13, type: 'property', name: '京都', group: 'pink', price: 140 },
    { id: 14, type: 'property', name: '大阪', group: 'pink', price: 160 },
    { id: 15, type: 'station', name: '大阪站', price: 200 },
    { id: 16, type: 'property', name: '神户', group: 'orange', price: 180 },
    { id: 17, type: 'chance', name: '机会' },
    { id: 18, type: 'property', name: '奈良', group: 'orange', price: 180 },
    { id: 19, type: 'property', name: '广岛', group: 'orange', price: 200 },
    { id: 20, type: 'parking', name: '免费停车' },
    { id: 21, type: 'property', name: '福冈', group: 'red', price: 220 },
    { id: 22, type: 'chest', name: '命运' },
    { id: 23, type: 'property', name: '熊本', group: 'red', price: 220 },
    { id: 24, type: 'property', name: '鹿儿岛', group: 'red', price: 240 },
    { id: 25, type: 'station', name: '九州站', price: 200 },
    { id: 26, type: 'property', name: '冲绳', group: 'yellow', price: 260 },
    { id: 27, type: 'property', name: '长崎', group: 'yellow', price: 260 },
    { id: 28, type: 'utility', name: '自来水厂', price: 150 },
    { id: 29, type: 'property', name: '宫崎', group: 'yellow', price: 280 },
    { id: 30, type: 'gotojail', name: '进监狱' },
    { id: 31, type: 'property', name: '札幌', group: 'green', price: 300 },
    { id: 32, type: 'property', name: '旭川', group: 'green', price: 300 },
    { id: 33, type: 'chance', name: '机会' },
    { id: 34, type: 'property', name: '函馆', group: 'green', price: 320 },
    { id: 35, type: 'station', name: '北海道站', price: 200 },
    { id: 36, type: 'chest', name: '命运' },
    { id: 37, type: 'property', name: '金泽', group: 'darkblue', price: 350 },
    { id: 38, type: 'tax', name: '奢侈税', amount: 100 },
    { id: 39, type: 'property', name: '东京塔', group: 'darkblue', price: 400 },
]

export const BOARD_SIZE = BOARD.length // 40
export const GO_SALARY = 200
export const JAIL_TILE = 10
export const START_CASH = 1500
export const MAX_HOUSES = 5 // 含旅馆
export const GET_OUT_FEE = 50
export const HOUSE_COST_RATIO = 0.5 // 盖房成本 = round(price * 0.5)

// 计算每个地产的基础租金
export function baseRentOf(tile) {
    if (tile.type !== 'property') return 0
    return Math.max(2, Math.round(tile.price * 0.08))
}

// 同色组全部地产 id（用于垄断判断）
export function groupTileIds(group) {
    return BOARD.filter(t => t.type === 'property' && t.group === group).map(t => t.id)
}

export function houseCostOf(tile) {
    if (tile.type !== 'property') return 0
    return Math.round(tile.price * HOUSE_COST_RATIO)
}

// ---- 卡牌 ----
// effect(ctx) 由 store 执行；这里只描述文本与类型。
export const CHANCE_CARDS = [
    { text: '银行分红，领取 ¥150', type: 'money', amount: 150 },
    { text: '超速罚单，缴纳 ¥100', type: 'money', amount: -100 },
    { text: '中奖啦！获得 ¥200', type: 'money', amount: 200 },
    { text: '修路费，支付 ¥80', type: 'money', amount: -80 },
    { text: '获得免费出狱卡', type: 'jailcard' },
    { text: '被抓闯红灯，进监狱', type: 'gotojail' },
    { text: '畅游度假，前进到起点并领取工资', type: 'togo', target: 0 },
    { text: '顺风车，前进 3 格', type: 'forward', steps: 3 },
    { text: '走错路，后退 2 格', type: 'back', steps: 2 },
    { text: '慈善捐款，支付 ¥50', type: 'money', amount: -50 },
    { text: '股票大涨，获得 ¥120', type: 'money', amount: 120 },
    { text: '医疗费，支付 ¥60', type: 'money', amount: -60 },
]

export const CHEST_CARDS = [
    { text: '生日礼物，领取 ¥100', type: 'money', amount: 100 },
    { text: '退还税费，领取 ¥80', type: 'money', amount: 80 },
    { text: '保险理赔，获得 ¥180', type: 'money', amount: 180 },
    { text: '交水电费，支付 ¥90', type: 'money', amount: -90 },
    { text: '获得免费出狱卡', type: 'jailcard' },
    { text: '继承遗产，获得 ¥250', type: 'money', amount: 250 },
    { text: '公益捐赠，支付 ¥70', type: 'money', amount: -70 },
    { text: '被抓违章，进监狱', type: 'gotojail' },
    { text: '返程机票，回到起点领取工资', type: 'togo', target: 0 },
    { text: '幸运抽奖，获得 ¥160', type: 'money', amount: 160 },
    { text: '车辆维修，支付 ¥75', type: 'money', amount: -75 },
    { text: '年终奖，获得 ¥140', type: 'money', amount: 140 },
]

// 预置 NPC（供快速开始 / 房间填充）
export const MONOPOLY_NPCS = [
    { id: 'npc_money', name: '钱多多', avatar: '🤑', cash: 1500 },
    { id: 'npc_cat', name: '喵老板', avatar: '🐱', cash: 1500 },
    { id: 'npc_robot', name: '钢铁侠', avatar: '🤖', cash: 1500 },
    { id: 'npc_fox', name: '狐狸精', avatar: '🦊', cash: 1500 },
    { id: 'npc_bear', name: '熊大亨', avatar: '🐻', cash: 1500 },
    { id: 'npc_star', name: '星小妹', avatar: '⭐', cash: 1500 },
    { id: 'npc_dragon', name: '龙傲天', avatar: '🐲', cash: 1500 },
]

export const PLAYER_COLORS = [
    '#ef4444', // 0 用户
    '#3b82f6',
    '#22c55e',
    '#f59e0b',
    '#a855f7',
    '#ec4899',
    '#14b8a6',
    '#f97316',
]
