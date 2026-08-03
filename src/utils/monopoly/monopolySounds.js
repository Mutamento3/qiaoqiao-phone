// 帕瓦小镇大富翁 音效：复用现有收集的真实音频文件（绝对路径 /sounds/...，兼容 PWA 与原生 WebView）。
// 背景音乐、掷骰/买地/付租/盖房/抽卡/胜负/聊天 均来自真实文件；
// 轻量 UI 提示音（click 等）用 Web Audio 合成兜底。
// 结构参考 src/utils/uno/unoSounds.js。
import { useMonopolyStore } from '../../stores/monopolyStore.js'

const BASE = '/sounds/'

// 真实音频文件映射（事件名 -> 相对于 /sounds/ 的路径）
const FILE_MAP = {
    rollDice: 'mahjong/掷骰子.MP3',
    buy: 'wechat/coins.mp3',
    rent: 'wechat/coins.mp3',
    build: 'mahjong/我方起牌.MP3',
    drawCard: 'mahjong/发牌.MP3',
    useCard: null, // 用合成魔法音，不用文件（发牌音不适合道具卡）
    win: 'uno/win.mp3',
    lose: 'uno/lose.mp3',
    chat: 'wechat/notification.mp3',
}

const BGM_FILE = 'uno/bgm.mp3'

// ===== 读取 store 中的开关（避免循环依赖：store 不引用本模块）=====
function readFlags() {
    try {
        const store = useMonopolyStore()
        const s = store.settings || {}
        return {
            soundEnabled: s.soundEnabled !== false,
            bgmEnabled: s.bgmEnabled !== false,
        }
    } catch (e) {
        return { soundEnabled: true, bgmEnabled: true }
    }
}

// ===== Web Audio 合成兜底（仅用于 click 等通用 UI 提示音）=====
let audioCtx = null
function getCtx() {
    if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext
        if (AC) audioCtx = new AC()
    }
    return audioCtx
}
function unlock() {
    const ctx = getCtx()
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
}
function tone(freq, duration, type = 'sine', vol = 0.3, slideTo = null) {
    const ctx = getCtx()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, ctx.currentTime)
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 1), ctx.currentTime + duration)
    gain.gain.setValueAtTime(vol, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + duration)
}

// ===== 播放真实音频文件 =====
function playByName(fileName, volumeMult = 1) {
    const flags = readFlags()
    if (!flags.soundEnabled) return
    if (!fileName) return
    unlock() // 确保音频上下文已解锁，提高自动播放成功率
    const el = new Audio(BASE + fileName)
    el.volume = Math.min(1, Math.max(0, volumeMult))
    el.preload = 'auto'
    const p = el.play()
    if (p && p.catch) p.catch(() => { /* 自动播放策略拦截，忽略 */ })
}

// ===== 对外 API =====
export function playSound(name, opts = {}) {
    const flags = readFlags()
    if (!flags.soundEnabled) return
    const f = FILE_MAP[name]
    if (f) {
        playByName(f, 1)
        return
    }
    // 合成兜底：通用按钮点击 / 提示音
    unlock()
    if (name === 'click') tone(880, 0.06, 'square', 0.18)
    else if (name === 'useCard') {
        // 道具卡魔法音：上升琶音 + 闪烁高音
        tone(523, 0.1, 'sine', 0.2, 784)
        setTimeout(() => tone(784, 0.1, 'sine', 0.18, 1047), 60)
        setTimeout(() => tone(1047, 0.15, 'sine', 0.15), 120)
    }
    else tone(660, 0.05, 'sine', 0.15)
}

// ===== 背景音乐 =====
let bgmEl = null
export function startBGM() {
    const flags = readFlags()
    if (!flags.bgmEnabled) return
    if (!bgmEl) {
        bgmEl = new Audio(BASE + BGM_FILE)
        bgmEl.loop = true
        bgmEl.preload = 'auto'
    }
    bgmEl.volume = 0.5
    if (bgmEl.paused) {
        const p = bgmEl.play()
        if (p && p.catch) p.catch(() => {})
    }
}
export function stopBGM() {
    if (!bgmEl) return
    try { bgmEl.pause() } catch (e) {}
    try { bgmEl.currentTime = 0 } catch (e) {}
    // 彻底销毁元素，避免原生 WebView 中 loop 音频 pause 后仍残留播放，
    // 也避免后续 startBGM 误 resume 已停的实例。
    try { bgmEl.src = '' } catch (e) {}
    try { bgmEl.load() } catch (e) {}
    bgmEl = null
}
export function setBgmVolume(v) {
    if (bgmEl) bgmEl.volume = Math.min(1, Math.max(0, v))
}

// 解锁音频上下文（移动端首次交互前无法播放）
export function unlockAudio() {
    unlock()
}
