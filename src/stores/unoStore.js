import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useSettingsStore } from './settingsStore.js'
import { useWalletStore } from './walletStore.js'
import {
    createDeck,
    dealInitial,
    canPlay,
    topCardOf,
    reshuffleIfEmpty,
    COLOR_META,
    RULE_MODES,
    describeCard,
    applySevenZero,
    canJumpIn,
    SEAT_LABELS,
    POSITION_NAMES
} from '../utils/uno/unoEngine.js'
import { chooseCard, chooseColor, shouldCallUno, shouldJumpIn, inferRelationship } from '../utils/uno/UnoAI.js'
import { generateReply } from '../utils/aiService.js'

// UNO 内置 NPC 对手（快速开始用；通讯录角色可在房间内邀请替换）
const UNO_NPCS = [
    { id: 'npc_bear', name: '熊大', avatar: '🐻', beans: 8000 },
    { id: 'npc_cat', name: '喵酱', avatar: '🐱', beans: 12000 },
    { id: 'npc_robot', name: '小钢', avatar: '🤖', beans: 15000 },
    { id: 'npc_fox', name: '阿狸', avatar: '🦊', beans: 9000 },
    { id: 'npc_star', name: '星仔', avatar: '🌟', beans: 11000 },
    { id: 'npc_panda', name: '胖达', avatar: '🐼', beans: 10000 },
    { id: 'npc_rabbit', name: '兔叽', avatar: '🐰', beans: 9500 },
    { id: 'npc_dog', name: '阿黄', avatar: '🐶', beans: 10500 }
]

