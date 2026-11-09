import { AnimatePresence, motion } from 'framer-motion'

const EASE = [0.16, 1, 0.3, 1]

export default function DimensionFrame({ active }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="dim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          aria-hidden="true"
        >
          <motion.div
            className="dim-h"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            exit={{ scaleX: 0 }}
            transition={{ duration: 0.9, ease: EASE }}
          >
            <span className="dim-tick dim-tick-l" />
            <span className="dim-tick dim-tick-r" />
            <span className="dim-label">3.5 in / 9 cm</span>
          </motion.div>

          <motion.div
            className="dim-v"
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            exit={{ scaleY: 0 }}
            transition={{ duration: 0.9, delay: 0.08, ease: EASE }}
          >
            <span className="dim-tick dim-tick-t" />
            <span className="dim-tick dim-tick-b" />
            <span className="dim-label dim-label-v">2 in / 5 cm</span>
          </motion.div>

          <motion.div
            className="dim-note"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.45, duration: 0.6, ease: EASE }}
          >
            <span>FIG. 01</span>
            PHYSICAL SCALE — 1:1
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
