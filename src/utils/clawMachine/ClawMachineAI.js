/**
 * 娃娃机 AI 控制逻辑
 * 负责"让TA玩"模式的 AI 角色操作模拟 + API 调用
 *
 * 设计要点（受公益站 3次/分钟 限流约束）：
 * - AI 操作过程（移动+下勾）用前端代码模拟，不调 API
 * - 仅在关键节点调 API：① 开始游玩时角色开场白 ② 抓取结果后角色反应 ③ 用户主动聊天
 * - 每次 API 调用注入：角色人设、用户人设、记忆总结、最近20轮聊天记录、游玩输出格式
 */

import { generateReply } from '../aiService.js'
import { getLastNTurns } from '../common.js'
import { simulateAIOperation, resolveGrab } from './ClawMachineEngine.js'

/**
 * 构建游玩系统提示词
 * @param {Object} char - 角色对象（来自 chatStore）
 * @param {Object} gameContext - 游戏上下文
 * @returns {string} 系统提示词
 */
function buildGameSystemPrompt(char, gameContext) {
    const {
        machineName,
        dollName,
        result, // 'start' | 'success' | 'fail'
        userMessage, // 用户在游玩中发的消息
    } = gameContext

    let scenario = ''

    if (result === 'start') {
        scenario = `你正在和${char.userName || '对方'}一起玩娃娃机（${machineName}）。
你们刚刚投币准备开始，现在由你来操控娃娃机。
请用你的性格说一句开场白，表达你对玩娃娃机的态度或期待。`
    } else if (result === 'success') {
        scenario = `你刚刚在娃娃机（${machineName}）里抓到了「${dollName}」！
请用你的性格表达抓到玩偶的反应，可以开心、得意、炫耀等。`
    } else if (result === 'fail') {
        scenario = `你刚刚在娃娃机（${machineName}）里尝试抓「${dollName}」，但是没抓到。
请用你的性格表达没抓到的反应，可以失落、不甘心、安慰自己等。`
    }

    if (userMessage) {
        scenario += `\n\n${char.userName || '对方'}刚才对你说：「${userMessage}」\n请同时回应TA的话。`
    }

    return scenario
}

/**
 * 构建 generateReply 所需的 char 对象
 * @param {Object} chat - chatStore 中的角色 chat 对象
 * @param {Object} settings - settingsStore
 * @returns {Object} charInfo 传给 generateReply
 */
function buildCharInfo(chat, settings) {
    return {
        id: chat.id,
        name: chat.name || '角色',
        gender: chat.gender || chat.bio?.gender || '未知',
        description: (chat.prompt || '') + (chat.momentsAwareness || ''),
        memory: chat.memory || [],
        msgs: chat.msgs || [],
        userName: chat.userName || settings?.userName || '用户',
        userGender: chat.userGender || settings?.userGender || '未知',
        userPersona: chat.userPersona || '',
        userAvatarUrl: chat.userAvatar,
        avatarUrl: chat.avatar,
        bio: chat.bio || {},
        worldBookLinks: chat.worldBookLinks || [],
        emojis: chat.emojis || [],
        canDraw: false, // 游玩中不生图
        searchEnabled: false,
    }
}

/**
 * 让 AI 角色在游玩开始时说开场白
 * @param {Object} chat - 角色对象
 * @param {Object} settings - 设置
 * @param {Object} gameContext - 游戏上下文 { machineName, machineIcon }
 * @param {AbortSignal} signal - 取消信号
 * @returns {Promise<string>} AI 角色的开场白
 */
export async function generateAIOpening(chat, settings, gameContext, signal) {
    const charInfo = buildCharInfo(chat, settings)

    // 获取最近20轮聊天记录
    const recentMsgs = getLastNTurns(chat.msgs || [], 20).map(m => ({
        role: m.role === 'ai' || m.role === 'assistant' ? 'assistant' : (m.role === 'system' ? 'system' : 'user'),
        content: typeof m.content === 'string' ? m.content : '[非文本消息]',
    }))

    const systemPrompt = buildGameSystemPrompt(chat, {
        ...gameContext,
        result: 'start',
    })

    // 不设 skipContext，让 aiService 自动注入角色人设、用户人设、记忆、聊天记录
    const messages = [
        ...recentMsgs,
        { role: 'user', content: systemPrompt },
    ]

    try {
        const result = await generateReply(messages, charInfo, signal, {
            stream: false,
        })
        return typeof result === 'string' ? result : (result?.content || result?.text || '')
    } catch (e) {
        console.error('[ClawMachineAI] generateAIOpening failed:', e)
        return getDefaultOpening(chat, gameContext)
    }
}

/**
 * 让 AI 角色对抓取结果做出反应
 * @param {Object} chat - 角色对象
 * @param {Object} settings - 设置
 * @param {Object} gameContext - { machineName, dollName, result: 'success'|'fail', userMessage? }
 * @param {AbortSignal} signal
 * @returns {Promise<string>} AI 角色的反应
 */
