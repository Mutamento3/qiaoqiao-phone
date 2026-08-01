<template>
    <div class="games-center w-full h-full flex flex-col bg-gradient-to-br from-purple-50 to-pink-50">
        <!-- 顶部导航 -->
        <div
            class="h-[50px] bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-between px-4 shadow-lg">
            <button @click="router.push('/')" class="w-10 h-10 flex items-center justify-center text-white">
                <i class="fa-solid fa-chevron-left text-xl"></i>
            </button>
            <h1 class="text-xl font-bold text-white flex items-center gap-2">
                <span>🎮</span>
                <span>游戏中心</span>
            </h1>
            <button @click="showSettings = true" class="w-10 h-10 flex items-center justify-center text-white">
                <i class="fa-solid fa-gear text-xl"></i>
            </button>
        </div>

        <!-- 轮播图 -->
        <div
            class="m-4 h-[150px] bg-gradient-to-r from-purple-400 to-pink-400 rounded-2xl shadow-lg overflow-hidden relative">
            <div class="absolute inset-0 flex items-center justify-center">
                <div class="text-center text-white">
                    <div class="text-5xl mb-2">🎲</div>
                    <div class="text-2xl font-bold">欢迎来到游戏中心</div>
                    <div class="text-sm opacity-90 mt-1">精彩游戏，等你来玩</div>
                </div>
            </div>
        </div>

        <!-- 游戏分类 -->
        <div class="px-4 mb-3">
            <div class="flex gap-2 overflow-x-auto pb-2">
                <button v-for="category in categories" :key="category.id" @click="selectedCategory = category.id"
                    class="px-4 py-2 rounded-full whitespace-nowrap transition-all" :class="selectedCategory === category.id
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
                        : 'bg-white text-gray-700 shadow'">
                    {{ category.name }}
                </button>
            </div>
        </div>

        <!-- 游戏列表 -->
        <div class="flex-1 overflow-y-auto px-4 pb-4">
            <div class="grid grid-cols-2 gap-3">
                <!-- 麻将游戏 -->
                <div @click="openGame('mahjong')"
                    class="game-card bg-white rounded-2xl shadow-lg overflow-hidden active:scale-95 transition-transform">
                    <div
                        class="h-[120px] bg-gradient-to-br from-red-400 to-orange-400 flex items-center justify-center relative overflow-hidden">
                        <!-- 装饰性背景 -->
                        <div class="absolute inset-0 opacity-20">
                            <div class="absolute top-2 left-2 text-6xl">🀄</div>
                            <div class="absolute bottom-2 right-2 text-4xl">🎴</div>
                        </div>
                        <div class="text-6xl relative z-10">🀄</div>
                    </div>
                    <div class="p-3">
                        <h3 class="font-bold text-lg mb-1">麻将</h3>
                        <p class="text-xs text-gray-500 mb-2">大众麻将，支持吃碰杠</p>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-orange-600 font-bold">🔥 热门</span>
                            <span class="text-xs text-gray-400">4人对战</span>
                        </div>
                    </div>
                </div>

                <!-- 娃娃机 -->
                <div @click="openGame('claw-machine')"
                    class="game-card bg-white rounded-2xl shadow-lg overflow-hidden active:scale-95 transition-transform">
                    <div
                        class="h-[120px] bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center relative overflow-hidden">
                        <div class="absolute inset-0 opacity-20">
                            <div class="absolute top-2 left-2 text-5xl">🧸</div>
                            <div class="absolute bottom-2 right-2 text-3xl">🎁</div>
                        </div>
                        <div class="text-6xl relative z-10">🧸</div>
                    </div>
                    <div class="p-3">
                        <h3 class="font-bold text-lg mb-1">娃娃机</h3>
                        <p class="text-xs text-gray-500 mb-2">邀请好友一起抓娃娃</p>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-pink-600 font-bold">✨ 新</span>
                            <span class="text-xs text-gray-400">双人游玩</span>
                        </div>
                    </div>
                </div>

                <!-- UNO -->
                <div @click="openGame('uno')"
                    class="game-card bg-white rounded-2xl shadow-lg overflow-hidden active:scale-95 transition-transform">
                    <div
                        class="h-[120px] bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center relative overflow-hidden">
                        <!-- 四色 UNO 牌扇形堆叠 -->
                        <div class="relative w-[120px] h-[78px]">
                            <div v-for="(c, i) in unoThumbColors" :key="c"
                                class="absolute w-[54px] h-[78px] rounded-lg border-2 border-white shadow-2xl flex items-center justify-center"
                                :style="{ background: unoThumbHex[c], left: (i * 17) + 'px', top: (i % 2 === 0 ? 0 : 5) + 'px', transform: 'rotate(' + ((i - 1.5) * 9) + 'deg)' }">
                                <div class="rounded-full bg-white w-[34px] h-[34px] flex items-center justify-center shadow-inner">
                                    <span class="font-black italic text-[13px] leading-none text-red-600">UNO</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="p-3">
                        <h3 class="font-bold text-lg mb-1">UNO</h3>
                        <p class="text-xs text-gray-500 mb-2">配色出牌，先出完者胜</p>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-emerald-600 font-bold">🔥 热门</span>
                            <span class="text-xs text-gray-400">2-8 人对战</span>
                        </div>
                    </div>
                </div>

                <!-- 斗地主（即将推出） -->
                <div class="game-card bg-white rounded-2xl shadow-lg overflow-hidden opacity-60">
                    <div
                        class="h-[120px] bg-gradient-to-br from-yellow-400 to-orange-400 flex items-center justify-center relative overflow-hidden">
                        <div class="absolute inset-0 opacity-20">
                            <div class="absolute top-2 left-2 text-5xl">🃏</div>
                            <div class="absolute bottom-2 right-2 text-3xl">👑</div>
                        </div>
                        <div class="text-6xl relative z-10">🃏</div>
                    </div>
                    <div class="p-3">
                        <h3 class="font-bold text-lg mb-1">斗地主</h3>
                        <p class="text-xs text-gray-500 mb-2">经典扑克游戏</p>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-gray-400">即将推出</span>
                            <span class="text-xs text-gray-400">3人对战</span>
                        </div>
                    </div>
                </div>

                <!-- 象棋（即将推出） -->
                <div class="game-card bg-white rounded-2xl shadow-lg overflow-hidden opacity-60">
                    <div
                        class="h-[120px] bg-gradient-to-br from-green-400 to-teal-400 flex items-center justify-center relative overflow-hidden">
                        <div class="absolute inset-0 opacity-20">
                            <div class="absolute top-2 left-2 text-5xl">♟️</div>
                            <div class="absolute bottom-2 right-2 text-3xl">🏰</div>
                        </div>
                        <div class="text-6xl relative z-10">♟️</div>
                    </div>
                    <div class="p-3">
                        <h3 class="font-bold text-lg mb-1">象棋</h3>
                        <p class="text-xs text-gray-500 mb-2">中国象棋对弈</p>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-gray-400">即将推出</span>
                            <span class="text-xs text-gray-400">2人对战</span>
                        </div>
                    </div>
                </div>

                <!-- 五子棋（即将推出） -->
                <div class="game-card bg-white rounded-2xl shadow-lg overflow-hidden opacity-60">
                    <div
                        class="h-[120px] bg-gradient-to-br from-blue-400 to-indigo-400 flex items-center justify-center relative overflow-hidden">
                        <div class="absolute inset-0 opacity-20">
                            <div class="absolute top-2 left-2 text-5xl">⚫</div>
                            <div class="absolute bottom-2 right-2 text-3xl">⚪</div>
                        </div>
                        <div class="text-6xl relative z-10">⚫⚪</div>
                    </div>
                    <div class="p-3">
                        <h3 class="font-bold text-lg mb-1">五子棋</h3>
                        <p class="text-xs text-gray-500 mb-2">简单易上手</p>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-gray-400">即将推出</span>
                            <span class="text-xs text-gray-400">2人对战</span>
                        </div>
                    </div>
                </div>

                <!-- 德州扑克（即将推出） -->
                <div class="game-card bg-white rounded-2xl shadow-lg overflow-hidden opacity-60">
                    <div
                        class="h-[120px] bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center relative overflow-hidden">
                        <div class="absolute inset-0 opacity-20">
                            <div class="absolute top-2 left-2 text-5xl">🎰</div>
                            <div class="absolute bottom-2 right-2 text-3xl">💰</div>
                        </div>
                        <div class="text-6xl relative z-10">🎰</div>
                    </div>
                    <div class="p-3">
                        <h3 class="font-bold text-lg mb-1">德州扑克</h3>
                        <p class="text-xs text-gray-500 mb-2">刺激的博弈游戏</p>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-gray-400">即将推出</span>
                            <span class="text-xs text-gray-400">多人对战</span>
                        </div>
                    </div>
                </div>

                <!-- 猜拳游戏（即将推出） -->
                <div class="game-card bg-white rounded-2xl shadow-lg overflow-hidden opacity-60">
                    <div
                        class="h-[120px] bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center relative overflow-hidden">
                        <div class="absolute inset-0 opacity-20">
                            <div class="absolute top-2 left-2 text-4xl">✊</div>
                            <div class="absolute bottom-2 right-2 text-3xl">✌️</div>
                        </div>
                        <div class="text-6xl relative z-10">✊✋✌️</div>
                    </div>
                    <div class="p-3">
                        <h3 class="font-bold text-lg mb-1">猜拳</h3>
                        <p class="text-xs text-gray-500 mb-2">石头剪刀布</p>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-gray-400">即将推出</span>
                            <span class="text-xs text-gray-400">休闲娱乐</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 更多游戏提示 -->
            <div class="mt-6 text-center text-gray-400 text-sm">
                <p>更多精彩游戏，敬请期待...</p>
            </div>
        </div>
    </div>

    <!-- 游戏中心 设置（菜单 → 子面板） -->
    <div v-if="showSettings"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/30 backdrop-blur-sm"
        @click.self="closeSettings">
        <div class="w-full max-w-md bg-white/95 rounded-t-3xl sm:rounded-3xl shadow-2xl shadow-slate-900/20 max-h-[88vh] overflow-hidden flex flex-col">

            <!-- 设置主菜单 -->
            <template v-if="settingsView === 'menu'">
                <div class="px-5 pt-5 pb-3 border-b border-slate-100">
                    <div class="flex items-center justify-between">
                        <div>
                            <h2 class="text-lg font-bold text-slate-900">设置</h2>
                            <p class="text-xs text-slate-400 mt-0.5">游戏相关的独立选项</p>
                        </div>
                        <button @click="closeSettings"
                            class="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 transition-colors">
                            <i class="fa-solid fa-xmark text-lg"></i>
                        </button>
                    </div>
                </div>
                <div class="p-3 overflow-y-auto">
                    <button @click="openApiSettings"
                        class="gc-menu-item">
                        <span class="gc-menu-icon">
                            <i class="fa-solid fa-bolt text-amber-500"></i>
                        </span>
                        <span class="gc-menu-text">
                            <span class="block text-sm font-medium text-slate-800">API 自定义</span>
                            <span class="block text-xs text-slate-400">极速版 AI 渠道</span>
                        </span>
                        <i class="fa-solid fa-chevron-right text-slate-300 text-sm"></i>
                    </button>
                    <button @click="openChatSettings"
                        class="gc-menu-item">
                        <span class="gc-menu-icon">
                            <i class="fa-solid fa-comments text-sky-500"></i>
                        </span>
                        <span class="gc-menu-text">
                            <span class="block text-sm font-medium text-slate-800">游戏聊天记忆</span>
                            <span class="block text-xs text-slate-400">保留天数与留存规则</span>
                        </span>
                        <i class="fa-solid fa-chevron-right text-slate-300 text-sm"></i>
                    </button>
                    <button @click="settingsView = 'about'"
                        class="gc-menu-item">
                        <span class="gc-menu-icon">
                            <i class="fa-solid fa-circle-info text-slate-500"></i>
                        </span>
                        <span class="gc-menu-text">
                            <span class="block text-sm font-medium text-slate-800">关于游戏中心</span>
                            <span class="block text-xs text-slate-400">版本与渠道状态</span>
                        </span>
                        <i class="fa-solid fa-chevron-right text-slate-300 text-sm"></i>
                    </button>
                </div>
            </template>

            <!-- API 自定义 子面板 -->
            <template v-else-if="settingsView === 'api'">
                <div class="px-5 pt-5 pb-3 border-b border-slate-100">
                    <div class="flex items-center justify-between">
                        <button @click="settingsView = 'menu'"
                            class="w-8 h-8 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition-colors">
                            <i class="fa-solid fa-chevron-left text-lg"></i>
                        </button>
                        <h2 class="text-base font-bold text-slate-900">API 自定义</h2>
                        <button @click="closeSettings"
                            class="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 transition-colors">
                            <i class="fa-solid fa-xmark text-lg"></i>
                        </button>
                    </div>
                </div>

                <div class="p-5 overflow-y-auto">
                    <p class="text-xs text-slate-500 leading-relaxed mb-5">
                        游戏中心内所有 AI（麻将 / 娃娃机 / UNO）单独走一条极速渠道，建议选用 flash 模型，响应更快。
                    </p>

                    <label class="gc-toggle-row mb-5">
                        <span class="text-sm font-medium text-slate-700">启用独立渠道</span>
                        <input type="checkbox" v-model="gcForm.enabled" class="gc-toggle">
                    </label>

                    <div class="gc-field mb-4">
                        <label class="gc-label">API 地址</label>
                        <input v-model="gcForm.baseUrl" type="text" placeholder="https://.../v1" class="gc-input">
                    </div>

                    <div class="gc-field mb-4">
                        <label class="gc-label">API Key</label>
                        <input v-model="gcForm.apiKey" type="password" placeholder="sk-..." class="gc-input">
                    </div>

                    <div class="gc-field mb-4">
                        <div class="flex items-center justify-between mb-1.5">
                            <label class="gc-label">模型</label>
                            <button @click="fetchModels" :disabled="!gcForm.baseUrl || fetchingModels"
                                class="text-xs font-medium text-slate-600 hover:text-slate-900 disabled:text-slate-300 transition-colors">
                                {{ fetchingModels ? '拉取中…' : '拉取列表' }}
                            </button>
                        </div>
                        <select v-if="!gcModelManual && modelList.length" v-model="gcForm.model" class="gc-select">
                            <option v-for="m in modelList" :key="m" :value="m">{{ m }}</option>
                        </select>
                        <input v-else v-model="gcForm.model" type="text" placeholder="gemini-2.0-flash" class="gc-input">
                        <div class="flex items-start justify-between mt-1.5 gap-2">
                            <p v-if="modelError" class="text-xs text-red-500 leading-tight">{{ modelError }}</p>
                            <p v-else class="text-xs text-slate-400">可手动输入或从接口拉取</p>
                            <button v-if="modelList.length && !gcModelManual" @click="gcModelManual = true"
                                class="text-xs text-slate-400 hover:text-slate-600 whitespace-nowrap">手动输入</button>
                            <button v-if="gcModelManual" @click="gcModelManual = false"
                                class="text-xs text-slate-400 hover:text-slate-600 whitespace-nowrap">选择列表</button>
                        </div>
                    </div>

                    <div class="gc-field mb-6">
                        <div class="flex items-center justify-between mb-2">
                            <label class="gc-label">温度</label>
                            <span class="text-xs font-semibold text-slate-700 tabular-nums">{{ gcForm.temperature }}</span>
                        </div>
                        <input v-model.number="gcForm.temperature" type="range" min="0" max="1" step="0.1"
                            class="gc-range">
                    </div>

                    <button @click="saveGameCenterConfig" class="gc-primary-btn">
                        保存配置
                    </button>
                </div>
            </template>

            <!-- 游戏聊天记忆 子面板 -->
            <template v-else-if="settingsView === 'chat'">
                <div class="px-5 pt-5 pb-3 border-b border-slate-100">
                    <div class="flex items-center justify-between">
                        <button @click="settingsView = 'menu'"
                            class="w-8 h-8 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition-colors">
                            <i class="fa-solid fa-chevron-left text-lg"></i>
                        </button>
                        <h2 class="text-base font-bold text-slate-900">游戏聊天记忆</h2>
                        <button @click="closeSettings"
                            class="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 transition-colors">
                            <i class="fa-solid fa-xmark text-lg"></i>
                        </button>
                    </div>
                </div>

                <div class="p-5 overflow-y-auto">
                    <p class="text-xs text-slate-500 leading-relaxed mb-5">
                        控制各游戏（麻将 / UNO / 娃娃机）局内聊天的留存。各游戏互不联通，仅在本游戏内永久保留。
                    </p>

                    <label class="gc-toggle-row mb-5">
                        <span class="text-sm font-medium text-slate-700">保留游戏聊天</span>
                        <input type="checkbox" v-model="chatForm.enabled" class="gc-toggle">
                    </label>

                    <div v-if="chatForm.enabled" class="space-y-5">
                        <div class="gc-field">
                            <label class="gc-label mb-2 block">留存方式</label>
                            <div class="grid grid-cols-2 gap-2">
                                <button @click="chatForm.mode = 'all'"
                                    class="py-2.5 rounded-xl text-sm font-medium border transition-all"
                                    :class="chatForm.mode === 'all' ? 'border-sky-500 bg-sky-50 text-sky-600' : 'border-slate-200 text-slate-500'">
                                    永久保留
                                </button>
                                <button @click="chatForm.mode = 'custom'"
                                    class="py-2.5 rounded-xl text-sm font-medium border transition-all"
                                    :class="chatForm.mode === 'custom' ? 'border-sky-500 bg-sky-50 text-sky-600' : 'border-slate-200 text-slate-500'">
                                    自定义天数
                                </button>
                            </div>
                        </div>

                        <div v-if="chatForm.mode === 'custom'" class="gc-field">
                            <label class="gc-label">保留天数（天）</label>
                            <input v-model.number="chatForm.days" type="number" min="1" max="3650"
                                class="gc-input" placeholder="30">
                            <p class="text-xs text-slate-400 mt-1">仅保留最近 {{ chatForm.days || 0 }} 天的聊天，更早的自动清理</p>
                        </div>

                        <p v-else class="text-xs text-slate-400 leading-relaxed">
                            所有历史聊天都会保留（最多 300 条，防止存储溢出）。
                        </p>
                    </div>

                    <div v-else class="text-xs text-slate-400 leading-relaxed mb-5">
                        关闭后，仅保留当局游戏的聊天内容，退出游戏即清空历史。
                    </div>

                    <button @click="saveGameChatMemory" class="gc-primary-btn mt-2">
                        保存设置
                    </button>
                </div>
            </template>

            <!-- 关于 子面板 -->
            <template v-else-if="settingsView === 'about'">
                <div class="px-5 pt-5 pb-3 border-b border-slate-100">
                    <div class="flex items-center justify-between">
                        <button @click="settingsView = 'menu'"
                            class="w-8 h-8 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition-colors">
                            <i class="fa-solid fa-chevron-left text-lg"></i>
                        </button>
                        <h2 class="text-base font-bold text-slate-900">关于</h2>
                        <button @click="closeSettings"
                            class="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 transition-colors">
                            <i class="fa-solid fa-xmark text-lg"></i>
                        </button>
                    </div>
                </div>
                <div class="p-5 overflow-y-auto space-y-3 text-sm">
                    <div class="gc-info-row">
                        <span class="text-slate-500">当前版本</span>
                        <span class="font-medium text-slate-800">{{ appVersion }}</span>
                    </div>
                    <div class="gc-info-row">
                        <span class="text-slate-500">极速渠道</span>
                        <span class="font-medium" :class="gameCenterConfig ? 'text-emerald-600' : 'text-slate-400'">
                            {{ gameCenterConfig ? '已启用' : '未启用（回落全局）' }}
                        </span>
                    </div>
                    <div class="gc-info-row">
                        <span class="text-slate-500">渠道模型</span>
                        <span class="font-medium text-slate-800">{{ gameCenterConfig ? gameCenterConfig.model : '—' }}</span>
                    </div>
                    <p class="text-xs text-slate-400 leading-relaxed pt-1">
                        未配置时，游戏中心所有 AI 调用会回落到微信聊天的全局 API。
                    </p>
                </div>
            </template>

        </div>
    </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../../stores/settingsStore'
