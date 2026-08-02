<template>
    <div class="mono-game w-full h-full flex flex-col bg-gradient-to-br from-sky-100 via-blue-50 to-yellow-50 overflow-hidden">
        <!-- 顶部导航 -->
        <div class="h-[50px] bg-gradient-to-r from-sky-500 to-blue-500 flex items-center justify-between px-3 shadow-lg shrink-0">
            <button @click="confirmLeave" class="w-10 h-10 flex items-center justify-center text-white">
                <i class="fa-solid fa-chevron-left text-xl"></i>
            </button>
            <h1 class="text-base font-bold text-white flex items-center gap-2">
                <span>🐾</span><span>帕瓦小镇</span>
                <span class="text-[11px] bg-white/25 px-2 py-0.5 rounded-full">回合 {{ gs?.round || 1 }}</span>
            </h1>
            <button @click="confirmEnd" class="h-9 px-3 rounded-full bg-white/25 text-white text-xs font-bold active:scale-95">
                结束结算
            </button>
        </div>

        <!-- 主内容区 -->
        <div class="flex-1 min-h-0 overflow-y-auto">
            <!-- 棋盘 -->
            <div class="flex justify-center p-2">
                <div ref="boardEl" class="mono-board relative w-full max-w-[460px] aspect-square rounded-2xl shadow-xl"
                    style="display:grid;grid-template-columns:repeat(11,1fr);grid-template-rows:repeat(11,1fr);gap:1px;padding:1px;">
                    <template v-for="tile in BOARD" :key="tile.id">
                        <div class="tile" :class="['t-' + tile.type, { owned: !!tileOwner(tile.id), sel: selectedTile === tile.id }]"
                            :style="gridStyle(tile.id)"
                            @click="selectedTile = (selectedTile === tile.id ? null : tile.id)">
                            <div v-if="tile.type === 'property' && GROUPS[tile.group]" class="tile-bar"
                                :style="{ background: GROUPS[tile.group].color }"></div>
                            <div v-else-if="tile.type === 'station'" class="tile-bar" :style="{ background: GROUPS.station.color }"></div>
                            <div v-else-if="tile.type === 'utility'" class="tile-bar" :style="{ background: GROUPS.utility.color }"></div>
                            <div class="tile-body">
                                <template v-if="tile.type === 'property' || tile.type === 'station' || tile.type === 'utility'">
                                    <div class="tile-name">{{ tile.name }}</div>
                                    <div class="tile-price">¥{{ tile.price }}</div>
                                </template>
                                <template v-else>
                                    <div class="tile-icon">{{ tileIcon(tile) }}</div>
                                    <div class="tile-name sm">{{ tile.name }}</div>
                                </template>
                            </div>
                            <div v-if="houseCount(tile.id) > 0" class="tile-house">
                                {{ houseLevelIcon(tile.id) }}
                            </div>
                            <div v-if="tileOwner(tile.id)" class="tile-owner" :style="{ background: tileOwner(tile.id)?.color }"></div>
                        </div>
                    </template>

                    <!-- 玩家棋子 -->
                    <div v-for="(p, idx) in players" :key="'tok' + p.id"
                        class="token" :style="tokenStyle(p, idx)"
                        :class="{ active: p.id === currentPlayer?.id }">
                        <span v-if="isImg(p.avatar)"><img :src="p.avatar" /></span>
                        <span v-else>{{ p.avatar }}</span>
                        <i v-if="p.bankrupt" class="tok-dead">💀</i>
                    </div>
                </div>
            </div>

            <!-- AI 思考气泡 -->
            <Transition name="fade">
                <div v-if="gs?.aiThinking && currentPlayer?.isAI" class="think-bubble mx-3 mb-1">
                    <span class="think-emoji">{{ getCharacterOf(currentPlayer)?.emoji }}</span>
                    <span class="think-text">{{ gs.aiThinking.text }}</span>
                </div>
            </Transition>

            <!-- 卡牌使用动画 -->
            <Transition name="card-pop">
                <div v-if="gs?.cardAnimation" class="card-anim-overlay">
                    <div class="card-anim-box" :style="{ borderColor: cardTypeColor(gs.cardAnimation.cardType) }">
                        <div class="card-anim-type" :style="{ background: cardTypeColor(gs.cardAnimation.cardType) }">
                            {{ cardTypeName(gs.cardAnimation.cardType) }}
                        </div>
                        <div class="card-anim-name">{{ gs.cardAnimation.cardName }}</div>
                        <div class="card-anim-desc">{{ gs.cardAnimation.cardDesc }}</div>
                        <div class="card-anim-player">{{ gs.cardAnimation.playerName }}</div>
                    </div>
                </div>
            </Transition>

            <!-- 中央信息面板 -->
            <div class="info-panel mx-3 mb-2 p-3 rounded-2xl bg-white/85 border border-sky-200 shadow-sm">
                <div class="flex items-center justify-between gap-3">
                    <div class="cp-turn flex-1 min-w-0">
                        <div class="cp-avatar" :style="{ background: currentPlayer?.color }">
                            <img v-if="isImg(currentPlayer?.avatar)" :src="currentPlayer?.avatar" />
                            <span v-else>{{ currentPlayer?.avatar || '👤' }}</span>
                        </div>
                        <div class="cp-info min-w-0">
                            <div class="cp-name truncate">
                                {{ currentPlayer?.name || '—' }}
                                <span v-if="currentPlayer?.isUser" class="cp-you">你</span>
                                <span class="cp-char">{{ getCharacterOf(currentPlayer)?.emoji }} {{ getCharacterOf(currentPlayer)?.species }}</span>
                            </div>
                            <div class="cp-sub truncate">
                                <span v-if="currentPlayer?.inJail" class="text-red-500 font-bold">🔒 蹲寄养所</span>
                                <span v-else-if="currentPlayer?.isAI && gs?.phase === 'rolling'" class="text-sky-500">💭 思考中...</span>
                                <span v-else>轮到行动</span>
                                · ¥{{ currentPlayer?.cash }}
                            </div>
                        </div>
                    </div>
                    <div class="cp-dice shrink-0">
                        <div class="die" :class="{ rolling: gs?.phase === 'moving' }">{{ diceFace(gs?.dice?.[0]) }}</div>
                        <div class="die" :class="{ rolling: gs?.phase === 'moving' }">{{ diceFace(gs?.dice?.[1]) }}</div>
                    </div>
                </div>

                <!-- 选中地块详情 -->
                <div v-if="selectedTileObj" class="cp-detail mt-2">
                    <div class="cp-detail-name">
                        {{ selectedTileObj.name }}
                        <span v-if="selectedTileObj.type === 'property'" class="dot" :style="{ background: GROUPS[selectedTileObj.group]?.color }"></span>
                    </div>
                    <div class="cp-detail-line" v-if="selectedTileObj.type === 'property' || selectedTileObj.type === 'station' || selectedTileObj.type === 'utility'">
                        价格 ¥{{ selectedTileObj.price }} · 基础租金 ¥{{ baseRentOf(selectedTileObj) }}
                    </div>
                    <div class="cp-detail-line" v-if="selectedOwner">
                        地主：{{ selectedOwner.name }}（{{ houseLevelName(selectedTileObj.id) }}）
                    </div>
                </div>
                <div v-else class="cp-hint mt-2">点击棋盘上的地块查看详情</div>
            </div>

            <!-- 玩家手牌区 -->
            <div v-if="currentPlayer?.isUser && userCards.length" class="card-hand mx-3 mb-2">
                <div class="card-hand-title">🎴 我的道具卡（{{ userCards.length }}/5）</div>
                <div class="card-hand-scroll">
                    <div v-for="cardId in userCards" :key="cardId" class="mini-card"
                        :style="{ borderColor: cardTypeColor(getItemCard(cardId)?.type) }"
                        @click="onCardTap(cardId)">
                        <div class="mini-card-type" :style="{ background: cardTypeColor(getItemCard(cardId)?.type) }">
                            {{ cardTypeName(getItemCard(cardId)?.type) }}
                        </div>
                        <div class="mini-card-name">{{ getItemCard(cardId)?.name }}</div>
                        <div class="mini-card-desc">{{ getItemCard(cardId)?.desc }}</div>
                    </div>
                </div>
            </div>

            <!-- 操作栏 -->
            <div class="action-bar bg-white/90 backdrop-blur border-t border-sky-100 px-3 py-3">
                <div v-if="isUserTurn && gs?.phase === 'rolling' && currentPlayer?.inJail" class="flex gap-2">
                    <button @click="monopolyStore.jailUseCard()" :disabled="!currentPlayer.getOutCards" class="act-btn sky flex-1">用出狱卡 ({{ currentPlayer.getOutCards }})</button>
                    <button @click="monopolyStore.jailPay()" :disabled="currentPlayer.cash < 50" class="act-btn green flex-1">保释 ¥50</button>
                    <button @click="monopolyStore.jailRoll()" class="act-btn yellow flex-1">掷骰出狱</button>
                </div>
                <button v-else-if="isUserTurn && gs?.phase === 'rolling'" @click="monopolyStore.rollDice()"
                    class="act-btn blue w-full text-lg">
                    <i class="fa-solid fa-dice mr-2"></i>掷骰子
                </button>
                <div v-else-if="isUserTurn && gs?.phase === 'action' && gs?.awaitingBuy != null" class="flex gap-2">
                    <button @click="monopolyStore.buyProperty(gs.awaitingBuy)" :disabled="currentPlayer.cash < buyTile.price"
                        class="act-btn green flex-1">买下 ¥{{ buyTile.price }}</button>
                    <button @click="monopolyStore.skipBuy()" class="act-btn gray flex-1">放弃</button>
                </div>
                <div v-else-if="isUserTurn && gs?.phase === 'action' && gs?.awaitingEnd && gs?.awaitingBuy == null" class="flex gap-2">
                    <button v-if="gs?.awaitingReroll" @click="monopolyStore.userReroll()" class="act-btn blue flex-1">再掷一次（双骰）</button>
                    <button @click="monopolyStore.userEndTurn()" class="act-btn yellow flex-1">结束回合</button>
                </div>
                <div v-else class="text-center text-gray-400 text-sm py-1">
                    <span v-if="gs?.phase === 'moving'">🐾 移动中…</span>
                    <span v-else-if="currentPlayer?.isAI">{{ currentPlayer?.name }} 正在行动…</span>
                    <span v-else>等待…</span>
                </div>

                <!-- 盖房面板 -->
                <div v-if="isUserTurn && userBuildList.length" class="mt-2">
                    <div class="text-[11px] text-gray-400 mb-1">我的地产（垄断组可升级）</div>
                    <div class="flex gap-1.5 overflow-x-auto pb-1">
                        <button v-for="b in userBuildList" :key="b.id" @click="monopolyStore.buildHouse(b.id)"
                            :disabled="currentPlayer.cash < b.cost || b.houses >= 5"
                            class="build-chip" :class="{ full: b.houses >= 5 }">
                            <span class="truncate max-w-[60px]">{{ b.name }}</span>
                            <span class="text-[10px]">{{ houseLevelShort(b.houses) }}</span>
                            <span class="text-[10px] text-sky-600">¥{{ b.cost }}</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- 日志/聊天切换 -->
            <div class="panel-toggle flex border-t border-sky-100 bg-white">
                <button @click="panelTab = 'log'" class="flex-1 py-2 text-sm font-bold" :class="panelTab === 'log' ? 'text-sky-600' : 'text-gray-400'">📜 事件日志</button>
                <button @click="panelTab = 'chat'" class="flex-1 py-2 text-sm font-bold" :class="panelTab === 'chat' ? 'text-sky-600' : 'text-gray-400'">💬 游戏聊天</button>
            </div>
            <div class="panel bg-white/95 border-t border-sky-100" style="height:100px;">
                <div v-if="panelTab === 'log'" class="h-full overflow-y-auto p-2 space-y-1 text-[12px] text-gray-600">
                    <div v-for="(e, i) in (gs?.log || [])" :key="i" class="leading-snug">{{ e.text }}</div>
                    <div v-if="!(gs?.log || []).length" class="text-gray-300 text-center mt-6">暂无事件</div>
                </div>
                <div v-else class="h-full overflow-y-auto p-2 space-y-2">
                    <div v-for="(m, i) in (gs?.chat || [])" :key="i" class="text-[12px]"
                        :class="m.role === 'system' ? 'text-center text-gray-400' : 'text-gray-700'">
                        <template v-if="m.role !== 'system'"><b :style="{ color: nameColor(m.name) }">{{ m.name }}：</b></template>{{ m.content }}
                    </div>
                    <div v-if="!(gs?.chat || []).length" class="text-gray-300 text-center mt-6">暂无聊天</div>
                </div>
            </div>
        </div>

        <!-- 结束结算确认 -->
        <div v-if="showEndConfirm" class="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div class="bg-white rounded-2xl p-6 max-w-[300px] w-full shadow-2xl">
                <h3 class="text-lg font-bold text-center mb-4 text-gray-800">结束并结算</h3>
                <p class="text-center text-gray-600 mb-6">将按当前净资产决出冠军，确定结束？</p>
                <div class="flex gap-3">
                    <button @click="showEndConfirm = false" class="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm">取消</button>
                    <button @click="doEnd" class="flex-1 py-2.5 bg-sky-500 text-white rounded-xl font-bold text-sm">结算</button>
                </div>
            </div>
        </div>

        <!-- 胜利结算 -->
        <Transition name="fade">
            <div v-if="gs?.phase === 'ended'" class="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
                <div class="bg-white rounded-3xl w-full max-w-[380px] p-6 shadow-2xl text-center">
                    <div class="text-6xl mb-2">{{ winner ? getCharacterOf(winner)?.emoji : '🏆' }}</div>
                    <h2 class="text-2xl font-black text-sky-600 mb-1">
                        {{ winner ? winner.name + (winner.isUser ? '（你）' : '') : '无人' }} 获胜！
                    </h2>
                    <div class="text-sm text-gray-400 mb-4">
                        {{ winner ? getCharacterOf(winner)?.species : '' }} · 净资产 ¥{{ winner ? netWorth(winner) : 0 }}
                    </div>
                    <div class="space-y-1.5 mb-5 text-left">
                        <div v-for="(p, i) in ranking" :key="p.id"
                            class="flex items-center justify-between text-sm bg-gray-50 rounded-xl px-3 py-2">
                            <span class="font-bold">
                                <span class="text-gray-400 mr-1">{{ i + 1 }}</span>
                                {{ getCharacterOf(p)?.emoji }} {{ p.name }}
                                <span v-if="p.isUser" class="text-sky-500 ml-1">你</span>
                            </span>
                            <span :class="p.bankrupt ? 'text-red-400' : 'text-gray-700 font-bold'">{{ p.bankrupt ? '💥出局' : '¥' + netWorth(p) }}</span>
                        </div>
                    </div>
                    <button @click="backToLobby" class="w-full py-3 bg-sky-500 text-white font-bold rounded-xl active:scale-95">返回大厅</button>
                </div>
            </div>
        </Transition>

        <!-- 道具卡使用确认弹窗 -->
        <div v-if="cardToUse" class="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div class="bg-white rounded-2xl p-5 max-w-[300px] w-full shadow-2xl">
                <div class="text-center mb-3">
                    <div class="inline-block px-3 py-1 rounded-full text-white text-xs font-bold mb-2"
                        :style="{ background: cardTypeColor(getItemCard(cardToUse)?.type) }">
                        {{ cardTypeName(getItemCard(cardToUse)?.type) }}
                    </div>
                    <h3 class="text-lg font-bold text-gray-800">{{ getItemCard(cardToUse)?.name }}</h3>
                    <p class="text-sm text-gray-500 mt-1">{{ getItemCard(cardToUse)?.desc }}</p>
                </div>
                <div v-if="needsTarget(getItemCard(cardToUse))" class="mb-3">
                    <div class="text-xs text-gray-400 mb-2 text-center">选择目标：</div>
                    <div class="max-h-[150px] overflow-y-auto space-y-1">
                        <button v-for="t in cardTargets" :key="t.id" @click="selectedTarget = t.id"
                            class="w-full py-2 px-3 rounded-lg text-sm flex items-center justify-between"
                            :class="selectedTarget === t.id ? 'bg-sky-100 border-2 border-sky-400' : 'bg-gray-50 border border-gray-200'">
                            <span>{{ t.name }}</span>
                            <span class="text-xs text-gray-400">¥{{ t.cash }}</span>
                        </button>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button @click="cardToUse = null; selectedTarget = null" class="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm">取消</button>
                    <button @click="confirmUseCard" class="flex-1 py-2.5 bg-sky-500 text-white rounded-xl font-bold text-sm">使用</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, reactive, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useMonopolyStore } from '../../stores/monopolyStore.js'
