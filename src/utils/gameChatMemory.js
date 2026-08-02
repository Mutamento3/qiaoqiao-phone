/**
 * 游戏聊天记忆工具
 * 统一管理各游戏（麻将/UNO/娃娃机等）的"局内聊天"持久化与按设置保留天数。
 * - enabled=false → 仅保留当局聊天，退出即清空（不持久化历史）
 * - mode='all'    → 永久保留（保留最近 300 条防溢出）
 * - mode='custom' → 仅保留最近 days 天的消息
 * 注意：各游戏 store 独立调用本工具，互不联通。
 */

const STORAGE_KEYS = {
    mahjong: 'mahjong_game_chat',
    uno: 'uno_game_chat',
    monopoly: 'monopoly_game_chat',
}

const HARD_CAP = 300

function msgTime(m) {
    return m?.time || m?.timestamp || Date.now()
}

export function pruneGameChat(messages, setting) {
    if (!Array.isArray(messages)) return []
    const s = setting || { enabled: true, mode: 'all', days: 30 }
    // 仅保留当局：直接清空历史
    if (s.enabled === false) return []
    let arr = messages
    if (s.mode === 'custom' && s.days > 0) {
        const cutoff = Date.now() - s.days * 86400000
        arr = messages.filter((m) => msgTime(m) >= cutoff)
    }
    // 永久模式：硬上限裁剪，防止 localStorage 溢出
    if (arr.length > HARD_CAP) arr = arr.slice(arr.length - HARD_CAP)
    return arr
}

export function loadGameChat(game, setting) {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS[game])
        if (!raw) return []
        const msgs = JSON.parse(raw)
        return pruneGameChat(msgs, setting)
    } catch {
        return []
    }
}

export function saveGameChat(game, messages, setting) {
    const toSave = pruneGameChat(messages || [], setting)
    try {
        if (!toSave.length) {
            localStorage.removeItem(STORAGE_KEYS[game])
        } else {
            localStorage.setItem(STORAGE_KEYS[game], JSON.stringify(toSave))
        }
    } catch {
        // 配额溢出：仅保留最近 100 条兜底
        try {
            const fallback = (messages || []).slice(-100)
            localStorage.setItem(STORAGE_KEYS[game], JSON.stringify(fallback))
        } catch {
            /* ignore */
        }
    }
}

export function clearGameChat(game) {
    try {
        localStorage.removeItem(STORAGE_KEYS[game])
    } catch {
        /* ignore */
    }
}
