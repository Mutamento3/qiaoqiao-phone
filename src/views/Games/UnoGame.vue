<template>
    <div class="uno-game w-full h-full flex flex-col bg-[#064e3b] relative overflow-hidden">
        <!-- 顶部栏 -->
        <div
            class="h-[50px] bg-gradient-to-r from-emerald-700 to-green-700 flex items-center justify-between px-3 text-white shadow-lg z-20 flex-shrink-0">
            <button @click="backToLobby" class="w-9 h-9 flex items-center justify-center">
                <i class="fa-solid fa-chevron-left text-lg"></i>
            </button>
            <div class="flex items-center gap-3 text-sm">
                <span class="font-black tracking-wide">UNO</span>
                <span class="text-emerald-100"><i class="fa-solid fa-rotate"
                        :class="gs?.direction === 1 ? 'fa-flip-horizontal' : ''"></i> {{ gs?.direction === 1 ? '顺' : '逆' }}</span>
            </div>
            <div class="flex items-center gap-1">
                <span class="text-[11px] text-emerald-100">色</span>
                <span class="w-4 h-4 rounded-full border-2 border-white shadow" :style="colorChipStyle"></span>
            </div>
        </div>

        <!-- 对手区 -->
        <div class="flex justify-around items-start px-2 pt-3 gap-2 z-10 flex-shrink-0">
            <div v-for="opp in opponents" :key="opp.id"
                class="flex flex-col items-center rounded-2xl px-2 py-2 transition-all min-w-0"
                :class="opp.isTurn ? 'bg-white/15 ring-2 ring-yellow-300' : 'bg-white/5'">
                <div class="flex items-center gap-1 max-w-full">
                    <div v-if="isImageAvatar(opp.avatar)" class="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
                        <img :src="opp.avatar" class="w-full h-full object-cover" />
                    </div>
                    <div v-else class="text-xl flex-shrink-0">{{ opp.avatar || '👤' }}</div>
                    <div class="text-white text-xs font-bold max-w-[64px] truncate">{{ opp.name }}</div>
                </div>
                <div class="flex mt-1 items-center">
                    <div v-for="n in Math.min(opp.count, 6)" :key="n" class="uno-back-mini -ml-1 first:ml-0"></div>
                    <span v-if="opp.count > 6" class="text-white/70 text-[10px] ml-1">+{{ opp.count - 6 }}</span>
                </div>
                <div class="text-white/80 text-[11px] mt-1">{{ opp.count }} 张</div>
                <div v-if="opp.count === 1 && opp.calledUno"
                    class="text-yellow-300 text-[10px] font-black mt-0.5 animate-pulse">UNO!</div>
            </div>
        </div>

        <!-- 中央牌堆 -->
        <div class="flex-1 flex items-center justify-center gap-8 relative z-10">
            <!-- 弃牌堆（顶牌） -->
            <div class="flex flex-col items-center">
                <div class="uno-card rounded-xl border-[3px] border-white shadow-2xl relative overflow-hidden"
                    :style="cardBg(topCard)" :class="cardTextClass(topCard)">
                    <span class="absolute top-1 left-1.5 text-[11px] font-black opacity-90 leading-none">{{ topCard?.symbol }}</span>
                    <div class="absolute inset-0 flex items-center justify-center">
                        <div v-if="topCard && topCard.color !== 'wild'"
                            class="uno-oval flex items-center justify-center">
                            <span class="font-black leading-none text-4xl" :style="{ color: cardSymbolColor(topCard) }">{{ topCard.symbol }}</span>
                        </div>
                        <span v-else class="text-white text-4xl font-black leading-none drop-shadow">{{ topCard?.symbol }}</span>
                    </div>
                    <span class="absolute bottom-1 right-1.5 text-[11px] font-black opacity-90 leading-none rotate-180">{{ topCard?.symbol }}</span>
                </div>
                <div class="text-white/70 text-xs mt-1.5">弃牌堆</div>
            </div>

            <!-- 抽牌堆 -->
            <button @click="onDraw" :disabled="!isHumanTurn || !!pickingColor"
                class="flex flex-col items-center active:scale-95 transition-transform disabled:opacity-60">
                <div class="uno-back rounded-xl border-[3px] border-white shadow-2xl w-[76px] h-[110px] relative overflow-hidden">
                    <div class="absolute inset-0 flex items-center justify-center">
                        <div class="w-9 h-9 rounded-full bg-white flex items-center justify-center">
                            <span class="text-emerald-700 font-black text-sm">UNO</span>
                        </div>
                    </div>
                </div>
                <div class="text-white/70 text-xs mt-1.5">抽牌 ({{ gs?.deck.length }})</div>
            </button>
        </div>

        <!-- 事件提示 -->
        <div class="text-center text-white/80 text-xs mb-1 z-10 px-4 truncate">{{ lastEvent }}</div>

        <!-- 玩家手牌区 -->
        <div class="px-2 pb-4 z-10 flex-shrink-0">
            <div class="flex items-center justify-between mb-2 px-1">
                <div class="text-white text-sm font-bold">
                    <span v-if="isHumanTurn" class="text-yellow-300">★ 你的回合</span>
                    <span v-else>{{ currentPlayer?.name }} 的回合…</span>
                </div>
                <div class="flex gap-2">
                    <button v-if="showUnoBtn" @click="callUnoNow"
                        class="px-4 py-2 rounded-full bg-yellow-400 text-red-700 font-black text-sm shadow active:scale-90 animate-pulse">UNO!</button>
                    <button v-if="showPass" @click="humanPass"
                        class="px-4 py-2 rounded-full bg-white/20 text-white font-bold text-sm shadow active:scale-90">过</button>
                </div>
            </div>
            <div class="flex overflow-x-auto gap-1.5 pb-2 justify-center">
                <div v-for="card in humanHand" :key="card.id" @click="onHumanCardClick(card)"
                    class="uno-card rounded-xl border-[3px] border-white shadow-md relative overflow-hidden flex-shrink-0 transition-transform duration-150"
                    :class="[
                        cardTextClass(card),
                        isHumanTurn && isPlayable(card.id) ? 'uno-playable cursor-pointer' : 'uno-unplayable',
                        isHumanTurn ? '' : 'cursor-default'
                    ]" :style="cardBg(card)">
                    <span class="absolute top-0.5 left-1 text-[10px] font-black opacity-90 leading-none">{{ card.symbol }}</span>
                    <div class="absolute inset-0 flex items-center justify-center">
                        <div v-if="card.color !== 'wild'" class="uno-oval flex items-center justify-center">
                            <span class="font-black leading-none text-2xl" :style="{ color: cardSymbolColor(card) }">{{ card.symbol }}</span>
                        </div>
                        <span v-else class="text-white text-2xl font-black leading-none drop-shadow">{{ card.symbol }}</span>
                    </div>
                    <span class="absolute bottom-0.5 right-1 text-[10px] font-black opacity-90 leading-none rotate-180">{{ card.symbol }}</span>
                </div>
            </div>
        </div>

        <!-- 颜色选择弹窗 -->
        <Transition name="fade">
            <div v-if="pickingColor" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50" @click.self="cancelColor">
                <div class="bg-white rounded-2xl p-6 text-center shadow-2xl">
                    <div class="font-bold mb-4 text-gray-800">选择颜色</div>
                    <div class="grid grid-cols-2 gap-4">
                        <button v-for="c in ['red', 'yellow', 'green', 'blue']" :key="c" @click="chooseColor(c)"
                            class="w-20 h-20 rounded-xl shadow-lg active:scale-95 border-2 border-white"
                            :style="{ background: COLOR_META[c].hex }"></button>
                    </div>
                    <button @click="cancelColor" class="mt-4 text-gray-400 text-sm">取消</button>
                </div>
            </div>
        </Transition>

        <!-- 结算弹窗 -->
        <Transition name="fade">
            <div v-if="gs?.phase === 'finished'" class="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
                <div class="bg-gradient-to-br from-amber-50 to-orange-100 rounded-[24px] p-6 w-[300px] text-center shadow-2xl">
                    <div class="text-5xl mb-2">{{ winnerInfo?.winnerAvatar }}</div>
                    <h2 class="text-2xl font-black text-gray-800 mb-1">{{ winnerInfo?.winnerName }}</h2>
                    <p class="text-gray-600 mb-5">{{ winnerInfo?.isUser ? '🎉 你赢了！' : '本局获胜' }}</p>
                    <div class="flex gap-3">
                        <button @click="backToLobby"
                            class="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold active:scale-95">返回大厅</button>
                        <button @click="playAgain"
                            class="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-xl font-bold active:scale-95">再来一局</button>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- 退出确认 -->
        <div v-if="showConfirm" class="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div class="bg-white rounded-2xl p-6 max-w-[300px] w-full shadow-2xl">
                <h3 class="text-lg font-bold text-center mb-4 text-gray-800">退出对局</h3>
                <p class="text-center text-gray-600 mb-6">确定要退出当前对局吗？</p>
                <div class="flex gap-3">
                    <button @click="showConfirm = false"
                        class="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm active:scale-95">取消</button>
                    <button @click="confirmBack"
                        class="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-bold text-sm active:scale-95">退出</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useUnoStore } from '../../stores/unoStore.js'
