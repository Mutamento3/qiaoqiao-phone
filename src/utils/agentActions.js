// Agent 动作层（MVP-2）
// 让 AI 在回复中用 [[action:动词:{参数JSON}]] 标记表达"想干的事"，
// 由代码层（chatStore）解析并执行对应的真实应用操作 —— 全程 0 额外 token。
//
// 设计要点：
// - 本模块只负责「目录（给 AI 看的描述）+ 解析（抽出标记）」，不执行。
// - 真正执行放在 chatStore（所有 store / addMessage 均在作用域，避免循环依赖）。
// - 系统级配置（如世界书设置 worldBook）不在此列 —— 按需求由用户/配置控制。

// 可用动作目录。desc 用中文，方便 AI 理解；params 是给 AI 的 JSON 示例。
export const AGENT_ACTIONS = [
  { verb: 'publish_moment', desc: '发一条朋友圈', params: '{ "content": "朋友圈文字", "images": ["图片url可选"] }' },
  { verb: 'send_forum_post', desc: '在论坛发帖', params: '{ "title": "标题", "content": "正文", "forumId": "论坛id可选" }' },
  { verb: 'send_forum_comment', desc: '回复某个论坛帖子', params: '{ "postId": "帖子id", "content": "回复内容" }' },
  { verb: 'publish_weibo', desc: '发一条微博', params: '{ "content": "微博内容", "images": ["图片url可选"] }' },
  { verb: 'add_couple_diary', desc: '在情侣空间写日记/动态', params: '{ "title": "标题可选", "content": "内容" }' },
  { verb: 'add_couple_letter', desc: '在情侣空间写一封信', params: '{ "title": "标题可选", "content": "内容" }' },
  { verb: 'add_calendar_event', desc: '添加一个日历日程', params: '{ "title": "标题", "date": "2026-07-26 可选", "time": "20:00 可选", "note": "备注可选" }' },
  { verb: 'send_redpacket', desc: '发一个红包（在当前聊天）', params: '{ "amount": 6.6, "note": "备注可选" }' },
  { verb: 'inspect_phone', desc: '查看/刷新该角色的手机内容', params: '{}' },
  { verb: 'open_app', desc: '打开某个应用界面', params: '{ "app": "moments|forum|shopping|weibo|wallet|calendar|couple|phone-inspection" }' }
]

// 生成注入系统提示词的能力菜单文本
export function getActionCatalogMarkdown() {
  const lines = AGENT_ACTIONS.map((a) => `- ${a.verb}：参数示例 ${a.params} —— ${a.desc}`)
  return (
    '你可以用 [[action:动作名:{参数JSON}]] 标记触发真实操作（代码层会解析并执行，不额外消耗调用次数）。可用动作：\n' +
    lines.join('\n') +
    '\n规则：① 标记会被执行并从你的回复文本中移除，不要向用户解释或重复标记本身；' +
    '② 一次回复可包含多个动作；③ 仅在确实要执行操作时才使用；④ 参数为 JSON，字符串用双引号。\n' +
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
    const verb = content.slice(idx + marker.length, colonIdx).trim()
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
      idx = colonIdx + 1
    }
    idx = content.indexOf(marker, idx)
  }
  return actions
}
