export type Rgb = readonly [number, number, number]

export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function norm(a: number, b: number, v: number): number {
  return clamp((v - a) / (b - a), 0, 1)
}

export function smoothstep(a: number, b: number, v: number): number {
  const t = norm(a, b, v)
  return t * t * (3 - 2 * t)
}

/**
 * Sinusoidal acceleration into a steady cruise and sinusoidal deceleration out.
 * Parameter r is the fraction of [0, 1] spent ramping on each end.
 */
export function glide(t: number, r = 0.2): number {
  const k = clamp(t, 0, 1)
  const ramp = clamp(r, 0.01, 0.49)
  const v = 1 / (1 - ramp * (2 - 4 / Math.PI))
  const w = Math.PI / (2 * ramp)
  if (k < ramp) return v * (k - Math.sin(w * k) / w)
  if (k > 1 - ramp) {
    const u = 1 - k
    return 1 - v * (u - Math.sin(w * u) / w)
  }
  return v * (k - ramp * (1 - 2 / Math.PI))
}

export function hash(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453123
  return x - Math.floor(x)
}

export function prng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function mixRgb(a: Rgb, b: Rgb, t: number): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]
}

export function scaleRgb(c: Rgb, factor: number): [number, number, number] {
  return [
    clamp(c[0] * factor, 0, 255),
    clamp(c[1] * factor, 0, 255),
    clamp(c[2] * factor, 0, 255),
  ]
}

export function rgbCss(c: Rgb, a?: number): string {
  const r = Math.round(clamp(c[0], 0, 255))
  const g = Math.round(clamp(c[1], 0, 255))
  const b = Math.round(clamp(c[2], 0, 255))
  return a === undefined ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`
}

/**
 * Fritsch–Carlson monotone cubic Hermite spline.
 * Preserves monotonicity so camera framing never overshoots or jitters.
 */
export function monotoneSpline(
  xs: readonly number[],
  ys: readonly number[]
): (x: number) => number {
  const n = xs.length
  const d: number[] = []
  for (let i = 0; i < n - 1; i++) {
    d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]))
  }
  const m: number[] = [d[0]]
  for (let i = 1; i < n - 1; i++) {
    m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2)
  }
  m.push(d[n - 2])

  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0
      m[i + 1] = 0
    } else {
      const a = m[i] / d[i]
      const b = m[i + 1] / d[i]
      const s = a * a + b * b
      if (s > 9) {
        const t = 3 / Math.sqrt(s)
        m[i] = t * a * d[i]
        m[i + 1] = t * b * d[i]
      }
    }
  }

  return (x: number) => {
    if (x <= xs[0]) return ys[0]
    if (x >= xs[n - 1]) return ys[n - 1]
    let i = 0
    while (i < n - 2 && x > xs[i + 1]) i++
    const h = xs[i + 1] - xs[i]
    const t = (x - xs[i]) / h
    const t2 = t * t
    const t3 = t2 * t
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h * m[i + 1]
    )
  }
}
