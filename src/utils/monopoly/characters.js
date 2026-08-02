/**
 * 帕瓦小镇角色系统
 * 8 个猫狗角色，每个有：立绘路径、专属技能、性格、AI决策权重、聊天风格
 *
 * AI 像真人的关键：
 * - 性格驱动的决策权重（不是固定概率）
 * - 专属语气词库（不是模板）
 * - 随机波动（不总是最优选择）
 */

// ============ 角色定义 ============
export const CHARACTERS = [
    {
        id: 'pudding',
        name: '布丁',
        species: '橘猫',
        emoji: '🐱',
        color: '#F39C12',
        avatar: '/monopoly-assets/characters/pudding-avatar.png',
        fullBody: '/monopoly-assets/characters/pudding-full.png',
        token: '/monopoly-assets/characters/pudding-token.png',
        personality: '乐观贪吃，大大咧咧，容易开心也容易丧',
        skill: {
            name: '贪吃福利',
            desc: '每次路过起点额外获得 ¥50 小鱼干奖金',
            trigger: 'passGo',
        },
        // AI 决策权重
        ai: {
            buyThreshold: 0.55,    // 买地基础概率
            buyVariance: 0.20,     // 随机波动 ±20%
            buildDelay: 0.3,       // 30% 概率延迟盖房
            cardUseRate: 0.65,     // 道具卡使用率
            riskAppetite: 0.6,     // 风险偏好（高=敢花钱）
        },
        // 聊天风格（按事件类型）
        chat: {
            buy:      ['这块地闻着就香！收了！', '嘿嘿又有新地盘了~', '买买买！小鱼干管够！', '这地风水好，我闻出来了！'],
            payRent:  ['呜呜好心疼小鱼干...', '啊我的钱包...', '呜...又花钱了...', '好贵啊能不能打折...'],
            getRent:  ['嘿嘿来收租啦~', '房东驾到！交钱交钱~', '我的地盘我做主喵！', '租金到账，谢谢惠顾~'],
            jail:     ['不是我干的！冤枉啊！', '呜呜放我出去...', '我再也不咬沙发了...', '冤枉冤枉！'],
            goodCard: ['太棒了喵！', '运气真好嘿嘿~', '喵喵喵！赚到了！', '今天运势不错！'],
            badCard:  ['呜呜怎么这样...', '倒霉透了喵...', '哼不信这个邪！', '呜...运气好差...'],
            bankrupt: ['完蛋了肚子都饿了...', '呜呜我不玩了...', '小鱼干全没了...', '下次一定赢回来！'],
            tauntUser:['你运气也太好了吧！', '哼下次一定赢你！', '你别跑等我攒够钱！', '哼哼我下回合就追上你！'],
            thinking: ['在闻这块地香不香...', '在数小鱼干...', '让我想想...', '嗯...这块地怎么样...'],
        }
    },
    {
        id: 'nuomi',
        name: '糯米',
        species: '萨摩耶',
        emoji: '🐶',
        color: '#FDFEFE',
        avatar: '/monopoly-assets/characters/nuomi-avatar.png',
        fullBody: '/monopoly-assets/characters/nuomi-full.png',
        token: '/monopoly-assets/characters/nuomi-token.png',
        personality: '活泼热情，爱交朋友，有点傻白甜',
        skill: {
            name: '幸运双骰',
            desc: '掷出双骰概率 +10%，连续三次双骰不坐牢',
            trigger: 'rollDice',
        },
        ai: {
            buyThreshold: 0.50,
            buyVariance: 0.25,
            buildDelay: 0.4,
            cardUseRate: 0.55,
            riskAppetite: 0.7,
        },
        chat: {
            buy:      ['好耶！新地盘！', '哇这块地好棒！', '又有了又有了！', '嘿嘿我的！'],
            payRent:  ['呜呜呜...好难过...', '啊又要花钱...', '呜...好心疼...', '呜呜能不能少一点...'],
            getRent:  ['谢谢惠顾汪~', '嘿嘿又收钱啦！', '汪汪！来钱来钱！', '收到收到！'],
            jail:     ['呜呜我乖乖蹲着...', '我以后不乱跑了...', '呜...好想出去...', '我乖乖的...'],
            goodCard: ['好幸运！汪！', '太好了太好了！', '汪汪汪！赚到了！', '今天是我的幸运日！'],
            badCard:  ['呜呜呜...', '怎么这样...', '好难过...', '呜...不开心...'],
            bankrupt: ['呜呜呜我不玩了...', '好难过好难过...', '呜...要回家了...', '呜呜呜...'],
            tauntUser:['哇你好厉害！', '哼我下次一定追上你！', '你教教我嘛！', '哼哼等着瞧！'],
            thinking: ['汪汪...让我想想...', '在想要不要买...', '嗯嗯...', '好纠结...'],
        }
    },
    {
        id: 'coco',
        name: '可可',
        species: '黑猫',
        emoji: '🐈',
        color: '#2C3E50',
        avatar: '/monopoly-assets/characters/coco-avatar.png',
        fullBody: '/monopoly-assets/characters/coco-full.png',
        token: '/monopoly-assets/characters/coco-token.png',
        personality: '精明高傲，商业头脑，话少但句句到位',
        skill: {
            name: '精明商人',
            desc: '买地打 9 折，收租额外 +10%',
            trigger: 'buyOrRent',
        },
        ai: {
            buyThreshold: 0.70,
            buyVariance: 0.10,
            buildDelay: 0.15,
            cardUseRate: 0.75,
            riskAppetite: 0.4,
        },
        chat: {
            buy:      ['哼，这块地值。', '算过了，稳赚。', '拿下。', '眼光不错。'],
            payRent:  ['切，小钱。', '哼。', '...记住了。', '这点钱不算什么。'],
            getRent:  ['该交的总是要交的。', '理所当然。', '哼，收租。', '别拖欠。'],
            jail:     ['无聊。', '哼，等我出去。', '...浪费时间。', '啧。'],
            goodCard: ['哼，还行。', '意料之中。', '不错。', '还可以。'],
            badCard:  ['啧。', '哼。', '...运气差而已。', '下次再说。'],
            bankrupt: ['...不可能。', '哼，是我算错了。', '...可恶。', '这局不算。'],
            tauntUser:['哼，你只是运气好。', '别得意太早。', '我看好你...才怪。', '等着。'],
            thinking: ['在算账...', '让我看看...', '嗯...', '在评估...'],
        }
    },
    {
        id: 'tuanzi',
        name: '团子',
        species: '柯基',
        emoji: '🐕',
        color: '#D35400',
        avatar: '/monopoly-assets/characters/tuanzi-avatar.png',
        fullBody: '/monopoly-assets/characters/tuanzi-full.png',
        token: '/monopoly-assets/characters/tuanzi-token.png',
        personality: '调皮捣蛋，爱恶作剧，元气满满',
        skill: {
            name: '捣蛋柯基',
            desc: '每 3 回合可指定一名玩家，该玩家下次交过路费减半',
            trigger: 'everyTurns3',
        },
        ai: {
            buyThreshold: 0.60,
            buyVariance: 0.20,
            buildDelay: 0.35,
            cardUseRate: 0.80,    // 爱用道具卡
            riskAppetite: 0.75,   // 敢花钱
        },
        chat: {
            buy:      ['哇塞这地好棒！', '嘿嘿我的了！', '拿下拿下！', '这块地我看上了！'],
            payRent:  ['呜呜我的零花钱！', '啊好贵！', '呜...又花钱了...', '能不能分期...'],
            getRent:  ['嘿嘿来钱啦！', '收到收到！', '汪汪！有钱了！', '交钱交钱！'],
            jail:     ['呜呜我好乖的！', '放我出去啦！', '我没捣蛋！', '呜呜呜...'],
            goodCard: ['太棒啦！', '嘿嘿运气真好！', '哇塞！', '爽！'],
            badCard:  ['呜呜好倒霉！', '哼！', '怎么这样！', '呜...不开心！'],
            bankrupt: ['呜呜呜我要回家了...', '不玩了不玩了！', '呜呜呜...好难过...', '下次一定！'],
            tauntUser:['嘿嘿你等着！', '哼哼我马上追上你！', '你走着瞧！', '我要捣蛋啦！'],
            thinking: ['在想怎么捣蛋...', '嘿嘿...', '让我想想...', '嗯嗯嗯...'],
        }
    },
    {
        id: 'naicha',
        name: '奶茶',
        species: '布偶猫',
        emoji: '😺',
        color: '#AAB7B8',
        avatar: '/monopoly-assets/characters/naicha-avatar.png',
        fullBody: '/monopoly-assets/characters/naicha-full.png',
        token: '/monopoly-assets/characters/naicha-token.png',
        personality: '温柔体贴，爱和平，不喜欢收租但也不愿吃亏',
        skill: {
            name: '温柔选择',
            desc: '抽机会/命运卡时可多看一张，选择其一',
            trigger: 'drawCard',
        },
        ai: {
            buyThreshold: 0.50,
            buyVariance: 0.15,
            buildDelay: 0.25,
            cardUseRate: 0.60,
            riskAppetite: 0.5,
        },
        chat: {
            buy:      ['嗯...这块地还不错呢~', '那就买下吧~', '看起来很温馨~', '好吧，收了~'],
            payRent:  ['啊...好吧~', '没关系，给你吧~', '嗯...有点心疼~', '好的~'],
            getRent:  ['不好意思啊...收一下租~', '嗯...该交的还是要交的~', '抱歉抱歉~', '谢谢你~'],
            jail:     ['呜...好想出去...', '我会乖乖的...', '好无聊...', '快点放我出去吧...'],
            goodCard: ['好开心呢~', '运气不错~', '真好~', '嘿嘿~'],
            badCard:  ['啊...好可惜...', '没关系下次会好的~', '嗯...运气差了一点~', '哎...'],
            bankrupt: ['呜...不想玩了...', '好难过...', '下次再努力吧...', '呜呜...'],
            tauntUser:['你好厉害呀~', '我要加油了！', '你教教我嘛~', '哼我才不怕你~'],
            thinking: ['嗯...让我想想...', '在考虑...', '好纠结...', '嗯...'],
        }
    },
    {
        id: 'doudou',
        name: '豆豆',
        species: '柴犬',
        emoji: '🦊',
        color: '#E59866',
        avatar: '/monopoly-assets/characters/doudou-avatar.png',
        fullBody: '/monopoly-assets/characters/doudou-full.png',
        token: '/monopoly-assets/characters/doudou-token.png',
        personality: '勇敢正义，不服输，有冒险精神',
        skill: {
            name: '勇敢柴犬',
            desc: '入狱时 50% 概率直接越狱（不消耗出狱卡）',
            trigger: 'onJail',
        },
        ai: {
            buyThreshold: 0.65,
            buyVariance: 0.15,
            buildDelay: 0.20,
            cardUseRate: 0.70,
            riskAppetite: 0.8,    // 最敢冒险
        },
        chat: {
            buy:      ['这块地我要了！', '勇敢出击！', '看准了就买！', '不犹豫！'],
            payRent:  ['哼，给你就是了！', '切，不算什么！', '下次我要收回来！', '哼！'],
            getRent:  ['哼哼，交钱吧！', '天经地义！', '该出的就得出！', '别想赖账！'],
            jail:     ['放我出去！我要越狱！', '哼，困不住我的！', '等着瞧！', '我不服！'],
            goodCard: ['哈哈！运气来了！', '好兆头！', '果然是我！', '哈哈！'],
            badCard:  ['哼！不服！', '切，运气而已！', '下次一定！', '哼！'],
            bankrupt: ['我不服！再来一局！', '哼...算你赢！', '下次一定赢回来！', '不可能！'],
            tauntUser:['哼，你等着！', '我下次一定赢你！', '别得意！', '等着瞧！'],
            thinking: ['在想战术...', '嗯...让我看看...', '该不该出手...', '在算...'],
        }
    },
    {
        id: 'xuehua',
        name: '雪花',
        species: '白猫',
        emoji: '😾',
        color: '#FDFEFE',
        avatar: '/monopoly-assets/characters/xuehua-avatar.png',
        fullBody: '/monopoly-assets/characters/xuehua-full.png',
        token: '/monopoly-assets/characters/xuehua-token.png',
        personality: '高冷傲娇，外冷内热，说话带刺但心软',
        skill: {
            name: '高冷撒娇',
            desc: '被收租时 20% 概率触发「撒娇」，免单本次租金',
            trigger: 'onPayRent',
        },
        ai: {
            buyThreshold: 0.45,    // 挑剔，不轻易买
            buyVariance: 0.20,
            buildDelay: 0.45,      // 经常延迟盖房
            cardUseRate: 0.50,
            riskAppetite: 0.3,     // 保守
        },
        chat: {
            buy:      ['哼，勉强收下吧。', '...还行。', '就这块了。', '哼。'],
            payRent:  ['哼，给你就是了。', '切。', '...哼。', '记住了。'],
            getRent:  ['哼，交钱。', '理所当然。', '别让我说第二遍。', '哼。'],
            jail:     ['哼，无聊。', '...放我出去。', '啧。', '浪费时间。'],
            goodCard: ['哼，还行。', '...不错。', '勉强满意。', '哼。'],
            badCard:  ['啧。', '哼。', '...不稀罕。', '无所谓。'],
            bankrupt: ['哼...是我大意了。', '...可恶。', '这局不算。', '哼，下次。'],
            tauntUser:['哼，你不过是运气好。', '别得意。', '我看着你呢。', '哼。'],
            thinking: ['哼...让我看看...', '在想...', '...嗯...', '在评估...'],
        }
    },
    {
        id: 'oreo',
        name: '奥利奥',
        species: '边牧',
        emoji: '🐕‍🦺',
        color: '#17202A',
        avatar: '/monopoly-assets/characters/oreo-avatar.png',
        fullBody: '/monopoly-assets/characters/oreo-full.png',
        token: '/monopoly-assets/characters/oreo-token.png',
        personality: '聪明冷静，策略型选手，喜欢计算最优解',
        skill: {
            name: '策略大师',
            desc: '每 5 回合可查看牌堆顶 3 张卡，选择顺序',
            trigger: 'everyTurns5',
        },
        ai: {
            buyThreshold: 0.75,    // 最精明
            buyVariance: 0.08,     // 波动最小
            buildDelay: 0.10,      // 几乎不延迟
            cardUseRate: 0.85,     // 最会用卡
            riskAppetite: 0.55,
        },
        chat: {
            buy:      ['经过计算，这块地值得投资。', '策略需要，买下。', '数据告诉我该买了。', '最优选择。'],
            payRent:  ['预算之内，可以接受。', '在预期之中。', '没关系，继续。', '计算过了。'],
            getRent:  ['合理的回报。', '投资开始产生收益。', '符合预期。', '不错的收益。'],
            jail:     ['策略失误，但可控。', '需要调整计划。', '暂时受挫。', '重新规划。'],
            goodCard: ['概率站在我这边。', '符合预期。', '不错的收益。', '策略有效。'],
            badCard:  ['小概率事件。', '不影响整体策略。', '可以接受的风险。', '没关系。'],
            bankrupt: ['策略完全失误...需要复盘。', '我低估了风险。', '...需要重新计算。', '这次学到了。'],
            tauntUser:['你的策略有漏洞。', '我已看穿你的计划。', '等着，我会翻盘。', '数据不会骗人。'],
            thinking: ['在计算概率...', '分析局势中...', '推演最优策略...', '评估风险收益...'],
        }
    },
]

