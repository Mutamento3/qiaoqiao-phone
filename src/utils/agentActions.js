// Agent 动作层（MVP-2）
// 让 AI 在回复中用 [[action:动词:{参数JSON}]] 标记表达"想干的事"，
// 由代码层（chatStore）解析并执行对应的真实应用操作 —— 全程 0 额外 token。
//
// 设计要点：
// - 本模块只负责「目录（给 AI 看的描述）+ 解析（抽出标记）」，不执行。
// - 真正执行放在 chatStore（所有 store / addMessage 均在作用域，避免循环依赖）。
// - 系统级配置（如世界书设置 worldBook）不在此列 —— 按需求由用户/配置控制。

// 可用动作目录。desc 用中文，方便 AI 理解；params 是给 AI 的 JSON 示例。
// num 为稳定序号 —— AI 可用 [[action:序号:{...}]] 代替动词名，减少拼错。
//
// 注意：发朋友圈(publish_moment) 故意不在这里 —— 朋友圈有专用通道
// `[MOMENT_SHARE:文字]` / `[分享朋友圈:文字]`（见 prompts_private.js），
// 若再在此列一个冲突格式，AI 会两条指令打架导致朋友圈解析失败。
export const AGENT_ACTIONS = [
  { num: 1, verb: 'send_forum_post', desc: '在论坛发帖', params: '{ "title": "标题", "content": "正文", "forumId": "论坛id可选" }' },
  { num: 2, verb: 'send_forum_comment', desc: '回复某个论坛帖子', params: '{ "postId": "帖子id", "content": "回复内容" }' },
  { num: 3, verb: 'publish_weibo', desc: '发一条微博', params: '{ "content": "微博内容", "images": ["图片url可选"] }' },
  { num: 4, verb: 'add_couple_diary', desc: '在情侣空间写日记/动态', params: '{ "title": "标题可选", "content": "内容" }' },
  { num: 5, verb: 'add_couple_letter', desc: '在情侣空间写一封信', params: '{ "title": "标题可选", "content": "内容" }' },
  { num: 6, verb: 'add_calendar_event', desc: '添加一个日历日程', params: '{ "title": "标题", "date": "2026-07-26 可选", "time": "20:00 可选", "note": "备注可选" }' },
  { num: 7, verb: 'send_redpacket', desc: '发一个红包（在当前聊天）', params: '{ "amount": 6.6, "note": "备注可选" }' },
  { num: 8, verb: 'inspect_phone', desc: '查看/刷新该角色的手机内容', params: '{}' },
  { num: 9, verb: 'open_app', desc: '打开某个应用界面', params: '{ "app": "功能序号/ID/中文名，见下方功能清单" }' }
]

// 应用/功能注册表 —— 给每个「应用」一个稳定 ID，AI 可用数字/短ID 精准点名，
// 避免拼错英文路由名导致 open_app 失效。num 为序号，id 为稳定短串，route 为路由名。
export const FEATURES = [
  { num: 1, id: 'moments', name: '朋友圈', route: 'moments', verbs: ['publish_moment'], channel: '[MOMENT_SHARE:文字]' },
  { num: 2, id: 'forum', name: '论坛', route: 'forum', verbs: ['send_forum_post', 'send_forum_comment'] },
  { num: 3, id: 'weibo', name: '微博', route: 'weibo', verbs: ['publish_weibo'] },
  { num: 4, id: 'couple', name: '情侣空间', route: 'couple', verbs: ['add_couple_diary', 'add_couple_letter'] },
  { num: 5, id: 'calendar', name: '日历', route: 'calendar', verbs: ['add_calendar_event'] },
  { num: 6, id: 'wallet', name: '钱包/红包', route: 'wallet', verbs: ['send_redpacket'] },
  { num: 7, id: 'shopping', name: '购物', route: 'shopping', verbs: [] },
  { num: 8, id: 'phone', name: '查手机', route: 'phone-inspection', verbs: ['inspect_phone'] },
  { num: 9, id: 'mcp', name: '外部MCP工具', route: null, verbs: [], channel: '[MCP:serverId:{...}]' }
]

// 快速查找表
const ACTION_BY_NUM = Object.fromEntries(AGENT_ACTIONS.map(a => [String(a.num), a.verb]))
const ACTION_BY_VERB = Object.fromEntries(AGENT_ACTIONS.map(a => [a.verb, a]))
const FEATURE_BY_REF = (() => {
  const m = {}
  for (const f of FEATURES) {
    m[String(f.num)] = f
    m[f.id] = f
    m[f.name] = f
    if (f.route) m[f.route] = f
  }
  return m
})()

