import { AnimatePresence, motion } from 'framer-motion'
import { sections } from '../data/narrative'

const EASE = [0.16, 1, 0.3, 1]

export default function Captions({ beat }) {
  const section = sections[beat.section] ?? sections[0]
  const line = section.lines[Math.min(beat.line, section.lines.length - 1)] ?? ''
  const words = line.split(/\s+/).filter(Boolean)
  const key = `${beat.section}-${beat.line}`

  return (
    <div className="captions" aria-hidden="true">
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={key}
          className="caption-layer"
          initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -26, filter: 'blur(10px)' }}
          transition={{ duration: 0.72, ease: EASE }}
        >
          <p className="caption-text">
            {words.map((word, i) => (
              <motion.span
                key={`${word}-${i}`}
                className="word"
                initial={{ opacity: 0, y: '0.42em', filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: '0em', filter: 'blur(0px)' }}
                transition={{ delay: 0.06 + i * 0.042, duration: 0.62, ease: EASE }}
              >
                {word}
              </motion.span>
            ))}
          </p>
          {beat.section === 0 && (
            <motion.span
              className="caption-scroll-hint"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.7, ease: EASE }}
            >
              SCROLL <i aria-hidden="true">↓</i>
            </motion.span>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export function CaptionLive({ beat }) {
  const section = sections[beat.section] ?? sections[0]
  const line = section.lines[Math.min(beat.line, section.lines.length - 1)] ?? ''
  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {line}
    </div>
  )
}
