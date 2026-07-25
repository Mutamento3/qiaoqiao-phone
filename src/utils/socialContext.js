// 0-token 本地层：调用 LLM 之前，本地检索/压缩/差量社交平台内容，
// 生成极简摘要注入 prompt。不增加任何 API 调用次数（调用仍 1 次/消息）。
//
// 四招（全在代码层，0 token 思考）：
//   1. 本地预检索：只扒近期 N 条 + 与用户当前消息相关的，不全量塞。
//   2. 压缩表达：只发 id + 标题 + 一句摘要，不发全文。
//   3. 差量(delta)：每个角色记一份"已展示快照"，只发新增内容。
//   4. 事件驱动：平时不碰社交内容(0 额外)；仅当用户提到该平台，或检测到新内容才注入。

import { useForumStore } from '../stores/forumStore'
import { useMomentsStore } from '../stores/momentsStore'
import { useWeiboStore } from '../stores/weiboStore'
import { useLoveSpaceStore } from '../stores/loveSpaceStore'
import { useCalendarStore } from '../stores/calendarStore'

// 每个角色一份"已展示给 AI 的 ID 快照"，实现差量（只发新增）
const SEEN = new Map() // key: `${charId}:${source}` -> Set(id)
function seenKey(charId, source) {
    return `${charId || 'me'}:${source}`
}
function markSeen(charId, source, ids) {
    const k = seenKey(charId, source)
    if (!SEEN.has(k)) SEEN.set(k, new Set())
    const set = SEEN.get(k)
    ids.forEach((id) => id && set.add(id))
}
function isSeen(charId, source, id) {
    const s = SEEN.get(seenKey(charId, source))
    return s ? s.has(id) : false
}

const RECENT_N = 5 // 每个平台单轮最多展示的近期条数
const MAX_TOTAL = 16 // 整段摘要最大行数（防失控）

// 关键词（本地匹配，0 token）——用户提到某平台才展开该平台近期内容
const KEYWORDS = {
    forum: ['论坛', '帖子', '回帖', '回复', '社区', '逛贴'],
    moments: ['朋友圈', '动态', '九宫格', '晒'],
    weibo: ['微博', '博文', '热搜'],
    couple: ['情侣空间', '日记', '情书', '恋爱日记', '情侣'],
    calendar: ['日程', '日历', '安排', '提醒', '计划', '约']
}
export function matchesKeyword(text, source) {
    if (!text) return false
    return (KEYWORDS[source] || []).some((k) => text.includes(k))
}

export function excerpt(s, n = 42) {
    if (!s) return ''
    return String(s).replace(/\s+/g, ' ').trim().slice(0, n)
}

