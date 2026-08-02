<template>
    <div class="mono-room w-full h-full flex flex-col bg-gradient-to-br from-amber-50 to-orange-50">
        <!-- 顶部导航 -->
        <div
            class="h-[50px] bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-between px-4 shadow-lg">
            <button @click="handleBack" class="w-10 h-10 flex items-center justify-center text-white">
                <i class="fa-solid fa-chevron-left text-xl"></i>
            </button>
            <h1 class="text-lg font-bold text-white">房间等待</h1>
            <div class="w-10"></div>
        </div>

        <div class="m-4 bg-white rounded-2xl shadow-lg p-4">
            <div class="flex items-center gap-2">
                <div class="flex-1 flex flex-col items-center justify-center text-gray-600 px-2 py-2 bg-gray-50 rounded-xl border border-amber-100 font-bold whitespace-nowrap">
                    <span class="text-[10px] opacity-70">房间号</span>
                    <span class="text-gray-900 text-sm">{{ roomId }}</span>
                </div>
                <div class="flex-1 flex flex-col items-center justify-center text-gray-600 px-2 py-2 bg-gray-50 rounded-xl border border-amber-100 font-bold whitespace-nowrap">
                    <span class="text-[10px] opacity-70">人数</span>
                    <span class="text-amber-700 text-sm">{{ playerCount }}人</span>
                </div>
                <div class="flex-1 flex flex-col items-center justify-center text-gray-600 px-2 py-2 bg-gray-50 rounded-xl border border-amber-100 font-bold whitespace-nowrap">
                    <span class="text-[10px] opacity-70">回合上限</span>
                    <span class="text-blue-600 text-sm">{{ monopolyStore.currentRoom?.maxRounds }}回</span>
                </div>
            </div>
        </div>

        <!-- 座位布局 -->
        <div class="flex-1 p-4 overflow-y-auto">
            <div class="grid gap-3" :style="seatGridStyle">
                <template v-for="(p, idx) in seats" :key="idx">
                    <!-- 已就座 -->
                    <div v-if="p" class="seat-card ready">
                        <div class="seat-order" :style="{ background: p.color }">{{ idx + 1 }}</div>
                        <div v-if="isImageAvatar(p.avatar)"
                            class="w-14 h-14 rounded-full overflow-hidden mb-2 border-2 border-white shadow">
                            <img :src="p.avatar" class="w-full h-full object-cover" />
                        </div>
                        <div v-else class="text-4xl mb-2">{{ p.avatar || '👤' }}</div>
                        <div class="text-gray-800 text-[11px] text-center mb-1 flex flex-col items-center">
                            <div class="font-bold w-[80px] whitespace-normal break-all leading-tight">{{ p.name }}</div>
                            <div class="text-gray-500 font-medium text-[10px]">{{ p.isUser ? '你' : (p.isAI ? 'AI' : '好友') }}</div>
                        </div>
                        <button v-if="!p.isUser" @click="removeSeat(p.id)"
                            class="mt-1 text-[10px] text-red-400 px-2 py-0.5 rounded-full bg-red-50 active:scale-95">移出</button>
                    </div>
                    <!-- 空座位 -->
                    <div v-else class="seat-card empty" @click="invitePlayer(idx)">
                        <i class="fa-solid fa-plus text-4xl text-gray-300"></i>
                        <div class="text-xs text-gray-400 mt-2">邀请玩家</div>
                    </div>
                </template>
            </div>
        </div>

        <!-- 底部按钮 -->
        <div class="p-4">
            <button v-if="playerCount >= 2" @click="startGame"
                class="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-xl rounded-2xl shadow-xl active:scale-95 transition-transform">
                <i class="fa-solid fa-play mr-2"></i>开始游戏
            </button>
            <div v-else class="w-full py-4 bg-gray-300 text-gray-500 font-bold text-xl rounded-2xl text-center">
                至少邀请 1 名对手 ({{ playerCount }}/2)
            </div>
        </div>

        <!-- 邀请弹窗 -->
        <Transition name="fade">
            <div v-if="showInvite" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                @click="showInvite = false">
                <div class="bg-white rounded-2xl p-6 m-4 max-w-sm w-full max-h-[80vh] overflow-y-auto" @click.stop>
                    <h2 class="text-xl font-bold mb-4">邀请玩家</h2>
                    <div class="flex gap-2 mb-4">
                        <button @click="inviteTab = 'npc'" class="flex-1 py-2 rounded-lg font-bold transition-all"
                            :class="inviteTab === 'npc' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600'">NPC</button>
                        <button @click="inviteTab = 'contacts'" class="flex-1 py-2 rounded-lg font-bold transition-all"
                            :class="inviteTab === 'contacts' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600'">通讯录</button>
                    </div>
                    <div v-if="inviteTab === 'npc'" class="space-y-2">
                        <div v-for="npc in availableNPCs" :key="npc.id" @click="addNPC(npc)"
                            class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg active:bg-gray-100 cursor-pointer">
                            <div class="text-3xl">{{ npc.avatar }}</div>
                            <div class="flex-1"><div class="font-bold">{{ npc.name }}</div></div>
                            <i class="fa-solid fa-plus text-amber-500"></i>
                        </div>
                        <div v-if="!availableNPCs.length" class="text-center text-gray-400 text-sm py-4">没有更多可用 NPC</div>
                    </div>
                    <div v-if="inviteTab === 'contacts'" class="space-y-2">
                        <div v-for="contact in availableContacts" :key="contact.id" @click="addContact(contact)"
                            class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg active:bg-gray-100 cursor-pointer">
                            <div v-if="isImageAvatar(contact.avatar)" class="w-10 h-10 rounded-full overflow-hidden">
                                <img :src="contact.avatar" class="w-full h-full object-cover" />
                            </div>
                            <div v-else class="text-3xl">{{ contact.avatar || '👤' }}</div>
                            <div class="flex-1"><div class="font-bold">{{ contact.name }}</div></div>
                            <i class="fa-solid fa-plus text-amber-500"></i>
                        </div>
                        <div v-if="!availableContacts.length" class="text-center text-gray-400 text-sm py-4">通讯录暂无更多好友</div>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- 确认弹窗 -->
        <div v-if="showConfirm" class="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div class="bg-white rounded-2xl p-6 max-w-[300px] w-full shadow-2xl">
                <h3 class="text-lg font-bold text-center mb-4 text-gray-800">{{ confirmModal.title }}</h3>
                <p class="text-center text-gray-600 mb-6">{{ confirmModal.message }}</p>
                <div class="flex gap-3">
                    <button @click="confirmModal.onCancel()" class="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm active:scale-95">{{ confirmModal.cancelText || '取消' }}</button>
                    <button @click="confirmModal.onConfirm()" class="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-bold text-sm active:scale-95">{{ confirmModal.confirmText || '确认' }}</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useMonopolyStore } from '../../stores/monopolyStore.js'