function genId() {
    return 'uno_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export const useUnoStore = defineStore('uno', () => {
    // ===== 用户经济/积分/段位 =====
    const beans = ref(10000)
    const score = ref(0)
    const rank = ref('青铜')
    const wins = ref(0)
    const losses = ref(0)
    const winStreak = ref(0)

    const currentRoom = ref(null)
    const gameState = ref(null)
    const gameChatMessages = ref([])
    const activeReplies = ref({}) // { playerIndex: text }
    const aiInfluences = ref({}) // AI 受聊天影响 { playerIndex: { type:'favor'|'hinder', targetPlayerIndex } }
    const playerStats = ref([]) // 遇到的 AI 排行榜数据

    const soundEnabled = ref(true)
    const bgmEnabled = ref(true)
    const voiceEnabled = ref(true)
    const sfxVolume = ref(0.8)
    const bgmVolume = ref(0.5)
    const lastAction = ref(null)

    const rankInfo = computed(() => {
        const s = score.value
        if (s < 100) return { name: '青铜', color: '#cd7f32', icon: '🥉' }
        if (s < 300) return { name: '白银', color: '#c0c0c0', icon: '🥈' }
        if (s < 600) return { name: '黄金', color: '#ffd700', icon: '🥇' }
        if (s < 1000) return { name: '铂金', color: '#e5e4e2', icon: '💎' }
        return { name: '钻石', color: '#b9f2ff', icon: '👑' }
    })

    const winRate = computed(() => {
        const total = wins.value + losses.value
        return total === 0 ? 0 : Math.round((wins.value / total) * 100)
    })

    const leaderboard = computed(() => {
        const settingsStore = useSettingsStore()
        const user = {
            name: settingsStore.personalization?.userProfile?.name || '我',
            avatar: settingsStore.personalization?.userProfile?.avatar || '👤',
            score: score.value,
            rank: rankInfo.value.name,
            isUser: true
        }
        const list = [user, ...playerStats.value]
        return list.sort((a, b) => b.score - a.score)
    })

    // ===== 基础工具 =====
    function humanProfile() {
        const s = useSettingsStore()
        const p = s.personalization?.userProfile
        return {
            id: 'user',
            name: p?.name || '我',
            avatar: p?.avatar || '👤'
        }
    }

    function getNPCs() {
        return UNO_NPCS
    }

    function calculateRankName(s) {
        if (s < 100) return '青铜'
        if (s < 300) return '白银'
        if (s < 600) return '黄金'
        if (s < 1000) return '铂金'
        return '钻石'
    }

    function updateScore(delta) {
        score.value += delta
        if (delta > 0) {
            wins.value++
            winStreak.value++
        } else if (delta < 0) {
            losses.value++
            winStreak.value = 0
        }
        rank.value = rankInfo.value.name
        saveData()
    }

    function rechargeBeans(amount) {
        beans.value += amount
        saveData()
        return { success: true, message: '充值成功' }
    }

    function deductBeans(amount) {
        if (beans.value >= amount) {
            beans.value -= amount
            saveData()
            return true
        }
        return false
    }

    function addBeans(amount) {
        beans.value += amount
        saveData()
    }

    function toggleSound() {
        soundEnabled.value = !soundEnabled.value
    }

    function toggleBGM() {
        bgmEnabled.value = !bgmEnabled.value
    }

    function toggleVoice() {
        voiceEnabled.value = !voiceEnabled.value
        saveData()
    }

    // ===== 房间创建 =====
    async function createRoom({ mode = 'quick', ruleMode = 'classic', baseStake = 100, totalRounds = 8, maxPlayers = 4, aiCount = 1 } = {}) {
        const me = humanProfile()
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase()
        const rule = RULE_MODES[ruleMode] ? ruleMode : 'classic'
        const cap = Math.min(Math.max(maxPlayers ?? 4, 2), 8)

        currentRoom.value = {
            id: roomId,
            mode: mode || 'quick',
            ruleMode: rule,
            rules: RULE_MODES[rule],
            baseStake: baseStake ?? 100,
            totalRounds: totalRounds ?? 8,
            currentRound: 1,
            maxPlayers: cap,
            players: [],
            status: 'waiting'
        }

        currentRoom.value.players.push({
            ...me,
            position: POSITION_NAMES[0],
            positionLabel: SEAT_LABELS[0],
            beans: beans.value,
            score: 0,
            isReady: true,
            isAI: false
        })

        if (mode === 'quick') {
            await addAIPlayers(Math.min(aiCount ?? (cap - 1), cap - 1))
        }
        return roomId
    }

    async function addAIPlayers(count) {
        const cap = currentRoom.value.maxPlayers
        const needed = Math.min(count, cap - currentRoom.value.players.length)
        if (needed <= 0) return
        const pool = [...UNO_NPCS].sort(() => Math.random() - 0.5)
        const takenNames = new Set(currentRoom.value.players.map((p) => p.name))
        let added = 0
        for (const npc of pool) {
            if (added >= needed) break
            if (takenNames.has(npc.name)) continue
            takenNames.add(npc.name)
            const idx = currentRoom.value.players.length
            currentRoom.value.players.push(await buildAIPlayer(npc, idx))
            added++
        }
    }

    async function buildAIPlayer(base, positionIndex) {
        const chatStore = await import('./chatStore.js').then((m) => m.useChatStore()).catch(() => null)
        let chatChar = null
        if (chatStore && chatStore.chats && base.id && !String(base.id).startsWith('npc_')) {
            chatChar = chatStore.chats[base.id]
            if (!chatChar && base.name) {
                chatChar = Object.values(chatStore.chats).find((c) => c.name === base.name || c.remark === base.name)
            }
        }
        const persona = chatChar?.prompt || base.signature || ''
        const userPersona = chatChar?.userPersona || ''
        return {
            ...base,
            position: POSITION_NAMES[positionIndex],
            positionLabel: SEAT_LABELS[positionIndex],
            beans: base.beans ?? Math.floor(Math.random() * 45000) + 5000,
            score: 0,
            isReady: true,
            isAI: true,
            persona,
            userPersona,
            voiceId: chatChar?.voiceId || base.voiceId || '',
            doubaoSpeaker: chatChar?.doubaoSpeaker || base.doubaoSpeaker || '',
            relationship: inferRelationship(persona, userPersona)
        }
    }

    function addContact(contact, positionIndex) {
        if (!currentRoom.value) return
        const exists = currentRoom.value.players.some((p) => p.id === contact.id)
        if (exists) return
        const seat = currentRoom.value.players.find((p) => p.position === POSITION_NAMES[positionIndex])
        buildAIPlayer({
            id: contact.id,
            name: contact.name,
            avatar: contact.avatar || '👤',
            beans: Math.floor(Math.random() * 45000) + 5000,
            signature: contact.signature || ''
        }, positionIndex).then((player) => {
            if (seat && seat.id !== 'user') {
                const i = currentRoom.value.players.indexOf(seat)
                currentRoom.value.players[i] = player
            } else if (!seat) {
                currentRoom.value.players.push(player)
            }
        })
    }

    function addNPC(npc, positionIndex) {
        if (!currentRoom.value) return
        const seat = currentRoom.value.players.find((p) => p.position === POSITION_NAMES[positionIndex])
        buildAIPlayer(npc, positionIndex).then((player) => {
            if (seat && seat.id !== 'user') {
                const i = currentRoom.value.players.indexOf(seat)
                currentRoom.value.players[i] = player
            } else if (!seat) {
                currentRoom.value.players.push(player)
            }
        })
    }

    function removePlayer(positionIndex) {
        if (!currentRoom.value) return
        currentRoom.value.players = currentRoom.value.players.filter((p) => p.position !== POSITION_NAMES[positionIndex])
    }

    function playerName(index) {
        return currentRoom.value?.players[index]?.name || `玩家${index + 1}`
    }

    function playerById(id) {
        return currentRoom.value?.players.find((p) => p.id === id)
    }

    // ===== 游戏核心 =====
    function nextIndex(s, i) {
        const n = s.hands.length
        return (i + s.direction + n) % n
    }

    function drawCards(s, index, count) {
        for (let i = 0; i < count; i++) {
            reshuffleIfEmpty(s)
            if (s.deck.length === 0) break
            s.hands[index].push(s.deck.pop())
        }
    }

    function startGame() {
        const players = currentRoom.value?.players || []
        const playerCount = players.length
        if (playerCount < 2) return

        const deck = createDeck()
        const dealt = dealInitial(deck, playerCount)
        currentRoom.value.status = 'playing'

        gameState.value = {
            deck: dealt.deck,
            discard: dealt.discard,
            hands: dealt.hands,
            currentPlayerIndex: 0,
            direction: 1,
            currentColor: dealt.currentColor,
            pendingDraw: 0,
            mustSkip: false,
            unoCalled: players.map(() => false),
            phase: 'playing',
            pendingWild: null,
            winnerIndex: null,
            roundResult: null,
            rules: currentRoom.value.rules,
            ruleMode: currentRoom.value.ruleMode,
            log: [`游戏开始 · ${currentRoom.value.rules.name}模式 · 起始牌：${describeCard(dealt.firstCard)}`],
            playerNames: players.map((p) => p.name)
        }
    }

    function startNextRound() {
        if (!gameState.value || !currentRoom.value) return
        gameState.value.roundResult = null
        currentRoom.value.currentRound++
        startGame()
    }

    function playCard(index, cardId, chosenColor) {
        const s = gameState.value
        if (!s || s.phase === 'finished') return false
        if (s.currentPlayerIndex !== index) return false
        const hand = s.hands[index]
        const ci = hand.findIndex((c) => c.id === cardId)
        if (ci === -1) return false
        const card = hand[ci]
        const top = topCardOf(s)
        if (!canPlay(card, top, s.currentColor)) return false

        hand.splice(ci, 1)
        s.discard.push(card)

        if (card.type === 'wild' || card.type === 'wild4') {
            s.currentColor = chosenColor || 'red'
        } else {
            s.currentColor = card.color
        }

        s.log.unshift(`${playerName(index)} 打出 ${describeCard(card)}`)
        lastAction.value = { type: 'play', playerIndex: index, card, color: s.currentColor, time: Date.now() }

        // 七零规则
        applySevenZero(s, card, index)

        // 功能牌效果
        if (card.type === 'skip') {
            s.mustSkip = true
        } else if (card.type === 'reverse') {
            if (s.hands.length === 2) s.mustSkip = true
            else s.direction *= -1
        } else if (card.type === 'draw2') {
            s.pendingDraw += 2
        } else if (card.type === 'wild4') {
            s.pendingDraw += 4
        }

        // UNO 判定
        if (hand.length === 1) {
            const isAI = currentRoom.value.players[index]?.isAI
            if (isAI) {
                s.unoCalled[index] = shouldCallUno(buildAIContext(index))
            } else if (!s.unoCalled[index]) {
                drawCards(s, index, 2)
                s.log.unshift(`⚠️ ${playerName(index)} 没喊UNO，被罚抽2张`)
                s.unoCalled[index] = true
            }
        }

        if (hand.length === 0) {
            finishGame(index)
            return true
        }

        advanceTurn()
        return true
    }

    function drawOne(index) {
        const s = gameState.value
        if (!s || s.phase === 'finished') return null
        reshuffleIfEmpty(s)
        if (s.deck.length === 0) return null
        const card = s.deck.pop()
        s.hands[index].push(card)
        s.log.unshift(`${playerName(index)} 抽了 1 张牌`)
        lastAction.value = { type: 'draw', playerIndex: index, time: Date.now() }
        return card
    }

    function callUno(index) {
        const s = gameState.value
        if (s) {
            s.unoCalled[index] = true
            s.log.unshift(`🎉 ${playerName(index)} 喊了 UNO！`)
            lastAction.value = { type: 'uno', playerIndex: index, time: Date.now() }
        }
    }

    function passTurn(index) {
        const s = gameState.value
        if (!s || s.phase === 'finished') return
        if (s.currentPlayerIndex !== index) return
        s.log.unshift(`${playerName(index)} 过`)
        advanceTurn()
    }

    function advanceTurn() {
        const s = gameState.value
        let idx = s.currentPlayerIndex
        if (s.mustSkip) {
            s.mustSkip = false
            const skipIdx = nextIndex(s, idx)
            s.log.unshift(`⏭️ ${playerName(skipIdx)} 被跳过`)
            idx = nextIndex(s, skipIdx)
        }
        if (s.pendingDraw > 0) {
            const drawIdx = nextIndex(s, idx)
            drawCards(s, drawIdx, s.pendingDraw)
            s.log.unshift(`⚠️ ${playerName(drawIdx)} 被罚抽 ${s.pendingDraw} 张`)
            s.pendingDraw = 0
            s.currentPlayerIndex = nextIndex(s, drawIdx)
            return
        }
        s.currentPlayerIndex = nextIndex(s, idx)
    }

    function finishGame(index) {
        const s = gameState.value
        s.phase = 'finished'
        s.winnerIndex = index
        const winner = currentRoom.value.players[index]
        const isUser = !winner.isAI

        // 结算欢乐豆/积分
        const changes = []
        const players = currentRoom.value.players
        const stake = currentRoom.value.baseStake ?? 100
        const totalPot = stake * (players.length - 1)

        players.forEach((p, i) => {
            let amount = 0
            if (i === index) {
                amount = totalPot
                p.beans += amount
                p.score += amount
                p.wins = (p.wins || 0) + 1
            } else {
                amount = -stake
                p.beans = Math.max(0, p.beans + amount)
                p.score += amount
                p.losses = (p.losses || 0) + 1
            }
            changes.push({ name: p.name, amount, isWinner: i === index, idx: i })

            if (i === 0) {
                if (amount > 0) {
                    addBeans(amount)
                    updateScore(20)
                } else if (amount < 0) {
                    if (deductBeans(Math.abs(amount))) updateScore(-10)
                }
            }
        })

        // 排行榜记录 AI
        players.forEach((p, i) => {
            if (p.isAI) {
                recordPlayerStats({
                    name: p.name,
                    avatar: p.avatar,
                    score: changes[i].amount / 10,
                    wins: i === index ? 1 : 0,
                    losses: i === index ? 0 : 1
                })
            }
        })

        s.roundResult = {
            winnerId: winner.id,
            winnerName: winner.name,
            winnerAvatar: winner.avatar,
            isUser,
            changes,
            stake
        }
        s.log.unshift(`🏆 ${winner.name} 获胜！`)
        lastAction.value = { type: isUser ? 'win' : 'lose', playerIndex: index, time: Date.now() }

        // 结束后触发一次 AI 聊天（不阻塞）
        triggerEndGameChat(index).catch(() => {})
    }

    function recordPlayerStats(player) {
        if (!player || player.id === 'user') return
        const existing = playerStats.value.find((s) => s.name === player.name)
        if (existing) {
            existing.score = (existing.score || 0) + (player.score || 0)
            existing.wins = (existing.wins || 0) + (player.wins || 0)
            existing.losses = (existing.losses || 0) + (player.losses || 0)
            existing.rank = calculateRankName(existing.score)
        } else {
            playerStats.value.push({
                name: player.name,
                avatar: player.avatar,
                score: player.score || 0,
                rank: calculateRankName(player.score || 0),
                wins: player.wins || 0,
                losses: player.losses || 0
            })
            if (playerStats.value.length > 50) playerStats.value = playerStats.value.slice(-50)
        }
        saveData()
    }

    // ===== AI 驱动 =====
    function buildAIContext(forIndex) {
        const s = gameState.value
        const players = currentRoom.value?.players || []
        const handsLengths = s?.hands?.map((h) => h.length) || []
        const n = players.length
        const next = (forIndex + (s?.direction || 1) + n) % n
        return {
            currentPlayerIndex: forIndex,
            players,
            handsLengths,
            direction: s?.direction || 1,
            nextPlayerIndex: next,
            nextIsUser: next === 0,
            userIndex: 0,
            relationships: Object.fromEntries(players.map((p, i) => [i, p.relationship || 'neutral'])),
            personas: Object.fromEntries(players.map((p, i) => [i, p.persona || ''])),
            playerNames: players.map((p) => p.name)
        }
    }

    function aiStep() {
        const s = gameState.value
        if (!s || s.phase !== 'playing') return
        const idx = s.currentPlayerIndex
        const player = currentRoom.value?.players[idx]
        if (!player || !player.isAI) return

        const hand = s.hands[idx]
        const top = topCardOf(s)
        const context = buildAIContext(idx)

        // 处理影响：如果用户求放过，AI 可能主动不坑用户
        const influence = aiInfluences.value[idx]
        if (influence?.type === 'favor') {
            context.nextIsUser = true
        }

        const card = chooseCard(hand, top, s.currentColor, context)

        if (card) {
            let color = null
            if (card.type === 'wild' || card.type === 'wild4') {
                const after = hand.filter((c) => c.id !== card.id)
                color = chooseColor(after, context)
                s.log.unshift(`${playerName(idx)} 选择颜色：${COLOR_META[color].name}`)
            }
            playCard(idx, card.id, color)
        } else {
            const drawn = drawOne(idx)
            if (drawn && canPlay(drawn, top, s.currentColor)) {
                let color = null
                if (drawn.type === 'wild' || drawn.type === 'wild4') {
                    const after = hand.filter((c) => c.id !== drawn.id)
                    color = chooseColor(after, context)
                    s.log.unshift(`${playerName(idx)} 选择颜色：${COLOR_META[color].name}`)
                }
                playCard(idx, drawn.id, color)
            } else {
                s.log.unshift(`${playerName(idx)} 过`)
                advanceTurn()
            }
        }
    }

    // 抢出模式：检查是否有 AI 可以抢出
    function checkJumpIn() {
        const s = gameState.value
        if (!s || !s.rules?.jumpIn || s.phase !== 'playing') return null
        const top = topCardOf(s)
        for (let i = 0; i < s.hands.length; i++) {
            if (i === s.currentPlayerIndex) continue
            const player = currentRoom.value?.players[i]
            if (!player?.isAI) continue
            const card = shouldJumpIn(s.hands[i], top)
            if (card) {
                s.log.unshift(`⚡ ${playerName(i)} 抢出 ${describeCard(card)}！`)
                playCard(i, card.id, null)
                return i
            }
        }
        return null
    }

    // ===== 局内聊天 =====
    const sendGameChat = async (text) => {
        if (!text.trim() || !currentRoom.value) return
        const settingsStore = useSettingsStore()
        const userName = settingsStore.personalization?.userProfile?.name || '我'
        gameChatMessages.value.push({ role: 'user', content: text, sender: userName, time: Date.now() })

        const allAIs = currentRoom.value.players.filter((p) => p.isAI)
        if (allAIs.length === 0) return

        const chatStore = await import('./chatStore.js').then((m) => m.useChatStore()).catch(() => null)
        const userPersona = settingsStore.personalization?.userProfile?.persona || '无特殊设定'

        const charContexts = allAIs.map((ai) => {
            const aiId = String(ai.id || '')
            let chatChar = null
            if (chatStore && chatStore.chats) {
                chatChar = chatStore.chats[aiId]
                if (!chatChar && ai.name) {
                    chatChar = Object.values(chatStore.chats).find((c) => c.name === ai.name || c.remark === ai.name)
                }
            }
            const isMainChar = !aiId.startsWith('npc_')
            const persona = chatChar?.prompt || ai.persona || (isMainChar ? '一个爱玩 UNO 的好友' : `一个名叫${ai.name}的 UNO 玩家`)
            const specificUserPersona = chatChar?.userPersona || userPersona
            return {
                name: ai.name,
                position: ai.positionLabel,
                handCount: gameState.value?.hands?.[currentRoom.value.players.indexOf(ai)]?.length || 0,
                isMainChar,
                persona,
                userPersona: specificUserPersona,
                relationship: ai.relationship || inferRelationship(persona, specificUserPersona)
            }
        })

        const top = topCardOf(gameState.value)
        const otherPlayersText = currentRoom.value.players.map((p) => `${p.name}(${p.positionLabel})`).join('，')
        const poolStr = top ? describeCard(top) : '无'

        const batchPrompt = `
# 局内 UNO 对话调度系统
你现在正在同步协调 UNO 牌桌上的 AI 角色互动。请阅读局势和角色设定，决定哪些角色会对用户【${userName}】的发言产生反应。

## 当前发言
- 发言人：${userName} (用户)
- 内容：“${text}”

## 角色设定与关系
${charContexts.map((c, i) => `### 角色 ${i + 1}: 【${c.name}】(${c.position})
   - 类型：${c.isMainChar ? '主要角色' : '普通NPC'}
   - 核心人设：${c.persona}
   - 对用户的人设/关系：${c.userPersona}
   - 关系类型：${c.relationship}
   - 当前手牌数：${c.handCount}
   - 行动指南：以该角色身份做出自然、符合性格的互动。`).join('\n\n')}

## 牌局局势
- 当前顶牌/颜色：${poolStr}
- 当前规则：${gameState.value?.rules?.name || '经典'}
- 座次：${otherPlayersText}

## 输出要求 (必须严格遵守 JSON 格式)
请返回一个 JSON 数组。你可以让一个或多个主要角色回答。NPC 除非被点名，否则尽量不说话。
格式示例：
[
  { "name": "角色名", "content": "回复内容(30字内)", "favor": "user" }
]

## 注意事项
1. 关系深刻化：恋人/好友语气亲昵，对手可挑衅。
2. 局势互动：可提到 UNO 局势（牌多牌少、被+4等）。
3. 耍赖/配合：如果用户在求放过或求坑某人，关系好的角色可在 "favor" 填 "user"，关系差的可填其他角色名。
4. 仅返回 JSON 数组，不要加解释。
`.trim()

        try {
            const msgs = [
                { role: 'system', content: batchPrompt },
                ...gameChatMessages.value.slice(-6).map((m) => ({
                    role: m.role,
                    content: m.role === 'user' ? `${userName}: ${m.content}` : `${m.sender}: ${m.content}`
                }))
            ]
            const res = await generateReply(msgs, { name: 'UnoManager' })
            if (!res?.content) return
            await processAIChatReply(res.content, charContexts)
        } catch (err) {
            console.error('UNO 群聊 AI 调用异常:', err)
        }
    }

    async function triggerEndGameChat(winnerIndex) {
        const winner = currentRoom.value?.players[winnerIndex]
        if (!winner) return
        const settingsStore = useSettingsStore()
        const userName = settingsStore.personalization?.userProfile?.name || '我'
        const isUserWin = winnerIndex === 0
        const allAIs = currentRoom.value.players.filter((p) => p.isAI)
        if (allAIs.length === 0) return

        const chatStore = await import('./chatStore.js').then((m) => m.useChatStore()).catch(() => null)
        const charContexts = allAIs.map((ai) => {
            const aiId = String(ai.id || '')
            let chatChar = null
            if (chatStore && chatStore.chats) {
                chatChar = chatStore.chats[aiId]
                if (!chatChar && ai.name) chatChar = Object.values(chatStore.chats).find((c) => c.name === ai.name)
            }
            const persona = chatChar?.prompt || ai.persona || `一个名叫${ai.name}的 UNO 玩家`
            return {
                name: ai.name,
                isWinner: ai.name === winner.name,
                isMainChar: !aiId.startsWith('npc_'),
                persona,
                relationship: ai.relationship || inferRelationship(persona, chatChar?.userPersona || '')
            }
        })

        const prompt = `
# UNO 本局结束对话
获胜者：${winner.name}${isUserWin ? '（用户）' : ''}
请让桌上的 AI 角色对结果发表一句简短感想（20字内）。
${charContexts.map((c) => `### ${c.name}
人设：${c.persona}
关系：${c.relationship}
是否获胜：${c.isWinner ? '是' : '否'}`).join('\n')}
输出 JSON 数组： [{"name":"角色名","content":"感想"}]
`.trim()

        try {
            const res = await generateReply([{ role: 'system', content: prompt }], { name: 'UnoManager' })
            if (res?.content) await processAIChatReply(res.content, charContexts)
        } catch (e) {
            console.error('UNO 结算对话失败', e)
        }
    }

    async function processAIChatReply(content, charContexts) {
        let cleanText = content.replace(/```json/gi, '').replace(/```/g, '').trim()
        const start = cleanText.indexOf('[')
        const end = cleanText.lastIndexOf(']')
        let jsonArr = []
        if (start !== -1 && end !== -1 && end > start) {
            try {
                jsonArr = JSON.parse(cleanText.substring(start, end + 1).replace(/\\n/g, '\n').trim())
            } catch (e) {
                try {
                    jsonArr = JSON.parse(cleanText.substring(start, end + 1).replace(/,(\s*\])/, '$1'))
                } catch (e2) {
                    console.error('UNO 聊天 JSON 解析失败', e2)
                }
            }
        }
        if ((!jsonArr || jsonArr.length === 0) && content.length > 5) {
            const backup = content.replace(/\[|\]|\{|\}|"name":|"content":/g, '').trim().split('\n')[0]
            const first = charContexts[0]
            if (first) jsonArr = [{ name: first.name, content: backup.substring(0, 50) }]
        }

        for (const item of jsonArr) {
            const cleanName = String(item.name || '').trim().replace(/^["']|["']$/g, '')
            const players = currentRoom.value?.players || []
            const ai = players.find((p) => {
                const pName = String(p.name || '').trim()
                return pName === cleanName || pName.includes(cleanName) || cleanName.includes(pName)
            })
            if (!ai) continue
            const idx = players.indexOf(ai)
            const replyText = String(item.content || '').trim()
            if (!replyText) continue

            if (item.favor === 'user') aiInfluences.value[idx] = { type: 'favor' }
            else if (item.favor && item.favor !== 'user') {
                const target = players.find((p) => p.name === item.favor || item.favor.includes(p.name))
                if (target) aiInfluences.value[idx] = { type: 'hinder', targetPlayerIndex: players.indexOf(target) }
            }

            gameChatMessages.value.push({ role: 'ai', content: replyText, sender: ai.name, playerIdx: idx, time: Date.now() })
            activeReplies.value[idx] = replyText
            setTimeout(() => {
                if (activeReplies.value[idx] === replyText) delete activeReplies.value[idx]
            }, 6000)
            lastAction.value = { type: 'chat', playerIndex: idx, text: replyText, time: Date.now() }
        }
    }

    // ===== 数据持久化 =====
    function saveData() {
        try {
            const data = {
                beans: beans.value,
                score: score.value,
                wins: wins.value,
                losses: losses.value,
                winStreak: winStreak.value,
                rank: rank.value,
                playerStats: playerStats.value,
                soundEnabled: soundEnabled.value,
                bgmEnabled: bgmEnabled.value,
                voiceEnabled: voiceEnabled.value,
                sfxVolume: sfxVolume.value,
                bgmVolume: bgmVolume.value
            }
            localStorage.setItem('uno_stats', JSON.stringify(data))
        } catch (e) {
            console.warn('[UNO] 存储失败', e)
        }
    }

    function loadData() {
        const s = localStorage.getItem('uno_stats')
        if (!s) return
        try {
            const d = JSON.parse(s)
            if (d.beans !== undefined) beans.value = d.beans
            if (d.score !== undefined) score.value = d.score
            if (d.wins !== undefined) wins.value = d.wins
            if (d.losses !== undefined) losses.value = d.losses
            if (d.winStreak !== undefined) winStreak.value = d.winStreak
            if (d.rank !== undefined) rank.value = d.rank
            if (d.playerStats !== undefined) playerStats.value = d.playerStats
            if (d.soundEnabled !== undefined) soundEnabled.value = d.soundEnabled
            if (d.bgmEnabled !== undefined) bgmEnabled.value = d.bgmEnabled
            if (d.voiceEnabled !== undefined) voiceEnabled.value = d.voiceEnabled
            if (d.sfxVolume !== undefined) sfxVolume.value = d.sfxVolume
            if (d.bgmVolume !== undefined) bgmVolume.value = d.bgmVolume
        } catch (e) {
            console.error('Failed to load UNO stats:', e)
        }
    }

    function returnToLobby() {
        currentRoom.value = null
        gameState.value = null
        gameChatMessages.value = []
        activeReplies.value = {}
        aiInfluences.value = {}
    }

    async function startNewGame() {
        if (!currentRoom.value) {
            // 兜底：没有房间时按默认配置创建并开一局
            await createRoom({ mode: 'quick', ruleMode: 'classic', baseStake: 100, totalRounds: 8, maxPlayers: 4, aiCount: 3 })
            startGame()
            return
        }
        // 保留当前房间与玩家，仅重置牌局状态开始下一回合/再一局
        gameChatMessages.value = []
        activeReplies.value = {}
        aiInfluences.value = {}
        currentRoom.value.currentRound = (currentRoom.value.currentRound || 1) + 1
        startGame()
    }

    loadData()

    return {
        beans, score, rank, wins, losses, winStreak, winRate, rankInfo, leaderboard,
        currentRoom, gameState, gameChatMessages, activeReplies, aiInfluences, lastAction,
        soundEnabled, bgmEnabled, voiceEnabled, sfxVolume, bgmVolume,
        getNPCs, createRoom, addAIPlayers, addContact, addNPC, removePlayer,
        startGame, startNextRound, playCard, drawOne, callUno, passTurn, aiStep, checkJumpIn,
        finishGame, returnToLobby, startNewGame,
        sendGameChat, triggerEndGameChat,
        rechargeBeans, deductBeans, addBeans, updateScore,
        toggleSound, toggleBGM, toggleVoice, saveData, loadData,
        describeCard, playerName, playerById
    }
})
