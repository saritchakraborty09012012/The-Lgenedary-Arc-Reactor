/**
 * A tiny procedural ambience engine. No audio files: two detuned sine
 * oscillators for the reactor hum, a filtered noise bed for the coolant, and a
 * slow LFO so the whole thing breathes. Starts only on an explicit gesture.
 */
export class ReactorAudio {
  constructor() {
    this.ctx = null
    this.master = null
    this.filter = null
    this.humGain = null
    this.on = false
    this.energy = 0
  }

  init() {
    if (this.ctx) return
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const now = ctx.currentTime

    const master = ctx.createGain()
    master.gain.setValueAtTime(0.0001, now)
    master.connect(ctx.destination)

    const bus = ctx.createGain()
    bus.gain.value = 0.85
    bus.connect(master)

    // ----- low hum -----
    const humGain = ctx.createGain()
    humGain.gain.value = 0.16
    humGain.connect(bus)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 420
    filter.Q.value = 0.9
    filter.connect(humGain)

    const freqs = [54, 108.4, 162.7]
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator()
      osc.type = i === 2 ? 'triangle' : 'sine'
      osc.frequency.value = f
      const g = ctx.createGain()
      g.gain.value = i === 0 ? 0.75 : i === 1 ? 0.32 : 0.08
      osc.connect(g)
      g.connect(filter)
      osc.start(now)
    })

    // ----- breathing -----
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.11
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.05
    lfo.connect(lfoGain)
    lfoGain.connect(humGain.gain)
    lfo.start(now)

    // ----- coolant air -----
    const len = Math.floor(ctx.sampleRate * 2)
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1
      last = last * 0.96 + white * 0.04
      data[i] = last * 1.8
    }
    const noise = ctx.createBufferSource()
    noise.buffer = buffer
    noise.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1100
    bp.Q.value = 0.6
    const noiseGain = ctx.createGain()
    noiseGain.gain.value = 0.045
    noise.connect(bp)
    bp.connect(noiseGain)
    noiseGain.connect(bus)
    noise.start(now)

    // ----- electric shimmer -----
    const shimmer = ctx.createOscillator()
    shimmer.type = 'sine'
    shimmer.frequency.value = 2200
    const shimmerGain = ctx.createGain()
    shimmerGain.gain.value = 0.004
    const shimmerLfo = ctx.createOscillator()
    shimmerLfo.frequency.value = 0.37
    const shimmerDepth = ctx.createGain()
    shimmerDepth.gain.value = 0.003
    shimmerLfo.connect(shimmerDepth)
    shimmerDepth.connect(shimmerGain.gain)
    shimmer.connect(shimmerGain)
    shimmerGain.connect(bus)
    shimmer.start(now)
    shimmerLfo.start(now)

    this.ctx = ctx
    this.master = master
    this.filter = filter
    this.humGain = humGain
    this.noiseGain = noiseGain
  }

  async toggle() {
    if (!this.ctx) this.init()
    if (!this.ctx) return false
    if (this.ctx.state === 'suspended') await this.ctx.resume()

    const now = this.ctx.currentTime
    this.on = !this.on
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), now)
    this.master.gain.exponentialRampToValueAtTime(this.on ? 0.17 : 0.0001, now + (this.on ? 1.4 : 0.7))
    return this.on
  }

  setEnergy(value) {
    if (!this.ctx || !this.on) return
    this.energy = value
    const now = this.ctx.currentTime
    if (this.filter) this.filter.frequency.setTargetAtTime(240 + value * 820, now, 0.25)
    if (this.humGain) this.humGain.gain.setTargetAtTime(0.12 + value * 0.12, now, 0.4)
  }

  dispose() {
    if (this.ctx) this.ctx.close?.()
    this.ctx = null
    this.on = false
  }
}
