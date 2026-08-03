<template>
  <div ref="rootEl" class="dice3d-root">
    <!-- 纯 CSS 萌系骰子（无 Three.js / 无黑角） -->
    <div class="dice-pair">
      <div class="cute-die die-a" :class="{ rolling }" :style="{ animationDelay: '0ms' }">
        <span v-for="(on, i) in cells(show1)" :key="'a' + i" class="pip" :class="{ on }"></span>
      </div>
      <div class="cute-die die-b" :class="{ rolling }" :style="{ animationDelay: '50ms' }">
        <span v-for="(on, i) in cells(show2)" :key="'b' + i" class="pip" :class="{ on }"></span>
      </div>
    </div>

    <!-- 落地涟漪特效 -->
    <div class="dice-ripple" :class="{ show: landed }"></div>

    <div class="dice3d-hint">{{ playerName || '玩家' }} 掷骰中…</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  d1: { type: Number, default: 1 },
  d2: { type: Number, default: 1 },
  playerName: { type: String, default: '' },
})
const emit = defineEmits(['done'])

const rootEl = ref(null)
const rolling = ref(true)
const landed = ref(false)
const show1 = ref(1)
const show2 = ref(1)

// 9 宫格点位映射（index 0-8 对应左上→右下）
const PIP_MAP = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}
function cells(face) {
  const set = new Set(PIP_MAP[face] || [])
  return [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => set.has(i))
}

let shuffleIv = null
let settleTimer = null
let doneTimer = null
let finished = false

onMounted(() => {
  // 等下一帧确保容器已布局
  requestAnimationFrame(() => {
    // 演出期快速翻面，模拟翻滚
    shuffleIv = setInterval(() => {
      show1.value = 1 + Math.floor(Math.random() * 6)
      show2.value = 1 + Math.floor(Math.random() * 6)
    }, 70)

    // 落地：停止翻面、定格到最终结果、触发涟漪
    settleTimer = setTimeout(() => {
      if (shuffleIv) { clearInterval(shuffleIv); shuffleIv = null }
      show1.value = props.d1
      show2.value = props.d2
      rolling.value = false
      landed.value = true
      setTimeout(() => { landed.value = false }, 350)
    }, 660)

    // 演出结束（落在中央四方格上方→回弹后），通知父组件继续流程
    doneTimer = setTimeout(() => {
      if (!finished) { finished = true; emit('done') }
    }, 900)
  })
})

onBeforeUnmount(() => {
  // 保险：若组件被强制卸载（如切后台/异常），仍通知父组件继续流程，避免卡住 dice 态
  if (!finished) emit('done')
  if (shuffleIv) clearInterval(shuffleIv)
  if (settleTimer) clearTimeout(settleTimer)
  if (doneTimer) clearTimeout(doneTimer)
})
</script>

<style scoped>
.dice3d-root {
  position: absolute;
  inset: 0;
  z-index: 9;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 只让骰子演出出现在棋盘中央，不拦截棋盘交互 */
  pointer-events: none;
}

.dice-pair {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
}

/* ===== 萌系骰子（奶油糖果骰，参考视觉规格第 1 节） ===== */
.cute-die {
  position: relative;
  width: 62px;
  height: 62px;
  border-radius: 14px;
  background: linear-gradient(145deg, #FFFDF7 0%, #FFE8B8 100%);
  border: 2px solid rgba(255, 255, 255, 0.9);
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.9),
    inset 0 -3px 0 rgba(212, 172, 13, 0.12),
    0 6px 0 #F4D03F,
    0 10px 18px rgba(0, 0, 0, 0.18),
    0 0 0 1.5px rgba(0, 0, 0, 0.06);
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  /* 注意：% 内边距是相对“父容器(.dice-pair)”宽度计算的，会偏大；用固定 6px（≈10% 骰身）
     才能把单点(.pip)放大到约 14px，点数清晰可见。gap 用 % 即可（相对骰身内容区）。 */
  padding: 6px;
  gap: 4%;
}
/* 左上角果冻高光 */
.cute-die::before {
  content: '';
  position: absolute;
  top: 6px;
  left: 6px;
  width: 9px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.55);
  transform: rotate(-25deg);
}
.cute-die.rolling {
  animation: dieDrop 0.62s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
.pip {
  align-self: center;
  justify-self: center;
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  background: transparent;
  opacity: 0;
}
.pip.on {
  opacity: 1;
  background: radial-gradient(circle at 30% 30%, #FF8FAB 0%, #E94E77 100%);
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.15), inset 0 -1px 0 rgba(0, 0, 0, 0.06), 0 0 0 1.2px rgba(255, 255, 255, 0.9);
}

@keyframes dieDrop {
  0% { transform: translateY(-130%) scale(0.9); opacity: 0.15; }
  60% { transform: translateY(8%) scale(1.02); opacity: 1; }
  80% { transform: translateY(-3%) scale(1); }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}

/* 落地涟漪 */
.dice-ripple {
  position: absolute;
  left: 50%;
  top: 54%;
  width: 64px;
  height: 64px;
  transform: translate(-50%, -50%) scale(0.2);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(244, 208, 63, 0.55) 0%, rgba(244, 208, 63, 0) 70%);
  opacity: 0;
  pointer-events: none;
}
.dice-ripple.show {
  animation: diceRipple 0.4s ease-out forwards;
}
@keyframes diceRipple {
  0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0.9; }
  100% { transform: translate(-50%, -50%) scale(1.7); opacity: 0; }
}

.dice3d-hint {
  position: absolute;
  bottom: 4%;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 12px;
  font-weight: 800;
  color: #2c3e50;
  text-shadow: 0 2px 6px rgba(255, 255, 255, 0.95);
  letter-spacing: 1px;
}
</style>