import { getPlayableCards, COLOR_META, topCardOf } from '../../utils/uno/unoEngine.js'

const router = useRouter()
const unoStore = useUnoStore()

const pickingColor = ref(null)
const drewThisTurn = ref(false)
const aiTimer = ref(null)
const showConfirm = ref(false)

const room = computed(() => unoStore.currentRoom)
const gs = computed(() => unoStore.gameState)
const players = computed(() => room.value?.players || [])
const humanHand = computed(() => gs.value?.hands?.[0] || [])
const topCard = computed(() => (gs.value?.discard?.length ? topCardOf(gs.value) : null))
const currentColor = computed(() => gs.value?.currentColor)
const isHumanTurn = computed(() => gs.value?.currentPlayerIndex === 0 && gs.value?.phase === 'playing')
const currentPlayer = computed(() => players.value[gs.value?.currentPlayerIndex])
const lastEvent = computed(() => gs.value?.log?.[0] || '')
const winnerInfo = computed(() => gs.value?.roundResult)

const opponents = computed(() =>
    players.value.map((p, i) => ({
        ...p,
        index: i,
        count: gs.value?.hands?.[i]?.length || 0,
        isTurn: gs.value?.currentPlayerIndex === i,
        calledUno: gs.value?.unoCalled?.[i]
    })).filter((o) => o.index !== 0)
)