import {
    BOARD, GROUPS, baseRentOf, houseCostOf, GO_SALARY, MAX_HOUSES, GET_OUT_FEE,
    BOARD_SIZE, HOUSE_LEVELS,
} from '../../utils/monopoly/monopolyBoard.js'
import { getCharacter } from '../../utils/monopoly/characters.js'
import { getItemCard, ITEM_CARD_TYPES } from '../../utils/monopoly/itemCards.js'

const router = useRouter()
const monopolyStore = useMonopolyStore()

if (!monopolyStore.currentRoom || !monopolyStore.gameState) {
    monopolyStore.loadState()
}
if (!monopolyStore.currentRoom || !monopolyStore.gameState || monopolyStore.gameState.phase === 'ended') {
    router.replace('/games/monopoly-lobby')
}

const boardEl = ref(null)
const selectedTile = ref(null)
const panelTab = ref('log')
const showEndConfirm = ref(false)
const cardToUse = ref(null)
const selectedTarget = ref(null)

const gs = computed(() => monopolyStore.gameState)
const room = computed(() => monopolyStore.currentRoom)
const players = computed(() => gs.value?.players || [])
const currentPlayer = computed(() => monopolyStore.currentPlayer)
const isUserTurn = computed(() => monopolyStore.isUserTurn)
const buyTile = computed(() => gs.value?.awaitingBuy != null ? monopolyStore.tileById(gs.value.awaitingBuy) : null)
const selectedTileObj = computed(() => selectedTile.value != null ? monopolyStore.tileById(selectedTile.value) : null)
const selectedOwner = computed(() => selectedTileObj.value ? monopolyStore.ownerOf(selectedTileObj.value.id) : null)
const winner = computed(() => gs.value?.winner ? players.value.find(p => p.id === gs.value.winner) : null)
const ranking = computed(() => [...players.value].sort((a, b) => monopolyStore.netWorth(b) - monopolyStore.netWorth(a)))

