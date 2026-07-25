// 记忆自动检索层 (Agent 的"自动选记忆"能力, 0 token 额外调用)
//
// 设计约束 (见 MEMORY.md「AI 速率约束」):
//   - 公益站 LLM API 硬限 3 次/分钟, 约束是"调用频率"不是"token 量"
//   - 因此不能调远程 embedding API (每次都算一次调用)
//   - 记忆检索必须在代码层完成, 不消耗任何 LLM 调用
//
// 方案: 纯 JS 字符级 2-gram 向量 + 余弦相似度。
//   中文无空格, 2-gram 比 1-gram 更能捕捉相邻语义; 英文/数字按字符也近似可用。
//   每次 generateReply 前, 用当前用户消息的向量从角色 memoryLog 中检索 top-K 相关片段注入上下文,
//   替换原 getMemorySummary 的"全量发送", 既省 token 又只给模型看相关的。

import { useChatStore } from '../stores/chatStore'

let _chatStore = null
function getStore() {
  if (!_chatStore) {
    try {
      _chatStore = useChatStore()
    } catch (e) {
      try {
        _chatStore = window.__pinia?._s.get('chat')
      } catch (e2) {
        /* noop */
      }
    }
  }
  return _chatStore
}

// 字符级 2-gram 向量化 (TF 计数)。去空白与标点, 转小写。
function tokenize(text) {
  const cleaned = String(text || '').toLowerCase().replace(/[\s\p{P}]+/gu, '')
  const grams = new Map()
  if (cleaned.length <= 1) {
    if (cleaned) grams.set(cleaned, 1)
    return grams
  }
  for (let i = 0; i < cleaned.length - 1; i++) {
    const g = cleaned[i] + cleaned[i + 1]
    grams.set(g, (grams.get(g) || 0) + 1)
  }
  return grams
}

// 余弦相似度 (两个 TF 向量)
function cosine(a, b) {
  let dot = 0
  let na = 0
  let nb = 0
  for (const v of a.values()) na += v * v
  for (const v of b.values()) nb += v * v
  // 在较小向量上迭代, 查较大向量, 省时间
  const small = a.size <= b.size ? a : b
  const large = a.size <= b.size ? b : a
  for (const [k, v] of small) {
    const w = large.get(k)
    if (w) dot += v * w
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

// 预热: 把角色所有记忆条目的向量缓存起来, 避免每条消息都重算 (大记忆库时明显加速)
const _vecCache = new WeakMap()
function getCachedVec(char, entry, idx) {
  let map = _vecCache.get(char)
  if (!map) {
    map = new Map()
    _vecCache.set(char, map)
  }
  if (!map.has(idx)) {
    const text = typeof entry === 'string' ? entry : entry?.content || JSON.stringify(entry)
    map.set(idx, tokenize(text))
  }
  return map.get(idx)
}

/**
 * 从角色 memoryLog 中检索与 query 最相关的片段。
 * @param {string} charId
 * @param {string} query 当前用户消息 (作为检索锚点)
 * @param {{limit?:number, threshold?:number}} options
 * @returns {string} 注入 LLM 上下文的格式化记忆文本 (含 memoryFacts), 无结果返回 ''
 */
export function retrieveRelevantMemories(charId, query, { limit = 8, threshold = 0.04 } = {}) {
  const chatStore = getStore()
  const char = chatStore?.chats?.[charId]
  if (!char) return ''

  const logs = (char.memoryLog || []).filter(Boolean)
  if (logs.length === 0) return ''

  // memoryFacts 是角色"已知事实"(如 你叫XX/喜欢XX), 简短且重要, 始终附带
  const facts =
    char.memoryFacts && Object.keys(char.memoryFacts).length
      ? '\n' +
        Object.entries(char.memoryFacts)
          .map(([k, v]) => `  👤 ${k}: ${v}`)
          .join('\n')
      : ''

  const qVec = tokenize(query)
  // query 无有效词 (如纯表情/标点): 退回最近 limit 条, 保证不丢上下文
  if (qVec.size === 0) {
    return `【🔍 自动检索到的相关记忆 (最近${limit}条)】\n${logs.slice(-limit).join('\n')}${facts}`
  }

  const scored = logs
    .map((entry, idx) => ({
      text: typeof entry === 'string' ? entry : entry?.content || JSON.stringify(entry),
      sim: cosine(qVec, getCachedVec(char, entry, idx))
    }))
    .filter((x) => x.sim > threshold)

  scored.sort((a, b) => b.sim - a.sim)
  const top = scored.slice(0, limit)

  // 太不相关 (top 为空) 则退回最近片段, 避免角色毫无上下文
  const chosen = top.length > 0 ? top : logs.slice(-limit)
  return `【🔍 自动检索到的相关记忆 (${chosen.length}条)】\n${chosen.map((x) => x.text).join('\n')}${facts}`
}