// 默认用户角色（未选择时）
export const DEFAULT_CHARACTER = CHARACTERS[0]

// 按 id 查角色
export function getCharacter(id) {
    return CHARACTERS.find(c => c.id === id) || DEFAULT_CHARACTER
}

// 随机角色（给 AI 对手分配）
export function randomCharacters(count, excludeIds = []) {
    const available = CHARACTERS.filter(c => !excludeIds.includes(c.id))
    const shuffled = available.slice()
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled.slice(0, count)
}

// ============ AI 聊天生成 ============

/**
 * 根据角色 + 事件类型生成聊天文本
 * @param {string} characterId 角色 id
 * @param {string} eventType 事件类型：buy/payRent/getRent/jail/goodCard/badCard/bankrupt/tauntUser/thinking
 * @returns {string|null} 聊天文本，40-60% 概率返回 null（不说话）
 */
export function generateAiChat(characterId, eventType) {
    const char = getCharacter(characterId)
    if (!char || !char.chat || !char.chat[eventType]) return null
    // 40-60% 概率不说话（像真人，不是每次都开口）
    if (Math.random() > 0.6) return null
    const lines = char.chat[eventType]
    return lines[Math.floor(Math.random() * lines.length)]
}

/**
 * 生成 AI 思考气泡文本
 */
