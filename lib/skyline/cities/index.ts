import {
  clamp,
  glide,
  lerp,
  mixRgb,
  monotoneSpline,
  norm,
  prng,
  smoothstep,
} from "../math"
import type {
  CityConfig,
  CityId,
  FillBuilding,
  Palette,
  PaletteStop,
} from "../types"
import { HONGKONG_CITY } from "./hongkong"
import { LONDON_CITY } from "./london"
import { NYC_CITY } from "./nyc"
import { PARIS_CITY } from "./paris"
import { TOKYO_CITY } from "./tokyo"

export const INTRO_SECONDS = 25
export const FADE_SECONDS = 2.2
export const WRITE_TAIL = 1.6
export const TOUR_HOLD_LEAD = 0.08

export const ENGINE_CFG = {
  smoothing: 0.11,
  arrival: 0.84,
} as const

export const CITIES: readonly CityConfig[] = [
  NYC_CITY,
  PARIS_CITY,
  LONDON_CITY,
  TOKYO_CITY,
  HONGKONG_CITY,
]

export const DEFAULT_CITY_ID: CityId = "nyc"

export const CITY_MAP: Record<CityId, CityConfig> = {
  nyc: NYC_CITY,
  paris: PARIS_CITY,
  london: LONDON_CITY,
  tokyo: TOKYO_CITY,
  hongkong: HONGKONG_CITY,
}

export function resolveCityId(raw: string | null | undefined): CityId {
  if (!raw) return DEFAULT_CITY_ID
  const lower = raw.toLowerCase().trim()
  if (lower in CITY_MAP) return lower as CityId
  if (lower === "new-york" || lower === "manhattan") return "nyc"
  if (lower === "hk" || lower === "hong-kong") return "hongkong"
  return DEFAULT_CITY_ID
}

// -----------------------------------------------------------------------------
// Diurnal Atmospheric Palette (10 stops across dawn -> daylight -> dusk -> night)
// -----------------------------------------------------------------------------
const PAL: readonly PaletteStop[] = [
  {
    p: 0.0,
    top: [14, 21, 44],
    mid: [30, 42, 74],
    hor: [78, 86, 118],
    bd: [18, 24, 42],
    bdLit: [52, 62, 90],
    wat: [16, 24, 46],
    glow: [110, 124, 168],
    sun: -0.08,
  },
  {
    p: 0.12,
    top: [34, 48, 88],
    mid: [94, 88, 122],
    hor: [204, 146, 124],
    bd: [38, 38, 60],
    bdLit: [118, 92, 96],
    wat: [32, 42, 68],
    glow: [232, 166, 130],
    sun: 0.06,
  },
  {
    p: 0.25,
    top: [64, 110, 168],
    mid: [130, 164, 204],
    hor: [234, 202, 174],
    bd: [60, 74, 98],
    bdLit: [148, 152, 164],
    wat: [54, 86, 128],
    glow: [244, 212, 176],
    sun: 0.28,
  },
  {
    p: 0.4,
    top: [56, 118, 184],
    mid: [118, 172, 222],
    hor: [216, 228, 240],
    bd: [56, 76, 102],
    bdLit: [142, 162, 184],
    wat: [46, 92, 142],
    glow: [210, 228, 246],
    sun: 0.56,
  },
  {
    p: 0.53,
    top: [62, 108, 166],
    mid: [148, 170, 198],
    hor: [246, 208, 158],
    bd: [54, 64, 86],
    bdLit: [168, 142, 114],
    wat: [52, 78, 112],
    glow: [252, 202, 142],
    sun: 0.34,
  },
  {
    p: 0.65,
    top: [44, 52, 98],
    mid: [146, 86, 102],
    hor: [246, 156, 110],
    bd: [38, 34, 58],
    bdLit: [152, 92, 88],
    wat: [36, 40, 68],
    glow: [255, 168, 112],
    sun: 0.1,
  },
  {
    p: 0.75,
    top: [22, 28, 64],
    mid: [62, 48, 84],
    hor: [146, 92, 102],
    bd: [20, 22, 42],
    bdLit: [78, 56, 78],
    wat: [18, 22, 48],
    glow: [224, 148, 108],
    sun: -0.06,
  },
  {
    p: 0.86,
    top: [11, 16, 40],
    mid: [22, 30, 60],
    hor: [54, 56, 88],
    bd: [14, 18, 36],
    bdLit: [44, 48, 76],
    wat: [11, 17, 38],
    glow: [242, 180, 114],
    sun: -0.2,
  },
  {
    p: 1.0,
    top: [7, 10, 28],
    mid: [14, 20, 44],
    hor: [32, 38, 66],
    bd: [11, 15, 30],
    bdLit: [34, 40, 64],
    wat: [8, 13, 30],
    glow: [246, 188, 118],
    sun: -0.32,
  },
]

