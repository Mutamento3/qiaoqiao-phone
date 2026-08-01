# 俏俏 (qiaqiao-phone) 长期记忆

## 构建架构（关键，易混淆）
- 两套产物：①网页应用 Vue3+Vite 挂 PWA（浏览器"添加到主屏幕"，~2MB 网页壳）；②原生 APP `android-native/` Kotlin WebView（拷 dist/ 进 assets/，真通知/锁屏等原生能力）。
- **正确签名原生包** = GitHub Releases `chilly-phone-native-<ver>.apk`（CI `build-native-apk.yml` 触发：npm run build → cp dist → gradlew clean → assembleRelease 固定签名）。
- 两个 workflow 都 push 触发产物不同：`build-apk.yml`(TWA 网页壳 ~2MB, tag `v<ver>`) vs `build-native-apk.yml`(真原生 ~49-53MB, tag `v<ver>-native`)。**下载认准 -native + 大体积**。
- `npm run build` = `scripts/build-esbuild.mjs`（esbuild 直接打包），**完全不跑 Vite/Rollup**。`vite.config.js` 的 build.* 全部无效。真开关在 build-esbuild.mjs（minify/splitting）。
- esbuild 无 manualChunks；降首屏只能路由懒加载 + splitting。

## 版本号规则（v1.10.234 后）
- **只改 `src/version.json`** 两处（version + buildTime），build 自动 sync 到 `public/version.json`（覆盖回写）。CI 自动注入 android-native gradle versionCode/Name。
- **本地攒改动（未 push）期间不要 bump 版本号**，保持最后一个已 push 基线（当前 `1.10.236`，已推 main）。版本号只在 `git push` 那一步统一 bump 一次——避免中间每个本地 commit 都更易版本号导致无意义的递增/跳跃。若一批 push 含多个本地 commit，最终只 bump 一次即可。