const isImg = (a) => !!a && (a.startsWith('/') || a.startsWith('data:image') || a.startsWith('http'))
const tileOwner = (id) => monopolyStore.ownerOf(id)
const houseCount = (id) => {
    const o = tileOwner(id)
    return o ? (o.houses?.[id] || 0) : 0
}
const houseLevelIcon = (id) => {
    const h = houseCount(id)
    return HOUSE_LEVELS[h]?.icon || ''
}
const houseLevelName = (id) => {
    const h = houseCount(id)
    return HOUSE_LEVELS[h]?.name || '空地'
}
const houseLevelShort = (h) => {
    return HOUSE_LEVELS[h]?.icon || '⚪'
}
const getCharacterOf = (player) => {
    if (!player) return null
    return getCharacter(player.characterId)
}

// 用户手牌
const userCards = computed(() => {
    const p = currentPlayer.value
    if (!p || !p.isUser) return []
    return p.itemCards || []
})

// 道具卡目标选择
const cardTargets = computed(() => {
    if (!cardToUse.value) return []
    const card = getItemCard(cardToUse.value)
    if (!card) return []
    if (card.targetType === 'player') {
        return activePlayersList.value.filter(p => !p.isUser)
    }
    if (card.targetType === 'tile' || card.targetType === 'tile_owned_by_others' || card.targetType === 'tile_owned_by_self') {
        // 简化：返回地产列表
        return BOARD.filter(t => t.type === 'property').map(t => ({ id: t.id, name: t.name, cash: t.price }))
    }
    return []
})
const activePlayersList = computed(() => players.value.filter(p => !p.bankrupt))
const needsTarget = (card) => card && card.targetType && card.targetType !== 'self'

