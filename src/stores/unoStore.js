import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useSettingsStore } from './settingsStore.js'
import {
    createDeck,
    dealInitial,
    canPlay,
    topCardOf,
    reshuffleIfEmpty,
    COLOR_META
} from '../utils/uno/unoEngine.js'
import { chooseCard, chooseColor } from '../utils/uno/UnoAI.js'

// UNO 内置 NPC 对手（快速开始用；通讯录角色可在房间内邀请替换）
const UNO_NPCS = [
    { id: 'npc_bear', name: '熊大', avatar: '🐻' },
    { id: 'npc_cat', name: '喵酱', avatar: '🐱' },
    { id: 'npc_robot', name: '小钢', avatar: '🤖' },
    { id: 'npc_fox', name: '阿狸', avatar: '🦊' },
    { id: 'npc_star', name: '星仔', avatar: '🌟' }
]

// 对手座位顺序（你固定为 south）
const OPP_POSITIONS = ['north', 'east', 'west']

function genId() {
    return 'uno_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export const useUnoStore = defineStore('uno', () => {
    const currentRoom = ref(null)
    const gameState = ref(null)

    const getNPCs = () => UNO_NPCS

    function humanProfile() {
        const s = useSettingsStore()
        const p = s.personalization?.userProfile
        return {
            name: p?.name || '我',
            avatar: p?.avatar || '👤'
        }
    }

    function describeCard(card) {
        if (!card) return ''
        if (card.type === 'wild') return '变色'
        if (card.type === 'wild4') return '+4'
        const colorName = COLOR_META[card.color]?.name || ''
        return `${colorName}${card.label}`
    }

    function playerName(index) {
        return currentRoom.value?.players[index]?.name || `玩家${index + 1}`
    }

    // 创建房间：aiCount 个内置 NPC 对手
    function createRoom({ aiCount = 1 } = {}) {
        const me = humanProfile()
        const players = [
            {
                id: 'user',
                name: me.name,
                avatar: me.avatar,
                position: 'south',
                isAI: false,
                isReady: true
            }
        ]
        const pool = [...UNO_NPCS].sort(() => Math.random() - 0.5)
        const count = Math.min(Math.max(aiCount, 1), 3)
        for (let i = 0; i < count; i++) {
            players.push({
                ...pool[i],
                position: OPP_POSITIONS[i],
                isReady: true,
                isAI: true
            })
        }
        currentRoom.value = {
            id: genId(),
            players,
            config: { aiCount: count }
        }
        return currentRoom.value
    }

    function addContact(contact, position) {
        if (!currentRoom.value) return
        const exists = currentRoom.value.players.some((p) => p.id === contact.id)
        if (exists) return
        // 同座位若已有玩家则替换
        const seat = currentRoom.value.players.find((p) => p.position === position)
        const player = {
            id: contact.id,
            name: contact.name,
            avatar: contact.avatar || '👤',
            position,
            isReady: true,
            isAI: true
        }
        if (seat && seat.id !== 'user') {
            const i = currentRoom.value.players.indexOf(seat)
            currentRoom.value.players[i] = player
        } else if (!seat) {
            currentRoom.value.players.push(player)
        }
    }

    function addNPC(npc, position) {
        if (!currentRoom.value) return
        const seat = currentRoom.value.players.find((p) => p.position === position)
        const player = { ...npc, position, isReady: true, isAI: true }
        if (seat && seat.id !== 'user') {
            const i = currentRoom.value.players.indexOf(seat)
            currentRoom.value.players[i] = player
        } else if (!seat) {
            currentRoom.value.players.push(player)
        }
    }

    function startGame() {
        const players = currentRoom.value?.players || []
        const playerCount = players.length
        const deck = createDeck()
        const dealt = dealInitial(deck, playerCount)
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
            phase: 'playing', // playing | colorpick | finished
            pendingWild: null,
            winnerIndex: null,
            roundResult: null,
            log: [`游戏开始 · 起始牌：${describeCard(dealt.firstCard)}`]
        }
    }

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

    function advanceTurn() {
        const s = gameState.value
        let idx = s.currentPlayerIndex
        if (s.mustSkip) {
            s.mustSkip = false
            idx = nextIndex(s, idx)
        }
        if (s.pendingDraw > 0) {
            const drawIdx = nextIndex(s, idx)
            drawCards(s, drawIdx, s.pendingDraw)
            s.log.unshift(`⚠️ ${playerName(drawIdx)} 被罚抽 ${s.pendingDraw} 张`)
            s.pendingDraw = 0
            idx = nextIndex(s, drawIdx)
            s.currentPlayerIndex = idx
            return
        }
        s.currentPlayerIndex = nextIndex(s, idx)
    }

    // 出牌（人/AI 共用）。chosenColor 仅万能牌需要。
    function playCard(index, cardId, chosenColor) {
        const s = gameState.value
        if (!s || s.phase === 'finished') return
        if (s.currentPlayerIndex !== index) return
        const hand = s.hands[index]
        const ci = hand.findIndex((c) => c.id === cardId)
        if (ci === -1) return
        const card = hand[ci]
        const top = topCardOf(s)
        if (!canPlay(card, top, s.currentColor)) return

        hand.splice(ci, 1)
        s.discard.push(card)

        if (card.type === 'wild' || card.type === 'wild4') {
            s.currentColor = chosenColor || 'red'
        } else {
            s.currentColor = card.color
        }

        s.log.unshift(`${playerName(index)} 打出 ${describeCard(card)}`)

        // 功能牌效果
        if (card.type === 'skip') {
            s.mustSkip = true
        } else if (card.type === 'reverse') {
            if (s.hands.length === 2) s.mustSkip = true // 双人反转视为跳过
            else s.direction *= -1
        } else if (card.type === 'draw2') {
            s.pendingDraw += 2
        } else if (card.type === 'wild4') {
            s.pendingDraw += 4
        }

        // UNO 判定：剩 1 张必须已喊过，否则被抓罚抽 2
        if (hand.length === 1) {
            const isAI = currentRoom.value.players[index]?.isAI
            if (isAI) {
                s.unoCalled[index] = true
            } else if (!s.unoCalled[index]) {
                drawCards(s, index, 2)
                s.log.unshift(`⚠️ ${playerName(index)} 没喊UNO，被罚抽2张`)
                s.unoCalled[index] = true
            }
        }

        if (hand.length === 0) {
            finishGame(index)
            return
        }

        advanceTurn()
    }

    // 人类抽 1 张（不自动结束回合）
    function drawOne(index) {
        const s = gameState.value
        if (!s || s.phase === 'finished') return null
        reshuffleIfEmpty(s)
        if (s.deck.length === 0) return null
        const card = s.deck.pop()
        s.hands[index].push(card)
        s.log.unshift(`${playerName(index)} 抽了 1 张牌`)
        return card
    }

    function callUno(index) {
        const s = gameState.value
        if (s) s.unoCalled[index] = true
    }

    // 人类抽牌后选择不出牌，结束回合
    function passTurn(index) {
        const s = gameState.value
        if (!s || s.phase === 'finished') return
        if (s.currentPlayerIndex !== index) return
        s.log.unshift(`${playerName(index)} 过`)
        advanceTurn()
    }

    // AI 单步（由视图定时器驱动）
    function aiStep() {
        const s = gameState.value
        if (!s || s.phase !== 'playing') return
        const idx = s.currentPlayerIndex
        const player = currentRoom.value?.players[idx]
        if (!player || !player.isAI) return
        if (s.pendingWild) return

        const hand = s.hands[idx]
        const top = topCardOf(s)
        const card = chooseCard(hand, top, s.currentColor)

        if (card) {
            let color = null
            if (card.type === 'wild' || card.type === 'wild4') {
                const after = hand.filter((c) => c.id !== card.id)
                color = chooseColor(after)
                s.log.unshift(`${playerName(idx)} 选择颜色：${COLOR_META[color].name}`)
            }
            playCard(idx, card.id, color)
        } else {
            const drawn = drawOne(idx)
            if (drawn && canPlay(drawn, top, s.currentColor)) {
                let color = null
                if (drawn.type === 'wild' || drawn.type === 'wild4') {
                    const after = hand.filter((c) => c.id !== drawn.id)
                    color = chooseColor(after)
                    s.log.unshift(`${playerName(idx)} 选择颜色：${COLOR_META[color].name}`)
                }
                playCard(idx, drawn.id, color)
            } else {
                s.log.unshift(`${playerName(idx)} 过`)
                advanceTurn()
            }
        }
    }

    function finishGame(index) {
        const s = gameState.value
        s.phase = 'finished'
        s.winnerIndex = index
        const winner = currentRoom.value.players[index]
        s.roundResult = {
            winnerId: winner.id,
            winnerName: winner.name,
            winnerAvatar: winner.avatar,
            isUser: !winner.isAI
        }
        s.log.unshift(`🏆 ${winner.name} 获胜！`)
    }

    function returnToLobby() {
        currentRoom.value = null
        gameState.value = null
    }

    function startNewGame() {
        const cfg = currentRoom.value?.config || { aiCount: 1 }
        returnToLobby()
        createRoom(cfg)
    }

    return {
        currentRoom,
        gameState,
        getNPCs,
        createRoom,
        addContact,
        addNPC,
        startGame,
        playCard,
        drawOne,
        callUno,
        passTurn,
        aiStep,
        returnToLobby,
        startNewGame,
        describeCard
    }
})
