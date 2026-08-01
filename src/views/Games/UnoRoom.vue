<template>
    <div class="uno-room w-full h-full flex flex-col bg-emerald-50 overflow-hidden">
        <!-- 顶部导航 -->
        <div class="h-[50px] bg-gradient-to-r from-emerald-600 to-green-600 flex items-center justify-between px-4 shadow-lg flex-shrink-0">
            <button @click="handleBack" class="w-10 h-10 flex items-center justify-center text-white">
                <i class="fa-solid fa-chevron-left text-xl"></i>
            </button>
            <h1 class="text-lg font-bold text-white">房间等待</h1>
            <div class="w-10"></div>
        </div>

        <!-- 房间信息 -->
        <div class="m-4 bg-white rounded-2xl shadow-lg p-4 flex-shrink-0">
            <div class="flex items-center gap-2">
                <div class="flex-1 flex flex-col items-center justify-center text-gray-600 px-2 py-2 bg-gray-50 rounded-xl border border-emerald-100 font-bold whitespace-nowrap">
                    <span class="text-[10px] opacity-70">房间号</span>
                    <span class="text-gray-900 text-sm">{{ roomId }}</span>
                </div>
                <div class="flex-1 flex flex-col items-center justify-center text-gray-600 px-2 py-2 bg-gray-50 rounded-xl border border-emerald-100 font-bold whitespace-nowrap">
                    <span class="text-[10px] opacity-70">模式</span>
                    <span class="text-emerald-700 text-sm">{{ ruleName }}</span>
                </div>
                <div class="flex-1 flex flex-col items-center justify-center text-gray-600 px-2 py-2 bg-gray-50 rounded-xl border border-emerald-100 font-bold whitespace-nowrap">
                    <span class="text-[10px] opacity-70">底注</span>
                    <span class="text-blue-600 text-sm">{{ baseStake }}豆</span>
                </div>
                <div class="flex-1 flex flex-col items-center justify-center text-gray-600 px-2 py-2 bg-gray-50 rounded-xl border border-emerald-100 font-bold whitespace-nowrap">
                    <span class="text-[10px] opacity-70">人数</span>
                    <span class="text-purple-600 text-sm">{{ playerCount }}/{{ maxPlayers }}</span>
                </div>
            </div>
        </div>

        <!-- 座位布局 -->
        <div class="flex-1 px-4 pb-2 overflow-y-auto">
            <!-- 对手座位（动态行） -->
            <div class="space-y-3 mb-3">
                <div v-for="(row, ridx) in opponentRows" :key="ridx" class="grid gap-3" :class="rowClass(row.length)">
                    <div v-for="slot in row" :key="slot.position" class="seat-card" :class="{ 'ready': slot.player }">
                        <div class="seat-label">{{ slot.label }}</div>
                        <div v-if="slot.player" class="player-info w-full flex flex-col items-center">
                            <div v-if="isImageAvatar(slot.player.avatar)" class="w-14 h-14 rounded-full overflow-hidden mb-2 border-2 border-emerald-200">
                                <img :src="slot.player.avatar" class="w-full h-full object-cover" />
                            </div>
                            <div v-else class="text-3xl mb-2">{{ slot.player.avatar || '👤' }}</div>
                            <div class="text-gray-800 text-[11px] text-center mb-1 flex flex-col items-center">
                                <div class="font-bold w-[72px] whitespace-normal break-all leading-tight">{{ slot.player.name }}</div>
                                <div class="text-gray-500 font-medium text-[10px]">{{ slot.player.beans }}豆</div>
                            </div>
                            <div v-if="slot.player.id === 'user'" class="ready-badge bg-blue-500">你</div>
                            <div v-else class="ready-badge">已准备</div>
                            <button v-if="slot.player.id !== 'user'" @click="removePlayer(slot.index)" class="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center shadow">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <div v-else class="empty-seat" @click="invitePlayer(slot.index)">
                            <i class="fa-solid fa-plus text-4xl text-gray-300"></i>
                            <div class="text-sm text-gray-400 mt-2">邀请</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 玩家自己（始终底部居中） -->
            <div class="seat-card ready border-emerald-500 bg-gradient-to-br from-emerald-50 to-green-50 relative">
                <div class="seat-label">南</div>
                <div class="player-info w-full flex flex-col items-center">
                    <div v-if="isImageAvatar(userSeat?.avatar)" class="w-20 h-20 rounded-full overflow-hidden mb-2 border-2 border-emerald-300">
                        <img :src="userSeat.avatar" class="w-full h-full object-cover" />
                    </div>
                    <div v-else class="text-5xl mb-2">{{ userSeat?.avatar || '👤' }}</div>
                    <div class="text-gray-800 text-sm text-center mb-1 flex flex-col items-center">
                        <div class="font-bold">{{ userSeat?.name }}</div>
                        <div class="text-gray-500 font-medium text-xs">{{ userSeat?.beans }}豆</div>
                    </div>
                    <div class="ready-badge">已准备</div>
                </div>
            </div>
        </div>

        <!-- 底部按钮 -->
        <div class="p-4 flex-shrink-0">
            <button v-if="canStart" @click="startGame"
                class="w-full py-4 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold text-xl rounded-2xl shadow-xl active:scale-95 transition-transform">
                <i class="fa-solid fa-play mr-2"></i>
                开始游戏
            </button>
            <div v-else class="w-full py-4 bg-gray-300 text-gray-500 font-bold text-xl rounded-2xl text-center">
                至少 2 人才能开始 ({{ playerCount }}/{{ maxPlayers }})
            </div>
        </div>

        <!-- 邀请玩家弹窗 -->
        <Transition name="fade">
            <div v-if="showInvite" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click="showInvite = false">
                <div class="bg-white rounded-2xl p-6 m-4 max-w-sm w-full max-h-[80vh] overflow-y-auto" @click.stop>
                    <h2 class="text-xl font-bold mb-4">邀请玩家</h2>
                    <div class="flex gap-2 mb-4">
                        <button @click="inviteTab = 'npc'" class="flex-1 py-2 rounded-lg font-bold transition-all" :class="inviteTab === 'npc' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'">NPC</button>
                        <button @click="inviteTab = 'contacts'" class="flex-1 py-2 rounded-lg font-bold transition-all" :class="inviteTab === 'contacts' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'">通讯录</button>
                    </div>

                    <div v-if="inviteTab === 'npc'" class="space-y-2">
                        <div v-for="npc in availableNPCs" :key="npc.id" @click="addNPC(npc)" class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg active:bg-gray-100 cursor-pointer">
                            <div v-if="isImageAvatar(npc.avatar)" class="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                                <img :src="npc.avatar" class="w-full h-full object-cover" />
                            </div>
                            <div v-else class="text-3xl">{{ npc.avatar }}</div>
                            <div class="flex-1">
                                <div class="font-bold">{{ npc.name }}</div>
                                <div class="text-sm text-gray-500">{{ npc.beans }}豆</div>
                            </div>
                            <i class="fa-solid fa-plus text-emerald-500"></i>
                        </div>
                    </div>

                    <div v-if="inviteTab === 'contacts'" class="space-y-2">
                        <div v-for="contact in availableContacts" :key="contact.id" @click="addContact(contact)" class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg active:bg-gray-100 cursor-pointer">
                            <div v-if="isImageAvatar(contact.avatar)" class="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                                <img :src="contact.avatar" class="w-full h-full object-cover" />
                            </div>
                            <div v-else class="text-3xl">{{ contact.avatar || '👤' }}</div>
                            <div class="flex-1">
                                <div class="font-bold">{{ contact.name }}</div>
                                <div class="text-sm text-gray-500">{{ contact.signature || '在忙' }}</div>
                            </div>
                            <i class="fa-solid fa-plus text-emerald-500"></i>
                        </div>
                        <div v-if="availableContacts.length === 0" class="text-center text-gray-400 py-4 text-sm">暂无可邀请的联系人</div>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- 退出确认 -->
        <div v-if="showConfirmModal" class="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div class="bg-white rounded-2xl p-6 max-w-[300px] w-full shadow-2xl">
                <h3 class="text-lg font-bold text-center mb-4 text-gray-800">{{ confirmModal.title }}</h3>
                <p class="text-center text-gray-600 mb-6">{{ confirmModal.message }}</p>
                <div class="flex gap-3">
                    <button @click="confirmModal.onCancel()" class="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm active:scale-95 transition-all">{{ confirmModal.cancelText || '取消' }}</button>
                    <button @click="confirmModal.onConfirm()" class="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-bold text-sm active:scale-95 transition-all">{{ confirmModal.confirmText || '确认' }}</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUnoStore } from '../../stores/unoStore.js'