export function timeAgo(ts) {
    if (!ts) return ''
    let t = Number(ts)
    if (!isFinite(t)) return ''
    if (t < 1e12) t *= 1000 // 秒 -> 毫秒
    const d = Date.now() - t
    if (d < 0) return '刚刚'
    const m = Math.floor(d / 60000)
    if (m < 1) return '刚刚'
    if (m < 60) return `${m}分钟前`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}小时前`
    const day = Math.floor(h / 24)
    if (day < 30) return `${day}天前`
    return new Date(t).toLocaleDateString('zh-CN')
}

// --- 各平台数据抓取（defensive，单平台失败不影响其它）---
function gatherForum() {
    const store = useForumStore()
    const all = []
    const map = store.posts || {}
    for (const fid in map) {
        for (const p of map[fid] || []) {
            all.push({ id: p.id, ts: p.timestamp, author: p.authorName, title: p.title, text: p.content, source: 'forum' })
        }
    }
    return all
}
function gatherMoments() {
    const store = useMomentsStore()
    return (store.moments || []).map((m) => ({
        id: m.id, ts: m.timestamp, author: m.authorName, title: '', text: m.content,
        source: 'moments', comments: (m.comments || []).length
    }))
}
function gatherWeibo() {
    const store = useWeiboStore()
    return (store.posts || []).map((p) => ({
        id: p.id, ts: p.timestamp || p.time,
        author: p.authorName || (p.authorId === 'me' ? '我' : ''),
        title: '', text: p.content, source: 'weibo', comments: (p.comments || []).length
    }))
}
function gatherCouple(charId) {
    const store = useLoveSpaceStore()
    const space = store.spaces && store.spaces[charId || 'me']
    if (!space) return []
    const items = []
    for (const d of space.diary || []) {
        items.push({ id: d.id, ts: d.timestamp || d.createdAt, author: '', title: d.title, text: d.content, source: 'couple', kind: '情侣日记' })
    }
    for (const l of space.letters || []) {
        items.push({ id: l.id, ts: l.timestamp || l.createdAt, author: '', title: l.title, text: l.content, source: 'couple', kind: '情侣信' })
    }
    return items
}
function gatherCalendar() {
    const store = useCalendarStore()
    return (store.events || []).map((e) => ({
        id: e.id, ts: e.createdAt ? Date.parse(e.createdAt) : 0,
        author: '', title: e.title, text: e.note || '', source: 'calendar', date: e.date, time: e.time
    }))
}

export function formatSocialItem(it) {
    switch (it.source) {
        case 'forum':
            return `- [论坛] 「${it.title || '无标题'}」 — ${excerpt(it.text)} (id:${it.id}${it.author ? ', by ' + it.author : ''}, ${timeAgo(it.ts)})`
        case 'moments':
            return `- [朋友圈] ${excerpt(it.text)} (id:${it.id}${it.author ? ', by ' + it.author : ''}, ${timeAgo(it.ts)}${it.comments ? ', 评论' + it.comments : ''})`
        case 'weibo':
            return `- [微博] ${excerpt(it.text)} (id:${it.id}${it.author ? ', by ' + it.author : ''}, ${timeAgo(it.ts)})`
        case 'couple':
            return `- [${it.kind}] 「${it.title || '无题'}」 — ${excerpt(it.text)} (id:${it.id})`
        case 'calendar':
            return `- [日程] ${it.title || ''} @ ${it.date || ''} ${it.time || ''} (id:${it.id}${it.text ? ', 备注:' + excerpt(it.text, 20) : ''})`
        default:
            return ''
    }
}

// 主入口。opts.getters 可覆盖（用于单测）。
export function buildSocialContext(userText, charId, opts = {}) {
    const getters = opts.getters || {
        forum: gatherForum, moments: gatherMoments, weibo: gatherWeibo,
        couple: () => gatherCouple(charId), calendar: gatherCalendar
    }
    const sources = ['forum', 'moments', 'weibo', 'couple', 'calendar']
    const collected = [] // { ts, line }

    for (const src of sources) {
        let items
        try {
            items = getters[src] ? getters[src]() : []
        } catch (e) {
            items = []
        }
        if (!items || !items.length) continue
        items.sort((a, b) => (b.ts || 0) - (a.ts || 0))
        const recent = items.slice(0, RECENT_N)
        const kw = matchesKeyword(userText, src)
        let include
        if (kw) {
            include = recent // 用户提到该平台 -> 展开近期（即使已展示过）
        } else {
            include = recent.filter((it) => !isSeen(charId, src, it.id)) // 仅新增
        }
        if (!include.length) continue
        // 标记已展示（用 recent 全量，避免旧条目反复进入差量窗口）
        markSeen(charId, src, recent.map((it) => it.id))
        for (const it of include) {
            const line = formatSocialItem(it)
            if (line) collected.push({ ts: it.ts || 0, line })
        }
    }

    if (!collected.length) return ''
    // 全局按时间倒序 + 截断
    collected.sort((a, b) => b.ts - a.ts)
    const lines = collected.slice(0, MAX_TOTAL).map((c) => c.line)
    return (
        '【社交平台近况 (代码层本地检索, 仅给你参考, 不消耗额外调用)】\n' +
        lines.join('\n') +
        '\n（如需让角色引用/操作某条, 用其 id；例如发评论 [[action:send_forum_comment:{"postId":"<id>"}]]）'
    )
}