function onCardTap(cardId) {
    const card = getItemCard(cardId)
    if (!card) return
    if (needsTarget(card)) {
        cardToUse.value = cardId
        selectedTarget.value = null
    } else {
        // 直接使用
        monopolyStore.useItemCard(cardId, null)
    }
}

function confirmUseCard() {
    if (!cardToUse.value) return
    monopolyStore.useItemCard(cardToUse.value, selectedTarget.value)
    cardToUse.value = null
    selectedTarget.value = null
}

function cardTypeColor(type) {
    return ITEM_CARD_TYPES[type]?.color || '#999'
}
function cardTypeName(type) {
    return ITEM_CARD_TYPES[type]?.name || ''
}

const userBuildList = computed(() => {
    const p = currentPlayer.value
    if (!p || !p.isUser) return []
    const list = []
    for (const id of p.properties) {
        const t = monopolyStore.tileById(id)
        if (t.type !== 'property') continue
        if (!monopolyStore.ownsFullGroup(p, t.group)) continue
        list.push({ id, name: t.name, houses: p.houses[id] || 0, cost: houseCostOf(t) })
    }
    return list
})

function nameColor(name) {
    const p = players.value.find(pl => pl.name === name)
    return p ? p.color : '#6b7280'
}

function tileIcon(tile) {
    return {
        go: '🐾', jail: '🏠', gotojail: '🚔', parking: '☀️', tax: '🧾', chance: '🐱', chest: '🐶',
    }[tile.type] || '🎲'
}

