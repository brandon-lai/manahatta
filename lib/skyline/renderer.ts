import {
  type AnyBuilding,
  buildFillForCity,
  type CityConfig,
  createFrameSampler,
  ENGINE_CFG,
  eraLabelForCity,
  type HeroLandmark,
  type Palette,
  paletteAt,
  profileOf,
  sampleTourForCity,
  yearAtForCity,
} from "./data"
import {
  clamp,
  hash,
  lerp,
  mixRgb,
  norm,
  prng,
  type Rgb,
  rgbCss,
  smoothstep,
} from "./math"

export interface HudSnapshot {
  p: number
  q: number
  year: number
  era: string
  caption: string
  touring: boolean
  activeStopIndex: number
  stopOpacities: number[]
  spotlightId: string | null
  handoverHint: boolean
}

export interface SpotlightTarget {
  id: string
  x: number
  span: number
  ft: number
  year: number
  p: number
}

export interface SkylineController {
  setCity: (city: CityConfig) => void
  setProgress: (p: number, q: number, immediate?: boolean) => void
  setSpotlight: (target: SpotlightTarget | null) => void
  setAudioEnergy: (energy: number) => void
  getState: () => { p: number; q: number; year: number }
  destroy: () => void
}

interface Star {
  x: number
  y: number
  r: number
  a: number
  phase: number
  speed: number
  tint: Rgb
}

interface Cloud {
  x: number
  y: number
  w: number
  h: number
  speed: number
  puffs: number
}

interface Tree {
  x: number
  h: number
  w: number
  s: number
}

interface PeakLight {
  x: number
  yFrac: number
  a: number
  warm: boolean
}

interface Camera {
  cx: number
  span: number
  cyFt: number
  ppwx: number
  ppft: number
}

function buildCaptionsForCity(city: CityConfig): { year: number; text: string }[] {
  const out: { year: number; text: string }[] = []
  for (const h of city.heroes) {
    if (h.cap) out.push({ year: h.built, text: h.cap })
    if (h.bye && h.demo) out.push({ year: h.demo, text: h.bye })
  }
  for (const e of city.events) {
    out.push({ year: e.year, text: e.text })
  }
  out.sort((a, b) => a.year - b.year)
  return out
}