import versionData from '../../version.json'

const router = useRouter()
const settingsStore = useSettingsStore()
const showSettings = ref(false)
const settingsView = ref('menu') // 'menu' | 'api' | 'about'
const selectedCategory = ref('all')
const appVersion = versionData.version || '1.10.273'

// 游戏中心独立 API 配置（极速版 flash 渠道）
const gcForm = reactive({ enabled: true, baseUrl: '', apiKey: '', temperature: 0.7, model: 'gemini-2.0-flash' })
// 模型下拉列表（从 API 实时拉取，避免手填）
const modelList = ref([])
const modelError = ref('')
const gcModelManual = ref(false)
const fetchingModels = ref(false)

// 游戏聊天记忆设置
const chatForm = reactive({ enabled: true, mode: 'all', days: 30 })

const gameCenterConfig = computed(() => settingsStore.gameCenterConfig)

// 打开设置时同步当前已保存的配置 + 重置到主菜单
watch(showSettings, (v) => {
    if (v) {
        const c = settingsStore.gameCenterApiConfig
        gcForm.enabled = c.enabled
        gcForm.baseUrl = c.baseUrl
        gcForm.apiKey = c.apiKey
        gcForm.temperature = c.temperature
        gcForm.model = c.model
        settingsView.value = 'menu'
        modelList.value = []
        modelError.value = ''
        gcModelManual.value = false
    }
})

