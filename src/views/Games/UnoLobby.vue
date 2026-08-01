<template>
    <div class="uno-lobby w-full h-full flex flex-col bg-emerald-50 overflow-y-auto">
        <!-- 顶部导航 -->
        <div class="h-[56px] bg-gradient-to-r from-emerald-600 to-green-600 flex items-center justify-between px-4 shadow-lg flex-shrink-0">
            <button @click="router.push('/games')" class="w-12 h-12 flex items-center justify-center text-white">
                <i class="fa-solid fa-chevron-left text-xl"></i>
            </button>
            <h1 class="text-xl font-bold text-white flex items-center gap-2">
                <i class="fa-solid fa-clone"></i>
                <span>UNO 大厅</span>
            </h1>
            <button @click="showSettings = true" class="w-12 h-12 flex items-center justify-center text-white">
                <i class="fa-solid fa-gear text-xl"></i>
            </button>
        </div>

        <!-- 个人信息卡片 -->
        <div class="m-4 p-5 bg-white rounded-2xl shadow-md border border-emerald-100">
            <div class="flex items-center gap-5">
                <div class="w-20 h-20 rounded-2xl overflow-hidden shadow-inner border-2 border-emerald-50">
                    <img v-if="isImageAvatar(userAvatar)" :src="userAvatar" class="w-full h-full object-cover" />
                    <div v-else class="w-full h-full flex items-center justify-center text-4xl bg-emerald-50">{{ userAvatar || '👤' }}</div>
                </div>

                <div class="flex-1">
                    <div class="flex items-center gap-2">
                        <span class="text-base font-black text-gray-800">{{ userName }}</span>
                        <span class="px-2 py-0.5 bg-emerald-100 text-emerald-600 text-xs rounded-full font-bold">
                            {{ unoStore.rank }}
                        </span>
                    </div>
                    <div class="text-xs text-gray-400 mt-2 flex flex-wrap gap-4">
                        <span>积分:{{ unoStore.score }}</span>
                        <span>胜率:{{ unoStore.winRate }}%</span>
                        <span>连胜:{{ unoStore.winStreak }}</span>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-xl font-black text-orange-500">{{ formattedBeans }}</div>
                    <div class="text-xs text-gray-400">欢乐豆</div>
                </div>
            </div>

            <button @click="showRecharge = true"
                class="w-full mt-4 py-3 bg-gradient-to-r from-amber-400 to-yellow-500 text-white font-bold rounded-lg shadow-md active:scale-95 transition-transform">
                <i class="fa-solid fa-coins mr-2"></i>
                充值欢乐豆
            </button>
        </div>

        <!-- 快速开始 -->
        <div class="px-4 mb-6">
            <button v-if="hasActiveGame" @click="returnToGame"
                class="w-full py-5 mb-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold text-lg rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 animate-pulse">
                <i class="fa-solid fa-rotate-left text-xl"></i>
                <span>回到牌桌</span>
            </button>
            <button @click="quickStart"
                class="w-full py-5 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold text-lg rounded-2xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-3">
                <i class="fa-solid fa-bolt text-xl"></i>
                <span>快速开始</span>
            </button>
        </div>

        <!-- 功能按钮 -->
        <div class="px-4 grid grid-cols-2 gap-4 mb-6">
            <button @click="showCreateRoom = true"
                class="py-4 bg-white rounded-xl shadow-md active:scale-95 transition-transform flex flex-col items-center gap-3">
                <i class="fa-solid fa-plus-circle text-3xl text-blue-500"></i>
                <span class="text-sm font-bold text-gray-700">创建房间</span>
            </button>

            <button @click="showRanking = true"
                class="py-4 bg-white rounded-xl shadow-md active:scale-95 transition-transform flex flex-col items-center gap-3">
                <i class="fa-solid fa-trophy text-3xl text-yellow-500"></i>
                <span class="text-sm font-bold text-gray-700">排行榜</span>
            </button>
        </div>

        <!-- 游戏规则说明 -->
        <div class="px-4 mb-6">
            <div class="bg-white rounded-xl shadow-md p-5">
                <h3 class="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <i class="fa-solid fa-plus text-emerald-500"></i>
                    <span>游戏规则</span>
                </h3>
                <ul class="text-sm text-gray-600 space-y-2">
                    <li>• 经典：颜色/数字/图案相同即可出牌，万能牌可改色</li>
                    <li>• 叠加：+2 与 +4 可以叠加，下家必须继续叠或抽走累计张数</li>
                    <li>• 抢出：手中有与顶牌完全相同的牌时可随时抢出</li>
                    <li>• 七零：打出 7 与下家换手牌，打出 0 所有人传递手牌</li>
                    <li>• 剩 1 张时必须喊 UNO，否则罚抽 2 张</li>
                </ul>
            </div>
        </div>

        <!-- 充值弹窗 -->
        <Transition name="fade">
            <div v-if="showRecharge" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click="showRecharge = false">
                <div class="bg-white rounded-2xl p-6 m-4 max-w-sm w-full relative" @click.stop>
                    <h2 class="text-xl font-bold mb-4 text-center">充值欢乐豆</h2>
                    <Transition name="fade">
                        <div v-if="toastMsg" class="absolute top-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/80 text-white text-sm rounded-full z-[60] whitespace-nowrap">
                            {{ toastMsg }}
                        </div>
                    </Transition>
                    <div class="space-y-3 mb-6">
                        <button v-for="pkg in rechargePackages" :key="pkg.amount" @click="recharge(pkg)"
                            class="w-full p-4 bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-xl active:scale-95 transition-transform">
                            <div class="flex items-center justify-between">
                                <div class="text-left">
                                    <div class="text-2xl font-bold text-orange-600">{{ pkg.amount }}</div>
                                    <div class="text-xs text-gray-500">欢乐豆</div>
                                </div>
                                <div class="text-right">
                                    <div class="text-xl font-bold text-red-600">¥{{ pkg.price }}</div>
                                    <div v-if="pkg.bonus" class="text-xs text-green-600">送{{ pkg.bonus }}豆</div>
                                </div>
                            </div>
                        </button>
                    </div>
                    <button @click="showRecharge = false" class="w-full py-3 bg-gray-200 text-gray-700 font-bold rounded-lg">取消</button>
                </div>
            </div>
        </Transition>

        <!-- 创建房间弹窗 -->
        <Transition name="fade">
            <div v-if="showCreateRoom" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click="showCreateRoom = false">
                <div class="bg-white rounded-2xl p-6 m-4 max-w-sm w-full max-h-[85vh] overflow-y-auto" @click.stop>
                    <h2 class="text-xl font-bold mb-4 text-center">创建房间</h2>

                    <div class="space-y-5 mb-6">
                        <div>
                            <label class="block text-sm font-bold text-gray-700 mb-3">玩法模式</label>
                            <div class="grid grid-cols-2 gap-2">
                                <button v-for="(label, key) in ruleLabels" :key="key" @click="roomConfig.ruleMode = key"
                                    class="py-2 rounded-lg border-2 transition-all text-sm"
                                    :class="roomConfig.ruleMode === key ? 'border-emerald-500 bg-emerald-50 text-emerald-600 font-bold' : 'border-gray-200 bg-gray-50 text-gray-700'">
                                    {{ label }}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-bold text-gray-700 mb-3">底注</label>
                            <div class="grid grid-cols-3 gap-2">
                                <button v-for="stake in [100, 500, 1000]" :key="stake" @click="roomConfig.baseStake = stake"
                                    class="py-3 rounded-lg border-2 transition-all"
                                    :class="roomConfig.baseStake === stake ? 'border-red-500 bg-red-50 text-red-600 font-bold' : 'border-gray-200 bg-gray-50 text-gray-700'">
                                    {{ stake }}豆
                                </button>
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-bold text-gray-700 mb-3">局数</label>
                            <div class="grid grid-cols-3 gap-2">
                                <button v-for="round in [4, 8, 16]" :key="round" @click="roomConfig.totalRounds = round"
                                    class="py-3 rounded-lg border-2 transition-all"
                                    :class="roomConfig.totalRounds === round ? 'border-blue-500 bg-blue-50 text-blue-600 font-bold' : 'border-gray-200 bg-gray-50 text-gray-700'">
                                    {{ round }}局
                                </button>
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-bold text-gray-700 mb-3">人数（含自己）</label>
                            <div class="grid grid-cols-4 gap-2">
                                <button v-for="n in [2,3,4,5,6,7,8]" :key="n" @click="roomConfig.maxPlayers = n"
                                    class="py-3 rounded-lg border-2 transition-all"
                                    :class="roomConfig.maxPlayers === n ? 'border-purple-500 bg-purple-50 text-purple-600 font-bold' : 'border-gray-200 bg-gray-50 text-gray-700'">
                                    {{ n }}人
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="flex gap-3">
                        <button @click="showCreateRoom = false" class="flex-1 py-3 bg-gray-200 text-gray-700 font-bold rounded-lg">取消</button>
                        <button @click="createRoom" class="flex-1 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold rounded-lg">创建</button>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- 排行榜弹窗 -->
        <Transition name="fade">
            <div v-if="showRanking" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]" @click="showRanking = false">
                <div class="bg-white rounded-[32px] w-full max-w-[450px] m-4 flex flex-col max-h-[85vh] shadow-2xl overflow-hidden" @click.stop>
                    <div class="p-6 bg-gradient-to-br from-yellow-400 to-orange-500 text-white relative">
                        <div class="flex justify-between items-start mb-6">
                            <div>
                                <h2 class="text-3xl font-black italic tracking-wider">TOP榜单</h2>
                                <p class="text-sm opacity-80 font-bold uppercase">UNO Legend</p>
                            </div>
                        </div>
                        <div class="flex justify-around items-end pt-4 pb-2">
                            <div v-if="unoStore.leaderboard[1]" class="flex flex-col items-center">
                                <div class="relative mb-2">
                                    <div v-if="isImageAvatar(unoStore.leaderboard[1].avatar)" class="w-14 h-14 rounded-full border-4 border-gray-300 shadow-lg overflow-hidden bg-gray-100">
                                        <img :src="unoStore.leaderboard[1].avatar" class="w-full h-full object-cover" />
                                    </div>
                                    <div v-else class="w-14 h-14 rounded-full border-4 border-gray-300 shadow-lg bg-gray-100 flex items-center justify-center text-3xl">{{ unoStore.leaderboard[1].avatar }}</div>
                                    <div class="absolute -bottom-1 -right-1 w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center text-xs font-black text-gray-700 shadow-sm">2</div>
                                </div>
                                <span class="text-xs font-bold truncate w-20 text-center">{{ unoStore.leaderboard[1].name }}</span>
                                <span class="text-[10px] font-black text-white/90">{{ unoStore.leaderboard[1].score }}分</span>
                            </div>
                            <div v-if="unoStore.leaderboard[0]" class="flex flex-col items-center transform scale-125 -translate-y-4">
                                <div class="relative mb-2">
                                    <div class="absolute -top-6 left-1/2 -translate-x-1/2 text-3xl animate-bounce">👑</div>
                                    <div v-if="isImageAvatar(unoStore.leaderboard[0].avatar)" class="w-16 h-16 rounded-full border-4 border-yellow-200 shadow-2xl overflow-hidden bg-gray-100">
                                        <img :src="unoStore.leaderboard[0].avatar" class="w-full h-full object-cover" />
                                    </div>
                                    <div v-else class="w-16 h-16 rounded-full border-4 border-yellow-200 shadow-2xl bg-gray-100 flex items-center justify-center text-4xl">{{ unoStore.leaderboard[0].avatar }}</div>
                                    <div class="absolute -bottom-1 -right-1 w-7 h-7 bg-yellow-400 rounded-full flex items-center justify-center text-sm font-black text-white shadow-md border-2 border-white">1</div>
                                </div>
                                <span class="text-xs font-bold truncate w-24 text-center">{{ unoStore.leaderboard[0].name }}</span>
                                <span class="text-[10px] font-black text-white">{{ unoStore.leaderboard[0].score }}分</span>
                            </div>
                            <div v-if="unoStore.leaderboard[2]" class="flex flex-col items-center">
                                <div class="relative mb-2">
                                    <div v-if="isImageAvatar(unoStore.leaderboard[2].avatar)" class="w-12 h-12 rounded-full border-4 border-amber-600 shadow-lg overflow-hidden bg-gray-100">
                                        <img :src="unoStore.leaderboard[2].avatar" class="w-full h-full object-cover" />
                                    </div>
                                    <div v-else class="w-12 h-12 rounded-full border-4 border-amber-600 shadow-lg bg-gray-100 flex items-center justify-center text-2xl">{{ unoStore.leaderboard[2].avatar }}</div>
                                    <div class="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-600 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-sm">3</div>
                                </div>
                                <span class="text-xs font-bold truncate w-16 text-center">{{ unoStore.leaderboard[2].name }}</span>
                                <span class="text-[10px] font-black text-white/80">{{ unoStore.leaderboard[2].score }}分</span>
                            </div>
                        </div>
                    </div>

                    <div class="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                        <div v-for="(item, idx) in unoStore.leaderboard" :key="item.name"
                            class="flex items-center gap-4 p-3 rounded-2xl border transition-all"
                            :class="item.isUser ? 'bg-orange-50 border-orange-200' : 'bg-white border-transparent shadow-sm'">
                            <div class="w-6 text-center font-black" :class="idx < 3 ? 'text-orange-500' : 'text-gray-400'">{{ idx + 1 }}</div>
                            <div v-if="isImageAvatar(item.avatar)" class="w-10 h-10 rounded-xl overflow-hidden border border-gray-100 shadow-inner">
                                <img :src="item.avatar" class="w-full h-full object-cover" />
                            </div>
                            <div v-else class="w-10 h-10 rounded-xl border border-gray-100 shadow-inner flex items-center justify-center text-xl bg-white">{{ item.avatar }}</div>
                            <div class="flex-1">
                                <div class="font-bold text-gray-800 flex items-center gap-1.5">
                                    {{ item.name }}
                                    <span v-if="item.isUser" class="text-[8px] bg-orange-500 text-white px-1 rounded">ME</span>
                                </div>
                                <div class="text-[10px] text-gray-400 font-bold uppercase tracking-tight">{{ item.rank || '青铜' }}段位</div>
                            </div>
                            <div class="text-right">
                                <div class="text-lg font-black text-gray-800 leading-none">{{ item.score }}</div>
                                <div class="text-[9px] text-gray-400 font-bold">POINTS</div>
                            </div>
                        </div>
                    </div>

                    <div class="p-4 bg-white border-t border-gray-100 flex gap-2">
                        <button @click="showRanking = false" class="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl active:scale-95 transition-all">收起列表</button>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- 设置弹窗 -->
        <Transition name="fade">
            <div v-if="showSettings" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]" @click="showSettings = false">
                <div class="bg-white rounded-[32px] w-full max-w-[450px] m-4 flex flex-col max-h-[85vh] shadow-2xl overflow-hidden" @click.stop>
                    <div class="p-6 border-b border-gray-100 bg-emerald-50 relative">
                        <h2 class="text-xl font-black text-emerald-800 flex items-center gap-2"><i class="fa-solid fa-sliders"></i> 设置</h2>
                        <button @click="showSettings = false" class="absolute top-6 right-6 w-8 h-8 flex items-center justify-center text-emerald-800/50 hover:text-emerald-800"><i class="fa-solid fa-xmark text-xl"></i></button>
                    </div>
                    <div class="flex-1 overflow-y-auto p-6 space-y-6">
                        <div class="flex items-center justify-between">
                            <span class="font-bold text-gray-700">音效</span>
                            <button @click="unoStore.toggleSound()" class="w-14 h-8 rounded-full relative transition-colors" :class="unoStore.soundEnabled ? 'bg-green-500' : 'bg-gray-300'">
                                <div class="w-6 h-6 rounded-full bg-white absolute top-1 transition-all" :class="unoStore.soundEnabled ? 'left-7' : 'left-1'"></div>
                            </button>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="font-bold text-gray-700">背景音乐</span>
                            <button @click="unoStore.toggleBGM()" class="w-14 h-8 rounded-full relative transition-colors" :class="unoStore.bgmEnabled ? 'bg-green-500' : 'bg-gray-300'">
                                <div class="w-6 h-6 rounded-full bg-white absolute top-1 transition-all" :class="unoStore.bgmEnabled ? 'left-7' : 'left-1'"></div>
                            </button>
                        </div>
                        <div class="flex items-center justify-between">
                            <div>
                                <div class="font-bold text-gray-700">语音 UNO</div>
                                <div class="text-xs text-gray-400">喊 UNO 时使用人声喊出</div>
                            </div>
                            <button @click="unoStore.toggleVoice()" class="w-14 h-8 rounded-full relative transition-colors" :class="unoStore.voiceEnabled ? 'bg-green-500' : 'bg-gray-300'">
                                <div class="w-6 h-6 rounded-full bg-white absolute top-1 transition-all" :class="unoStore.voiceEnabled ? 'left-7' : 'left-1'"></div>
                            </button>
                        </div>
                    </div>
                    <div class="p-6 bg-gray-50 flex gap-2">
                        <button @click="showSettings = false" class="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl active:scale-95 transition-all">保存返回</button>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- 快速开始配置弹窗 -->
        <Transition name="fade">
            <div v-if="showQuickStart" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]" @click="showQuickStart = false">
                <div class="bg-white rounded-[24px] w-full max-w-[360px] m-4 p-6 shadow-2xl" @click.stop>
                    <div class="flex justify-between items-center mb-5">
                        <h2 class="text-xl font-black text-gray-800 flex items-center gap-2"><i class="fa-solid fa-bolt text-emerald-500"></i> 快速开始</h2>
                        <button @click="showQuickStart = false" class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600"><i class="fa-solid fa-xmark text-xl"></i></button>
                    </div>

                    <div class="space-y-5 mb-6">
                        <div>
                            <label class="block text-sm font-bold text-gray-700 mb-3">玩法模式</label>
                            <div class="grid grid-cols-2 gap-2">
                                <button v-for="(label, key) in ruleLabels" :key="key" @click="quickConfig.ruleMode = key"
                                    class="py-3 rounded-xl border-2 transition-all text-sm font-bold"
                                    :class="quickConfig.ruleMode === key ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-gray-200 bg-gray-50 text-gray-700'">
                                    {{ label }}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-bold text-gray-700 mb-3">玩家人数（含自己）</label>
                            <div class="grid grid-cols-4 gap-2">
                                <button v-for="n in [2,3,4,5,6,7,8]" :key="n" @click="quickConfig.maxPlayers = n"
                                    class="py-3 rounded-xl border-2 transition-all font-bold"
                                    :class="quickConfig.maxPlayers === n ? 'border-purple-500 bg-purple-50 text-purple-600' : 'border-gray-200 bg-gray-50 text-gray-700'">
                                    {{ n }}
                                </button>
                            </div>
                        </div>
                    </div>

                    <button @click="beginQuickGame"
                        class="w-full py-4 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2">
                        <i class="fa-solid fa-play"></i>
                        <span>立即开局</span>
                    </button>
                </div>
            </div>
        </Transition>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUnoStore } from '../../stores/unoStore.js'
