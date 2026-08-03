<template>
    <div class="mono-lobby w-full h-full flex flex-col bg-gradient-to-br from-sky-50 via-blue-50 to-yellow-50">
        <!-- 顶部导航 -->
        <div class="h-[56px] bg-gradient-to-r from-sky-500 to-blue-500 flex items-center justify-between px-4 shadow-lg">
            <button @click="router.push('/games')" class="w-12 h-12 flex items-center justify-center text-white">
                <i class="fa-solid fa-chevron-left text-xl"></i>
            </button>
            <h1 class="text-xl font-bold text-white flex items-center gap-2">
                <span>🐾</span>
                <span>帕瓦小镇</span>
            </h1>
            <div class="w-12"></div>
        </div>

        <!-- 个人信息卡片 -->
        <div class="m-4 p-5 bg-white rounded-2xl shadow-md border border-sky-100">
            <div class="flex items-center gap-5">
                <div class="w-20 h-20 rounded-2xl overflow-hidden shadow-inner border-2 border-sky-50 flex items-center justify-center text-4xl bg-sky-50">
                    <img v-if="isImageAvatar(userAvatar)" :src="userAvatar" class="w-full h-full object-cover" />
                    <span v-else>{{ userAvatar }}</span>
                </div>
                <div class="flex-1">
                    <div class="flex items-center gap-2">
                        <span class="text-base font-black text-gray-800">{{ userName }}</span>
                        <span class="px-2 py-0.5 bg-sky-100 text-sky-600 text-xs rounded-full font-bold">小镇居民</span>
                    </div>
                    <div class="text-xs text-gray-400 mt-2 flex flex-wrap gap-4">
                        <span>启动资金:¥1500</span>
                        <span>玩家:2-8人</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- 角色选择 -->
        <div class="px-4 mb-4">
            <div class="flex items-center justify-between mb-3">
                <label class="text-sm font-bold text-gray-700">选择你的角色</label>
                <span class="text-xs text-gray-400 flex items-center gap-1">
                    <img v-if="selectedChar?.avatar" :src="selectedChar.avatar" class="w-5 h-5 rounded-full object-cover" />
                    {{ selectedChar?.name }}
                </span>
            </div>
            <div class="grid grid-cols-4 gap-2">
                <button v-for="char in CHARACTERS" :key="char.id" @click="userCharacterId = char.id"
                    class="char-card flex flex-col items-center py-2 rounded-xl border-2 transition-all"
                    :class="userCharacterId === char.id ? 'border-sky-400 bg-sky-50 scale-105' : 'border-gray-200 bg-gray-50'">
                    <img v-if="char.avatar" :src="char.avatar" class="char-avatar-img" :alt="char.name" />
                    <span v-else class="text-2xl mb-1">{{ char.emoji }}</span>
                    <span class="text-[11px] font-bold text-gray-700">{{ char.name }}</span>
                    <span class="text-[9px] text-gray-400">{{ char.species }}</span>
                </button>
            </div>
            <!-- 选中角色技能 -->
            <div v-if="selectedChar" class="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                <div class="flex items-center gap-2 mb-1">
                    <img v-if="selectedChar.avatar" :src="selectedChar.avatar" class="w-7 h-7 rounded-full object-cover" />
                    <span v-else class="text-lg">{{ selectedChar.emoji }}</span>
                    <span class="text-sm font-bold text-gray-700">{{ selectedChar.skill.name }}</span>
                </div>
                <p class="text-xs text-gray-500">{{ selectedChar.skill.desc }}</p>
                <p class="text-[10px] text-gray-400 mt-1">性格：{{ selectedChar.personality }}</p>
            </div>
        </div>

        <!-- 快速开始 / 回到游戏 -->
        <div class="px-4 mb-4">
            <button v-if="hasActiveGame" @click="returnToGame"
                class="w-full py-4 mb-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold text-lg rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 animate-pulse">
                <i class="fa-solid fa-rotate-left text-xl"></i>
                <span>回到对局</span>
            </button>
            <div class="mb-3">
                <label class="block text-sm font-bold text-gray-700 mb-2">玩家人数</label>
                <div class="grid grid-cols-4 gap-2">
                    <button v-for="n in [2,4,6,8]" :key="n" @click="quickCount = n"
                        class="py-3 rounded-xl border-2 transition-all font-bold"
                        :class="quickCount === n ? 'border-sky-400 bg-sky-50 text-sky-600' : 'border-gray-200 bg-gray-50 text-gray-700'">
                        {{ n }}人
                    </button>
                </div>
            </div>
            <button @click="quickStart"
                class="w-full py-4 bg-gradient-to-r from-sky-500 to-blue-500 text-white font-bold text-lg rounded-2xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-3">
                <i class="fa-solid fa-bolt text-xl"></i>
                <span>快速开始（{{ quickCount }}人）</span>
            </button>
        </div>

        <!-- 功能按钮 -->
        <div class="px-4 grid grid-cols-2 gap-4 mb-4">
            <button @click="showCreateRoom = true"
                class="py-4 bg-white rounded-xl shadow-md active:scale-95 transition-transform flex flex-col items-center gap-3">
                <i class="fa-solid fa-plus-circle text-3xl text-sky-500"></i>
                <span class="text-sm font-bold text-gray-700">创建房间</span>
            </button>
            <button @click="showRules = true"
                class="py-4 bg-white rounded-xl shadow-md active:scale-95 transition-transform flex flex-col items-center gap-3">
                <i class="fa-solid fa-book text-3xl text-yellow-500"></i>
                <span class="text-sm font-bold text-gray-700">游戏规则</span>
            </button>
        </div>

        <!-- 玩法速览 -->
        <div class="px-4 mb-6">
            <div class="bg-white rounded-xl shadow-md p-5">
                <h3 class="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <i class="fa-solid fa-lightbulb text-yellow-500"></i>
                    <span>玩法速览</span>
                </h3>
                <ul class="text-sm text-gray-600 space-y-2">
                    <li>🐾 选择猫狗角色，每个角色有专属技能</li>
                    <li>🎲 掷骰子绕棋盘移动，路过镇中心领 ¥200</li>
                    <li>🏠 买地盖房，集齐同色组可升级房屋</li>
                    <li>🎴 使用道具卡攻击对手或防御自己</li>
                    <li>🐱 AI 角色有性格，会像真人一样聊天</li>
                    <li>💥 资金耗尽即破产，坚持到最后为冠军</li>
                </ul>
            </div>
        </div>

        <!-- 创建房间弹窗 -->
        <Transition name="fade">
            <div v-if="showCreateRoom" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click="showCreateRoom = false">
                <div class="bg-white rounded-2xl p-6 m-4 max-w-sm w-full" @click.stop>
                    <h2 class="text-xl font-bold mb-4 text-center">创建房间</h2>
                    <div class="space-y-6 mb-6">
                        <div>
                            <label class="block text-sm font-bold text-gray-700 mb-3">玩家人数</label>
                            <div class="grid grid-cols-4 gap-2">
                                <button v-for="n in [2,4,6,8]" :key="n" @click="roomConfig.playerCount = n"
                                    class="py-3 rounded-lg border-2 transition-all"
                                    :class="roomConfig.playerCount === n ? 'border-sky-400 bg-sky-50 text-sky-600 font-bold' : 'border-gray-200 bg-gray-50 text-gray-700'">
                                    {{ n }}人
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="flex gap-3">
                        <button @click="showCreateRoom = false" class="flex-1 py-3 bg-gray-200 text-gray-700 font-bold rounded-lg">取消</button>
                        <button @click="createRoom" class="flex-1 py-3 bg-gradient-to-r from-sky-500 to-blue-500 text-white font-bold rounded-lg">创建</button>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- 规则弹窗 -->
        <Transition name="fade">
            <div v-if="showRules" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]" @click="showRules = false">
                <div class="bg-white rounded-[28px] w-full max-w-[450px] m-4 max-h-[85vh] overflow-y-auto p-6" @click.stop>
                    <h2 class="text-2xl font-black text-sky-700 mb-4 flex items-center gap-2">🐾 帕瓦小镇规则</h2>
                    <div class="space-y-3 text-sm text-gray-700 leading-relaxed">
                        <p><b>目标：</b>通过买地、收租、使用道具卡，让对手破产，成为最后的赢家。</p>
                        <p><b>角色：</b>选择一只猫猫或狗狗角色，每个角色有专属技能，整局生效。</p>
                        <p><b>移动：</b>每回合掷两颗骰子，按点数绕 40 格棋盘移动，路过镇中心领 ¥200。</p>
                        <p><b>买地盖房：</b>停在无人地产可买下；集齐同色一组后可盖房升级（帐篷→木屋→花园→城堡→宫殿），租金大幅上涨。</p>
                        <p><b>付租：</b>停在他人地产须付租金；车站按持有数递增，公共按骰子点数计算。</p>
                        <p><b>道具卡：</b>手牌上限 5 张，可用移动/攻击/防御/资源/特殊五类卡牌。通过机会/命运卡或回合随机获得。</p>
                        <p><b>角色技能：</b>每个角色有独特技能，如布丁的「贪吃福利」、可可的「精明商人」等。</p>
                        <p><b>寄养所：</b>进寄养所需保释（¥50）、用出狱卡或掷双骰离开；连掷三次双骰也会被抓进去。</p>
                        <p><b>破产：</b>资金不足支付时破产出局，名下地产转给债主。只剩 1 人时自动结算。</p>
                    </div>
                    <button @click="showRules = false" class="w-full mt-5 py-3 bg-sky-500 text-white font-bold rounded-xl">知道了</button>
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
import { CHARACTERS } from '../../utils/monopoly/characters.js'

