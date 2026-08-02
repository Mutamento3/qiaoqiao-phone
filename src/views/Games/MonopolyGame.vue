<template>
    <div class="mono-game w-full h-full flex flex-col bg-gradient-to-br from-amber-100 via-orange-50 to-rose-50 overflow-hidden">
        <!-- 顶部导航 -->
        <div class="h-[50px] bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-between px-3 shadow-lg shrink-0">
            <button @click="confirmLeave" class="w-10 h-10 flex items-center justify-center text-white">
                <i class="fa-solid fa-chevron-left text-xl"></i>
            </button>
            <h1 class="text-base font-bold text-white flex items-center gap-2">
                <span>🎩</span><span>大富翁</span>
                <span class="text-[11px] bg-white/25 px-2 py-0.5 rounded-full">回合 {{ gs?.round || 1 }}</span>
            </h1>
            <button @click="confirmEnd" class="h-9 px-3 rounded-full bg-white/25 text-white text-xs font-bold active:scale-95">
                结束结算
            </button>
        </div>

        <!-- 棋盘 -->
        <div class="flex-1 flex items-center justify-center p-2 overflow-hidden">
            <div ref="boardEl" class="mono-board relative w-full max-w-[460px] aspect-square bg-white rounded-2xl shadow-xl"
                style="display:grid;grid-template-columns:repeat(11,1fr);grid-template-rows:repeat(11,1fr);gap:1px;padding:1px;">
                <!-- 格子 -->
                <template v-for="tile in BOARD" :key="tile.id">
                    <div class="tile" :class="['t-' + tile.type, { owned: !!tileOwner(tile.id), sel: selectedTile === tile.id }]"
                        :style="gridStyle(tile.id)"
                        @click="selectedTile = (selectedTile === tile.id ? null : tile.id)">
                        <!-- 颜色条 -->
                        <div v-if="tile.type === 'property' && GROUPS[tile.group]" class="tile-bar"
                            :style="{ background: GROUPS[tile.group].color }"></div>
                        <div v-else-if="tile.type === 'station'" class="tile-bar" :style="{ background: GROUPS.station.color }"></div>
                        <div v-else-if="tile.type === 'utility'" class="tile-bar" :style="{ background: GROUPS.utility.color }"></div>

                        <!-- 图标 / 名称 -->
                        <div class="tile-body">
                            <template v-if="tile.type === 'property' || tile.type === 'station' || tile.type === 'utility'">
                                <div class="tile-name">{{ tile.name }}</div>
                                <div v-if="tile.type !== 'station' && tile.type !== 'utility'" class="tile-price">¥{{ tile.price }}</div>
                                <div v-else class="tile-price">¥{{ tile.price }}</div>
                            </template>
                            <template v-else>
                                <div class="tile-icon">{{ tileIcon(tile) }}</div>
                                <div class="tile-name sm">{{ tile.name }}</div>
                            </template>
                        </div>

                        <!-- 房/旅馆标记 -->
                        <div v-if="houseCount(tile.id) > 0" class="tile-house">
                            {{ houseCount(tile.id) >= 5 ? '🏨' : '🏠'.repeat(Math.min(houseCount(tile.id), 4)) }}
                        </div>
                        <!-- 地主标记 -->
                        <div v-if="tileOwner(tile.id)" class="tile-owner" :style="{ background: tileOwner(tile.id)?.color }"></div>
                    </div>
                </template>

                <!-- 中央控制区 -->
                <div class="center-panel" style="grid-column:2/11;grid-row:2/11;">
                    <div class="cp-turn">
                        <div class="cp-avatar" :style="{ background: currentPlayer?.color }">
                            <img v-if="isImg(currentPlayer?.avatar)" :src="currentPlayer?.avatar" />
                            <span v-else>{{ currentPlayer?.avatar || '👤' }}</span>
                        </div>
                        <div class="cp-info">
                            <div class="cp-name">{{ currentPlayer?.name || '—' }} <span v-if="currentPlayer?.isUser" class="cp-you">你</span></div>
                            <div class="cp-sub">
                                <span v-if="currentPlayer?.inJail" class="text-red-500 font-bold">🔒 蹲监狱</span>
                                <span v-else>轮到行动</span>
                                · 现金 ¥{{ currentPlayer?.cash }}
                            </div>
                        </div>
                    </div>

                    <!-- 骰子 -->
                    <div class="cp-dice">
                        <div class="die" :class="{ rolling: gs?.phase === 'moving' }">{{ diceFace(gs?.dice?.[0]) }}</div>
                        <div class="die" :class="{ rolling: gs?.phase === 'moving' }">{{ diceFace(gs?.dice?.[1]) }}</div>
                    </div>

                    <!-- 选中地块详情 -->
                    <div v-if="selectedTileObj" class="cp-detail">
                        <div class="cp-detail-name">
                            {{ selectedTileObj.name }}
                            <span v-if="selectedTileObj.type === 'property'" class="dot" :style="{ background: GROUPS[selectedTileObj.group]?.color }"></span>
                        </div>
                        <div class="cp-detail-line" v-if="selectedTileObj.type === 'property' || selectedTileObj.type === 'station' || selectedTileObj.type === 'utility'">
                            价格 ¥{{ selectedTileObj.price }} · 基础租金 ¥{{ baseRentOf(selectedTileObj) }}
                        </div>
                        <div class="cp-detail-line" v-if="selectedOwner">
                            地主：{{ selectedOwner.name }}（{{ selectedOwner.houses?.[selectedTileObj.id] || 0 }} 栋）
                        </div>
                        <div class="cp-detail-line" v-else-if="selectedTileObj.type === 'property' || selectedTileObj.type === 'station' || selectedTileObj.type === 'utility'">
                            暂无地主
                        </div>
                    </div>
                    <div v-else class="cp-hint">点击棋盘上的地块查看详情</div>
                </div>

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

        <!-- 操作栏 -->
        <div class="action-bar shrink-0 bg-white/90 backdrop-blur border-t border-amber-100 px-3 py-3">
            <!-- 用户：监狱 -->
            <div v-if="isUserTurn && gs?.phase === 'rolling' && currentPlayer?.inJail" class="flex gap-2">
                <button @click="monopolyStore.jailUseCard()" :disabled="!currentPlayer.getOutCards" class="act-btn amber flex-1">用出狱卡 ({{ currentPlayer.getOutCards }})</button>
                <button @click="monopolyStore.jailPay()" :disabled="currentPlayer.cash < 50" class="act-btn green flex-1">保释 ¥50</button>
                <button @click="monopolyStore.jailRoll()" class="act-btn blue flex-1">掷骰出狱</button>
            </div>
            <!-- 用户：掷骰 -->
            <button v-else-if="isUserTurn && gs?.phase === 'rolling'" @click="monopolyStore.rollDice()"
                class="act-btn orange w-full text-lg">
                <i class="fa-solid fa-dice mr-2"></i>掷骰子
            </button>
            <!-- 用户：买地 -->
            <div v-else-if="isUserTurn && gs?.phase === 'action' && gs?.awaitingBuy != null" class="flex gap-2">
                <button @click="monopolyStore.buyProperty(gs.awaitingBuy)" :disabled="currentPlayer.cash < buyTile.price"
                    class="act-btn green flex-1">买下 ¥{{ buyTile.price }}</button>
                <button @click="monopolyStore.skipBuy()" class="act-btn gray flex-1">放弃</button>
            </div>
            <!-- 用户：结束回合 -->
            <div v-else-if="isUserTurn && gs?.phase === 'action' && gs?.awaitingEnd && gs?.awaitingBuy == null" class="flex gap-2">
                <button v-if="gs?.awaitingReroll" @click="monopolyStore.userReroll()" class="act-btn blue flex-1">再掷一次（双骰）</button>
                <button @click="monopolyStore.userEndTurn()" class="act-btn orange flex-1">结束回合</button>
            </div>
            <!-- AI 行动中 -->
            <div v-else class="text-center text-gray-400 text-sm py-1">
                <span v-if="gs?.phase === 'moving'">🎲 移动中…</span>
                <span v-else-if="currentPlayer?.isAI">{{ currentPlayer?.name }} 思考中…</span>
                <span v-else>等待…</span>
            </div>

            <!-- 盖房面板 -->
            <div v-if="isUserTurn && userBuildList.length" class="mt-2">
                <div class="text-[11px] text-gray-400 mb-1">我的地产（垄断组可盖房）</div>
                <div class="flex gap-1.5 overflow-x-auto pb-1">
                    <button v-for="b in userBuildList" :key="b.id" @click="monopolyStore.buildHouse(b.id)"
                        :disabled="currentPlayer.cash < b.cost || b.houses >= 5"
                        class="build-chip" :class="{ full: b.houses >= 5 }">
                        <span class="truncate max-w-[60px]">{{ b.name }}</span>
                        <span class="text-[10px]">{{ b.houses >= 5 ? '旅馆' : (b.houses ? '🏠' + b.houses : '空') }}</span>
                        <span class="text-[10px] text-amber-600">¥{{ b.cost }}</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- 日志/聊天切换 -->
        <div class="panel-toggle shrink-0 flex border-t border-amber-100 bg-white">
            <button @click="panelTab = 'log'" class="flex-1 py-2 text-sm font-bold" :class="panelTab === 'log' ? 'text-amber-600' : 'text-gray-400'">📜 事件日志</button>
            <button @click="panelTab = 'chat'" class="flex-1 py-2 text-sm font-bold" :class="panelTab === 'chat' ? 'text-amber-600' : 'text-gray-400'">💬 游戏聊天</button>
        </div>
        <div class="panel shrink-0 bg-white/95 border-t border-amber-100" style="height:140px;">
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

        <!-- 结束结算确认 -->
        <div v-if="showEndConfirm" class="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div class="bg-white rounded-2xl p-6 max-w-[300px] w-full shadow-2xl">
                <h3 class="text-lg font-bold text-center mb-4 text-gray-800">结束并结算</h3>
                <p class="text-center text-gray-600 mb-6">将按当前净资产决出冠军，确定结束？</p>
                <div class="flex gap-3">
                    <button @click="showEndConfirm = false" class="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm">取消</button>
                    <button @click="doEnd" class="flex-1 py-2.5 bg-orange-500 text-white rounded-xl font-bold text-sm">结算</button>
                </div>
            </div>
        </div>

        <!-- 胜利结算 -->
        <Transition name="fade">
            <div v-if="gs?.phase === 'ended'" class="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
                <div class="bg-white rounded-3xl w-full max-w-[380px] p-6 shadow-2xl text-center">
                    <div class="text-6xl mb-2">🏆</div>
                    <h2 class="text-2xl font-black text-amber-600 mb-1">
                        {{ winner ? winner.name + (winner.isUser ? '（你）' : '') : '无人' }} 获胜！
                    </h2>
                    <div class="text-sm text-gray-400 mb-4">净资产 ¥{{ winner ? netWorth(winner) : 0 }}</div>
                    <div class="space-y-1.5 mb-5 text-left">
                        <div v-for="(p, i) in ranking" :key="p.id"
                            class="flex items-center justify-between text-sm bg-gray-50 rounded-xl px-3 py-2">
                            <span class="font-bold"><span class="text-gray-400 mr-1">{{ i + 1 }}</span>{{ p.name }}<span v-if="p.isUser" class="text-amber-500 ml-1">你</span></span>
                            <span :class="p.bankrupt ? 'text-red-400' : 'text-gray-700 font-bold'">{{ p.bankrupt ? '💥出局' : '¥' + netWorth(p) }}</span>
                        </div>
                    </div>
                    <button @click="backToLobby" class="w-full py-3 bg-amber-500 text-white font-bold rounded-xl active:scale-95">返回大厅</button>
                </div>
            </div>
        </Transition>
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, reactive, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useMonopolyStore } from '../../stores/monopolyStore.js'
import {
    BOARD, GROUPS, baseRentOf, houseCostOf, GO_SALARY, MAX_HOUSES, GET_OUT_FEE,
    BOARD_SIZE,
} from '../../utils/monopoly/monopolyBoard.js'

