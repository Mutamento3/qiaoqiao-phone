/**
 * 娃娃机 AI 控制逻辑
 * 负责"让TA玩"模式的 AI 角色操作模拟 + API 调用
 *
 * 设计要点（受公益站 3次/分钟 限流约束）：
 * - AI 操作过程（移动+下勾）用前端代码模拟，不调 API
 * - 仅在关键节点调 API：① 开始游玩时角色开场白 ② 抓取结果后角色反应 ③ 用户主动聊天
 * - 关键修复：参考麻将，使用"游戏对话调度系统"专用 system 提示词 + skipContext，
 *   彻底绕开微信聊天的通用角色扮演模板，避免回复格式与微信聊天完全一致。
 * - 游戏内调用默认走游戏中心独立渠道（flash 极速版），由 settings.gameCenterConfig 注入。
 */

import { generateReply } from '../aiService.js'
import { getLastNTurns } from '../common.js'
import { simulateAIOperation, resolveGrab } from './ClawMachineEngine.js'

/**
 * 构建 generateReply 所需的 char 对象
 * 与微信聊天区分：不带 worldBookLinks / msgs 记忆，避免游戏回复变成"微信聊天"。
 */
function buildCharInfo(chat, settings) {
    return {
        id: chat.id,
        name: chat.name || '角色',
        prompt: chat.prompt || '',          // 供游戏 system 提示词内联人设
        gender: chat.gender || chat.bio?.gender || '未知',
        userName: chat.userName || settings?.userName || '用户',
        userPersona: chat.userPersona || '',
        userAvatar: chat.userAvatar,
        avatar: chat.avatar,
        worldBookLinks: [],                 // 游戏渠道不走微信世界观
        emojis: [],
        canDraw: false,
        searchEnabled: false,
    }
}

/**
 * 构建"娃娃机游玩对话系统"专用 system 提示词（参考麻将 batchPrompt 思路）
 * @param {Object} charInfo - buildCharInfo 结果
 * @param {Object} ctx - { machineName, dollName, result, userMessage }
 */
function buildGameSystemPrompt(charInfo, ctx) {
    const lines = []
    lines.push('# 娃娃机游玩对话系统')
    lines.push(
        `你现在正在和用户【${charInfo.userName}】一起玩娃娃机（${ctx.machineName}），必须以你扮演的角色【${charInfo.name}】的身份、用角色口吻进行互动。` +
        `不要以助手 / 微信聊天机器人的身份回答，不要出现"在的""好的~"这类客服式开头。`
    )
    if (charInfo.prompt) lines.push(`## 你的核心人设\n${charInfo.prompt}`)
    if (charInfo.userPersona) lines.push(`## 你对用户【${charInfo.userName}】的私有设定\n${charInfo.userPersona}`)

    if (ctx.result === 'start') {
        lines.push('\n## 当前情境\n你们刚刚投币准备开始，现在轮到你来操控娃娃机。请用你的性格说一句开场白，表达你对玩娃娃机的态度或期待。')
    } else if (ctx.result === 'success') {
        const who = ctx.caughtBy === 'user' ? '用户' : '你'
        lines.push(`\n## 当前情境\n${who}刚刚抓到了「${ctx.dollName}」！请用你的性格表达反应：${ctx.caughtBy === 'user' ? '为用户开心、夸奖用户、羡慕或恭喜' : '开心、得意、炫耀等'}。`)
    } else if (ctx.result === 'fail') {
        const who = ctx.caughtBy === 'user' ? '用户' : '你'
        lines.push(`\n## 当前情境\n${who}刚才想抓「${ctx.dollName}」却没抓到。请用你的性格表达反应（${ctx.caughtBy === 'user' ? '安慰用户、鼓励再来一次' : '失落、不甘、自我安慰等'}）。`)
    } else {
        lines.push('\n## 当前情境\n游玩过程中用户在和你聊天，请以你的性格自然回应，可以聊娃娃机、玩偶，也可以聊别的。')
    }

    if (ctx.userMessage) {
        lines.push(`\n## 用户刚才说\n${charInfo.userName}：「${ctx.userMessage}」\n请自然地回应这句话。`)
    }

    lines.push(
        '\n## 输出要求\n' +
        `- 完全以【${charInfo.name}】的身份、口吻、口癖说话，不要跳出角色。\n` +
        '- 保持自然、简短、口语化（1-3 句话，50 字以内）。\n' +
        '- 不要使用微信聊天式的客套开头（如"好的~""在的"），直接角色扮演。\n' +
        '- 只输出一句回复，不要解释、不要列点、不要 Markdown、不要加引号。'
    )
    return lines.join('\n')
}

