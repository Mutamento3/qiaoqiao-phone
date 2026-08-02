<template>
    <div class="mono-lobby w-full h-full flex flex-col bg-gradient-to-br from-amber-50 to-orange-50">
        <!-- 顶部导航 -->
        <div
            class="h-[56px] bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-between px-4 shadow-lg">
            <button @click="router.push('/games')" class="w-12 h-12 flex items-center justify-center text-white">
                <i class="fa-solid fa-chevron-left text-xl"></i>
            </button>
            <h1 class="text-xl font-bold text-white flex items-center gap-2">
                <span>🎩</span>
                <span>大富翁</span>
            </h1>
            <div class="w-12"></div>
        </div>

        <!-- 个人信息卡片 -->
        <div class="m-4 p-5 bg-white rounded-2xl shadow-md border border-amber-100">
            <div class="flex items-center gap-5">
                <div class="w-20 h-20 rounded-2xl overflow-hidden shadow-inner border-2 border-amber-50 flex items-center justify-center text-4xl bg-amber-50">
                    <img v-if="isImageAvatar(userAvatar)" :src="userAvatar" class="w-full h-full object-cover" />
                    <span v-else>{{ userAvatar }}</span>
                </div>
                <div class="flex-1">
                    <div class="flex items-center gap-2">
                        <span class="text-base font-black text-gray-800">{{ userName }}</span>
                        <span class="px-2 py-0.5 bg-amber-100 text-amber-600 text-xs rounded-full font-bold">房东</span>
                    </div>
                    <div class="text-xs text-gray-400 mt-2 flex flex-wrap gap-4">
                        <span>启动资金:¥1500</span>
                        <span>玩家:2-8人</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- 快速开始 / 回到游戏 -->
        <div class="px-4 mb-6">
            <button v-if="hasActiveGame" @click="returnToGame"
                class="w-full py-5 mb-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold text-lg rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 animate-pulse">
                <i class="fa-solid fa-rotate-left text-xl"></i>
                <span>回到牌桌</span>
            </button>
            <button @click="quickStart"
                class="w-full py-5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-lg rounded-2xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-3">
                <i class="fa-solid fa-bolt text-xl"></i>
                <span>快速开始</span>
            </button>
        </div>

        <!-- 功能按钮 -->
        <div class="px-4 grid grid-cols-2 gap-4 mb-6">
            <button @click="showCreateRoom = true"
                class="py-4 bg-white rounded-xl shadow-md active:scale-95 transition-transform flex flex-col items-center gap-3">
                <i class="fa-solid fa-plus-circle text-3xl text-orange-500"></i>
                <span class="text-sm font-bold text-gray-700">创建房间</span>
            </button>
            <button @click="showRules = true"
                class="py-4 bg-white rounded-xl shadow-md active:scale-95 transition-transform flex flex-col items-center gap-3">
                <i class="fa-solid fa-book text-3xl text-amber-500"></i>
                <span class="text-sm font-bold text-gray-700">游戏规则</span>
            </button>
        </div>

        <!-- 规则说明 -->
        <div class="px-4 mb-6">
            <div class="bg-white rounded-xl shadow-md p-5">
                <h3 class="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <i class="fa-solid fa-lightbulb text-amber-500"></i>
                    <span>玩法速览</span>
                </h3>
                <ul class="text-sm text-gray-600 space-y-2">
                    <li>• 掷两颗骰子绕棋盘移动，路过起点领 ¥200 工资</li>
                    <li>• 空地可买下，集齐同色组可盖房收更高租金</li>
                    <li>• 落到别人地产要付租金，车站/公共按持有数计费</li>
                    <li>• 抽到机会/命运卡触发随机事件，进监狱需保释</li>
                    <li>• 资金耗尽即破产，坚持到最后一人即为冠军</li>
                </ul>
            </div>
        </div>

        <!-- 创建房间弹窗 -->
        <Transition name="fade">
            <div v-if="showCreateRoom" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                @click="showCreateRoom = false; isQuickCreate = false">
                <div class="bg-white rounded-2xl p-6 m-4 max-w-sm w-full" @click.stop>
                    <h2 class="text-xl font-bold mb-4 text-center">{{ isQuickCreate ? '快速开始' : '创建房间' }}</h2>
                    <div class="space-y-6 mb-6">
                        <div>
                            <label class="block text-sm font-bold text-gray-700 mb-3">玩家人数</label>
                            <div class="grid grid-cols-4 gap-2">
                                <button v-for="n in [2,4,6,8]" :key="n" @click="roomConfig.playerCount = n"
                                    class="py-3 rounded-lg border-2 transition-all"
                                    :class="roomConfig.playerCount === n ? 'border-orange-500 bg-orange-50 text-orange-600 font-bold' : 'border-gray-200 bg-gray-50 text-gray-700'">
                                    {{ n }}人
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="flex gap-3">
                        <button @click="showCreateRoom = false; isQuickCreate = false"
                            class="flex-1 py-3 bg-gray-200 text-gray-700 font-bold rounded-lg">取消</button>
                        <button @click="createRoom"
                            class="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-lg">{{ isQuickCreate ? '开始游戏' : '创建' }}</button>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- 规则弹窗 -->
        <Transition name="fade">
            <div v-if="showRules" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]"
                @click="showRules = false">
                <div class="bg-white rounded-[28px] w-full max-w-[450px] m-4 max-h-[85vh] overflow-y-auto p-6" @click.stop>
                    <h2 class="text-2xl font-black text-amber-700 mb-4 flex items-center gap-2">🎩 大富翁规则</h2>
                    <div class="space-y-3 text-sm text-gray-700 leading-relaxed">
                        <p><b>目标：</b>通过买地、收租让对手破产，成为坚持到最后的唯一赢家。</p>
                        <p><b>移动：</b>每回合掷两颗骰子，按点数顺时针绕 40 格棋盘移动，路过起点领 ¥200。</p>
                        <p><b>买地：</b>停在无人地产可买下；集齐同色一组（垄断）后可盖房，租金大幅上涨。</p>
                        <p><b>付租：</b>停在他人地产须付租金；车站按对方持有车站数（25/50/100/200），公共按骰子点数×4 或 ×10。</p>
                        <p><b>卡牌：</b>机会/命运卡含领钱、罚款、前进/后退、进监狱、免费出狱卡等。</p>
                        <p><b>监狱：</b>进监狱后需保释（¥50）、用出狱卡或掷双骰离开；连掷三次双骰也会被请进监狱。</p>
                        <p><b>破产：</b>资金不足支付时破产出局，名下地产转给债主。只剩 1 人时自动结算。</p>
                    </div>
                    <button @click="showRules = false" class="w-full mt-5 py-3 bg-amber-500 text-white font-bold rounded-xl">知道了</button>
                </div>
            </div>
        </Transition>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMonopolyStore } from '../../stores/monopolyStore.js'
