import * as THREE from 'three'
import { clamp } from '../lib/math'

const TAU = Math.PI * 2

function pointsMaterial(map, color = 0x9fd8ff, size = 0.03, opacity = 0.6) {
  return new THREE.PointsMaterial({
    map,
    color,
    size,
    sizeAttenuation: true,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: true,
  })
}

export class Effects {
  constructor(scene, tex) {
    this.scene = scene
    this.tex = tex
    this.group = new THREE.Group()
    this.group.name = 'EFFECTS'
    scene.add(this.group)
    this.time = 0

    this.buildDust()
    this.buildSparkles()
    this.buildEnergy()
    this.buildGas()
    this.buildAccelerator()
    this.buildFieldLines()
    this.buildGlow()
    this.buildPlasmaTorus()
    this.buildEnergyRings()
    this.buildArcs()
    this.buildHudRings()
  }

  /* ------------------------------------------------------------------ dust */
  buildDust() {
    const N = 1700
    const pos = new Float32Array(N * 3)
    this.dustBase = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      const r = 2.4 + Math.random() * 8.5
      const a = Math.random() * TAU
      const y = (Math.random() - 0.5) * 9
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      pos[i * 3] = x
      pos[i * 3 + 1] = y
      pos[i * 3 + 2] = z
      this.dustBase[i * 3] = x
      this.dustBase[i * 3 + 1] = y
      this.dustBase[i * 3 + 2] = z
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.dustMat = pointsMaterial(this.tex.dot, 0x9fd8ff, 0.035, 0.42)
    this.dust = new THREE.Points(geo, this.dustMat)
    this.dust.frustumCulled = false
    this.group.add(this.dust)
  }