const closeSettings = () => { showSettings.value = false }

// 进入 API 子面板：同步表单后尝试拉取模型列表
const openApiSettings = () => {
    const c = settingsStore.gameCenterApiConfig
    gcForm.enabled = c.enabled
    gcForm.baseUrl = c.baseUrl
    gcForm.apiKey = c.apiKey
    gcForm.temperature = c.temperature
    gcForm.model = c.model
    modelList.value = []
    modelError.value = ''
    gcModelManual.value = false
    settingsView.value = 'api'
    if ((gcForm.baseUrl || '').trim()) fetchModels()
}

// 进入游戏聊天记忆子面板：同步表单
const openChatSettings = () => {
    const m = settingsStore.gameChatMemory
    chatForm.enabled = m.enabled
    chatForm.mode = m.mode
    chatForm.days = m.days
    settingsView.value = 'chat'
}

// 保存游戏聊天记忆设置
const saveGameChatMemory = () => {
    settingsStore.setGameChatMemory({
        enabled: !!chatForm.enabled,
        mode: chatForm.enabled ? chatForm.mode : 'all',
        days: Math.max(1, Number(chatForm.days) || 30),
    })
    closeSettings()
}

// 从 API 拉取可用模型列表（兼容 OpenAI / Gemini 风格的 /models 端点）
const fetchModels = async () => {
    const base = (gcForm.baseUrl || '').trim().replace(/\/+$/, '')
    if (!base) { modelError.value = '请先填写 API 地址'; return }
    fetchingModels.value = true
    modelError.value = ''
    try {
        const url = `${base}/models`
        const headers = {}
        const key = (gcForm.apiKey || '').trim()
        if (key) headers['Authorization'] = `Bearer ${key}`
        const resp = await fetch(url, { headers })
        if (!resp.ok) throw new Error('HTTP ' + resp.status)
        const json = await resp.json()
        const list = []
        if (Array.isArray(json.data)) {
            json.data.forEach(m => { if (m && m.id) list.push(m.id) })
        } else if (Array.isArray(json.models)) {
            json.models.forEach(m => {
                if (!m) return
                const n = m.id || m.name
                if (n) list.push(String(n).replace(/^models\//, ''))
            })
        }
        if (!list.length) throw new Error('未解析到模型')
        // 去重并排序，方便选择
        modelList.value = [...new Set(list)].sort()
        gcModelManual.value = false
        if (!modelList.value.includes(gcForm.model)) gcForm.model = modelList.value[0]
    } catch (e) {
        modelError.value = '拉取失败：' + (e && e.message ? e.message : e) + '（可手动输入）'
        gcModelManual.value = true
    } finally {
        fetchingModels.value = false
    }
}

const saveGameCenterConfig = () => {
    settingsStore.setGameCenterApiConfig({
        enabled: gcForm.enabled,
        baseUrl: (gcForm.baseUrl || '').trim(),
        apiKey: (gcForm.apiKey || '').trim(),
        temperature: Number(gcForm.temperature) || 0.7,
        model: (gcForm.model || '').trim()
    })
    settingsView.value = 'menu'
}

const categories = [
    { id: 'all', name: '全部' },
    { id: 'card', name: '棋牌' },
    { id: 'casual', name: '休闲' },
    { id: 'strategy', name: '策略' }
]

const unoThumbColors = ['red', 'yellow', 'green', 'blue']
const unoThumbHex = {
    red: '#ef4444',
    yellow: '#f59e0b',
    green: '#22c55e',
    blue: '#3b82f6'
}

const openGame = (gameId) => {
    if (gameId === 'mahjong') {
        router.push('/games/mahjong-lobby')
    } else if (gameId === 'claw-machine') {
        router.push('/games/claw-machine')
    } else if (gameId === 'uno') {
        router.push('/games/uno-lobby')
    } else {
        alert('该游戏即将推出，敬请期待！')
    }
}
</script>

<style scoped>
.game-card {
    cursor: pointer;
}

.game-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

/* 设置面板 - 更克制的样式 */
.gc-menu-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.875rem 0.75rem;
    margin-bottom: 0.5rem;
    border-radius: 1rem;
    text-align: left;
    transition: all 0.2s ease;
}

.gc-menu-item:hover {
    background-color: #f8fafc;
}

.gc-menu-item:active {
    transform: scale(0.99);
}

.gc-menu-icon {
    width: 2.25rem;
    height: 2.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f1f5f9;
    border-radius: 0.75rem;
    flex-shrink: 0;
}

.gc-menu-text {
    flex: 1;
}

.gc-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
}