const router = useRouter()
const monopolyStore = useMonopolyStore()
const settingsStore = useSettingsStore()

const userName = computed(() => settingsStore.personalization.userProfile.name || '我')
const userAvatar = computed(() => settingsStore.personalization.userProfile.avatar || '🎭')
const isImageAvatar = (avatar) => !!avatar && (avatar.startsWith('/') || avatar.startsWith('data:image') || avatar.startsWith('http'))
const hasActiveGame = computed(() => monopolyStore.hasActiveGame)

const showCreateRoom = ref(false)
const showRules = ref(false)
const quickCount = ref(4)
const roomConfig = ref({ playerCount: 4 })
const userCharacterId = ref('pudding')

const selectedChar = computed(() => CHARACTERS.find(c => c.id === userCharacterId.value) || CHARACTERS[0])

onMounted(() => {
    monopolyStore.loadState()
    if (monopolyStore.hasActiveGame) router.replace('/games/monopoly')
})

const quickStart = () => {
    monopolyStore.createRoom({
        mode: 'quick',
        playerCount: quickCount.value,
        userName: userName.value,
        userAvatar: userAvatar.value,
        userCharacterId: userCharacterId.value,
    })
    const ok = monopolyStore.startGame()
    if (!ok) return
    router.push('/games/monopoly')
}

const createRoom = () => {
    monopolyStore.createRoom({
        mode: 'custom',
        playerCount: roomConfig.value.playerCount,
        userName: userName.value,
        userAvatar: userAvatar.value,
        userCharacterId: userCharacterId.value,
    })
    showCreateRoom.value = false
    router.push('/games/monopoly-room')
}

const returnToGame = () => {
    router.push('/games/monopoly')
}
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* 大厅根容器：允许纵向滚动 */
.mono-lobby {
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
}

.char-card { box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04); }
.char-card:active { transform: scale(0.95); }
.char-avatar-img {
    width: 44px; height: 44px;
    object-fit: cover; object-position: top center;
    border-radius: 12px;
    border: 2px solid #fff;
    box-shadow: 0 2px 6px rgba(0,0,0,0.1);
}
</style>
