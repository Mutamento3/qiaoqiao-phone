/**
 * 大富翁（Monopoly）游戏 store
 * 复用麻将架构：大厅 → 房间(currentRoom + players, 用户固定 index0) → 对局(gameState)。
 * - 2~8 人，骰子移动、买地/付租/车站/公共/机会命运/税/监狱、盖房、破产、胜负。
 * - AI 自动买地/盖房/付租（本地性格化调侃，不调 API）。
 * - 真实角色对手走微信聊天：开局/结束系统通知 + 战报卡（仅真实对手、不给自己、不建"我"）。
 * - 局内聊天持久化复用 gameChatMemory（键 monopoly）。
 */
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
    BOARD, BOARD_SIZE, GROUPS, GO_SALARY, JAIL_TILE, START_CASH, MAX_HOUSES,
    GET_OUT_FEE, CHANCE_CARDS, CHEST_CARDS, MONOPOLY_NPCS, PLAYER_COLORS,
    baseRentOf, groupTileIds, houseCostOf,
} from '../utils/monopoly/monopolyBoard.js'
import { loadGameChat, saveGameChat, clearGameChat } from '../utils/gameChatMemory.js'
import { useChatStore } from './chatStore.js'
import { useSettingsStore } from './settingsStore.js'

const STORAGE_KEY = 'monopoly_current'

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

