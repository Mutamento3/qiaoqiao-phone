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
    initStock,
    getAvailableDolls,
    deductStock,
    restock,
    getClawParams,
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
const CHAT_HISTORY_KEY = 'claw_machine_chat_history'
const STOCK_KEY = 'claw_machine_stock'
const LAST_RESTOCK_KEY = 'claw_machine_last_restock'

export const useClawMachineStore = defineStore('clawMachine', () => {
    // ============================================================
    // 状态
    // ============================================================

    // 游戏币
    const coins = ref(0)

    // 展馆：抓到的玩偶列表
    // { id, machineId, machineName, dollId, dollName, dollImage, caughtAt, caughtBy, charId, charName, position: {x, y} }
    const exhibition = ref([])
    // 仓库库存：每一只被抓到的娃娃都会进入仓库（即使未摆上书桌），可随时再摆放
    const warehouse = ref([])

    // 展馆背景：预设书桌 + 自定义上传
    const EXHIBITION_BACKGROUNDS = [
        { id: 'desk-clean', name: '原木书桌', image: '/claw-machine-assets/exhibition-bg/desk-clean.svg' },
        { id: 'desk-empty', name: '简约书桌', image: '/claw-machine-assets/exhibition-bg/desk-empty.svg' },
        { id: 'desk-sky', name: '天蓝窗景', image: '/claw-machine-assets/exhibition-bg/desk-sky.svg' },
        { id: 'desk-wood', name: '深木书房', image: '/claw-machine-assets/exhibition-bg/desk-wood.svg' },
        { id: 'desk-night', name: '夜景窗台', image: '/claw-machine-assets/exhibition-bg/desk-night.svg' },
        { id: 'desk-soft', name: '软绵卧室', image: '/claw-machine-assets/exhibition-bg/desk-soft.svg' },
    ]
    const exhibitionBgId = ref(EXHIBITION_BACKGROUNDS[0].id)
    const exhibitionCustomBg = ref(null) // data URL

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
    const clawY = ref(5) // 0-100（顶部为0），静止位在机台可见区域顶部
    const clawState = ref('idle') // idle | moving | dropping | grabbing | rising | result

    // 机内玩偶布局
    const machineLayout = ref([])

    // 本次抓取结果
    const lastGrabResult = ref(null) // { success, doll, probability, alignment }

    // 游玩中聊天：当前会话显示列表（历史 + 当局）
    const gameChatMessages = ref([]) // { id, role: 'user'|'ai'|'system', content, timestamp }

    // 娃娃机聊天记录历史（按角色分组，持久化）
    // { charId: [{ id, role, content, timestamp, machineName?, dollName? }] }
    const chatHistory = ref({})

    // 机台库存：每个机器每个玩偶剩余数量，每日 0 点补货
    // { machineId: { dollId: count } }
    const machineStock = ref({})

    // 统计
    const stats = ref({
        totalPlays: 0,
        totalCaught: 0,
        selfPlays: 0,
        aiPlays: 0,
        selfCaught: 0,
        aiCaught: 0,
    })

    // 音效 / BGM 开关（持久化）
    const soundEnabled = ref(true)
    const bgmEnabled = ref(true)
    const sfxVolume = ref(0.8)
    const bgmVolume = ref(0.45)

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

    const currentExhibitionBg = computed(() => {
        if (exhibitionBgId.value === 'custom' && exhibitionCustomBg.value) {
            return exhibitionCustomBg.value
        }
        const found = EXHIBITION_BACKGROUNDS.find(b => b.id === exhibitionBgId.value)
        return found ? found.image : EXHIBITION_BACKGROUNDS[0].image
    })

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
                warehouse.value = data.warehouse || []
                customDolls.value = data.customDolls || {}
                stats.value = { ...stats.value, ...(data.stats || {}) }
                exhibitionBgId.value = EXHIBITION_BACKGROUNDS.find(b => b.id === data.exhibitionBgId)?.id || EXHIBITION_BACKGROUNDS[0].id
                exhibitionCustomBg.value = data.exhibitionCustomBg || null
                if (typeof data.soundEnabled === 'boolean') soundEnabled.value = data.soundEnabled
                if (typeof data.bgmEnabled === 'boolean') bgmEnabled.value = data.bgmEnabled
                if (typeof data.sfxVolume === 'number') sfxVolume.value = data.sfxVolume
                if (typeof data.bgmVolume === 'number') bgmVolume.value = data.bgmVolume
            }
        } catch (e) {
            console.error('[ClawMachineStore] loadData failed:', e)
        }
        loadChatHistory()
        loadStock()
    }

    function saveData() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                coins: coins.value,
                exhibition: exhibition.value,
                warehouse: warehouse.value,
                customDolls: customDolls.value,
                stats: stats.value,
                exhibitionBgId: exhibitionBgId.value,
                exhibitionCustomBg: exhibitionCustomBg.value,
                soundEnabled: soundEnabled.value,
                bgmEnabled: bgmEnabled.value,
                sfxVolume: sfxVolume.value,
                bgmVolume: bgmVolume.value,
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
                        exhibitionBgId: exhibitionBgId.value,
                        exhibitionCustomBg: exhibitionCustomBg.value,
                        soundEnabled: soundEnabled.value,
                        bgmEnabled: bgmEnabled.value,
                        sfxVolume: sfxVolume.value,
                        bgmVolume: bgmVolume.value,
                    }))
                    exhibition.value = trimmed
                } catch (e2) {
                    console.error('[ClawMachineStore] saveData failed even after trim:', e2)
                }
            }
        }
        saveChatHistory()
        saveStock()
    }

    // ============================================================
    // 聊天记录持久化
    // ============================================================

    function loadChatHistory() {
        try {
            const saved = localStorage.getItem(CHAT_HISTORY_KEY)
            if (saved) chatHistory.value = JSON.parse(saved)
        } catch (e) {
            console.error('[ClawMachineStore] loadChatHistory failed:', e)
        }
    }

    function saveChatHistory() {
        try {
            localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chatHistory.value))
        } catch (e) {
            console.error('[ClawMachineStore] saveChatHistory failed:', e)
            // 超限时按角色裁剪，只保留最近 200 条
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                const trimmed = {}
                Object.keys(chatHistory.value).forEach(charId => {
                    trimmed[charId] = chatHistory.value[charId].slice(-200)
                })
                try {
                    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(trimmed))
                    chatHistory.value = trimmed
                } catch (e2) {
                    console.error('[ClawMachineStore] saveChatHistory trim failed:', e2)
                }
            }
        }
    }

    // ============================================================
    // 机台库存与补货
    // ============================================================

    function loadStock() {
        try {
            const saved = localStorage.getItem(STOCK_KEY)
            const lastRestock = localStorage.getItem(LAST_RESTOCK_KEY)
            const today = new Date().toDateString()
            if (saved) machineStock.value = JSON.parse(saved)
            // 每日 0 点补货
            if (lastRestock !== today) {
                restockAllMachines()
                localStorage.setItem(LAST_RESTOCK_KEY, today)
            }
        } catch (e) {
            console.error('[ClawMachineStore] loadStock failed:', e)
        }
    }

    function saveStock() {
        try {
            localStorage.setItem(STOCK_KEY, JSON.stringify(machineStock.value))
        } catch (e) {
            console.error('[ClawMachineStore] saveStock failed:', e)
        }
    }

    function restockAllMachines() {
        MACHINES.forEach(machine => {
            const dolls = getMachineDolls(machine.id, customDolls.value[machine.id])
            if (!machineStock.value[machine.id]) {
                machineStock.value[machine.id] = initStock(machine, dolls, 2)
            } else {
                restock(machineStock.value[machine.id], dolls, 2)
            }
        })
    }

    function ensureMachineStock(machineId) {
        if (!machineStock.value[machineId]) {
            const machine = getMachine(machineId)
            const dolls = getMachineDolls(machineId, customDolls.value[machineId])
            machineStock.value[machineId] = initStock(machine, dolls, 2)
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

    /**
     * 退币（模式选择取消时退回）
     */
    function refundCoin() {
        const cost = currentMachine.value?.cost || 1
        coins.value += cost
        saveData()
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
     * 选择娃娃机，直接进入机台预览（不再先跳充值页）
     */
    function selectMachine(machineId) {
        currentMachineId.value = machineId
        ensureMachineStock(machineId)
        const machine = getMachine(machineId)
        const dolls = getMachineDolls(machineId, customDolls.value[machineId])
        const available = getAvailableDolls(dolls, machineStock.value[machineId])
        // 按实际库存数量展开玩偶池，并洗牌，确保不超出真实库存
        const stock = machineStock.value[machineId]
        const pool = []
        available.forEach(doll => {
            const count = stock[doll.id] || 0
            for (let i = 0; i < count; i++) pool.push(doll)
        })
        // Fisher-Yates 洗牌
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[pool[i], pool[j]] = [pool[j], pool[i]]
        }
        // 生成机内玩偶布局（根据该机台格挡参数）
        machineLayout.value = generateDollLayout(machine, pool, 10)
        // 重置爪子到机台可见区域顶部
        const clawParams = getClawParams(machine)
        clawX.value = 50
        clawY.value = clawParams.clawTopY
        clawState.value = 'idle'
        lastGrabResult.value = null
        // 聊天记录不随机器切换清空，保持与当前角色在该游戏的全局历史
        loadSessionChatMessages()
        gamePhase.value = 'playing'
        playMode.value = null
        controller.value = 'user'
    }

    /**
     * 加载当前角色在娃娃机中的历史聊天记录到当前会话
     */
    function loadSessionChatMessages() {
        const charId = invitedCharId.value || '_solo'
        const history = chatHistory.value[charId] || []
        gameChatMessages.value = history.map(m => ({ ...m }))
    }

    /**
     * 将当前会话消息同步回历史记录
     */
    function syncChatHistory() {
        const charId = invitedCharId.value || '_solo'
        if (!chatHistory.value[charId]) chatHistory.value[charId] = []
        // 以当前会话为准，去重后写入
        const seen = new Set()
        const merged = []
        gameChatMessages.value.forEach(m => {
            if (!seen.has(m.id)) {
                seen.add(m.id)
                merged.push(m)
            }
        })
        chatHistory.value[charId] = merged
        saveChatHistory()
    }

    /**
     * 开始游戏
     * @param {string} mode - 'self' | 'ai'
     * @param {Object} opts - { alreadyInserted?: boolean }
     * @returns {boolean} 是否成功开始
     */
    function startGame(mode, opts = {}) {
        if (!canPlay.value) return false
        if (!opts.alreadyInserted && !insertCoin()) return false

        playMode.value = mode
        controller.value = mode === 'ai' ? 'ai' : 'user'
        gamePhase.value = 'playing'
        clawState.value = 'idle'
        clawX.value = 50
        const machine = currentMachine.value
        const clawParams = getClawParams(machine)
        clawY.value = clawParams.clawTopY

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
        const machine = currentMachine.value
        const clawParams = getClawParams(machine)

        const result = resolveGrab({
            layout: machineLayout.value,
            clawX: clawX.value,
            clawY: clawParams.clawDropY,
            mode: 'self',
            baseRate,
        })

        lastGrabResult.value = result

        if (result.success && result.doll) {
            // 抓中：加入展馆、移除机内布局与库存、记录收获
            addToExhibition(result.doll, 'user')
            addToWarehouse(result.doll, 'user')
            removeDollFromMachine(result.doll)
            recordCatchToChat(result.doll, 'user')
            stats.value.totalCaught++
            stats.value.selfCaught++
        }

        saveData()
        return result
    }

    /**
     * 从当前机台移除被抓中的玩偶（布局 + 库存）
     */
    function removeDollFromMachine(doll) {
        // 移除布局中对应的玩偶
        machineLayout.value = machineLayout.value.filter(d => d.layoutId !== doll.layoutId)
        // 扣减库存
        if (currentMachineId.value && machineStock.value[currentMachineId.value]) {
            deductStock(machineStock.value[currentMachineId.value], doll.dollId || doll.id)
        }
    }

    /**
     * 将抓娃娃收获记录进娃娃机聊天记录
     */
    function recordCatchToChat(doll, caughtBy) {
        const machineName = currentMachine.value?.name || '娃娃机'
        const charName = invitedCharName.value || 'TA'
        const who = caughtBy === 'user' ? '我' : charName
        addGameChatMessage('system', `🎁 ${who} 在【${machineName}】抓到了「${doll.name}」！`, {
            machineName,
            dollName: doll.name,
            caughtBy,
        })
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
        const machine = currentMachine.value
        const clawParams = getClawParams(machine)

        // 找一个有玩偶的目标位置
        const targetDoll = machineLayout.value[Math.floor(Math.random() * machineLayout.value.length)]
        const targetX = targetDoll?.x || 50

        const { steps, result, finalX } = executeAIPlay({
            layout: machineLayout.value,
            startX: clawX.value,
            targetX,
            aiSkill,
            baseRate,
            clawDropY: clawParams.clawDropY,
        })

        lastGrabResult.value = result

        if (result.success && result.doll) {
            addToExhibition(result.doll, 'ai')
            addToWarehouse(result.doll, 'ai')
            removeDollFromMachine(result.doll)
            recordCatchToChat(result.doll, 'ai')
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
                    history: gameChatMessages.value.slice(-8),
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
     * @param {string} caughtBy - 'user' | 'ai' 谁抓的（决定角色说"你"还是"我"）
     * @returns {Promise<string>}
     */
    async function fetchAIReaction(caughtBy = 'user') {
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
                    caughtBy,
                    history: gameChatMessages.value.slice(-8),
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
                    history: gameChatMessages.value.slice(-8),
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
    function addGameChatMessage(role, content, extra = {}) {
        const msg = {
            id: `gc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            role,
            content,
            timestamp: Date.now(),
            ...extra,
        }
        gameChatMessages.value.push(msg)
        syncChatHistory()
        return msg
    }

    /**
     * 将本局抓取结果以用户视角发送到角色微信聊天（不自动触发 AI 回复）
     * 抓到 / 没抓到都会发，带娃娃图
     * @returns {Promise<boolean>}
     */
    async function shareResultToChat() {
        const targetId = invitedCharId.value || 'user'
        const isSelf = !invitedCharId.value
        // 确保目标聊天存在（首次分享时聊天可能尚未创建）
        let chat = chatStore.chats[targetId]
        if (!chat) {
            if (isSelf) {
                chat = chatStore.ensureUserSelfChat()
            } else {
                chat = chatStore.createChat(invitedCharName.value || 'TA', { id: targetId })
            }
        }
        if (!chat) return false
        const result = lastGrabResult.value
        if (!result) return false

        const isSuccess = result.success && result.doll
        const doll = result.doll || {}
        const machineName = currentMachine.value?.name || '娃娃机'
        const timestamp = Date.now()
        const timeStr = new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

        const dollImageHtml = isSuccess && doll.image
            ? `<img src="${doll.image}" style="width: 80px; height: 80px; object-fit: contain; margin: 8px auto; display: block; filter: drop-shadow(0 6px 10px rgba(14,165,233,0.25));" />`
            : ''

        const htmlContent = `
<div style="background: linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 100%); border-radius: 16px; border: 1px solid rgba(56,189,248,0.25); padding: 14px; font-family: system-ui; box-shadow: 0 4px 16px rgba(56,189,248,0.12); overflow: hidden;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <span style="font-weight: 800; color: #0ea5e9; font-size: 14px;">🎮 娃娃机战报</span>
        <span style="font-size: 10px; color: #0ea5e999;">${timeStr}</span>
    </div>
    <div style="background: white; border-radius: 12px; padding: 12px; text-align: center; border: 1px solid rgba(56,189,248,0.1);">
        <div style="font-size: 18px; font-weight: 900; color: ${isSuccess ? '#0ea5e9' : '#9ca3af'}; margin-bottom: 6px;">
            ${isSuccess ? '✨ 抓到了！' : '💨 没抓到…'}
        </div>
        ${dollImageHtml}
        <div style="font-size: 13px; color: #4b5563; font-weight: 600;">${isSuccess ? doll.name : '差一点点'}</div>
        <div style="font-size: 10px; color: #9ca3af; margin-top: 4px;">来自 ${machineName}</div>
    </div>
    ${isSuccess ? '<div style="margin-top: 8px; font-size: 10px; color: #0ea5e9; text-align: center;">已收入展馆，快去看看吧~</div>' : ''}
</div>
`.trim()

        try {
            const msg = {
                role: 'user',
                content: `[CARD]${htmlContent}[/CARD]`,
                timestamp,
                skipAI: true,
            }
            const added = await chatStore.addMessage(targetId, msg)
            return !!added
        } catch (e) {
            console.error('[ClawMachineStore] shareResultToChat failed:', e)
            return false
        }
    }

    /**
     * 本局结束后自动把结算卡片分享给角色（抓到 / 没抓到都会发）
     */
    async function autoShareResultToChat() {
        return shareResultToChat()
    }

    /**
     * 开始游玩时向角色聊天发送系统通知：正在一起玩抓娃娃
     */
    async function sendStartNotificationToChat() {
        const targetId = invitedCharId.value || 'user'
        const isSelf = !invitedCharId.value
        let chat = chatStore.chats[targetId]
        if (!chat) {
            if (isSelf) {
                chat = chatStore.ensureUserSelfChat()
            } else {
                chat = chatStore.createChat(invitedCharName.value || 'TA', { id: targetId })
            }
        }
        if (!chat) return false

        const settingsStore = useSettingsStore()
        const userName = settingsStore.personalization?.userProfile?.name || '我'
        const timestamp = Date.now()
        const formattedTime = new Date(timestamp).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        })

        try {
            await chatStore.addMessage(targetId, {
                role: 'system',
                content: `${userName}正在与你一起玩抓娃娃 [TIMESTAMP:${formattedTime}]`,
                timestamp,
                skipAI: true,
            })
            return true
        } catch (e) {
            console.error('[ClawMachineStore] sendStartNotificationToChat failed:', e)
            return false
        }
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
    function addToExhibition(doll, caughtBy, fromWarehouseId = null) {
        // 自动分配展馆位置（网格布局，避免重叠）
        const count = exhibition.value.length
        const cols = 4
        const col = count % cols
        const row = Math.floor(count / cols)
        const spacing = 22

        exhibition.value.push({
            id: `exhibit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            warehouseId: fromWarehouseId,
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
     * 抓到娃娃：登记进仓库库存（每只独立一条，可重复抓到不同记录）
     */
    function addToWarehouse(doll, caughtBy) {
        warehouse.value.push({
            id: `wh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            machineId: currentMachineId.value,
            machineName: currentMachine.value?.name || '',
            dollId: doll.dollId || doll.id,
            dollName: doll.name,
            dollImage: doll.image,
            caughtAt: Date.now(),
            caughtBy,
            charId: invitedCharId.value,
            charName: invitedCharName.value,
        })
        saveData()
    }

    /**
     * 从仓库把某只娃娃摆到书桌上（若已在桌面则忽略）
     */
    function placeFromWarehouse(whItem) {
        const already = exhibition.value.some(e => e.warehouseId === whItem.id)
        if (already) return
        exhibition.value.push({
            id: `exhibit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            warehouseId: whItem.id,
            machineId: whItem.machineId,
            machineName: whItem.machineName,
            dollId: whItem.dollId,
            dollName: whItem.dollName,
            dollImage: whItem.dollImage,
            caughtAt: whItem.caughtAt,
            caughtBy: whItem.caughtBy,
            charId: whItem.charId,
            charName: whItem.charName,
            position: {
                x: 14 + Math.random() * 60,
                y: 16 + Math.random() * 52,
            },
        })
        saveData()
    }

    // 仓库中尚未摆上书桌的娃娃
    const availableWarehouse = computed(() =>
        warehouse.value.filter(w => !exhibition.value.some(e => e.warehouseId === w.id)),
    )


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

    /**
     * 切换展馆背景
     */
    function setExhibitionBg(bgId) {
        exhibitionBgId.value = bgId
        saveData()
    }

    /**
     * 上传自定义展馆背景
     */
    async function uploadExhibitionBg(file) {
        try {
            const compressed = await compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.85 })
            exhibitionCustomBg.value = compressed
            exhibitionBgId.value = 'custom'
            saveData()
            return { success: true, message: '自定义背景上传成功' }
        } catch (e) {
            console.error('[ClawMachineStore] uploadExhibitionBg failed:', e)
            return { success: false, message: '上传失败：' + e.message }
        }
    }

    // ============================================================
    // 游戏重置
    // ============================================================

    /**
     * 重置当前游戏会话（保留币、展馆、聊天记录）
     */
    function resetSession() {
        cancelAI()
        currentMachineId.value = null
        gamePhase.value = 'idle'
        playMode.value = null
        controller.value = 'user'
        clawX.value = 50
        clawY.value = 5
        clawState.value = 'idle'
        machineLayout.value = []
        lastGrabResult.value = null
        // 聊天记录不清空，只恢复为历史记录
        loadSessionChatMessages()
    }

    /**
     * 重新开始（同一机子，重新布局，回到未投币的机台预览）
     */
    function replay() {
        cancelAI()
        if (currentMachineId.value) {
            selectMachine(currentMachineId.value)
        }
        gamePhase.value = 'playing'
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
        exhibitionBgId,
        exhibitionCustomBg,
        EXHIBITION_BACKGROUNDS,
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
        chatHistory,
        machineStock,
        stats,
        aiThinking,
        rechargePackages,
        soundEnabled,
        bgmEnabled,
        sfxVolume,
        bgmVolume,
        // 计算属性
        currentMachine,
        currentDolls,
        canPlay,
        exhibitionCount,
        currentExhibitionBg,
        winRate,
        // 经济系统
        rechargeCoins,
        insertCoin,
        refundCoin,
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
        shareResultToChat,
        autoShareResultToChat,
        sendStartNotificationToChat,
        cancelAI,
        // 操控权
        switchController,
        setController,
        // 展馆
        addToExhibition,
        removeFromExhibition,
        updateExhibitPosition,
        clearExhibition,
        // 仓库
        warehouse,
        availableWarehouse,
        addToWarehouse,
        placeFromWarehouse,
        setExhibitionBg,
        uploadExhibitionBg,
        // 游戏控制
        resetSession,
        replay,
        // 数据
        MACHINES,
    }
})
