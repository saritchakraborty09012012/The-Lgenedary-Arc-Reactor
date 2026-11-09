import { sections } from '../data/narrative'

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 44 44" aria-hidden="true">
      <circle cx="22" cy="22" r="20" className="bm-hair" />
      <circle cx="22" cy="22" r="15" className="bm-ring" />
      <circle cx="22" cy="22" r="10.5" className="bm-dash" />
      {Array.from({ length: 10 }).map((_, i) => {
        const a = (i / 10) * Math.PI * 2
        return (
          <rect
            key={i}
            x={22 + Math.cos(a) * 12.6 - 1.6}
            y={22 + Math.sin(a) * 12.6 - 2.6}
            width="3.2"
            height="5.2"
            rx="0.8"
            className="bm-tick"
            transform={`rotate(${(i / 10) * 360 + 90} ${22 + Math.cos(a) * 12.6} ${22 + Math.sin(a) * 12.6})`}
          />
        )
      })}
      <circle cx="22" cy="22" r="3.1" className="bm-core" />
    </svg>
  )
}

function VoiceIcon({ on }) {
  return (
    <svg
      className={`voice-icon ${on ? 'is-on' : ''}`}
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 5 6.5 9H3v6h3.5L11 19z" fill="currentColor" stroke="none" />
      {on ? (
        <>
          <path d="M15 9.5a3.5 3.5 0 0 1 0 5" />
          <path d="M17.5 7a7 7 0 0 1 0 10" />
        </>
      ) : (
        <>
          <path d="M15.5 9.5l5 5" />
          <path d="M20.5 9.5l-5 5" />
        </>
      )}
    </svg>
  )
}

export default function Hud({ activeIndex, soundOn, voiceOn, onToggleSound, onToggleVoice, onOpenMenu }) {
  const section = sections[activeIndex] ?? sections[0]
  const showHint = activeIndex <= 1

  return (
    <>
      <header className="hud hud-top">
        <div className="hud-brand">
          <BrandMark />
          <div className="brand-copy">
            <span className="brand-kicker">THE STORY OF THE</span>
            <span className="brand-title">
              ARC REACTOR <em>MK I</em>
            </span>
          </div>
        </div>

        <div className="hud-actions">
          <button
            type="button"
            className={`hud-btn ${soundOn ? 'is-on' : ''}`}
            onClick={onToggleSound}
            aria-pressed={soundOn}
            aria-label={soundOn ? 'Mute reactor ambience' : 'Enable reactor ambience'}
          >
            <span className={`eq ${soundOn ? 'is-live' : ''}`} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="hud-btn-label">{soundOn ? 'SOUND ON' : 'SOUND OFF'}</span>
          </button>
          <button
            type="button"
            className={`hud-btn ${voiceOn ? 'is-on' : ''}`}
            onClick={onToggleVoice}
            aria-pressed={voiceOn}
            aria-label={voiceOn ? 'Stop voice narration' : 'Start voice narration'}
          >
            <VoiceIcon on={voiceOn} />
            <span className="hud-btn-label">{voiceOn ? 'VOICE ON' : 'VOICE OFF'}</span>
          </button>
          <button type="button" className="hud-btn" onClick={onOpenMenu} aria-label="Open section index">
            <span className="hud-btn-label">INDEX</span>
            <span className="hud-btn-dot" aria-hidden="true" />
          </button>
        </div>
      </header>

      <footer className="hud hud-foot">
        <div className="hud-section" aria-live="polite">
          <span className="hud-num">{section.num}</span>
          <span className="hud-rule" aria-hidden="true" />
          <span className="hud-label">{section.label}</span>
          <span className="hud-total">/ {String(sections.length).padStart(2, '0')}</span>
        </div>

        <div className={`hud-hint ${showHint ? '' : 'is-dim'}`} aria-hidden="true">
          <span>SCROLL TO {activeIndex === 0 ? 'DECONSTRUCT' : 'CONTINUE'}</span>
          <span className="hud-arrow">↓</span>
        </div>

        <div className="hud-telemetry" aria-hidden="true">
          <div>
            <span>OUTPUT</span>
            <b>3.0 GJ/s</b>
          </div>
          <div>
            <span>CORE</span>
            <b>1.2 × 10⁹ K</b>
          </div>
          <div>
            <span>FIELD</span>
            <b>0.60 T</b>
          </div>
        </div>
      </footer>
    </>
  )
}
