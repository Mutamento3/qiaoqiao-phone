import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useSchedulerStore = defineStore('scheduler', () => {
    // Shared Scheduled Tasks
    const tasks = ref([])

    // Random proactive configs per chat
    // { chatId: { enabled: bool, min: num, max: num, nextTrigger: timestamp } }
    const randomConfigs = ref({})

    function loadFromStorage() {
        const savedTasks = localStorage.getItem('qiaoqiao_scheduled_tasks')
        if (savedTasks) {
            try {
                tasks.value = JSON.parse(savedTasks)
            } catch (e) {
                console.error('Failed to load tasks', e)
                tasks.value = []
            }
        }

        const savedConfigs = localStorage.getItem('qiaoqiao_random_proactive_configs')
        if (savedConfigs) {
            try {
                randomConfigs.value = JSON.parse(savedConfigs)
            } catch (e) {
                console.error('Failed to load random configs', e)
                randomConfigs.value = {}
            }
        }
    }

    function saveTasks() {
        try {
            localStorage.setItem('qiaoqiao_scheduled_tasks', JSON.stringify(tasks.value))
        } catch (e) {
            console.error('[Scheduler] Failed to save tasks to localStorage:', e);
            // It's still in memory, so it works for the current session
        }
    }

    function saveConfigs() {
        try {
            localStorage.setItem('qiaoqiao_random_proactive_configs', JSON.stringify(randomConfigs.value))
        } catch (e) {
            console.error('[Scheduler] Failed to save configs to localStorage:', e);
        }
    }

    // Parse a time spec that may be mixed with task text.
    // Supports: "30分钟后", "2小时后", "10秒后", "X min/hour/s",
    // "HH:mm" / "下午3点", "今天/明天 HH:mm",
    // "2026-02-06 10:00" / "2026年2月6日 10点".
    function parseTimeSpec(rawStr) {
        const s = (rawStr || '').trim()
        const now = new Date()

        // 1. Relative: X 分钟/小时/秒
        const rel = s.match(/(\d+)\s*(分钟|分|min|小时|时|hour|h|秒|s|sec)/i)
        if (rel) {
            const num = parseInt(rel[1])
            const unit = rel[2].toLowerCase()
            let ms = 0
            if (unit.includes('分') || unit === 'min') ms = num * 60 * 1000
            else if (unit.includes('时') || unit === 'h' || unit === 'hour') ms = num * 60 * 60 * 1000
            else ms = num * 1000
            return { timestamp: now.getTime() + ms, ok: true }
        }

        // 2. Absolute datetime with date
        const dt = s.match(/(\d{4})[-年\/](\d{1,2})[-月\/](\d{1,2})日?\s*(\d{1,2})[:：点](\d{1,2})/)
        if (dt) {
            const target = new Date(+dt[1], +dt[2] - 1, +dt[3], +dt[4], +dt[5])
            if (!isNaN(target.getTime())) return { timestamp: target.getTime(), ok: true }
        }

        // 3. 今天/明天/上午/下午 HH:mm (or bare HH:mm)
        const hm = s.match(/(今天|今日|明天|明日|上午|下午|晚上|中午)?\s*(\d{1,2})[:：点](\d{0,2})/)
        if (hm) {
            let hours = parseInt(hm[2])
            const minutes = parseInt(hm[3] || '0')
            if (hm[1]) {
                const period = hm[1]
                if (period.includes('下午') || period.includes('晚上')) { if (hours < 12) hours += 12 }
                else if (period.includes('上午')) { if (hours === 12) hours = 0 }
                else if (period.includes('中午')) hours = 12
            }
            const base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes)
            if (base <= now) base.setDate(base.getDate() + 1) // 已过则明天
            return { timestamp: base.getTime(), ok: true }
        }

        return { timestamp: NaN, ok: false }
    }

    function addTask(chatId, timeStr, content) {
        console.log('[Scheduler] Attempting to add task:', { chatId, timeStr, content });

        const { timestamp, ok } = parseTimeSpec(timeStr)
        if (!ok || isNaN(timestamp)) {
            console.error('[Scheduler] Invalid time spec:', timeStr);
            return false
        }

        console.log('[Scheduler] Task time parsed successfully:', new Date(timestamp).toLocaleString());

        const newTask = {
            id: Date.now() + Math.random().toString(36).substr(2, 5),
            chatId,
            timestamp,
            content: (content || timeStr).trim(),
            enabled: true,
            createdAt: Date.now()
        }

        tasks.value.push(newTask)
        saveTasks()
        return timestamp
    }

    function removeTask(id) {
        tasks.value = tasks.value.filter(t => t.id !== id)
        saveTasks()
    }

    function toggleTask(id) {
        const task = tasks.value.find(t => t.id === id)
        if (task) {
            task.enabled = !task.enabled
            saveTasks()
        }
    }

    // NOTE: 到期任务的"触发并让角色发提醒"统一由 chatStore 的 proactive 循环
    // (startProactiveLoop, 每 60s + 切前台/刷新补偿) 处理, 见 chatStore.js checkProactive()。
    // 这里不再跑独立的 15s checkDueTasks —— 它会抢先把任务 enabled=false 并派发无人监听的事件,
    // 导致 proactive 永远捞不到、提醒被静默丢弃。

    function setRandomConfig(chatId, { enabled, min, max }) {
        // [BUG FIX] `parseInt(min) || 30` 在 min=0 时被吞: parseInt(0) === 0 是 falsy,
        // 结果变成 30. 用户想"立刻触发" (min=0) 会被静默改成 30 分钟后.
        // 改用 ?? 只在 null/undefined/NaN 时回退.
        // 注意 parseInt 返回 NaN 时, NaN ?? 30 仍是 NaN (NaN 不是 null/undefined),
        // 所以单独判 isNaN.
        const parsedMin = parseInt(min)
        const parsedMax = parseInt(max)
        const config = {
            enabled,
            min: Number.isFinite(parsedMin) ? parsedMin : 30,
            max: Number.isFinite(parsedMax) ? parsedMax : 120,
            nextTrigger: 0
        }

        // If enabling, calculate first trigger time
        if (enabled) {
            const delay = Math.floor(Math.random() * (config.max - config.min + 1) + config.min)
            config.nextTrigger = Date.now() + delay * 60000
        }

        randomConfigs.value[chatId] = config
        saveConfigs()
    }

    function updateNextRandomTrigger(chatId) {
        const config = randomConfigs.value[chatId]
        if (config && config.enabled) {
            const delay = Math.floor(Math.random() * (config.max - config.min + 1) + config.min)
            config.nextTrigger = Date.now() + delay * 60000
            saveConfigs()
        }
    }

    // Init
    loadFromStorage()

    return {
        tasks,
        randomConfigs,
        addTask,
        removeTask,
        toggleTask,
        setRandomConfig,
        updateNextRandomTrigger,
        saveTasks
    }
})
