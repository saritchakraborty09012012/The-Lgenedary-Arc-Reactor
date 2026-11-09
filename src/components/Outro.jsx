import { AnimatePresence, motion } from 'framer-motion'

const EASE = [0.16, 1, 0.3, 1]

export default function Outro({ active, onRestart }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="outro"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          <motion.div
            className="outro-title"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            <span className="outro-kicker">SEQUENCE COMPLETE</span>
            <h2>
              THE LEGENDARY
              <br />
              <em>ARC REACTOR</em>
            </h2>
          </motion.div>

          <motion.button
            type="button"
            className="outro-btn"
            onClick={onRestart}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.25, duration: 0.7, ease: EASE }}
          >
            <span className="outro-btn-icon" aria-hidden="true">
              ↺
            </span>
            REINITIALIZE SEQUENCE
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