/**
 * 统一的 AI 调用封装（游戏渠道专用）
 */
async function callClawMachineAI(messages, charInfo, signal, options) {
    try {
        const result = await generateReply(messages, charInfo, signal, options)
        return typeof result === 'string' ? result : (result?.content || result?.text || '')
    } catch (e) {
        console.error('[ClawMachineAI] call failed:', e)
        return ''
    }
}

// 将游戏内聊天记录映射为 messages 格式（避免注入微信原始聊天历史）
function mapHistory(history = []) {
    return history.slice(-8).map(m => ({
        role: m.role === 'ai' || m.role === 'assistant' ? 'assistant' : (m.role === 'system' ? 'system' : 'user'),
        content: typeof m.content === 'string' ? m.content : '[非文本消息]'
    }))
}

/**
 * 让 AI 角色在游玩开始时说开场白
 */
export async function generateAIOpening(chat, settings, gameContext, signal) {
    const charInfo = buildCharInfo(chat, settings)
    const systemPrompt = buildGameSystemPrompt(charInfo, { ...gameContext, result: 'start' })
    const messages = [
        { role: 'system', content: systemPrompt },
        ...mapHistory(gameContext.history || chat.msgs || []),
    ]
    const text = await callClawMachineAI(messages, charInfo, signal, {
        stream: false,
        skipContext: true,
        overrideConfig: settings.gameCenterConfig,
    })
    return text || getDefaultOpening(chat, gameContext)
}

/**
 * 让 AI 角色对抓取结果做出反应
 * 为免公益 API 限流 / 幻觉把"用户抓到"说成"我抓到"，结果反应用本地兜底文案，
 * 根据 caughtBy 正确区分"你抓到啦"和"我抓到啦"。
 */
export async function generateAIReaction(chat, settings, gameContext, signal) {
    // 忽略 API 调用，直接返回本地化、 attribution 正确的兜底文案
    return getDefaultReaction(chat, gameContext)
}

/**
 * 让 AI 角色在游玩中回复用户聊天
 */
export async function generateGameChat(chat, settings, gameContext, signal) {
    const charInfo = buildCharInfo(chat, settings)
    const systemPrompt = buildGameSystemPrompt(charInfo, {
        machineName: gameContext.machineName,
        userMessage: gameContext.userMessage,
        result: undefined, // 聊天场景
    })
    const messages = [
        { role: 'system', content: systemPrompt },
        ...mapHistory(gameContext.history || chat.msgs || []),
    ]
    const text = await callClawMachineAI(messages, charInfo, signal, {
        stream: true,
        skipContext: true,
        overrideConfig: settings.gameCenterConfig,
        onChunk: gameContext.onChunk,
    })
    return text || '嗯嗯，我在听～'
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
    const isUserCatch = ctx.caughtBy === 'user'
    if (ctx.result === 'success') {
        const reactions = isUserCatch
            ? [
                `哇，你抓到${ctx.dollName}了！好厉害～`,
                `恭喜恭喜！一发就中，手气真棒！`,
                `好可爱啊这个${ctx.dollName}～被你抓到啦！`,
                `厉害厉害，比我还准呢～`,
            ]
            : [
                `耶！我抓到${ctx.dollName}了！太开心了～`,
                `哈哈，看到没！我一发就中了！`,
                `好可爱啊这个${ctx.dollName}～送给你！`,
                `嘿嘿，我的技术还行吧～`,
            ]
        return reactions[Math.floor(Math.random() * reactions.length)]
    } else {
        const reactions = isUserCatch
            ? [
                `啊…你差一点点就抓到了…`,
                `好可惜，下次一定行！`,
                `别急别急，再试一次～`,
                `这爪子太松了，不怪你～`,
            ]
            : [
                `啊…我差一点点就抓到了…`,
                `哼，这爪子太松了吧！再来！`,
                `没关系没关系，下次一定行～`,
                `呜…好可惜啊…`,
            ]
        return reactions[Math.floor(Math.random() * reactions.length)]
    }
}

/**
 * 执行一次完整的 AI 游玩操作
 */
export function executeAIPlay(config) {
    const { layout, startX = 50, targetX = 50, aiSkill = 0.5, baseRate = 0.3, clawDropY = 58 } = config

    const steps = simulateAIOperation({
        targetX,
        startX,
        aiSkill,
        speed: 1,
    })

    const finalX = steps[steps.length - 1]?.x || targetX

    const result = resolveGrab({
        layout,
        clawX: finalX,
        clawY: clawDropY,
        mode: 'ai',
        baseRate,
        aiSkill,
    })

    return { steps, result, finalX }
}
