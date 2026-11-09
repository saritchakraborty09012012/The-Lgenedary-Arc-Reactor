export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const smoothstep = (t) => {
  t = clamp(t)
  return t * t * (3 - 2 * t)
}
export const smootherstep = (t) => {
  t = clamp(t)
  return t * t * t * (t * (t * 6 - 15) + 10)
}
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt))
export const mapRange = (v, a, b, c, d) => c + ((v - a) / (b - a)) * (d - c)
export const lerp3 = (a, b, t) => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
]
export const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
