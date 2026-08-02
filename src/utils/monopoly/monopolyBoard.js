/**
 * 帕瓦小镇（Paw Town）大富翁棋盘数据
 * 萌系猫猫狗狗主题，40 格经典布局
 *
 * type:
 *   go       起点（镇中心广场，路过/停留发工资）
 *   property 地产（可买、可盖房、收租）
 *   station  车站（萌宠交通工具，租金随持有数量递增）
 *   utility  公共事业（喵喵电力/汪汪水厂）
 *   chance   幸运猫爪（机会卡）
 *   chest    命运狗屋（命运卡）
 *   tax      税收（零食税/小镇建设费）
 *   jail     宠物寄养所（仅路过=探监）
 *   gotojail 被宠物管理员抓走
 *   parking  阳光草坪（免费停车）
 *
 * 租金公式（沿用经典）：
 *   baseRent = round(price * 0.08)
 *   垄断(同组全持有)：×2
 *   房屋 h 级(1~5)：rent = round(baseRent * (1 + 0.6*h) * (垄断?2:1))
 *   车站：25 * 2^(持有数-1) → 25/50/100/200
 *   公共：骰子×(4/10)
 */

export const GROUPS = {
    brown: { name: '小镇商铺', color: '#C39BD3' },
    lightblue: { name: '美食天地', color: '#5DADE2' },
    pink: { name: '生活服务', color: '#F5B7B1' },
    orange: { name: '娱乐休闲', color: '#F8C471' },
    red: { name: '文化艺术', color: '#EC7063' },
    yellow: { name: '自然田园', color: '#F4D03F' },
    green: { name: '商业金融', color: '#52BE80' },
    darkblue: { name: '高端豪宅', color: '#2E86C1' },
    station: { name: '车站', color: '#85929E' },
    utility: { name: '公共', color: '#BB8FCE' },
}

