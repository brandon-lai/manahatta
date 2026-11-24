import {
  type AnyBuilding,
  BRIDGES,
  buildFill,
  CFG,
  EVENTS,
  eraLabelForYear,
  frameAt,
  GREETING,
  HEROES,
  type HeroLandmark,
  type Palette,
  paletteAt,
  profileOf,
  sampleTour,
  TOUR_STOPS,
  yearAt,
} from "./data"
import {
  clamp,
  glide,
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
  greetAlpha: number
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

interface Camera {
  cx: number
  span: number
  cyFt: number
  ppwx: number
  ppft: number
}

const ALL_CAPTIONS: { year: number; text: string }[] = (() => {
  const out: { year: number; text: string }[] = []
  for (const h of HEROES) {
    if (h.cap) out.push({ year: h.built, text: h.cap })
    if (h.bye && h.demo) out.push({ year: h.demo, text: h.bye })
  }
  for (const e of EVENTS) {
    out.push({ year: e.year, text: e.text })
  }
  out.sort((a, b) => a.year - b.year)
  return out
})()

export function initSkylineRenderer(
  canvas: HTMLCanvasElement,
  onHudUpdate: (snapshot: HudSnapshot) => void
): SkylineController {
  const ctx = canvas.getContext("2d", { alpha: false })
  if (!ctx) {
    return {
      setProgress: () => {},
      setSpotlight: () => {},
      setAudioEnergy: () => {},
      getState: () => ({ p: 0, q: 0, year: 1609 }),
      destroy: () => {},
    }
  }

  // Offscreen reflection canvas for shimmering mirrored East River water
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

  const FILL = buildFill(
    typeof window !== "undefined" && window.innerWidth < 768 ? 360 : 700
  )

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

  const cam: Camera = { cx: 0.06, span: 0.16, cyFt: 0, ppwx: 1, ppft: 1 }

  function setCamera(cx: number, span: number, cyFt: number) {
    cam.cx = cx
    cam.span = span
    cam.cyFt = cyFt
    cam.ppwx = W / span
    cam.ppft = (cam.ppwx * EXAG) / CFG.islandFt
  }

  function sx(wx: number): number {
    return W / 2 + (wx - cam.cx) * cam.ppwx
  }

  function sy(ft: number): number {
    return H / 2 - (ft - cam.cyFt) * cam.ppft
  }

  function framingForStop(stop: { x: number; span: number; ft: number }) {
    const span = isMobile ? Math.min(stop.span, 0.28) : stop.span
    const baseCy = (baselineY - H / 2) / (((W / span) * EXAG) / CFG.islandFt)
    const focusCy =
      stop.ft - (H * (isMobile ? 0.03 : 0.06)) / (((W / span) * EXAG) / CFG.islandFt)
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
  let arrowDim = 0
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

    // Warm urban light-pollution domes over Midtown & Downtown at night
    if (nightness > 0.05) {
      const pulse = 1 + smoothEnergy * 0.24
      const domes = [
        { wx: 0.36, rFactor: 0.44, strength: 0.22 },
        { wx: 0.048, rFactor: 0.3, strength: 0.17 },
      ]
      for (const d of domes) {
        const dx = sx(d.wx)
        const rad = Math.max(W * d.rFactor, 260)
        const dg = ctx!.createRadialGradient(dx, hz, 0, dx, hz, rad)
        dg.addColorStop(0, rgbCss(pal.glow, nightness * d.strength * pulse))
        dg.addColorStop(0.48, rgbCss(pal.glow, nightness * d.strength * 0.35 * pulse))
        dg.addColorStop(1, rgbCss(pal.glow, 0))
        ctx!.fillStyle = dg
        ctx!.fillRect(0, 0, W, hz + 2)
      }
    }

    // Subtle Fire of 1776 amber haze near the Battery
    const year = yearAt(p)
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
  // Land, Forests, Central Park & East River Piers
  // ---------------------------------------------------------------------------
  function hillFt(wx: number, year: number): number {
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

  function drawFarRidge(pal: Palette) {
    ctx!.save()
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
    const landCol = mixRgb(pal.bd, [36, 54, 42], 1 - smoothstep(1780, 1890, year))
    ctx!.fillStyle = rgbCss(landCol)
    ctx!.beginPath()
    const startX = Math.max(-0.02, cam.cx - cam.span * 0.6)
    const endX = Math.min(1.04, cam.cx + cam.span * 0.6)
    ctx!.moveTo(sx(startX), hz + 2)
    for (let i = 0; i <= 64; i++) {
      const wx = lerp(startX, endX, i / 64)
      ctx!.lineTo(sx(wx), sy(hillFt(wx, year)))
    }
    ctx!.lineTo(sx(endX), hz + 2)
    ctx!.closePath()
    ctx!.fill()

    // Lenape & early-colonial forest clearing
    const forestCol = mixRgb(pal.bd, [26, 48, 36], 0.58)
    ctx!.fillStyle = rgbCss(forestCol)
    for (const tr of TREES) {
      const clearYr = 1645 + tr.x * 365 + tr.s * 30
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

    // Central Park foliage canopy (1858 onward)
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

    // East River finger piers
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
      const bevelGrad = ctx!.createLinearGradient(
        bx,
        0,
        bx + bevelW,
        0
      )
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
        b.type === "bofa"
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

      // Night windows clipped cleanly inside the building silhouette!
      const litThreshold =
        nightness *
        (b.isHero ? 0.96 : 0.78) *
        (1 - arrowDim * (b.isHero && b.id === "esb" ? 0.78 : 0.68))

      if (litThreshold > 0.05 && w > 3 && curH > 12 && b.type !== "liberty") {
        drawWindowsClipped(b, x, w, topY, baseY, curH, litThreshold, isGlass)
      }

      // 432 Park Avenue iconic open glowing mechanical wind floors
      if (b.type === "p432" && nightness > 0.2 && curH > 30) {
        ctx!.fillStyle = `rgba(255,232,196,${nightness * 0.58 * (1 - arrowDim * 0.5)})`
        for (const frac of [0.22, 0.4, 0.58, 0.76, 0.91]) {
          const fy = baseY - curH * frac
          ctx!.fillRect(x - w * 0.46, fy, w * 0.92, Math.max(1.2, curH * 0.012))
        }
      }

      // Illuminated Art Deco & Supertall Night Crowns
      if (b.isHero && b.crownGlow && nightness > 0.18 && rise > 0.9) {
        drawHeroCrownGlow(b, x, w, baseY, curH, nightness * (1 - arrowDim * 0.55))
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
    strength: number
  ) {
    const col = b.crownGlow ?? [255, 224, 168]

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
  // East River Bridges + Pearl-Necklace Night Cable Lights
  // ---------------------------------------------------------------------------
  function drawBridges(year: number, pal: Palette, nightness: number) {
    const col = mixRgb(pal.bd, pal.hor, 0.14)
    const litCol = mixRgb(pal.bdLit, pal.hor, 0.22)

    for (const br of BRIDGES) {
      const k = smoothstep(br.built - 2, br.built + 2.5, year)
      if (k <= 0.01) continue
      const cx = sx(br.x)
      const sp = br.span * cam.ppwx
      if (cx + sp < -20 || cx - sp > W + 20) continue
      if (sp < 8) continue

      const deckY = sy(br.deckH)
      const topY = sy(br.towerH)
      const tw = Math.max(2.2, sp * (br.style === "stone" ? 0.068 : 0.044))
      const t1 = cx - sp * 0.32
      const t2 = cx + sp * 0.32
      const leftEnd = cx - sp * 0.72
      const rightEnd = cx + sp * 0.72

      ctx!.save()
      ctx!.globalAlpha = k
      ctx!.fillStyle = rgbCss(col)
      ctx!.strokeStyle = rgbCss(col)

      // Roadway deck
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
  // Tribute in Light (Quiet Memorial Beams 2001–2011)
  // ---------------------------------------------------------------------------
  function drawTribute(year: number) {
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
  // Signature Empire State Glowing Window + Hand-Drawn Arrow & Greeting
  // ---------------------------------------------------------------------------
  function scribble(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    t: number,
    arc: number
  ) {
    const steps = 32
    const span = Math.hypot(toX - fromX, toY - fromY)
    const at = (f: number): [number, number] => [
      lerp(fromX, toX, f) + Math.sin(f * 7.3) * 2.8,
      lerp(fromY, toY, f) +
        Math.sin(f * 5.1 + 1.2) * 3 -
        Math.sin(f * Math.PI) * span * arc,
    ]

    ctx!.beginPath()
    const drawTo = Math.floor(steps * clamp(t * 1.3, 0, 1))
    for (let i = 0; i <= drawTo; i++) {
      const [px, py] = at(i / steps)
      if (i === 0) ctx!.moveTo(px, py)
      else ctx!.lineTo(px, py)
    }
    ctx!.stroke()

    const [ex, ey] = at(1)
    const [bx, by] = at(0.92)
    return { x: ex, y: ey, angle: Math.atan2(ey - by, ex - bx) }
  }

  function drawGreeting(t: number) {
    if (t <= 0.01) return
    const tx = sx(GREETING.x)
    const ty = sy(GREETING.ft)
    const wsz = Math.max(5.5, 0.00095 * cam.ppwx)

    // Warm tungsten window halo
    ctx!.save()
    const halo = ctx!.createRadialGradient(tx, ty, 0, tx, ty, wsz * 5.5)
    halo.addColorStop(0, `rgba(255,212,138,${t * 0.58})`)
    halo.addColorStop(0.5, `rgba(255,190,112,${t * 0.2})`)
    halo.addColorStop(1, "rgba(255,190,112,0)")
    ctx!.fillStyle = halo
    ctx!.beginPath()
    ctx!.arc(tx, ty, wsz * 5.5, 0, Math.PI * 2)
    ctx!.fill()

    // Crisp glowing window pane
    ctx!.globalAlpha = t
    ctx!.fillStyle = "rgb(255,222,158)"
    ctx!.shadowColor = "rgba(255,196,118,0.95)"
    ctx!.shadowBlur = 22
    ctx!.fillRect(tx - wsz / 2, ty - wsz * 0.72, wsz, wsz * 1.44)
    ctx!.restore()

    const len = Math.min(W * 0.26, 168)
    const side = tx > W * 0.56 ? -1 : 1
    const ax = tx + side * len * 0.92
    const ay = ty - len * 0.58

    ctx!.save()
    ctx!.globalAlpha = t
    ctx!.strokeStyle = "rgba(252,238,214,0.94)"
    ctx!.lineWidth = 2.1
    ctx!.lineCap = "round"
    const tip = scribble(ax, ay, tx + side * wsz * 1.15, ty - wsz * 0.35, t, 0.17)

    if (t > 0.65) {
      const headAlpha = clamp((t - 0.65) / 0.35, 0, 1)
      ctx!.globalAlpha = t * headAlpha
      const headSize = Math.max(10, wsz * 2.1)
      ctx!.beginPath()
      for (const spread of [2.5, -2.5]) {
        ctx!.moveTo(tip.x, tip.y)
        ctx!.lineTo(
          tip.x + Math.cos(tip.angle + spread) * headSize,
          tip.y + Math.sin(tip.angle + spread) * headSize
        )
      }
      ctx!.stroke()

      const px = isMobile ? clamp(W * 0.056, 21, 26) : clamp(W * 0.042, 24, 34)
      const handFamily =
        getComputedStyle(document.documentElement).getPropertyValue("--font-hand").trim() ||
        "Caveat, cursive"
      ctx!.font = `500 ${px}px ${handFamily}`
      ctx!.fillStyle = "rgba(252,240,218,0.98)"
      ctx!.shadowColor = "rgba(8,10,22,0.85)"
      ctx!.shadowBlur = 16
      ctx!.textAlign = "left"
      const label = "Hi, I\u2019m Brandon"
      const lw = ctx!.measureText(label).width
      const edgePad = isMobile ? 24 : 32
      const lx = clamp(
        side > 0 ? ax + 6 : ax - lw - 6,
        edgePad,
        Math.max(edgePad, W - lw - edgePad)
      )
      ctx!.fillText(label, lx, ay - (isMobile ? 12 : 8))
    }
    ctx!.restore()
  }

  // ---------------------------------------------------------------------------
  // Caption Helper
  // ---------------------------------------------------------------------------
  function captionForYear(year: number): string {
    let best = ""
    for (const c of ALL_CAPTIONS) {
      if (year >= c.year && year - c.year < 6.2) best = c.text
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
      const stepP = clamp((targetP - currentP) * CFG.smoothing, -0.05, 0.05)
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

    const baseYear = yearAt(currentP)
    const activeP =
      lastSpot && spotBlend > 0.001
        ? lerp(currentP, lastSpot.p, spotBlend)
        : currentP
    const year =
      lastSpot && spotBlend > 0.001
        ? lerp(baseYear, lastSpot.year, spotBlend)
        : baseYear

    const fr = frameAt(year)
    const wideSpan = Math.min(CFG.finalSpan, fr.x1 - fr.x0)
    let wideCx = fr.x0 + wideSpan / 2
    if (fr.x1 - fr.x0 > CFG.finalSpan) wideCx = CFG.finalSpan / 2

    const rest = framingForStop(TOUR_STOPS[0])
    const settle = glide(norm(0.86, 1, currentP))
    const touring = currentQ > 0.0005 && !spotlight
    const tour = sampleTour(currentQ)

    let cx: number
    let span: number
    let cyFt: number

    if (touring) {
      const a = framingForStop(TOUR_STOPS[tour.from])
      const b = framingForStop(TOUR_STOPS[tour.index])
      cx = lerp(a.cx, b.cx, tour.move)
      span = lerp(a.span, b.span, tour.move)
      cyFt = lerp(a.cyFt, b.cyFt, tour.move)
    } else {
      cx = lerp(wideCx, rest.cx, settle)
      span = lerp(wideSpan, rest.span, settle)
      const wideCy = (baselineY - H / 2) / (((W / wideSpan) * EXAG) / CFG.islandFt)
      cyFt = lerp(wideCy, rest.cyFt, settle)
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

    const greetAlpha =
      spotlight || spotBlend > 0.2
        ? 0
        : smoothstep(0.86, 0.985, currentP) * (touring ? tour.greet : 1)
    arrowDim = greetAlpha * 0.56

    ctx!.setTransform(DPR, 0, 0, DPR, 0, 0)
    ctx!.fillStyle = rgbCss([8, 12, 28])
    ctx!.fillRect(0, 0, W, H)

    // 1. Sky & celestial atmosphere
    drawSky(activeP, pal, timeSec, nightness)

    // 2. Far New Jersey / Hudson Yards ridge & far-layer heroes
    drawFarRidge(pal)
    for (const h of HEROES) {
      if (h.layer === "far") drawBuilding(h, year, pal, nightness, timeSec, activeP)
    }

    // 3. Manhattan terrain, Lenape woods, Central Park & East River piers
    drawLand(year, pal)

    // 4. City massing fill + spine landmarks
    for (const f of FILL) {
      drawBuilding(f, year, pal, nightness, timeSec, activeP)
    }
    for (const h of HEROES) {
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

    // 6. Tribute in Light + Bridges
    drawTribute(year)
    drawBridges(year, pal, nightness)

    // 7. Shimmering East River mirrored reflections + vessels
    drawWater(activeP, pal, year, nightness, timeSec)

    // 8. Empire State glowing window + hand-drawn greeting
    if (greetAlpha > 0.01) {
      drawGreeting(greetAlpha)
    }

    // Throttled HUD callback (~15fps or immediately on caption/stop change)
    const roundedYear = touring ? 2026 : Math.round(year)
    const caption = spotlight
      ? HEROES.find((h) => h.id === spotlight?.id)?.name ??
        BRIDGES.find((b) => b.id === spotlight?.id)?.name ??
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
        era: eraLabelForYear(roundedYear, touring),
        caption,
        touring,
        activeStopIndex: tour.activeIndex,
        stopOpacities: tour.opacities,
        greetAlpha,
        spotlightId: spotlight?.id ?? null,
        handoverHint: currentP > 0.97 && currentQ < 0.04 && !spotlight,
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
        year: Math.round(yearAt(currentP)),
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
