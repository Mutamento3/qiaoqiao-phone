/**
 * 帕瓦小镇（Paw Town）大富翁 store
 * 萌系猫狗主题 · 角色技能 · 道具卡 · 人性化 AI
 *
 * 复用麻将架构：大厅 → 房间 → 对局三段式
 * - 2~8 人，用户固定 index0
 * - 角色技能（characters.js）+ 道具卡（itemCards.js）
 * - AI 人性化：性格驱动决策 + 随机波动 + 专属聊天风格
 * - 回合节奏控制：AI 动作间有停顿，让用户看清
 */
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
    BOARD, BOARD_SIZE, GROUPS, GO_SALARY, JAIL_TILE, START_CASH, MAX_HOUSES,
    GET_OUT_FEE, CHANCE_CARDS, CHEST_CARDS, MONOPOLY_NPCS, PLAYER_COLORS,
    HOUSE_LEVELS, baseRentOf, groupTileIds, houseCostOf,
} from '../utils/monopoly/monopolyBoard.js'
import {
    CHARACTERS, getCharacter, randomCharacters, DEFAULT_CHARACTER,
    generateAiChat, generateAiThinking,
    aiDecideBuyWithPersonality, aiDelayBuild, aiShouldUseCard,
} from '../utils/monopoly/characters.js'
import {
    ITEM_CARDS, getItemCard, drawRandomCard, drawCards, ITEM_CARD_TYPES, RARITY,
} from '../utils/monopoly/itemCards.js'
import { loadGameChat, saveGameChat, clearGameChat } from '../utils/gameChatMemory.js'
import { useChatStore } from './chatStore.js'
import { useSettingsStore } from './settingsStore.js'

const STORAGE_KEY = 'monopoly_current'
const MAX_HAND_SIZE = 5

function tileById(id) {
    return BOARD[id]
}

function shuffle(arr) {
    const a = arr.slice()
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const t = a[i]; a[i] = a[j]; a[j] = t
    }
    return a
}

function genRoomId() {
    return 'MP' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1000)
}

// 初始化玩家的 activeEffects
function makeActiveEffects() {
    return {
        shield: false,           // 免疫一次租金
        halfRent: false,         // 本回合租金减半
        noRent: false,           // 本次经过别人地产不付租
        doubleRentNext: false,   // 下次收租翻倍
        rentInsurance: false,    // 被收租返还 50%
        counterClaw: false,      // 被收租反弹 30%
        blockBuild: false,       // 本回合不能盖房
        blockCards: false,       // 下回合不能用道具卡
        limitMove: null,         // {min, max} 限制骰子步数
        moveBonus: 0,            // 移动步数加成
        extraRoll: false,        // 额外掷骰
        immunityJail: false,     // 免疫一次入狱
    }
}

