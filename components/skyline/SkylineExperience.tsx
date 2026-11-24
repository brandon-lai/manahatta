"use client"

import * as React from "react"
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
} from "lucide-react"

import { LandmarkAtlasDialog } from "@/components/skyline/LandmarkAtlasDialog"
import { TourOverlay } from "@/components/skyline/TourOverlay"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Slider } from "@/components/ui/slider"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  BRIDGES,
  FADE_SECONDS,
  GREETING_HOLD,
  HEROES,
  INTRO_SECONDS,
  MILESTONES,
  progressAtYear,
  TOUR_STOPS,
  tourScrollProgressForStop,
  WRITE_TAIL,
} from "@/lib/skyline/data"
import { clamp } from "@/lib/skyline/math"
import {
  type HudSnapshot,
  initSkylineRenderer,
  type SkylineController,
  type SpotlightTarget,
} from "@/lib/skyline/renderer"
import { cn } from "@/lib/utils"

const AUDIO_SRC = "/audio/nyc.mp3"

const INITIAL_HUD: HudSnapshot = {
  p: 0,
  q: 0,
  year: 1609,
  era: "Lenape & Dutch Shore",
  caption: "1609 — Manahatta, before the grid",
  touring: false,
  activeStopIndex: 0,
  stopOpacities: TOUR_STOPS.map(() => 0),
  greetAlpha: 0,
  spotlightId: null,
  handoverHint: false,
}

