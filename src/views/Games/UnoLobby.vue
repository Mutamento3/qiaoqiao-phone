<template>
    <div class="uno-lobby w-full h-full flex flex-col bg-gradient-to-br from-emerald-50 to-green-50">
        <!-- 顶部导航 -->
        <div
            class="h-[50px] bg-gradient-to-r from-emerald-600 to-green-600 flex items-center justify-between px-4 shadow-lg">
            <button @click="router.push('/games')" class="w-10 h-10 flex items-center justify-center text-white">
                <i class="fa-solid fa-chevron-left text-xl"></i>
            </button>
            <h1 class="text-xl font-bold text-white flex items-center gap-2">
                <i class="fa-solid fa-clone"></i>
                <span>UNO</span>
            </h1>
            <div class="w-10"></div>
        </div>

        <!-- 主视觉 -->
        <div
            class="m-4 h-[150px] bg-gradient-to-r from-emerald-400 to-green-500 rounded-2xl shadow-lg overflow-hidden relative">
            <div class="absolute inset-0 flex items-center justify-center">
                <div class="text-center text-white">
                    <div class="text-5xl mb-2">🃏</div>
                    <div class="text-2xl font-bold">UNO 卡牌对战</div>
                    <div class="text-sm opacity-90 mt-1">配色出牌，先出完者胜</div>
                </div>
            </div>
        </div>

        <!-- 对手数量选择 -->
        <div class="mx-4 bg-white rounded-2xl shadow-lg p-4">
            <div class="flex items-center justify-between mb-3">
                <span class="font-bold text-gray-800">对手数量</span>
                <span class="text-xs text-emerald-600 font-bold">共 {{ aiCount + 1 }} 人</span>
            </div>
            <div class="grid grid-cols-3 gap-3">
                <button v-for="n in [1, 2, 3]" :key="n" @click="aiCount = n"
                    class="py-3 rounded-xl font-bold transition-all active:scale-95"
                    :class="aiCount === n ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-md' : 'bg-gray-100 text-gray-600'">
                    {{ n }} 个
                </button>
            </div>
            <p class="text-xs text-gray-500 mt-3 leading-relaxed">
                快速开始会随机匹配 AI 对手；进入房间后，可把任意对手替换为你的联系人角色（如 乔笙）。
            </p>
        </div>

        <!-- 玩法简述 -->
        <div class="mx-4 mt-3 bg-white/70 rounded-2xl p-4 text-sm text-gray-600 leading-relaxed">
            <div class="font-bold text-gray-800 mb-1">玩法</div>
            轮流打出手牌：颜色或数字/图案相同即可；万能牌可任意出并指定颜色；
            <span class="text-emerald-700 font-bold">跳过 ⊘</span> 跳过下家、
            <span class="text-emerald-700 font-bold">反转 ⇄</span> 反向、
            <span class="text-emerald-700 font-bold">+2</span> 下家抽2、
            <span class="text-emerald-700 font-bold">+4</span> 下家抽4。剩 1 张时记得喊 <b>UNO</b>！
        </div>

        <!-- 底部按钮 -->
        <div class="p-4 mt-auto">
            <button @click="quickStart"
                class="w-full py-4 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold text-xl rounded-2xl shadow-xl active:scale-95 transition-transform">
                <i class="fa-solid fa-play mr-2"></i>
                快速开始
            </button>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUnoStore } from '../../stores/unoStore.js'

const router = useRouter()
const unoStore = useUnoStore()
const aiCount = ref(1)

const quickStart = () => {
    unoStore.createRoom({ aiCount: aiCount.value })
    router.push('/games/uno-room')
}
</script>

<style scoped>
.uno-lobby {
    max-width: 600px;
    margin: 0 auto;
}
</style>
