import * as THREE from 'three'

let seed = 1337
const rand = () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}
const rrange = (a, b) => a + rand() * (b - a)

function canvas(size) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  return c
}

function makeTexture(c, { srgb = false, repeat = 1, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.anisotropy = aniso
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  return t
}

function heightToNormal(src, strength = 1.6) {
  const w = src.width
  const h = src.height
  const data = src.getContext('2d').getImageData(0, 0, w, h).data
  const out = canvas(w)
  const octx = out.getContext('2d')
  const img = octx.createImageData(w, h)
  const at = (x, y) => data[((((y % h) + h) % h) * w + (((x % w) + w) % w)) * 4] / 255
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength
      let nx = -dx
      let ny = -dy
      let nz = 1
      const len = Math.hypot(nx, ny, nz) || 1
      nx /= len
      ny /= len
      nz /= len
      const i = (y * w + x) * 4
      img.data[i] = (nx * 0.5 + 0.5) * 255
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255
      img.data[i + 3] = 255
    }
  }
  octx.putImageData(img, 0, 0)
  return out
}

function addNoise(ctx, w, h, amount = 8) {
  const id = ctx.getImageData(0, 0, w, h)
  for (let i = 0; i < id.data.length; i += 4) {
    const n = (rand() - 0.5) * amount
    id.data[i] = Math.max(0, Math.min(255, id.data[i] + n))
    id.data[i + 1] = Math.max(0, Math.min(255, id.data[i + 1] + n))
    id.data[i + 2] = Math.max(0, Math.min(255, id.data[i + 2] + n))
  }
  ctx.putImageData(id, 0, 0)
}

function brushedMetal() {
  const S = 512
  const height = canvas(S)
  const hc = height.getContext('2d')
  hc.fillStyle = '#808080'
  hc.fillRect(0, 0, S, S)
  for (let i = 0; i < 1600; i++) {
    const y = rand() * S
    const v = Math.floor(rrange(80, 180))
    hc.strokeStyle = `rgb(${v},${v},${v})`
    hc.lineWidth = rrange(0.4, 1.8)
    hc.beginPath()
    hc.moveTo(-10, y)
    hc.lineTo(S + 10, y)
    hc.stroke()
  }
  addNoise(hc, S, S, 10)

  const rough = canvas(S)
  const rc = rough.getContext('2d')
  rc.fillStyle = '#b4b4b4'
  rc.fillRect(0, 0, S, S)
  for (let i = 0; i < 1200; i++) {
    const y = rand() * S
    const v = Math.floor(rrange(120, 215))
    rc.strokeStyle = `rgb(${v},${v},${v})`
    rc.lineWidth = rrange(0.4, 2.2)
    rc.beginPath()
    rc.moveTo(-10, y)
    rc.lineTo(S + 10, y)
    rc.stroke()
  }
  addNoise(rc, S, S, 12)

  const normal = heightToNormal(height, 2.2)
  return {
    normal: makeTexture(normal, { repeat: 2 }),
    rough: makeTexture(rough, { repeat: 2 }),
  }
}

