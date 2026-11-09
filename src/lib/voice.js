/**
 * Hosting-style storytelling narration.
 *
 * Each caption line has a pre-generated neural-voice MP3 in /voice
 * (deep documentary narrator voice). Playback is a strict FIFO queue:
 *
 *   - every line the user scrolls through is ENQUEUED, never dropped
 *   - lines play one after another in story order, like a host
 *     telling the story — even if you scrolled past them quickly
 *   - the current line is NEVER cancelled mid-sentence, so the
 *     narration never fumbles or stutters
 *   - the next clip is preloaded while the current one plays,
 *     so there is no gap between lines
 *
 * The only way to stop it is the VOICE toggle (or tour stop).
 */
export class VoiceNarrator {
  constructor() {
    this.enabled = false
    this.audio = null
    this.currentKey = null
    this.queue = []
    this.cache = new Map()
    this.fallbackVoices = []
    this.pickVoice = this.pickVoice.bind(this)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.pickVoice()
      window.speechSynthesis.onvoiceschanged = this.pickVoice
    }
  }

  get supported() {
    return typeof window !== 'undefined'
  }

  get queueLength() {
    return this.queue.length
  }

  /* ------------------------------------------------- browser voice fallback */
  pickVoice() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const all = window.speechSynthesis.getVoices()
    if (!all.length) return
    const pref = [
      (v) => /guy|christopher|daniel|arthur|ryan|brian|eric/i.test(v.name),
      (v) => /google uk english male/i.test(v.name),
      (v) => /google us english/i.test(v.name),
      (v) => v.lang === 'en-US' && v.default,
      (v) => v.lang === 'en-US',
      (v) => v.lang?.startsWith('en'),
      (v) => v.default,
      () => true,
    ]
    for (const test of pref) {
      const hit = all.find(test)
      if (hit) {
        this.fallbackVoices = [hit]
        return
      }
    }
    this.fallbackVoices = all
  }

  speakFallback(text) {
    if (!this.enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return
    try {
      const synth = window.speechSynthesis
      const utter = new SpeechSynthesisUtterance(text)
      if (this.fallbackVoices[0]) utter.voice = this.fallbackVoices[0]
      utter.lang = this.fallbackVoices[0]?.lang || 'en-US'
      utter.rate = 0.92
      utter.pitch = 0.8
      utter.onend = () => this.drain()
      utter.onerror = () => this.drain()
      synth.speak(utter)
    } catch {
      this.drain()
    }
  }

  /* ------------------------------------------------------------ MP3 player */
  getAudio(key) {
    let el = this.cache.get(key)
    if (!el) {
      el = new Audio(`/voice/${key}.mp3`)
      el.preload = 'auto'
      el.volume = 1
      el.addEventListener('ended', () => this.onEnded(key))
      el.addEventListener('error', () => {
        this.cache.delete(key)
        if (this.currentKey === key) {
          this.currentKey = null
          this.drain()
        }
      })
      this.cache.set(key, el)
    }
    return el
  }

  isPlaying() {
    return Boolean(this.audio && !this.audio.paused && !this.audio.ended)
  }

  play(item) {
    if (!item || !this.enabled) return
    this.currentKey = item.key
    this.audio = item.key ? this.getAudio(item.key) : null
    // preload whatever comes next so the host never pauses
    const next = this.queue[0]
    if (next?.key) this.getAudio(next.key).load()
    if (!this.audio) {
      this.speakFallback(item.text)
      return
    }
    this.audio.currentTime = 0
    const result = this.audio.play()
    if (result && result.catch) {
      result.catch(() => {
        this.currentKey = null
        this.speakFallback(item.text)
      })
    }
  }

  onEnded(key) {
    if (key !== this.currentKey) return
    this.currentKey = null
    this.drain()
  }

  drain() {
    if (!this.enabled) return
    const next = this.queue.shift()
    if (next) this.play(next)
  }

  /**
   * text: line to narrate, key: stable id like "s04-l2" (maps to /voice/s04-l2.mp3)
   * Strict FIFO — every line is kept and read in order.
   */
  speak(text, key) {
    if (!this.enabled || !text) return
    const item = { text, key: key || null }
    // de-dupe: never queue the same clip twice in a row / while playing
    if (key && (key === this.currentKey || this.queue[this.queue.length - 1]?.key === key)) return
    if (key && this.queue.some((q) => q.key === key)) return
    if (this.isPlaying()) {
      this.queue.push(item)
      if (key) this.getAudio(key).load()
      return
    }
    this.play(item)
  }

  stop() {
    this.queue = []
    this.currentKey = null
    if (this.audio) {
      try {
        this.audio.pause()
        this.audio.currentTime = 0
      } catch {
        /* noop */
      }
      this.audio = null
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel()
      } catch {
        /* noop */
      }
    }
  }

  dispose() {
    this.enabled = false
    this.stop()
    this.cache.clear()
  }
}
