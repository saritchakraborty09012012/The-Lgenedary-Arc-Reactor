/**
 * Smooth storytelling narration.
 *
 * Each caption line has a pre-generated neural-voice MP3 in /voice
 * (deep documentary narrator voice). Playback uses a single audio
 * element with a "latest-wins" queue:
 *
 *   - scrolling NEVER cancels the line that is currently playing
 *   - if you scroll ahead, only the newest line is queued
 *   - when the current line finishes, the queued line plays instantly
 *
 * That is what keeps the flow smooth instead of fumbling when the
 * user scrolls quickly. If an MP3 is missing, it falls back to the
 * best available browser voice.
 */
export class VoiceNarrator {
  constructor() {
    this.enabled = false
    this.audio = null
    this.currentKey = null
    this.pending = null
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
      synth.cancel()
      const utter = new SpeechSynthesisUtterance(text)
      if (this.fallbackVoices[0]) utter.voice = this.fallbackVoices[0]
      utter.lang = this.fallbackVoices[0]?.lang || 'en-US'
      utter.rate = 0.92
      utter.pitch = 0.8
      window.setTimeout(() => {
        if (this.enabled) synth.speak(utter)
      }, 40)
    } catch {
      /* best effort */
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
    if (!item) return
    if (item.key === this.currentKey) return
    this.currentKey = item.key
    this.audio = item.key ? this.getAudio(item.key) : null
    if (!this.audio) {
      this.speakFallback(item.text)
      return
    }
    this.audio.currentTime = 0
    const result = this.audio.play()
    if (result && result.catch) {
      result.catch(() => {
        // e.g. autoplay blocked / file missing -> browser voice
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
    const next = this.pending
    this.pending = null
    if (next && next.key !== this.currentKey) this.play(next)
  }

  /**
   * text: line to narrate, key: stable id like "s04-l2" (maps to /voice/s04-l2.mp3)
   */
  speak(text, key) {
    if (!this.enabled || !text) return
    const item = { text, key: key || null }
    // never interrupt what is already playing — just queue the newest line
    if (this.isPlaying()) {
      this.pending = item
      if (key) this.getAudio(key).load()
      return
    }
    this.play(item)
  }

  stop() {
    this.pending = null
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