// 40 格帕瓦小镇棋盘（顺时针：起点左上角 → 右 → 下 → 左 → 上）
export const BOARD = [
    { id: 0,  type: 'go',       name: '镇中心广场',     desc: '喷泉彩虹，猫狗聚会' },
    { id: 1,  type: 'property', name: '鱼干便利店',     group: 'brown',    price: 60,  desc: '橙色小猫招牌，货架满是鱼干' },
    { id: 2,  type: 'chance',   name: '幸运猫爪',       desc: '发光猫爪印，问号气泡' },
    { id: 3,  type: 'property', name: '毛线球杂货铺',   group: 'brown',    price: 60,  desc: '彩色毛线球堆成山' },
    { id: 4,  type: 'tax',      name: '零食税',         amount: 200,       desc: '橘猫镇长收税台' },
    { id: 5,  type: 'station',  name: '猫咪巴士站',     price: 200,        desc: '猫耳巴士站牌' },
    { id: 6,  type: 'property', name: '狗爪咖啡馆',     group: 'lightblue', price: 100, desc: '咖啡杯上印着狗爪' },
    { id: 7,  type: 'chest',    name: '命运狗屋',       desc: '狗屋形状宝箱' },
    { id: 8,  type: 'property', name: '彩虹宠物医院',   group: 'lightblue', price: 100, desc: '粉色医院+红十字' },
    { id: 9,  type: 'property', name: '喵爪书店',       group: 'lightblue', price: 120, desc: '猫咪趴在书堆上' },
    { id: 10, type: 'jail',     name: '宠物寄养所',     desc: '栅栏+委屈小狗' },
    { id: 11, type: 'property', name: '骨头健身房',     group: 'pink',     price: 140, desc: '狗狗举骨头哑铃' },
    { id: 12, type: 'utility',  name: '喵喵电力',       price: 150,        desc: '猫耳发电塔' },
    { id: 13, type: 'property', name: '毛绒玩具店',     group: 'pink',     price: 140, desc: '满屋毛绒玩具' },
    { id: 14, type: 'property', name: '狗狗美容院',     group: 'pink',     price: 160, desc: '浴缸+泡泡' },
    { id: 15, type: 'station',  name: '狗狗快车站',     price: 200,        desc: '狗骨头形状车站' },
    { id: 16, type: 'property', name: '仓鼠滚轮乐园',   group: 'orange',   price: 180, desc: '大滚轮+仓鼠' },
    { id: 17, type: 'chance',   name: '幸运猫爪',       desc: '发光猫爪印' },
    { id: 18, type: 'property', name: '猫咪歌剧院',     group: 'orange',   price: 180, desc: '猫耳剧院帷幕' },
    { id: 19, type: 'property', name: '狗狗音乐厅',     group: 'orange',   price: 200, desc: '狗狗吹萨克斯' },
    { id: 20, type: 'parking',  name: '阳光草坪',       desc: '野餐垫+气球' },
    { id: 21, type: 'property', name: '兔兔胡萝卜田',   group: 'red',      price: 220, desc: '兔子拔萝卜' },
    { id: 22, type: 'chest',    name: '命运狗屋',       desc: '狗屋宝箱' },
    { id: 23, type: 'property', name: '企鹅冰沙店',     group: 'red',      price: 220, desc: '企鹅卖冰沙' },
    { id: 24, type: 'property', name: '熊猫竹林茶馆',   group: 'red',      price: 240, desc: '熊猫泡茶' },
    { id: 25, type: 'station',  name: '仓鼠轮渡',       price: 200,        desc: '仓鼠踩轮船' },
    { id: 26, type: 'property', name: '狐狸裁缝铺',     group: 'yellow',   price: 260, desc: '狐狸踩缝纫机' },
    { id: 27, type: 'property', name: '浣熊便利店',     group: 'yellow',   price: 260, desc: '浣熊洗水果' },
    { id: 28, type: 'utility',  name: '汪汪水厂',       price: 150,        desc: '狗骨头水龙头' },
    { id: 29, type: 'property', name: '绵羊温泉旅馆',   group: 'yellow',   price: 280, desc: '绵羊泡温泉' },
    { id: 30, type: 'gotojail', name: '宠物管理员',     desc: '严肃猫管理员抓人' },
    { id: 31, type: 'property', name: '鹦鹉糖果店',     group: 'green',    price: 300, desc: '彩色糖果罐' },
    { id: 32, type: 'property', name: '刺猬花店',       group: 'green',    price: 300, desc: '刺猬背鲜花' },
    { id: 33, type: 'chance',   name: '幸运猫爪',       desc: '发光猫爪印' },
    { id: 34, type: 'property', name: '松鼠坚果银行',   group: 'green',    price: 320, desc: '松鼠守着金坚果' },
    { id: 35, type: 'station',  name: '兔兔热气球',     price: 200,        desc: '热气球吊篮是胡萝卜' },
    { id: 36, type: 'chest',    name: '命运狗屋',       desc: '狗屋宝箱' },
    { id: 37, type: 'property', name: '天鹅湖畔别墅',   group: 'darkblue', price: 350, desc: '天鹅+湖畔小别墅' },
    { id: 38, type: 'tax',      name: '小镇建设费',     amount: 100,       desc: '镇长猫拿着锤子' },
    { id: 39, type: 'property', name: '星空观景台',     group: 'darkblue', price: 400, desc: '猫狗一起望星星' },
]

export const BOARD_SIZE = BOARD.length // 40
export const GO_SALARY = 200
export const JAIL_TILE = 10
export const START_CASH = 1500
export const MAX_HOUSES = 5
export const GET_OUT_FEE = 50
export const HOUSE_COST_RATIO = 0.5

// 房屋等级名称（萌系）
export const HOUSE_LEVELS = [
    { name: '空地',     icon: '⚪', desc: '还没盖房' },
    { name: '小帐篷',   icon: '🎪', desc: '简陋但可爱' },
    { name: '木屋',     icon: '🏠', desc: '温馨小窝' },
    { name: '花园小屋', icon: '🏡', desc: '带花园的小屋' },
    { name: '小城堡',   icon: '🏰', desc: '气派小城堡' },
    { name: '梦幻宫殿', icon: '👑', desc: '终极豪华宫殿' },
]

export function baseRentOf(tile) {
    if (tile.type !== 'property') return 0
    return Math.max(2, Math.round(tile.price * 0.08))
}

export function groupTileIds(group) {
    return BOARD.filter(t => t.type === 'property' && t.group === group).map(t => t.id)
}