import { useChatStore } from '../../stores/chatStore.js'
import { POSITION_NAMES, SEAT_LABELS } from '../../utils/uno/unoEngine.js'

const router = useRouter()
const unoStore = useUnoStore()
const chatStore = useChatStore()

const showInvite = ref(false)
const inviteTab = ref('npc')
const invitePositionIndex = ref(0)
const showConfirmModal = ref(false)
const confirmModal = ref({ title: '', message: '', confirmText: '确认', cancelText: '取消', onConfirm: () => {}, onCancel: () => {} })

const roomId = computed(() => unoStore.currentRoom?.id?.slice(-6).toUpperCase() || '------')
const ruleName = computed(() => unoStore.currentRoom?.rules?.name || '经典')
const baseStake = computed(() => unoStore.currentRoom?.baseStake ?? 100)
const maxPlayers = computed(() => unoStore.currentRoom?.maxPlayers ?? 4)
const playerCount = computed(() => unoStore.currentRoom?.players?.length || 0)
const canStart = computed(() => playerCount.value >= 2)

const allSlots = computed(() => {
    const cap = maxPlayers.value
    const players = unoStore.currentRoom?.players || []
    const slots = []
    for (let i = 0; i < cap; i++) {
        const player = players.find((p) => p.position === POSITION_NAMES[i])
        slots.push({
            index: i,
            position: POSITION_NAMES[i],
            label: SEAT_LABELS[i],
            player: player || null
        })
    }
    return slots
})