function copperWeave() {
  const S = 512
  const color = canvas(S)
  const cc = color.getContext('2d')
  cc.fillStyle = '#a85a2c'
  cc.fillRect(0, 0, S, S)
  // diagonal winding bands
  for (let i = -S; i < S * 2; i += 9) {
    const w = rrange(3, 7)
    cc.strokeStyle = rand() > 0.5 ? 'rgba(70,28,10,0.55)' : 'rgba(230,150,90,0.35)'
    cc.lineWidth = w
    cc.beginPath()
    cc.moveTo(i, -20)
    cc.lineTo(i + S + 40, S + 20)
    cc.stroke()
  }
  // patina blooms
  for (let i = 0; i < 26; i++) {
    const x = rand() * S
    const y = rand() * S
    const r = rrange(8, 60)
    const g = cc.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(40,120,105,${rrange(0.05, 0.22)})`)
    g.addColorStop(1, 'rgba(40,120,105,0)')
    cc.fillStyle = g
    cc.fillRect(x - r, y - r, r * 2, r * 2)
  }
  addNoise(cc, S, S, 16)

  const height = canvas(S)
  const hc = height.getContext('2d')
  hc.fillStyle = '#808080'
  hc.fillRect(0, 0, S, S)
  for (let i = -S; i < S * 2; i += 9) {
    const v = Math.floor(rrange(70, 190))
    hc.strokeStyle = `rgb(${v},${v},${v})`
    hc.lineWidth = rrange(3, 7)
    hc.beginPath()
    hc.moveTo(i, -20)
    hc.lineTo(i + S + 40, S + 20)
    hc.stroke()
  }
  addNoise(hc, S, S, 14)

  const rough = canvas(S)
  const rc = rough.getContext('2d')
  rc.fillStyle = '#a8a8a8'
  rc.fillRect(0, 0, S, S)
  for (let i = -S; i < S * 2; i += 9) {
    const v = Math.floor(rrange(120, 210))
    rc.strokeStyle = `rgb(${v},${v},${v})`
    rc.lineWidth = rrange(3, 7)
    rc.beginPath()
    rc.moveTo(i, -20)
    rc.lineTo(i + S + 40, S + 20)
    rc.stroke()
  }
  addNoise(rc, S, S, 16)

  return {
    color: makeTexture(color, { srgb: true, repeat: 2 }),
    normal: makeTexture(heightToNormal(height, 2.0), { repeat: 2 }),
    rough: makeTexture(rough, { repeat: 2 }),
  }
}

function grunge() {
  const S = 512
  const height = canvas(S)
  const hc = height.getContext('2d')
  hc.fillStyle = '#808080'
  hc.fillRect(0, 0, S, S)
  for (let i = 0; i < 240; i++) {
    const x = rand() * S
    const y = rand() * S
    const len = rrange(4, 70)
    const a = rand() * Math.PI
    const v = Math.floor(rrange(55, 170))
    hc.strokeStyle = `rgba(${v},${v},${v},${rrange(0.15, 0.6)})`
    hc.lineWidth = rrange(0.4, 2)
    hc.beginPath()
    hc.moveTo(x, y)
    hc.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len)
    hc.stroke()
  }
  for (let i = 0; i < 40; i++) {
    const x = rand() * S
    const y = rand() * S
    const r = rrange(10, 80)
    const g = hc.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(60,60,60,${rrange(0.1, 0.4)})`)
    g.addColorStop(1, 'rgba(60,60,60,0)')
    hc.fillStyle = g
    hc.fillRect(x - r, y - r, r * 2, r * 2)
  }
  addNoise(hc, S, S, 20)
  return {
    normal: makeTexture(heightToNormal(height, 1.2), { repeat: 3 }),
  }
}

function radialGlow(size = 256) {
  const c = canvas(size)
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.08, 'rgba(220,245,255,0.95)')
  g.addColorStop(0.22, 'rgba(140,215,255,0.55)')
  g.addColorStop(0.45, 'rgba(60,140,255,0.18)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const t = makeTexture(c, { srgb: true })
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  return t
}

function dotSprite(size = 64) {
  const c = canvas(size)
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.3, 'rgba(180,230,255,0.8)')
  g.addColorStop(0.7, 'rgba(80,160,255,0.18)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const t = makeTexture(c, { srgb: true })
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  return t
}

function plasmaNoise(size = 256) {
  const c = canvas(size)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#02060c'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 80; i++) {
    const x = rand() * size
    const y = rand() * size
    const r = rrange(10, 90)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    const hot = rand()
    g.addColorStop(0, `rgba(${Math.floor(190 + hot * 65)},${Math.floor(225 + hot * 30)},255,${rrange(0.15, 0.55)})`)
    g.addColorStop(0.4, `rgba(40,120,255,${rrange(0.08, 0.28)})`)
    g.addColorStop(1, 'rgba(0,20,80,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  // filament streaks
  for (let i = 0; i < 120; i++) {
    const x = rand() * size
    const y = rand() * size
    const a = rand() * Math.PI * 2
    const len = rrange(10, 70)
    ctx.strokeStyle = `rgba(${Math.floor(180 + rand() * 75)},${Math.floor(220 + rand() * 35)},255,${rrange(0.05, 0.25)})`
    ctx.lineWidth = rrange(0.4, 1.6)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len)
    ctx.stroke()
  }
  addNoise(ctx, size, size, 10)
  const t = makeTexture(c, { srgb: true, repeat: 1 })
  return t
}

export function createTextures() {
  const metal = brushedMetal()
  const copper = copperWeave()
  const grime = grunge()
  return {
    brushedNormal: metal.normal,
    brushedRough: metal.rough,
    copperColor: copper.color,
    copperNormal: copper.normal,
    copperRough: copper.rough,
    grungeNormal: grime.normal,
    glow: radialGlow(256),
    dot: dotSprite(64),
    plasma: plasmaNoise(256),
  }
}