const router = useRouter()
const monopolyStore = useMonopolyStore()
// 同步先恢复状态，避免首次渲染时 gameState 为 null 导致 ownerOf 等 helper 抛错
monopolyStore.loadState()
const boardEl = ref(null)
const selectedTile = ref(null)
const panelTab = ref('log')
const showEndConfirm = ref(false)

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

// 用户可盖房的地产（垄断组）
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
        go: '🏁', jail: '🔒', gotojail: '🚔', parking: '🅿️', tax: '🧾', chance: '❓', chest: '🎴',
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

// 棋子位置（百分比）+ 同格偏移
const TOKEN_OFFSETS = [
    [0, 0], [-9, -9], [9, -9], [-9, 9], [9, 9], [0, -13], [0, 13], [-13, 0],
]
const displayPos = reactive({})
function syncDisplay() {
    players.value.forEach(p => { displayPos[p.id] = p.position })
}
function tokenStyle(p, idx) {
    const pos = displayPos[p.id] ?? p.position
    const { c, r } = gridPos(pos)
    const left = (c - 0.5) / 11 * 100
    const top = (r - 0.5) / 11 * 100
    const off = TOKEN_OFFSETS[idx % TOKEN_OFFSETS.length]
    return {
        left: `calc(${left}% + ${off[0]}px)`,
        top: `calc(${top}% + ${off[1]}px)`,
        borderColor: p.color,
    }
}

