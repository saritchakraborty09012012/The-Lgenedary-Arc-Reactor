import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { ReactorScene } from './three/Scene'
import { TOTAL_VH, scrollYForSection, scrollYForTimeline, useScrollEngine } from './hooks/useScrollEngine'
import { useMediaQuery } from './hooks/useMediaQuery'
import { ReactorAudio } from './lib/audio'
import { VoiceNarrator } from './lib/voice'
import { sections } from './data/narrative'
import Loader from './components/Loader'
import Hud from './components/Hud'
import ProgressRail from './components/ProgressRail'
import Captions, { CaptionLive } from './components/Captions'
import DimensionFrame from './components/DimensionFrame'
import Menu from './components/Menu'
import DetailPanel from './components/DetailPanel'
import Atmosphere from './components/Atmosphere'
import Outro from './components/Outro'
import Cursor from './components/Cursor'
import DiveGate from './components/DiveGate'

export default function App() {
  const stageRef = useRef(null)
  const labelsRef = useRef(null)
  const stateRef = useRef({ timeline: 0, progress: 0, section: 0 })
  const sceneRef = useRef(null)
  const audioRef = useRef(null)
  const voiceRef = useRef(null)
  const beatRef = useRef({ section: 0, line: 0 })

  const [progress, setProgress] = useState(0)
  const [ready, setReady] = useState(false)
  const [minTime, setMinTime] = useState(false)
  const [loaderGone, setLoaderGone] = useState(false)
  const [beat, setBeat] = useState({ section: 0, line: 0 })
  const [activeIndex, setActiveIndex] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [detailId, setDetailId] = useState(null)
  const [soundOn, setSoundOn] = useState(false)
  const [voiceOn, setVoiceOn] = useState(false)
  const [entered, setEntered] = useState(false)
  const [tourOn, setTourOn] = useState(false)

  const finePointer = useMediaQuery('(pointer: fine)')
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  /* --------------------------------------------------------------- loader */
  useEffect(() => {
    const t = setTimeout(() => setMinTime(true), 1500)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!ready || !minTime) return
    const t = setTimeout(() => setLoaderGone(true), 1200)
    return () => clearTimeout(t)
  }, [ready, minTime])

  /* ---------------------------------------------------------------- scene */
  useEffect(() => {
    if (!stageRef.current) return
    const scene = new ReactorScene({
      container: stageRef.current,
      labelContainer: labelsRef.current,
      stateRef,
      callbacks: {
        onProgress: (p) => setProgress(p),
        onReady: () => setReady(true),
        onHotspot: (id) => {
          setDetailId(id)
          sceneRef.current?.setActiveHotspot(id)
        },
      },
    })
    sceneRef.current = scene
    return () => {
      scene.dispose()
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      audioRef.current?.dispose()
      audioRef.current = null
      voiceRef.current?.dispose()
      voiceRef.current = null
    }
  }, [])

  /* ------------------------------------------------------------- timeline */
  const onBeat = useCallback((b) => {
    beatRef.current = b
    setBeat(b)
    setActiveIndex(b.section)
    audioRef.current?.setEnergy(Math.min(1, b.section / 17))
    const line = sections[b.section]?.lines?.[b.line]
    if (line) {
      const key = `s${String(b.section).padStart(2, '0')}-l${b.line}`
      voiceRef.current?.speak(line, key)
    }
    if (b.section !== 16) {
      setDetailId(null)
      sceneRef.current?.setActiveHotspot(null)
    }
  }, [])

  useScrollEngine(stateRef, { onBeat })

  /* --------------------------------------------------------------- actions */
  const closeDetail = useCallback(() => {
    setDetailId(null)
    sceneRef.current?.setActiveHotspot(null)
  }, [])

  const toggleSound = useCallback(async () => {
    if (!audioRef.current) audioRef.current = new ReactorAudio()
    const on = await audioRef.current.toggle()
    setSoundOn(on)
    audioRef.current.setEnergy(Math.min(1, stateRef.current.timeline / 17))
  }, [])

  const toggleVoice = useCallback(() => {
    if (!voiceRef.current) voiceRef.current = new VoiceNarrator()
    const narrator = voiceRef.current
    if (!narrator.supported) return
    narrator.enabled = !narrator.enabled
    setVoiceOn(narrator.enabled)
    if (narrator.enabled) {
      const { section, line } = beatRef.current
      const text = sections[section]?.lines?.[line] || sections[0].lines[0]
      const key = `s${String(section).padStart(2, '0')}-l${line}`
      narrator.speak(text, key)
    } else {
      narrator.stop()
    }
  }, [])

  /* ------------------------------------------------------- dive-in entry */
  const dive = useCallback(async () => {
    setEntered(true)
    // ambience on (only ever started from this button or the SOUND toggle)
    if (!audioRef.current) audioRef.current = new ReactorAudio()
    if (!soundOn) {
      const on = await audioRef.current.toggle()
      setSoundOn(on)
      audioRef.current.setEnergy(Math.min(1, stateRef.current.timeline / 17))
    }
    // hosted narration on, starting with the current line
    if (!voiceRef.current) voiceRef.current = new VoiceNarrator()
    const narrator = voiceRef.current
    if (narrator.supported && !narrator.enabled) {
      narrator.enabled = true
      setVoiceOn(true)
      const { section, line } = beatRef.current
      const text = sections[section]?.lines?.[line] || sections[0].lines[0]
      const key = `s${String(section).padStart(2, '0')}-l${line}`
      narrator.speak(text, key)
    }
    // guided tour: advance one narration beat at a time
    if (!reducedMotion) setTourOn(true)
  }, [soundOn, reducedMotion])

  const enterQuiet = useCallback(() => {
    setEntered(true)
  }, [])

  /* ------------------------------------------------------------- auto-tour */
  useEffect(() => {
    if (!tourOn) return
    const stop = () => setTourOn(false)
    const onUserInput = () => stop()
    window.addEventListener('wheel', onUserInput, { passive: true })
    window.addEventListener('touchstart', onUserInput, { passive: true })
    window.addEventListener('keydown', onUserInput)

    const id = window.setInterval(() => {
      const t = stateRef.current.timeline
      const next = Math.floor(t) + 1
      if (next >= 17.85) {
        stop()
        return
      }
      window.scrollTo({ top: scrollYForTimeline(next), behavior: 'smooth' })
    }, 3400)

    return () => {
      window.clearInterval(id)
      window.removeEventListener('wheel', onUserInput)
      window.removeEventListener('touchstart', onUserInput)
      window.removeEventListener('keydown', onUserInput)
    }
  }, [tourOn])

  const jumpTo = useCallback(
    (index) => {
      setMenuOpen(false)
      setDetailId(null)
      sceneRef.current?.setActiveHotspot(null)
      const y = scrollYForSection(index)
      window.setTimeout(() => {
        window.scrollTo({ top: y, behavior: reducedMotion ? 'auto' : 'smooth' })
      }, 90)
    },
    [reducedMotion]
  )

  const restart = useCallback(() => {
    setDetailId(null)
    sceneRef.current?.setActiveHotspot(null)
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' })
  }, [reducedMotion])

  /* --------------------------------------------------- debug / QA helpers */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('skipLoader') === '1') {
      setReady(true)
      setMinTime(true)
      setLoaderGone(true)
      setEntered(true)
    }
    if (params.has('t')) {
      const t = parseFloat(params.get('t'))
      if (Number.isFinite(t)) {
        window.setTimeout(() => window.scrollTo(0, scrollYForTimeline(t)), 160)
      }
    }
    window.__ARC__ = {
      stateRef,
      sceneRef,
      voiceRef,
      scrollToTimeline: (t) => window.scrollTo(0, scrollYForTimeline(t)),
      scrollToSection: (i) => window.scrollTo(0, scrollYForSection(i)),
    }
    return () => {
      delete window.__ARC__
    }
  }, [])

  return (
    <div className="app">
      <div className="stage" ref={stageRef} aria-hidden="true" />
      <div className="label-layer" ref={labelsRef} aria-hidden="true" />
      <Atmosphere />

      <Hud
        activeIndex={activeIndex}
        soundOn={soundOn}
        voiceOn={voiceOn}
        onToggleSound={toggleSound}
        onToggleVoice={toggleVoice}
        onOpenMenu={() => setMenuOpen(true)}
      />

      <ProgressRail activeIndex={activeIndex} onJump={jumpTo} stateRef={stateRef} />
      <Captions beat={beat} />
      <CaptionLive beat={beat} />
      <DimensionFrame active={activeIndex === 1} />
      <Outro active={activeIndex >= 17} onRestart={restart} />

      <Menu open={menuOpen} activeIndex={activeIndex} onClose={() => setMenuOpen(false)} onJump={jumpTo} />
      <DetailPanel id={detailId} onClose={closeDetail} />

      <Cursor enabled={finePointer && !reducedMotion} />

      {tourOn && (
        <button type="button" className="tour-pill" onClick={() => setTourOn(false)}>
          <span className="tour-pill-dot" aria-hidden="true" />
          GUIDED TOUR — TAP TO TAKE CONTROL
        </button>
      )}

      <DiveGate open={loaderGone && !entered} onDive={dive} onQuiet={enterQuiet} />

      <div className="scroll-space" style={{ height: `calc(${TOTAL_VH}vh + 100vh)` }} aria-hidden="true" />

      <AnimatePresence>
        {!loaderGone && <Loader progress={progress} done={ready && minTime} />}
      </AnimatePresence>
    </div>
  )
}