## Git 仓库与 push（易踩拼写坑）
- **正确仓库全名：`chilly520/qiaoqiao-phone`（双 q，q-i-a-o-q-i-a-o）**。本地 remote 已修正。注意不是 `qiaqiao-phone`（少一个 i，会 404）。
- push 用内联临时 PAT：`git push https://ghp_xxx@github.com/chilly520/qiaoqiao-phone.git HEAD:main`（沙箱 GCM 读不到 Windows 凭据，必须内联）。
- **push 报 `Repository not found` 时不要想当然归咎 token 失效**——GitHub 对"路径错/无权限"统一返回此信息，无法区分。先诊断：① `curl -H "Authorization: token <PAT>" https://api.github.com/user` 验 token（200=有效）；② `GET /user/repos?affiliation=owner` 查真实仓库全名（拼写/owner 是否写错）。本沙箱 Bash 与 Write 文件系统隔离，测试脚本用 heredoc 拆短写或用 esbuild onResolve 空桩，避免长 heredoc 引号被吞。
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
- **functions/v2/link/fetch.js 抓小红书/SSR 页 INITIAL_STATE 的脆弱正则坑**：老代码 `window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*<\/script>` 要求 `}` 紧贴 `</script>`，但真实页面结尾是 `};</script>`（带分号）→ 匹配失败 → JSON.parse 拿到 null → 标题/封面/正文全空，只剩 HTML 兜底正则抓到的**真评论**（表现"只有评论、没标题封面"）。修复：宽松匹配 `([\s\S]*?)<\/script>` 再 `replace(/;\s*$/,'')` 去分号后 parse。⚠️ 教训：看到"链接只有评论"**别假设评论是假的**（用户已确认是真），先查 state 解析是否失败导致标题/封面缺失。
- **`const` 块级作用域跨 if 块引用导致 ReferenceError（聊天整体炸）**：1.10.241 在 `aiService.js` 加社交上下文时直接引用了 line 402 的 `const lastUserMsg`，但该 const 声明在 `if (charId && !isSimpleTask && !isCommandTask && !skipContext) { ... }` 块内（line 457 闭块），到达社交上下文代码 line 861 时已超出作用域 → `ReferenceError: lastUserMsg is not defined` → 主聊天每发必炸（安卓端表现为 "AI响应处理失败 lastUserMsg is not defined"，用户感觉"调用不了"）。教训：**JS `const/let` 是块级作用域**，在一个 if 块里 `const` 的变量，出了那个 `}` 就没了；跨多个代码段复用时要么提到函数级（hoist），要么各段各自现场算。**功能加完后必须端到端跑一遍主流程**——单元/局部断言（如"社交上下文能生成"）覆盖不到这种跨作用域引用陷阱（v1.10.241 的 7 断言全过却仍漏掉了，因为它没模拟完整 `_generateReplyInternal` 流到 line 861）。

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
  - 新增 `src/utils/agentActions.js`：动作目录 `AGENT_ACTIONS`（给 AI 看的描述 + 各动作 `num` 序号）+ 应用注册表 `FEATURES`（9 项：num/id/name/route/verbs/channel）+ `parseAgentActions`（花括号平衡解析 `[[action:verb:{JSON}]]`，支持嵌套 + 支持序号 `[[action:1:{...}]]`）。
  - `chatStore.addMessage` 的 AI 消息后处理块（照抄 MCP 块范式，L1497 后）：解析标记→`runAgentAction` 调真实 store 方法→从回复剥离标记→回系统消息（执行结果）。
  - 已接动作(9，publish_moment 已移出目录+执行层)：send_forum_post+send_forum_comment / publish_weibo / add_couple_diary+add_couple_letter / add_calendar_event / send_redpacket(扣款+构造红包消息) / inspect_phone / open_app(路由跳转)。**朋友圈走专用 `[MOMENT_SHARE:...]` 通道（authorId=chatId 即角色本人），不占 agent 框架**——避免与系统提示的 MOMENT_SHARE 指令打架致双发。
  - **ID 点名机制（1.10.240 / commit 30ac85d9，本地未推）**：AI 可凭「数字序号/功能id/中文名」精准定位应用，不再依赖拼对英文路由名。`[[action:open_app:{"app":7}]]`=打开购物；`[[action:9:{"app":"论坛"}]]` 等写法均被解析。辅助函数 `resolveFeature(ref)` + `resolveActionVerb(key)`。`getActionCatalogMarkdown()` 注入带 ID 的功能清单+动作序号菜单。
  - `aiService` 系统提示注入 `getActionCatalogMarkdown()`（告诉 AI 可用动作）。**全部代码层执行，0 额外 token**。
  - **MCP 沿用现有 `[MCP:serverId:{...}]` 机制**（chatStore L1457 + mcpService.callMCPTool）——用户"会用 MCP"要求已满足，无需重造。
  - 未接：购物加购物车（AI 不知商品 id，MVP 仅 open_app:shopping 导航）；世界书设置（系统级，按用户要求排除）。
  - 构建通过，ESLint 0 error。未 push（同 MVP-1，待 web 自测）。
- **社交平台近况零额外调用注入（1.10.241 / commit a7af1d91，本地未推）**：新增 `src/utils/socialContext.js`——调用 LLM 前本地检索/压缩/差量社交内容（论坛/朋友圈/微博/情侣空间/日历），注入同一次调用的 prompt。四招：本地预检索(近期N=5)+压缩(id+摘要)+差量(SEEN 按 charId:source 记已展示id)+事件驱动(关键词或新增才注入)。`buildSocialContext(userText,charId,{getters})` 主入口；`aiService.generateReply` 系统提示段在能力菜单后追加，守卫 `!isCall && !isSimpleTask && !skipProcessing`。验证 7 断言全过。
- **本地反射层（0 token 规则拦截简单意图）可后续加**。

## 娃娃机系统（2026-07-31，本地未推）
- 6个新文件 + 2个修改文件，完整功能，构建通过，ESLint 0 error。
- **文件结构**：`src/utils/clawMachine/`（clawMachinesData.js / backgroundRemoval.js / ClawMachineEngine.js / ClawMachineAI.js）+ `src/stores/clawMachineStore.js` + `src/views/Games/ClawMachine.vue`。
- **6种娃娃机**：毛绒乐园/手办殿堂/盲盒世界/积木王国/公仔家族/玩具总动员，每种6玩偶（5内置SVG程序生成 + 1自定义上传白底图Canvas抠像）。
- **经济系统**：独立游戏币体系，充值从 `walletStore.decreaseBalance` 扣人民币→加游戏币（localStorage key=`claw_machine_data`），投币消耗1-2币/次。
- **AI 接入关键**：`ClawMachineAI.js` 调 `generateReply` 时**不设 skipContext/isSimpleTask**——让 aiService 自动注入角色人设/用户人设/记忆/最近20轮聊天记录。AI操作过程用前端模拟（`simulateAIOperation`），仅开场白/结果反应/用户聊天3个节点调API（受3次/分钟限流约束）。
- **展馆**：抓到的玩偶自动入馆，支持 mouse+touch 拖拽自由摆放，可删除/清空。
- **抢夺操控权**：每次抓完后双方选择下一轮谁操控（user↔ai 切换）。