import { useChatStore } from '../../stores/chatStore.js'
import { MONOPOLY_NPCS } from '../../utils/monopoly/monopolyBoard.js'

const router = useRouter()
const monopolyStore = useMonopolyStore()
const chatStore = useChatStore()
const showInvite = ref(false)
const inviteTab = ref('npc')
const invitePosition = ref(0)
const showConfirm = ref(false)
const confirmModal = ref({ title: '', message: '', confirmText: '确认', cancelText: '取消', onConfirm: () => {}, onCancel: () => {} })

const roomId = computed(() => monopolyStore.currentRoom?.id?.slice(-6).toUpperCase() || '------')
const playerCount = computed(() => monopolyStore.currentRoom?.players?.length || 0)
const seats = computed(() => {
    const room = monopolyStore.currentRoom
    if (!room) return []
    const total = Math.min(8, room.playerCount)
    const arr = []
    for (let i = 0; i < total; i++) arr.push(room.players[i] || null)
    return arr
})
const seatGridStyle = computed(() => {
    const n = Math.min(8, monopolyStore.currentRoom?.playerCount || 2)
    const cols = n <= 4 ? 2 : 4
    return { gridTemplateColumns: `repeat(${cols}, 1fr)` }
})

const availableNPCs = computed(() => {
    const inRoom = monopolyStore.currentRoom?.players?.map(p => p.id) || []
    return MONOPOLY_NPCS.filter(n => !inRoom.includes(n.id))
})
const availableContacts = computed(() => {
    const inRoom = monopolyStore.currentRoom?.players?.map(p => p.id) || []
    const raw = chatStore.chats || {}
    const chats = Array.isArray(raw) ? raw : Object.values(raw)
    return chats.filter(c => !c.isGroup && !inRoom.includes(c.id)).map(c => ({ id: c.id, name: c.name, avatar: c.avatar }))
})

const isImageAvatar = (avatar) => !!avatar && (avatar.startsWith('/') || avatar.startsWith('data:image') || avatar.startsWith('http'))

const invitePlayer = (idx) => {
    invitePosition.value = idx
    showInvite.value = true
}

const addNPC = (npc) => {
    monopolyStore.addPlayerById(npc.id, npc.name, npc.avatar)
    showInvite.value = false
}

const addContact = async (contact) => {
    const ok = monopolyStore.addPlayerById(contact.id, contact.name, contact.avatar)
    if (!ok) return
    // 发送系统提示：正在与你一起玩大富翁
    const currentUserName = monopolyStore.currentRoom?.players?.find(p => p.id === 'user')?.name || '玩家'
    const timestamp = Date.now()
    const formattedTime = new Date(timestamp).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    try {
        await chatStore.addMessage(contact.id, {
            role: 'system',
            content: `${currentUserName}正在与你一起玩大富翁 [TIMESTAMP:${formattedTime}]`,
            timestamp,
        })
    } catch (e) { /* ignore */ }
    showInvite.value = false
}

const removeSeat = (id) => {
    confirmModal.value = {
        title: '移出玩家', message: '确定将该玩家移出房间吗？', confirmText: '移出', cancelText: '取消',
        onConfirm: () => { monopolyStore.removePlayer(id); showConfirm.value = false },
        onCancel: () => { showConfirm.value = false },
    }
    showConfirm.value = true
}

const startGame = () => {
    monopolyStore.startGame()
    router.push('/games/monopoly')
}

const handleBack = () => {
    confirmModal.value = {
        title: '退出房间', message: '确定要退出房间吗？', confirmText: '确认', cancelText: '取消',
        onConfirm: () => { monopolyStore.leaveRoom(); router.push('/games/monopoly-lobby'); showConfirm.value = false },
        onCancel: () => { showConfirm.value = false },
    }
    showConfirm.value = true
}
</script>

<style scoped>
.seat-card {
    background: white;
    border-radius: 16px;
    padding: 16px 10px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    border: 3px solid transparent;
    min-height: 130px;
    transition: all 0.3s;
}

.seat-card.ready {
    border-color: #f59e0b;
    background: linear-gradient(145deg, #fffbeb, #fef3c7);
}

.seat-card.empty {
    border: 3px dashed #fcd34d;
    background: #fffdf5;
    cursor: pointer;
    opacity: 0.8;
}

.seat-card.empty:active {
    transform: scale(0.96);
}

.seat-order {
    position: absolute;
    top: 6px;
    left: 6px;
    color: white;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 13px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
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
