import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useLoggerStore } from './stores/loggerStore'
import { notificationService } from './utils/notificationService'
import './style.css'
import '@fortawesome/fontawesome-free/css/all.css'
import './assets/handwriting.css' // v1.10.231: 本地化手写体 (替代 v1.10.205 删除的 Google Fonts), 修复 Android WebView 字体 fallback
import './assets/themes.css' // 主题系统

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

const logger = useLoggerStore(pinia)

// 全局安全日志函数: 即使 loggerStore 自身崩溃也不会丢错误
const safeLog = (type, title, detail) => {
    try {
        if (logger && typeof logger[type] === 'function') {
            logger[type](title, detail)
        }
    } catch (e) {
        console.error('[safeLog] loggerStore itself crashed:', e, '| original:', title, detail)
    }
}

// 1. JS 运行时错误 (同步异常)
window.onerror = (message, source, lineno, colno, error) => {
    const msg = String(message)
    if (
        msg.includes('Receiving end does not exist') ||
        msg.includes('message port closed') ||
        msg.includes('ResizeObserver')
    ) {
        return true
    }
    safeLog('error', 'JS运行时错误', {
        message,
        source,
        lineno,
        colno,
        stack: error?.stack,
        name: error?.name,
    })
    return false
}

// 2. 未捕获的 Promise 拒绝
window.onunhandledrejection = (event) => {
    let reason = event.reason
    const msg = reason?.message || String(reason)
    if (
        msg.includes('Receiving end does not exist') ||
        msg.includes('message port closed') ||
        msg.includes('ResizeObserver')
    ) {
        event.preventDefault()
        return
    }
    if (reason instanceof Error) {
        reason = { message: reason.message, stack: reason.stack, name: reason.name }
    }
    safeLog('error', 'Promise未捕获拒绝', { reason })
}

// 3. 资源加载错误 (script/img/css/link 加载失败, window.onerror 捕获不到)
window.addEventListener(
    'error',
    (event) => {
        const target = event.target
        if (!target || !target.tagName) return // 非 resource error, 交给 window.onerror
        const tag = target.tagName.toLowerCase()
        if (
            tag === 'img' ||
            tag === 'script' ||
            tag === 'link' ||
            tag === 'audio' ||
            tag === 'video'
        ) {
            safeLog('error', '资源加载失败', {
                tag,
                url: target.src || target.href,
                type: event.type,
            })
        }
    },
    true,
) // capture phase, 否则捕获不到 resource error

// 4. Vue 组件错误
app.config.errorHandler = (err, vm, info) => {
    safeLog('error', 'Vue组件错误', {
        error: err?.message || String(err),
        stack: err?.stack,
        info,
        component: vm?.$options?.__name || vm?.$options?.name || 'unknown',
    })
}

// 5. Vue Warning 也记录 (帮助排查潜在问题)
app.config.warnHandler = (msg, vm, trace) => {
    safeLog('warn', 'Vue警告', { message: msg, trace })
}

// --- Navigation Logging (Disabled for noise reduction) ---
// router.afterEach((to, from) => {
//     if (from.path !== to.path) {
//         logger.sys(`页面跳转: ${from.path} -> ${to.path}`, {
//             name: to.name,
//             params: to.params,
//             query: to.query
//         })
//     }
// })

// Initial System Info (Disabled for noise reduction)
// logger.sys('系统启动', {
//     userAgent: navigator.userAgent,
//     screen: `${window.screen.width}x${window.screen.height}`,
//     platform: navigator.platform
// })

// try-catch 包裹 mount: 如果 Vue 挂载时报错 (比如路由初始化失败),
// 显示错误信息而不是一直转圈.
try {
    app.mount('#app')
} catch (e) {
    console.error('Vue mount failed:', e)
    safeLog('error', 'Vue挂载崩溃', { message: e?.message, stack: e?.stack, name: e?.name })
    var splash = document.getElementById('native-splash')
    if (splash) {
        splash.innerHTML =
            '<div style="text-align:center;padding:20px;font-family:-apple-system,sans-serif;color:#475569">' +
            '<div style="font-size:48px;margin-bottom:16px">❄️</div>' +
            '<div style="font-size:16px;font-weight:600;color:#ef4444;margin-bottom:8px">启动失败</div>' +
            '<div style="font-size:11px;opacity:0.7;word-break:break-all;padding:0 16px">' +
            (e && e.message ? e.message : String(e)) +
            '</div>' +
            '<div style="font-size:10px;opacity:0.5;margin-top:12px">错误已记录到系统日志</div></div>'
    }
}

// Initialize Notification Service (v1.10.120: 仅注册SW用于PWA离线缓存,不再启动时请求通知权限)
const initNotificationService = async () => {
    try {
        // 在 native APP 里 (WebViewAssetLoader origin) 跳过 SW 注册.
        // appassets.androidplatform.net 不是真实域名, /sw.js 请求 DNS 失败会 hang,
        // 可能阻塞浏览器网络队列. native APP 不需要 SW 离线缓存 (资源已在 APK 内).
        if (window.ChillyNative) {
            console.log('Native app detected, skipping Service Worker registration')
            return
        }
        // Register Service Worker for PWA offline cache
        if (notificationService.isServiceWorkerSupported()) {
            await notificationService.registerServiceWorker()
            logger.sys('Service Worker 注册成功')
        }
    } catch (error) {
        logger.error('Service Worker 注册失败', { error: error.message })
    }
}

initNotificationService()

// Provide notification service globally for easy access
app.provide('notificationService', notificationService)