export const useMonopolyStore = defineStore('monopoly', () => {
    const currentRoom = ref(null) // { id, mode, playerCount, players:[] }
    const gameState = ref(null)   // 见 startGame
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
            // schema 校验：不兼容旧数据直接清空，避免模板读 undefined 字段白屏
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
    function makeUserPlayer(name, avatar) {
        return {
            id: 'user', name, avatar, position: 0, cash: START_CASH,
            isUser: true, isAI: false, properties: [], houses: {},
            getOutCards: 0, inJail: false, jailTurns: 0, bankrupt: false,
            color: PLAYER_COLORS[0],
        }
    }

    function makeNpcPlayer(npc, idx) {
        return {
            id: npc.id, name: npc.name, avatar: npc.avatar, position: 0, cash: START_CASH,
            isUser: false, isAI: true, properties: [], houses: {},
            getOutCards: 0, inJail: false, jailTurns: 0, bankrupt: false,
            color: PLAYER_COLORS[idx % PLAYER_COLORS.length],
        }
    }

    function createRoom({ mode = 'custom', playerCount = 4, userName = '我', userAvatar = '🎭' }) {
        const players = [makeUserPlayer(userName, userAvatar)]
        const room = {
            id: genRoomId(),
            mode,
            playerCount: Math.min(8, Math.max(2, playerCount)),
            players,
        }
        // 快速开始：直接填充 NPC 到目标人数
        if (mode === 'quick') {
            const shuffled = shuffle(MONOPOLY_NPCS)
            for (let i = 1; i < room.playerCount; i++) {
                room.players.push(makeNpcPlayer(shuffled[(i - 1) % shuffled.length], i))
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
        room.players.push({
            id, name, avatar, position: 0, cash: START_CASH,
            isUser: false, isAI: true, properties: [], houses: {},
            getOutCards: 0, inJail: false, jailTurns: 0, bankrupt: false,
            color: PLAYER_COLORS[idx % PLAYER_COLORS.length],
            isContact,
        })
        saveState()
        return true
    }

    function removePlayer(id) {
        const room = currentRoom.value
        if (!room) return
        const idx = room.players.findIndex(p => p.id === id)
        if (idx <= 0) return // 不能移除用户
        room.players.splice(idx, 1)
        saveState()
    }

    function leaveRoom() {
        currentRoom.value = null
        gameState.value = null
        clearState()
    }

    // ---------- 开局 ----------
    function startGame() {
        const room = currentRoom.value
        if (!room || room.players.length < 2) return false
        // 深拷贝玩家（重置位置/资金）
        const players = room.players.map((p, i) => ({
            ...p,
            position: 0, cash: START_CASH, properties: [], houses: {},
            getOutCards: 0, inJail: false, jailTurns: 0, bankrupt: false,
            color: PLAYER_COLORS[i % PLAYER_COLORS.length],
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
        }
        logEvent(`🎲 大富翁开局！${players.length} 名玩家入场，每人启动资金 ¥${START_CASH}。`)
        pushChat({ role: 'system', name: '系统', content: `大富翁开局，${players.length} 人同场竞技，祝好运！` })
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

    // ---------- 租金 ----------
    function computeRent(tile, owner, diceSum) {
        if (!tile || !owner || !gameState.value || !Array.isArray(gameState.value.players)) return 0
        if (tile.type === 'station') {
            const n = gameState.value.players.filter(p => p.properties.includes(tile.id)).length
            // 持有数按 owner 统计
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
            return rent
        }
        return 0
    }

    // ---------- 掷骰（普通）----------
    function rollDice() {
        const gs = gameState.value
        if (!gs || gs.phase !== 'rolling') return
        const p = currentPlayer.value
        if (!p || p.bankrupt || p.inJail) return
        const d1 = 1 + Math.floor(Math.random() * 6)
        const d2 = 1 + Math.floor(Math.random() * 6)
        gs.dice = [d1, d2]
        const steps = d1 + d2
        const from = p.position
        const finalPos = (from + steps) % BOARD_SIZE
        const passedGo = (from + steps) >= BOARD_SIZE
        // 步进路径（供动画）
        const path = []
        for (let i = 1; i <= steps; i++) path.push((from + i) % BOARD_SIZE)
        gs.pendingMove = { playerId: p.id, from, steps, finalPos, passedGo, path, jailRelease: false }
        if (d1 === d2) gs.doublesCount++
        else gs.doublesCount = 0
        // 三次双骰进监狱
        if (gs.doublesCount >= 3) {
            logEvent(`🎲 ${p.name} 连续三次双骰，被请进监狱！`)
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
        pushChat({ role: 'ai', name: p.name, content: `破财消灾，¥${GET_OUT_FEE} 换自由！` })
        // 出狱后仍需掷骰移动（普通掷骰）
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
        pushChat({ role: 'ai', name: p.name, content: `正好有张出狱卡，溜了~` })
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
            // 双骰出狱并移动
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
            logEvent(`🎲 ${p.name} 未掷出双骰（第 ${p.jailTurns} 次），继续蹲监狱。`)
            if (p.jailTurns >= 3) {
                if (p.cash >= GET_OUT_FEE) {
                    p.cash -= GET_OUT_FEE
                    gs.freeParkingPot += GET_OUT_FEE
                    p.inJail = false
                    p.jailTurns = 0
                    logEvent(`🔓 ${p.name} 蹲满 3 回合，缴纳 ¥${GET_OUT_FEE} 出狱。`)
                } else {
                    // 没钱保释 → 破产（交给银行）
                    bankruptTo(p, null, GET_OUT_FEE)
                    return
                }
            }
            // 未出狱，结束回合
            endTurn()
        }
        saveState()
    }

    // ---------- 应用移动（动画结束后调用）----------
    function applyMove() {
        const gs = gameState.value
        if (!gs || gs.phase !== 'moving' || !gs.pendingMove) return
        const mv = gs.pendingMove
        const p = gs.players.find(pl => pl.id === mv.playerId)
        if (!p) return
        gs.pendingMove = null
        if (mv.toJail) {
            p.position = JAIL_TILE
            p.inJail = true
            p.jailTurns = 0
            logEvent(`🚔 ${p.name} 被送进监狱。`)
            afterResolve(p)
            saveState()
            return
        }
        p.position = mv.finalPos
        if (mv.passedGo || mv.finalPos === 0) {
            p.cash += GO_SALARY
            logEvent(`💰 ${p.name} 路过起点，领取工资 ¥${GO_SALARY}。`)
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
                // 落点在起点：补发工资（路过已在 applyMove 发过，这里避免重复：仅当未 passedGo）
                if (!ctx?.passedGoHandled) { /* already handled in applyMove */ }
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
                    const rent = computeRent(tile, owner, diceSum)
                    payTo(p, owner, rent, `租金 ¥${rent}（${tile.name}）`)
                    afterResolve(p)
                }
                break
            }
            case 'tax': {
                const amt = tile.amount
                logEvent(`🧾 ${p.name} 在 ${tile.name} 缴税 ¥${amt}。`)
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
                    logEvent(`🅿️ ${p.name} 停在免费停车，拿走奖池 ¥${pot}！`)
                    gs.freeParkingPot = 0
                } else {
                    logEvent(`🅿️ ${p.name} 停在免费停车，奖池为空。`)
                }
                afterResolve(p)
                break
            }
            case 'jail':
                logEvent(`🔒 ${p.name} 探监（监狱），虚惊一场。`)
                afterResolve(p)
                break
            case 'gotojail':
                p.position = JAIL_TILE
                p.inJail = true
                p.jailTurns = 0
                logEvent(`🚔 ${p.name} 被送进监狱！`)
                afterResolve(p)
                break
            case 'chance':
            case 'chest': {
                const deck = tile.type === 'chance' ? gs.chanceDeck : gs.chestDeck
                const cardIdx = deck.length ? deck.pop() : 0
                const card = (tile.type === 'chance' ? CHANCE_CARDS : CHEST_CARDS)[cardIdx]
                logEvent(`🎴 ${p.name} 抽到${tile.name}：${card.text}`)
                applyCard(card, p)
                break
            }
            default:
                afterResolve(p)
        }
    }

    // ---------- 卡牌效果 ----------
    function applyCard(card, p) {
        const gs = gameState.value
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
                p.position = JAIL_TILE
                p.inJail = true
                p.jailTurns = 0
                logEvent(`🚔 ${p.name} 因卡牌被送进监狱！`)
                break
            case 'togo':
                moveTo(card.target, p, true)
                return // moveTo 内部会 re-resolve
            case 'forward':
                moveTo((p.position + card.steps) % BOARD_SIZE, p, true)
                return
            case 'back':
                moveTo((p.position - card.steps + BOARD_SIZE) % BOARD_SIZE, p, false)
                return
        }
        afterResolve(p)
    }

    // 卡牌触发的瞬移（无动画），forward 过起点发工资
    function moveTo(target, p, forward) {
        const gs = gameState.value
        const from = p.position
        if (target === 0 && forward && from !== 0) {
            p.cash += GO_SALARY
            logEvent(`💰 ${p.name} 回到起点，领取工资 ¥${GO_SALARY}。`)
        }
        p.position = target
        // 落到监狱格等同探监？goto 到 10 视为探监（非进监狱）
        if (target === JAIL_TILE) {
            logEvent(`🔒 ${p.name} 移动到监狱（探监）。`)
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
        if (receiver) {
            maybeBanter(receiver, payer, 'rent', amount)
        }
    }

    function bankruptTo(p, creditor, amount) {
        const gs = gameState.value
        p.bankrupt = true
        logEvent(`💥 ${p.name} 破产出局！`)
        pushChat({ role: 'ai', name: p.name, content: `我破产啦……这局认栽 😵` })
        // 资产转移
        if (creditor && !creditor.bankrupt) {
            for (const id of p.properties) {
                creditor.properties.push(id)
                if (p.houses[id]) {
                    creditor.houses[id] = (creditor.houses[id] || 0) + p.houses[id]
                }
            }
        } else {
            // 归银行：释放所有权与房屋
            for (const id of p.properties) { /* ownerOf 靠 properties 判断，清空即可 */ }
        }
        p.properties = []
        p.houses = {}
        // 检查结束
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
        pushChat({ role: 'ai', name: p.name, content: p.isUser ? `我拿下了 ${tile.name}！` : `嘿嘿，${tile.name} 归我了~` })
        // 同组垄断提示
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
        const cur = p.houses[tileId] || 0
        if (cur >= MAX_HOUSES) return
        const cost = houseCostOf(tile)
        if (p.cash < cost) return
        p.cash -= cost
        p.houses[tileId] = cur + 1
        logEvent(`🏗️ ${p.name} 在 ${tile.name} 盖了${cur + 1 >= MAX_HOUSES ? '旅馆' : cur + 1 + '栋房'}（¥${cost}）。`)
        saveState()
    }

    // ---------- AI 决策 ----------
    function aiDecideBuy(tile, p) {
        const price = tile.price
        if (p.cash < price + 150) return // 留缓冲
        const group = tile.group
        const ownedInGroup = group ? BOARD.filter(t => t.type === 'property' && t.group === group && ownerOf(t.id) === p).length : 0
        const totalInGroup = group ? groupTileIds(group).length : 0
        let prob = 0.55
        if (group && ownedInGroup > 0) prob = 0.9 // 想凑组
        if (group && totalInGroup === 2 && ownedInGroup === 1) prob = 0.95
        if (p.cash > price * 3) prob = Math.min(0.98, prob + 0.2)
        if (Math.random() < prob) {
            p.cash -= price
            p.properties.push(tile.id)
            logEvent(`🤖 ${p.name} 自动买下 ${tile.name}（¥${price}）。`)
            pushChat({ role: 'ai', name: p.name, content: pickBanter('buy', p, tile) })
            if (group && ownsFullGroup(p, group)) {
                logEvent(`🎉 ${p.name} 集齐 ${GROUPS[group].name} 组，可盖房！`)
            }
            // 顺手盖房
            aiMaybeBuild(p)
        } else {
            logEvent(`🤖 ${p.name} 放弃 ${tile.name}。`)
        }
    }

    function aiMaybeBuild(p) {
        // 对每个已垄断的组，随机盖一栋房
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
                        logEvent(`🏗️ ${p.name} 在 ${tileById(id).name} 盖房（¥${cost}）。`)
                    }
                }
            }
        }
    }

    // ---------- 回合流转 ----------
    function afterResolve(p) {
        const gs = gameState.value
        if (!gs) return
        // 用户：等待操作（买地已在 resolve 内处理；这里等结束回合或再掷）
        const reroll = gs.doublesCount > 0 && !p.inJail && gs.doublesCount < 3 && !p.bankrupt
        if (p.isUser && !p.bankrupt) {
            gs.awaitingEnd = true
            gs.awaitingReroll = reroll
            if (gs.awaitingBuy == null) gs.phase = 'action'
            return
        }
        // AI：自动继续
        if (p.bankrupt) { endTurn(); return }
        if (reroll) {
            gs.phase = 'rolling' // 同一玩家再掷
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
        // 下一存活玩家
        let next = gs.currentTurn
        for (let i = 0; i < gs.players.length; i++) {
            next = (next + 1) % gs.players.length
            if (!gs.players[next].bankrupt) break
        }
        // 轮转一圈 → 回合+1
        if (next <= gs.currentTurn) gs.round++
        gs.currentTurn = next
        // 结束条件：存活≤1（破产淘汰制，没有回合上限）
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
            // 按净资产
            winner = gs.players.filter(p => !p.bankrupt).sort((a, b) => netWorth(b) - netWorth(a))[0]
        }
        gs.winner = winner ? winner.id : null
        const wName = winner ? winner.name : '无人'
        logEvent(`🏆 大富翁结束！冠军：${wName}（净资产 ¥${winner ? netWorth(winner) : 0}）`)
        pushChat({ role: 'system', name: '系统', content: `大富翁结束，冠军是 ${wName}！` })
        sendGameEndNotification()
        saveState()
    }

    // 发送结束战报（仅真实角色对手；不给自己、不建"我"、不调 AI）
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
<div style="background: linear-gradient(135deg, #f59e0b, #ea580c); border-radius: 20px; padding: 16px; color: white; font-family: system-ui; box-shadow: 0 10px 20px rgba(234, 88, 12, 0.3);">
    <div style="font-weight: 900; font-size: 18px; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 8px;">🏆 大富翁战报</div>
    <div style="background: rgba(255,255,255,0.15); border-radius: 12px; padding: 12px; margin-bottom: 12px;">
        <div style="font-size: 12px; opacity: 0.85;">本局冠军</div>
        <div style="font-size: 22px; font-weight: 900;">${winner ? winner.name + (winner.isUser ? ' (你)' : '') : '无人'}</div>
    </div>
    <div style="font-size: 11px; font-weight: bold; margin-bottom: 6px;">最终排名:</div>
    ${rows}
    <div style="margin-top: 10px; font-size: 9px; opacity: 0.6; text-align: center;">大富翁 · ${formattedTime}</div>
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

    // ---------- 调侃（本地，不调 API）----------
    function pickBanter(kind, p, tile) {
        const quips = {
            buy: [`这块地风水不错，收了！`, `嘿嘿，${tile ? tile.name : '好地'} 归我了~`, `买买买，资金管够！`, `地段地段，懂？`],
            rent: [`房东来收租啦，乖乖交钱~`, `哎呀手头紧？`, `我的地盘我做主 😎`, `租金已到账，谢谢惠顾！`],
        }
        const arr = quips[kind] || quips.buy
        return arr[Math.floor(Math.random() * arr.length)]
    }

    function maybeBanter(receiver, payer, kind, amount) {
        // 真实联系人 / NPC 收租时偶尔冒一句
        if (Math.random() < 0.6) {
            pushChat({ role: 'ai', name: receiver.name, content: pickBanter(kind, receiver) })
        }
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
        // helpers (供视图)
        tileById, ownerOf, ownsFullGroup, computeRent, netWorth, baseRentOf, houseCostOf,
        GROUPS, clearState,
    }
})