export function paletteAt(p: number): Palette {
  const k = clamp(p, 0, 1)
  let i = 0
  while (i < PAL.length - 2 && k > PAL[i + 1].p) i++
  const a = PAL[i]
  const b = PAL[i + 1]
  const t = (k - a.p) / (b.p - a.p)
  return {
    top: mixRgb(a.top, b.top, t),
    mid: mixRgb(a.mid, b.mid, t),
    hor: mixRgb(a.hor, b.hor, t),
    bd: mixRgb(a.bd, b.bd, t),
    bdLit: mixRgb(a.bdLit, b.bdLit, t),
    wat: mixRgb(a.wat, b.wat, t),
    glow: mixRgb(a.glow, b.glow, t),
    sun: lerp(a.sun, b.sun, t),
  }
}

// -----------------------------------------------------------------------------
// Per-City Timeline, Camera Framing, Procedural Fill & Tour Helpers
// -----------------------------------------------------------------------------
export function yearAtForCity(city: CityConfig, p: number): number {
  const t = clamp(p, 0, ENGINE_CFG.arrival) / ENGINE_CFG.arrival
  const k = glide(t, 0.24)
  const expS = Math.exp(city.expK) - 1
  const curve = Math.log(1 + k * expS) / city.expK
  return city.startYear + (city.endYear - city.startYear) * curve
}