import { useSettingsStore } from '../../stores/settingsStore.js'

const router = useRouter()
const monopolyStore = useMonopolyStore()
const settingsStore = useSettingsStore()

const userName = computed(() => settingsStore.personalization.userProfile.name || '我')
const userAvatar = computed(() => settingsStore.personalization.userProfile.avatar || '🎭')
const isImageAvatar = (avatar) => !!avatar && (avatar.startsWith('/') || avatar.startsWith('data:image') || avatar.startsWith('http'))
const hasActiveGame = computed(() => monopolyStore.hasActiveGame)

const showCreateRoom = ref(false)
const isQuickCreate = ref(false)
const showRules = ref(false)
const roomConfig = ref({ playerCount: 4 })

onMounted(() => {
    monopolyStore.loadState()
    if (monopolyStore.hasActiveGame) router.replace('/games/monopoly')
})

const quickStart = () => {
    isQuickCreate.value = true
    showCreateRoom.value = true
}

const createRoom = () => {
    monopolyStore.createRoom({
        mode: isQuickCreate.value ? 'quick' : 'custom',
        playerCount: roomConfig.value.playerCount,
        userName: userName.value,
        userAvatar: userAvatar.value,
    })
    showCreateRoom.value = false
    if (isQuickCreate.value) {
        monopolyStore.startGame()
        isQuickCreate.value = false
        router.push('/games/monopoly')
    } else {
        router.push('/games/monopoly-room')
    }
}

const returnToGame = () => {
    router.push('/games/monopoly')
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
