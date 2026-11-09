import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { createTextures } from './textures.js'
import { Effects } from './effects.js'
import { sections, hotspots } from '../data/narrative.js'
import { clamp, damp, lerp, smoothstep, lerp3 } from '../lib/math'

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.92 },
    uGrain: { value: 0.03 },
    uAberration: { value: 0.0014 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uVignette, uGrain, uAberration;
    uniform vec2 uResolution;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      vec2 off = d * uAberration * (0.35 + r2 * 2.2);
      float cr = texture2D(tDiffuse, vUv + off).r;
      float cg = texture2D(tDiffuse, vUv).g;
      float cb = texture2D(tDiffuse, vUv - off).b;
      vec3 col = vec3(cr, cg, cb);
      float vig = smoothstep(0.95, 0.12, r2 * 1.55);
      col *= mix(1.0, vig, uVignette);
      float n = hash(vUv * uResolution + uTime * 57.0);
      col += (n - 0.5) * uGrain;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
}

const BGShader = {
  uniforms: {
    uTexA: { value: null },
    uTexB: { value: null },
    uBlend: { value: 0 },
    uMix: { value: 0 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D uTexA, uTexB;
    uniform float uBlend, uMix, uTime;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 p = vUv - 0.5;
      float r = length(p * vec2(1.0, 1.18));
      vec3 base = mix(vec3(0.004, 0.006, 0.010), vec3(0.020, 0.028, 0.040), smoothstep(0.88, 0.0, r));
      base += vec3(0.008, 0.020, 0.034) * exp(-r * r * 6.2);
      vec3 ta = texture2D(uTexA, vUv).rgb;
      vec3 tb = texture2D(uTexB, vUv).rgb;
      vec3 t = mix(ta, tb, uBlend);
      t = mix(vec3(dot(t, vec3(0.299, 0.587, 0.114))), t, 0.36) * 0.2;
      float centerMask = smoothstep(0.03, 0.34, length(p * vec2(1.0, 1.18)));
      t *= mix(0.12, 1.0, centerMask);
      vec3 col = mix(base, t, uMix);
      float n = hash(vUv * vec2(1024.0, 768.0) + uTime * 0.07);
      col += (n - 0.5) * 0.014;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
}

const GROUP_MAP = [
  ['coil_', 'coils'],
  ['shell_', 'shell'],
  ['containment_', 'containment'],
  ['chamber_', 'chamber'],
  ['palladium_', 'palladium'],
  ['deuterium_', 'deuterium'],
  ['cyclotron_', 'cyclotron'],
  ['converter_', 'converter'],
  ['cooling_', 'cooling'],
  ['base_', 'base'],
  ['topcap_', 'topcap'],
  ['glass_', 'glass'],
  ['plasma_', 'plasma'],
  ['detail_', 'detail'],
]

const groupOf = (name) => {
  for (const [prefix, group] of GROUP_MAP) {
    if (name.startsWith(prefix)) return group
  }
  return null
}

const indexOf = (name) => {
  const m = name.match(/_(\d+)_/)
  return m ? parseInt(m[1], 10) : 0
}

export class ReactorScene {
  constructor({ container, labelContainer, stateRef, callbacks = {} }) {
    this.container = container
    this.labelContainer = labelContainer
    this.stateRef = stateRef
    this.callbacks = callbacks
    this.width = container.clientWidth || window.innerWidth
    this.height = container.clientHeight || window.innerHeight
    this.time = 0
    this.smoothT = 0
    this.parts = []
    this.labels = []
    this.hotspotObjs = []
    this.plasmaMats = []
    this.values = { ...sections[0].build }
    this.targetValues = { ...sections[0].build }
    this.fx = { plasma: 1, field: 1, gas: 1, accelerator: 0, converter: 1, cooling: 1, ignition: 0, shell: 1 }
    this.fxTarget = { ...this.fx }
    this.bgMix = 0
    this.bgKey = 'black'
    this.bgBlend = 0
    this.bgBlendTo = 0
    this.bgTextures = {}
    this.mouse = new THREE.Vector2()
    this.mouseTarget = new THREE.Vector2()
    this.drag = { active: false, lastX: 0, lastY: 0, yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0 }
    this.ready = false
    this.disposed = false
    this.clock = new THREE.Clock()
    this.init()
  }

  init() {
    const { width: w, height: h } = this

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    this.renderer.setSize(w, h)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 0.78
    this.renderer.shadowMap.enabled = false
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.style.touchAction = 'pan-y'
    this.container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x04060a)
    this.scene.fog = new THREE.FogExp2(0x04060a, 0.012)

    this.camera = new THREE.PerspectiveCamera(34, w / h, 0.1, 120)
    this.camera.position.set(0, 2.35, 7.4)
    this.scene.add(this.camera)

    // ---- background plane (child of camera, fills the frustum) ----
    this.blackTex = this.makeBlackTexture()
    this.bgTextures = { black: this.blackTex, hall: this.blackTex, lab: this.blackTex, core: this.blackTex }
    this.bgUniforms = {
      uTexA: { value: this.blackTex },
      uTexB: { value: this.blackTex },
      uBlend: { value: 0 },
      uMix: { value: 0 },
      uTime: { value: 0 },
    }
    this.bgMat = new THREE.ShaderMaterial({
      uniforms: this.bgUniforms,
      vertexShader: BGShader.vertexShader,
      fragmentShader: BGShader.fragmentShader,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    })
    this.bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.bgMat)
    this.bgMesh.position.z = -1
    this.bgMesh.frustumCulled = false
    this.bgMesh.renderOrder = -1000
    this.camera.add(this.bgMesh)
    this.sizeBackground()

    // ---- environment ----
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    const room = new RoomEnvironment()
    this.envRT = pmrem.fromScene(room, 0.04)
    this.scene.environment = this.envRT.texture
    this.scene.environmentIntensity = 0.26
    room.dispose?.()
    pmrem.dispose()

    // ---- lights ----
    this.scene.add(new THREE.HemisphereLight(0x9ec9ff, 0x05070a, 0.16))
    const key = new THREE.DirectionalLight(0xffffff, 0.85)
    key.position.set(4, 6, 5)
    this.scene.add(key)
    const rim = new THREE.PointLight(0x3f9fff, 14, 26)
    rim.position.set(-4, 2, -3)
    this.scene.add(rim)
    const rim2 = new THREE.PointLight(0x66d9ff, 9, 26)
    rim2.position.set(4, 1, -2)
    this.scene.add(rim2)
    const fill = new THREE.PointLight(0xffd9b0, 3.5, 26)
    fill.position.set(0, -3, 3)
    this.scene.add(fill)
    this.coreLight = new THREE.PointLight(0x7fd4ff, 2, 10)
    this.coreLight.position.set(0, 0.2, 0)
    this.scene.add(this.coreLight)

    // ---- post ----
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.42, 0.7, 0.86)
    this.composer.addPass(this.bloom)
    this.finalPass = new ShaderPass(FinalShader)
    this.finalPass.uniforms.uResolution.value.set(w, h)
    this.composer.addPass(this.finalPass)
    this.composer.addPass(new OutputPass())

    // ---- css2d ----
    this.labelRenderer = new CSS2DRenderer()
    this.labelRenderer.setSize(w, h)
    this.labelRenderer.domElement.style.position = 'absolute'
    this.labelRenderer.domElement.style.top = '0'
    this.labelRenderer.domElement.style.left = '0'
    this.labelRenderer.domElement.style.pointerEvents = 'none'
    this.labelContainer.appendChild(this.labelRenderer.domElement)

    // ---- textures & effects ----
    this.tex = createTextures()
    this.effects = new Effects(this.scene, this.tex)

    // ---- background stills ----
    this.loadBackgrounds()

    // ---- events ----
    this.onResize = () => this.resize()
    this.onPointerMove = (e) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1
      const y = -((e.clientY / window.innerHeight) * 2 - 1)
      this.mouseTarget.set(x, y)
      if (this.drag.active) {
        const dx = e.clientX - this.drag.lastX
        const dy = e.clientY - this.drag.lastY
        this.drag.lastX = e.clientX
        this.drag.lastY = e.clientY
        this.drag.targetYaw -= dx * 0.005
        this.drag.targetPitch = clamp(this.drag.targetPitch - dy * 0.0032, -0.55, 0.55)
      }
    }
    this.onPointerDown = (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      this.drag.active = true
      this.drag.lastX = e.clientX
      this.drag.lastY = e.clientY
      this.renderer.domElement.style.cursor = 'grabbing'
    }
    this.onPointerUp = () => {
      this.drag.active = false
      this.renderer.domElement.style.cursor = 'grab'
    }
    window.addEventListener('resize', this.onResize)
    window.addEventListener('pointermove', this.onPointerMove, { passive: true })
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointerup', this.onPointerUp)
    window.addEventListener('pointercancel', this.onPointerUp)
    this.renderer.domElement.style.cursor = 'grab'

    this.load()
    this.loop = this.loop.bind(this)
    this.raf = requestAnimationFrame(this.loop)
  }

  makeBlackTexture() {
    const data = new Uint8Array([0, 0, 0, 255])
    const t = new THREE.DataTexture(data, 1, 1)
    t.needsUpdate = true
    return t
  }

  sizeBackground() {
    const fov = 42
    const dist = 1
    const bh = 2 * Math.tan(THREE.MathUtils.degToRad(fov / 2)) * dist * 1.2
    const bw = bh * (this.width / this.height)
    this.bgMesh.scale.set(bw, bh, 1)
    this.bgMesh.position.z = -dist
  }

  loadBackgrounds() {
    const loader = new THREE.TextureLoader()
    const sources = {
      hall: '/renders/bg-hall.jpg',
      lab: '/renders/bg-lab.jpg',
      core: '/renders/bg-core.jpg',
      hero: '/renders/bg-hall.jpg',
    }
    Object.entries(sources).forEach(([key, url]) => {
      loader.load(
        url,
        (t) => {
          t.colorSpace = THREE.SRGBColorSpace
          t.minFilter = THREE.LinearFilter
          this.bgTextures[key] = t
          if (this.bgKey === key) this.applyBg(key)
        },
        undefined,
        () => {}
      )
    })
  }

  applyBg(key) {
    const next = this.bgTextures[key] || this.blackTex
    if (!this.bgTexB) this.bgTexB = next
    this.bgUniforms.uTexA.value = this.bgTexB
    this.bgUniforms.uTexB.value = next
    this.bgBlend = 0
    this.bgBlendTo = 1
  }

  setBg(key) {
    if (key === this.bgKey) return
    this.bgKey = key
    this.applyBg(key)
  }

  /* ------------------------------------------------------------- model load */
  load() {
    this.loader = new GLTFLoader()
    this.loader.load(
      '/models/arc_reactor.glb',
      (gltf) => this.onModel(gltf),
      (xhr) => {
        if (xhr.total) this.callbacks.onProgress?.(clamp(xhr.loaded / xhr.total, 0, 1) * 100)
      },
      (err) => {
        console.warn('GLB failed, using fallback', err)
        this.buildFallback()
        this.finishLoad()
      }
    )
  }

  onModel(gltf) {
    const model = gltf.scene
    const box = new THREE.Box3().setFromObject(model)
    const center = box.getCenter(new THREE.Vector3())
    model.position.sub(center)
    this.model = model
    this.scene.add(model)
    this.enhanceMaterials(model)
    this.collectParts(model)
    this.buildLabels()
    this.finishLoad()
  }

  finishLoad() {
    this.ready = true
    this.callbacks.onProgress?.(100)
    this.callbacks.onReady?.(this)
  }

  enhanceMaterials(model) {
    const seen = new Set()
    model.traverse((o) => {
      if (!o.isMesh) return
      o.castShadow = false
      o.receiveShadow = false
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      mats.forEach((m) => {
        if (!m || seen.has(m.uuid)) return
        seen.add(m.uuid)
        const n = (m.name || '').toLowerCase()
        m.envMapIntensity = 0.38
        const isGlow = n.includes('plasma') || n.includes('emit')
        if (!isGlow) {
          // GLB base colours are bright; darken for the near-black cinematic grade
          const c = m.color.clone()
          const lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b
          const target = n.includes('copper') ? 0.32 : lum > 0.75 ? 0.34 : 0.5
          m.color.copy(c.multiplyScalar(target / Math.max(0.05, lum)))
        }
        if (
          n.includes('titanium') ||
          n.includes('steel') ||
          n.includes('chrome') ||
          n.includes('palladium')
        ) {
          m.normalMap = this.tex.brushedNormal
          m.normalScale.set(0.32, 0.32)
          m.roughnessMap = this.tex.brushedRough
          m.roughness = n.includes('chrome') || n.includes('palladium') ? 0.22 : 0.46
          m.metalness = 1
          m.envMapIntensity = 0.52
        }
        if (n.includes('copper')) {
          m.map = this.tex.copperColor
          m.color.set(0x8f5a34)
          m.normalMap = this.tex.copperNormal
          m.normalScale.set(0.42, 0.42)
          m.roughnessMap = this.tex.copperRough
          m.roughness = 0.46
          m.metalness = 1
          m.envMapIntensity = 0.55
        }
        if (n.includes('black') || n.includes('rubber')) {
          m.normalMap = this.tex.grungeNormal
          m.normalScale.set(0.14, 0.14)
          m.roughness = 0.72
          m.metalness = n.includes('rubber') ? 0.0 : 0.55
        }
        if (n.includes('glass')) {
          // Cheap refractive look: a transparent fresnel-ish standard material.
          // (Real transmission would force an extra full-scene render pass.)
          m.transparent = true
          m.opacity = 0.16
          m.roughness = 0.04
          m.metalness = 0.0
          m.transmission = 0
          m.side = THREE.DoubleSide
          m.depthWrite = false
          m.envMapIntensity = 0.7
          m.color.set(0x5f8296)
        }
        if (n.includes('plasma') || n.includes('emit')) {
          m.toneMapped = true
          m.userData.baseEmissive = n.includes('hot')
            ? 1.1
            : n.includes('soft')
              ? 0.32
              : n.includes('blue')
                ? 0.68
                : 0.6
          m.emissiveIntensity = m.userData.baseEmissive
          if (!m.emissive) m.emissive = new THREE.Color()
          m.emissive.set(n.includes('white') ? 0xdff5ff : 0x7fd4ff)
          this.plasmaMats.push(m)
        }
        m.needsUpdate = true
      })
    })
  }

  collectParts(model) {
    model.traverse((o) => {
      if (!o.isMesh) return
      const group = groupOf(o.name)
      if (!group) return
      const basePos = o.position.clone()
      const baseQuat = o.quaternion.clone()
      const baseScale = o.scale.clone()
      const radial = new THREE.Vector3(basePos.x, 0, basePos.z)
      if (radial.lengthSq() < 1e-6) {
        radial.set(1, 0, 0).applyQuaternion(baseQuat)
      } else {
        radial.normalize()
      }
      this.parts.push({
        mesh: o,
        group,
        index: indexOf(o.name),
        basePos,
        baseQuat,
        baseScale,
        radial,
      })
    })
  }

  buildFallback() {
    const g = new THREE.Group()
    const metal = new THREE.MeshStandardMaterial({ color: 0x9aa6b6, metalness: 1, roughness: 0.3 })
    const copper = new THREE.MeshStandardMaterial({ color: 0xb06a3b, metalness: 1, roughness: 0.35 })
    const plasma = new THREE.MeshStandardMaterial({ color: 0x9fdcff, emissive: 0x7fd4ff, emissiveIntensity: 4 })
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.12, 64), metal)
    base.position.y = -0.95
    g.add(base)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.09, 16, 96), metal)
    ring.rotation.x = Math.PI / 2
    g.add(ring)
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      const coil = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.26), copper)
      coil.position.set(Math.cos(a) * 1.45, 0.6, Math.sin(a) * 1.45)
      coil.rotation.y = -a
      g.add(coil)
    }
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.28, 32, 24), plasma)
    core.position.y = 0.2
    g.add(core)
    const chamber = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.8, 48, 1, true), metal)
    chamber.position.y = 0.25
    g.add(chamber)
    this.model = g
    this.scene.add(g)
  }

  /* --------------------------------------------------------------- labels */
  buildLabels() {
    sections.forEach((s, si) => {
      ;(s.labels || []).forEach((l) => {
        const el = document.createElement('div')
        el.className = `tech-label ${l.side || 'right'}`
        el.innerHTML = `<span class="tech-dot"></span><span class="tech-line"></span><div class="tech-text"><span class="tech-title">${l.title}</span><span class="tech-sub">${l.sub}</span></div>`
        const obj = new CSS2DObject(el)
        obj.position.set(l.anchor[0], l.anchor[1], l.anchor[2])
        obj.center.set(l.side === 'left' ? 1 : 0, 0.5)
        obj.visible = false
        this.scene.add(obj)
        this.labels.push({ el, obj, sectionIndex: si })
      })
    })

    hotspots.forEach((h) => {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = 'hotspot'
      el.setAttribute('aria-label', h.title)
      el.innerHTML = `<span class="hs-dot"></span><span class="hs-label"><span class="hs-kicker">${h.kicker}</span><span class="hs-title">${h.title}</span></span>`
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        this.callbacks.onHotspot?.(h.id)
      })
      const obj = new CSS2DObject(el)
      obj.position.set(h.anchor[0], h.anchor[1], h.anchor[2])
      obj.center.set(0, 0.5)
      obj.visible = false
      this.scene.add(obj)
      this.hotspotObjs.push({ el, obj, id: h.id })
    })
  }

  setActiveHotspot(id) {
    this.hotspotObjs.forEach((h) => {
      h.el.classList.toggle('is-active', h.id === id)
    })
  }

  /* --------------------------------------------------------------- resize */
  resize() {
    const w = this.container.clientWidth || window.innerWidth
    const h = this.container.clientHeight || window.innerHeight
    this.width = w
    this.height = h
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    this.renderer.setSize(w, h)
    this.composer.setSize(w, h)
    this.bloom.setSize(w, h)
    this.finalPass.uniforms.uResolution.value.set(w, h)
    this.labelRenderer.setSize(w, h)
    this.sizeBackground()
  }

  /* --------------------------------------------------------------- update */
  update(dt) {
    this.time += dt
    const targetT = clamp(this.stateRef.current?.timeline ?? 0, 0, sections.length - 0.0001)
    this.smoothT = damp(this.smoothT, targetT, 5.5, dt)
    const t = this.smoothT
    const N = sections.length
    const i = Math.min(N - 2, Math.floor(t))
    const f = t - i
    const e = smoothstep(f)
    const a = sections[i]
    const b = sections[i + 1]
    const near = e < 0.5 ? a : b
    const secIndex = e < 0.5 ? i : i + 1

    // ---- camera ----
    this.mouse.lerp(this.mouseTarget, 1 - Math.exp(-3.2 * dt))
    const pos = new THREE.Vector3(...lerp3(a.camera.pos, b.camera.pos, e))
    const target = new THREE.Vector3(...lerp3(a.camera.target, b.camera.target, e))
    pos.x += this.mouse.x * 0.22
    pos.y += this.mouse.y * 0.14
    target.x += this.mouse.x * 0.055
    target.y += this.mouse.y * 0.035

    if (!this.drag.active) {
      this.drag.targetYaw = damp(this.drag.targetYaw, 0, 1.7, dt)
      this.drag.targetPitch = damp(this.drag.targetPitch, 0, 1.7, dt)
    }
    this.drag.yaw = damp(this.drag.yaw, this.drag.targetYaw, 6, dt)
    this.drag.pitch = damp(this.drag.pitch, this.drag.targetPitch, 6, dt)

    const offset = pos.clone().sub(target)
    // Portrait / narrow screens: pull back + widen FOV so the reactor never crops
    const aspect = this.width / Math.max(1, this.height)
    const portraitBoost = aspect < 1 ? 1 + (1 - aspect) * 0.95 : 1
    offset.multiplyScalar(portraitBoost)
    const sph = new THREE.Spherical().setFromVector3(offset)
    sph.theta += this.drag.yaw + Math.sin(this.time * 0.14) * 0.018
    sph.phi = clamp(sph.phi + this.drag.pitch, 0.18, Math.PI - 0.18)
    offset.setFromSpherical(sph)
    pos.copy(target).add(offset)

    this.camera.position.copy(pos)
    const fovBoost = aspect < 0.6 ? 1.22 : aspect < 1 ? 1.1 : 1
    this.camera.fov = lerp(a.camera.fov, b.camera.fov, e) * fovBoost
    this.camera.updateProjectionMatrix()
    this.camera.lookAt(target)
    this.camera.updateMatrixWorld()

    // ---- build state ----
    for (const k in this.targetValues) {
      const va = a.build[k] ?? 1
      const vb = b.build[k] ?? 1
      this.targetValues[k] = lerp(va, vb, e)
    }
    this.updateAssembly(dt)

    // ---- background ----
    const mixOf = (s) => (s.bg === 'hall' ? 0.4 : s.bg === 'lab' ? 0.32 : 0.0)
    const targetMix = lerp(mixOf(a), mixOf(b), e)
    this.bgMix = damp(this.bgMix, targetMix, 3.2, dt)
    this.bgUniforms.uMix.value = this.bgMix
    this.bgUniforms.uTime.value = this.time
    this.setBg(near.bg)
    this.bgBlend = damp(this.bgBlend, this.bgBlendTo, 5, dt)
    this.bgUniforms.uBlend.value = this.bgBlend
    if (this.bgBlend > 0.995) {
      this.bgUniforms.uTexA.value = this.bgUniforms.uTexB.value
      this.bgBlend = 0
      this.bgBlendTo = 0
      this.bgUniforms.uBlend.value = 0
    }

    // ---- fx ----
    const plasma = this.values.plasma
    const isAccel = near.id === 'accelerator' || near.id === 'ignition'
    this.fxTarget = {
      plasma,
      field: clamp(this.values.containment * 0.62 + this.values.coils * 0.55, 0, 1),
      gas: this.values.deuterium,
      accelerator: isAccel ? 1 : near.id === 'cyclotron' ? 0.35 : 0,
      converter:
        this.values.converter *
        (['converter', 'cooling', 'shell', 'finale', 'outro'].includes(near.id) ? 1 : 0.16),
      cooling: this.values.cooling,
      ignition: near.id === 'ignition' ? 1 : near.id === 'finale' ? 0.18 : 0,
      shell: this.values.shell,
    }
    for (const k in this.fxTarget) this.fx[k] = damp(this.fx[k], this.fxTarget[k], 5, dt)
    this.effects.update(this.time, dt, this.fx)

    // ---- labels ----
    for (const l of this.labels) {
      const dist = Math.abs(t - l.sectionIndex)
      const vis = dist < 0.85
      l.obj.visible = dist < 1.4
      l.el.style.opacity = vis ? '1' : '0'
    }

    // ---- hotspots ----
    const showHot = near.id === 'finale'
    for (const h of this.hotspotObjs) {
      h.obj.visible = showHot
      h.el.style.opacity = showHot ? '1' : '0'
      h.el.style.pointerEvents = showHot ? 'auto' : 'none'
    }

    // ---- post ----
    this.finalPass.uniforms.uTime.value = this.time
    this.bloom.strength = 0.16 + clamp(this.fx.plasma, 0, 1.4) * 0.07 + this.fx.ignition * 0.14
    this.coreLight.intensity = 0.7 + clamp(this.values.plasma, 0, 1.5) * 2.0
    this.coreLight.position.set(0, 0.2, 0)
  }

  updateAssembly(dt) {
    for (const k in this.targetValues) {
      this.values[k] = damp(this.values[k] ?? 1, this.targetValues[k], 7, dt)
    }
    const p = this.values
    const time = this.time
    if (!this._tmpPos) {
      this._tmpPos = new THREE.Vector3()
      this._tmpQuat = new THREE.Quaternion()
      this._tmpScale = new THREE.Vector3()
      this._tmpQ = new THREE.Quaternion()
      this._axisY = new THREE.Vector3(0, 1, 0)
    }
    const tmpPos = this._tmpPos
    const tmpQuat = this._tmpQuat
    const tmpScale = this._tmpScale
    const tmpQ = this._tmpQ
    const axisY = this._axisY

    for (const part of this.parts) {
      const g = part.group
      const v = p[g] ?? 1
      const idx = part.index
      const pos = tmpPos.copy(part.basePos)
      const quat = tmpQuat.copy(part.baseQuat)
      const scale = tmpScale.copy(part.baseScale)
      const rotY = (angle) => quat.premultiply(tmpQ.setFromAxisAngle(axisY, angle))

      switch (g) {
        case 'base':
          pos.y += (1 - v) * -1.2
          scale.multiplyScalar(0.86 + 0.14 * v)
          break
        case 'cooling':
          pos.y += (1 - v) * -1.5
          pos.addScaledVector(part.radial, (1 - v) * 0.45)
          scale.multiplyScalar(0.9 + 0.1 * v)
          break
        case 'converter':
          pos.y += (1 - v) * -1.4
          scale.multiplyScalar(0.85 + 0.15 * v)
          break
        case 'chamber':
          scale.multiplyScalar(0.72 + 0.28 * v)
          pos.y += (1 - v) * 0.2
          break
        case 'palladium':
          pos.y += (1 - v) * 1.1
          scale.multiplyScalar(0.55 + 0.45 * v)
          break
        case 'deuterium':
          scale.multiplyScalar(0.15 + 0.85 * v)
          pos.y += (1 - v) * 0.25
          break
        case 'cyclotron':
          pos.y += (1 - v) * -0.7
          scale.multiplyScalar(0.7 + 0.3 * v)
          rotY((1 - v) * Math.PI * 2)
          break
        case 'containment': {
          const local = clamp((v - idx * 0.08) / 0.6, 0, 1)
          scale.multiplyScalar(0.35 + 0.65 * local)
          pos.y += (1 - local) * 0.8
          break
        }
        case 'coils': {
          const local = clamp((v - idx * 0.055) / 0.5, 0, 1)
          pos.y += (1 - local) * 1.9
          pos.addScaledVector(part.radial, (1 - local) * 0.35)
          rotY((1 - local) * 0.5)
          break
        }
        case 'shell': {
          const local = clamp((v - idx * 0.05) / 0.55, 0, 1)
          pos.addScaledVector(part.radial, (1 - local) * 1.9)
          pos.y += (1 - local) * 0.55
          rotY((1 - local) * Math.PI * 0.55)
          break
        }
        case 'topcap':
          pos.y += (1 - v) * 1.9
          scale.multiplyScalar(0.9 + 0.1 * v)
          break
        case 'glass':
          scale.multiplyScalar(0.88 + 0.12 * v)
          break
        case 'plasma': {
          const pulse = 1 + 0.035 * Math.sin(time * 3.4)
          scale.multiplyScalar((0.2 + 0.8 * clamp(v, 0, 1.4)) * pulse)
          break
        }
        default:
          break
      }
      part.mesh.position.copy(pos)
      part.mesh.quaternion.copy(quat)
      part.mesh.scale.copy(scale)
    }

    const pv = clamp(p.plasma, 0, 1.6)
    for (const m of this.plasmaMats) {
      const base = m.userData.baseEmissive || 2
      m.emissiveIntensity = base * (0.12 + pv * 0.92)
    }
  }

  loop() {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(0.05, this.clock.getDelta())
    this.update(dt)
    this.composer.render()
    this.labelRenderer.render(this.scene, this.camera)
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.onResize)
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)
    window.removeEventListener('pointercancel', this.onPointerUp)
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown)
    this.labelRenderer.domElement?.remove()
    this.renderer.dispose()
    this.composer.dispose?.()
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose?.()
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        mats.forEach((m) => m.dispose?.())
      }
    })
    this.renderer.domElement.remove()
  }
}
