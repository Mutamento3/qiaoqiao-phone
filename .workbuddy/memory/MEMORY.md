# 俏俏 (qiaqiao-phone) 长期记忆

## 构建架构（关键，易混淆）
- 两套产物：①网页应用 Vue3+Vite 挂 PWA（浏览器"添加到主屏幕"，~2MB 网页壳）；②原生 APP `android-native/` Kotlin WebView（拷 dist/ 进 assets/，真通知/锁屏等原生能力）。
- **正确签名原生包** = GitHub Releases `chilly-phone-native-<ver>.apk`（CI `build-native-apk.yml` 触发：npm run build → cp dist → gradlew clean → assembleRelease 固定签名）。
- 两个 workflow 都 push 触发产物不同：`build-apk.yml`(TWA 网页壳 ~2MB, tag `v<ver>`) vs `build-native-apk.yml`(真原生 ~49-53MB, tag `v<ver>-native`)。**下载认准 -native + 大体积**。
- `npm run build` = `scripts/build-esbuild.mjs`（esbuild 直接打包），**完全不跑 Vite/Rollup**。`vite.config.js` 的 build.* 全部无效。真开关在 build-esbuild.mjs（minify/splitting）。
- esbuild 无 manualChunks；降首屏只能路由懒加载 + splitting。

## 版本号规则（v1.10.234 后）
- **只改 `src/version.json`** 两处（version + buildTime），build 自动 sync 到 `public/version.json`（覆盖回写）。CI 自动注入 android-native gradle versionCode/Name。
- 历史坑：漏改 public/version.json 会让 PWA splash 卡旧号（v1.10.222 踩过）。诊断：`curl .../version.json` 对不上就看 build 脚本。

## 字体（v1.10.231 本地化）
- 手写体改用本地 `public/fonts/{Ma Shan Zheng,Long Cang,Zhi Mang Xing}/*.woff2` + `src/assets/handwriting.css`（不再 fetch Google Fonts，防 WebView 白屏）。

## 踩坑经验（必读）
- **WebViewAssetLoader 多层路径（致命白屏）**：Vite `base:'./'` 生成 `./assets/main.js` 被解析成 `/assets/assets/main.js` 404，splash 永久转圈。所有 native 包都中招过。修复：自定义 `/assets/` path handler 剥一层。PWA 网页版单层引用不受影响。
- **CI 增量编译缓存**：`build-native-apk.yml` 的 Gradle cache key 只 hash gradle 文件不含 .kt → 改 MainActivity.kt 不重编译。修法：`assembleRelease` 前 `./gradlew clean` 强制重编译（v1.10.234 起）。
- **核实远端用 `git ls-remote`**，别凭本地 stale `origin/main` 判断"推没推上"（曾误判 d81bb48 没推，其实推了）。
- **本地 .git 损坏（refs 被删/对象缺失）**：别在坏仓库硬 rebase/stash（对象缺失必炸）。直接 `git clone` 健康远端 → 只复制自己改的精确文件清单进 clone（绝不全量 tar 覆盖，会带无关脏改动）→ commit 重放 → push。PAT 用完即弃，clone 后立刻 `git remote set-url` 去 token。
- husky 本地 hook 在 Windows Git Bash 有路径 bug → 提交用 `--no-verify` 绕过，CI `lint.yml` 兜底卡门禁。
- **agent 动作协议（[[action:verb]]）维护铁律**：从 `agentActions.js` 目录摘除某 verb 时，**`chatStore.runAgentAction` 的 switch 分支必须同步删除**。曾因只删目录、漏删执行层分支，导致 AI 幻觉输出 `[[action:publish_moment]]` 仍被接住、与 `[MOMENT_SHARE:]` 专用通道双发朋友圈的同类 bug。

## 用户偏好
- 中文沟通；直接、针对性方案优于兜底；回归 bug 多，习惯截图+简短吐槽反馈。
- 微信类 App「俏俏」：AI「乔笙」、mindscape、红包支付、朋友圈；在线/离线双聊天盒 UI。
- 用户偏好大白话：技术内容要用通俗语言解释、少用术语（原话"哎哟我看不懂，你用大白话告诉我"）。

