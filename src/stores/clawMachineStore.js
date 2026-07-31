/**
 * 娃娃机 Store
 * 管理游戏币/展馆/邀请角色/游戏状态/游玩聊天/自定义玩偶等
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useWalletStore } from './walletStore.js'
import { useChatStore } from './chatStore.js'
import { useSettingsStore } from './settingsStore.js'
import {
    MACHINES,
    getMachine,
    getMachineDolls,
} from '../utils/clawMachine/clawMachinesData.js'
import {
    generateDollLayout,
    resolveGrab,
} from '../utils/clawMachine/ClawMachineEngine.js'
import {
    generateAIOpening,
    generateAIReaction,
    generateGameChat,
    executeAIPlay,
} from '../utils/clawMachine/ClawMachineAI.js'
import { removeWhiteBackground } from '../utils/clawMachine/backgroundRemoval.js'
import { compressImage } from '../utils/imageUtils.js'

const STORAGE_KEY = 'claw_machine_data'

export const useClawMachineStore = defineStore('clawMachine', () => {
    // ============================================================
    // 状态
    // ============================================================

    // 游戏币
    const coins = ref(0)

    // 展馆：抓到的玩偶列表
    // { id, machineId, machineName, dollId, dollName, dollImage, caughtAt, caughtBy, charId, charName, position: {x, y} }
    const exhibition = ref([])

    // 自定义玩偶贴图（按机器ID存储，data URL）
    const customDolls = ref({}) // { 'plush': 'data:image/png;base64,...', ... }

    // 邀请的角色
    const invitedCharId = ref(null)
    const invitedCharName = ref(null)

    // 当前游戏状态
    const currentMachineId = ref(null)
    const gamePhase = ref('idle') // idle | inviting | selecting | charging | modeSelect | playing | result | exhibition
    const playMode = ref(null) // 'self' | 'ai'
    const controller = ref('user') // 'user' | 'ai' 当前操控者

    // 爪子状态
    const clawX = ref(50) // 0-100
    const clawY = ref(44) // 0-100（顶部为0），静止位在天花板下方，始终可见
    const clawState = ref('idle') // idle | moving | dropping | grabbing | rising | result

    // 机内玩偶布局
    const machineLayout = ref([])

    // 本次抓取结果
    const lastGrabResult = ref(null) // { success, doll, probability, alignment }

    // 游玩中聊天
    const gameChatMessages = ref([]) // { id, role: 'user'|'ai', content, timestamp }

    // 统计
    const stats = ref({
        totalPlays: 0,
        totalCaught: 0,
        selfPlays: 0,
        aiPlays: 0,
        selfCaught: 0,
        aiCaught: 0,
    })

    // AI 正在思考
    const aiThinking = ref(false)

    // 当前 AbortController（用于取消 AI 调用）
    let abortController = null

    // ============================================================
    // 充值包定义
    // ============================================================
    const rechargePackages = [
        { id: 'pkg1', coins: 10, price: 1, bonus: 0, label: '10币' },
        { id: 'pkg2', coins: 60, price: 6, bonus: 5, label: '60币+5赠送' },
        { id: 'pkg3', coins: 300, price: 30, bonus: 30, label: '300币+30赠送' },
        { id: 'pkg4', coins: 680, price: 68, bonus: 80, label: '680币+80赠送' },
    ]

    // ============================================================
    // 计算属性
    // ============================================================

    const currentMachine = computed(() => {
        return currentMachineId.value ? getMachine(currentMachineId.value) : null
    })

    const currentDolls = computed(() => {
        if (!currentMachineId.value) return []
        return getMachineDolls(currentMachineId.value, customDolls.value[currentMachineId.value])
    })

    const canPlay = computed(() => {
        const cost = currentMachine.value?.cost || 1
        return coins.value >= cost
    })

    const exhibitionCount = computed(() => exhibition.value.length)

    const winRate = computed(() => {
        if (stats.value.totalPlays === 0) return 0
        return Math.round((stats.value.totalCaught / stats.value.totalPlays) * 100)
    })

    // ============================================================
    // 持久化
    // ============================================================

    function loadData() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY)
            if (saved) {
                const data = JSON.parse(saved)
                coins.value = data.coins || 0
                exhibition.value = data.exhibition || []
                customDolls.value = data.customDolls || {}
                stats.value = { ...stats.value, ...(data.stats || {}) }
            }
        } catch (e) {
            console.error('[ClawMachineStore] loadData failed:', e)
        }
    }

    function saveData() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                coins: coins.value,
                exhibition: exhibition.value,
                customDolls: customDolls.value,
                stats: stats.value,
            }))
        } catch (e) {
            console.error('[ClawMachineStore] saveData failed:', e)
            // 配额溢出时裁剪展馆（只保留最近100个）
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                try {
                    const trimmed = exhibition.value.slice(0, 100)
                    localStorage.setItem(STORAGE_KEY, JSON.stringify({
                        coins: coins.value,
                        exhibition: trimmed,
                        customDolls: customDolls.value,
                        stats: stats.value,
                    }))
                    exhibition.value = trimmed
                } catch (e2) {
                    console.error('[ClawMachineStore] saveData failed even after trim:', e2)
                }
            }
        }
    }

    // ============================================================
    // 经济系统
    // ============================================================

    /**
     * 充值游戏币（从钱包余额扣除人民币）
     * @param {Object} pkg - 充值包 { coins, price, bonus }
     * @returns {Object} { success, message }
     */
    function rechargeCoins(pkg) {
        const walletStore = useWalletStore()
        const totalCoins = pkg.coins + (pkg.bonus || 0)

        // 从钱包扣人民币
        const success = walletStore.decreaseBalance(pkg.price, `娃娃机充值(${pkg.label})`)
        if (!success) {
            return { success: false, message: '钱包余额不足，请先充值零钱' }
        }

        // 加游戏币
        coins.value += totalCoins
        saveData()
        return { success: true, message: `充值成功！获得${totalCoins}游戏币` }
    }

    /**
     * 投币（消耗游戏币）
     * @returns {boolean} 是否投币成功
     */
    function insertCoin() {
        const cost = currentMachine.value?.cost || 1
        if (coins.value < cost) {
            return false
        }
        coins.value -= cost
        saveData()
        return true
    }

    // ============================================================
    // 角色邀请
    // ============================================================

    /**
     * 设置邀请的角色
     * @param {string} charId - 角色ID
     * @param {string} charName - 角色名
     */
    function setInvitedChar(charId, charName) {
        invitedCharId.value = charId
        invitedCharName.value = charName
    }

    /**
     * 获取邀请的角色完整对象
     * @returns {Object|null}
     */
    function getInvitedChar() {
        if (!invitedCharId.value) return null
        const chatStore = useChatStore()
        return chatStore.chats[invitedCharId.value] || null
    }

    // ============================================================
    // 自定义玩偶上传
    // ============================================================

    /**
     * 上传自定义玩偶图片（白底图自动抠像）
     * @param {string} machineId - 机器ID
     * @param {File} file - 图片文件
     * @returns {Promise<Object>} { success, message }
     */
    async function uploadCustomDoll(machineId, file) {
        try {
            // 1. 压缩图片
            const compressed = await compressImage(file, {
                maxWidth: 400,
                maxHeight: 400,
                quality: 0.8,
            })

            // 2. 白底图抠像
            const cutoutImage = await removeWhiteBackground(compressed, {
                threshold: 225,
                feather: 3,
                maxSize: 250,
            })

            // 3. 存储
            customDolls.value = { ...customDolls.value, [machineId]: cutoutImage }
            saveData()

            return { success: true, message: '自定义玩偶上传成功！已自动抠像' }
        } catch (e) {
            console.error('[ClawMachineStore] uploadCustomDoll failed:', e)
            return { success: false, message: '上传失败：' + e.message }
        }
    }

    /**
     * 获取某机器的自定义玩偶贴图
     */
    function getCustomDoll(machineId) {
        return customDolls.value[machineId] || null
    }

    // ============================================================
    // 游戏流程
    // ============================================================

    /**
     * 选择娃娃机
     */
    function selectMachine(machineId) {
        currentMachineId.value = machineId
        // 生成机内玩偶布局
        const dolls = getMachineDolls(machineId, customDolls.value[machineId])
        machineLayout.value = generateDollLayout(dolls, 14)
        // 重置爪子到顶部轨道（刚露出天花板下方，始终可见）
        clawX.value = 50
        clawY.value = 44
        clawState.value = 'idle'
        lastGrabResult.value = null
        gameChatMessages.value = []
    }

    /**
     * 开始游戏
     * @param {string} mode - 'self' | 'ai'
     * @returns {boolean} 是否成功开始
     */
    function startGame(mode) {
        if (!canPlay.value) return false
        if (!insertCoin()) return false

        playMode.value = mode
        controller.value = mode === 'ai' ? 'ai' : 'user'
        gamePhase.value = 'playing'
        clawState.value = 'idle'
        clawX.value = 50
        clawY.value = 44

        // 统计
        stats.value.totalPlays++
        if (mode === 'self') {
            stats.value.selfPlays++
        } else {
            stats.value.aiPlays++
        }
        saveData()

        return true
    }

    /**
     * 移动爪子（自己玩模式）
     * @param {string} direction - 'left' | 'right'
     * @param {number} step - 移动步长
     */
    function moveClaw(direction, step = 3) {
        if (clawState.value !== 'idle') return
        // 限制在玻璃罩水平范围内
        if (direction === 'left') {
            clawX.value = Math.max(22, clawX.value - step)
        } else if (direction === 'right') {
            clawX.value = Math.min(78, clawX.value + step)
        }
    }

    /**
     * 下勾（自己玩模式）
     * @returns {Object} 抓取结果
     */
    function dropClaw() {
        // 注意：handleDrop 在调用前会把状态设为 'dropping'，因此不能在这里拦截非 idle。
        // 仅防止抓取/上升阶段重复调用导致重复结算。
        if (clawState.value === 'grabbing' || clawState.value === 'rising') return null

        const cost = currentMachine.value?.cost || 1
        const baseRate = 0.3 + (cost - 1) * 0.05 // 贵的机子基础概率略高

        const result = resolveGrab({
            layout: machineLayout.value,
            clawX: clawX.value,
            clawY: 78,
            mode: 'self',
            baseRate,
        })

        lastGrabResult.value = result

        if (result.success && result.doll) {
            // 抓中
            addToExhibition(result.doll, 'user')
            stats.value.totalCaught++
            stats.value.selfCaught++
        }

        saveData()
        return result
    }

    /**
     * AI 执行游玩操作
     * @param {Object} options - { aiSkill, baseRate }
     * @returns {Object} { steps, result, finalX }
     */
    function performAIPlay(options = {}) {
        const aiSkill = options.aiSkill ?? 0.5
        const cost = currentMachine.value?.cost || 1
        const baseRate = 0.25 + (cost - 1) * 0.05

        // 找一个有玩偶的目标位置
        const targetDoll = machineLayout.value[Math.floor(Math.random() * machineLayout.value.length)]
        const targetX = targetDoll?.x || 50

        const { steps, result, finalX } = executeAIPlay({
            layout: machineLayout.value,
            startX: clawX.value,
            targetX,
            aiSkill,
            baseRate,
        })

        lastGrabResult.value = result

        if (result.success && result.doll) {
            addToExhibition(result.doll, 'ai')
            stats.value.totalCaught++
            stats.value.aiCaught++
        }

        saveData()
        return { steps, result, finalX }
    }

    /**
     * 设置爪子位置（AI 操作动画用）
     */
    function setClawPosition(x, y) {
        clawX.value = x
        if (y !== undefined) clawY.value = y
    }

    /**
     * 设置爪子状态
     */
    function setClawState(state) {
        clawState.value = state
    }

    // ============================================================
    // AI 聊天交互
    // ============================================================

    /**
     * AI 角色开场白
     * @returns {Promise<string>}
     */
    async function fetchAIOpening() {
        const chat = getInvitedChar()
        if (!chat) return ''

        const settingsStore = useSettingsStore()
        aiThinking.value = true
        abortController = new AbortController()

        try {
            const text = await generateAIOpening(
                chat,
                settingsStore,
                {
                    machineName: currentMachine.value?.name || '娃娃机',
                    machineIcon: currentMachine.value?.icon || '🎮',
                },
                abortController.signal,
            )
            if (text) {
                addGameChatMessage('ai', text)
            }
            return text
        } catch (e) {
            console.error('[ClawMachineStore] fetchAIOpening failed:', e)
            return ''
        } finally {
            aiThinking.value = false
        }
    }

    /**
     * AI 角色对抓取结果的反应
     * @returns {Promise<string>}
     */
    async function fetchAIReaction() {
        const chat = getInvitedChar()
        if (!chat) return ''

        const settingsStore = useSettingsStore()
        aiThinking.value = true
        abortController = new AbortController()

        try {
            const text = await generateAIReaction(
                chat,
                settingsStore,
                {
                    machineName: currentMachine.value?.name || '娃娃机',
                    dollName: lastGrabResult.value?.doll?.name || '玩偶',
                    result: lastGrabResult.value?.success ? 'success' : 'fail',
                },
                abortController.signal,
            )
            if (text) {
                addGameChatMessage('ai', text)
            }
            return text
        } catch (e) {
            console.error('[ClawMachineStore] fetchAIReaction failed:', e)
            return ''
        } finally {
            aiThinking.value = false
        }
    }

    /**
     * 发送游玩中聊天消息
     * @param {string} message - 用户消息
     * @param {Function} onChunk - 流式回调
     * @returns {Promise<string>}
     */
    async function sendGameChat(message, onChunk) {
        if (!message.trim()) return ''

        // 添加用户消息
        addGameChatMessage('user', message)

        const chat = getInvitedChar()
        if (!chat) return ''

        const settingsStore = useSettingsStore()
        aiThinking.value = true
        abortController = new AbortController()

        try {
            const text = await generateGameChat(
                chat,
                settingsStore,
                {
                    machineName: currentMachine.value?.name || '娃娃机',
                    userMessage: message,
                    onChunk,
                },
                abortController.signal,
            )
            if (text) {
                addGameChatMessage('ai', text)
            }
            return text
        } catch (e) {
            console.error('[ClawMachineStore] sendGameChat failed:', e)
            return ''
        } finally {
            aiThinking.value = false
        }
    }

    /**
     * 添加游玩聊天消息
     */
    function addGameChatMessage(role, content) {
        gameChatMessages.value.push({
            id: `gc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            role,
            content,
            timestamp: Date.now(),
        })
    }

    /**
     * 取消 AI 调用
     */
    function cancelAI() {
        if (abortController) {
            abortController.abort()
            abortController = null
        }
        aiThinking.value = false
    }

    // ============================================================
    // 抢夺操控权
    // ============================================================

    /**
     * 切换操控者
     */
    function switchController() {
        controller.value = controller.value === 'user' ? 'ai' : 'user'
        playMode.value = controller.value === 'ai' ? 'ai' : 'self'
    }

    /**
     * 设置操控者
     */
    function setController(who) {
        controller.value = who
        playMode.value = who === 'ai' ? 'ai' : 'self'
    }

    // ============================================================
    // 展馆管理
    // ============================================================

    /**
     * 添加抓到的玩偶到展馆
     * @param {Object} doll - 玩偶对象
     * @param {string} caughtBy - 'user' | 'ai'
     */
    function addToExhibition(doll, caughtBy) {
        // 自动分配展馆位置（网格布局，避免重叠）
        const count = exhibition.value.length
        const cols = 4
        const col = count % cols
        const row = Math.floor(count / cols)
        const spacing = 22

        exhibition.value.push({
            id: `exhibit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            machineId: currentMachineId.value,
            machineName: currentMachine.value?.name || '',
            dollId: doll.dollId || doll.id,
            dollName: doll.name,
            dollImage: doll.image,
            caughtAt: Date.now(),
            caughtBy,
            charId: invitedCharId.value,
            charName: invitedCharName.value,
            position: {
                x: 12 + col * spacing,
                y: 15 + row * spacing,
            },
        })
        saveData()
    }

    /**
     * 从展馆移除
     */
    function removeFromExhibition(itemId) {
        exhibition.value = exhibition.value.filter(e => e.id !== itemId)
        saveData()
    }

    /**
     * 更新展馆摆放位置
     * @param {string} itemId - 展品ID
     * @param {Object} position - { x, y }
     */
    function updateExhibitPosition(itemId, position) {
        const item = exhibition.value.find(e => e.id === itemId)
        if (item) {
            item.position = position
            saveData()
        }
    }

    /**
     * 清空展馆
     */
    function clearExhibition() {
        exhibition.value = []
        saveData()
    }

    // ============================================================
    // 游戏重置
    // ============================================================

    /**
     * 重置当前游戏会话（保留币和展馆）
     */
    function resetSession() {
        cancelAI()
        currentMachineId.value = null
        gamePhase.value = 'idle'
        playMode.value = null
        controller.value = 'user'
        clawX.value = 50
        clawY.value = 44
        clawState.value = 'idle'
        machineLayout.value = []
        lastGrabResult.value = null
        gameChatMessages.value = []
    }

    /**
     * 重新开始（同一机子，重新布局）
     */
    function replay() {
        cancelAI()
        if (currentMachineId.value) {
            selectMachine(currentMachineId.value)
        }
        gamePhase.value = 'modeSelect'
        playMode.value = null
        controller.value = 'user'
        clawState.value = 'idle'
        lastGrabResult.value = null
    }

    // ============================================================
    // 初始化
    // ============================================================

    loadData()

    // ============================================================
    // 导出
    // ============================================================
    return {
        // 状态
        coins,
        exhibition,
        customDolls,
        invitedCharId,
        invitedCharName,
        currentMachineId,
        gamePhase,
        playMode,
        controller,
        clawX,
        clawY,
        clawState,
        machineLayout,
        lastGrabResult,
        gameChatMessages,
        stats,
        aiThinking,
        rechargePackages,
        // 计算属性
        currentMachine,
        currentDolls,
        canPlay,
        exhibitionCount,
        winRate,
        // 经济系统
        rechargeCoins,
        insertCoin,
        // 角色邀请
        setInvitedChar,
        getInvitedChar,
        // 自定义玩偶
        uploadCustomDoll,
        getCustomDoll,
        // 游戏流程
        selectMachine,
        startGame,
        moveClaw,
        dropClaw,
        performAIPlay,
        setClawPosition,
        setClawState,
        // AI 交互
        fetchAIOpening,
        fetchAIReaction,
        sendGameChat,
        addGameChatMessage,
        cancelAI,
        // 操控权
        switchController,
        setController,
        // 展馆
        addToExhibition,
        removeFromExhibition,
        updateExhibitPosition,
        clearExhibition,
        // 游戏控制
        resetSession,
        replay,
        // 数据
        MACHINES,
    }
})