const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']
function diceFace(n) { return FACES[(n || 1) - 1] }

function gridPos(id) {
    if (id <= 10) return { c: id + 1, r: 1 }
    if (id <= 20) return { c: 11, r: id - 9 }
    if (id <= 30) return { c: 31 - id, r: 11 }
    return { c: 1, r: 41 - id }
}
function gridStyle(id) {
    const { c, r } = gridPos(id)
    return { gridColumn: c, gridRow: r }
}

const TOKEN_OFFSETS = [
    [0, 0], [-9, -9], [9, -9], [-9, 9], [9, 9], [0, -13], [0, 13], [-13, 0],
]
const displayPos = reactive({})
function syncDisplay() {
    players.value.forEach(p => { displayPos[p.id] = p.position })
}
function tokenStyle(p, idx) {
    if (!p) return {}
    const pos = displayPos[p.id] ?? p.position ?? 0
    const { c, r } = gridPos(pos)
    const left = (c - 0.5) / 11 * 100
    const top = (r - 0.5) / 11 * 100
    const off = TOKEN_OFFSETS[(idx || 0) % TOKEN_OFFSETS.length] || [0, 0]
    return {
        left: `calc(${left}% + ${off[0] || 0}px)`,
        top: `calc(${top}% + ${off[1] || 0}px)`,
        borderColor: p.color,
    }
}

