<template>
  <canvas ref="cv" class="particle-canvas"></canvas>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'

const cv = ref(null)
let renderer, scene, camera, raf, points, hearts = []
let dotTex, heartTex
let running = true, onResize = null, onVis = null
const clock = new THREE.Clock()

const COLORS = [0xffb3c6, 0xaed6f1, 0xffe08a, 0xc8b6ff, 0xb9f6ca]

function dotTexture() {
  const s = 64
  const c = document.createElement('canvas')
  c.width = c.height = s
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(255,255,255,0.95)')
  g.addColorStop(0.35, 'rgba(255,209,220,0.55)')
  g.addColorStop(1, 'rgba(255,209,220,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  return new THREE.CanvasTexture(c)
}

function heartTexture() {
  const s = 128
  const c = document.createElement('canvas')
  c.width = c.height = s
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#ff8fab'
  const x = s / 2, y = s / 2, r = s * 0.22
  ctx.beginPath()
  ctx.moveTo(x, y + r * 1.25)
  ctx.bezierCurveTo(x - r * 1.7, y - r * 0.3, x - r * 0.5, y - r * 1.5, x, y - r * 0.55)
  ctx.bezierCurveTo(x + r * 0.5, y - r * 1.5, x + r * 1.7, y - r * 0.3, x, y + r * 1.25)
  ctx.closePath()
  ctx.fill()
  return new THREE.CanvasTexture(c)
}

function init() {
  const w = window.innerWidth, h = window.innerHeight
  try {
    renderer = new THREE.WebGLRenderer({ canvas: cv.value, alpha: true, antialias: true })
  } catch (e) {
    // 背景粒子是纯装饰，WebGL 不可用就静默放弃，绝不抛错影响棋盘
    console.warn('[ParticleOverlay] WebGL unavailable, skipping particles:', e && e.message)
    return
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(w, h, false)

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100)
  camera.position.z = 12

  // 柔光圆点（漂浮上浮）
  const N = 64
  const geo = new THREE.BufferGeometry()
  const pos = new Float32Array(N * 3)
  const col = new Float32Array(N * 3)
  const c = new THREE.Color()
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 24
    pos[i * 3 + 1] = (Math.random() - 0.5) * 18
    pos[i * 3 + 2] = (Math.random() - 0.5) * 6
    c.setHex(COLORS[i % COLORS.length])
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  dotTex = dotTexture()
  const mat = new THREE.PointsMaterial({
    size: 0.45, map: dotTex, vertexColors: true, transparent: true,
    depthWrite: false, opacity: 0.55, sizeAttenuation: true,
  })
  points = new THREE.Points(geo, mat)
  scene.add(points)

  // 漂浮爱心
  heartTex = heartTexture()
  for (let i = 0; i < 8; i++) {
    const m = new THREE.SpriteMaterial({ map: heartTex, transparent: true, opacity: 0.45, depthWrite: false })
    const sp = new THREE.Sprite(m)
    const sc = 0.55 + Math.random() * 0.9
    sp.scale.set(sc, sc, 1)
    sp.position.set((Math.random() - 0.5) * 22, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 4)
    sp.userData = { vy: 0.18 + Math.random() * 0.4, vx: (Math.random() - 0.5) * 0.25, base: sc, phase: Math.random() * 6 }
    scene.add(sp)
    hearts.push(sp)
  }

  onResize = () => {
    const W = window.innerWidth, H = window.innerHeight
    camera.aspect = W / H
    camera.updateProjectionMatrix()
    renderer.setSize(W, H, false)
  }
  window.addEventListener('resize', onResize)

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden
    if (running) { clock.getDelta(); animate() }
  })

  animate()
}

function animate() {
  if (!running) return
  raf = requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 0.05)
  const t = clock.elapsedTime

  const pos = points.geometry.attributes.position
  for (let i = 0; i < pos.count; i++) {
    let y = pos.getY(i) + dt * (0.3 + (i % 5) * 0.07)
    let x = pos.getX(i) + Math.sin((t + i) * 0.3) * dt * 0.18
    if (y > 10) { y = -10; x = (Math.random() - 0.5) * 24 }
    pos.setY(i, y); pos.setX(i, x)
  }
  pos.needsUpdate = true
  points.rotation.z += dt * 0.015

  hearts.forEach(h => {
    h.position.y += dt * h.userData.vy
    h.position.x += dt * h.userData.vx
    if (h.position.y > 10) { h.position.y = -10; h.position.x = (Math.random() - 0.5) * 22 }
    const s = h.userData.base * (1 + Math.sin(t * 1.4 + h.userData.phase) * 0.08)
    h.scale.set(s, s, 1)
  })

  renderer.render(scene, camera)
}

onMounted(() => {
  try { init() }
  catch (e) { console.warn('[ParticleOverlay] init failed, skipping:', e && e.message) }
})

onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf)
  if (onResize) window.removeEventListener('resize', onResize)
  if (points) {
    points.geometry.dispose()
    if (points.material.map) points.material.map.dispose()
    points.material.dispose()
  }
  hearts.forEach(h => h.material.dispose())
  if (dotTex) dotTex.dispose()
  if (heartTex) heartTex.dispose()
  if (renderer) renderer.dispose()
})
</script>

<style scoped>
.particle-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}
</style>