// ---- AI 自动推进 ----
let aiTimer = null
let animating = false
function scheduleAI() {
    const g = monopolyStore.gameState
    if (!g || g.phase !== 'rolling') return
    const p = monopolyStore.currentPlayer
    if (!p || !p.isAI) return
    if (aiTimer) return
    aiTimer = setTimeout(() => { aiTimer = null; aiAct() }, 750)
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
        if (!monopolyStore.currentPlayer?.inJail) scheduleAI() // 出狱后继续掷
        return
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
            setTimeout(step, 110)
        } else {
            displayPos[pid] = mv.finalPos
            animating = false
            monopolyStore.applyMove()
        }
    }
    step()
}

watch(() => monopolyStore.gameState?.phase, (np) => {
    if (np === 'moving') nextTick(startMoveAnimation)
})
watch(() => [monopolyStore.gameState?.phase, monopolyStore.gameState?.currentTurn], () => {
    scheduleAI()
})

onMounted(() => {
    monopolyStore.loadState()
    if (!monopolyStore.currentRoom || !monopolyStore.gameState || monopolyStore.gameState.phase === 'ended') {
        router.replace('/games/monopoly-lobby')
        return
    }
    syncDisplay()
    scheduleAI()
})

// ---- 导航 ----
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
/* ===== 2.5D 棋盘容器 ===== */
.mono-board {
    background: linear-gradient(145deg, #fde68a, #fbbf24);
    border: 4px solid #d97706;
    border-radius: 16px;
    box-shadow:
        0 24px 40px rgba(0, 0, 0, 0.22),
        inset 0 2px 0 rgba(255, 255, 255, 0.35),
        inset 0 -6px 0 rgba(180, 83, 9, 0.25);
    transform-style: preserve-3d;
    transform: perspective(1000px) rotateX(20deg) scale(1.04);
}

/* ===== 立体格子 ===== */
.tile {
    position: relative;
    background: linear-gradient(180deg, #fffdf5 0%, #fff8e1 100%);
    border: 1px solid #f59e0b;
    border-radius: 5px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    cursor: pointer;
    min-width: 0;
    min-height: 0;
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.9),
        inset 0 -3px 0 rgba(217, 119, 6, 0.15),
        0 2px 3px rgba(0, 0, 0, 0.06);
    transition: transform 0.12s, box-shadow 0.12s;
}

.tile:active {
    transform: translateY(-1px) scale(1.03);
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.9),
        inset 0 -1px 0 rgba(217, 119, 6, 0.15),
        0 6px 10px rgba(0, 0, 0, 0.12);
    z-index: 5;
}