const playableIds = computed(() => {
    if (!isHumanTurn.value) return []
    return getPlayableCards(humanHand.value, topCard.value, currentColor.value).map((c) => c.id)
})

const showUnoBtn = computed(() =>
    isHumanTurn.value && humanHand.value.length <= 2 && !gs.value?.unoCalled?.[0]
)
const showPass = computed(() =>
    isHumanTurn.value && (drewThisTurn.value || playableIds.value.length === 0)
)

const colorChipStyle = computed(() => ({
    background: currentColor.value ? COLOR_META[currentColor.value]?.hex : '#fff'
}))

const isImageAvatar = (avatar) => {
    if (!avatar) return false
    return avatar.startsWith('/') || avatar.startsWith('data:image') || avatar.startsWith('http')
}

function cardBg(card) {
    if (!card) return { background: '#374151' }
    if (card.color === 'wild') {
        return { background: 'conic-gradient(from 0deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #ef4444)' }
    }
    return { background: COLOR_META[card.color].hex }
}

function cardTextClass(card) {
    if (!card) return 'text-white'
    return card.color === 'yellow' ? 'text-gray-900' : 'text-white'
}

function cardSymbolColor(card) {
    if (!card || card.color === 'wild') return '#ffffff'
    return COLOR_META[card.color].hex
}

function isPlayable(id) {
    return playableIds.value.includes(id)
}

function onHumanCardClick(card) {
    if (!isHumanTurn.value || pickingColor.value) return
    if (!playableIds.value.includes(card.id)) return
    if (card.type === 'wild' || card.type === 'wild4') {
        pickingColor.value = card.id
        return
    }
    playNow(card.id, null)
}

function playNow(cardId, color) {
    unoStore.playCard(0, cardId, color)
    drewThisTurn.value = false
    scheduleAI()
}

function chooseColor(color) {
    const cardId = pickingColor.value
    pickingColor.value = null
    if (cardId) playNow(cardId, color)
}

function cancelColor() {
    pickingColor.value = null
}

function onDraw() {
    if (!isHumanTurn.value || pickingColor.value) return
    const c = unoStore.drawOne(0)
    if (c) drewThisTurn.value = true
    else humanPass()
}

function humanPass() {
    if (!isHumanTurn.value) return
    unoStore.passTurn(0)
    drewThisTurn.value = false
    scheduleAI()
}

function callUnoNow() {
    unoStore.callUno(0)
}

function backToLobby() {
    showConfirm.value = true
}

function confirmBack() {
    showConfirm.value = false
    unoStore.returnToLobby()
    router.push('/games/uno-lobby')
}

function playAgain() {
    unoStore.startNewGame()
    unoStore.startGame()
    drewThisTurn.value = false
    scheduleAI()
}

// 驱动 AI 回合的定时器链
function scheduleAI() {
    if (aiTimer.value) clearTimeout(aiTimer.value)
    const s = unoStore.gameState
    if (!s || s.phase !== 'playing') return
    const p = unoStore.currentRoom?.players[s.currentPlayerIndex]
    if (!p || !p.isAI) return
    aiTimer.value = setTimeout(() => {
        unoStore.aiStep()
        if (unoStore.gameState?.phase === 'playing') scheduleAI()
    }, 850)
}

watch(
    () => [gs.value?.currentPlayerIndex, gs.value?.phase],
    () => {
        drewThisTurn.value = false
        scheduleAI()
    }
)

onMounted(() => {
    if (!room.value) {
        router.replace('/games/uno-lobby')
        return
    }
    if (!gs.value) {
        unoStore.startGame()
    }
    nextTick(() => scheduleAI())
})

onUnmounted(() => {
    if (aiTimer.value) clearTimeout(aiTimer.value)
})
</script>

<style scoped>
.uno-game {
    max-width: 600px;
    margin: 0 auto;
}

.uno-card {
    width: 56px;
    height: 82px;
}

.uno-oval {
    width: 72%;
    height: 72%;
    border-radius: 9999px;
    background: white;
}

.uno-playable {
    outline: none;
    box-shadow: 0 0 0 3px #fde047, 0 8px 16px rgba(0, 0, 0, 0.35);
}

.uno-playable:hover {
    transform: translateY(-10px);
    z-index: 10;
}

.uno-unplayable {
    opacity: 0.5;
    filter: saturate(0.6);
}

.uno-back {
    background: linear-gradient(135deg, #dc2626, #991b1b);
}

.uno-back-mini {
    width: 22px;
    height: 33px;
    border-radius: 4px;
    background: linear-gradient(135deg, #dc2626, #991b1b);
    border: 1.5px solid rgba(255, 255, 255, 0.7);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.25s;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