// ---- AI 自动推进（人性化节奏）----
let aiTimer = null
let animating = false
function scheduleAI() {
    const g = monopolyStore.gameState
    if (!g || g.phase !== 'rolling') return
    const p = monopolyStore.currentPlayer
    if (!p || !p.isAI) return
    if (aiTimer) return
    // 先显示思考气泡
    monopolyStore.setAiThinking(p.id)
    // 延迟 1.2-2s 让用户看清
    const delay = 1200 + Math.random() * 800
    aiTimer = setTimeout(() => { aiTimer = null; aiAct() }, delay)
}
function aiAct() {
    const g = monopolyStore.gameState
    if (!g || g.phase !== 'rolling') return
    const p = monopolyStore.currentPlayer
    if (!p || !p.isAI) return
    if (p.inJail) {
        if (p.getOutCards > 0) monopolyStore.jailUseCard()
        else if (p.cash >= GET_OUT_FEE) monopolyStore.jailPay()
        else monopolyStore.jailRoll()
        if (!monopolyStore.currentPlayer?.inJail) {
            setTimeout(() => scheduleAI(), 800)
        }
        return
    }
    // AI 可能先使用道具卡
    if (Math.random() < 0.3) {
        monopolyStore.aiTryUseCard(p)
    }
    monopolyStore.rollDice()
}

function startMoveAnimation() {
    if (animating) return
    const g = monopolyStore.gameState
    const mv = g?.pendingMove
    if (!mv) { monopolyStore.applyMove(); return }
    animating = true
    const pid = mv.playerId
    if (!mv.path || !mv.path.length) {
        displayPos[pid] = mv.finalPos
        animating = false
        monopolyStore.applyMove()
        return
    }
    let i = 0
    const step = () => {
        if (i < mv.path.length) {
            displayPos[pid] = mv.path[i]
            i++
            // 150ms/格，比之前稍慢，让用户看清移动
            setTimeout(step, 150)
        } else {
            displayPos[pid] = mv.finalPos
            animating = false
            // 落格后停顿 0.6s 再结算
            setTimeout(() => monopolyStore.applyMove(), 600)
        }
    }
    step()
}

watch(() => monopolyStore.gameState?.phase, (np) => {
    if (np === 'moving') nextTick(startMoveAnimation)
    // AI 在 action 阶段后自动推进到下一回合
    if (np === 'action' && monopolyStore.currentPlayer?.isAI) {
        // AI 买地已经在 store 里自动处理了
        // 这里等 store 处理完后会自动 endTurn 或设为 rolling
    }
})
watch(() => [monopolyStore.gameState?.phase, monopolyStore.gameState?.currentTurn], () => {
    scheduleAI()
})

onMounted(() => {
    if (!monopolyStore.currentRoom || !monopolyStore.gameState) {
        monopolyStore.loadState()
    }
    if (!monopolyStore.currentRoom || !monopolyStore.gameState || monopolyStore.gameState.phase === 'ended') {
        router.replace('/games/monopoly-lobby')
        return
    }
    syncDisplay()
    scheduleAI()
})

function confirmEnd() {
    showEndConfirm.value = true
}
function doEnd() {
    showEndConfirm.value = false
    monopolyStore.finishGame()
}
function backToLobby() {
    monopolyStore.leaveRoom()
    router.push('/games/monopoly-lobby')
}
function confirmLeave() {
    showEndConfirm.value = false
    monopolyStore.leaveRoom()
    router.push('/games/monopoly-lobby')
}
</script>