export async function generateAIReaction(chat, settings, gameContext, signal) {
    const charInfo = buildCharInfo(chat, settings)

    const recentMsgs = getLastNTurns(chat.msgs || [], 20).map(m => ({
        role: m.role === 'ai' || m.role === 'assistant' ? 'assistant' : (m.role === 'system' ? 'system' : 'user'),
        content: typeof m.content === 'string' ? m.content : '[非文本消息]',
    }))

    const systemPrompt = buildGameSystemPrompt(chat, gameContext)

    const messages = [
        ...recentMsgs,
        { role: 'user', content: systemPrompt },
    ]

    try {
        const result = await generateReply(messages, charInfo, signal, {
            stream: false,
        })
        return typeof result === 'string' ? result : (result?.content || result?.text || '')
    } catch (e) {
        console.error('[ClawMachineAI] generateAIReaction failed:', e)
        return getDefaultReaction(chat, gameContext)
    }
}

/**
 * 让 AI 角色在游玩中回复用户聊天
 * @param {Object} chat - 角色对象
 * @param {Object} settings - 设置
 * @param {Object} gameContext - { machineName, userMessage }
 * @param {AbortSignal} signal
 * @returns {Promise<string>} AI 回复
 */
export async function generateGameChat(chat, settings, gameContext, signal) {
    const charInfo = buildCharInfo(chat, settings)

    const recentMsgs = getLastNTurns(chat.msgs || [], 20).map(m => ({
        role: m.role === 'ai' || m.role === 'assistant' ? 'assistant' : (m.role === 'system' ? 'system' : 'user'),
        content: typeof m.content === 'string' ? m.content : '[非文本消息]',
    }))

    const systemPrompt = `你正在和${chat.userName || '对方'}一起玩娃娃机（${gameContext.machineName}）。
请以你的性格回应TA的话，可以聊和娃娃机、玩偶相关的话题，也可以聊别的。
保持自然、简短、口语化。`

    const messages = [
        ...recentMsgs,
        { role: 'user', content: `${systemPrompt}\n\n${chat.userName || '对方'}：「${gameContext.userMessage}」` },
    ]

    try {
        const result = await generateReply(messages, charInfo, signal, {
            stream: true,
            onChunk: gameContext.onChunk,
        })
        return typeof result === 'string' ? result : (result?.content || result?.text || '')
    } catch (e) {
        console.error('[ClawMachineAI] generateGameChat failed:', e)
        return '嗯嗯，我在听～'
    }
}

// ============================================================
// 默认回复（API 调用失败时的兜底）
// ============================================================

function getDefaultOpening(chat, ctx) {
    const openers = [
        `哇，${ctx.machineName}！看我的吧～`,
        `嘿嘿，让我来试试这个${ctx.machineName}！`,
        `交给我吧，我可是抓娃娃高手哦～`,
        `好期待啊，不知道能抓到什么呢～`,
    ]
    return openers[Math.floor(Math.random() * openers.length)]
}

function getDefaultReaction(chat, ctx) {
    if (ctx.result === 'success') {
        const reactions = [
            `耶！抓到${ctx.dollName}了！太开心了～`,
            `哈哈，看到没！我一发就中了！`,
            `好可爱啊这个${ctx.dollName}～送给你！`,
            `嘿嘿，我的技术还行吧～`,
        ]
        return reactions[Math.floor(Math.random() * reactions.length)]
    } else {
        const reactions = [
            `啊…差一点点就抓到了…`,
            `哼，这爪子太松了吧！再来！`,
            `没关系没关系，下次一定行～`,
            `呜…好可惜啊…`,
        ]
        return reactions[Math.floor(Math.random() * reactions.length)]
    }
}

/**
 * 执行一次完整的 AI 游玩操作
 * @param {Object} config
 * @param {Array} config.layout - 玩偶布局
 * @param {number} config.startX - 爪子起始位置
 * @param {number} config.targetX - 目标位置
 * @param {number} config.aiSkill - AI技能 (0-1)
 * @param {number} config.baseRate - 基础概率
 * @returns {Object} { steps, result }
 */
export function executeAIPlay(config) {
    const { layout, startX = 50, targetX = 50, aiSkill = 0.5, baseRate = 0.3 } = config

    // 模拟 AI 操作序列
    const steps = simulateAIOperation({
        targetX,
        startX,
        aiSkill,
        speed: 1,
    })

    // 最终爪子位置（最后一步的 x）
    const finalX = steps[steps.length - 1]?.x || targetX

    // 判定抓取结果
    const result = resolveGrab({
        layout,
        clawX: finalX,
        clawY: 70,
        mode: 'ai',
        baseRate,
        aiSkill,
    })

    return { steps, result, finalX }
}