export function houseCostOf(tile) {
    if (tile.type !== 'property') return 0
    return Math.round(tile.price * HOUSE_COST_RATIO)
}

// ---- 机会卡（幸运猫爪）萌系文本 ----
export const CHANCE_CARDS = [
    { text: '鱼干大促销！领 ¥150 小鱼干', type: 'money', amount: 150 },
    { text: '偷吃零食被抓，罚 ¥100', type: 'money', amount: -100 },
    { text: '猫粮中奖！获得 ¥200', type: 'money', amount: 200 },
    { text: '咬坏沙发赔钱，支付 ¥80', type: 'money', amount: -80 },
    { text: '获得免费出狱卡（撒娇成功）', type: 'jailcard' },
    { text: '打翻花瓶被管理员抓走，进寄养所', type: 'gotojail' },
    { text: '散步到镇中心，回到起点领工资', type: 'togo', target: 0 },
    { text: '追蝴蝶前进 3 格', type: 'forward', steps: 3 },
    { text: '被狗吓到后退 2 格', type: 'back', steps: 2 },
    { text: '捐给流浪猫基金 ¥50', type: 'money', amount: -50 },
    { text: '股市（松鼠银行）大涨，获得 ¥120', type: 'money', amount: 120 },
    { text: '看兽医花费 ¥60', type: 'money', amount: -60 },
]

// ---- 命运卡（命运狗屋）萌系文本 ----
export const CHEST_CARDS = [
    { text: '生日收到礼物！领 ¥100', type: 'money', amount: 100 },
    { text: '退还宠物医保 ¥80', type: 'money', amount: 80 },
    { text: '保险理赔，获得 ¥180', type: 'money', amount: 180 },
    { text: '交水电费（喵喵电力），支付 ¥90', type: 'money', amount: -90 },
    { text: '获得免费出狱卡（乖巧表现）', type: 'jailcard' },
    { text: '继承猫奶奶遗产，获得 ¥250', type: 'money', amount: 250 },
    { text: '公益捐猫粮 ¥70', type: 'money', amount: -70 },
    { text: '闯红灯被管理员抓走，进寄养所', type: 'gotojail' },
    { text: '返程车票，回到起点领工资', type: 'togo', target: 0 },
    { text: '幸运转盘，获得 ¥160', type: 'money', amount: 160 },
    { text: '修理抓坏的窗帘，支付 ¥75', type: 'money', amount: -75 },
    { text: '年终奖到账，获得 ¥140', type: 'money', amount: 140 },
]

// ---- 预置 NPC（猫狗角色，快速开始填充用） ----
// 完整角色数据在 characters.js，这里给 NPC 用简化版
export const MONOPOLY_NPCS = [
    { id: 'npc_pudding',  name: '布丁',  avatar: '🐱', character: 'pudding',  species: '橘猫',   cash: 1500 },
    { id: 'npc_nuomi',    name: '糯米',  avatar: '🐶', character: 'nuomi',    species: '萨摩耶', cash: 1500 },
    { id: 'npc_coco',     name: '可可',  avatar: '🐈', character: 'coco',     species: '黑猫',   cash: 1500 },
    { id: 'npc_tuanzi',   name: '团子',  avatar: '🐕', character: 'tuanzi',   species: '柯基',   cash: 1500 },
    { id: 'npc_naicha',   name: '奶茶',  avatar: '😺', character: 'naicha',   species: '布偶猫', cash: 1500 },
    { id: 'npc_doudou',   name: '豆豆',  avatar: '🦊', character: 'doudou',   species: '柴犬',   cash: 1500 },
    { id: 'npc_xuehua',   name: '雪花',  avatar: '😾', character: 'xuehua',   species: '白猫',   cash: 1500 },
]

export const PLAYER_COLORS = [
    '#5DADE2', // 0 用户 - 天蓝
    '#F4D03F', // 1 - 暖黄
    '#52BE80', // 2 - 薄荷绿
    '#EC7063', // 3 - 珊瑚红
    '#BB8FCE', // 4 - 薰衣草紫
    '#F8C471', // 5 - 暖橙
    '#48C9B0', // 6 - 青绿
    '#E59866', // 7 - 蜜桃橙
]