// 把 AI 给的 app 引用（数字序号 / 功能id / 中文名 / 路由名）解析成功能对象
export function resolveFeature(ref) {
  if (ref == null) return null
  const key = String(ref).trim()
  return FEATURE_BY_REF[key.toLowerCase()] || FEATURE_BY_REF[key] || null
}

// 把动作标识（动词名 或 序号）解析成规范 verb；未知则原样返回（交由执行层报未知）
export function resolveActionVerb(key) {
  if (key == null) return key
  const k = String(key).trim()
  if (ACTION_BY_NUM[k]) return ACTION_BY_NUM[k]
  if (ACTION_BY_VERB[k]) return k
  return k
}

// 生成注入系统提示词的能力菜单文本（带功能ID，方便 AI 直接点名）
export function getActionCatalogMarkdown() {
  const featLines = FEATURES.map((f) => {
    const ch = f.channel
      ? `（专用通道 ${f.channel}）`
      : f.verbs.length
        ? `（动作：${f.verbs.join('/')}）`
        : '（可打开）'
    return `${f.num}. [${f.id}] ${f.name}${ch}`
  }).join('\n')
  const actLines = AGENT_ACTIONS.map((a) => `${a.num}. ${a.verb}：参数示例 ${a.params} —— ${a.desc}`).join('\n')
  return (
    '【可用功能清单（带ID，可用数字/ID 点名）】\n' + featLines +
    '\n\n你可以用 [[action:动作名或序号:{参数JSON}]] 标记触发真实操作（代码层解析执行，不额外消耗调用次数）。可用动作：\n' +
    actLines +
    '\n规则：① 标记会被执行并从你的回复文本中移除，不要向用户解释或重复标记本身；' +
    '② 一次回复可包含多个动作；③ 仅在确实要执行操作时才使用；④ 参数为 JSON，字符串用双引号。' +
    '⑤ open_app 的 app 字段可用功能序号/ID/中文名，例如 [[action:open_app:{"app":7}]] 打开购物。\n' +
    '（外部 MCP 工具请用 [MCP:serverId:{"tool":"名称","params":{}}] 格式，已有独立机制处理。）'
  )
}

// 从回复文本中提取所有 [[action:...]] 标记，返回 [{ verb, params, raw }]
// 使用花括号平衡计数，兼容参数 JSON 内部嵌套的括号。
export function parseAgentActions(content) {
  const actions = []
  if (typeof content !== 'string') return actions
  const marker = '[[action:'
  let idx = content.indexOf(marker)
  while (idx !== -1) {
    const colonIdx = content.indexOf(':', idx + marker.length)
    if (colonIdx === -1) break
    const verb = resolveActionVerb(content.slice(idx + marker.length, colonIdx).trim())
    let depth = 0
    let inStr = false
    let escaped = false
    let jsonStart = -1
    let jsonEnd = -1
    for (let i = colonIdx + 1; i < content.length; i++) {
      const ch = content[i]
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\') {
        escaped = true
        continue
      }
      if (ch === '"') {
        inStr = !inStr
        continue
      }
      if (inStr) continue
      if (ch === '{') {
        if (depth === 0) jsonStart = i
        depth++
      } else if (ch === '}') {
        depth--
        if (depth === 0 && jsonStart !== -1) {
          jsonEnd = i
          break
        }
      }
    }
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const rawJson = content.slice(jsonStart, jsonEnd + 1)
      let params = {}
      try {
        params = JSON.parse(rawJson)
      } catch (e) {
        params = {}
      }
      const closeIdx = content.indexOf(']]', jsonEnd)
      const raw = closeIdx !== -1 ? content.slice(idx, closeIdx + 2) : content.slice(idx, jsonEnd + 1)
      actions.push({ verb, params, raw })
      idx = closeIdx !== -1 ? closeIdx + 2 : jsonEnd + 1
    } else {
      // 兼容 AI 输出不带 JSON 花括号的简写：[[action:verb:纯文本]]
      // 例：[[action:publish_moment:今天天气真好]] → params = { content: '今天天气真好' }
      const close2 = content.indexOf(']]', colonIdx + 1)
      if (close2 !== -1) {
        const text = content.slice(colonIdx + 1, close2).trim()
        const raw = content.slice(idx, close2 + 2)
        actions.push({ verb, params: { content: text }, raw })
        idx = close2 + 2
      } else {
        idx = colonIdx + 1
      }
    }
    idx = content.indexOf(marker, idx)
  }
  return actions
}
