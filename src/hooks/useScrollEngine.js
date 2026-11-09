import { useEffect, useRef } from 'react'
import { sections } from '../data/narrative'
import { clamp } from '../lib/math'

/**
 * The page is paced by a tall spacer. Each section owns `height * PACE` vh of
 * scroll. The timeline is expressed in "section units": 0 = first beat of
 * section 0, 17.5 = halfway through the finale, etc.
 */
export const PACE = 0.62

export const heights = sections.map((s) => s.height * PACE)

export const cumulative = []
{
  let acc = 0
  for (const h of heights) {
    cumulative.push(acc)
    acc += h
  }
}

export const TOTAL_VH = heights.reduce((a, b) => a + b, 0)

export function scrollYForSection(index) {
  const i = clamp(Math.round(index), 0, sections.length - 1)
  const vhUnit = (window.innerHeight || 1) / 100
  return (cumulative[i] + heights[i] * 0.12) * vhUnit
}

export function scrollYForTimeline(t) {
  const vhUnit = (window.innerHeight || 1) / 100
  const i = clamp(Math.floor(t), 0, sections.length - 1)
  const local = clamp(t - i, 0, 0.9999)
  return (cumulative[i] + local * heights[i]) * vhUnit
}

export function useScrollEngine(stateRef, callbacks = {}) {
  const cbRef = useRef(callbacks)
  cbRef.current = callbacks

  useEffect(() => {
    let raf = 0
    let queued = false
    let lastSection = -1
    let lastLine = -1

    const read = () => {
      queued = false
      const vhUnit = (window.innerHeight || 1) / 100
      const y = window.scrollY || window.pageYOffset || 0
      const units = y / vhUnit

      let i = 0
      while (i < heights.length - 1 && units >= cumulative[i + 1]) i += 1
      const local = clamp((units - cumulative[i]) / Math.max(0.0001, heights[i]), 0, 0.99999)
      const timeline = i + local
      const progress = clamp(y / Math.max(1, TOTAL_VH * vhUnit), 0, 1)

      stateRef.current.timeline = timeline
      stateRef.current.progress = progress
      stateRef.current.section = i

      const n = sections[i].lines.length
      const line = Math.min(n - 1, Math.floor(local * n))

      if (i !== lastSection || line !== lastLine) {
        lastSection = i
        lastLine = line
        cbRef.current.onBeat?.({ section: i, line })
      }
      cbRef.current.onProgress?.(progress, timeline)
    }

    const schedule = () => {
      if (queued) return
      queued = true
      raf = requestAnimationFrame(read)
    }

    // set initial value immediately
    read()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)
    // catch late layout shifts (fonts, images)
    const late = setTimeout(read, 450)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(late)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
    }
  }, [stateRef])
}
