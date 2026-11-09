import { useEffect, useRef } from 'react'
import { sections } from '../data/narrative'

export default function ProgressRail({ activeIndex, onJump, stateRef }) {
  const fillRef = useRef(null)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      if (fillRef.current) {
        const p = stateRef.current?.progress ?? 0
        fillRef.current.style.transform = `scaleY(${Math.max(0.001, p)})`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [stateRef])

  return (
    <nav className="rail" aria-label="Section index">
      <div className="rail-track" aria-hidden="true">
        <div className="rail-fill" ref={fillRef} />
      </div>
      <div className="rail-ticks">
        {sections.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`rail-tick ${i === activeIndex ? 'is-active' : ''}`}
            onClick={() => onJump(i)}
            aria-label={`Go to section ${s.num}: ${s.label}`}
            aria-current={i === activeIndex ? 'true' : undefined}
          >
            <span className="rail-tick-line" aria-hidden="true" />
            <span className="rail-tip" aria-hidden="true">
              <em>{s.num}</em>
              {s.label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  )
}