.tile.sel {
    outline: 2px solid #ef4444;
    outline-offset: -2px;
    z-index: 5;
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.9),
        0 0 0 2px rgba(239, 68, 68, 0.35),
        0 4px 8px rgba(0, 0, 0, 0.15);
}

.tile-bar {
    height: 22%;
    width: 100%;
    box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.08);
}

.tile-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1px;
    text-align: center;
}

.tile-name {
    font-size: 8px;
    line-height: 1.05;
    color: #374151;
    font-weight: 700;
    overflow: hidden;
    max-height: 2.1em;
    width: 100%;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.8);
}

.tile-name.sm {
    font-size: 7px;
}

.tile-price {
    font-size: 7px;
    color: #b45309;
    font-weight: 800;
}

.tile-icon {
    font-size: 14px;
    line-height: 1;
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.15));
}

.tile-house {
    position: absolute;
    bottom: 1px;
    right: 1px;
    font-size: 7px;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 3px;
    padding: 0 1px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}

.tile-owner {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    box-shadow: 0 0 0 1.5px #fff, 0 1px 2px rgba(0, 0, 0, 0.25);
}

.t-go { background: linear-gradient(180deg, #fef3c7, #fde68a) !important; }
.t-jail, .t-gotojail { background: linear-gradient(180deg, #fee2e2, #fecaca) !important; }
.t-parking { background: linear-gradient(180deg, #dcfce7, #bbf7d0) !important; }
.t-chance { background: linear-gradient(180deg, #dbeafe, #bfdbfe) !important; }
.t-chest { background: linear-gradient(180deg, #fae8ff, #f5d0fe) !important; }
.t-tax { background: linear-gradient(180deg, #ffedd5, #fed7aa) !important; }

/* ===== 中央面板（反向旋转保持可读） ===== */
.center-panel {
    background: linear-gradient(145deg, #fffbeb, #fef3c7);
    border: 2px solid #f59e0b;
    border-radius: 14px;
    margin: 3px;
    padding: 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    box-shadow:
        inset 0 0 14px rgba(245, 158, 11, 0.12),
        0 6px 12px rgba(0, 0, 0, 0.1);
    transform: rotateX(-20deg);
    transform-style: preserve-3d;
}

.cp-turn {
    display: flex;
    align-items: center;
    gap: 6px;
}

.cp-avatar {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 16px;
    overflow: hidden;
    border: 2px solid #fff;
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.25);
}

.cp-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.cp-info {
    line-height: 1.1;
}

.cp-name {
    font-size: 12px;
    font-weight: 800;
    color: #1f2937;
}

.cp-you {
    font-size: 9px;
    background: #f59e0b;
    color: #fff;
    border-radius: 6px;
    padding: 0 4px;
    margin-left: 2px;
}

.cp-sub {
    font-size: 9px;
    color: #6b7280;
}

.cp-dice {
    display: flex;
    gap: 6px;
}

.die {
    width: 30px;
    height: 30px;
    background: linear-gradient(145deg, #fff, #fef3c7);
    border: 1px solid #f59e0b;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    color: #b45309;
    box-shadow:
        0 3px 5px rgba(0, 0, 0, 0.15),
        inset 0 -2px 0 rgba(217, 119, 6, 0.15);
}

.die.rolling {
    animation: diceroll 0.4s infinite;
}

@keyframes diceroll {
    0%, 100% { transform: rotate(-8deg) scale(1); }
    50% { transform: rotate(8deg) scale(1.08); }
}

.cp-detail {
    width: 100%;
    background: rgba(255, 255, 255, 0.85);
    border-radius: 8px;
    padding: 4px 6px;
    text-align: center;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.cp-detail-name {
    font-size: 11px;
    font-weight: 800;
    color: #1f2937;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
}

.cp-detail-name .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}

.cp-detail-line {
    font-size: 9px;
    color: #6b7280;
    line-height: 1.3;
}

.cp-hint {
    font-size: 9px;
    color: #9ca3af;
}

/* ===== 悬浮棋子 ===== */
.token {
    position: absolute;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2.5px solid #fff;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    transform: translate(-50%, -55%) rotateX(-20deg) translateZ(14px);
    box-shadow:
        0 6px 10px rgba(0, 0, 0, 0.35),
        0 0 0 1px rgba(0, 0, 0, 0.08);
    transition: left 0.1s linear, top 0.1s linear;
    transform-style: preserve-3d;
    z-index: 30;
}

.token.active {
    box-shadow:
        0 0 0 3px #f59e0b,
        0 8px 16px rgba(0, 0, 0, 0.35);
    transform: translate(-50%, -60%) rotateX(-20deg) translateZ(22px);
    z-index: 31;
}

.token img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
}

.tok-dead {
    position: absolute;
    font-size: 10px;
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.3));
}

/* ===== 操作按钮 ===== */
.action-bar .act-btn {
    padding: 12px;
    border-radius: 14px;
    font-weight: 800;
    color: #fff;
    transition: all 0.15s;
    text-align: center;
    box-shadow:
        0 4px 6px rgba(0, 0, 0, 0.12),
        inset 0 1px 0 rgba(255, 255, 255, 0.25),
        inset 0 -3px 0 rgba(0, 0, 0, 0.1);
}

.act-btn:active { transform: translateY(2px) scale(0.97); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12), inset 0 -1px 0 rgba(0, 0, 0, 0.1); }
.act-btn:disabled { opacity: 0.45; }
.act-btn.orange { background: linear-gradient(135deg, #f59e0b, #ea580c); }
.act-btn.amber { background: #f59e0b; }
.act-btn.green { background: #22c55e; }
.act-btn.blue { background: #3b82f6; }
.act-btn.gray { background: #9ca3af; }

.build-chip {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 4px 8px;
    background: linear-gradient(180deg, #fffbeb, #fef3c7);
    border: 1px solid #fcd34d;
    border-radius: 10px;
    font-size: 10px;
    color: #92400e;
    min-width: 64px;
    box-shadow: 0 2px 3px rgba(0, 0, 0, 0.06);
}

.build-chip.full { background: linear-gradient(180deg, #fde68a, #fcd34d); }
.build-chip:disabled { opacity: 0.5; }

.panel {
    overflow: hidden;
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