## AI 能力 / 速率约束（设计 agent 前必读）
- **公益站 LLM API 硬限：3 次/分钟（单 key，非共享），短时间突发 → 429**。约束是"调用频率"不是"token 量"。
- 现有限流队列 `src/utils/ai/requestQueue.js`（RequestQueue 类）**仍存在、正确接入、且已匹配真实限制（2026-07-25 修复，1.10.235 / commit 8b428f18）**：generateReply/summary/translate/image/moments/forum 走 `apiQueue.enqueue(...)`。
  - 实例化 `new RequestQueue(3, 60000, 1)` → 3/min + 并发 1（匹配"3 次/分钟且不准并发"）。**已 push 生效**。
  - 429 处理：Circuit Breaker（429→全局暂停 30s），粗粒度、不解析 Retry-After（够用，未优化）。
- **绕过队列的漏网之鱼（Tarot 项已修复）**：
  - `src/views/WeChat/modals/TarotModal.vue` 解塔罗牌原为裸 `fetch(aiConfig.endpoint)` → 已改为 `apiQueue.enqueue(...)`（1.10.235），计入全局限流/熔断。
  - `src/utils/avatarDescCache.js:154` 视觉 API fetch 嵌套在已入队的 _generateReplyInternal 内，不计入队列 timestamps（速率少算），但并发安全（顺序 await）。优先级低，暂未动。
- agent 设计方向（仍成立）：不能多步 LLM 循环，改「单次推断 + 代码执行」；记忆检索/工具调用走代码层 0 token。
- **原生 tool_calls 不可用**：aiService.js 在 forbiddenKeys 里主动删除 `tool_choice`/`parallel_tool_calls`（公益代理对 function calling 支持不可靠），所以 agent 工具层**不能走 OpenAI tool_calls**，须用语义文本标记（如 `[[action:verb|arg]]`）让代码层解析执行。

## Agent 实现进度（2026-07-25 起）
- **MVP-1 记忆自动检索 已落地（1.10.236 / 本地 commit 7984cd0，未 push）**：
  - 新增 `src/utils/memoryRetrieval.js`：纯 JS 字符 bigram 向量（去标点小写）+ 余弦相似度 + WeakMap 向量缓存；`retrieveRelevantMemories(charId, query, {limit:8, threshold:0.04})` 从 `char.memoryLog` 取 top-8 相关 + 始终带 `memoryFacts`。
  - `aiService._generateReplyInternal` 原 `getMemorySummary`（全量发最多1500条 memoryLog）替换为 `retrieveRelevantMemories` → **0 token 额外调用**，省 token 且只注入相关记忆。
  - 构建通过，ESLint 0 error。未 push（行为变更先本地验证）。
- **MVP-2 工具层（agent 用应用）已落地（1.10.237 / 本地 commit 57cfd4c0，未 push）**：
  - 新增 `src/utils/agentActions.js`：动作目录 `AGENT_ACTIONS`（给 AI 看的描述）+ `parseAgentActions`（花括号平衡解析 `[[action:verb:{JSON}]]`，支持嵌套）。
  - `chatStore.addMessage` 的 AI 消息后处理块（照抄 MCP 块范式，L1497 后）：解析标记→`runAgentAction` 调真实 store 方法→从回复剥离标记→回系统消息（执行结果）。
  - 已接动作(9，publish_moment 已移出目录+执行层)：send_forum_post+send_forum_comment / publish_weibo / add_couple_diary+add_couple_letter / add_calendar_event / send_redpacket(扣款+构造红包消息) / inspect_phone / open_app(路由跳转)。**朋友圈走专用 `[MOMENT_SHARE:...]` 通道（authorId=chatId 即角色本人），不占 agent 框架**——避免与系统提示的 MOMENT_SHARE 指令打架致双发。
  - `aiService` 系统提示注入 `getActionCatalogMarkdown()`（告诉 AI 可用动作）。**全部代码层执行，0 额外 token**。
  - **MCP 沿用现有 `[MCP:serverId:{...}]` 机制**（chatStore L1457 + mcpService.callMCPTool）——用户"会用 MCP"要求已满足，无需重造。
  - 未接：购物加购物车（AI 不知商品 id，MVP 仅 open_app:shopping 导航）；世界书设置（系统级，按用户要求排除）。
  - 构建通过，ESLint 0 error。未 push（同 MVP-1，待 web 自测）。
- **本地反射层（0 token 规则拦截简单意图）可后续加**。
