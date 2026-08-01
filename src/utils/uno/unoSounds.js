// UNO 音效：使用 Web Audio API 合成，无需外部音频文件
// 额外使用浏览器语音合成实现“大喊 UNO”的人声效果
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
    if (slideTo !== null) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 1), ctx.currentTime + duration)
    }
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

function vocalShout(duration = 0.35, vol = 0.25) {
    // 模拟人声呼喊：噪声 + 快速扫频 + 轻微颤音
    const ctx = getCtx()
    if (!ctx) return
    const bufferSize = ctx.sampleRate * duration
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
        const t = i / ctx.sampleRate
        const f0 = 300 + t * 400 // 300Hz -> 700Hz
        const vibrato = Math.sin(t * 30) * 0.08
        const carrier = Math.sin((f0 * t + Math.sin(t * 12) * 5) * Math.PI * 2)
        const noisy = (Math.random() * 2 - 1) * 0.35
        const env = Math.max(0, 1 - t / duration)
        data[i] = (carrier * 0.65 + noisy) * env * (1 + vibrato)
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(vol, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    source.connect(gain)
    gain.connect(ctx.destination)
    source.start()
}

// 使用浏览器语音合成喊“UNO!”
export function speakUNO(enabled = true) {
    if (!enabled) return
    if (typeof window === 'undefined') return
    const synth = window.speechSynthesis
    if (!synth) return
    try {
        const u = new SpeechSynthesisUtterance('UNO!')
        u.lang = 'en-US'
        u.pitch = 1.5
        u.rate = 1.4
        u.volume = 1.0
        synth.cancel()
        synth.speak(u)
    } catch (e) {
        console.warn('[UNO] 语音合成失败', e)
    }
}

const SOUNDS = {
    play() {
        unlock()
        tone(880, 0.08, 'square', 0.15)
        setTimeout(() => tone(1100, 0.06, 'square', 0.1), 40)
    },
    draw() {
        unlock()
        noise(0.08, 0.08)
    },
    shuffle() {
        unlock()
        noise(0.18, 0.12)
    },
    skip() {
        unlock()
        tone(600, 0.12, 'sawtooth', 0.2, 200)
    },
    reverse() {
        unlock()
        tone(400, 0.15, 'sawtooth', 0.2, 800)
    },
    draw2() {
        unlock()
        tone(500, 0.1, 'square', 0.2)
        setTimeout(() => tone(500, 0.1, 'square', 0.2), 120)
    },
    wild4() {
        unlock()
        tone(300, 0.12, 'sawtooth', 0.25, 100)
        setTimeout(() => tone(350, 0.12, 'sawtooth', 0.25, 120), 130)
        setTimeout(() => tone(400, 0.12, 'sawtooth', 0.25, 150), 260)
    },
    uno(opts = {}) {
        unlock()
        // 电子音效 + 模拟人声呼喊
        tone(900, 0.12, 'square', 0.2)
        setTimeout(() => tone(1300, 0.18, 'square', 0.25), 80)
        setTimeout(() => vocalShout(0.35, 0.22), 60)
        // 同步触发语音合成“UNO!”
        speakUNO(opts.voiceEnabled !== false)
    },
    win() {
        unlock()
        ;[523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'sine', 0.25), i * 120))
    },
    lose() {
        unlock()
        ;[440, 349, 294, 220].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'sine', 0.25), i * 140))
    },
    chat() {
        unlock()
        tone(1000, 0.06, 'sine', 0.15)
    }
}

export function playSound(name, opts = {}) {
    if (SOUNDS[name]) SOUNDS[name](opts)
}

export function unlockAudio() {
    unlock()
}
