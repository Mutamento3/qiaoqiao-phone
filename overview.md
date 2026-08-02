# 定时提醒功能修复说明（1.10.244）

## 问题现象（用户报）
1. 定时提醒「角色设置后到点应该自动调用」现在没反应了。
2. 功能里的「定时列表」(MissionSchedulerModal) 一直是空的，不显示已设的定时。

## 根因（两处互相呼应）
- `chatStore.js` 处理 AI 回的 `[定时:...]` 时只用 `setTimeout` 单次触发，**从不写入 `schedulerStore.tasks`** —— 所以列表永远空；且长延时（如"明早8点"）在页面切走/刷新后失效。
- `schedulerStore.checkDueTasks` 每 15s 把到期任务 `enabled=false` 并派发一个**没人监听**的事件，比每 60s 的 proactive 主动循环（本来会正经让 AI 发提醒）抢先"吃掉"任务 → 到点静默丢弃。
- 原本该把任务写进调度器的 `taskUtils.processTaskCommands` 是**死代码**，从未被调用。

## 修复
- `schedulerStore.addTask` 改用 `parseTimeSpec()`，支持：
  - 相对：`30分钟后` / `2小时后` / `10秒后` / `X min|hour|s`
  - 绝对：`2026-02-06 10:00` / `2026年2月6日10点`
  - 上下午/今天明天：`下午3点` / `明天 08:00` / `晚上11点`
  - 返回 timestamp（成功）或 false（解析失败）。
- **删除** `checkDueTasks` + `startProcessor`（及 init 调用），去掉无人监听的事件派发，消除抢任务的 race。
- 到期触发统一交给 `checkProactive`（60s + 切前台/刷新补偿）：对到期任务 `removeTask` 并 `sendMessageToAI(hiddenHint)`，**让角色以人设口吻发提醒**。
- `chatStore` 的 timer 分支改为 `schedulerStore.addTask(...)`，保留「定时提醒」玻璃气泡 + toast，去掉 `setTimeout`。

## 验证
- 构建通过；`parseTimeSpec` node 单测 9 例全过（含非法串返回失败）。
- 已推送到 `chilly520/qiaoqiao-phone`，CI 自动打 tag `v1.10.244` + `v1.10.244-native`。

## 用法
聊天里让 AI 设提醒即可，例如：
- "30分钟后提醒我倒垃圾"
- "明早八点叫我起床"
- "下午3点取快递"
设好后「定时列表」里能看到，到点角色会主动发消息提醒你。

## 已知边界（未改，避免扩大范围）
深夜 23:00–06:59 的「睡眠静默」规则对定时任务同样生效，可能把深夜提醒压成环境描写。若需在深夜也强制提醒，需另开白名单。