.gc-toggle {
    appearance: none;
    width: 2.75rem;
    height: 1.5rem;
    background: #e2e8f0;
    border-radius: 9999px;
    position: relative;
    cursor: pointer;
    transition: background 0.2s ease;
}

.gc-toggle::after {
    content: '';
    position: absolute;
    top: 0.125rem;
    left: 0.125rem;
    width: 1.25rem;
    height: 1.25rem;
    background: white;
    border-radius: 50%;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
    transition: transform 0.2s ease;
}

.gc-toggle:checked {
    background: #0f172a;
}

.gc-toggle:checked::after {
    transform: translateX(1.25rem);
}

.gc-field {
    display: block;
}

.gc-label {
    display: block;
    font-size: 0.8125rem;
    font-weight: 500;
    color: #475569;
    margin-bottom: 0.375rem;
}

.gc-input,
.gc-select {
    width: 100%;
    padding: 0.65rem 0.875rem;
    font-size: 0.9375rem;
    color: #0f172a;
    background: #f8fafc;
    border: 1px solid transparent;
    border-radius: 0.875rem;
    outline: none;
    transition: all 0.2s ease;
}

.gc-input::placeholder {
    color: #94a3b8;
}

.gc-input:focus,
.gc-select:focus {
    background: #ffffff;
    border-color: #cbd5e1;
    box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.06);
}

.gc-select {
    cursor: pointer;
}

.gc-range {
    width: 100%;
    height: 0.375rem;
    background: #e2e8f0;
    border-radius: 9999px;
    appearance: none;
    outline: none;
}

.gc-range::-webkit-slider-thumb {
    appearance: none;
    width: 1.25rem;
    height: 1.25rem;
    background: #0f172a;
    border-radius: 50%;
    cursor: pointer;
    border: 3px solid #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    transition: transform 0.15s ease;
}

.gc-range::-webkit-slider-thumb:hover {
    transform: scale(1.05);
}

.gc-primary-btn {
    width: 100%;
    padding: 0.875rem;
    background: #0f172a;
    color: #ffffff;
    font-size: 0.9375rem;
    font-weight: 600;
    border-radius: 0.875rem;
    transition: all 0.2s ease;
}

.gc-primary-btn:hover {
    background: #1e293b;
}

.gc-primary-btn:active {
    transform: scale(0.98);
}

.gc-info-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: #f8fafc;
    border-radius: 0.875rem;
}
</style>
