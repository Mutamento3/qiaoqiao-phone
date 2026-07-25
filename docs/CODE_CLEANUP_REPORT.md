# 代码质量清理 Sprint 报告（25 个 ESLint error）

> 日期：2026-07-25 · 执行：Senior Developer（技术负责人）
> 状态：**已全部清理，全仓 ESLint error = 0，构建通过（dist = v1.10.233）**
> 注意：**本次改动尚未 push**（用户仍在攒改动一起提交）

## 结论：会不会破坏功能？

**不会。** 25 个 error 全部是"会悄悄进生产的真 bug"，但绝大多数属于死代码 / 纯包裹 / 被覆盖的死值——清理后运行时行为零变化。仅 2 处涉及语义，已做最小保守修改并构建验证。

## 分类清单

### A 类 · 机械安全（19 个，零风险）
| 文件 | 行 | 规则 | 修复 | 风险 |
|---|---|---|---|---|
| audit-stores.mjs | 19/24/25/26 + 23 | no-unused-vars | 删除废弃的 startIdx/depth/setupStartLine 等死变量 + 空 for 循环 | 无（一次性审计脚本死代码） |
| chatStore.js | 1361 | no-dupe-else-if | 删除 `else if (depth===0 && ch===']')` 死分支（`]` 已被上层 `else if` 命中，永不可达） | 无 |
| phoneInspectionStore.js | 988 | no-redeclare | 删除旧的 `fixCommonJsonErrors`（1741 的同名新实现已覆盖，988 是死代码） | 无（1741 更健壮，运行时早用它） |
| MahjongGame.vue | 1807-1808 | no-case-declarations | `case 'hu'/'zimo'` 体加 `{}` 块作用域 | 无 |
| OfflineModeChatWindow.vue | 1448/1463 | no-case-declarations | `'fav'`/`'listen'` case 体加 `{}` | 无 |
| PhoneDesktop.vue | 47/78 | vue/no-unused-vars | v-for 去掉未用 `index` | 无 |
| StorageSettings.vue | 89 | no-prototype-builtins | `localStorage.hasOwnProperty` → `Object.prototype.hasOwnProperty.call` | 无 |
| ProfileView.vue | 149 | vue/no-unused-vars | v-for 去掉未用 `idx` | 无 |
| ChatMessageItem.vue | 1208 | vue/no-dupe-v-else-if | 删除重复的 `link_card` 渲染分支（649 已处理，1208 不可达） | 无 |
| ChatInnerVoiceCard.vue | 278 | vue/no-unused-vars | v-for 去掉未用 `idx` | 无 |
| GroupAnnouncementModal.vue | 60 | vue/no-unused-vars | v-for 去掉未用 `idx` | 无 |
| TarotModal.vue | 230 | vue/no-unused-vars | 仅删 230 行未用 `index`（126/146/211 行的 index 仍在使用，已核对） | 无 |

### B 类 · 需判断（6 个，已保守处理）
| 文件 | 行 | 规则 | 修复 | 风险 |
|---|---|---|---|---|
| App.vue | 460 | vue/require-component-is | `<component is="style">` → `<component :is="'style'">` | 极低（渲染同样 `<style>`） |
| SafeHtmlCard.vue | 119 | vue/no-side-effects-in-computed-properties | 把 `isFullPage.value=true` 移出 computed，改由 `watch(()=>props.content, {immediate:true})` 驱动 | 低，且**顺带修了潜伏 bug**：之前 content 从全屏 HTML 切回片段时 `isFullPage` 不会复位 false |
| calendarStore.js | 1201 | no-dupe-keys | 删除重复的 `updatePeriodSettings`（1178 已导出） | 无（同函数，后者覆盖前者，值相同） |
| chatStore.js | 5999 | no-dupe-keys | 删除重复的 `createChat`（5993 已导出） | 无 |
| ChatDetailSettings.vue | 2350 | no-dupe-keys | 删除重复的 `avatarShape: 'square'`（2307 已定义） | 无 |
| ChatWindow.vue | 2452 | no-misleading-character-class | 加 `eslint-disable-next-line` 注释（正则故意含 4 种不同零宽字符需全部剥离，lint 误报） | 无（行为完全不变） |

## 验证
- `eslint .` → **0 error**（清理前 25 error）
- `npm run build` → 通过，dist = v1.10.233（minify 已开，main.js 3.7MB）

## 建议 smoke-test（用户侧点测兜底）
逻辑层改动无法在浏览器验证，建议重点回归：
1. **情侣空间 / 世界书 HTML 卡片**：SafeHtmlCard 全屏 HTML 渲染 + iframe 滚动是否正常
2. **链接分享卡片**：聊天里 link_card 类型消息是否正常显示
3. **塔罗牌**：牌阵缩略图 / 翻牌动画（index 相关）
4. **麻将**：胡牌/自摸文案
5. **收藏 / TTS 听音**：离线聊天长按菜单