const userSeat = computed(() => allSlots.value[0]?.player)
const opponentSlots = computed(() => allSlots.value.slice(1))

const opponentRows = computed(() => {
    const slots = opponentSlots.value
    const count = slots.length
    if (count <= 3) return [slots]
    if (count <= 6) {
        const half = Math.ceil(count / 2)
        return [slots.slice(0, half), slots.slice(half)]
    }
    const third = Math.ceil(count / 3)
    return [slots.slice(0, third), slots.slice(third, third * 2), slots.slice(third * 2)]
})

function rowClass(length) {
    if (length === 1) return 'grid-cols-1'
    if (length === 2) return 'grid-cols-2'
    if (length === 3) return 'grid-cols-3'
    return 'grid-cols-4'
}

const availableNPCs = computed(() => {
    const inRoom = unoStore.currentRoom?.players?.map((p) => p.id) || []
    return unoStore.getNPCs().filter((npc) => !inRoom.includes(npc.id))
})

const availableContacts = computed(() => {
    const inRoom = unoStore.currentRoom?.players?.map((p) => p.id) || []
    const rawChats = chatStore.chats || {}
    const chatsArray = Array.isArray(rawChats) ? rawChats : Object.values(rawChats)
    return chatsArray
        .filter((chat) => !chat.isGroup && !inRoom.includes(chat.id))
        .map((chat) => ({ id: chat.id, name: chat.name, avatar: chat.avatar, signature: chat.signature }))
})

function isImageAvatar(avatar) {
    if (!avatar) return false
    return avatar.startsWith('/') || avatar.startsWith('data:image') || avatar.startsWith('http')
}

function handleBack() {
    confirmModal.value = {
        title: '退出房间', message: '确定要退出房间吗？',
        onConfirm: () => { unoStore.returnToLobby(); router.push('/games/uno-lobby'); showConfirmModal.value = false },
        onCancel: () => { showConfirmModal.value = false }
    }
    showConfirmModal.value = true
}

function invitePlayer(index) {
    invitePositionIndex.value = index
    showInvite.value = true
}

function addNPC(npc) {
    unoStore.addNPC(npc, invitePositionIndex.value)
    showInvite.value = false
}

async function addContact(contact) {
    unoStore.addContact(contact, invitePositionIndex.value)
    const me = unoStore.currentRoom?.players?.find((p) => p.id === 'user')?.name || '玩家'
    const timestamp = Date.now()
    const formattedTime = new Date(timestamp).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    await chatStore.addMessage(contact.id, {
        role: 'system',
        content: `${me}正在邀请你一起玩 UNO [TIMESTAMP:${formattedTime}]`,
        timestamp
    })
    showInvite.value = false
}

function removePlayer(index) {
    unoStore.removePlayer(index)
}

function startGame() {
    unoStore.startGame()
    router.push('/games/uno')
}
</script>

<style scoped>
.seat-card {
    background: white;
    border-radius: 16px;
    padding: 16px 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    border: 3px solid transparent;
    transition: all 0.3s;
    min-height: 130px;
}
.seat-card.ready {
    border-color: #22c55e;
    background: linear-gradient(145deg, #f0fdf4, #dcfce7);
}
.seat-label {
    position: absolute;
    top: 6px;
    left: 6px;
    background: linear-gradient(135deg, #fbbf24, #10b981);
    color: white;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 11px;
}
.player-info { text-align: center; }
.empty-seat {
    text-align: center;
    opacity: 0.5;
    cursor: pointer;
    transition: all 0.3s;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}
.empty-seat:active { transform: scale(0.95); opacity: 0.8; }
.ready-badge {
    margin-top: 6px;
    padding: 3px 10px;
    background: #22c55e;
    color: white;
    border-radius: 12px;
    font-size: 11px;
    font-weight: bold;
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
