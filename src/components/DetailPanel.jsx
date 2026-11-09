import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { hotspots } from '../data/narrative'

const EASE = [0.16, 1, 0.3, 1]

export default function DetailPanel({ id, onClose }) {
  const closeRef = useRef(null)
  const hotspot = hotspots.find((h) => h.id === id) || null

  useEffect(() => {
    if (!hotspot) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const t = setTimeout(() => closeRef.current?.focus(), 350)
    return () => {
      window.removeEventListener('keydown', onKey)
      clearTimeout(t)
    }
  }, [hotspot, onClose])

  return (
    <AnimatePresence>
      {hotspot && (
        <motion.aside
          className="detail"
          initial={{ x: '104%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '104%', opacity: 0 }}
          transition={{ duration: 0.62, ease: EASE }}
          role="dialog"
          aria-modal="false"
          aria-label={hotspot.title}
        >
          <div className="detail-grid" aria-hidden="true" />
          <div className="detail-top">
            <span className="detail-kicker">{hotspot.kicker}</span>
            <button ref={closeRef} type="button" className="detail-close" onClick={onClose} aria-label="Close detail panel">
              CLOSE <span aria-hidden="true">✕</span>
            </button>
          </div>

          <h2 className="detail-title">{hotspot.title}</h2>
          <p className="detail-desc">{hotspot.description}</p>

          <dl className="detail-specs">
            {hotspot.specs.map(([k, v], i) => (
              <motion.div
                key={k}
                className="detail-spec"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 + i * 0.07, duration: 0.5, ease: EASE }}
              >
                <dt>{k}</dt>
                <dd>{v}</dd>
              </motion.div>
            ))}
          </dl>

          <div className="detail-foot">
            <span className="detail-live">
              <i aria-hidden="true" />
              LIVE TELEMETRY
            </span>
            <span>ARC REACTOR / MK I</span>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
