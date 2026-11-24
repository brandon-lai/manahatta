"use client"

import * as React from "react"
import {
  ArrowUpRight,
  Briefcase,
  CakeSlice,
  Code2,
  Footprints,
  Music,
  Trophy,
  Watch,
} from "lucide-react"

import {
  type StoryIconKey,
  TOUR_STOPS,
  type TourStop,
} from "@/lib/skyline/data"
import { cn } from "@/lib/utils"

function StoryIcon({ kind }: { kind: StoryIconKey }) {
  const cls = "size-4 shrink-0 text-primary/90 mt-1"
  switch (kind) {
    case "code":
      return <Code2 className={cls} aria-hidden="true" />
    case "trophy":
      return <Trophy className={cls} aria-hidden="true" />
    case "footprints":
      return <Footprints className={cls} aria-hidden="true" />
    case "cake":
      return <CakeSlice className={cls} aria-hidden="true" />
    case "guitar":
      return <Music className={cls} aria-hidden="true" />
    case "watch":
      return <Watch className={cls} aria-hidden="true" />
    default:
      return <Briefcase className={cls} aria-hidden="true" />
  }
}

interface TourOverlayProps {
  visible: boolean
  activeIndex: number
  opacities: number[]
}

function positionClassForStop(stop: TourStop): string {
  if (stop.id === "empire-state") {
    return "left-5 right-5 top-[11vh] md:left-auto md:right-[6vw] md:top-[14vh] md:max-w-md"
  }
  if (stop.id === "chrysler") {
    // Float in the wide-open upper-right starry sky so Empire State & Chrysler spires stay unobstructed
    return "left-5 right-5 top-[10vh] md:left-auto md:right-[5.5vw] md:top-[11vh] md:max-w-md"
  }
  if (stop.align === "left") {
    return "left-5 right-5 top-[10vh] md:left-[6vw] md:right-auto md:top-[12vh] md:max-w-md"
  }
  if (stop.align === "center") {
    return "left-5 right-5 top-[11vh] md:left-1/2 md:right-auto md:-translate-x-1/2 md:top-[13vh] md:max-w-lg md:text-center"
  }
  return "left-5 right-5 top-[10vh] md:left-auto md:right-[6vw] md:top-[12vh] md:max-w-md"
}

export function TourOverlay({
  visible,
  opacities,
}: TourOverlayProps) {
  if (!visible) return null

  return (
    <div
      className="pointer-events-none fixed inset-0 z-20"
      aria-live="polite"
    >
      {TOUR_STOPS.map((stop, idx) => {
        const opacity = opacities[idx] ?? 0
        if (opacity <= 0.02) return null

        const isInteractive = opacity > 0.35
        const isWorkStop = stop.id === "one-wtc"
        const isCenter = stop.align === "center"

        return (
          <section
            key={stop.id}
            aria-label={stop.title ?? stop.shortLabel}
            style={{ opacity }}
            className={cn(
              "fixed px-2 py-2 transition-opacity duration-200 ease-[var(--ease-out)] motion-reduce:transition-none",
              isInteractive ? "pointer-events-auto" : "pointer-events-none",
              positionClassForStop(stop)
            )}
          >
            {/* Feathered, borderless nocturnal sky vignette behind open-sky prose */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-x-10 -inset-y-8 -z-10"
              style={{
                background:
                  "radial-gradient(ellipse at center, var(--scrim) 0%, var(--scrim-soft) 52%, transparent 78%)",
              }}
            />
            {stop.title && (
              <h2 className="skyline-hand skyline-text-shadow text-[2rem] sm:text-[2.45rem] leading-[1.12] font-medium text-foreground mb-3">
                {stop.title}
              </h2>
            )}

            <div
              className={cn(
                "space-y-2.5 skyline-text-shadow",
                isWorkStop && "space-y-3"
              )}
            >
              {stop.lines.map((line, lineIdx) => {
                if (line.org) {
                  const content = (
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-border/70 pb-2">
                      <div>
                        <span className="skyline-serif text-[1.06rem] sm:text-[1.16rem] text-foreground font-medium">
                          {line.org}
                        </span>
                        <span className="mx-2 text-muted-foreground/70">·</span>
                        <span className="skyline-serif text-[0.98rem] sm:text-[1.08rem] text-foreground/88">
                          {line.text}
                        </span>
                      </div>
                      {line.period && (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {line.period}
                        </span>
                      )}
                    </div>
                  )

                  return line.href ? (
                    <a
                      key={lineIdx}
                      href={line.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-sm transition-colors duration-150 hover:text-primary focus-visible:outline-2"
                    >
                      {content}
                    </a>
                  ) : (
                    <div key={lineIdx}>{content}</div>
                  )
                }

                return (
                  <p
                    key={lineIdx}
                    className={cn(
                      "skyline-serif text-[1.06rem] sm:text-[1.22rem] leading-[1.58] flex items-start gap-2.5",
                      isCenter && "justify-center",
                      line.dim ? "text-muted-foreground" : "text-foreground"
                    )}
                  >
                    {line.icon && <StoryIcon kind={line.icon} />}
                    <span>
                      {line.text}
                      {line.linkLabel && line.href && (
                        <>
                          {" "}
                          <a
                            href={line.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-primary underline decoration-primary/50 hover:decoration-primary transition-colors duration-150"
                          >
                            <span>{line.linkLabel}</span>
                            <ArrowUpRight className="size-3.5" aria-hidden="true" />
                          </a>
                        </>
                      )}
                    </span>
                  </p>
                )
              })}
            </div>

            {stop.cta && (
              <div className={cn("mt-6", isCenter && "flex justify-center")}>
                <a
                  href={stop.cta.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border-strong bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-[var(--shadow-plate)] transition-[background-color,transform] duration-150 ease-[var(--ease-out)] hover:bg-primary/90 active:scale-[0.96] motion-reduce:transition-none"
                >
                  <span>{stop.cta.label}</span>
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </a>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