export function SkylineExperience() {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const spacerRef = React.useRef<HTMLDivElement | null>(null)
  const tourSpacerRef = React.useRef<HTMLDivElement | null>(null)
  const enterBtnRef = React.useRef<HTMLButtonElement | null>(null)

  const controllerRef = React.useRef<SkylineController | null>(null)
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const audioCtxRef = React.useRef<AudioContext | null>(null)
  const analyserRef = React.useRef<AnalyserNode | null>(null)
  const analyserDataRef = React.useRef<Uint8Array<ArrayBuffer> | null>(null)

  const drivingRef = React.useRef(false)
  const driveRafRef = React.useRef(0)
  const driveStartRef = React.useRef(0)
  const driveOffsetSecRef = React.useRef(0)
  const tailStartRef = React.useRef<number | null>(null)
  const scrollDrivenByAudioRef = React.useRef(false)
  const pendingJumpRef = React.useRef<{ p: number; q: number } | null>(null)
  const mutedRef = React.useRef(false)

  const [entered, setEntered] = React.useState(false)
  const [playing, setPlaying] = React.useState(false)
  const [muted, setMuted] = React.useState(false)
  const [atlasOpen, setAtlasOpen] = React.useState(false)
  const [spotlight, setSpotlight] = React.useState<SpotlightTarget | null>(null)
  const [hud, setHud] = React.useState<HudSnapshot>(INITIAL_HUD)

  const getIntroMax = React.useCallback(
    () => spacerRef.current?.offsetHeight ?? 0,
    []
  )
  const getTourMax = React.useCallback(
    () => tourSpacerRef.current?.offsetHeight ?? 0,
    []
  )

  const syncScrollToRenderer = React.useCallback(
    (immediate = false) => {
      const introMax = getIntroMax()
      const tourMax = getTourMax()
      const y = window.scrollY
      const p = introMax > 0 ? clamp(y / introMax, 0, 1) : 0
      const q =
        tourMax > 0 && y > introMax
          ? clamp((y - introMax) / tourMax, 0, 1)
          : 0
      controllerRef.current?.setProgress(p, q, immediate)
    },
    [getIntroMax, getTourMax]
  )

  const stopPlayback = React.useCallback((pauseAudio = true) => {
    drivingRef.current = false
    cancelAnimationFrame(driveRafRef.current)
    setPlaying(false)
    controllerRef.current?.setAudioEnergy(0)
    if (pauseAudio && audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause()
    }
  }, [])

  const scrollToProgress = React.useCallback(
    (p: number, q = 0, immediate = false) => {
      const introMax = getIntroMax()
      const tourMax = getTourMax()
      const y =
        q > 0
          ? introMax + clamp(q, 0, 1) * tourMax
          : clamp(p, 0, 1) * introMax
      scrollDrivenByAudioRef.current = true
      window.scrollTo({ top: y, behavior: "instant" })
      controllerRef.current?.setProgress(clamp(p, 0, 1), clamp(q, 0, 1), immediate)
      requestAnimationFrame(() => {
        scrollDrivenByAudioRef.current = false
      })
    },
    [getIntroMax, getTourMax]
  )

  const ensureAudio = React.useCallback(() => {
    if (!audioRef.current) {
      const el = new Audio(AUDIO_SRC)
      el.preload = "auto"
      el.crossOrigin = "anonymous"
      audioRef.current = el
    }
    if (!audioCtxRef.current && typeof window !== "undefined") {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext
        if (AudioCtx) {
          const ctx = new AudioCtx()
          const source = ctx.createMediaElementSource(audioRef.current)
          const analyser = ctx.createAnalyser()
          analyser.fftSize = 128
          analyser.smoothingTimeConstant = 0.82
          source.connect(analyser)
          analyser.connect(ctx.destination)
          audioCtxRef.current = ctx
          analyserRef.current = analyser
          analyserDataRef.current = new Uint8Array(
            new ArrayBuffer(analyser.frequencyBinCount)
          )
        }
      } catch {
        // Fallback cleanly to plain HTMLAudioElement if Web Audio is restricted
      }
    }
    return audioRef.current
  }, [])

  const startDriveLoop = React.useCallback(
    (useAudioClock: boolean, startOffsetSec = 0) => {
      cancelAnimationFrame(driveRafRef.current)
      drivingRef.current = true
      setPlaying(true)
      tailStartRef.current = null
      driveStartRef.current = performance.now()
      driveOffsetSecRef.current = startOffsetSec

      const step = () => {
        if (!drivingRef.current) return
        const audio = audioRef.current
        const introMax = getIntroMax()
        const tourMax = getTourMax()
        const holdPx = GREETING_HOLD * tourMax

        let elapsedSec: number
        if (useAudioClock && audio && !audio.paused && !Number.isNaN(audio.currentTime)) {
          elapsedSec = audio.currentTime
        } else {
          elapsedSec =
            driveOffsetSecRef.current +
            (performance.now() - driveStartRef.current) / 1000
        }

        // Feed subtle bass/mid audio energy to city horizon glow & river shimmer
        if (
          useAudioClock &&
          audio &&
          !audio.paused &&
          !mutedRef.current &&
          analyserRef.current &&
          analyserDataRef.current
        ) {
          analyserRef.current.getByteFrequencyData(analyserDataRef.current)
          let sum = 0
          const bins = Math.min(14, analyserDataRef.current.length)
          for (let i = 0; i < bins; i++) sum += analyserDataRef.current[i]
          const energy = clamp(sum / (bins * 255), 0, 1)
          controllerRef.current?.setAudioEnergy(energy)
        } else {
          controllerRef.current?.setAudioEnergy(0)
        }

        // Smooth audio fade-out over the last 2.2s of the 25s score
        if (audio && useAudioClock) {
          const left = INTRO_SECONDS - elapsedSec
          if (left <= FADE_SECONDS) {
            audio.volume = mutedRef.current
              ? 0
              : clamp(left / FADE_SECONDS, 0, 1)
          } else {
            audio.volume = mutedRef.current ? 0 : 1
          }
        }

        if (elapsedSec < INTRO_SECONDS) {
          const p = clamp(elapsedSec / INTRO_SECONDS, 0, 1)
          scrollToProgress(p, 0)
        } else {
          if (audio && !audio.paused) {
            audio.pause()
            audio.volume = mutedRef.current ? 0 : 1
          }
          if (tailStartRef.current === null) {
            tailStartRef.current = performance.now()
          }
          const tailFrac = clamp(
            (performance.now() - tailStartRef.current) / (WRITE_TAIL * 1000),
            0,
            1
          )
          const q = introMax > 0 ? clamp((holdPx * tailFrac) / Math.max(1, tourMax), 0, 1) : 0
          scrollToProgress(1, q)
          if (tailFrac >= 1) {
            stopPlayback(false)
            return
          }
        }

        driveRafRef.current = requestAnimationFrame(step)
      }

      driveRafRef.current = requestAnimationFrame(step)
    },
    [getIntroMax, getTourMax, scrollToProgress, stopPlayback]
  )

  const beginExperience = React.useCallback(
    (withSound: boolean) => {
      setEntered(true)
      setSpotlight(null)
      controllerRef.current?.setSpotlight(null)

      const isReduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches

      mutedRef.current = !withSound
      setMuted(!withSound)

      if (isReduced) {
        scrollToProgress(1, 0, true)
        return
      }

      scrollToProgress(0, 0, true)

      if (withSound) {
        const audio = ensureAudio()
        audio.currentTime = 0
        audio.volume = 1
        if (audioCtxRef.current?.state === "suspended") {
          void audioCtxRef.current.resume()
        }
        audio
          .play()
          .then(() => startDriveLoop(true, 0))
          .catch(() => startDriveLoop(false, 0))
      } else {
        startDriveLoop(false, 0)
      }
    },
    [ensureAudio, scrollToProgress, startDriveLoop]
  )

  const togglePlayPause = React.useCallback(() => {
    if (!entered) {
      beginExperience(true)
      return
    }
    if (playing) {
      stopPlayback(true)
      return
    }
    setSpotlight(null)
    controllerRef.current?.setSpotlight(null)

    const currentP = hud.p >= 0.99 ? 0 : hud.p
    const startSec = currentP * INTRO_SECONDS
    if (currentP === 0) scrollToProgress(0, 0, true)

    if (!mutedRef.current) {
      const audio = ensureAudio()
      audio.currentTime = startSec
      audio.volume = 1
      if (audioCtxRef.current?.state === "suspended") {
        void audioCtxRef.current.resume()
      }
      audio
        .play()
        .then(() => startDriveLoop(true, startSec))
        .catch(() => startDriveLoop(false, startSec))
    } else {
      startDriveLoop(false, startSec)
    }
  }, [
    beginExperience,
    entered,
    ensureAudio,
    hud.p,
    playing,
    scrollToProgress,
    startDriveLoop,
    stopPlayback,
  ])

  const handleReplay = React.useCallback(() => {
    setSpotlight(null)
    controllerRef.current?.setSpotlight(null)
    beginExperience(!mutedRef.current)
  }, [beginExperience])

  const toggleMute = React.useCallback(() => {
    const next = !mutedRef.current
    mutedRef.current = next
    setMuted(next)
    if (audioRef.current) {
      audioRef.current.muted = next
      audioRef.current.volume = next ? 0 : 1
    }
  }, [])

  const handleScrubYearProgress = React.useCallback(
    (nextP: number) => {
      stopPlayback(true)
      setSpotlight(null)
      controllerRef.current?.setSpotlight(null)
      scrollToProgress(clamp(nextP, 0, 1), 0)
    },
    [scrollToProgress, stopPlayback]
  )

  const handleJumpToTourStop = React.useCallback(
    (stopIndex: number) => {
      stopPlayback(true)
      setSpotlight(null)
      controllerRef.current?.setSpotlight(null)
      const q = tourScrollProgressForStop(stopIndex)
      scrollToProgress(1, q)
    },
    [scrollToProgress, stopPlayback]
  )

  const handleFlyToLandmark = React.useCallback(
    (target: SpotlightTarget) => {
      stopPlayback(true)
      setEntered(true)
      scrollToProgress(target.p, 0, true)
      setSpotlight(target)
      controllerRef.current?.setSpotlight(target)
    },
    [scrollToProgress, stopPlayback]
  )

  const clearSpotlight = React.useCallback(() => {
    setSpotlight(null)
    controllerRef.current?.setSpotlight(null)
  }, [])

  // Mount canvas renderer & handle URL jump params (?p=0.58&gate=0, ?q=0.45)
  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctrl = initSkylineRenderer(canvas, (snapshot) => {
      setHud(snapshot)
    })
    controllerRef.current = ctrl

    const params = new URLSearchParams(window.location.search)
    const pParam = params.get("p")
    const qParam = params.get("q")
    const gateParam = params.get("gate")

    if (pParam !== null || qParam !== null || gateParam === "0") {
      const pVal = pParam !== null ? clamp(parseFloat(pParam) || 0, 0, 1) : 1
      const qVal = qParam !== null ? clamp(parseFloat(qParam) || 0, 0, 1) : 0
      pendingJumpRef.current = { p: pVal, q: qVal }
      requestAnimationFrame(() => {
        setEntered(true)
      })
    } else {
      syncScrollToRenderer(true)
    }

    return () => {
      cancelAnimationFrame(driveRafRef.current)
      ctrl.destroy()
      controllerRef.current = null
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (audioCtxRef.current) {
        void audioCtxRef.current.close()
        audioCtxRef.current = null
      }
    }
  }, [syncScrollToRenderer])

  // Lock scroll cleanly while gate is up; hand off smoothly to user scroll once entered
  React.useEffect(() => {
    document.body.style.overflow = entered ? "" : "hidden"
    if (!entered) {
      enterBtnRef.current?.focus({ preventScroll: true })
    } else if (pendingJumpRef.current) {
      const { p, q } = pendingJumpRef.current
      pendingJumpRef.current = null
      scrollToProgress(p, q, true)
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [entered, scrollToProgress])

  // Native scroll & manual gesture handoff
  React.useEffect(() => {
    const onScroll = () => {
      if (!entered) return
      if (!scrollDrivenByAudioRef.current) {
        if (drivingRef.current) stopPlayback(true)
        if (spotlight) clearSpotlight()
      }
      syncScrollToRenderer(false)
    }

    const onManualInput = () => {
      if (drivingRef.current) stopPlayback(true)
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("wheel", onManualInput, { passive: true })
    window.addEventListener("touchstart", onManualInput, { passive: true })

    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("wheel", onManualInput)
      window.removeEventListener("touchstart", onManualInput)
    }
  }, [clearSpotlight, entered, spotlight, stopPlayback, syncScrollToRenderer])

  // Keyboard shortcuts (ignored when typing or inside dialog)
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return
      }

      if (!entered) {
        if (e.key === "Enter") {
          e.preventDefault()
          beginExperience(true)
        }
        return
      }

      if (e.key === "Escape" && spotlight && !atlasOpen) {
        e.preventDefault()
        clearSpotlight()
        return
      }

      if (atlasOpen) return

      const lower = e.key.toLowerCase()
      if (lower === "m") {
        e.preventDefault()
        toggleMute()
      } else if (lower === "r") {
        e.preventDefault()
        handleReplay()
      } else if (lower === "a") {
        e.preventDefault()
        setAtlasOpen(true)
      } else if (e.key === " " && target?.tagName !== "BUTTON") {
        e.preventDefault()
        togglePlayPause()
      } else if (e.key === "ArrowRight" && hud.touring) {
        e.preventDefault()
        handleJumpToTourStop(Math.min(TOUR_STOPS.length - 1, hud.activeStopIndex + 1))
      } else if (e.key === "ArrowLeft" && hud.touring) {
        e.preventDefault()
        handleJumpToTourStop(Math.max(0, hud.activeStopIndex - 1))
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [
    atlasOpen,
    beginExperience,
    clearSpotlight,
    entered,
    handleJumpToTourStop,
    handleReplay,
    hud.activeStopIndex,
    hud.touring,
    spotlight,
    toggleMute,
    togglePlayPause,
  ])

  const spotlightMeta = React.useMemo(() => {
    if (!spotlight) return null
    const hero = HEROES.find((h) => h.id === spotlight.id)
    if (hero) {
      return {
        name: hero.name,
        meta: `${hero.demo ? `${hero.built} to ${hero.demo}` : hero.built}, ${hero.h.toLocaleString()} ft, ${hero.architect}`,
        summary: hero.summary,
      }
    }
    const bridge = BRIDGES.find((b) => b.id === spotlight.id)
    if (bridge) {
      return {
        name: bridge.name,
        meta: `${bridge.built}, ${bridge.towerH} ft towers, East River`,
        summary: bridge.summary,
      }
    }
    return null
  }, [spotlight])

  return (
    <div className="relative min-h-dvh w-full bg-background text-foreground">
      {/* Sticky full-bleed skyline canvas */}
      <canvas
        ref={canvasRef}
        aria-label="Animated Manhattan skyline from 1609 to 2026 along the East River"
        className="fixed inset-0 z-0 block h-dvh w-full"
      />

      {/* Scroll tracks driving timelapse & nocturnal tour */}
      <div
        ref={spacerRef}
        className="relative z-0 h-[620vh] pointer-events-none"
        aria-hidden="true"
      />
      <div
        ref={tourSpacerRef}
        className="relative z-0 h-[560vh] pointer-events-none"
        aria-hidden="true"
      />

      {/* Opening Gate Curtain */}
      <div
        aria-hidden={entered}
        className={cn(
          "fixed inset-0 z-40 flex flex-col items-center justify-center px-6 text-center bg-scrim/70 backdrop-blur-[5px] transition-opacity duration-600 ease-[var(--ease-out)] motion-reduce:transition-none",
          entered ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
      >
        <div className="max-w-xl space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-medium text-primary/95 tracking-normal">
              40.7128° N, 74.0060° W, East River View
            </p>
            <h1 className="skyline-gate-title skyline-text-shadow font-normal text-foreground">
              Manahatta
            </h1>
            <p className="skyline-serif skyline-text-shadow text-base sm:text-lg leading-relaxed text-foreground/86 max-w-md mx-auto">
              Four centuries of Manhattan rising along the river in twenty-five
              seconds, scored to music, followed by a walk through the city at
              night.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              ref={enterBtnRef}
              type="button"
              size="lg"
              disabled={entered}
              onClick={() => beginExperience(true)}
              className="rounded-full px-7 shadow-[var(--shadow-plate)]"
            >
              <Play className="size-4 fill-current" aria-hidden="true" />
              <span>Enter with sound</span>
            </Button>

            <Button
              type="button"
              size="lg"
              variant="outline"
              disabled={entered}
              onClick={() => beginExperience(false)}
              className="rounded-full px-6"
            >
              <span>Enter silently</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Top Navigation & Controls (Post-Gate) */}
      {entered && (
        <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-4 py-4 sm:px-7 sm:py-5 pointer-events-none">
          {/* Top-left subtle architectural wordmark + era */}
          <div className="pointer-events-auto flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => handleScrubYearProgress(0)}
              className="skyline-serif skyline-text-shadow text-lg sm:text-xl text-foreground hover:text-primary transition-colors duration-150 rounded-md px-1.5 py-1 min-h-11 inline-flex items-center"
            >
              Manahatta
            </button>
            <span
              className="hidden sm:inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground/92"
              aria-label={`Current era: ${hud.era}`}
            >
              {hud.era}
            </span>
          </div>

          {/* Top-right shadcn control cluster */}
          <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    onClick={togglePlayPause}
                    aria-label={playing ? "Pause skyline film" : "Play skyline film"}
                    className="rounded-full"
                  />
                }
              >
                {playing ? (
                  <Pause className="size-4" aria-hidden="true" />
                ) : (
                  <Play className="size-4 translate-x-[0.5px]" aria-hidden="true" />
                )}
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <span>{playing ? "Pause" : "Play"}</span>
                <Kbd>Space</Kbd>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    onClick={toggleMute}
                    aria-label={muted ? "Unmute soundtrack" : "Mute soundtrack"}
                    className="rounded-full relative"
                  />
                }
              >
                {muted ? (
                  <VolumeX className="size-4" aria-hidden="true" />
                ) : playing ? (
                  <span
                    className="inline-flex items-end gap-[2px] h-3.5"
                    aria-hidden="true"
                  >
                    <span className="w-[2px] h-full rounded-full bg-primary eq-bar-1 origin-bottom" />
                    <span className="w-[2px] h-full rounded-full bg-primary eq-bar-2 origin-bottom" />
                    <span className="w-[2px] h-full rounded-full bg-primary eq-bar-3 origin-bottom" />
                  </span>
                ) : (
                  <Volume2 className="size-4" aria-hidden="true" />
                )}
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <span>{muted ? "Unmute" : "Mute"}</span>
                <Kbd>M</Kbd>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    onClick={handleReplay}
                    aria-label="Replay timelapse from 1609"
                    className="rounded-full"
                  />
                }
              >
                <RotateCcw className="size-4" aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <span>Replay from 1609</span>
                <Kbd>R</Kbd>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label="Open Skyline Atlas"
                    onClick={() => setAtlasOpen(true)}
                    className="rounded-full px-3.5 min-h-10"
                  />
                }
              >
                <Compass className="size-4 text-primary" aria-hidden="true" />
                <span className="hidden sm:inline">Atlas</span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <span>Landmark Atlas</span>
                <Kbd>A</Kbd>
              </TooltipContent>
            </Tooltip>
          </div>
        </header>
      )}

      {/* Open-Sky Editorial Story Layer during Nocturnal Tour */}
      <TourOverlay
        visible={entered && hud.touring && !spotlight}
        activeIndex={hud.activeStopIndex}
        opacities={hud.stopOpacities}
      />

      {/* Landmark Spotlight Inspection Plate */}
      {entered && spotlightMeta && (
        <aside
          aria-label={`Spotlight: ${spotlightMeta.name}`}
          className="fixed left-4 right-4 top-20 sm:left-7 sm:right-auto sm:max-w-md z-30 skyline-plate rounded-2xl p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <h2 className="skyline-serif text-lg font-medium text-foreground">
                {spotlightMeta.name}
              </h2>
              <p className="text-xs tabular-nums text-primary font-medium">
                {spotlightMeta.meta}
              </p>
              <p className="text-xs leading-relaxed text-foreground/86 pt-1">
                {spotlightMeta.summary}
              </p>
            </div>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              onClick={clearSpotlight}
              aria-label="Exit landmark spotlight"
              className="rounded-full shrink-0"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 pt-2.5 border-t border-border">
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => setAtlasOpen(true)}
              className="rounded-full"
            >
              <Compass className="size-3.5" aria-hidden="true" />
              <span>Pick another</span>
            </Button>
            <Button
              type="button"
              size="xs"
              variant="default"
              onClick={clearSpotlight}
              className="rounded-full"
            >
              <span>Return to timeline</span>
            </Button>
          </div>
        </aside>
      )}

      {/* Whisper-Quiet Bottom Timeline & Tour HUD */}
      {entered && (
        <footer className="fixed inset-x-0 bottom-0 z-30 pointer-events-none px-4 pb-4 pt-12 sm:px-7 sm:pb-6 bg-gradient-to-t from-background/85 via-background/35 to-transparent">
          <div className="max-w-6xl mx-auto flex flex-col gap-3">
            {/* Row 1: Year + Caption + Scroll cue */}
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-baseline gap-3">
                  <span
                    className="skyline-year skyline-text-shadow text-foreground"
                    aria-live="off"
                  >
                    {hud.year}
                  </span>
                  <span className="skyline-serif skyline-text-shadow text-sm sm:text-[0.98rem] text-foreground/88 truncate">
                    {(hud.caption || hud.era).replace(/^\d{4}\s*[—–-]\s*/, "")}
                  </span>
                </div>
              </div>

              {hud.handoverHint && (
                <button
                  type="button"
                  onClick={() => handleJumpToTourStop(1)}
                  className="pointer-events-auto inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border-strong bg-secondary/75 px-3.5 text-xs font-medium text-foreground backdrop-blur-md transition-[background-color,transform] duration-150 hover:bg-surface-elevated active:scale-[0.96] motion-reduce:transition-none shrink-0"
                >
                  <span>Begin night tour</span>
                  <ChevronDown className="size-3.5 text-primary" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Row 2: Interactive Scrubber OR Tour Chapter Rail */}
            {hud.touring && !spotlight ? (
              <nav
                aria-label="Nocturnal skyline tour stops"
                className="pointer-events-auto flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                  <button
                    type="button"
                    onClick={() => handleScrubYearProgress(0.96)}
                    className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium text-foreground/90 transition-[background-color,border-color,transform] duration-150 ease-[var(--ease-out)] hover:border-border-strong hover:text-foreground active:scale-[0.96] motion-reduce:transition-none"
                  >
                    <ChevronLeft className="size-3.5 text-primary" aria-hidden="true" />
                    <span>Timeline</span>
                  </button>
                  {TOUR_STOPS.map((stop, idx) => {
                    const active = hud.activeStopIndex === idx
                    return (
                      <button
                        key={stop.id}
                        type="button"
                        aria-current={active ? "step" : undefined}
                        onClick={() => handleJumpToTourStop(idx)}
                        className={cn(
                          "min-h-10 shrink-0 rounded-full border px-3.5 text-xs font-medium transition-[background-color,border-color,color,transform] duration-150 ease-[var(--ease-out)] enabled:active:scale-[0.96] motion-reduce:transition-none",
                          active
                            ? "border-border-strong bg-primary text-primary-foreground"
                            : "border-border bg-secondary/65 text-foreground/85 backdrop-blur-md hover:border-border-strong hover:text-foreground"
                        )}
                      >
                        {stop.shortLabel}
                      </button>
                    )
                  })}
                </div>

                <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    aria-label="Previous tour stop"
                    disabled={hud.activeStopIndex <= 0}
                    onClick={() =>
                      handleJumpToTourStop(Math.max(0, hud.activeStopIndex - 1))
                    }
                    className="rounded-full"
                  >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    aria-label="Next tour stop"
                    disabled={hud.activeStopIndex >= TOUR_STOPS.length - 1}
                    onClick={() =>
                      handleJumpToTourStop(
                        Math.min(TOUR_STOPS.length - 1, hud.activeStopIndex + 1)
                      )
                    }
                    className="rounded-full"
                  >
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </nav>
            ) : (
              <div className="pointer-events-auto space-y-2">
                <Slider
                  aria-label="Manhattan skyline timeline from 1609 to 2026"
                  min={0}
                  max={1000}
                  step={1}
                  value={[Math.round(hud.p * 1000)]}
                  onValueChange={(val) => {
                    const next = Array.isArray(val) ? val[0] : val
                    handleScrubYearProgress(next / 1000)
                  }}
                />
                <div className="relative hidden sm:block h-6 text-xs text-foreground/82">
                  {MILESTONES.map((m, idx) => {
                    const targetP =
                      m.year === 2026 ? 0.78 : progressAtYear(m.year)
                    const isNear = Math.abs(hud.year - m.year) <= 5
                    const isFirst = idx === 0
                    const translateCls = isFirst ? "" : "-translate-x-1/2"
                    return (
                      <button
                        key={m.year}
                        type="button"
                        title={`${m.label}: ${m.era}`}
                        onClick={() => handleScrubYearProgress(targetP)}
                        style={{ left: `${(targetP * 100).toFixed(2)}%` }}
                        className={cn(
                          "absolute top-0 inline-flex items-center whitespace-nowrap rounded px-1 py-0.5 tabular-nums skyline-text-shadow transition-colors duration-150 hover:text-foreground",
                          translateCls,
                          isNear && "text-primary font-semibold"
                        )}
                      >
                        <span>{m.label}</span>
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    title="2026 Manhattan at night"
                    onClick={() => handleScrubYearProgress(1)}
                    style={{ left: "100%" }}
                    className={cn(
                      "absolute top-0 -translate-x-full inline-flex items-center whitespace-nowrap rounded px-1 py-0.5 skyline-text-shadow transition-colors duration-150 hover:text-foreground",
                      hud.p >= 0.92 && "text-primary font-semibold"
                    )}
                  >
                    <span>Night</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </footer>
      )}

      {/* Landmark Atlas Dialog */}
      <LandmarkAtlasDialog
        open={atlasOpen}
        onOpenChange={setAtlasOpen}
        activeSpotlightId={spotlight?.id ?? null}
        onFlyTo={handleFlyToLandmark}
      />
    </div>
  )
}