import { useWalletStore } from '../../stores/walletStore.js'
import { useSettingsStore } from '../../stores/settingsStore.js'

const router = useRouter()
const unoStore = useUnoStore()
const walletStore = useWalletStore()
const settingsStore = useSettingsStore()

const userName = computed(() => settingsStore.personalization?.userProfile?.name || '我')
const userAvatar = computed(() => settingsStore.personalization?.userProfile?.avatar || '👤')
const formattedBeans = computed(() => unoStore.beans.toLocaleString())
const hasActiveGame = computed(() => unoStore.currentRoom && unoStore.currentRoom.status === 'playing')

const showRecharge = ref(false)
const showCreateRoom = ref(false)
const showRanking = ref(false)
const showSettings = ref(false)
const showQuickStart = ref(false)
const toastMsg = ref('')

const quickConfig = ref({
    ruleMode: 'classic',
    maxPlayers: 4
})

const ruleLabels = {
    classic: '经典',
    stacking: '叠加',
    jumpin: '抢出',
    seveno: '七零',
    extreme: '极限'
}

const roomConfig = ref({
    ruleMode: 'classic',
    baseStake: 100,
    totalRounds: 8,
    maxPlayers: 4
})

const rechargePackages = [
    { amount: 6000, price: 6, bonus: 0 },
    { amount: 30000, price: 30, bonus: 3000 },
    { amount: 68000, price: 68, bonus: 10000 },
    { amount: 128000, price: 128, bonus: 20000 }
]