## UNO 游戏（2026-08-01，v1.10.269，已 push）
- **复用麻将架构模式**（做新桌游都适用）：大厅→房间→对局 三段式路由 + Pinia store 持有 `currentRoom.players[]`（座次 east/south/west/north，人固定 south 即 index 0）+ `gameState`（绝不走 query 参数）+ 邀请流（chatStore.chats 单聊 → 双 tab 弹窗 npc/联系人 → push 玩家 → addMessage 系统消息通知角色）+ CSS 渲染牌面 + 翡翠绿视觉。
- **核心文件**：`src/utils/uno/unoEngine.js`（108张标准牌/洗牌/canPlay 匹配/发牌/抽牌堆空回收）、`src/utils/uno/UnoAI.js`（chooseCard 晚出wild/优先同色功能牌、chooseColor 取最多色）、`src/stores/unoStore.js`（回合推进含 direction 顺逆、mustSkip、pendingDraw 叠加、忘喊UNO罚+2、finishGame 结算）、`UnoLobby.vue`/`UnoRoom.vue`/`UnoGame.vue`、`GamesCenter.vue` 入口 + `router/index.js` 三路由。
- **AI 驱动**：`UnoGame.vue` 用 `setTimeout` 850ms 链 + `watch(currentPlayerIndex/phase)` 重排，纯前端、不调 LLM（省公益站 3次/分 配额）。
- **验证手段**：先做无头模拟脚本 `test-uno.mjs`（500 局跑通无死循环/无牌堆耗尽崩溃）再写 UI；`npm run build` + `npm run lint` 0 error。模拟脚本用完即删。

## UNO 游戏（v1.10.270 重构后，已 push）
- **复用麻将架构模式**：大厅→房间→对局三段式 + 用户经济/积分/段位/欢乐豆/排行榜持久化 + 充值 + 创建房间 + AI 局内聊天 + 结算分享。
- **5 种玩法**：经典（standard UNO）/ 叠加（+2/+4 可叠）/ 抢出（同牌可抢出）/ 七零（7 换手、0 传递）/ 极限（全开启）。规则开关存 `gameState.rules`。
- **2-8 人**：用户固定 index 0（南），其余按东南/东/东北/北/西北/西/西南动态入座；座位常量 `POSITION_NAMES`/`SEAT_LABELS` 在 `unoEngine.js` 导出。
- **AI 性格控牌**：`UnoAI.chooseCard(hand, topCard, currentColor, context)` 接收 `relationships`（lover/friend/neutral/rival/enemy）和 `personas`，恋人/好友会避免用 skip/+2/+4 坑用户且用户快赢时放水，对手会针对用户；还有 aggressive/gentle/tricky/calm 性格修正。`inferRelationship` 从 persona/userPersona 文本推断关系。
- **局内聊天**：`unoStore.sendGameChat(text)` 用 batch prompt 调 `generateReply`，所有在场 AI 角色按人设回复，显示气泡 + 聊天记录；`favor:user` 会让该 AI 下一回合偏向帮用户。
- **音效**：`src/utils/uno/unoSounds.js` 用 Web Audio API 合成全部音效，无需额外音频文件；出牌/抽牌/跳过/反转/+2/+4/UNO/胜负/聊天。
- **坑注意**：`buildAIPlayer` 是 async（要从 chatStore 拿角色人设），所以 `addContact/addNPC` 用 `.then()` 异步插入玩家；界面用响应式会自动更新。结算弹窗头像必须用 `isImageAvatar` 判断，否则路径字符串会直接显示成文字。