export function initSkylineRenderer(
  canvas: HTMLCanvasElement,
  initialCity: CityConfig,
  onHudUpdate: (snapshot: HudSnapshot) => void
): SkylineController {
  const ctx = canvas.getContext("2d", { alpha: false })
  if (!ctx) {
    return {
      setCity: () => {},
      setProgress: () => {},
      setSpotlight: () => {},
      setAudioEnergy: () => {},
      getState: () => ({ p: 0, q: 0, year: initialCity.startYear }),
      destroy: () => {},
    }
  }

  // Offscreen reflection canvas for shimmering mirrored river/harbor water
  const reflCanvas = document.createElement("canvas")
  const reflCtx = reflCanvas.getContext("2d")

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches

  let W = 0
  let H = 0
  let DPR = 1
  let isMobile = false
  let EXAG = 3.2
  let baselineY = 0
  let hz = 0

  let activeCity = initialCity
  let frameAt = createFrameSampler(activeCity)
  let allCaptions = buildCaptionsForCity(activeCity)
  const fillCount =
    typeof window !== "undefined" && window.innerWidth < 768 ? 360 : 680
  let fillBuildings = buildFillForCity(activeCity, fillCount)

  // Deterministic celestial & landscape props
  const STARS: Star[] = (() => {
    const r = prng(91023)
    const tints: Rgb[] = [
      [255, 244, 224],
      [224, 236, 255],
      [255, 250, 240],
      [206, 226, 255],
    ]
    return Array.from({ length: 145 }, () => ({
      x: r(),
      y: Math.pow(r(), 1.35) * 0.62,
      r: 0.45 + Math.pow(r(), 2.2) * 1.35,
      a: 0.25 + r() * 0.72,
      phase: r() * Math.PI * 2,
      speed: 0.7 + r() * 1.9,
      tint: tints[Math.floor(r() * tints.length)],
    }))
  })()

  const CLOUDS: Cloud[] = (() => {
    const r = prng(4421)
    return Array.from({ length: 8 }, () => ({
      x: r(),
      y: 0.08 + r() * 0.34,
      w: 0.14 + r() * 0.2,
      h: 0.022 + r() * 0.032,
      speed: 0.0022 + r() * 0.0038,
      puffs: 3 + Math.floor(r() * 3),
    }))
  })()

  const TREES: Tree[] = (() => {
    const r = prng(1609)
    return Array.from({ length: 240 }, () => ({
      x: -0.01 + r() * 0.94,
      h: 22 + r() * 32,
      w: 0.0011 + r() * 0.0014,
      s: r(),
    }))
  })()

  const PEAK_LIGHTS: PeakLight[] = (() => {
    const r = prng(85201)
    return Array.from({ length: 95 }, () => ({
      x: 0.12 + r() * 0.78,
      yFrac: 0.14 + r() * 0.68,
      a: 0.32 + r() * 0.58,
      warm: r() > 0.22,
    }))
  })()

  const cam: Camera = { cx: 0.06, span: 0.16, cyFt: 0, ppwx: 1, ppft: 1 }

  function setCamera(cx: number, span: number, cyFt: number) {
    cam.cx = cx
    cam.span = span
    cam.cyFt = cyFt
    cam.ppwx = W / span
    cam.ppft = (cam.ppwx * EXAG) / activeCity.islandFt
  }

  function sx(wx: number): number {
    return W / 2 + (wx - cam.cx) * cam.ppwx
  }

  function sy(ft: number): number {
    return H / 2 - (ft - cam.cyFt) * cam.ppft
  }

  function framingForStop(stop: { x: number; span: number; ft: number }) {
    const span = isMobile ? Math.min(stop.span, 0.28) : stop.span
    const ppft = ((W / span) * EXAG) / activeCity.islandFt
    const baseCy = (baselineY - H / 2) / ppft
    const focusCy = stop.ft - (H * (isMobile ? 0.03 : 0.06)) / ppft
    const zoom = 1 - smoothstep(0.32, 0.62, span)
    return {
      cx: stop.x,
      span,
      cyFt: lerp(baseCy, Math.max(baseCy, focusCy), zoom),
    }
  }

  function resize() {
    W = window.innerWidth
    H = window.innerHeight
    DPR = Math.min(window.devicePixelRatio || 1, 2)
    isMobile = W < 768
    EXAG = isMobile ? 3.55 : 3.2
    baselineY = H * (isMobile ? 0.67 : 0.72)

    canvas.width = Math.round(W * DPR)
    canvas.height = Math.round(H * DPR)
    canvas.style.width = `${W}px`
    canvas.style.height = `${H}px`

    reflCanvas.width = Math.max(1, Math.round(W * 0.5))
    reflCanvas.height = Math.max(1, Math.round(H * 0.5))
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let targetP = 0
  let currentP = 0
  let targetQ = 0
  let currentQ = 0
  let audioEnergy = 0
  let smoothEnergy = 0
  let spotlight: SpotlightTarget | null = null
  let spotBlend = 0
  let lastSpot: SpotlightTarget | null = null

  let stopped = false
  let rafId = 0
  let lastHudEmit = 0
  let lastCaptionKey = ""
  let lastStopKey = -1

  // ---------------------------------------------------------------------------
  // Sky, Sun, Moon, Stars, Clouds & City Skyglow
  // ---------------------------------------------------------------------------
  function drawSky(p: number, pal: Palette, timeSec: number, nightness: number) {
    const g = ctx!.createLinearGradient(0, 0, 0, hz)
    g.addColorStop(0, rgbCss(pal.top))
    g.addColorStop(0.56, rgbCss(pal.mid))
    g.addColorStop(1, rgbCss(pal.hor))
    ctx!.fillStyle = g
    ctx!.fillRect(0, 0, W, hz + 2)

    // Warm/tinted urban light-pollution domes over the city's main districts at night
    if (nightness > 0.05) {
      const pulse = 1 + smoothEnergy * 0.24
      for (const d of activeCity.skyglowDomes) {
        const dx = sx(d.wx)
        const rad = Math.max(W * d.rFactor, 260)
        const col = d.tint ?? pal.glow
        const dg = ctx!.createRadialGradient(dx, hz, 0, dx, hz, rad)
        dg.addColorStop(0, rgbCss(col, nightness * d.strength * pulse))
        dg.addColorStop(0.48, rgbCss(col, nightness * d.strength * 0.35 * pulse))
        dg.addColorStop(1, rgbCss(col, 0))
        ctx!.fillStyle = dg
        ctx!.fillRect(0, 0, W, hz + 2)
      }
    }

    // Historical fire haze for NYC (1776) and London (1666)
    const year = yearAtForCity(activeCity, p)
    if (activeCity.id === "nyc") {
      const fireGlow =
        smoothstep(1772, 1776, year) * (1 - smoothstep(1777, 1783, year))
      if (fireGlow > 0.01) {
        const fx = sx(0.036)
        const fg = ctx!.createRadialGradient(fx, hz, 0, fx, hz, W * 0.22)
        fg.addColorStop(0, `rgba(255,112,48,${fireGlow * 0.36})`)
        fg.addColorStop(1, "rgba(255,112,48,0)")
        ctx!.fillStyle = fg
        ctx!.fillRect(0, 0, W, hz + 2)
      }
    } else if (activeCity.id === "london") {
      const fireGlow =
        smoothstep(1660, 1666, year) * (1 - smoothstep(1668, 1678, year))
      if (fireGlow > 0.01) {
        const fx = sx(0.44)
        const fg = ctx!.createRadialGradient(fx, hz, 0, fx, hz, W * 0.26)
        fg.addColorStop(0, `rgba(255,116,44,${fireGlow * 0.4})`)
        fg.addColorStop(1, "rgba(255,116,44,0)")
        ctx!.fillStyle = fg
        ctx!.fillRect(0, 0, W, hz + 2)
      }
    }

    // Twinkling stars at pre-dawn and night
    const starVis = Math.max(1 - smoothstep(0.02, 0.2, p), smoothstep(0.66, 0.86, p))
    if (starVis > 0.01) {
      ctx!.save()
      for (const st of STARS) {
        const twinkle = reduceMotion
          ? 0.85
          : 0.62 + 0.38 * Math.sin(timeSec * st.speed + st.phase)
        ctx!.globalAlpha = st.a * starVis * twinkle
        ctx!.fillStyle = rgbCss(st.tint)
        ctx!.beginPath()
        ctx!.arc(st.x * W, st.y * hz, st.r, 0, Math.PI * 2)
        ctx!.fill()
      }
      ctx!.restore()
    }

    // Sun & atmospheric sunrise/sunset glow
    const sunVis = smoothstep(0.09, 0.16, p) * (1 - smoothstep(0.65, 0.74, p))
    if (sunVis > 0.01) {
      const sp = norm(0.11, 0.7, p)
      const sunX = W * lerp(0.16, 0.84, sp)
      const sunY = hz * (0.94 - Math.sin(sp * Math.PI) * 0.72)
      const r = Math.min(W, H) * 0.025
      const warm = mixRgb([255, 246, 218], [255, 146, 82], smoothstep(0.46, 0.68, p))

      ctx!.save()
      const outer = ctx!.createRadialGradient(sunX, sunY, 0, sunX, sunY, r * 11)
      outer.addColorStop(0, rgbCss(warm, sunVis * 0.42))
      outer.addColorStop(0.35, rgbCss(warm, sunVis * 0.16))
      outer.addColorStop(1, rgbCss(warm, 0))
      ctx!.fillStyle = outer
      ctx!.fillRect(sunX - r * 11, sunY - r * 11, r * 22, r * 22)

      ctx!.globalAlpha = sunVis * 0.94
      ctx!.fillStyle = rgbCss([255, 250, 232])
      ctx!.beginPath()
      ctx!.arc(sunX, sunY, r * 0.86, 0, Math.PI * 2)
      ctx!.fill()
      ctx!.restore()
    }

    // Luminous Moon with atmospheric halo & subtle maria
    const moonVis = smoothstep(0.73, 0.9, p)
    if (moonVis > 0.01) {
      const mx = W * 0.81
      const my = hz * 0.21
      const mr = Math.min(W, H) * 0.017
      ctx!.save()
      const halo = ctx!.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 7.5)
      halo.addColorStop(0, `rgba(235,240,255,${moonVis * 0.24})`)
      halo.addColorStop(0.45, `rgba(200,214,250,${moonVis * 0.08})`)
      halo.addColorStop(1, "rgba(180,200,255,0)")
      ctx!.fillStyle = halo
      ctx!.beginPath()
      ctx!.arc(mx, my, mr * 7.5, 0, Math.PI * 2)
      ctx!.fill()

      ctx!.globalAlpha = moonVis * 0.92
      ctx!.fillStyle = "rgb(245,244,234)"
      ctx!.beginPath()
      ctx!.arc(mx, my, mr, 0, Math.PI * 2)
      ctx!.fill()

      // Subtle crater shadow
      ctx!.globalAlpha = moonVis * 0.14
      ctx!.fillStyle = "rgb(142,152,182)"
      ctx!.beginPath()
      ctx!.arc(mx - mr * 0.25, my - mr * 0.12, mr * 0.34, 0, Math.PI * 2)
      ctx!.arc(mx + mr * 0.28, my + mr * 0.2, mr * 0.24, 0, Math.PI * 2)
      ctx!.fill()
      ctx!.restore()
    }

    // Soft atmospheric clouds using radial gradients (zero overlapping ellipse seams)
    const cloudAlpha =
      0.045 + smoothstep(0.14, 0.36, p) * 0.24 * (1 - smoothstep(0.68, 0.88, p))
    if (cloudAlpha > 0.015) {
      const bodyCol = mixRgb(pal.mid, [255, 250, 242], 0.56 * (1 - nightness))
      const rimCol = mixRgb(pal.hor, [255, 198, 138], 0.62)
      ctx!.save()
      for (const cl of CLOUDS) {
        const drift = reduceMotion ? 0 : timeSec * cl.speed
        const cx = ((cl.x + p * 0.38 + drift) % 1.35 - 0.175) * W
        const cy = cl.y * hz
        const cw = cl.w * W
        const ch = cl.h * H

        // Warm lit underside at dawn / golden hour
        if (nightness < 0.65) {
          const underA = cloudAlpha * 0.42 * (1 - nightness)
          for (let j = 0; j < cl.puffs; j++) {
            const frac = j / (cl.puffs - 1) - 0.5
            const px = cx + frac * cw * 0.62
            const py = cy + ch * 0.18
            const rx = cw * (0.28 + (1 - Math.abs(frac)) * 0.18)
            const ry = ch * 0.55
            ctx!.save()
            ctx!.translate(px, py)
            ctx!.scale(1, Math.max(0.12, ry / Math.max(1, rx)))
            const cg = ctx!.createRadialGradient(0, 0, 0, 0, 0, rx)
            cg.addColorStop(0, rgbCss(rimCol, underA))
            cg.addColorStop(0.55, rgbCss(rimCol, underA * 0.4))
            cg.addColorStop(1, rgbCss(rimCol, 0))
            ctx!.fillStyle = cg
            ctx!.beginPath()
            ctx!.arc(0, 0, rx, 0, Math.PI * 2)
            ctx!.fill()
            ctx!.restore()
          }
        }

        // Soft diffused cloud body
        const bodyA = cloudAlpha * (1 - nightness * 0.72)
        for (let j = 0; j < cl.puffs; j++) {
          const frac = j / (cl.puffs - 1) - 0.5
          const px = cx + frac * cw * 0.6
          const py = cy - Math.cos(frac * 2.1) * ch * 0.16
          const rx = cw * (0.3 + (1 - Math.abs(frac)) * 0.2)
          const ry = ch * (0.62 + (1 - Math.abs(frac)) * 0.34)
          ctx!.save()
          ctx!.translate(px, py)
          ctx!.scale(1, Math.max(0.12, ry / Math.max(1, rx)))
          const cg = ctx!.createRadialGradient(0, 0, 0, 0, 0, rx)
          cg.addColorStop(0, rgbCss(bodyCol, bodyA))
          cg.addColorStop(0.5, rgbCss(bodyCol, bodyA * 0.42))
          cg.addColorStop(1, rgbCss(bodyCol, 0))
          ctx!.fillStyle = cg
          ctx!.beginPath()
          ctx!.arc(0, 0, rx, 0, Math.PI * 2)
          ctx!.fill()
          ctx!.restore()
        }
      }
      ctx!.restore()
    }

    // Subtle distant high-altitude planes at night
    if (nightness > 0.35 && !reduceMotion) {
      ctx!.save()
      for (let i = 0; i < 2; i++) {
        const speed = i === 0 ? 0.008 : -0.0055
        const px = ((((timeSec * speed + i * 0.62) % 1.2) + 1.2) % 1.2 - 0.1) * W
        const py = hz * (0.14 + i * 0.13)
        const strobe = Math.sin(timeSec * 4.2 + i * 3.1) > 0.72
        ctx!.globalAlpha = nightness * (strobe ? 0.85 : 0.32)
        ctx!.fillStyle = strobe ? "rgb(255,250,240)" : "rgb(255,96,86)"
        ctx!.beginPath()
        ctx!.arc(px, py, strobe ? 1.8 : 1.1, 0, Math.PI * 2)
        ctx!.fill()
      }
      ctx!.restore()
    }
  }

  // ---------------------------------------------------------------------------
  // City-Specific Far Backdrops (Palisades, Montmartre, Thames, Mount Fuji, Victoria Peak)
  // ---------------------------------------------------------------------------
  function hillFt(wx: number, year: number): number {
    if (activeCity.id !== "nyc") {
      // Gentle historic waterfront grading for European & Asian river/harbor cities
      const flat = smoothstep(activeCity.startYear, activeCity.startYear + 180, year)
      const wild = 12 + Math.sin(wx * 26 + 0.8) * 7 + Math.sin(wx * 58) * 4
      return lerp(wild, 4, flat)
    }
    const flat = smoothstep(1811, 1895, year)
    const wild =
      26 +
      Math.sin(wx * 22 + 0.4) * 16 +
      Math.sin(wx * 54 + 2.1) * 9 +
      smoothstep(0.65, 0.92, wx) * 84 +
      smoothstep(0.18, 0.35, wx) * (1 - smoothstep(0.35, 0.52, wx)) * 22
    const urban = 7 + smoothstep(0.7, 0.95, wx) * 56
    return lerp(wild, urban, flat)
  }

  function drawFarBackdrop(pal: Palette, nightness: number) {
    ctx!.save()
    const kind = activeCity.backdrop

    if (kind === "fuji") {
      // Majestic distant Mount Fuji cone rising on the western Tokyo horizon
      const peakX = W * 0.22
      const peakH = Math.min(hz * 0.48, H * 0.32)
      const baseW = Math.max(W * 0.42, 420)
      const peakY = hz - peakH
      const fujiCol = mixRgb(pal.hor, pal.mid, 0.44 + nightness * 0.22)

      // Distant soft Tanzawa foothills
      ctx!.globalAlpha = 0.26
      ctx!.fillStyle = rgbCss(mixRgb(pal.hor, pal.bd, 0.36))
      ctx!.beginPath()
      ctx!.moveTo(0, hz)
      for (let i = 0; i <= 48; i++) {
        const x = (i / 48) * W
        const y = hz - (18 + Math.sin(i * 0.45) * 10 + Math.cos(i * 1.1) * 6)
        ctx!.lineTo(x, y)
      }
      ctx!.lineTo(W, hz)
      ctx!.closePath()
      ctx!.fill()

      // Concave volcanic cone of Mount Fuji
      ctx!.globalAlpha = 0.52 - nightness * 0.08
      ctx!.fillStyle = rgbCss(fujiCol)
      ctx!.beginPath()
      ctx!.moveTo(peakX - baseW * 0.54, hz)
      ctx!.quadraticCurveTo(
        peakX - baseW * 0.16,
        hz - peakH * 0.36,
        peakX - baseW * 0.036,
        peakY
      )
      ctx!.lineTo(peakX + baseW * 0.036, peakY)
      ctx!.quadraticCurveTo(
        peakX + baseW * 0.16,
        hz - peakH * 0.36,
        peakX + baseW * 0.54,
        hz
      )
      ctx!.closePath()
      ctx!.fill()

      // Luminous snow-capped summit (visible in daylight & twilight glow)
      const snowAlpha = clamp(0.68 - nightness * 0.48, 0.14, 0.68)
      const snowCol = mixRgb([248, 250, 255], pal.hor, 0.28)
      ctx!.globalAlpha = snowAlpha
      ctx!.fillStyle = rgbCss(snowCol)
      ctx!.beginPath()
      ctx!.moveTo(peakX - baseW * 0.036, peakY)
      ctx!.lineTo(peakX + baseW * 0.036, peakY)
      ctx!.lineTo(peakX + baseW * 0.125, peakY + peakH * 0.29)
      ctx!.lineTo(peakX + baseW * 0.06, peakY + peakH * 0.23)
      ctx!.lineTo(peakX + baseW * 0.015, peakY + peakH * 0.32)
      ctx!.lineTo(peakX - baseW * 0.045, peakY + peakH * 0.24)
      ctx!.lineTo(peakX - baseW * 0.125, peakY + peakH * 0.29)
      ctx!.closePath()
      ctx!.fill()

      ctx!.restore()
      return
    }

    if (kind === "victoria-peak") {
      // Dramatic granite spine of Victoria Peak & Jardine's Lookout rising straight behind Hong Kong Island
      const ridgeCol = mixRgb(pal.bd, pal.hor, 0.22)
      const ridgeTopAt = (u: number): number => {
        // Peak highest behind Central/Admiralty (~0.32..0.52)
        const mainPeak = Math.exp(-Math.pow((u - 0.36) / 0.22, 2)) * 0.42
        const eastPeak = Math.exp(-Math.pow((u - 0.68) / 0.24, 2)) * 0.31
        const undulation = Math.sin(u * 14) * 0.025 + Math.cos(u * 27) * 0.012
        return hz - H * clamp(0.08 + mainPeak + eastPeak + undulation, 0.06, 0.52)
      }

      ctx!.globalAlpha = 0.72
      const rg = ctx!.createLinearGradient(0, hz - H * 0.48, 0, hz)
      rg.addColorStop(0, rgbCss(mixRgb(ridgeCol, pal.mid, 0.28)))
      rg.addColorStop(1, rgbCss(ridgeCol))
      ctx!.fillStyle = rg
      ctx!.beginPath()
      ctx!.moveTo(0, hz)
      for (let i = 0; i <= 64; i++) {
        const u = i / 64
        ctx!.lineTo(u * W, ridgeTopAt(u))
      }
      ctx!.lineTo(W, hz)
      ctx!.closePath()
      ctx!.fill()

      // Twinkling Mid-Levels & Peak Tower lights scattered up the mountainside at night
      if (nightness > 0.2) {
        for (const pl of PEAK_LIGHTS) {
          const px = pl.x * W
          const top = ridgeTopAt(pl.x)
          const py = lerp(top + 14, hz - 8, pl.yFrac)
          if (py <= top + 8) continue
          ctx!.globalAlpha = nightness * pl.a * 0.75
          ctx!.fillStyle = pl.warm ? "rgb(255,226,166)" : "rgb(218,236,255)"
          ctx!.beginPath()
          ctx!.arc(px, py, 1.05, 0, Math.PI * 2)
          ctx!.fill()
        }
      }

      ctx!.restore()
      return
    }

    if (kind === "montmartre") {
      // Soft northern Paris hillside silhouette (Butte Montmartre)
      ctx!.globalAlpha = 0.28
      ctx!.fillStyle = rgbCss(mixRgb(pal.hor, pal.bd, 0.34))
      ctx!.beginPath()
      ctx!.moveTo(0, hz)
      for (let i = 0; i <= 48; i++) {
        const u = i / 48
        const butte = Math.exp(-Math.pow((u - 0.58) / 0.18, 2)) * 52
        const roll = 18 + Math.sin(u * 12) * 8
        ctx!.lineTo(u * W, hz - (roll + butte) * (H / 900))
      }
      ctx!.lineTo(W, hz)
      ctx!.closePath()
      ctx!.fill()
      ctx!.restore()
      return
    }

    if (kind === "thames") {
      // Subtle misty Thames valley horizon
      ctx!.globalAlpha = 0.22
      ctx!.fillStyle = rgbCss(mixRgb(pal.hor, pal.bd, 0.3))
      ctx!.beginPath()
      ctx!.moveTo(0, hz)
      for (let i = 0; i <= 48; i++) {
        const u = i / 48
        const y = hz - (14 + Math.sin(u * 15) * 6 + Math.cos(u * 29) * 3)
        ctx!.lineTo(u * W, y)
      }
      ctx!.lineTo(W, hz)
      ctx!.closePath()
      ctx!.fill()
      ctx!.restore()
      return
    }

    // Default: NYC Palisades ridge across the Hudson
    ctx!.globalAlpha = 0.34
    ctx!.fillStyle = rgbCss(mixRgb(pal.hor, pal.bd, 0.34))
    ctx!.beginPath()
    ctx!.moveTo(0, hz)
    for (let i = 0; i <= 48; i++) {
      const x = (i / 48) * W
      const y =
        sy(66 + Math.sin(i * 0.62) * 20 + Math.sin(i * 1.7) * 10) - H * 0.025
      ctx!.lineTo(x, y)
    }
    ctx!.lineTo(W, hz)
    ctx!.closePath()
    ctx!.fill()
    ctx!.restore()
  }

  function drawLand(year: number, pal: Palette) {
    const greenMix =
      1 -
      smoothstep(
        activeCity.startYear + 120,
        activeCity.startYear + 260,
        year
      )
    const landCol = mixRgb(pal.bd, [36, 54, 42], activeCity.hasForests ? greenMix : 0.12)
    ctx!.fillStyle = rgbCss(landCol)
    ctx!.beginPath()
    const startX = Math.max(-0.04, cam.cx - cam.span * 0.62)
    const endX = Math.min(1.06, cam.cx + cam.span * 0.62)
    ctx!.moveTo(sx(startX), hz + 2)
    for (let i = 0; i <= 64; i++) {
      const wx = lerp(startX, endX, i / 64)
      ctx!.lineTo(sx(wx), sy(hillFt(wx, year)))
    }
    ctx!.lineTo(sx(endX), hz + 2)
    ctx!.closePath()
    ctx!.fill()

    // Early forest clearing (NYC, Tokyo, Hong Kong)
    if (activeCity.hasForests) {
      const forestCol = mixRgb(pal.bd, [26, 48, 36], 0.58)
      ctx!.fillStyle = rgbCss(forestCol)
      const baseClear = activeCity.forestClearStart ?? activeCity.startYear + 40
      for (const tr of TREES) {
        const clearYr = baseClear + tr.x * 260 + tr.s * 30
        const alive = 1 - smoothstep(clearYr - 14, clearYr + 24, year)
        if (alive <= 0.02) continue
        const tx = sx(tr.x)
        if (tx < -20 || tx > W + 20) continue
        const baseY = sy(hillFt(tr.x, year)) + 1
        const th = tr.h * cam.ppft * alive
        const tw = Math.max(1.5, tr.w * cam.ppwx)
        ctx!.beginPath()
        ctx!.moveTo(tx - tw, baseY)
        ctx!.lineTo(tx, baseY - th)
        ctx!.lineTo(tx + tw, baseY)
        ctx!.closePath()
        ctx!.fill()
      }
    }

    // NYC-specific Central Park canopy & historic East River finger piers
    if (activeCity.id === "nyc") {
      const park = smoothstep(1858, 1874, year)
      if (park > 0.01) {
        const p0 = sx(0.45)
        const p1 = sx(0.65)
        if (p1 > 0 && p0 < W) {
          ctx!.save()
          ctx!.globalAlpha = park * 0.65
          ctx!.fillStyle = rgbCss(mixRgb(pal.bd, [32, 62, 44], 0.56))
          ctx!.beginPath()
          ctx!.moveTo(p0, hz)
          for (let i = 0; i <= 32; i++) {
            const x = lerp(p0, p1, i / 32)
            const h = (18 + Math.sin(i * 1.9) * 8 + Math.cos(i * 3.1) * 5) * park
            ctx!.lineTo(x, sy(h))
          }
          ctx!.lineTo(p1, hz)
          ctx!.closePath()
          ctx!.fill()
          ctx!.restore()
        }
      }

      const piers =
        smoothstep(1820, 1880, year) * (1 - smoothstep(1965, 2005, year) * 0.72)
      if (piers > 0.01) {
        ctx!.save()
        ctx!.fillStyle = rgbCss(mixRgb(pal.bd, pal.wat, 0.25), piers * 0.78)
        const nPiers = 38
        for (let i = 0; i < nPiers; i++) {
          const wx = 0.008 + (i / nPiers) * 0.44
          const px = sx(wx)
          if (px < -10 || px > W + 10) continue
          const pw = Math.max(1, 0.0012 * cam.ppwx)
          const ph = Math.max(2, 16 * cam.ppft * piers)
          ctx!.fillRect(px - pw / 2, hz - ph * 0.35, pw, ph)
        }
        ctx!.restore()
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 2.5D Architectural Buildings, Crowns, Windows & Aviation Beacons
  // ---------------------------------------------------------------------------
  function drawBuilding(
    b: AnyBuilding,
    year: number,
    pal: Palette,
    nightness: number,
    timeSec: number,
    p: number
  ) {
    const buildDur = b.h > 700 ? 3.5 : b.h > 250 ? 2.2 : 1.5
    const rise = smoothstep(b.built - 0.5, b.built + buildDur, year)
    if (rise <= 0.001) return

    let fade = 1
    if (b.demo) {
      fade = 1 - smoothstep(b.demo - 0.5, b.demo + 1.4, year)
      if (fade <= 0.001) return
    }

    const x = sx(b.x)
    const w = b.w * cam.ppwx
    if (x + w * 2.2 < 0 || x - w * 2.2 > W) return
    if (w < 0.45) return

    const fullH = b.h * cam.ppft
    const curH = fullH * rise
    const baseY = hz
    const topY = baseY - curH
    const depthMix = b.isHero
      ? b.layer === "far"
        ? 0.42
        : 0.06
      : (1 - b.z) * 0.44

    // Base shadow face
    const baseCol = mixRgb(pal.bd, pal.hor, depthMix)
    const litCol = mixRgb(pal.bdLit, pal.hor, depthMix * 0.72)

    // Special vector drawing for London Eye (rotating spoked observation wheel)
    if (b.type === "ferris") {
      ctx!.save()
      if (fade < 1) ctx!.globalAlpha = fade
      const wheelR = curH * 0.44
      const wheelCy = baseY - curH * 0.54
      const rimCol = mixRgb(litCol, [238, 244, 255], 0.35 + nightness * 0.35)

      // A-frame riverfront support legs
      ctx!.strokeStyle = rgbCss(baseCol)
      ctx!.lineWidth = Math.max(1.4, wheelR * 0.085)
      ctx!.beginPath()
      ctx!.moveTo(x - wheelR * 0.44, baseY)
      ctx!.lineTo(x, wheelCy)
      ctx!.lineTo(x + wheelR * 0.44, baseY)
      ctx!.stroke()

      // Outer structural wheel rim
      ctx!.strokeStyle = rgbCss(rimCol, 0.85)
      ctx!.lineWidth = Math.max(1.4, wheelR * 0.068)
      ctx!.beginPath()
      ctx!.arc(x, wheelCy, wheelR, 0, Math.PI * 2)
      ctx!.stroke()

      // Inner tension ring
      ctx!.strokeStyle = rgbCss(rimCol, 0.5)
      ctx!.lineWidth = Math.max(0.8, wheelR * 0.03)
      ctx!.beginPath()
      ctx!.arc(x, wheelCy, wheelR * 0.84, 0, Math.PI * 2)
      ctx!.stroke()

      // Rotating spokes & passenger capsules
      const rot = reduceMotion ? 0 : timeSec * 0.08
      const spokes = 16
      ctx!.strokeStyle = rgbCss(rimCol, 0.35)
      ctx!.lineWidth = Math.max(0.5, wheelR * 0.015)
      for (let i = 0; i < spokes; i++) {
        const ang = rot + (i / spokes) * Math.PI * 2
        ctx!.beginPath()
        ctx!.moveTo(x, wheelCy)
        ctx!.lineTo(x + Math.cos(ang) * wheelR, wheelCy + Math.sin(ang) * wheelR)
        ctx!.stroke()
      }

      // 24 capsules around rim (warm/indigo glow at night)
      const capCount = 24
      for (let i = 0; i < capCount; i++) {
        const ang = rot + (i / capCount) * Math.PI * 2
        const cx2 = x + Math.cos(ang) * (wheelR * 1.03)
        const cy2 = wheelCy + Math.sin(ang) * (wheelR * 1.03)
        ctx!.fillStyle =
          nightness > 0.25
            ? `rgba(210,230,255,${0.45 + nightness * 0.48})`
            : rgbCss(rimCol, 0.8)
        ctx!.beginPath()
        ctx!.arc(cx2, cy2, Math.max(1, wheelR * 0.042), 0, Math.PI * 2)
        ctx!.fill()
      }

      // Central hub
      ctx!.fillStyle = rgbCss(rimCol, 0.92)
      ctx!.beginPath()
      ctx!.arc(x, wheelCy, Math.max(1.8, wheelR * 0.09), 0, Math.PI * 2)
      ctx!.fill()

      // Soft nocturnal wheel halo
      if (nightness > 0.22) {
        const wg = ctx!.createRadialGradient(x, wheelCy, wheelR * 0.65, x, wheelCy, wheelR * 1.35)
        wg.addColorStop(0, `rgba(190,214,255,${nightness * 0.22})`)
        wg.addColorStop(1, "rgba(190,214,255,0)")
        ctx!.fillStyle = wg
        ctx!.beginPath()
        ctx!.arc(x, wheelCy, wheelR * 1.35, 0, Math.PI * 2)
        ctx!.fill()
      }

      if (b.isHero && spotlight && spotlight.id === b.id) {
        ctx!.strokeStyle = "rgba(255,214,146,0.78)"
        ctx!.lineWidth = 1.6
        ctx!.beginPath()
        ctx!.arc(x, wheelCy, wheelR * 1.08, 0, Math.PI * 2)
        ctx!.stroke()
      }
      ctx!.restore()
      return
    }

    ctx!.save()
    if (fade < 1) ctx!.globalAlpha = fade

    const prof = profileOf(b.type)
    const buildPath = () => {
      ctx!.beginPath()
      for (let i = 0; i < prof.length; i++) {
        const px = x + prof[i][0] * w
        const py = baseY - prof[i][1] * curH
        if (i === 0) ctx!.moveTo(px, py)
        else ctx!.lineTo(px, py)
      }
      ctx!.closePath()
    }

    // Subtle vertical body gradient (slightly lighter near sky/crown, grounded at base)
    const bodyGrad = ctx!.createLinearGradient(x, topY, x, baseY)
    bodyGrad.addColorStop(0, rgbCss(mixRgb(baseCol, litCol, 0.22)))
    bodyGrad.addColorStop(1, rgbCss(baseCol))
    buildPath()
    ctx!.fillStyle = bodyGrad
    ctx!.fill()

    // Open architectural portals/arches punched cleanly with sky/horizon tone
    if ((b.type === "eiffel" || b.type === "tokyotower") && w > 5) {
      ctx!.save()
      const archCol = mixRgb(pal.hor, pal.mid, 0.25)
      ctx!.fillStyle = rgbCss(archCol, 0.86)
      ctx!.beginPath()
      ctx!.moveTo(x - w * 0.26, baseY + 1)
      ctx!.quadraticCurveTo(x, baseY - curH * 0.26, x + w * 0.26, baseY + 1)
      ctx!.closePath()
      ctx!.fill()

      // Open iron lattice cross-bracing shimmer
      ctx!.strokeStyle =
        b.type === "tokyotower" && nightness > 0.25
          ? `rgba(255,142,84,${nightness * 0.72})`
          : b.type === "eiffel" && nightness > 0.25
            ? `rgba(255,212,138,${nightness * 0.56})`
            : rgbCss(litCol, 0.26)
      ctx!.lineWidth = Math.max(0.65, w * 0.025)
      const deck1 = baseY - curH * 0.21
      const deck2 = baseY - curH * 0.44
      ctx!.beginPath()
      ctx!.moveTo(x - w * 0.34, deck1)
      ctx!.lineTo(x + w * 0.34, deck1)
      ctx!.moveTo(x - w * 0.21, deck2)
      ctx!.lineTo(x + w * 0.21, deck2)
      ctx!.stroke()
      ctx!.restore()
    } else if (b.type === "triomphe" && w > 4) {
      ctx!.fillStyle = rgbCss(mixRgb(pal.hor, pal.mid, 0.2), 0.85)
      ctx!.beginPath()
      ctx!.moveTo(x - w * 0.19, baseY + 1)
      ctx!.lineTo(x - w * 0.19, baseY - curH * 0.42)
      ctx!.quadraticCurveTo(x, baseY - curH * 0.64, x + w * 0.19, baseY - curH * 0.42)
      ctx!.lineTo(x + w * 0.19, baseY + 1)
      ctx!.closePath()
      ctx!.fill()
    } else if (b.type === "archcube" && w > 4) {
      ctx!.fillStyle = rgbCss(mixRgb(pal.hor, pal.mid, 0.25), 0.88)
      ctx!.fillRect(
        x - w * 0.26,
        baseY - curH * 0.78,
        w * 0.52,
        curH * 0.68
      )
    }

    // 2.5D Sunward architectural chamfer highlight (shifts left -> right with diurnal sun)
    const sunSide = p < 0.42 ? -1 : 1
    const rimStrength = clamp(0.14 + (1 - nightness) * 0.34, 0.14, 0.46)
    if (w > 2.2) {
      ctx!.save()
      buildPath()
      ctx!.clip()

      // Lit bevel strip on the sunward side of the tower
      const bevelW = Math.max(1, w * (b.isHero ? 0.24 : 0.18))
      const bx = sunSide < 0 ? x - w * 0.5 : x + w * 0.5 - bevelW
      const bevelGrad = ctx!.createLinearGradient(bx, 0, bx + bevelW, 0)
      if (sunSide < 0) {
        bevelGrad.addColorStop(0, rgbCss(litCol, rimStrength))
        bevelGrad.addColorStop(1, rgbCss(litCol, 0))
      } else {
        bevelGrad.addColorStop(0, rgbCss(litCol, 0))
        bevelGrad.addColorStop(1, rgbCss(litCol, rimStrength))
      }
      ctx!.fillStyle = bevelGrad
      ctx!.fillRect(bx, topY, bevelW, curH)

      // Glass curtain-wall sky glint on modern towers
      const isGlass =
        b.type === "glass" ||
        b.type === "owtc" ||
        b.type === "hy30" ||
        b.type === "cpt" ||
        b.type === "one57" ||
        b.type === "vanderbilt" ||
        b.type === "bofa" ||
        b.type === "shard" ||
        b.type === "gherkin" ||
        b.type === "walkie" ||
        b.type === "cheesegrater" ||
        b.type === "boc" ||
        b.type === "ifc2" ||
        b.type === "icc" ||
        b.type === "centralplaza" ||
        b.type === "thecenter" ||
        b.type === "azabudai" ||
        b.type === "cocoon" ||
        b.type === "faceted"
      if (isGlass && w > 3.5) {
        const gGrad = ctx!.createLinearGradient(x - w * 0.5, topY, x + w * 0.5, baseY)
        gGrad.addColorStop(0, rgbCss(pal.hor, 0.18 * (1 - nightness * 0.5)))
        gGrad.addColorStop(0.55, rgbCss(pal.hor, 0.03))
        gGrad.addColorStop(1, rgbCss(pal.mid, 0.14))
        ctx!.fillStyle = gGrad
        ctx!.fillRect(x - w * 0.5, topY, w, curH)
      }

      // One WTC signature triangular diagonal facet glint
      if (b.type === "owtc" && w > 4) {
        ctx!.fillStyle = rgbCss(
          mixRgb(pal.hor, [210, 232, 255], 0.55),
          0.16 + nightness * 0.08
        )
        ctx!.beginPath()
        ctx!.moveTo(x - w * 0.5, baseY)
        ctx!.lineTo(x, baseY - curH * 0.77)
        ctx!.lineTo(x + w * 0.06, baseY)
        ctx!.closePath()
        ctx!.fill()
      }

      // Twin Towers vertical aluminum pinstripes
      if (b.type === "twins" && w > 5) {
        ctx!.strokeStyle = rgbCss(litCol, 0.22)
        ctx!.lineWidth = 0.6
        for (let s = -0.35; s <= 0.35; s += 0.175) {
          ctx!.beginPath()
          ctx!.moveTo(x + s * w, baseY)
          ctx!.lineTo(x + s * w, topY)
          ctx!.stroke()
        }
      }

      // Gherkin / Cocoon Tower curving diagrid lines
      if ((b.type === "gherkin" || b.type === "cocoon") && w > 5) {
        ctx!.strokeStyle =
          nightness > 0.3
            ? `rgba(218,236,255,${nightness * 0.34})`
            : rgbCss(litCol, 0.24)
        ctx!.lineWidth = 0.7
        for (let step = 0.12; step < 0.92; step += 0.18) {
          const y0 = baseY - curH * step
          const y1 = baseY - curH * (step + 0.18)
          ctx!.beginPath()
          ctx!.moveTo(x - w * 0.48, y0)
          ctx!.lineTo(x + w * 0.48, y1)
          ctx!.moveTo(x + w * 0.48, y0)
          ctx!.lineTo(x - w * 0.48, y1)
          ctx!.stroke()
        }
      }

      // Bank of China Tower (Hong Kong): iconic luminous X-truss triangular prisms
      if (b.type === "boc" && w > 4) {
        ctx!.strokeStyle =
          nightness > 0.22
            ? `rgba(220,244,255,${0.32 + nightness * 0.62})`
            : rgbCss(litCol, 0.34)
        ctx!.lineWidth = Math.max(0.85, w * 0.045)
        const levels = [0.0, 0.24, 0.46, 0.66, 0.84]
        for (let i = 0; i < levels.length - 1; i++) {
          const y0 = baseY - curH * levels[i]
          const y1 = baseY - curH * levels[i + 1]
          ctx!.beginPath()
          ctx!.moveTo(x - w * 0.48, y0)
          ctx!.lineTo(x + w * 0.48, y1)
          ctx!.moveTo(x + w * 0.48, y0)
          ctx!.lineTo(x - w * 0.48, y1)
          ctx!.moveTo(x - w * 0.48, y1)
          ctx!.lineTo(x + w * 0.48, y1)
          ctx!.stroke()
        }
      }

      // HSBC Building (Hong Kong): exposed structural steel coat-hanger trusses
      if (b.type === "hsbc" && w > 5) {
        ctx!.strokeStyle =
          nightness > 0.22
            ? `rgba(218,236,255,${0.25 + nightness * 0.45})`
            : rgbCss(litCol, 0.36)
        ctx!.lineWidth = Math.max(0.75, w * 0.036)
        for (const frac of [0.24, 0.46, 0.68, 0.86]) {
          const ty = baseY - curH * frac
          ctx!.beginPath()
          ctx!.moveTo(x - w * 0.46, ty)
          ctx!.lineTo(x + w * 0.46, ty)
          ctx!.moveTo(x - w * 0.34, ty)
          ctx!.lineTo(x, ty - curH * 0.09)
          ctx!.lineTo(x + w * 0.34, ty)
          ctx!.stroke()
        }
      }

      // Night windows clipped cleanly inside the building silhouette!
      const skipWindows =
        b.type === "liberty" ||
        b.type === "eiffel" ||
        b.type === "tokyotower" ||
        b.type === "skytree" ||
        b.type === "triomphe" ||
        b.type === "bt"
      const litThreshold = nightness * (b.isHero ? 0.96 : 0.78)

      if (litThreshold > 0.05 && w > 3 && curH > 12 && !skipWindows) {
        drawWindowsClipped(b, x, w, topY, baseY, curH, litThreshold, isGlass)
      }

      // 432 Park Avenue iconic open glowing mechanical wind floors
      if (b.type === "p432" && nightness > 0.2 && curH > 30) {
        ctx!.fillStyle = `rgba(255,232,196,${nightness * 0.58})`
        for (const frac of [0.22, 0.4, 0.58, 0.76, 0.91]) {
          const fy = baseY - curH * frac
          ctx!.fillRect(x - w * 0.46, fy, w * 0.92, Math.max(1.2, curH * 0.012))
        }
      }

      // Big Ben glowing circular warm clock face dial
      if (b.type === "bigben" && curH > 20) {
        const cy = baseY - curH * 0.71
        const cr = Math.max(1.8, w * 0.28)
        ctx!.fillStyle =
          nightness > 0.2
            ? `rgba(255,236,184,${0.55 + nightness * 0.42})`
            : "rgba(248,242,226,0.72)"
        ctx!.beginPath()
        ctx!.arc(x, cy, cr, 0, Math.PI * 2)
        ctx!.fill()
      }

      // Illuminated Landmark Night Crowns & Lattice Spires
      if (b.isHero && b.crownGlow && nightness > 0.18 && rise > 0.9) {
        drawHeroCrownGlow(b, x, w, baseY, curH, nightness, timeSec)
      }

      ctx!.restore()
    }

    // Subtle thin architectural outline highlight on spotlighted or major heroes
    if (b.isHero && spotlight && spotlight.id === b.id && w > 2) {
      ctx!.save()
      buildPath()
      ctx!.strokeStyle = "rgba(255,214,146,0.72)"
      ctx!.lineWidth = 1.4
      ctx!.stroke()
      ctx!.restore()
    }

    // Rooftop cedar water towers & bulkheads on procedural fill
    if (!b.isHero && rise > 0.92 && w > 4.2) {
      if (b.wt) {
        const tw = Math.max(1.5, w * 0.15)
        const th = tw * 1.35
        const wx = x + (b.win - 0.5) * w * 0.42
        ctx!.fillStyle = rgbCss(baseCol)
        ctx!.fillRect(wx - tw / 2, topY - th - tw * 0.55, tw, th)
        ctx!.beginPath()
        ctx!.moveTo(wx - tw * 0.62, topY - th - tw * 0.55)
        ctx!.lineTo(wx, topY - th - tw * 1.15)
        ctx!.lineTo(wx + tw * 0.62, topY - th - tw * 0.55)
        ctx!.closePath()
        ctx!.fill()
      } else if (b.bh) {
        const bw = w * 0.34
        const bh = Math.min(curH * 0.08, 6)
        ctx!.fillStyle = rgbCss(baseCol)
        ctx!.fillRect(x - bw / 2, topY - bh, bw, bh)
      }
    }

    // WTC North Tower broadcast antenna
    if (b.isHero && b.ant && rise > 0.9) {
      const antH = b.ant * cam.ppft * smoothstep(0.9, 1, rise)
      ctx!.strokeStyle = rgbCss(mixRgb(baseCol, litCol, 0.45))
      ctx!.lineWidth = Math.max(1, w * 0.045)
      ctx!.beginPath()
      ctx!.moveTo(x, topY)
      ctx!.lineTo(x, topY - antH)
      ctx!.stroke()
      if (nightness > 0.3) {
        drawAviationBeacon(x, topY - antH, nightness, timeSec, b.x * 100)
      }
    }

    // Statue of Liberty warm copper torch flame (clamped radius so close zooms stay crisp)
    if (b.isHero && b.type === "liberty" && rise > 0.85) {
      const torchX = x + w * 0.16
      const torchY = baseY - curH * 1.01
      const torchR = clamp(w * 0.45, 3.5, 11)
      const flicker = reduceMotion
        ? 1
        : 0.84 + 0.16 * Math.sin(timeSec * 7.5)
      const g = ctx!.createRadialGradient(
        torchX,
        torchY,
        0,
        torchX,
        torchY,
        torchR
      )
      g.addColorStop(0, `rgba(255,226,148,${(0.45 + nightness * 0.5) * flicker})`)
      g.addColorStop(0.45, `rgba(255,196,110,${(0.18 + nightness * 0.25) * flicker})`)
      g.addColorStop(1, "rgba(255,180,88,0)")
      ctx!.fillStyle = g
      ctx!.beginPath()
      ctx!.arc(torchX, torchY, torchR, 0, Math.PI * 2)
      ctx!.fill()
    }

    // Eiffel Tower rotating golden nocturnal lighthouse beam (outside silhouette clip)
    if (b.isHero && b.type === "eiffel" && nightness > 0.28 && rise > 0.92) {
      const tipY = baseY - curH * 0.94
      const beamLen = Math.max(85, curH * 0.88)
      const sweep = reduceMotion ? 0.35 : Math.sin(timeSec * 0.65)
      const beamW = Math.max(12, beamLen * 0.14)
      ctx!.save()
      for (const dir of [-1, 1]) {
        const endX = x + dir * beamLen * (0.45 + 0.55 * Math.abs(sweep))
        const endY = tipY - beamLen * 0.12 * sweep * dir
        const bg = ctx!.createLinearGradient(x, tipY, endX, endY)
        bg.addColorStop(0, `rgba(255,236,184,${nightness * 0.38})`)
        bg.addColorStop(0.55, `rgba(255,222,158,${nightness * 0.12})`)
        bg.addColorStop(1, "rgba(255,222,158,0)")
        ctx!.fillStyle = bg
        ctx!.beginPath()
        ctx!.moveTo(x, tipY)
        ctx!.lineTo(endX, endY - beamW * 0.5)
        ctx!.lineTo(endX, endY + beamW * 0.5)
        ctx!.closePath()
        ctx!.fill()
      }
      ctx!.restore()
    }

    // HSBC twin rooftop maintenance cranes
    if (b.isHero && b.type === "hsbc" && rise > 0.92 && w > 5) {
      ctx!.strokeStyle = rgbCss(litCol, 0.55)
      ctx!.lineWidth = Math.max(0.8, w * 0.03)
      for (const dir of [-1, 1]) {
        const cx2 = x + dir * w * 0.24
        ctx!.beginPath()
        ctx!.moveTo(cx2, topY)
        ctx!.lineTo(cx2, topY - curH * 0.06)
        ctx!.lineTo(cx2 + dir * w * 0.22, topY - curH * 0.09)
        ctx!.stroke()
      }
    }

    // FAA Red Aviation Obstruction Beacons on Supertalls at night
    if (b.isHero && b.beacon && !b.ant && nightness > 0.32 && rise > 0.95) {
      const bx = b.type === "bofa" ? x + w * 0.12 : x
      drawAviationBeacon(bx, topY, nightness, timeSec, b.x * 87)
    }

    ctx!.restore()
  }

  function drawWindowsClipped(
    b: AnyBuilding,
    x: number,
    w: number,
    topY: number,
    baseY: number,
    curH: number,
    litThreshold: number,
    isGlass: boolean
  ) {
    const padX = Math.max(1, w * 0.11)
    const innerW = w - padX * 2
    if (innerW < 1.5) return

    const topClip = b.type === "esb" || b.type === "chrysler" || b.type === "owtc"
      ? 0.24
      : b.isHero
        ? 0.14
        : 0.08
    const startY = topY + curH * topClip
    const usableH = baseY - startY - 2
    if (usableH < 5) return

    const seedBase = Math.round(b.x * 10000 + b.h)

    if (isGlass) {
      // Modern curtain wall: architectural horizontal lit office bands
      const floorStep = clamp(usableH / 26, 2.4, 5.2)
      const rows = Math.min(34, Math.floor(usableH / floorStep))
      for (let r = 0; r < rows; r++) {
        const hv = hash(seedBase + r * 17, 3)
        if (hv > litThreshold * 0.62) continue
        const ry = startY + r * floorStep
        const segW = innerW * (0.42 + hash(seedBase + r, 7) * 0.56)
        const segX =
          x - w / 2 + padX + hash(seedBase + r, 11) * (innerW - segW)
        const warm = hash(seedBase + r, 19) > 0.38
        ctx!.fillStyle = warm
          ? `rgba(255,228,176,${(0.32 + hv * 0.45) * litThreshold})`
          : `rgba(214,230,255,${(0.28 + hv * 0.42) * litThreshold})`
        ctx!.fillRect(segX, ry, segW, Math.max(1, floorStep * 0.46))
      }
      return
    }

    // Prewar / Art Deco / Stone: crisp tungsten window dots
    const cols = clamp(Math.floor(innerW / 3.4), 2, 10)
    const rows = clamp(Math.floor(usableH / 4.4), 2, 26)
    const dx = innerW / cols
    const dy = usableH / rows
    const ww = Math.max(1, dx * 0.46)
    const wh = Math.max(1.2, dy * 0.44)

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const hv = hash(seedBase + r * 31 + c * 7, 1)
        if (hv > litThreshold * 0.52) continue
        const temp = hash(seedBase + r * 13 + c * 5, 2)
        ctx!.fillStyle =
          temp > 0.16
            ? `rgba(255,220,152,${(0.38 + temp * 0.48) * litThreshold})`
            : `rgba(228,238,255,${0.48 * litThreshold})`
        ctx!.fillRect(
          x - w / 2 + padX + c * dx + (dx - ww) * 0.5,
          startY + r * dy,
          ww,
          wh
        )
      }
    }
  }

  function drawHeroCrownGlow(
    b: HeroLandmark,
    x: number,
    w: number,
    baseY: number,
    curH: number,
    strength: number,
    timeSec: number
  ) {
    const col = b.crownGlow ?? [255, 224, 168]

    if (b.type === "eiffel") {
      // Golden floodlit ironwork + Paris hourly-style diamond twinkle
      const g = ctx!.createLinearGradient(x, baseY - curH, x, baseY)
      g.addColorStop(0, rgbCss([255, 224, 152], strength * 0.72))
      g.addColorStop(0.55, rgbCss([255, 198, 114], strength * 0.5))
      g.addColorStop(1, rgbCss([255, 178, 92], strength * 0.22))
      ctx!.fillStyle = g
      ctx!.fillRect(x - w * 0.5, baseY - curH, w, curH)

      // Twinkling sparkle dots across the lattice
      ctx!.fillStyle = `rgba(255,248,224,${strength * 0.92})`
      for (let i = 0; i < 22; i++) {
        const phase = reduceMotion ? 1 : Math.sin(timeSec * 5.2 + i * 2.7)
        if (phase < 0.28) continue
        const fy = 0.16 + hash(i, 41) * 0.72
        const halfW = (1 - fy * 0.85) * w * 0.36
        const sx2 = x + (hash(i, 43) - 0.5) * 2 * halfW
        const sy2 = baseY - curH * fy
        ctx!.fillRect(sx2 - 0.7, sy2 - 0.7, 1.4, 1.4)
      }
      return
    }

    if (b.type === "tokyotower") {
      // Iconic vermilion-orange nocturnal illumination
      const g = ctx!.createLinearGradient(x, baseY - curH, x, baseY)
      g.addColorStop(0, rgbCss([255, 146, 84], strength * 0.78))
      g.addColorStop(0.5, rgbCss([255, 118, 62], strength * 0.6))
      g.addColorStop(1, rgbCss([255, 96, 48], strength * 0.28))
      ctx!.fillStyle = g
      ctx!.fillRect(x - w * 0.5, baseY - curH, w, curH)

      // Bright Main & Top observation decks
      ctx!.fillStyle = `rgba(255,242,208,${strength * 0.92})`
      ctx!.fillRect(x - w * 0.24, baseY - curH * 0.45, w * 0.48, Math.max(1.5, curH * 0.018))
      ctx!.fillRect(x - w * 0.13, baseY - curH * 0.73, w * 0.26, Math.max(1.4, curH * 0.016))
      return
    }

    if (b.type === "skytree") {
      // Edo-indigo / pale cyan illumination + glowing twin Tembo decks
      const g = ctx!.createLinearGradient(x, baseY - curH, x, baseY)
      g.addColorStop(0, rgbCss([196, 224, 255], strength * 0.68))
      g.addColorStop(0.6, rgbCss([168, 198, 255], strength * 0.34))
      g.addColorStop(1, rgbCss([148, 178, 245], strength * 0.1))
      ctx!.fillStyle = g
      ctx!.fillRect(x - w * 0.5, baseY - curH, w, curH)

      ctx!.fillStyle = `rgba(232,246,255,${strength * 0.95})`
      ctx!.fillRect(x - w * 0.26, baseY - curH * 0.56, w * 0.52, Math.max(1.8, curH * 0.018))
      ctx!.fillRect(x - w * 0.19, baseY - curH * 0.71, w * 0.38, Math.max(1.5, curH * 0.015))
      return
    }

    if (b.type === "shard") {
      // Luminous fractured silver-white spire wash
      const g = ctx!.createLinearGradient(x, baseY - curH, x, baseY - curH * 0.55)
      g.addColorStop(0, rgbCss([236, 244, 255], strength * 0.85))
      g.addColorStop(0.55, rgbCss([204, 222, 255], strength * 0.36))
      g.addColorStop(1, rgbCss([204, 222, 255], 0))
      ctx!.fillStyle = g
      ctx!.fillRect(x - w * 0.5, baseY - curH, w, curH * 0.45)
      return
    }

    if (b.type === "centralplaza" || b.type === "thecenter") {
      // Tiered harbour neon crown bands
      const bands = [0.76, 0.82, 0.88, 0.93]
      for (let i = 0; i < bands.length; i++) {
        const by = baseY - curH * bands[i]
        const bw = w * (0.68 - i * 0.12)
        const c = i % 2 === 0 ? col : ([212, 238, 255] as const)
        ctx!.fillStyle = rgbCss(c, strength * 0.84)
        ctx!.fillRect(x - bw / 2, by, bw, Math.max(1.4, curH * 0.014))
      }
      return
    }

    if (b.type === "chrysler") {
      // Chrysler Building iconic illuminated Art Deco sunburst arches
      const crownY = baseY - curH * 0.62
      const crownH = curH * 0.3
      const g = ctx!.createLinearGradient(x, crownY - crownH, x, crownY)
      g.addColorStop(0, rgbCss(col, strength * 0.5))
      g.addColorStop(1, rgbCss(col, 0))
      ctx!.fillStyle = g
      ctx!.fillRect(x - w * 0.34, crownY - crownH, w * 0.68, crownH)

      // 4 tiers of sunlit triangular crown windows
      ctx!.fillStyle = rgbCss([255, 244, 214], strength * 0.92)
      const tiers = [
        { v: 0.67, span: 0.22, count: 5 },
        { v: 0.73, span: 0.17, count: 5 },
        { v: 0.79, span: 0.12, count: 3 },
        { v: 0.84, span: 0.07, count: 3 },
      ]
      for (const tier of tiers) {
        const ty = baseY - curH * tier.v
        const pw = Math.max(1.2, (w * tier.span * 2) / (tier.count * 2.1))
        const ph = Math.max(1.4, curH * 0.015)
        for (let i = 0; i < tier.count; i++) {
          const frac =
            tier.count === 1 ? 0 : (i / (tier.count - 1) - 0.5) * 2
          const px = x + frac * w * tier.span
          const archOffset = (1 - frac * frac) * curH * 0.014
          ctx!.fillRect(px - pw / 2, ty - archOffset, pw, ph)
        }
      }
      return
    }

    if (b.type === "esb") {
      // Empire State Building iconic floodlit crown tiers + glowing mast
      const crownStart = baseY - curH * 0.88
      const crownEnd = baseY - curH * 0.66
      const g = ctx!.createLinearGradient(x, crownStart, x, crownEnd)
      g.addColorStop(0, rgbCss(col, strength * 0.68))
      g.addColorStop(0.55, rgbCss(col, strength * 0.38))
      g.addColorStop(1, rgbCss(col, 0))
      ctx!.fillStyle = g
      ctx!.fillRect(x - w * 0.32, crownStart, w * 0.64, crownEnd - crownStart)

      // Lit spire needle
      ctx!.strokeStyle = rgbCss([255, 238, 200], strength * 0.78)
      ctx!.lineWidth = Math.max(1, w * 0.045)
      ctx!.beginPath()
      ctx!.moveTo(x, baseY - curH * 0.84)
      ctx!.lineTo(x, baseY - curH * 0.99)
      ctx!.stroke()
      return
    }

    if (b.type === "owtc") {
      // One WTC luminous upper crown ring & illuminated spire
      const ringY = baseY - curH * 0.78
      ctx!.fillStyle = rgbCss(col, strength * 0.78)
      ctx!.fillRect(x - w * 0.34, ringY, w * 0.68, Math.max(1.6, curH * 0.016))
      ctx!.strokeStyle = rgbCss(col, strength * 0.62)
      ctx!.lineWidth = Math.max(1, w * 0.04)
      ctx!.beginPath()
      ctx!.moveTo(x, ringY)
      ctx!.lineTo(x, baseY - curH * 0.99)
      ctx!.stroke()
      return
    }

    if (b.type === "hy30") {
      // Edge sky deck luminous underside accent
      const ey = baseY - curH * 0.84
      ctx!.fillStyle = rgbCss(col, strength * 0.72)
      ctx!.fillRect(x - w * 0.85, ey, w * 0.42, Math.max(1.2, curH * 0.012))
    }

    // Standard luminous upper setback wash for Art Deco & modern crowns
    const washTop = baseY - curH
    const washH = curH * 0.24
    const g = ctx!.createLinearGradient(x, washTop, x, washTop + washH)
    g.addColorStop(0, rgbCss(col, strength * 0.56))
    g.addColorStop(1, rgbCss(col, 0))
    ctx!.fillStyle = g
    ctx!.fillRect(x - w * 0.5, washTop, w, washH)
  }

  function drawAviationBeacon(
    bx: number,
    by: number,
    nightness: number,
    timeSec: number,
    phase: number
  ) {
    // Realistic ~40 flashes per minute aviation pulse
    const pulse = reduceMotion
      ? 0.85
      : 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(timeSec * 3.8 + phase), 3)
    const a = nightness * pulse
    const glow = ctx!.createRadialGradient(bx, by, 0, bx, by, 7)
    glow.addColorStop(0, `rgba(255,78,66,${a * 0.88})`)
    glow.addColorStop(0.4, `rgba(255,62,54,${a * 0.34})`)
    glow.addColorStop(1, "rgba(255,62,54,0)")
    ctx!.fillStyle = glow
    ctx!.beginPath()
    ctx!.arc(bx, by, 7, 0, Math.PI * 2)
    ctx!.fill()

    ctx!.fillStyle = `rgba(255,214,200,${a})`
    ctx!.beginPath()
    ctx!.arc(bx, by, 1.3, 0, Math.PI * 2)
    ctx!.fill()
  }

  // ---------------------------------------------------------------------------
  // River & Harbour Bridges (Suspension, Arch, Tower Bridge, Cable-Stay, Cantilever)
  // ---------------------------------------------------------------------------
  function drawBridges(year: number, pal: Palette, nightness: number) {
    const col = mixRgb(pal.bd, pal.hor, 0.14)
    const litCol = mixRgb(pal.bdLit, pal.hor, 0.22)

    for (const br of activeCity.bridges) {
      const k = smoothstep(br.built - 2, br.built + 2.5, year)
      if (k <= 0.01) continue
      const cx = sx(br.x)
      const sp = br.span * cam.ppwx
      if (cx + sp < -20 || cx - sp > W + 20) continue
      if (sp < 8) continue

      const deckY = sy(br.deckH)
      const topY = sy(br.towerH)
      const tw = Math.max(2.2, sp * (br.style === "stone" || br.style === "towerbridge" ? 0.068 : 0.044))
      const t1 = cx - sp * 0.32
      const t2 = cx + sp * 0.32
      const leftEnd = cx - sp * 0.72
      const rightEnd = cx + sp * 0.72

      ctx!.save()
      ctx!.globalAlpha = k
      ctx!.fillStyle = rgbCss(col)
      ctx!.strokeStyle = rgbCss(col)

      if (br.style === "arch") {
        // Classic masonry/iron multi-arch European river bridge (Seine / Thames)
        const nArches = sp > 90 ? 5 : 3
        const spanW = rightEnd - leftEnd
        const archW = spanW / nArches
        ctx!.fillStyle = rgbCss(col)
        ctx!.fillRect(leftEnd, deckY - 1.5, spanW, Math.max(2.4, (hz - deckY) * 0.24))

        for (let i = 0; i <= nArches; i++) {
          const px = leftEnd + i * archW
          const pw = Math.max(2, archW * 0.16)
          ctx!.fillRect(px - pw / 2, deckY, pw, hz - deckY)
        }
        ctx!.lineWidth = Math.max(1.2, sp * 0.015)
        for (let i = 0; i < nArches; i++) {
          const ax0 = leftEnd + i * archW
          const ax1 = ax0 + archW
          ctx!.beginPath()
          ctx!.moveTo(ax0, hz)
          ctx!.quadraticCurveTo((ax0 + ax1) / 2, deckY - (hz - deckY) * 0.12, ax1, hz)
          ctx!.stroke()
        }

        // Warm riverside bridge lamps along the stone parapet at night
        if (br.necklaceLights && nightness > 0.22 && sp > 24) {
          ctx!.fillStyle = `rgba(255,226,162,${nightness * 0.92})`
          for (let i = 0; i <= nArches; i++) {
            const lx = leftEnd + i * archW
            ctx!.beginPath()
            ctx!.arc(lx, deckY - 3, Math.max(1, Math.min(1.8, sp * 0.01)), 0, Math.PI * 2)
            ctx!.fill()
          }
        }
        ctx!.restore()
        continue
      }

      if (br.style === "towerbridge") {
        // London Tower Bridge: twin Victorian Gothic towers + high-level double walkways + bascule span
        const walkY1 = lerp(topY, deckY, 0.24)
        const walkY2 = lerp(topY, deckY, 0.34)
        ctx!.lineWidth = Math.max(1.5, sp * 0.022)
        ctx!.beginPath()
        ctx!.moveTo(leftEnd, deckY)
        ctx!.lineTo(rightEnd, deckY)
        ctx!.stroke()

        // High-level twin horizontal steel walkways
        ctx!.lineWidth = Math.max(1.2, sp * 0.014)
        ctx!.beginPath()
        ctx!.moveTo(t1, walkY1)
        ctx!.lineTo(t2, walkY1)
        ctx!.moveTo(t1, walkY2)
        ctx!.lineTo(t2, walkY2)
        ctx!.stroke()

        // Side suspension chains curving down to shore abutments
        ctx!.lineWidth = Math.max(1, sp * 0.012)
        ctx!.beginPath()
        ctx!.moveTo(leftEnd, deckY)
        ctx!.quadraticCurveTo((leftEnd + t1) * 0.5, deckY, t1, walkY1)
        ctx!.moveTo(t2, walkY1)
        ctx!.quadraticCurveTo((t2 + rightEnd) * 0.5, deckY, rightEnd, deckY)
        ctx!.stroke()

        // Twin pointed-roof Gothic stone towers
        for (const tx of [t1, t2]) {
          ctx!.fillStyle = rgbCss(col)
          ctx!.fillRect(tx - tw / 2, topY + tw * 0.75, tw, hz - (topY + tw * 0.75))
          ctx!.beginPath()
          ctx!.moveTo(tx - tw * 0.56, topY + tw * 0.78)
          ctx!.lineTo(tx, topY)
          ctx!.lineTo(tx + tw * 0.56, topY + tw * 0.78)
          ctx!.closePath()
          ctx!.fill()

          if (nightness > 0.22) {
            ctx!.fillStyle = `rgba(255,222,158,${nightness * 0.55})`
            ctx!.fillRect(tx - tw * 0.36, topY + tw * 0.75, tw * 0.72, (deckY - topY) * 0.65)
          }
        }

        // Illuminated walkway & chain pearls at night
        if (br.necklaceLights && nightness > 0.22 && sp > 24) {
          ctx!.fillStyle = `rgba(255,232,178,${nightness * 0.92})`
          for (let i = 1; i <= 7; i++) {
            const bx = lerp(t1, t2, i / 8)
            ctx!.beginPath()
            ctx!.arc(bx, walkY1, 1.1, 0, Math.PI * 2)
            ctx!.fill()
          }
        }
        ctx!.restore()
        continue
      }

      if (br.style === "cablestay") {
        // Modern cable-stayed twin pylon span (Stonecutters Bridge)
        ctx!.lineWidth = Math.max(1.4, sp * 0.02)
        ctx!.beginPath()
        ctx!.moveTo(leftEnd, deckY)
        ctx!.quadraticCurveTo(cx, deckY - (hz - deckY) * 0.1, rightEnd, deckY)
        ctx!.stroke()

        for (const tx of [t1, t2]) {
          // Slender tapering single-mast concrete & stainless pylon
          ctx!.fillStyle = rgbCss(col)
          ctx!.beginPath()
          ctx!.moveTo(tx - tw * 0.55, hz)
          ctx!.lineTo(tx - tw * 0.22, topY)
          ctx!.lineTo(tx + tw * 0.22, topY)
          ctx!.lineTo(tx + tw * 0.55, hz)
          ctx!.closePath()
          ctx!.fill()

          // Fan stay cables
          ctx!.strokeStyle =
            nightness > 0.25
              ? `rgba(206,232,255,${nightness * 0.42})`
              : rgbCss(litCol, 0.45)
          ctx!.lineWidth = Math.max(0.55, sp * 0.005)
          for (let s = 1; s <= 6; s++) {
            const frac = s / 6
            const py = lerp(topY + 4, lerp(topY, deckY, 0.36), frac)
            const spanReach = sp * 0.34 * frac
            ctx!.beginPath()
            ctx!.moveTo(tx, py)
            ctx!.lineTo(tx - spanReach, deckY)
            ctx!.moveTo(tx, py)
            ctx!.lineTo(tx + spanReach, deckY)
            ctx!.stroke()
          }

          if (nightness > 0.28) {
            ctx!.fillStyle = `rgba(218,240,255,${nightness * 0.9})`
            ctx!.beginPath()
            ctx!.arc(tx, topY, 1.5, 0, Math.PI * 2)
            ctx!.fill()
          }
        }
        ctx!.restore()
        continue
      }

      // Roadway deck for suspension & cantilever spans
      ctx!.lineWidth = Math.max(1.4, sp * 0.022)
      ctx!.beginPath()
      ctx!.moveTo(leftEnd, deckY)
      ctx!.quadraticCurveTo(cx, deckY - (hz - deckY) * 0.12, rightEnd, deckY)
      ctx!.stroke()

      // Subtle warm traffic shimmer along road deck at night
      if (nightness > 0.28) {
        ctx!.strokeStyle = `rgba(255,210,148,${nightness * 0.32})`
        ctx!.lineWidth = Math.max(0.8, sp * 0.01)
        ctx!.beginPath()
        ctx!.moveTo(leftEnd, deckY - 1)
        ctx!.quadraticCurveTo(cx, deckY - (hz - deckY) * 0.12 - 1, rightEnd, deckY - 1)
        ctx!.stroke()
        ctx!.strokeStyle = rgbCss(col)
      }

      if (br.style === "canti") {
        // Queensboro double cantilever
        const towers = [cx - sp * 0.36, cx - sp * 0.1, cx + sp * 0.14, cx + sp * 0.4]
        ctx!.lineWidth = Math.max(1, sp * 0.016)
        for (const tx of towers) {
          ctx!.fillRect(tx - tw * 0.45, topY, tw * 0.9, hz - topY)
        }
        ctx!.beginPath()
        ctx!.moveTo(leftEnd, deckY)
        ctx!.lineTo(towers[0], topY)
        ctx!.lineTo(towers[1], topY + (deckY - topY) * 0.38)
        ctx!.lineTo(towers[2], topY + (deckY - topY) * 0.38)
        ctx!.lineTo(towers[3], topY)
        ctx!.lineTo(rightEnd, deckY)
        ctx!.stroke()
      } else {
        // Twin towers
        for (const tx of [t1, t2]) {
          ctx!.fillStyle = rgbCss(col)
          ctx!.fillRect(tx - tw / 2, topY, tw, hz - topY)
          // Subtle lit edge on towers
          ctx!.fillStyle = rgbCss(litCol, 0.28)
          ctx!.fillRect(tx - tw / 2, topY, Math.max(0.8, tw * 0.2), hz - topY)

          if (br.style === "stone" && tw > 4.5) {
            // Brooklyn Bridge Gothic twin pointed arches
            ctx!.fillStyle = rgbCss(pal.hor, 0.48)
            const aw = tw * 0.22
            const ah = (deckY - topY) * 0.52
            for (const dir of [-1, 1]) {
              ctx!.beginPath()
              ctx!.moveTo(tx + dir * tw * 0.22 - aw / 2, deckY - 1)
              ctx!.lineTo(tx + dir * tw * 0.22 - aw / 2, topY + ah * 0.48)
              ctx!.quadraticCurveTo(
                tx + dir * tw * 0.22,
                topY + ah * 0.18,
                tx + dir * tw * 0.22 + aw / 2,
                topY + ah * 0.48
              )
              ctx!.lineTo(tx + dir * tw * 0.22 + aw / 2, deckY - 1)
              ctx!.closePath()
              ctx!.fill()
            }
          }
        }

        // Main catenary cables
        const sagY = deckY + (deckY - topY) * 0.62
        ctx!.strokeStyle = rgbCss(col)
        ctx!.lineWidth = Math.max(0.9, sp * 0.011)
        ctx!.beginPath()
        ctx!.moveTo(leftEnd, deckY)
        ctx!.quadraticCurveTo((leftEnd + t1) / 2, deckY, t1, topY)
        ctx!.quadraticCurveTo(cx, sagY, t2, topY)
        ctx!.quadraticCurveTo((t2 + rightEnd) / 2, deckY, rightEnd, deckY)
        ctx!.stroke()

        // Vertical suspenders
        ctx!.lineWidth = Math.max(0.45, sp * 0.004)
        ctx!.globalAlpha = k * 0.55
        const nSusp = Math.min(20, Math.max(6, Math.floor(sp / 9)))
        for (let i = 1; i < nSusp; i++) {
          const u = i / nSusp
          const bx = lerp(t1, t2, u)
          const cy =
            (1 - u) * (1 - u) * topY +
            2 * (1 - u) * u * sagY +
            u * u * topY
          ctx!.beginPath()
          ctx!.moveTo(bx, cy)
          ctx!.lineTo(bx, deckY)
          ctx!.stroke()
        }

        // Brooklyn Bridge diagonal fan stays
        if (br.style === "stone") {
          ctx!.globalAlpha = k * 0.36
          for (const tx of [t1, t2]) {
            for (let s = 1; s <= 4; s++) {
              ctx!.beginPath()
              ctx!.moveTo(tx, topY + 2)
              ctx!.lineTo(tx - s * sp * 0.065, deckY)
              ctx!.moveTo(tx, topY + 2)
              ctx!.lineTo(tx + s * sp * 0.065, deckY)
              ctx!.stroke()
            }
          }
        }

        // Iconic East River Pearl-Necklace Cable Lights at Dusk/Night!
        if (br.necklaceLights && nightness > 0.22 && sp > 24) {
          ctx!.globalAlpha = k * nightness * 0.92
          ctx!.fillStyle = "rgb(255,232,178)"
          const nBulbs = clamp(Math.floor(sp / 7), 8, 24)
          for (let i = 0; i <= nBulbs; i++) {
            const u = i / nBulbs
            const bx = lerp(t1, t2, u)
            const cy =
              (1 - u) * (1 - u) * topY +
              2 * (1 - u) * u * sagY +
              u * u * topY
            ctx!.beginPath()
            ctx!.arc(bx, cy, Math.max(0.85, Math.min(1.6, sp * 0.008)), 0, Math.PI * 2)
            ctx!.fill()
          }
          // Side-span necklace lights
          for (const [ax, bx2] of [
            [leftEnd, t1],
            [t2, rightEnd],
          ]) {
            const nSide = Math.max(4, Math.floor(nBulbs * 0.45))
            for (let i = 1; i < nSide; i++) {
              const u = i / nSide
              const x0 = lerp(ax, bx2, u)
              const startY = ax === leftEnd ? deckY : topY
              const endY = ax === leftEnd ? topY : deckY
              const cy =
                (1 - u) * (1 - u) * startY +
                2 * (1 - u) * u * deckY +
                u * u * endY
              ctx!.beginPath()
              ctx!.arc(x0, cy, Math.max(0.8, Math.min(1.4, sp * 0.007)), 0, Math.PI * 2)
              ctx!.fill()
            }
          }
        }
      }

      ctx!.restore()
    }
  }

  // ---------------------------------------------------------------------------
  // Tribute in Light (NYC Quiet Memorial Beams 2001–2011)
  // ---------------------------------------------------------------------------
  function drawTribute(year: number) {
    if (activeCity.id !== "nyc") return
    const t = smoothstep(2001, 2003, year) * (1 - smoothstep(2006, 2012, year))
    if (t <= 0.01) return
    ctx!.save()
    const xs = [sx(0.038), sx(0.046)]
    const w = Math.max(2.5, 0.0046 * cam.ppwx)
    for (const bx of xs) {
      // Soft atmospheric scatter beam
      const scatter = ctx!.createLinearGradient(0, hz, 0, 0)
      scatter.addColorStop(0, `rgba(182,212,255,${t * 0.24})`)
      scatter.addColorStop(0.55, `rgba(196,222,255,${t * 0.1})`)
      scatter.addColorStop(1, "rgba(196,222,255,0)")
      ctx!.fillStyle = scatter
      ctx!.fillRect(bx - w * 1.4, 0, w * 2.8, hz)

      // Crisp core beam
      const core = ctx!.createLinearGradient(0, hz, 0, 0)
      core.addColorStop(0, `rgba(222,238,255,${t * 0.56})`)
      core.addColorStop(0.75, `rgba(204,226,255,${t * 0.22})`)
      core.addColorStop(1, "rgba(204,226,255,0)")
      ctx!.fillStyle = core
      ctx!.fillRect(bx - w * 0.45, 0, w * 0.9, hz)
    }
    ctx!.restore()
  }

  // ---------------------------------------------------------------------------
  // Shimmering East River Water + Real Mirrored Skyline Reflection + Boats
  // ---------------------------------------------------------------------------
  function drawWater(
    p: number,
    pal: Palette,
    year: number,
    nightness: number,
    timeSec: number
  ) {
    const watH = H - hz
    if (watH <= 1) return

    // 1. Capture the skyline above horizon into half-res reflection buffer
    const rw = reflCanvas.width
    const rh = reflCanvas.height
    const horizonReflY = Math.round((hz / H) * rh)

    if (reflCtx && horizonReflY > 2) {
      reflCtx.clearRect(0, 0, rw, rh)
      reflCtx.drawImage(
        canvas,
        0,
        0,
        canvas.width,
        Math.round(hz * DPR),
        0,
        0,
        rw,
        horizonReflY
      )
    }

    // 2. Base deep river gradient
    const wg = ctx!.createLinearGradient(0, hz, 0, H)
    wg.addColorStop(0, rgbCss(mixRgb(pal.wat, pal.hor, 0.34)))
    wg.addColorStop(0.32, rgbCss(pal.wat))
    wg.addColorStop(1, rgbCss(mixRgb(pal.wat, [5, 8, 18], 0.58)))
    ctx!.fillStyle = wg
    ctx!.fillRect(0, hz, W, watH)

    // 3. Mirrored skyline reflection sliced smoothly with gentle wave ripple
    if (reflCtx && horizonReflY > 4) {
      ctx!.save()
      ctx!.beginPath()
      ctx!.rect(0, hz, W, watH)
      ctx!.clip()

      const strips = isMobile ? 64 : 110
      const wavePhase = reduceMotion ? 0 : timeSec * 1.45
      const ampScale = 1 + smoothEnergy * 0.35

      for (let i = 0; i < strips; i++) {
        const frac = i / strips
        const nextFrac = (i + 1) / strips
        // Exact integer pixel bounds prevent semi-transparent strip overlaps (no scanlines)
        const y0 = Math.floor(hz + frac * watH)
        const y1 = Math.floor(hz + nextFrac * watH)
        const destH = y1 - y0
        if (destH <= 0) continue

        const srcFrac0 = Math.pow(frac, 0.86) * 0.72
        const srcFrac1 = Math.pow(nextFrac, 0.86) * 0.72
        const srcY = Math.max(0, horizonReflY * (1 - srcFrac1))
        const srcH = Math.max(1, horizonReflY * (srcFrac1 - srcFrac0))

        const waveOffset =
          Math.sin(wavePhase + frac * 17 + Math.sin(frac * 7.5)) *
          (0.8 + frac * 7.2) *
          ampScale

        const alpha = (1 - frac * 0.82) * (0.28 + nightness * 0.3)
        ctx!.globalAlpha = alpha
        ctx!.drawImage(
          reflCanvas,
          0,
          srcY,
          rw,
          srcH,
          waveOffset,
          y0,
          W,
          destH
        )
      }

      // Soft horizontal surface mist veil to blend reflection smoothly in daylight
      const veil = ctx!.createLinearGradient(0, hz, 0, H)
      veil.addColorStop(0, rgbCss(pal.wat, 0.14 * (1 - nightness * 0.65)))
      veil.addColorStop(0.55, rgbCss(pal.wat, 0.24 * (1 - nightness * 0.55)))
      veil.addColorStop(1, rgbCss(pal.wat, 0.42))
      ctx!.globalAlpha = 1
      ctx!.fillStyle = veil
      ctx!.fillRect(0, hz, W, watH)
      ctx!.restore()
    }

    // 4. Organic scattered moonlight or sun-path river shimmer (no rigid ladder)
    const glitterCol =
      nightness > 0.35
        ? ([234, 240, 255] as const)
        : mixRgb(pal.hor, [255, 212, 148], 0.55)
    const glitterX =
      nightness > 0.35
        ? W * 0.81
        : W * lerp(0.16, 0.84, norm(0.11, 0.7, p))
    const glitterVis =
      nightness > 0.35
        ? smoothstep(0.73, 0.9, p) * 0.44
        : smoothstep(0.09, 0.2, p) * (1 - smoothstep(0.65, 0.74, p)) * 0.32

    if (glitterVis > 0.02) {
      ctx!.save()
      for (let i = 0; i < 44; i++) {
        const f = Math.pow(hash(i, 21), 1.35)
        const gy = hz + 4 + f * watH * 0.86
        const coneHalf = 10 + f * 58
        const jitterX = (hash(i, 12) - 0.5) * coneHalf * 1.4
        const drift = reduceMotion
          ? 0
          : Math.sin(timeSec * 1.9 + i * 2.1) * (2.5 + f * 7)
        const w = (4 + f * 22) * (0.45 + hash(i, 19) * 0.85)
        const a =
          glitterVis *
          (1 - f * 0.72) *
          (0.32 + 0.68 * hash(i, 4)) *
          (1 - Math.min(1, Math.abs(jitterX) / (coneHalf + 1)) * 0.55)
        ctx!.fillStyle = rgbCss(glitterCol, a)
        ctx!.fillRect(glitterX + jitterX + drift - w / 2, gy, w, 1)
      }
      ctx!.restore()
    }

    // 5. Subtle organic surface ripples (very soft in daylight to avoid scanlines)
    ctx!.save()
    const chopCol = mixRgb(pal.hor, pal.wat, 0.38)
    for (let i = 0; i < 24; i++) {
      const f = Math.pow(hash(i, 31), 1.3)
      const y = hz + f * watH
      const drift = reduceMotion ? 0 : Math.sin(timeSec * 0.85 + i * 2.3) * 14
      const x = ((hash(i, 3) * W * 1.2 + drift) % W + W) % W
      const len = (14 + hash(i, 8) * 46) * (0.35 + f * 0.85)
      ctx!.fillStyle = rgbCss(chopCol, (0.03 + (1 - f) * 0.055) * (0.65 + nightness * 0.35))
      ctx!.fillRect(x - len / 2, y, len, 1)
    }
    ctx!.restore()

    // 6. Subtle bright horizon waterline seam
    const seam = ctx!.createLinearGradient(0, hz - 1, 0, hz + 3)
    seam.addColorStop(0, rgbCss(pal.hor, 0.28))
    seam.addColorStop(1, rgbCss(pal.hor, 0))
    ctx!.fillStyle = seam
    ctx!.fillRect(0, hz - 1, W, 4)

    // 7. Era-accurate harbor vessels with gentle wakes & night nav lights
    drawBoats(year, pal, nightness, timeSec)
  }

  function drawHull(
    bx: number,
    by: number,
    s: number,
    right: boolean,
    sail: boolean
  ) {
    const dir = right ? 1 : -1
    ctx!.beginPath()
    ctx!.moveTo(bx - dir * s, by - s * 0.24)
    ctx!.lineTo(bx + dir * s * (sail ? 1.15 : 1.04), by - s * 0.24)
    ctx!.lineTo(bx + dir * s * 0.78, by + s * 0.22)
    ctx!.lineTo(bx - dir * s * 0.85, by + s * 0.22)
    ctx!.closePath()
    ctx!.fill()
  }

  function drawBoats(
    year: number,
    pal: Palette,
    nightness: number,
    timeSec: number
  ) {
    const col = mixRgb(pal.bd, pal.wat, 0.14)
    ctx!.save()
    ctx!.fillStyle = rgbCss(col)
    ctx!.strokeStyle = rgbCss(col)

    for (let i = 0; i < 3; i++) {
      const dir = hash(i, 5) < 0.5 ? 1 : -1
      const drift = reduceMotion ? 0 : timeSec * (0.0042 + i * 0.0014)
      const t = (year * 0.0035 + i * 0.37 + drift) % 1
      const bx = W * (dir > 0 ? t : 1 - t)
      const by = hz + (H - hz) * (0.16 + i * 0.19)
      const s = (H - hz) * (0.032 + i * 0.014)
      if (s < 2.2) continue

      // Trailing water wake shimmer behind boat
      ctx!.save()
      ctx!.strokeStyle = rgbCss(pal.hor, 0.14 + (1 - nightness) * 0.12)
      ctx!.lineWidth = 1
      ctx!.beginPath()
      ctx!.moveTo(bx - dir * s * 0.8, by + s * 0.22)
      ctx!.lineTo(bx - dir * s * 4.2, by + s * 0.36)
      ctx!.stroke()
      ctx!.restore()

      ctx!.lineWidth = Math.max(0.6, s * 0.055)
      if (year < 1810) {
        drawHull(bx, by, s * 0.75, dir > 0, true)
        ctx!.beginPath()
        ctx!.moveTo(bx, by - s * 0.2)
        ctx!.lineTo(bx, by - s * 2)
        ctx!.stroke()
        ctx!.beginPath()
        ctx!.moveTo(bx, by - s * 1.9)
        ctx!.lineTo(bx + dir * s * 0.78, by - s * 0.25)
        ctx!.lineTo(bx, by - s * 0.25)
        ctx!.closePath()
        ctx!.fill()
      } else if (year < 1885) {
        drawHull(bx, by, s, dir > 0, true)
        for (let m = -1; m <= 1; m++) {
          const mx = bx + m * s * 0.55
          const mh = s * (2.05 - Math.abs(m) * 0.38)
          ctx!.beginPath()
          ctx!.moveTo(mx, by - s * 0.15)
          ctx!.lineTo(mx, by - mh)
          ctx!.stroke()
          for (let yd = 1; yd <= 3; yd++) {
            const yy = by - mh * (0.34 + yd * 0.19)
            const yw = s * 0.42 * (1 - yd * 0.18)
            ctx!.beginPath()
            ctx!.moveTo(mx - yw, yy)
            ctx!.lineTo(mx + yw, yy)
            ctx!.stroke()
          }
        }
      } else if (year < 1950) {
        drawHull(bx, by, s * 1.25, dir > 0, false)
        ctx!.fillRect(bx - s * 0.55, by - s * 0.62, s * 1.1, s * 0.46)
        ctx!.fillRect(bx - s * 0.12, by - s * 1.35, s * 0.3, s * 0.78)
      } else if (year > 2005 && i === 0) {
        // Modern NYC Ferry catamaran silhouette with warm cabin windows
        drawHull(bx, by, s * 1.12, dir > 0, false)
        ctx!.fillRect(bx - s * 0.78, by - s * 0.7, s * 1.56, s * 0.5)
        ctx!.fillRect(bx - s * 0.48, by - s * 0.96, s * 0.96, s * 0.28)
        if (nightness > 0.25) {
          ctx!.fillStyle = `rgba(255,224,162,${nightness * 0.85})`
          ctx!.fillRect(bx - s * 0.62, by - s * 0.56, s * 1.24, s * 0.16)
          ctx!.fillStyle = rgbCss(col)
        }
      } else if (i === 1) {
        ctx!.fillRect(bx - s * 1.5, by - s * 0.28, s * 3, s * 0.5)
        ctx!.fillRect(bx - s * 1.2, by - s * 0.62, s * 0.7, s * 0.36)
      } else {
        drawHull(bx, by, s * 0.8, dir > 0, false)
        ctx!.fillRect(bx - dir * s * 0.05, by - s * 0.78, s * 0.42, s * 0.62)
        ctx!.fillRect(bx - dir * s * 0.02, by - s * 1.02, s * 0.3, s * 0.26)
        ctx!.fillRect(bx - dir * s * 0.55, by - s * 0.95, s * 0.2, s * 0.8)
      }

      // Tiny navigation lights at dusk/night
      if (nightness > 0.3) {
        ctx!.fillStyle = `rgba(255,234,186,${nightness * 0.85})`
        ctx!.beginPath()
        ctx!.arc(bx, by - s * 0.92, 1.15, 0, Math.PI * 2)
        ctx!.fill()
        ctx!.fillStyle =
          dir > 0
            ? `rgba(118,236,158,${nightness * 0.8})`
            : `rgba(255,96,86,${nightness * 0.8})`
        ctx!.beginPath()
        ctx!.arc(bx + dir * s * 0.82, by - s * 0.26, 1.15, 0, Math.PI * 2)
        ctx!.fill()
        ctx!.fillStyle = rgbCss(col)
      }
    }
    ctx!.restore()
  }

  // ---------------------------------------------------------------------------
  // Caption Helper
  // ---------------------------------------------------------------------------
  function captionForYear(year: number): string {
    let best = ""
    const windowYears = activeCity.endYear - activeCity.startYear > 600 ? 18 : 6.5
    for (const c of allCaptions) {
      if (year >= c.year && year - c.year < windowYears) best = c.text
    }
    return best
  }

  // ---------------------------------------------------------------------------
  // Main Render Loop
  // ---------------------------------------------------------------------------
  function renderFrame(nowMs: number) {
    if (stopped) return
    const timeSec = nowMs * 0.001

    if (reduceMotion) {
      currentP = targetP
      currentQ = targetQ
      smoothEnergy = 0
    } else {
      const stepP = clamp((targetP - currentP) * ENGINE_CFG.smoothing, -0.05, 0.05)
      currentP += stepP
      if (Math.abs(targetP - currentP) < 0.00025) currentP = targetP

      const stepQ = clamp((targetQ - currentQ) * 0.14, -0.06, 0.06)
      currentQ += stepQ
      if (Math.abs(targetQ - currentQ) < 0.00025) currentQ = targetQ

      smoothEnergy = lerp(smoothEnergy, audioEnergy, 0.12)
    }

    // Smooth spotlight blend
    if (spotlight) {
      lastSpot = spotlight
      spotBlend = reduceMotion ? 1 : lerp(spotBlend, 1, 0.1)
      if (spotBlend > 0.995) spotBlend = 1
    } else if (spotBlend > 0.002) {
      spotBlend = reduceMotion ? 0 : lerp(spotBlend, 0, 0.12)
      if (spotBlend < 0.005) {
        spotBlend = 0
        lastSpot = null
      }
    }

    const baseYear = yearAtForCity(activeCity, currentP)
    const activeP =
      lastSpot && spotBlend > 0.001
        ? lerp(currentP, lastSpot.p, spotBlend)
        : currentP
    const year =
      lastSpot && spotBlend > 0.001
        ? lerp(baseYear, lastSpot.year, spotBlend)
        : baseYear

    const fr = frameAt(year)
    const wideSpan = Math.min(activeCity.finalSpan, fr.x1 - fr.x0)
    const wideCx = fr.x0 + wideSpan / 2
    const widePpft = ((W / wideSpan) * EXAG) / activeCity.islandFt
    const wideCy = (baselineY - H / 2) / widePpft

    const stops = activeCity.tourStops
    const touring = currentQ > 0.0005 && !spotlight
    const tour = sampleTourForCity(activeCity, currentQ)

    let cx: number
    let span: number
    let cyFt: number

    if (touring && stops.length > 0) {
      // Smoothly transition from wide panoramic horizon into Stop 0 on initial scroll
      const entryBlend = smoothstep(0, 0.06, currentQ)
      const a = framingForStop(stops[tour.from])
      const b = framingForStop(stops[tour.index])
      const tourCx = lerp(a.cx, b.cx, tour.move)
      const tourSpan = lerp(a.span, b.span, tour.move)
      const tourCy = lerp(a.cyFt, b.cyFt, tour.move)
      cx = lerp(wideCx, tourCx, entryBlend)
      span = lerp(wideSpan, tourSpan, entryBlend)
      cyFt = lerp(wideCy, tourCy, entryBlend)
    } else {
      cx = wideCx
      span = wideSpan
      cyFt = wideCy
    }

    if (lastSpot && spotBlend > 0.001) {
      const sf = framingForStop(lastSpot)
      cx = lerp(cx, sf.cx, spotBlend)
      span = lerp(span, sf.span, spotBlend)
      cyFt = lerp(cyFt, sf.cyFt, spotBlend)
    }

    setCamera(cx, span, cyFt)
    hz = sy(0)

    const pal = paletteAt(activeP)
    const nightness = smoothstep(0.64, 0.88, activeP)

    ctx!.setTransform(DPR, 0, 0, DPR, 0, 0)
    ctx!.fillStyle = rgbCss([8, 12, 28])
    ctx!.fillRect(0, 0, W, H)

    // 1. Sky & celestial atmosphere
    drawSky(activeP, pal, timeSec, nightness)

    // 2. City-specific far backdrop (Palisades, Montmartre, Thames, Mount Fuji, Victoria Peak) & far-layer landmarks
    drawFarBackdrop(pal, nightness)
    for (const h of activeCity.heroes) {
      if (h.layer === "far") drawBuilding(h, year, pal, nightness, timeSec, activeP)
    }

    // 3. Waterfront terrain & historic foliage
    drawLand(year, pal)

    // 4. City massing fill + foreground landmark silhouettes
    for (const f of fillBuildings) {
      drawBuilding(f, year, pal, nightness, timeSec, activeP)
    }
    for (const h of activeCity.heroes) {
      if (h.layer !== "far") drawBuilding(h, year, pal, nightness, timeSec, activeP)
    }

    // 5. Atmospheric street-canyon depth & horizon mist
    const ambH = H * 0.16
    const ag = ctx!.createLinearGradient(0, hz - ambH, 0, hz)
    ag.addColorStop(0, rgbCss(pal.bd, 0))
    ag.addColorStop(1, rgbCss(pal.bd, 0.44 * (1 - nightness * 0.45)))
    ctx!.fillStyle = ag
    ctx!.fillRect(0, hz - ambH, W, ambH)

    const hg = ctx!.createLinearGradient(0, hz - H * 0.08, 0, hz)
    hg.addColorStop(0, rgbCss(pal.hor, 0))
    hg.addColorStop(1, rgbCss(pal.hor, 0.28))
    ctx!.fillStyle = hg
    ctx!.fillRect(0, hz - H * 0.08, W, H * 0.08)

    // 6. Tribute in Light (NYC) + City Bridges
    drawTribute(year)
    drawBridges(year, pal, nightness)

    // 7. Shimmering mirrored river/harbor reflections + vessels
    drawWater(activeP, pal, year, nightness, timeSec)

    // Throttled HUD callback (~15fps or immediately on caption/stop change)
    const roundedYear = touring ? activeCity.endYear : Math.round(year)
    const caption = spotlight
      ? activeCity.heroes.find((h) => h.id === spotlight?.id)?.name ??
        activeCity.bridges.find((b) => b.id === spotlight?.id)?.name ??
        ""
      : touring
        ? tour.subject
        : captionForYear(year)

    const shouldEmit =
      nowMs - lastHudEmit > 64 ||
      caption !== lastCaptionKey ||
      tour.activeIndex !== lastStopKey

    if (shouldEmit) {
      lastHudEmit = nowMs
      lastCaptionKey = caption
      lastStopKey = tour.activeIndex
      onHudUpdate({
        p: activeP,
        q: currentQ,
        year: roundedYear,
        era: eraLabelForCity(activeCity, roundedYear, touring),
        caption,
        touring,
        activeStopIndex: tour.activeIndex,
        stopOpacities: tour.opacities,
        spotlightId: spotlight?.id ?? null,
        handoverHint: currentP >= 0.92 && currentQ < 0.03 && !spotlight,
      })
    }

    rafId = requestAnimationFrame(renderFrame)
  }

  let resizeTimer: ReturnType<typeof setTimeout> | undefined
  const onResize = () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(resize, 110)
  }

  window.addEventListener("resize", onResize, { passive: true })
  resize()
  rafId = requestAnimationFrame(renderFrame)

  return {
    setCity(city: CityConfig) {
      activeCity = city
      frameAt = createFrameSampler(activeCity)
      allCaptions = buildCaptionsForCity(activeCity)
      fillBuildings = buildFillForCity(activeCity, fillCount)
      spotlight = null
      lastSpot = null
      spotBlend = 0
      lastCaptionKey = ""
      lastStopKey = -1
    },
    setProgress(p: number, q: number, immediate = false) {
      targetP = clamp(p, 0, 1)
      targetQ = clamp(q, 0, 1)
      if (immediate) {
        currentP = targetP
        currentQ = targetQ
      }
    },
    setSpotlight(target: SpotlightTarget | null) {
      spotlight = target
    },
    setAudioEnergy(energy: number) {
      audioEnergy = clamp(energy, 0, 1)
    },
    getState() {
      return {
        p: currentP,
        q: currentQ,
        year: Math.round(yearAtForCity(activeCity, currentP)),
      }
    },
    destroy() {
      stopped = true
      cancelAnimationFrame(rafId)
      clearTimeout(resizeTimer)
      window.removeEventListener("resize", onResize)
    },
  }
}
