import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

export default function Loader({ progress = 0, done = false }) {
  const [shown, setShown] = useState(0)
  const raf = useRef(0)
  const state = useRef({ value: 0, last: 0 })

  useEffect(() => {
    const tick = (now) => {
      const s = state.current
      const dt = Math.min(0.06, (now - (s.last || now)) / 1000)
      s.last = now
      const target = done ? 100 : Math.max(progress, 0)
      const cap = done ? 100 : 93
      const speed = done ? 90 : 26
      s.value = Math.min(cap, s.value + dt * speed)
      if (target > s.value) s.value = Math.min(cap, target)
      setShown(s.value)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [progress, done])

  const pct = Math.round(shown)
  const dash = 2 * Math.PI * 86
  const offset = dash - (dash * Math.min(100, shown)) / 100

  return (
    <motion.div
      className="loader"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(14px)', scale: 1.035 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="loader-aura" aria-hidden="true" />
      <div className="loader-scan" aria-hidden="true" />

      <div className="loader-center">
        <svg className="loader-rings" viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="94" className="lr-hair" />
          <circle cx="100" cy="100" r="86" className="lr-track" />
          <circle
            cx="100"
            cy="100"
            r="86"
            className="lr-progress"
            strokeDasharray={dash}
            strokeDashoffset={offset}
            transform="rotate(-90 100 100)"
          />
          <circle cx="100" cy="100" r="68" className="lr-dashed" />
          <circle cx="100" cy="100" r="44" className="lr-inner" />
          <circle cx="100" cy="100" r="30" className="lr-glow" />
          {Array.from({ length: 10 }).map((_, i) => {
            const a = (i / 10) * Math.PI * 2
            return (
              <rect
                key={i}
                x={100 + Math.cos(a) * 58 - 2.4}
                y={100 + Math.sin(a) * 58 - 4}
                width="4.8"
                height="8"
                rx="1"
                className="lr-tick"
                transform={`rotate(${(i / 10) * 360 + 90} ${100 + Math.cos(a) * 58} ${100 + Math.sin(a) * 58})`}
              />
            )
          })}
        </svg>
        <div className="loader-core" aria-hidden="true" />
        <div className="loader-pct">
          {String(pct).padStart(2, '0')}
          <span>%</span>
        </div>
      </div>

      <div className="loader-copy">
        <div className="loader-brand">THE STORY OF THE</div>
        <div className="loader-title">ARC REACTOR</div>
        <div className="loader-status">
          <span className={done ? 'is-live' : ''} />
          {done ? 'SYSTEM ONLINE' : 'INITIALIZING FUSION CHAMBER'}
        </div>
      </div>

      <div className="loader-foot">
        <span>MK I / 01</span>
        <span>CLASSIFIED — REACTOR SYSTEMS</span>
        <span>3 GJ/s</span>
      </div>
    </motion.div>
  )
}
