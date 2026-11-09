import { AnimatePresence, motion } from 'framer-motion'

const EASE = [0.16, 1, 0.3, 1]

/**
 * Entry gate. The experience only begins when the user dives in —
 * that one click starts the reactor ambience + the hosted narration
 * and the guided auto-tour. SOUND / VOICE toggles stay available
 * in the top-right corner afterwards, exactly as before.
 */
export default function DiveGate({ open, onDive, onQuiet }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="dive-gate"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, filter: 'blur(16px)', scale: 1.02 }}
          transition={{ duration: 0.85, ease: EASE }}
          role="dialog"
          aria-modal="true"
          aria-label="Enter the Arc Reactor story"
        >
          <div className="dive-veil" aria-hidden="true" />
          <div className="dive-inner">
            <motion.div
              className="dive-eyebrow"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.55, ease: EASE }}
            >
              THE STORY OF THE
            </motion.div>

            <motion.h1
              className="dive-title"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16, duration: 0.6, ease: EASE }}
            >
              ARC <em>REACTOR</em>
            </motion.h1>

            <motion.p
              className="dive-sub"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28, duration: 0.55, ease: EASE }}
            >
              A miniature fusion reactor, taken apart piece by piece.
              <br />
              Sound on — a host will tell the story.
            </motion.p>

            <motion.button
              type="button"
              className="dive-btn"
              onClick={onDive}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.55, ease: EASE }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              autoFocus
            >
              <span className="dive-btn-core" aria-hidden="true" />
              DIVE INTO THE REACTOR
              <span className="dive-btn-arrow" aria-hidden="true">
                →
              </span>
            </motion.button>

            <motion.button
              type="button"
              className="dive-quiet"
              onClick={onQuiet}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.55, ease: EASE }}
            >
              explore silently, without sound
            </motion.button>

            <motion.div
              className="dive-foot"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.65, duration: 0.55, ease: EASE }}
              aria-hidden="true"
            >
              <span>18 CHAPTERS</span>
              <span className="dive-foot-dot" />
              <span>NARRATED TOUR</span>
              <span className="dive-foot-dot" />
              <span>3 GJ/s</span>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
