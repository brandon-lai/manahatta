"use client"

import * as React from "react"

import type { CityConfig, TourStop } from "@/lib/skyline/data"
import { cn } from "@/lib/utils"

interface TourOverlayProps {
  city: CityConfig
  visible: boolean
  activeIndex: number
  opacities: number[]
}

function positionClassForStop(stop: TourStop): string {
  if (stop.align === "left") {
    return "left-5 right-5 top-[14vh] md:left-[6vw] md:right-auto md:top-[15vh] md:max-w-md"
  }
  if (stop.align === "center") {
    return "left-5 right-5 top-[14vh] md:left-1/2 md:right-auto md:-translate-x-1/2 md:top-[15vh] md:max-w-lg md:text-center"
  }
  return "left-5 right-5 top-[14vh] md:left-auto md:right-[6vw] md:top-[15vh] md:max-w-md"
}

export function TourOverlay({
  city,
  visible,
  opacities,
}: TourOverlayProps) {
  if (!visible) return null

  return (
    <div
      className="pointer-events-none fixed inset-0 z-20"
      aria-live="polite"
    >
      {city.tourStops.map((stop, idx) => {
        const opacity = opacities[idx] ?? 0
        if (opacity <= 0.06) return null

        const isCenter = stop.align === "center"

        return (
          <section
            key={`${city.id}-${stop.id}`}
            aria-label={stop.title}
            style={{ opacity }}
            className={cn(
              "fixed px-2 py-2 transition-opacity duration-200 ease-[var(--ease-out)] motion-reduce:transition-none pointer-events-none",
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

            {stop.eyebrow && (
              <p className="text-xs font-medium text-primary/95 skyline-text-shadow mb-1.5 tabular-nums">
                {stop.eyebrow}
              </p>
            )}

            <h2 className="skyline-serif skyline-text-shadow text-[1.85rem] sm:text-[2.35rem] leading-[1.12] font-normal tracking-tight text-foreground mb-3">
              {stop.title}
            </h2>

            <div className="space-y-2.5 skyline-text-shadow">
              {stop.lines.map((line, lineIdx) => {
                if (line.statLabel && line.statValue) {
                  return (
                    <div
                      key={lineIdx}
                      className={cn(
                        "flex items-baseline justify-between gap-4 border-b border-border/65 pb-1.5 text-sm",
                        isCenter && "max-w-xs mx-auto"
                      )}
                    >
                      <span className="text-muted-foreground">
                        {line.statLabel}
                      </span>
                      <span className="skyline-serif text-foreground font-medium tabular-nums">
                        {line.statValue}
                      </span>
                    </div>
                  )
                }

                return (
                  <p
                    key={lineIdx}
                    className={cn(
                      "skyline-serif text-[1.02rem] sm:text-[1.15rem] leading-[1.58]",
                      line.dim ? "text-muted-foreground" : "text-foreground"
                    )}
                  >
                    {line.text}
                  </p>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