  /* -------------------------------------------------------------- sparkles */
  buildSparkles() {
    const N = 420
    const pos = new Float32Array(N * 3)
    const phase = new Float32Array(N)
    const size = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      const r = 1.4 + Math.random() * 2.2
      const a = Math.random() * TAU
      pos[i * 3] = Math.cos(a) * r
      pos[i * 3 + 1] = (Math.random() - 0.5) * 2.4
      pos[i * 3 + 2] = Math.sin(a) * r
      phase[i] = Math.random() * TAU
      size[i] = 0.02 + Math.random() * 0.06
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    this.sparkleMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uMap: { value: this.tex.dot },
        uOpacity: { value: 0.8 },
      },
      vertexShader: `
        attribute float aPhase; attribute float aSize;
        uniform float uTime;
        varying float vA;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (420.0 / max(0.1, -mv.z));
          gl_Position = projectionMatrix * mv;
          vA = 0.18 + 0.82 * abs(sin(uTime * 1.6 + aPhase));
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap; uniform float uOpacity;
        varying float vA;
        void main(){
          vec4 t = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(vec3(0.72, 0.9, 1.0), t.a * vA * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    this.sparkles = new THREE.Points(geo, this.sparkleMat)
    this.sparkles.frustumCulled = false
    this.group.add(this.sparkles)
  }

  /* ------------------------------------------------------- energy particles */
  buildEnergy() {
    const N = 900
    this.energyData = []
    const pos = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      const r = 0.55 + Math.random() * 1.0
      const a = Math.random() * TAU
      const y = 0.2 + (Math.random() - 0.5) * 0.9
      const speed = (0.25 + Math.random() * 0.9) * (Math.random() > 0.5 ? 1 : -1)
      this.energyData.push({ r, a, y, speed })
      pos[i * 3] = Math.cos(a) * r
      pos[i * 3 + 1] = y
      pos[i * 3 + 2] = Math.sin(a) * r
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.energyMat = pointsMaterial(this.tex.dot, 0x8fd4ff, 0.026, 0.9)
    this.energy = new THREE.Points(geo, this.energyMat)
    this.energy.frustumCulled = false
    this.group.add(this.energy)
  }

  /* ------------------------------------------------------------- gas stream */
  buildGas() {
    const N = 460
    this.gasData = []
    const pos = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      const tube = i % 4
      const t = Math.random()
      const speed = 0.06 + Math.random() * 0.16
      this.gasData.push({ tube, t, speed })
      pos[i * 3] = 0
      pos[i * 3 + 1] = -10
      pos[i * 3 + 2] = 0
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.gasMat = pointsMaterial(this.tex.dot, 0x7fffe0, 0.03, 0.0)
    this.gas = new THREE.Points(geo, this.gasMat)
    this.gas.frustumCulled = false
    this.group.add(this.gas)
  }

  /* -------------------------------------------------------- particle streaks */
  buildAccelerator() {
    const N = 620
    this.accelData = []
    const pos = new Float32Array(N * 2 * 3)
    for (let i = 0; i < N; i++) {
      this.accelData.push({
        r: 0.35 + Math.random() * 1.5,
        a: Math.random() * TAU,
        speed: 0.5 + Math.random() * 1.4,
        len: 0.03 + Math.random() * 0.12,
      })
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.accelMat = new THREE.LineBasicMaterial({
      color: 0x8fd8ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.accel = new THREE.LineSegments(geo, this.accelMat)
    this.accel.frustumCulled = false
    this.group.add(this.accel)
  }

  /* --------------------------------------------------------- field lines */
  buildFieldLines() {
    this.fieldGroup = new THREE.Group()
    this.group.add(this.fieldGroup)
    this.fieldLines = []
    this.fieldCurves = []
    for (let i = 0; i < 11; i++) {
      const tilt = (i / 11) * Math.PI
      const radius = 1.25 + (i % 3) * 0.22
      const pts = []
      const seg = 96
      for (let j = 0; j <= seg; j++) {
        const a = (j / seg) * TAU
        const x = Math.cos(a) * radius
        const y = 0.18 + Math.sin(a) * radius * Math.sin(tilt) * 0.85
        const z = Math.sin(a) * radius * Math.cos(tilt)
        pts.push(new THREE.Vector3(x, y, z))
      }
      const curve = new THREE.CatmullRomCurve3(pts, true)
      this.fieldCurves.push(curve)
      const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(180))
      const mat = new THREE.LineBasicMaterial({
        color: i % 2 ? 0x4fb4ff : 0x9fe6ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const line = new THREE.Line(geo, mat)
      line.userData.phase = i * 0.7
      this.fieldGroup.add(line)
      this.fieldLines.push(line)
    }
    // travelling beads on the field
    const N = 110
    const pos = new Float32Array(N * 3)
    this.fieldBeadData = []
    for (let i = 0; i < N; i++) {
      this.fieldBeadData.push({ line: i % this.fieldLines.length, t: Math.random(), speed: 0.05 + Math.random() * 0.12 })
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.fieldBeadMat = pointsMaterial(this.tex.dot, 0x9fe6ff, 0.028, 0)
    this.fieldBeads = new THREE.Points(geo, this.fieldBeadMat)
    this.fieldBeads.frustumCulled = false
    this.fieldGroup.add(this.fieldBeads)
  }

  /* --------------------------------------------------------------- glow */
  buildGlow() {
    this.glowGroup = new THREE.Group()
    this.group.add(this.glowGroup)
    this.glows = []
    const specs = [
      { s: 1.15, o: 0.22, c: 0xbdeeff },
      { s: 1.9, o: 0.1, c: 0x7fd4ff },
      { s: 3.0, o: 0.045, c: 0x3f8fff },
      { s: 4.8, o: 0.018, c: 0x2f6fff },
    ]
    for (const sp of specs) {
      const mat = new THREE.SpriteMaterial({
        map: this.tex.glow,
        color: sp.c,
        transparent: true,
        opacity: sp.o,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      })
      const sprite = new THREE.Sprite(mat)
      sprite.position.set(0, 0.2, 0)
      sprite.scale.setScalar(sp.s)
      sprite.userData.base = sp
      this.glowGroup.add(sprite)
      this.glows.push(sprite)
    }
  }

  /* --------------------------------------------------------- plasma torus */
  buildPlasmaTorus() {
    const geo = new THREE.TorusGeometry(0.52, 0.075, 24, 160)
    this.plasmaMat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: this.tex.plasma },
        uTime: { value: 0 },
        uOpacity: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){
          vUv = uv;
          vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vV = -mv.xyz;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap; uniform float uTime; uniform float uOpacity;
        varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){
          vec2 uv = vUv * vec2(2.4, 1.0);
          vec3 a = texture2D(uMap, uv + vec2(uTime * 0.02, uTime * 0.006)).rgb;
          vec3 b = texture2D(uMap, uv * 1.7 - vec2(uTime * 0.013, uTime * 0.004)).rgb;
          vec3 col = mix(a, b, 0.5);
          float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
          col += vec3(0.25, 0.62, 1.0) * fres * 1.6;
          gl_FragColor = vec4(col * 1.6, uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    this.plasmaTorus = new THREE.Mesh(geo, this.plasmaMat)
    this.plasmaTorus.position.set(0, 0.2, 0)
    this.plasmaTorus.rotation.x = Math.PI / 2
    this.group.add(this.plasmaTorus)

    // soft halo torus
    const geo2 = new THREE.TorusGeometry(0.52, 0.16, 20, 128)
    this.haloMat = new THREE.MeshBasicMaterial({
      color: 0x4fa8ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    this.halo = new THREE.Mesh(geo2, this.haloMat)
    this.halo.position.set(0, 0.2, 0)
    this.halo.rotation.x = Math.PI / 2
    this.group.add(this.halo)
  }

  /* --------------------------------------------------------- energy rings */
  buildEnergyRings() {
    this.rings = []
    for (let i = 0; i < 4; i++) {
      const geo = new THREE.TorusGeometry(1, 0.008, 6, 128)
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 ? 0x8fd8ff : 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const ring = new THREE.Mesh(geo, mat)
      ring.rotation.x = Math.PI / 2
      ring.position.y = 0.2
      ring.userData.phase = i * 0.25
      this.group.add(ring)
      this.rings.push(ring)
    }
  }

  /* ---------------------------------------------------------- electric arcs */
  buildArcs() {
    const N = 70
    const pos = new Float32Array(N * 2 * 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.arcMat = new THREE.LineBasicMaterial({
      color: 0x9fe6ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.arcs = new THREE.LineSegments(geo, this.arcMat)
    this.arcs.frustumCulled = false
    this.group.add(this.arcs)
  }

  /* ------------------------------------------------------------- hud rings */
  buildHudRings() {
    this.hudGroup = new THREE.Group()
    this.group.add(this.hudGroup)
    this.hudRings = []
    const specs = [
      { r: 2.25, tilt: 0.0, o: 0.22 },
      { r: 2.6, tilt: 0.7, o: 0.12 },
      { r: 3.1, tilt: -0.5, o: 0.08 },
    ]
    for (const sp of specs) {
      const geo = new THREE.RingGeometry(sp.r - 0.002, sp.r, 180, 1)
      const mat = new THREE.MeshBasicMaterial({
        color: 0x8fd8ff,
        transparent: true,
        opacity: sp.o,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const ring = new THREE.Mesh(geo, mat)
      ring.rotation.x = Math.PI / 2 + sp.tilt
      ring.position.y = 0.15
      this.hudGroup.add(ring)
      this.hudRings.push(ring)
    }
  }

  /* --------------------------------------------------------------- update */
  update(time, dt, fx) {
    this.time = time
    const plasma = clamp(fx.plasma || 0, 0, 1.6)
    const field = clamp(fx.field || 0, 0, 1)
    const gas = clamp(fx.gas || 0, 0, 1)
    const accel = clamp(fx.accelerator || 0, 0, 1)
    const converter = clamp(fx.converter || 0, 0, 1)
    const ignition = clamp(fx.ignition || 0, 0, 1)
    const shell = clamp(fx.shell || 0, 0, 1)

    // dust
    this.dust.rotation.y = time * 0.012
    this.dustMat.opacity = 0.28 + 0.16 * Math.sin(time * 0.4)
    const dpos = this.dust.geometry.attributes.position.array
    for (let i = 0; i < this.dustBase.length; i += 3) {
      const ph = i * 0.13
      dpos[i] = this.dustBase[i] + Math.sin(time * 0.12 + ph) * 0.12
      dpos[i + 1] = this.dustBase[i + 1] + Math.sin(time * 0.16 + ph * 1.3) * 0.18
      dpos[i + 2] = this.dustBase[i + 2] + Math.cos(time * 0.1 + ph) * 0.12
    }
    this.dust.geometry.attributes.position.needsUpdate = true

    // sparkles
    this.sparkleMat.uniforms.uTime.value = time
    this.sparkleMat.uniforms.uOpacity.value = 0.35 + plasma * 0.65

    // energy particles
    const epos = this.energy.geometry.attributes.position.array
    for (let i = 0; i < this.energyData.length; i++) {
      const d = this.energyData[i]
      d.a += d.speed * dt
      const r = d.r * (0.9 + 0.1 * Math.sin(time * 0.8 + i))
      epos[i * 3] = Math.cos(d.a) * r
      epos[i * 3 + 1] = d.y + Math.sin(time * 1.1 + i * 0.3) * 0.04
      epos[i * 3 + 2] = Math.sin(d.a) * r
    }
    this.energy.geometry.attributes.position.needsUpdate = true
    this.energyMat.opacity = 0.25 + plasma * 0.75
    this.energy.visible = plasma > 0.05

    // gas
    const gpos = this.gas.geometry.attributes.position.array
    for (let i = 0; i < this.gasData.length; i++) {
      const d = this.gasData[i]
      d.t += d.speed * dt
      if (d.t > 1) d.t -= 1
      const t = d.t
      const a = (d.tube / 4) * TAU + TAU / 8
      const r = 1.34 + (0.5 - 1.34) * t
      const y = 0.24 + 0.1 * Math.sin(t * Math.PI) - 0.06 * t
      const jitter = (1 - t) * 0.03
      gpos[i * 3] = Math.cos(a) * r + (Math.random() - 0.5) * jitter
      gpos[i * 3 + 1] = y + (Math.random() - 0.5) * jitter
      gpos[i * 3 + 2] = Math.sin(a) * r + (Math.random() - 0.5) * jitter
    }
    this.gas.geometry.attributes.position.needsUpdate = true
    this.gasMat.opacity = gas * 0.85
    this.gas.visible = gas > 0.05

    // accelerator streaks
    const apos = this.accel.geometry.attributes.position.array
    for (let i = 0; i < this.accelData.length; i++) {
      const d = this.accelData[i]
      d.r -= d.speed * dt
      if (d.r < 0.18) d.r = 1.85
      const a = d.a + d.r * 7.0 + time * 0.6
      const r2 = d.r + d.len
      const x1 = Math.cos(a) * d.r
      const z1 = Math.sin(a) * d.r
      const x2 = Math.cos(a + 0.05) * r2
      const z2 = Math.sin(a + 0.05) * r2
      const y = 0.2 + (d.r - 0.9) * 0.18
      apos[i * 6] = x1
      apos[i * 6 + 1] = y
      apos[i * 6 + 2] = z1
      apos[i * 6 + 3] = x2
      apos[i * 6 + 4] = y + 0.01
      apos[i * 6 + 5] = z2
    }
    this.accel.geometry.attributes.position.needsUpdate = true
    this.accelMat.opacity = accel * 0.9
    this.accel.visible = accel > 0.02

    // field lines
    this.fieldGroup.rotation.y = time * 0.08
    for (let i = 0; i < this.fieldLines.length; i++) {
      const line = this.fieldLines[i]
      line.material.opacity = field * (0.1 + 0.09 * Math.sin(time * 1.4 + line.userData.phase))
    }
    const bpos = this.fieldBeads.geometry.attributes.position.array
    for (let i = 0; i < this.fieldBeadData.length; i++) {
      const d = this.fieldBeadData[i]
      d.t += d.speed * dt
      if (d.t > 1) d.t -= 1
      const curve = this.fieldCurves[d.line]
      const p = curve.getPointAt(d.t)
      bpos[i * 3] = p.x
      bpos[i * 3 + 1] = p.y
      bpos[i * 3 + 2] = p.z
    }
    this.fieldBeads.geometry.attributes.position.needsUpdate = true
    this.fieldBeadMat.opacity = field * 0.9
    this.fieldGroup.visible = field > 0.02

    // glow
    const pulse = 0.92 + 0.08 * Math.sin(time * 3.1)
    for (const s of this.glows) {
      const b = s.userData.base
      s.material.opacity = b.o * (0.16 + plasma * 0.5) * pulse
      s.scale.setScalar(b.s * (0.9 + plasma * 0.18))
    }
    this.glowGroup.visible = plasma > 0.03

    // plasma torus
    this.plasmaMat.uniforms.uTime.value = time
    this.plasmaMat.uniforms.uOpacity.value = Math.min(1, plasma) * 0.55
    this.plasmaTorus.scale.setScalar(0.75 + plasma * 0.35)
    this.plasmaTorus.visible = plasma > 0.04
    this.haloMat.opacity = Math.min(1, plasma) * 0.05 * pulse
    this.halo.scale.setScalar(0.9 + plasma * 0.35)
    this.halo.visible = plasma > 0.04

    // energy rings
    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i]
      const phase = (time * 0.35 + ring.userData.phase) % 1
      const s = 0.5 + phase * 2.4
      ring.scale.setScalar(s)
      ring.material.opacity = ignition * (1 - phase) * 0.55 + Math.max(0, plasma - 0.9) * 0.12
      ring.visible = ignition > 0.02 || plasma > 0.9
    }

    // electric arcs
    const rpos = this.arcs.geometry.attributes.position.array
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * TAU
      const r = 0.65 + Math.random() * 0.35
      const y = -0.55 + Math.random() * 0.4
      const a2 = a + (Math.random() - 0.5) * 0.9
      const r2 = r + (Math.random() - 0.5) * 0.2
      rpos[i * 6] = Math.cos(a) * r
      rpos[i * 6 + 1] = y
      rpos[i * 6 + 2] = Math.sin(a) * r
      rpos[i * 6 + 3] = Math.cos(a2) * r2
      rpos[i * 6 + 4] = y + (Math.random() - 0.5) * 0.25
      rpos[i * 6 + 5] = Math.sin(a2) * r2
    }
    this.arcs.geometry.attributes.position.needsUpdate = true
    this.arcMat.opacity = converter * (0.15 + 0.25 * Math.abs(Math.sin(time * 9.0)))
    this.arcs.visible = converter > 0.05

    // hud rings
    this.hudGroup.rotation.y = time * 0.05
    for (let i = 0; i < this.hudRings.length; i++) {
      const r = this.hudRings[i]
      r.rotation.z = time * (0.05 + i * 0.03) * (i % 2 ? -1 : 1)
      r.material.opacity = (0.08 + 0.12 * shell) * (0.6 + 0.4 * Math.sin(time * 0.7 + i))
    }
    this.hudGroup.visible = shell > 0.2
  }
}