onMounted(() => {
    if (unoStore.currentRoom && unoStore.currentRoom.status === 'playing') {
        router.replace('/games/uno')
    }
})

function isImageAvatar(avatar) {
    if (!avatar) return false
    return avatar.startsWith('/') || avatar.startsWith('data:image') || avatar.startsWith('http')
}

function showToast(msg) {
    toastMsg.value = msg
    setTimeout(() => { toastMsg.value = '' }, 2000)
}

function quickStart() {
    if (unoStore.beans < 100) {
        showToast('欢乐豆不足，请先充值！')
        showRecharge.value = true
        return
    }
    showQuickStart.value = true
}

async function beginQuickGame() {
    showQuickStart.value = false
    if (unoStore.beans < 100) {
        showToast('欢乐豆不足，请先充值！')
        showRecharge.value = true
        return
    }
    const cfg = quickConfig.value
    const aiCount = Math.min(cfg.maxPlayers - 1, 7)
    await unoStore.createRoom({
        mode: 'quick',
        ruleMode: cfg.ruleMode,
        baseStake: 100,
        totalRounds: 8,
        maxPlayers: cfg.maxPlayers,
        aiCount
    })
    unoStore.startGame()
    router.push('/games/uno')
}

function returnToGame() {
    router.push('/games/uno')
}

function createRoom() {
    if (unoStore.beans < roomConfig.value.baseStake) {
        showToast('欢乐豆不足，请先充值！')
        showCreateRoom.value = false
        showRecharge.value = true
        return
    }
    unoStore.createRoom({
        mode: 'custom',
        ruleMode: roomConfig.value.ruleMode,
        baseStake: roomConfig.value.baseStake,
        totalRounds: roomConfig.value.totalRounds,
        maxPlayers: roomConfig.value.maxPlayers,
        aiCount: 0
    })
    showCreateRoom.value = false
    router.push('/games/uno-room')
}

function recharge(pkg) {
    const success = walletStore.decreaseBalance(pkg.price, `UNO欢乐豆充值(${pkg.amount}豆)`)
    if (!success) {
        showToast('支付失败，请检查余额')
        return
    }
    const result = unoStore.rechargeBeans(pkg.amount + (pkg.bonus || 0))
    if (result.success) {
        showToast('充值成功！')
        setTimeout(() => { showRecharge.value = false }, 1000)
    } else {
        showToast(result.message)
    }
}
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
