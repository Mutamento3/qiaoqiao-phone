// UNO 音效：优先使用收集的真实音频文件（public/sounds/uno/*.mp3，绝对路径以兼容 PWA 与原生 WebView）。
// 未提供文件的轻量 UI 音效（play / draw / shuffle / chat）仍用 Web Audio 合成兜底。
// 背景音乐、胜利/失败、人声 UNO、四色人声、加2/加4/反转/禁止牌 均来自真实文件。
import { useUnoStore } from '../../stores/unoStore.js'

const BASE = '/sounds/uno/'

// 真实音频文件映射（事件名 -> 文件名）
const FILE_MAP = {
    win: 'win.mp3',
    lose: 'lose.mp3',
    skip: 'vocal_skip.mp3', // 禁止牌
    reverse: 'vocal_reverse.mp3',
    draw2: 'vocal_draw2.mp3', // +2
    wild4: 'vocal_draw4.mp3', // +4
    uno: 'vocal_uno.mp3' // 人声 UNO
}

// 颜色人声映射
const COLOR_VOICE = {
    red: 'vocal_red.mp3',
    yellow: 'vocal_yellow.mp3',
    green: 'vocal_green.mp3',
    blue: 'vocal_blue.mp3'
}

// ===== 读取 store 中的开关与音量（避免循环依赖：store 不引用本模块）=====
function readFlags() {
    try {
        const store = useUnoStore()
        return {
            soundEnabled: store.soundEnabled !== false,
            bgmEnabled: store.bgmEnabled !== false,
            voiceEnabled: store.voiceEnabled !== false,
            sfxVolume: typeof store.sfxVolume === 'number' ? store.sfxVolume : 0.8,
            bgmVolume: typeof store.bgmVolume === 'number' ? store.bgmVolume : 0.5
        }
    } catch (e) {
        return { soundEnabled: true, bgmEnabled: true, voiceEnabled: true, sfxVolume: 0.8, bgmVolume: 0.5 }
    }
}

// ===== Web Audio 合成兜底（仅用于 play/draw/shuffle/chat）=====
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
function noise(duration, vol = 0.2) {
    const ctx = getCtx()
    if (!ctx) return
    const bufferSize = ctx.sampleRate * duration
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(vol, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    source.connect(gain)
    gain.connect(ctx.destination)
    source.start()
    source.stop(ctx.currentTime + duration)
}

// ===== 播放真实音频文件 =====
function playByName(fileName, volumeMult = 1) {
    const flags = readFlags()
    if (!flags.soundEnabled) return
    if (!fileName) return
    const el = new Audio(BASE + fileName)
    el.volume = Math.min(1, Math.max(0, flags.sfxVolume * volumeMult))
    el.preload = 'auto'
    const p = el.play()
    if (p && p.catch) p.catch(() => { /* 自动播放策略拦截，忽略 */ })
}

// ===== 对外 API =====
export function playSound(name, opts = {}) {
    if (name === 'uno') {
        const flags = readFlags()
        if (!flags.soundEnabled) return
        if (flags.voiceEnabled) playByName(FILE_MAP.uno, 1)
        else { // 无语音时回退合成提示音
            unlock()
            tone(900, 0.12, 'square', 0.2)
            setTimeout(() => tone(1300, 0.18, 'square', 0.25), 80)
        }
        return
    }
    if (FILE_MAP[name]) {
        playByName(FILE_MAP[name], 1)
        return
    }
    // 合成兜底
    if (name === 'play') { unlock(); tone(880, 0.08, 'square', 0.15) }
    else if (name === 'draw') { unlock(); noise(0.08, 0.08) }
    else if (name === 'shuffle') { unlock(); noise(0.18, 0.12) }
    else if (name === 'chat') { unlock(); tone(1000, 0.06, 'sine', 0.15) }
}

// 万能牌选色时播放对应颜色人声
export function playColorVoice(color) {
    const fileName = COLOR_VOICE[color]
    if (fileName) playByName(fileName, 1)
}

// ===== 背景音乐 =====
let bgmEl = null
export function startBGM() {
    const flags = readFlags()
    if (!flags.bgmEnabled) return
    if (!bgmEl) {
        bgmEl = new Audio(BASE + 'bgm.mp3')
        bgmEl.loop = true
        bgmEl.preload = 'auto'
    }
    bgmEl.volume = Math.min(1, Math.max(0, flags.bgmVolume))
    if (bgmEl.paused) {
        const p = bgmEl.play()
        if (p && p.catch) p.catch(() => {})
    }
}
export function stopBGM() {
    if (bgmEl) { bgmEl.pause(); try { bgmEl.currentTime = 0 } catch (e) {} }
}
export function setBgmVolume(v) {
    if (bgmEl) bgmEl.volume = Math.min(1, Math.max(0, v))
}

// 解锁音频上下文（移动端首次交互前无法播放）
export function unlockAudio() {
    unlock()
}