export function progressAtYearForCity(
  city: CityConfig,
  targetYear: number
): number {
  const y = clamp(targetYear, city.startYear, city.endYear)
  let lo = 0
  let hi: number = ENGINE_CFG.arrival
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (yearAtForCity(city, mid) < y) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

export function createFrameSampler(city: CityConfig) {
  const years = city.frames.map((f) => f[0])
  const x0Of = monotoneSpline(
    years,
    city.frames.map((f) => f[1])
  )
  const x1Of = monotoneSpline(
    years,
    city.frames.map((f) => f[2])
  )
  return (year: number): { x0: number; x1: number } => ({
    x0: x0Of(year),
    x1: x1Of(year),
  })
}

export function eraLabelForCity(
  city: CityConfig,
  year: number,
  touring: boolean
): string {
  if (touring) return city.nightEraLabel
  for (const band of city.eraBands) {
    if (year < band.untilYear) return band.label
  }
  return city.eraBands[city.eraBands.length - 1]?.label ?? "Night Horizon"
}

export function buildFillForCity(
  city: CityConfig,
  count: number
): FillBuilding[] {
  const r = prng(city.fillSeed)
  const totalW = city.districts.reduce((s, d) => s + d.w, 0)
  const out: FillBuilding[] = []
  let idx = 0

  for (const d of city.districts) {
    const n = Math.max(6, Math.round((count * d.w) / totalW))
    for (let i = 0; i < n; i++) {
      const x = d.a + r() * (d.b - d.a)
      const z = r()
      const t = Math.pow(r(), 1.32)
      const built = Math.round(d.start + t * (city.endYear - 2 - d.start))

      let cap = Math.min(d.maxH, 42)
      if (built > 1760) cap = Math.min(d.maxH, 74)
      if (built > 1850) cap = Math.min(d.maxH, 138)
      if (built > 1895) cap = Math.min(d.maxH, 340)
      if (built > 1925) cap = d.maxH
      if (built > 1965) cap = d.maxH * 1.08

      // Keep Haussmannian Paris uniform and low
      const isMansard = d.preferType === "mansard"
      const h = isMansard
        ? Math.max(38, cap * (0.64 + r() * 0.36))
        : Math.max(24, cap * (0.2 + Math.pow(r(), 1.75) * 0.8))

      const w = isMansard
        ? 0.0042 + r() * 0.0052
        : (0.0022 + r() * 0.0046) * (h > 340 ? 1.24 : 0.88)

      const isGlass =
        !isMansard && built > d.glass && h > 175 && r() > 0.32

      let demo: number | undefined
      if (!isMansard) {
        if (built < 1885 && r() < 0.56) {
          demo = Math.min(2020, built + 55 + Math.round(r() * 85))
        } else if (built < 1925 && h < 170 && r() < 0.22) {
          demo = Math.min(2022, built + 45 + Math.round(r() * 65))
        }
      }

      out.push({
        id: `${city.id}-fill-${idx++}`,
        x,
        w,
        h,
        z,
        built,
        demo,
        type: isMansard ? "mansard" : isGlass ? "glass" : "box",
        wt: Boolean(city.hasWaterTowers) && !isGlass && h > 82 && h < 420 && r() < 0.32,
        bh: !isMansard && h > 110 && r() < 0.44,
        win: r(),
        isHero: false,
      })
    }
  }

  out.sort((a, b) => a.z - b.z)
  return out
}

export interface TourSample {
  from: number
  index: number
  move: number
  activeIndex: number
  opacities: number[]
  subject: string
}

export function tourScrollProgressForStop(
  stopIndex: number,
  totalStops: number
): number {
  const n = Math.max(1, totalStops)
  const idx = clamp(stopIndex, 0, n - 1)
  if (idx === 0) return 0.04
  const seg = (1 - TOUR_HOLD_LEAD) / (n - 1)
  return clamp(TOUR_HOLD_LEAD + idx * seg - seg * 0.12, 0.04, 0.995)
}

export function sampleTourForCity(city: CityConfig, q: number): TourSample {
  const stops = city.tourStops
  const n = stops.length
  const opacities = stops.map(() => 0)

  if (n === 0) {
    return {
      from: 0,
      index: 0,
      move: 1,
      activeIndex: 0,
      opacities,
      subject: "",
    }
  }

  if (q <= TOUR_HOLD_LEAD) {
    const t = norm(0, TOUR_HOLD_LEAD, q)
    opacities[0] = smoothstep(0.05, 0.38, t)
    return {
      from: 0,
      index: 0,
      move: 1,
      activeIndex: 0,
      opacities,
      subject: stops[0].subject,
    }
  }

  const u = clamp((q - TOUR_HOLD_LEAD) / (1 - TOUR_HOLD_LEAD), 0, 1) * (n - 1)
  const segIdx = Math.min(n - 2, Math.floor(u))
  const local = u - segIdx
  const from = segIdx
  const index = segIdx + 1
  const move = glide(norm(0.06, 0.56, local))

  // Smooth handoff of open-sky chapter copy
  opacities[from] = 1 - smoothstep(0.04, 0.3, local)
  opacities[index] = smoothstep(0.36, 0.62, local)

  // Keep final stop visible at end of scroll
  if (index === n - 1 && local > 0.62) {
    opacities[index] = 1
  }

  const activeIndex = local < 0.34 ? from : index
  return {
    from,
    index,
    move,
    activeIndex,
    opacities,
    subject: stops[activeIndex].subject,
  }
}
