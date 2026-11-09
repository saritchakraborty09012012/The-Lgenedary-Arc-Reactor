import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { sections } from '../data/narrative'

const EASE = [0.16, 1, 0.3, 1]

export default function Menu({ open, activeIndex, onClose, onJump }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="menu"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
          role="dialog"
          aria-modal="true"
          aria-label="Section index"
        >
          <div className="menu-grid-bg" aria-hidden="true" />
          <div className="menu-inner">
            <div className="menu-head">
              <div>
                <span className="menu-eyebrow">ARC REACTOR / MK I</span>
                <h2 className="menu-title">SEQUENCE INDEX</h2>
              </div>
              <button type="button" className="menu-close" onClick={onClose} aria-label="Close index">
                CLOSE <span aria-hidden="true">✕</span>
              </button>
            </div>

            <ol className="menu-list">
              {sections.map((s, i) => (
                <motion.li
                  key={s.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 + i * 0.022, duration: 0.5, ease: EASE }}
                >
                  <button
                    type="button"
                    className={`menu-item ${i === activeIndex ? 'is-active' : ''}`}
                    onClick={() => onJump(i)}
                    aria-current={i === activeIndex ? 'true' : undefined}
                  >
                    <span className="menu-num">{s.num}</span>
                    <span className="menu-label">{s.label}</span>
                    <span className="menu-line" aria-hidden="true" />
                    <span className="menu-kicker">{s.kicker}</span>
                  </button>
                </motion.li>
              ))}
            </ol>

            <div className="menu-foot">
              <span>18 SECTIONS / ONE REACTOR</span>
              <span>SCROLL OR SELECT A BEAT</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