<style scoped>
/* ===== 棋盘容器（蓝黄主题） ===== */
.mono-board {
    background: linear-gradient(145deg, #d6eaf8, #aed6f1);
    border: 4px solid #2e86c1;
    border-radius: 16px;
    box-shadow:
        0 12px 28px rgba(0, 0, 0, 0.15),
        inset 0 2px 0 rgba(255, 255, 255, 0.5),
        inset 0 -6px 0 rgba(46, 134, 193, 0.2);
}

.tile {
    position: relative;
    background: linear-gradient(180deg, #fefefe 0%, #ebf5fb 100%);
    border: 1px solid #aed6f1;
    border-radius: 5px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    cursor: pointer;
    min-width: 0;
    min-height: 0;
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.9),
        inset 0 -3px 0 rgba(174, 214, 241, 0.3),
        0 2px 3px rgba(0, 0, 0, 0.05);
    transition: transform 0.12s, box-shadow 0.12s;
}

.tile:active {
    transform: translateY(-1px) scale(1.03);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 6px 10px rgba(0, 0, 0, 0.1);
    z-index: 5;
}

.tile.sel {
    outline: 2px solid #f4d03f;
    outline-offset: -2px;
    z-index: 5;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 0 0 2px rgba(244, 208, 63, 0.4), 0 4px 8px rgba(0, 0, 0, 0.12);
}

.tile-bar { height: 22%; width: 100%; box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.08); }
.tile-body { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 1px; text-align: center; }
.tile-name { font-size: 8px; line-height: 1.05; color: #2c3e50; font-weight: 700; overflow: hidden; max-height: 2.1em; width: 100%; text-shadow: 0 1px 0 rgba(255, 255, 255, 0.8); }
.tile-name.sm { font-size: 7px; }
.tile-price { font-size: 7px; color: #2e86c1; font-weight: 800; }
.tile-icon { font-size: 14px; line-height: 1; filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.15)); }
.tile-house { position: absolute; bottom: 1px; right: 1px; font-size: 8px; background: rgba(255, 255, 255, 0.9); border-radius: 3px; padding: 0 1px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15); }
.tile-owner { position: absolute; top: 2px; left: 2px; width: 7px; height: 7px; border-radius: 50%; box-shadow: 0 0 0 1.5px #fff, 0 1px 2px rgba(0, 0, 0, 0.25); }

.t-go { background: linear-gradient(180deg, #fef9e7, #fde68a) !important; }
.t-jail, .t-gotojail { background: linear-gradient(180deg, #fee2e2, #fecaca) !important; }
.t-parking { background: linear-gradient(180deg, #dcfce7, #bbf7d0) !important; }
.t-chance { background: linear-gradient(180deg, #dbeafe, #bfdbfe) !important; }
.t-chest { background: linear-gradient(180deg, #fef3c7, #fde68a) !important; }
.t-tax { background: linear-gradient(180deg, #ffedd5, #fed7aa) !important; }

/* ===== AI 思考气泡 ===== */
.think-bubble {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: rgba(255, 255, 255, 0.9);
    border: 1.5px solid #aed6f1;
    border-radius: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    animation: bobble 2s infinite;
}
.think-emoji { font-size: 18px; }
.think-text { font-size: 12px; color: #2c3e50; font-weight: 600; }
@keyframes bobble {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-2px); }
}

/* ===== 卡牌动画 ===== */
.card-anim-overlay {
    position: fixed;
    inset: 0;
    z-index: 150;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    background: rgba(0, 0, 0, 0.3);
}
.card-anim-box {
    background: white;
    border: 3px solid #5dade2;
    border-radius: 16px;
    padding: 16px 24px;
    text-align: center;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    animation: cardPop 1.5s ease-out forwards;
}
.card-anim-type {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 10px;
    color: white;
    font-size: 10px;
    font-weight: 700;
    margin-bottom: 8px;
}
.card-anim-name { font-size: 18px; font-weight: 900; color: #2c3e50; }
.card-anim-desc { font-size: 12px; color: #6b7280; margin-top: 4px; }
.card-anim-player { font-size: 11px; color: #9ca3af; margin-top: 8px; }
@keyframes cardPop {
    0% { transform: scale(0.5) rotate(-10deg); opacity: 0; }
    20% { transform: scale(1.1) rotate(2deg); opacity: 1; }
    80% { transform: scale(1) rotate(0deg); opacity: 1; }
    100% { transform: scale(0.9) rotate(0deg); opacity: 0; }
}

/* ===== 信息面板 ===== */
.info-panel {
    background: linear-gradient(145deg, #fefefe, #ebf5fb);
    border: 1px solid #aed6f1;
    border-radius: 16px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}
.cp-turn { display: flex; align-items: center; gap: 6px; }
.cp-avatar { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 16px; overflow: hidden; border: 2px solid #fff; box-shadow: 0 3px 6px rgba(0, 0, 0, 0.2); }
.cp-avatar img { width: 100%; height: 100%; object-fit: cover; }
.cp-info { line-height: 1.1; }
.cp-name { font-size: 12px; font-weight: 800; color: #2c3e50; }
.cp-you { font-size: 9px; background: #5dade2; color: #fff; border-radius: 6px; padding: 0 4px; margin-left: 2px; }
.cp-char { font-size: 9px; color: #7fb3d5; margin-left: 4px; }
.cp-sub { font-size: 9px; color: #6b7280; }
.cp-dice { display: flex; gap: 6px; }
.die {
    width: 30px; height: 30px;
    background: linear-gradient(145deg, #fff, #ebf5fb);
    border: 1px solid #5dade2;
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; color: #2e86c1;
    box-shadow: 0 3px 5px rgba(0, 0, 0, 0.1), inset 0 -2px 0 rgba(46, 134, 193, 0.1);
}
.die.rolling { animation: diceroll 0.4s infinite; }
@keyframes diceroll { 0%, 100% { transform: rotate(-8deg) scale(1); } 50% { transform: rotate(8deg) scale(1.08); } }
.cp-detail { width: 100%; background: rgba(255, 255, 255, 0.85); border-radius: 8px; padding: 4px 6px; text-align: center; }
.cp-detail-name { font-size: 11px; font-weight: 800; color: #2c3e50; display: flex; align-items: center; justify-content: center; gap: 4px; }
.cp-detail-name .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15); }
.cp-detail-line { font-size: 9px; color: #6b7280; line-height: 1.3; }
.cp-hint { font-size: 9px; color: #9ca3af; }

/* ===== 手牌区 ===== */
.card-hand { background: rgba(255, 255, 255, 0.85); border-radius: 12px; padding: 6px 8px; }
.card-hand-title { font-size: 10px; font-weight: 700; color: #2c3e50; margin-bottom: 4px; }
.card-hand-scroll { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; }
.mini-card {
    flex: 0 0 80px;
    background: white;
    border: 2px solid #5dade2;
    border-radius: 8px;
    padding: 4px 6px;
    text-align: center;
    cursor: pointer;
    transition: transform 0.15s;
}
.mini-card:active { transform: scale(0.95); }
.mini-card-type { display: inline-block; padding: 1px 6px; border-radius: 6px; color: white; font-size: 8px; font-weight: 700; margin-bottom: 2px; }
.mini-card-name { font-size: 10px; font-weight: 700; color: #2c3e50; }
.mini-card-desc { font-size: 7px; color: #6b7280; line-height: 1.2; margin-top: 1px; }

/* ===== 棋子 ===== */
.token {
    position: absolute;
    width: 20px; height: 20px;
    border-radius: 50%;
    border: 2.5px solid #fff;
    background: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px;
    transform: translate(-50%, -55%);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.08);
    transition: left 0.15s linear, top 0.15s linear;
    z-index: 30;
}
.token.active {
    box-shadow: 0 0 0 3px #f4d03f, 0 6px 14px rgba(0, 0, 0, 0.3);
    transform: translate(-50%, -60%);
    z-index: 31;
}
.token img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.tok-dead { position: absolute; font-size: 10px; filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.3)); }

/* ===== 操作按钮 ===== */
.action-bar .act-btn {
    padding: 12px; border-radius: 14px; font-weight: 800; color: #fff;
    transition: all 0.15s; text-align: center;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.25), inset 0 -3px 0 rgba(0, 0, 0, 0.08);
}
.act-btn:active { transform: translateY(2px) scale(0.97); }
.act-btn:disabled { opacity: 0.45; }
.act-btn.blue { background: linear-gradient(135deg, #5dade2, #2e86c1); }
.act-btn.yellow { background: linear-gradient(135deg, #f4d03f, #d4ac0d); }
.act-btn.green { background: linear-gradient(135deg, #52be80, #27ae60); }
.act-btn.sky { background: #5dade2; }
.act-btn.gray { background: #95a5a6; }

.build-chip {
    flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; gap: 1px;
    padding: 4px 8px; background: linear-gradient(180deg, #fefefe, #ebf5fb);
    border: 1px solid #aed6f1; border-radius: 10px; font-size: 10px; color: #2e86c1; min-width: 64px;
    box-shadow: 0 2px 3px rgba(0, 0, 0, 0.05);
}
.build-chip.full { background: linear-gradient(180deg, #fef9e7, #fde68a); border-color: #f4d03f; color: #d4ac0d; }
.build-chip:disabled { opacity: 0.5; }

.panel { overflow: hidden; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.card-pop-enter-active, .card-pop-leave-active { transition: opacity 0.2s; }
.card-pop-enter-from, .card-pop-leave-to { opacity: 0; }
</style>
