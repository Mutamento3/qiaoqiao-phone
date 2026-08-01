// UNO 音效：使用 Web Audio API 合成，无需外部音频文件
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
    uno() {
        unlock()
        tone(1200, 0.12, 'square', 0.25)
        setTimeout(() => tone(1500, 0.18, 'square', 0.25), 120)
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

export function playSound(name) {
    if (SOUNDS[name]) SOUNDS[name]()
}

export function unlockAudio() {
    unlock()
}
