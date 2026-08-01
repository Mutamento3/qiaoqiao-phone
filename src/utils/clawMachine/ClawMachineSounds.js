/**
 * 娃娃机音效与 BGM
 * 优先使用真实音频文件（public/sounds/claw-machine/*.mp3）。
 * 轻量 UI 音效（移动、下勾、抓取、投币、抓中/失败）用 Web Audio 合成兜底。
 */
import { useClawMachineStore } from '../../stores/clawMachineStore.js'

const BASE = '/sounds/claw-machine/'

// ===== 读取 store 中的开关与音量（避免循环依赖：store 不引用本模块）=====
function readFlags() {
    try {
        const store = useClawMachineStore()
        return {
            soundEnabled: store.soundEnabled !== false,
            bgmEnabled: store.bgmEnabled !== false,
            sfxVolume: typeof store.sfxVolume === 'number' ? store.sfxVolume : 0.8,
            bgmVolume: typeof store.bgmVolume === 'number' ? store.bgmVolume : 0.45,
        }
    } catch (e) {
        return { soundEnabled: true, bgmEnabled: true, sfxVolume: 0.8, bgmVolume: 0.45 }
    }
}

// ===== Web Audio 合成兜底 =====
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
    // 若 BGM 因浏览器自动播放策略被暂停，用户首次交互时尝试恢复
    try {
        if (bgmEl && bgmEl.paused) {
            const flags = readFlags()
            if (flags.bgmEnabled) {
                bgmEl.volume = Math.min(1, Math.max(0, flags.bgmVolume))
                const p = bgmEl.play()
                if (p && p.catch) p.catch(() => {})
            }
        }
    } catch (e) {
        // ignore
    }
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
function thump(vol = 0.3) {
    const ctx = getCtx()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.setValueAtTime(120, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.12)
    gain.gain.setValueAtTime(vol, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.12)
}

// ===== 播放真实音频文件（一次性音效）=====
function playByName(fileName, volumeMult = 1) {
    const flags = readFlags()
    if (!flags.soundEnabled) return
    if (!fileName) return
    unlock()
    const el = new Audio(BASE + fileName)
    el.volume = Math.min(1, Math.max(0, flags.sfxVolume * volumeMult))
    el.preload = 'auto'
    const p = el.play()
    if (p && p.catch) p.catch(() => {})
}

// ===== 对外 API：操作音效 =====
export function playSound(name, opts = {}) {
    const flags = readFlags()
    if (!flags.soundEnabled) return
    unlock()
    const vol = flags.sfxVolume * (opts.volume || 1)

    switch (name) {
        case 'move':
            // 轻快短促的机械移动声
            tone(600, 0.04, 'sine', vol * 0.18)
            break
        case 'drop':
            // 下勾：电机嗡嗡声 + 轻微摩擦
            tone(220, 0.25, 'sawtooth', vol * 0.12, 180)
            break
        case 'grab':
            // 爪子闭合：咔哒
            thump(vol * 0.6)
            setTimeout(() => tone(880, 0.05, 'square', vol * 0.15), 60)
            break
        case 'coin':
            // 投币：清脆金属声
            tone(1200, 0.06, 'sine', vol * 0.25)
            setTimeout(() => tone(1800, 0.08, 'sine', vol * 0.2), 60)
            break
        case 'win':
            // 抓中：欢快上升音阶
            tone(523, 0.1, 'sine', vol * 0.3)
            setTimeout(() => tone(659, 0.1, 'sine', vol * 0.3), 90)
            setTimeout(() => tone(784, 0.15, 'sine', vol * 0.35), 180)
            break
        case 'fail':
            // 没抓中：失落下滑
            tone(350, 0.18, 'sine', vol * 0.25, 220)
            break
        case 'switch':
            // 切换模式/操控权
            tone(440, 0.06, 'sine', vol * 0.2)
            break
        case 'pop':
            // 气泡出现
            tone(900, 0.04, 'sine', vol * 0.12)
            break
        default:
            break
    }
}

// ===== 背景音乐：两首随机循环 =====
let bgmEl = null
let currentBgmIndex = -1

function pickNextBgm() {
    // 两首随机，尽量避免连续重复
    const next = Math.random() < 0.5 ? 1 : 2
    if (next === currentBgmIndex) return next === 1 ? 2 : 1
    return next
}

export function startBGM() {
    const flags = readFlags()
    if (!flags.bgmEnabled) return
    unlock()
    if (!bgmEl) {
        currentBgmIndex = pickNextBgm()
        bgmEl = new Audio(BASE + `bgm${currentBgmIndex}.mp3`)
        bgmEl.loop = false
        bgmEl.preload = 'auto'
        bgmEl.addEventListener('ended', () => {
            // 一首歌放完，随机切另一首继续循环
            currentBgmIndex = pickNextBgm()
            bgmEl.src = BASE + `bgm${currentBgmIndex}.mp3`
            bgmEl.load()
            const p = bgmEl.play()
            if (p && p.catch) p.catch(() => {})
        })
    }
    bgmEl.volume = Math.min(1, Math.max(0, flags.bgmVolume))
    if (bgmEl.paused) {
        const p = bgmEl.play()
        if (p && p.catch) p.catch(() => {})
    }
}

export function stopBGM() {
    if (!bgmEl) return
    try { bgmEl.pause() } catch (e) {}
    try { bgmEl.currentTime = 0 } catch (e) {}
    try { bgmEl.src = '' } catch (e) {}
    try { bgmEl.load() } catch (e) {}
    bgmEl = null
    currentBgmIndex = -1
}

export function setBgmVolume(v) {
    if (bgmEl) bgmEl.volume = Math.min(1, Math.max(0, v))
}

export function unlockAudio() {
    unlock()
}