export const useMonopolyStore = defineStore('monopoly', () => {
    const currentRoom = ref(null)
    const gameState = ref(null)
    const settings = ref({ soundEnabled: true })

    const hasActiveGame = computed(() =>
        !!currentRoom.value && !!gameState.value &&
        gameState.value.phase !== 'ended' && gameState.value.phase !== 'idle'
    )

    const currentPlayer = computed(() => {
        if (!gameState.value || !Array.isArray(gameState.value.players)) return null
        return gameState.value.players[gameState.value.currentTurn] || null
    })

    const isUserTurn = computed(() => currentPlayer.value && currentPlayer.value.isUser)

    // ---------- 持久化 ----------
    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                room: currentRoom.value,
                game: gameState.value,
            }))
        } catch (e) { /* ignore */ }
    }

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY)
            if (!raw) return
            const data = JSON.parse(raw)
            const room = data.room || null
            const game = data.game || null
            if (room && (!Array.isArray(room.players) || room.players.length < 1)) {
                clearState(); return
            }
            if (game) {
                if (!Array.isArray(game.players) || game.players.length < 1 ||
                    typeof game.phase !== 'string' || !Array.isArray(game.dice)) {
                    clearState(); return
                }
            }
            currentRoom.value = room
            gameState.value = game
        } catch (e) { /* ignore */ }
    }

    function clearState() {
        currentRoom.value = null
        gameState.value = null
        try { localStorage.removeItem(STORAGE_KEY) } catch (e) { /* ignore */ }
        if (!useSettingsStore().gameChatMemory.enabled) clearGameChat('monopoly')
    }

    // ---------- 房间 ----------
    function makeUserPlayer(name, avatar, characterId) {
        const char = getCharacter(characterId)
        return {
            id: 'user', name, avatar,
            characterId: char.id,
            position: 0, cash: START_CASH,
            isUser: true, isAI: false,
            properties: [], houses: {},
            getOutCards: 0, inJail: false, jailTurns: 0, bankrupt: false,
            color: PLAYER_COLORS[0],
            itemCards: [],
            activeEffects: makeActiveEffects(),
            skillCooldown: 0,
        }
    }

    function makeNpcPlayer(npc, idx) {
        return {
            id: npc.id, name: npc.name, avatar: npc.avatar,
            characterId: npc.character || 'pudding',
            position: 0, cash: START_CASH,
            isUser: false, isAI: true,
            properties: [], houses: {},
            getOutCards: 0, inJail: false, jailTurns: 0, bankrupt: false,
            color: PLAYER_COLORS[idx % PLAYER_COLORS.length],
            itemCards: [],
            activeEffects: makeActiveEffects(),
            skillCooldown: 0,
        }
    }

    function createRoom({ mode = 'custom', playerCount = 4, userName = '我', userAvatar = '🎭', userCharacterId = 'pudding' }) {
        const players = [makeUserPlayer(userName, userAvatar, userCharacterId)]
        const room = {
            id: genRoomId(),
            mode,
            playerCount: Math.min(8, Math.max(2, playerCount)),
            players,
        }
        if (mode === 'quick') {
            // 随机分配不重复角色给 NPC
            const usedCharIds = [userCharacterId]
            const npcChars = randomCharacters(room.playerCount - 1, usedCharIds)
            const shuffledNpcs = shuffle(MONOPOLY_NPCS)
            for (let i = 1; i < room.playerCount; i++) {
                const npc = shuffledNpcs[(i - 1) % shuffledNpcs.length]
                npc.character = npcChars[i - 1].id
                room.players.push(makeNpcPlayer(npc, i))
            }
        }
        currentRoom.value = room
        gameState.value = null
        saveState()
        return room
    }

    function addPlayerById(id, name, avatar) {
        const room = currentRoom.value
        if (!room) return false
        if (room.players.length >= 8) return false
        if (room.players.some(p => p.id === id)) return false
        const idx = room.players.length
        const isContact = !id.startsWith('npc_')
        // 随机分配角色
        const usedCharIds = room.players.map(p => p.characterId)
        const availChars = randomCharacters(1, usedCharIds)
        room.players.push({
            id, name, avatar,
            characterId: availChars[0]?.id || 'pudding',
            position: 0, cash: START_CASH,
            isUser: false, isAI: true,
            properties: [], houses: {},
            getOutCards: 0, inJail: false, jailTurns: 0, bankrupt: false,
            color: PLAYER_COLORS[idx % PLAYER_COLORS.length],
            isContact,
            itemCards: [],
            activeEffects: makeActiveEffects(),
            skillCooldown: 0,
        })
        saveState()
        return true
    }

    function removePlayer(id) {
        const room = currentRoom.value
        if (!room) return
        const idx = room.players.findIndex(p => p.id === id)
        if (idx <= 0) return
        room.players.splice(idx, 1)
        saveState()
    }

    function leaveRoom() {
        clearState()
    }

    // ---------- 开局 ----------
    function startGame() {
        const room = currentRoom.value
        if (!room || room.players.length < 2) return false
        const players = room.players.map((p, i) => ({
            ...p,
            position: 0, cash: START_CASH, properties: [], houses: {},
            getOutCards: 0, inJail: false, jailTurns: 0, bankrupt: false,
            color: PLAYER_COLORS[i % PLAYER_COLORS.length],
            itemCards: [],
            activeEffects: makeActiveEffects(),
            skillCooldown: 0,
        }))
        gameState.value = {
            phase: 'rolling',
            currentTurn: 0,
            players,
            dice: [1, 1],
            pendingMove: null,
            round: 1,
            doublesCount: 0,
            log: [],
            chat: loadGameChat('monopoly', useSettingsStore().gameChatMemory),
            winner: null,
            freeParkingPot: 0,
            chanceDeck: shuffle(CHANCE_CARDS.map((_, i) => i)),
            chestDeck: shuffle(CHEST_CARDS.map((_, i) => i)),
            awaitingBuy: null,
            awaitingEnd: false,
            awaitingReroll: false,
            lastUsedCard: null,
            frozenProperties: {},
            trappedProperties: {},
            aiThinking: null,
            cardAnimation: null,
        }
        logEvent(`🐾 帕瓦小镇开局！${players.length} 只猫狗入场，每人启动资金 ¥${START_CASH} 小鱼干。`)
        pushChat({ role: 'system', name: '系统', content: `帕瓦小镇开局，${players.length} 人同场竞技，祝好运！` })
        // 每人发 2 张初始道具卡
        players.forEach(p => {
            p.itemCards = drawCards(2).map(c => c.id)
        })
        saveState()
        return true
    }

    // ---------- 工具 ----------
    function logEvent(text) {
        if (!gameState.value) return
        gameState.value.log.push({ t: Date.now(), text })
        if (gameState.value.log.length > 200) gameState.value.log.shift()
    }

    function pushChat(msg) {
        if (!gameState.value) return
        gameState.value.chat.push(msg)
        if (gameState.value.chat.length > 300) gameState.value.chat.shift()
        saveGameChat('monopoly', gameState.value.chat, useSettingsStore().gameChatMemory)
    }

    function activePlayers() {
        return (gameState.value && Array.isArray(gameState.value.players)) ? gameState.value.players.filter(p => !p.bankrupt) : []
    }

    function ownerOf(tileId) {
        if (!gameState.value || !gameState.value.players) return null
        const p = gameState.value.players.find(pl => pl.properties.includes(tileId))
        return p || null
    }

    function ownsFullGroup(player, group) {
        if (!player || !group) return false
        const ids = groupTileIds(group)
        return ids.every(id => player.properties.includes(id))
    }

    function netWorth(player) {
        if (!player) return 0
        let w = player.cash || 0
        for (const id of player.properties || []) {
            const t = tileById(id)
            if (!t) continue
            w += (t.price || 0) + (player.houses[id] || 0) * houseCostOf(t)
        }
        return w
    }

    // ---------- 角色技能 ----------
    function getCharacterOf(player) {
        if (!player) return DEFAULT_CHARACTER
        return getCharacter(player.characterId)
    }

    // 触发角色技能
    function triggerSkill(player, trigger, ctx = {}) {
        if (!player) return
        const char = getCharacterOf(player)
        if (!char.skill) return
        if (char.skill.trigger !== trigger) return

        switch (char.id) {
            case 'pudding': // 贪吃福利：路过起点 +50
                if (trigger === 'passGo') {
                    player.cash += 50
                    logEvent(`🐟 ${player.name}（布丁）贪吃福利触发，额外 +¥50 小鱼干！`)
                }
                break
            case 'nuomi': // 幸运双骰：双骰概率+10%（在 rollDice 里处理）
                break
            case 'coco': // 精明商人：买地9折/收租+10%
                if (trigger === 'buy') {
                    const discount = Math.round(ctx.price * 0.1)
                    player.cash += discount
                    logEvent(`🐈 ${player.name}（可可）精明商人，买地返 ¥${discount}！`)
                } else if (trigger === 'getRent') {
                    const bonus = Math.round(ctx.amount * 0.1)
                    player.cash += bonus
                    logEvent(`🐈 ${player.name}（可可）精明商人，收租额外 +¥${bonus}！`)
                }
                break
            case 'tuanzi': // 捣蛋柯基：每3回合指定玩家过路费减半（简化：自动选最富的对手）
                if (trigger === 'turnStart' && player.skillCooldown <= 0) {
                    const opponents = activePlayers().filter(p => p.id !== player.id && !p.bankrupt)
                    if (opponents.length > 0) {
                        const target = opponents.sort((a, b) => b.cash - a.cash)[0]
                        target.activeEffects.halfRent = true
                        logEvent(`🐕 ${player.name}（团子）捣蛋柯基！${target.name} 下次交租减半！`)
                        const chat = generateAiChat(player.characterId, 'goodCard')
                        if (chat) pushChat({ role: 'ai', name: player.name, content: chat })
                    }
                    player.skillCooldown = 3
                }
                break
            case 'naicha': // 温柔选择：抽卡多看一张（在 drawCard 逻辑里处理）
                break
            case 'doudou': // 勇敢柴犬：入狱50%概率越狱
                if (trigger === 'onJail') {
                    if (Math.random() < 0.5) {
                        player.inJail = false
                        player.jailTurns = 0
                        logEvent(`🦊 ${player.name}（豆豆）勇敢柴犬！成功越狱！`)
                        const chat = generateAiChat(player.characterId, 'goodCard')
                        if (chat) pushChat({ role: 'ai', name: player.name, content: chat })
                    }
                }
                break
            case 'xuehua': // 高冷撒娇：被收租20%免单
                if (trigger === 'onPayRent') {
                    if (Math.random() < 0.2) {
                        ctx.amount = 0
                        logEvent(`😾 ${player.name}（雪花）高冷撒娇！本次租金免单！`)
                        const chat = generateAiChat(player.characterId, 'goodCard')
                        if (chat) pushChat({ role: 'ai', name: player.name, content: chat })
                        return true // 免单
                    }
                }
                break
            case 'oreo': // 策略大师：每5回合看牌堆顶3张（简化：提示效果）
                if (trigger === 'turnStart' && player.skillCooldown <= 0) {
                    logEvent(`🐕‍🦺 ${player.name}（奥利奥）策略大师！洞察了牌堆趋势！`)
                    player.skillCooldown = 5
                }
                break
        }
        return false
    }

    // ---------- 租金 ----------
    function computeRent(tile, owner, diceSum) {
        if (!tile || !owner || !gameState.value || !Array.isArray(gameState.value.players)) return 0
        if (tile.type === 'station') {
            const owned = BOARD.filter(t => t.type === 'station' && ownerOf(t.id) === owner).length
            return 25 * Math.pow(2, Math.max(0, owned - 1))
        }
        if (tile.type === 'utility') {
            const owned = BOARD.filter(t => t.type === 'utility' && ownerOf(t.id) === owner).length
            return diceSum * (owned >= 2 ? 10 : 4)
        }
        if (tile.type === 'property') {
            const base = baseRentOf(tile)
            const mono = ownsFullGroup(owner, tile.group)
            const h = owner.houses[tile.id] || 0
            let rent = base * (mono ? 2 : 1)
            if (h > 0) rent = Math.round(base * (1 + 0.6 * h) * (mono ? 2 : 1))
            // 冻结地产不收租
            if (gameState.value.frozenProperties[tile.id] > 0) {
                logEvent(`❄️ ${tile.name} 被冻结，本回合不收租。`)
                return 0
            }
            return rent
        }
        return 0
    }

    // ---------- 道具卡 ----------
    function drawItemCard(playerId) {
        const gs = gameState.value
        if (!gs) return
        const p = gs.players.find(pl => pl.id === playerId)
        if (!p || p.itemCards.length >= MAX_HAND_SIZE) return
        const card = drawRandomCard()
        p.itemCards.push(card.id)
        logEvent(`🎴 ${p.name} 获得道具卡：${card.name}`)
    }

    function useItemCard(cardId, target) {
        const gs = gameState.value
        if (!gs) return false
        const p = currentPlayer.value
        if (!p) return false
        if (p.activeEffects.blockCards) {
            logEvent(`🌫️ ${p.name} 被迷雾弹影响，无法使用道具卡！`)
            return false
        }
        const cardIdx = p.itemCards.indexOf(cardId)
        if (cardIdx < 0) return false
        const card = getItemCard(cardId)
        if (!card) return false

        // 执行效果
        const result = executeCardEffect(card, p, target)
        if (!result) return false

        // 移除卡牌
        p.itemCards.splice(cardIdx, 1)
        gs.lastUsedCard = cardId
        gs.cardAnimation = { cardId: card.id, playerName: p.name, cardName: card.name, cardDesc: card.desc, cardType: card.type }
        logEvent(`🎴 ${p.name} 使用了 ${card.name}！`)
        saveState()
        return true
    }

    function executeCardEffect(card, player, target) {
        const gs = gameState.value
        const eff = card.effect
        switch (eff.action) {
            case 'forceDice':
                gs._forceDice = target // 1-6
                logEvent(`🎲 ${player.name} 使用遥控骰子，指定掷出 ${target} 点！`)
                return true
            case 'teleportTo':
                moveTo(target, player, true)
                return true
            case 'moveBack': {
                const steps = eff.min + Math.floor(Math.random() * (eff.max - eff.min + 1))
                moveTo((player.position - steps + BOARD_SIZE) % BOARD_SIZE, player, false)
                return true
            }
            case 'extraRoll':
                player.activeEffects.extraRoll = true
                logEvent(`👟 ${player.name} 穿上弹簧鞋，本回合额外掷一次！`)
                return true
            case 'moveBonus':
                player.activeEffects.moveBonus += eff.steps
                logEvent(`🛴 ${player.name} 用了滑板车，下次移动 +${eff.steps} 格！`)
                return true
            case 'noRentThisTurn':
                player.activeEffects.noRent = true
                logEvent(`🫥 ${player.name} 披上隐形斗篷，本次经过地产不付租！`)
                return true
            case 'goToNextStation': {
                const nextStation = findNextTile(player.position, 'station')
                moveTo(nextStation, player, true)
                return true
            }
            case 'goToNextChance': {
                const nextChance = findNextTile(player.position, 'chance')
                moveTo(nextChance, player, true)
                return true
            }
            case 'limitMove': {
                const targetPlayer = gs.players.find(pl => pl.id === target)
                if (!targetPlayer) return false
                targetPlayer.activeEffects.limitMove = { min: eff.min, max: eff.max }
                logEvent(`🍌 ${targetPlayer.name} 踩到香蕉皮，下回合只能走 ${eff.min}-${eff.max} 格！`)
                const chat = generateAiChat(player.characterId, 'tauntUser')
                if (chat) pushChat({ role: 'ai', name: player.name, content: chat })
                return true
            }
            case 'stealCash': {
                const targetPlayer = gs.players.find(pl => pl.id === target)
                if (!targetPlayer) return false
                const stolen = Math.min(targetPlayer.cash, eff.amount)
                targetPlayer.cash -= stolen
                player.cash += stolen
                logEvent(`🤏 ${player.name} 从 ${targetPlayer.name} 偷了 ¥${stolen}！`)
                return true
            }
            case 'demolishHouse': {
                const targetTile = tileById(target)
                if (!targetTile) return false
                const owner = ownerOf(target)
                if (!owner || owner.id === player.id) return false
                const cur = owner.houses[target] || 0
                if (cur <= 0) return false
                owner.houses[target] = cur - 1
                logEvent(`🔨 ${player.name} 拆了 ${owner.name} 的 ${targetTile.name} 1 级房屋！`)
                return true
            }
            case 'blockBuild': {
                const targetPlayer = gs.players.find(pl => pl.id === target)
                if (!targetPlayer) return false
                targetPlayer.activeEffects.blockBuild = true
                logEvent(`🧴 ${targetPlayer.name} 被捣蛋喷雾，本回合不能盖房！`)
                return true
            }
            case 'doubleRentNext':
                player.activeEffects.doubleRentNext = true
                logEvent(`💰 ${player.name} 使用租金翻倍卡，下次收租翻倍！`)
                return true
            case 'forcedTrade': {
                const targetTile = tileById(target)
                if (!targetTile) return false
                const owner = ownerOf(target)
                if (!owner || owner.id === player.id) return false
                if (player.cash < targetTile.price) return false
                player.cash -= targetTile.price
                owner.cash += targetTile.price
                owner.properties = owner.properties.filter(id => id !== target)
                player.properties.push(target)
                if (owner.houses[target]) {
                    player.houses[target] = owner.houses[target]
                    delete owner.houses[target]
                }
                logEvent(`🔄 ${player.name} 强制交易！花 ¥${targetTile.price} 买下 ${owner.name} 的 ${targetTile.name}！`)
                return true
            }
            case 'blockCards': {
                const targetPlayer = gs.players.find(pl => pl.id === target)
                if (!targetPlayer) return false
                targetPlayer.activeEffects.blockCards = true
                logEvent(`🌫️ ${targetPlayer.name} 被迷雾弹，下回合不能用道具卡！`)
                return true
            }
            case 'setTrap': {
                gs.trappedProperties[target] = eff.amount
                logEvent(`🕳️ ${player.name} 在 ${tileById(target)?.name} 设了陷阱（¥${eff.amount}）！`)
                return true
            }
            case 'shieldRent':
                player.activeEffects.shield = true
                logEvent(`🛡️ ${player.name} 开启护盾，免疫下一次租金！`)
                return true
            case 'halfRent':
                player.activeEffects.halfRent = true
                logEvent(`🐱 ${player.name} 使用撒娇卡，本回合租金减半！`)
                return true
            case 'immunityJail':
                player.activeEffects.immunityJail = true
                logEvent(`🎖️ ${player.name} 使用免罪金牌，免疫一次入狱！`)
                return true
            case 'rentInsurance':
                player.activeEffects.rentInsurance = true
                logEvent(`📋 ${player.name} 购买保险，被收租返还 50%！`)
                return true
            case 'friendshipTreaty': {
                const targetPlayer = gs.players.find(pl => pl.id === target)
                if (!targetPlayer) return false
                // 简化：给自己加一个标记
                player.activeEffects._friendshipTarget = target
                player.activeEffects._friendshipTurns = eff.turns
                logEvent(`🤝 ${player.name} 和 ${targetPlayer.name} 签订友谊条约！`)
                return true
            }
            case 'counterClaw':
                player.activeEffects.counterClaw = true
                logEvent(`🐾 ${player.name} 装备反击爪，被收租反弹 30%！`)
                return true
            case 'addCash':
                player.cash += eff.amount
                logEvent(`💰 ${player.name} 使用 ${card.name}，获得 ¥${eff.amount}！`)
                return true
            case 'loan':
                player.cash += eff.amount
                player.activeEffects._loanPerTurn = eff.perTurn
                player.activeEffects._loanTurnsLeft = eff.turns
                logEvent(`🏦 ${player.name} 签了贷款合同，获得 ¥${eff.amount}（${eff.turns} 回合每回合扣 ¥${eff.perTurn}）`)
                return true
            case 'lottery':
                if (Math.random() < 0.5) {
                    player.cash += eff.win
                    logEvent(`🎰 ${player.name} 彩票中奖！获得 ¥${eff.win}！`)
                } else {
                    player.cash -= eff.lose
                    logEvent(`🎰 ${player.name} 彩票没中，损失 ¥${eff.lose}。`)
                }
                return true
            case 'dividend': {
                let total = 0
                for (const id of player.properties) {
                    const t = tileById(id)
                    if (t) total += baseRentOf(t)
                }
                const gain = Math.round(total * 0.5)
                player.cash += gain
                logEvent(`📊 ${player.name} 投资分红，获得 ¥${gain}！`)
                return true
            }
            case 'emergencySave':
                // 被动卡，在破产时触发
                logEvent(`🐷 ${player.name} 召唤紧急存钱罐！`)
                player.cash += eff.amount
                return true
            case 'swapProperty': {
                const targetPlayer = gs.players.find(pl => pl.id === target)
                if (!targetPlayer || targetPlayer.properties.length === 0 || player.properties.length === 0) return false
                // 交换各自的第一个地产
                const myProp = player.properties[0]
                const theirProp = targetPlayer.properties[0]
                player.properties[0] = theirProp
                targetPlayer.properties[0] = myProp
                if (player.houses[myProp]) {
                    targetPlayer.houses[myProp] = player.houses[myProp]
                    delete player.houses[myProp]
                }
                if (targetPlayer.houses[theirProp]) {
                    player.houses[theirProp] = targetPlayer.houses[theirProp]
                    delete targetPlayer.houses[theirProp]
                }
                logEvent(`🔄 ${player.name} 和 ${targetPlayer.name} 交换了地产！`)
                return true
            }
            case 'freezeProperty':
                gs.frozenProperties[target] = eff.turns
                logEvent(`❄️ ${player.name} 冻结了 ${tileById(target)?.name}，${eff.turns} 回合不收租！`)
                return true
            case 'copyLastCard': {
                if (!gs.lastUsedCard) return false
                const lastCard = getItemCard(gs.lastUsedCard)
                if (!lastCard) return false
                return executeCardEffect(lastCard, player, target)
            }
            case 'wishCard': {
                const rareCards = ITEM_CARDS.filter(c => RARITY[c.rarity].weight <= 30)
                const newCard = rareCards[Math.floor(Math.random() * rareCards.length)]
                if (player.itemCards.length < MAX_HAND_SIZE) {
                    player.itemCards.push(newCard.id)
                    logEvent(`⭐ ${player.name} 许愿成功！获得 ${newCard.name}！`)
                }
                return true
            }
            default:
                return false
        }
    }

    function findNextTile(fromPos, type) {
        for (let i = 1; i <= BOARD_SIZE; i++) {
            const pos = (fromPos + i) % BOARD_SIZE
            if (BOARD[pos].type === type) return pos
        }
        return fromPos
    }

    // ---------- 掷骰 ----------
    function rollDice() {
        const gs = gameState.value
        if (!gs || gs.phase !== 'rolling') return
        const p = currentPlayer.value
        if (!p || p.bankrupt || p.inJail) return

        // 技能冷却递减
        if (p.skillCooldown > 0) p.skillCooldown--

        // 回合开始触发技能
        triggerSkill(p, 'turnStart')

        // 贷款还款
        if (p.activeEffects._loanTurnsLeft > 0) {
            const pay = p.activeEffects._loanPerTurn
            p.cash -= pay
            p.activeEffects._loanTurnsLeft--
            logEvent(`🏦 ${p.name} 还贷款 ¥${pay}（剩余 ${p.activeEffects._loanTurnsLeft} 期）`)
            if (p.activeEffects._loanTurnsLeft <= 0) {
                p.activeEffects._loanPerTurn = 0
            }
        }

        let d1, d2
        // 遥控骰子
        if (gs._forceDice) {
            d1 = gs._forceDice
            d2 = 1 + Math.floor(Math.random() * 6)
            gs._forceDice = null
        } else {
            d1 = 1 + Math.floor(Math.random() * 6)
            d2 = 1 + Math.floor(Math.random() * 6)
            // 糯米技能：双骰概率+10%
            const char = getCharacterOf(p)
            if (char.id === 'nuomi' && d1 !== d2 && Math.random() < 0.1) {
                d2 = d1 // 强制双骰
                logEvent(`🐶 ${p.name}（糯米）幸运双骰触发！`)
            }
        }

        // 限制移动
        if (p.activeEffects.limitMove) {
            const max = p.activeEffects.limitMove.max
            const min = p.activeEffects.limitMove.min
            const forced = min + Math.floor(Math.random() * (max - min + 1))
            d1 = Math.ceil(forced / 2)
            d2 = forced - d1
            p.activeEffects.limitMove = null
            logEvent(`🍌 ${p.name} 受香蕉皮影响，只走了 ${forced} 格！`)
        }

        gs.dice = [d1, d2]
        let steps = d1 + d2
        // 移动加成
        if (p.activeEffects.moveBonus > 0) {
            steps += p.activeEffects.moveBonus
            p.activeEffects.moveBonus = 0
        }
        const from = p.position
        const finalPos = (from + steps) % BOARD_SIZE
        const passedGo = (from + steps) >= BOARD_SIZE
        const path = []
        for (let i = 1; i <= steps; i++) path.push((from + i) % BOARD_SIZE)
        gs.pendingMove = { playerId: p.id, from, steps, finalPos, passedGo, path, jailRelease: false }
        if (d1 === d2) gs.doublesCount++
        else gs.doublesCount = 0

        // 三次双骰进监狱（糯米除外）
        const charId = getCharacterOf(p).id
        if (gs.doublesCount >= 3 && charId !== 'nuomi') {
            logEvent(`🎲 ${p.name} 连续三次双骰，被请进寄养所！`)
            gs.pendingMove = { playerId: p.id, from, steps: 0, finalPos: JAIL_TILE, passedGo: false, path: [], jailRelease: false, toJail: true }
            gs.doublesCount = 0
        }
        gs.phase = 'moving'
        saveState()
    }

    // ---------- 监狱处理 ----------
    function jailPay() {
        const gs = gameState.value
        const p = currentPlayer.value
        if (!gs || !p || !p.inJail || gs.phase !== 'rolling') return
        if (p.cash < GET_OUT_FEE) return
        p.cash -= GET_OUT_FEE
        p.inJail = false
        p.jailTurns = 0
        gs.freeParkingPot += GET_OUT_FEE
        logEvent(`🔓 ${p.name} 缴纳 ¥${GET_OUT_FEE} 保释出狱。`)
        const chat = generateAiChat(p.characterId, 'jail')
        if (chat) pushChat({ role: 'ai', name: p.name, content: chat })
        gs.phase = 'rolling'
        saveState()
    }

    function jailUseCard() {
        const gs = gameState.value
        const p = currentPlayer.value
        if (!gs || !p || !p.inJail || gs.phase !== 'rolling' || p.getOutCards <= 0) return
        p.getOutCards--
        p.inJail = false
        p.jailTurns = 0
        logEvent(`🔓 ${p.name} 使用免费出狱卡离狱。`)
        pushChat({ role: 'ai', name: p.name, content: '正好有张出狱卡，溜了~' })
        gs.phase = 'rolling'
        saveState()
    }

    function jailRoll() {
        const gs = gameState.value
        const p = currentPlayer.value
        if (!gs || !p || !p.inJail || gs.phase !== 'rolling') return
        const d1 = 1 + Math.floor(Math.random() * 6)
        const d2 = 1 + Math.floor(Math.random() * 6)
        gs.dice = [d1, d2]
        if (d1 === d2) {
            p.inJail = false
            p.jailTurns = 0
            logEvent(`🎲 ${p.name} 掷出双骰，出狱并移动 ${d1 + d2} 格。`)
            const from = p.position, steps = d1 + d2
            const finalPos = (from + steps) % BOARD_SIZE
            const passedGo = (from + steps) >= BOARD_SIZE
            const path = []
            for (let i = 1; i <= steps; i++) path.push((from + i) % BOARD_SIZE)
            gs.pendingMove = { playerId: p.id, from, steps, finalPos, passedGo, path, jailRelease: true }
            gs.phase = 'moving'
        } else {
            p.jailTurns++
            logEvent(`🎲 ${p.name} 未掷出双骰（第 ${p.jailTurns} 次），继续蹲寄养所。`)
            const chat = generateAiChat(p.characterId, 'jail')
            if (chat) pushChat({ role: 'ai', name: p.name, content: chat })
            if (p.jailTurns >= 3) {
                if (p.cash >= GET_OUT_FEE) {
                    p.cash -= GET_OUT_FEE
                    gs.freeParkingPot += GET_OUT_FEE
                    p.inJail = false
                    p.jailTurns = 0
                    logEvent(`🔓 ${p.name} 蹲满 3 回合，缴纳 ¥${GET_OUT_FEE} 出狱。`)
                } else {
                    bankruptTo(p, null, GET_OUT_FEE)
                    return
                }
            }
            endTurn()
        }
        saveState()
    }

    // ---------- 应用移动 ----------
    function applyMove() {
        const gs = gameState.value
        if (!gs || gs.phase !== 'moving' || !gs.pendingMove) return
        const mv = gs.pendingMove
        const p = gs.players.find(pl => pl.id === mv.playerId)
        if (!p) return
        gs.pendingMove = null
        if (mv.toJail) {
            // 免疫入狱
            if (p.activeEffects.immunityJail) {
                p.activeEffects.immunityJail = false
                logEvent(`🎖️ ${p.name} 免罪金牌触发，免疫入狱！`)
                afterResolve(p)
                saveState()
                return
            }
            p.position = JAIL_TILE
            p.inJail = true
            p.jailTurns = 0
            triggerSkill(p, 'onJail')
            logEvent(`🚔 ${p.name} 被送进寄养所。`)
            if (!p.inJail) {
                // 豆豆越狱了
                afterResolve(p)
            } else {
                afterResolve(p)
            }
            saveState()
            return
        }
        p.position = mv.finalPos
        if (mv.passedGo || mv.finalPos === 0) {
            p.cash += GO_SALARY
            logEvent(`💰 ${p.name} 路过镇中心广场，领取工资 ¥${GO_SALARY}。`)
            triggerSkill(p, 'passGo')
        }
        // 陷阱检查
        if (gs.trappedProperties[mv.finalPos]) {
            const trapAmt = gs.trappedProperties[mv.finalPos]
            delete gs.trappedProperties[mv.finalPos]
            p.cash -= trapAmt
            logEvent(`🕳️ ${p.name} 踩到陷阱，损失 ¥${trapAmt}！`)
            if (p.cash < 0) { p.cash = 0; bankruptTo(p, null, trapAmt); return }
        }
        resolveTile(mv.finalPos, { diceSum: gs.dice[0] + gs.dice[1] })
        saveState()
    }

    // ---------- 落格结算 ----------
    function resolveTile(pos, ctx) {
        const gs = gameState.value
        const p = currentPlayer.value
        const tile = tileById(pos)
        const diceSum = ctx?.diceSum || (gs.dice[0] + gs.dice[1])

        switch (tile.type) {
            case 'go':
                break
            case 'property':
            case 'station':
            case 'utility': {
                const owner = ownerOf(tile.id)
                if (!owner) {
                    if (p.isUser) {
                        gs.awaitingBuy = tile.id
                        gs.phase = 'action'
                        logEvent(`🏠 ${p.name} 停在 ${tile.name}（¥${tile.price}），等待决策。`)
                    } else {
                        aiDecideBuy(tile, p)
                        afterResolve(p)
                    }
                } else if (owner.id === p.id) {
                    logEvent(`🏠 ${p.name} 回到自己的 ${tile.name}。`)
                    afterResolve(p)
                } else {
                    // 隐形斗篷
                    if (p.activeEffects.noRent) {
                        p.activeEffects.noRent = false
                        logEvent(`🫥 ${p.name} 隐形斗篷触发，免付租金！`)
                        afterResolve(p)
                        break
                    }
                    let rent = computeRent(tile, owner, diceSum)
                    // 收租翻倍
                    if (owner.activeEffects.doubleRentNext) {
                        rent *= 2
                        owner.activeEffects.doubleRentNext = false
                        logEvent(`💰 ${owner.name} 租金翻倍卡触发！租金变为 ¥${rent}！`)
                    }
                    // 雪花撒娇
                    const skipRent = triggerSkill(p, 'onPayRent', { amount: rent })
                    if (skipRent) {
                        afterResolve(p)
                        break
                    }
                    // 撒娇卡
                    if (p.activeEffects.halfRent) {
                        rent = Math.ceil(rent / 2)
                        p.activeEffects.halfRent = false
                        logEvent(`🐱 ${p.name} 撒娇成功，租金减半为 ¥${rent}！`)
                    }
                    // 护盾
                    if (p.activeEffects.shield) {
                        p.activeEffects.shield = false
                        logEvent(`🛡️ ${p.name} 护盾触发，免疫租金 ¥${rent}！`)
                        afterResolve(p)
                        break
                    }
                    // 可可收租加成
                    triggerSkill(owner, 'getRent', { amount: rent })
                    payTo(p, owner, rent, `租金 ¥${rent}（${tile.name}）`)
                    // 反击爪
                    if (p.activeEffects.counterClaw && rent > 0) {
                        const counter = Math.round(rent * 0.3)
                        owner.cash -= counter
                        p.cash += counter
                        p.activeEffects.counterClaw = false
                        logEvent(`🐾 ${p.name} 反击爪触发，反弹 ¥${counter} 给 ${owner.name}！`)
                    }
                    // 保险
                    if (p.activeEffects.rentInsurance) {
                        const refund = Math.round(rent * 0.5)
                        p.cash += refund
                        p.activeEffects.rentInsurance = false
                        logEvent(`📋 ${p.name} 保险理赔，返还 ¥${refund}！`)
                    }
                    afterResolve(p)
                }
                break
            }
            case 'tax': {
                const amt = tile.amount
                logEvent(`🧾 ${p.name} 在 ${tile.name} 缴费 ¥${amt}。`)
                const paid = Math.min(p.cash, amt)
                p.cash -= paid
                gs.freeParkingPot += paid
                if (p.cash < 0) { p.cash = 0; bankruptTo(p, null, amt) }
                else afterResolve(p)
                break
            }
            case 'parking': {
                const pot = gs.freeParkingPot
                if (pot > 0) {
                    p.cash += pot
                    logEvent(`🅿️ ${p.name} 停在阳光草坪，拿走奖池 ¥${pot}！`)
                    gs.freeParkingPot = 0
                } else {
                    logEvent(`🅿️ ${p.name} 停在阳光草坪，奖池为空。`)
                }
                afterResolve(p)
                break
            }
            case 'jail':
                logEvent(`🔒 ${p.name} 探监（寄养所），虚惊一场。`)
                afterResolve(p)
                break
            case 'gotojail':
                // 免疫入狱
                if (p.activeEffects.immunityJail) {
                    p.activeEffects.immunityJail = false
                    logEvent(`🎖️ ${p.name} 免罪金牌触发，免疫入狱！`)
                    afterResolve(p)
                    break
                }
                p.position = JAIL_TILE
                p.inJail = true
                p.jailTurns = 0
                triggerSkill(p, 'onJail')
                logEvent(`🚔 ${p.name} 被管理员抓进寄养所！`)
                const jailChat = generateAiChat(p.characterId, 'jail')
                if (jailChat) pushChat({ role: 'ai', name: p.name, content: jailChat })
                afterResolve(p)
                break
            case 'chance':
            case 'chest': {
                const deck = tile.type === 'chance' ? gs.chanceDeck : gs.chestDeck
                const cardIdx = deck.length ? deck.pop() : 0
                const card = (tile.type === 'chance' ? CHANCE_CARDS : CHEST_CARDS)[cardIdx]
                logEvent(`🎴 ${p.name} 抽到${tile.name}：${card.text}`)
                // 奶茶技能：多看一张（简化：50%概率换更好的）
                const char = getCharacterOf(p)
                if (char.id === 'naicha' && deck.length > 0 && Math.random() < 0.5) {
                    const altIdx = deck.pop()
                    const altCard = (tile.type === 'chance' ? CHANCE_CARDS : CHEST_CARDS)[altIdx]
                    // 选金额更大的
                    const cardAmt = card.amount || 0
                    const altAmt = altCard.amount || 0
                    const chosen = altAmt > cardAmt ? altCard : card
                    logEvent(`😺 ${p.name}（奶茶）温柔选择，挑了更好的卡！`)
                    applyCard(chosen, p)
                } else {
                    applyCard(card, p)
                }
                break
            }
            default:
                afterResolve(p)
        }
    }

    function applyCard(card, p) {
        const gs = gameState.value
        const isGood = (card.type === 'money' && card.amount > 0) || card.type === 'jailcard'
        switch (card.type) {
            case 'money':
                if (card.amount >= 0) {
                    p.cash += card.amount
                } else {
                    const amt = -card.amount
                    const paid = Math.min(p.cash, amt)
                    p.cash -= paid
                    gs.freeParkingPot += paid
                    if (p.cash < 0) { p.cash = 0; bankruptTo(p, null, amt); return }
                }
                break
            case 'jailcard':
                p.getOutCards++
                break
            case 'gotojail':
                if (p.activeEffects.immunityJail) {
                    p.activeEffects.immunityJail = false
                    logEvent(`🎖️ ${p.name} 免罪金牌触发，免疫入狱！`)
                    break
                }
                p.position = JAIL_TILE
                p.inJail = true
                p.jailTurns = 0
                triggerSkill(p, 'onJail')
                logEvent(`🚔 ${p.name} 因卡牌被送进寄养所！`)
                break
            case 'togo':
                moveTo(card.target, p, true)
                return
            case 'forward':
                moveTo((p.position + card.steps) % BOARD_SIZE, p, true)
                return
            case 'back':
                moveTo((p.position - card.steps + BOARD_SIZE) % BOARD_SIZE, p, false)
                return
        }
        // AI 聊天
        if (!p.isUser) {
            const chatType = isGood ? 'goodCard' : 'badCard'
            const chat = generateAiChat(p.characterId, chatType)
            if (chat) pushChat({ role: 'ai', name: p.name, content: chat })
        }
        afterResolve(p)
    }

    function moveTo(target, p, forward) {
        const gs = gameState.value
        const from = p.position
        if (target === 0 && forward && from !== 0) {
            p.cash += GO_SALARY
            logEvent(`💰 ${p.name} 回到镇中心广场，领取工资 ¥${GO_SALARY}。`)
            triggerSkill(p, 'passGo')
        }
        p.position = target
        if (target === JAIL_TILE) {
            logEvent(`🔒 ${p.name} 移动到寄养所（探监）。`)
        }
        resolveTile(target, { diceSum: gs.dice[0] + gs.dice[1] })
    }

    // ---------- 支付 / 破产 ----------
    function payTo(payer, receiver, amount, label) {
        const gs = gameState.value
        const paid = Math.min(payer.cash, amount)
        payer.cash -= paid
        if (receiver && !receiver.bankrupt) receiver.cash += paid
        else gs.freeParkingPot += (receiver ? 0 : paid)
        if (payer.cash < 0) { payer.cash = 0; bankruptTo(payer, receiver, amount); return }
        logEvent(`💸 ${payer.name} 向 ${receiver ? receiver.name : '银行'} 支付 ${label}。`)
        // AI 聊天
        if (!payer.isUser) {
            const chat = generateAiChat(payer.characterId, 'payRent')
            if (chat) pushChat({ role: 'ai', name: payer.name, content: chat })
        }
        if (receiver && !receiver.isUser) {
            const chat = generateAiChat(receiver.characterId, 'getRent')
            if (chat) pushChat({ role: 'ai', name: receiver.name, content: chat })
        }
    }

    function bankruptTo(p, creditor, amount) {
        const gs = gameState.value
        // 紧急存钱罐
        const hasEmergency = p.itemCards.includes('emergency_piggy')
        if (hasEmergency) {
            const idx = p.itemCards.indexOf('emergency_piggy')
            p.itemCards.splice(idx, 1)
            p.cash += 300
            logEvent(`🐷 ${p.name} 紧急存钱罐触发，获得 ¥300！`)
            if (p.cash >= 0) return // 救回来了
        }
        p.bankrupt = true
        logEvent(`💥 ${p.name} 破产出局！`)
        const chat = generateAiChat(p.characterId, 'bankrupt')
        if (chat) pushChat({ role: 'ai', name: p.name, content: chat })
        if (creditor && !creditor.bankrupt) {
            for (const id of p.properties) {
                creditor.properties.push(id)
                if (p.houses[id]) {
                    creditor.houses[id] = (creditor.houses[id] || 0) + p.houses[id]
                }
            }
        }
        p.properties = []
        p.houses = {}
        if (activePlayers().length <= 1) {
            finishGame()
        }
    }

    // ---------- 买地 / 盖房 ----------
    function buyProperty(tileId) {
        const gs = gameState.value
        if (!gs || gs.awaitingBuy !== tileId) return
        const p = currentPlayer.value
        const tile = tileById(tileId)
        if (p.cash < tile.price) return
        p.cash -= tile.price
        p.properties.push(tileId)
        gs.awaitingBuy = null
        logEvent(`🏠 ${p.name} 买下 ${tile.name}（¥${tile.price}）。`)
        // 可可技能：买地返现
        triggerSkill(p, 'buy', { price: tile.price })
        // AI 聊天
        if (!p.isUser) {
            const chat = generateAiChat(p.characterId, 'buy')
            if (chat) pushChat({ role: 'ai', name: p.name, content: chat })
        } else {
            pushChat({ role: 'ai', name: p.name, content: `我拿下了 ${tile.name}！` })
        }
        if (ownsFullGroup(p, tile.group)) {
            logEvent(`🎉 ${p.name} 集齐 ${GROUPS[tile.group].name} 组，可盖房！`)
        }
        afterResolve(p)
        saveState()
    }

    function skipBuy() {
        const gs = gameState.value
        if (!gs || gs.awaitingBuy == null) return
        const p = currentPlayer.value
        const tile = tileById(gs.awaitingBuy)
        gs.awaitingBuy = null
        logEvent(`⏭️ ${p.name} 放弃购买 ${tile.name}。`)
        afterResolve(p)
        saveState()
    }

    function buildHouse(tileId) {
        const gs = gameState.value
        const p = currentPlayer.value
        const tile = tileById(tileId)
        if (!p || tile.type !== 'property') return
        if (!p.properties.includes(tileId)) return
        if (!ownsFullGroup(p, tile.group)) return
        if (p.activeEffects.blockBuild) {
            logEvent(`🧴 ${p.name} 被捣蛋喷雾影响，不能盖房！`)
            return
        }
        const cur = p.houses[tileId] || 0
        if (cur >= MAX_HOUSES) return
        const cost = houseCostOf(tile)
        if (p.cash < cost) return
        p.cash -= cost
        p.houses[tileId] = cur + 1
        const lvl = HOUSE_LEVELS[cur + 1]
        logEvent(`🏗️ ${p.name} 在 ${tile.name} 升级为「${lvl.name}」（¥${cost}）。`)
        saveState()
    }

    // ---------- AI 决策（人性化）----------
    function aiDecideBuy(tile, p) {
        const char = getCharacterOf(p)
        const group = tile.group
        const ownedInGroup = group ? BOARD.filter(t => t.type === 'property' && t.group === group && ownerOf(t.id) === p).length : 0
        const totalInGroup = group ? groupTileIds(group).length : 0
        // 使用性格驱动决策
        const shouldBuy = aiDecideBuyWithPersonality(p.characterId, p.cash, tile.price, ownedInGroup, totalInGroup)
        if (shouldBuy && p.cash >= tile.price) {
            p.cash -= tile.price
            p.properties.push(tile.id)
            logEvent(`🤖 ${p.name} 买下 ${tile.name}（¥${tile.price}）。`)
            triggerSkill(p, 'buy', { price: tile.price })
            const chat = generateAiChat(p.characterId, 'buy')
            if (chat) pushChat({ role: 'ai', name: p.name, content: chat })
            if (group && ownsFullGroup(p, group)) {
                logEvent(`🎉 ${p.name} 集齐 ${GROUPS[group].name} 组，可盖房！`)
            }
            // 顺手盖房（看性格）
            if (!aiDelayBuild(p.characterId)) {
                aiMaybeBuild(p)
            }
        } else {
            logEvent(`🤖 ${p.name} 放弃 ${tile.name}。`)
        }
    }

    function aiMaybeBuild(p) {
        const groups = {}
        for (const id of p.properties) {
            const g = tileById(id).group
            if (g) (groups[g] = groups[g] || []).push(id)
        }
        for (const g in groups) {
            if (!ownsFullGroup(p, g)) continue
            const ids = groups[g]
            if (Math.random() < 0.5) {
                const id = ids[Math.floor(Math.random() * ids.length)]
                const cur = p.houses[id] || 0
                if (cur < MAX_HOUSES) {
                    const cost = houseCostOf(tileById(id))
                    if (p.cash > cost + 200) {
                        p.cash -= cost
                        p.houses[id] = cur + 1
                        const lvl = HOUSE_LEVELS[cur + 1]
                        logEvent(`🏗️ ${p.name} 在 ${tileById(id).name} 升级为「${lvl.name}」（¥${cost}）。`)
                    }
                }
            }
        }
    }

    // AI 使用道具卡
    function aiTryUseCard(p) {
        if (p.itemCards.length === 0) return false
        if (!aiShouldUseCard(p.characterId)) return false
        // 找一张能用的卡
        const usableCards = p.itemCards.map(id => getItemCard(id)).filter(c => {
            if (!c) return false
            if (c.usablePhase.includes('action') || c.usablePhase.includes('rolling')) return true
            return false
        })
        if (usableCards.length === 0) return false
        // 选一张（优先资源类）
        const sorted = usableCards.sort((a, b) => {
            const order = { resource: 0, defense: 1, move: 2, attack: 3, special: 4 }
            return (order[a.type] || 9) - (order[b.type] || 9)
        })
        const card = sorted[0]
        // 执行
        const target = pickCardTarget(card, p)
        return useItemCard(card.id, target)
    }

    function pickCardTarget(card, p) {
        const gs = gameState.value
        if (card.targetType === 'self') return null
        if (card.targetType === 'player') {
            // 选最富的对手
            const opponents = activePlayers().filter(pl => pl.id !== p.id)
            if (opponents.length === 0) return null
            return opponents.sort((a, b) => b.cash - a.cash)[0].id
        }
        if (card.targetType === 'tile') {
            // 随机一个地产
            const props = BOARD.filter(t => t.type === 'property')
            return props[Math.floor(Math.random() * props.length)].id
        }
        if (card.targetType === 'tile_owned_by_others') {
            const others = activePlayers().filter(pl => pl.id !== p.id && pl.properties.length > 0)
            if (others.length === 0) return null
            const target = others[0]
            return target.properties[Math.floor(Math.random() * target.properties.length)]
        }
        if (card.targetType === 'tile_owned_by_self') {
            if (p.properties.length === 0) return null
            return p.properties[Math.floor(Math.random() * p.properties.length)]
        }
        return null
    }

    // ---------- AI 思考气泡 ----------
    function setAiThinking(playerId) {
        const gs = gameState.value
        if (!gs) return
        const p = gs.players.find(pl => pl.id === playerId)
        if (!p) return
        const text = generateAiThinking(p.characterId)
        gs.aiThinking = { playerId, text, char: getCharacterOf(p) }
    }

    function clearAiThinking() {
        if (gameState.value) gameState.value.aiThinking = null
    }

    // ---------- 回合流转 ----------
    function afterResolve(p) {
        const gs = gameState.value
        if (!gs) return
        // 清理卡牌动画
        gs.cardAnimation = null
        const reroll = gs.doublesCount > 0 && !p.inJail && gs.doublesCount < 3 && !p.bankrupt
        const hasExtraRoll = p.activeEffects.extraRoll
        if (hasExtraRoll) {
            p.activeEffects.extraRoll = false
            gs.awaitingEnd = false
            gs.awaitingReroll = false
            gs.phase = 'rolling'
            return
        }
        if (p.isUser && !p.bankrupt) {
            gs.awaitingEnd = true
            gs.awaitingReroll = reroll
            if (gs.awaitingBuy == null) gs.phase = 'action'
            return
        }
        if (p.bankrupt) { endTurn(); return }
        if (reroll) {
            gs.phase = 'rolling'
        } else {
            endTurn()
        }
    }

    function endTurn() {
        const gs = gameState.value
        if (!gs || gs.phase === 'ended') return
        gs.awaitingBuy = null
        gs.awaitingEnd = false
        gs.awaitingReroll = false
        gs.doublesCount = 0
        gs.aiThinking = null
        // 冻结属性递减
        for (const id in gs.frozenProperties) {
            gs.frozenProperties[id]--
            if (gs.frozenProperties[id] <= 0) delete gs.frozenProperties[id]
        }
        // 清理本回合生效的效果
        if (gs.players[gs.currentTurn]) {
            const p = gs.players[gs.currentTurn]
            p.activeEffects.halfRent = false
            p.activeEffects.blockBuild = false
            p.activeEffects.noRent = false
            p.activeEffects.blockCards = false
            // blockCards 是下回合生效，所以这里恢复
        }
        // 上一玩家如果有 blockCards，恢复
        const prevP = gs.players[gs.currentTurn]
        if (prevP && prevP.activeEffects.blockCards) {
            // 已经生效过，恢复
            prevP.activeEffects.blockCards = false
        }
        let next = gs.currentTurn
        for (let i = 0; i < gs.players.length; i++) {
            next = (next + 1) % gs.players.length
            if (!gs.players[next].bankrupt) break
        }
        if (next <= gs.currentTurn) gs.round++
        gs.currentTurn = next
        // 每回合 15% 概率获得道具卡
        const newPlayer = gs.players[next]
        if (newPlayer && !newPlayer.bankrupt && Math.random() < 0.15) {
            drawItemCard(newPlayer.id)
        }
        if (activePlayers().length <= 1) { finishGame(); return }
        gs.phase = 'rolling'
        saveState()
    }

    function userEndTurn() {
        if (!isUserTurn.value) return
        endTurn()
    }

    function userReroll() {
        const gs = gameState.value
        const p = currentPlayer.value
        if (!gs || !p || !p.isUser || gs.phase !== 'action' || !gs.awaitingReroll) return
        gs.awaitingEnd = false
        gs.awaitingReroll = false
        gs.phase = 'rolling'
        saveState()
    }

    // ---------- 结束 ----------
    function finishGame() {
        const gs = gameState.value
        if (!gs) return
        gs.phase = 'ended'
        const alive = activePlayers()
        let winner
        if (alive.length === 1) winner = alive[0]
        else {
            winner = gs.players.filter(p => !p.bankrupt).sort((a, b) => netWorth(b) - netWorth(a))[0]
        }
        gs.winner = winner ? winner.id : null
        const wName = winner ? winner.name : '无人'
        const wChar = winner ? getCharacterOf(winner) : null
        logEvent(`🏆 帕瓦小镇结束！冠军：${wName}${wChar ? `（${wChar.species}）` : ''}（净资产 ¥${winner ? netWorth(winner) : 0}）`)
        pushChat({ role: 'system', name: '系统', content: `帕瓦小镇结束，冠军是 ${wName}！` })
        sendGameEndNotification()
        saveState()
    }

    function sendGameEndNotification() {
        const chatStore = useChatStore()
        const gs = gameState.value
        if (!gs) return
        const players = gs.players
        const hasRealOpponent = players.some(p => p.id !== 'user' && p.isContact && chatStore.chats[p.id])
        if (!hasRealOpponent) return
        const timestamp = Date.now()
        const formattedTime = new Date(timestamp).toLocaleString('zh-CN', {
            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
        })
        const ranking = [...players].sort((a, b) => netWorth(b) - netWorth(a))
        const winner = gs.winner ? gs.players.find(p => p.id === gs.winner) : null
        const rows = ranking.map((p, i) => {
            const tag = p.bankrupt ? '💥出局' : `¥${netWorth(p)}`
            return `<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;background:rgba(0,0,0,0.05);padding:4px 8px;border-radius:6px;">
                <span>${i + 1}. ${p.name}${p.isUser ? ' (你)' : ''}</span><span style="font-weight:900;">${tag}</span></div>`
        }).join('')
        const htmlContent = `
<div style="background: linear-gradient(135deg, #5DADE2, #2E86C1); border-radius: 20px; padding: 16px; color: white; font-family: system-ui; box-shadow: 0 10px 20px rgba(46, 134, 193, 0.3);">
    <div style="font-weight: 900; font-size: 18px; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 8px;">🐾 帕瓦小镇战报</div>
    <div style="background: rgba(255,255,255,0.15); border-radius: 12px; padding: 12px; margin-bottom: 12px;">
        <div style="font-size: 12px; opacity: 0.85;">本局冠军</div>
        <div style="font-size: 22px; font-weight: 900;">${winner ? winner.name + (winner.isUser ? ' (你)' : '') : '无人'}</div>
    </div>
    <div style="font-size: 11px; font-weight: bold; margin-bottom: 6px;">最终排名:</div>
    ${rows}
    <div style="margin-top: 10px; font-size: 9px; opacity: 0.6; text-align: center;">帕瓦小镇 · ${formattedTime}</div>
</div>`.trim()
        players.forEach(player => {
            if (player.id !== 'user' && player.isContact && chatStore.chats[player.id]) {
                chatStore.addMessage(player.id, {
                    role: 'user',
                    content: `[CARD]${htmlContent}[/CARD]`,
                    timestamp,
                    skipAI: true,
                })
            }
        })
    }

    return {
        // state
        currentRoom, gameState, settings,
        // computed
        hasActiveGame, currentPlayer, isUserTurn,
        // room
        createRoom, addPlayerById, removePlayer, leaveRoom, loadState,
        // game
        startGame, rollDice, applyMove, buyProperty, skipBuy, buildHouse,
        jailPay, jailUseCard, jailRoll, userEndTurn, userReroll, finishGame,
        // item cards
        useItemCard, drawItemCard,
        // AI
        aiDecideBuy, aiMaybeBuild, aiTryUseCard, setAiThinking, clearAiThinking,
        // helpers
        tileById, ownerOf, ownsFullGroup, computeRent, netWorth, baseRentOf, houseCostOf,
        getCharacterOf, triggerSkill,
        GROUPS, HOUSE_LEVELS, CHARACTERS, ITEM_CARD_TYPES, clearState,
    }
})