export function generateAiThinking(characterId) {
    const char = getCharacter(characterId)
    if (!char || !char.chat || !char.chat.thinking) return '...'
    const lines = char.chat.thinking
    return lines[Math.floor(Math.random() * lines.length)]
}

// ============ AI 决策辅助 ============

/**
 * AI 买地决策（性格驱动 + 随机波动）
 * @returns {boolean} 是否买
 */
export function aiDecideBuyWithPersonality(characterId, cash, price, groupOwned, groupTotal) {
    const char = getCharacter(characterId)
    const ai = char.ai
    let prob = ai.buyThreshold
    // 凑组加成
    if (groupOwned > 0) prob += 0.25
    if (groupTotal === 2 && groupOwned === 1) prob += 0.10
    // 资金充裕加成
    if (cash > price * 3) prob += 0.15
    // 资金紧张惩罚
    if (cash < price + 200) prob -= 0.30
    // 随机波动（性格驱动）
    prob += (Math.random() - 0.5) * ai.buyVariance
    // 风险偏好影响
    if (ai.riskAppetite > 0.6 && cash < price + 150) prob += 0.10
    return Math.random() < Math.max(0.1, Math.min(0.95, prob))
}

/**
 * AI 盖房延迟决策
 * @returns {boolean} true=延迟盖房
 */
export function aiDelayBuild(characterId) {
    const char = getCharacter(characterId)
    return Math.random() < char.ai.buildDelay
}

/**
 * AI 道具卡使用决策
 * @returns {boolean} true=使用
 */
export function aiShouldUseCard(characterId) {
    const char = getCharacter(characterId)
    return Math.random() < char.ai.cardUseRate
}
