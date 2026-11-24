"use client"

import * as React from "react"
import { Building2, Compass, Navigation } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  BRIDGES,
  type BridgeDef,
  HEROES,
  type HeroLandmark,
  type LandmarkEra,
  progressAtYear,
} from "@/lib/skyline/data"
import { type SpotlightTarget } from "@/lib/skyline/renderer"
import { cn } from "@/lib/utils"

type AtlasFilter = "all" | LandmarkEra | "bridges"

const FILTERS: { id: AtlasFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "historic", label: "Historic" },
  { id: "art-deco", label: "Art Deco" },
  { id: "modern", label: "Modern" },
  { id: "lost", label: "Lost Icons" },
  { id: "bridges", label: "Bridges" },
]

interface LandmarkAtlasDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeSpotlightId: string | null
  onFlyTo: (target: SpotlightTarget) => void
}

function buildHeroTarget(h: HeroLandmark): SpotlightTarget {
  // Fly into each landmark's defining architectural era so historic icons stand prominent
  let year: number
  if (h.demo) {
    year = Math.min(h.demo - 3, Math.max(h.built + 10, 1936))
  } else if (h.era === "historic") {
    year = Math.min(1918, Math.max(h.built + 8, 1855))
  } else if (h.era === "art-deco") {
    year = Math.min(1942, Math.max(h.built + 4, 1934))
  } else {
    year = 2026
  }

  const p = year >= 2026 ? 0.94 : progressAtYear(year)
  // Give supertalls generous framing span so crowns & antennas stay well below the top edge
  const span = h.h > 1300 ? 0.25 : h.h > 900 ? 0.21 : h.h > 450 ? 0.175 : 0.15
  return {
    id: h.id,
    x: h.x,
    span,
    ft: Math.max(180, h.h * 0.52),
    year,
    p,
  }
}

function buildBridgeTarget(b: BridgeDef): SpotlightTarget {
  return {
    id: b.id,
    x: b.x,
    span: 0.21,
    ft: b.towerH * 0.62,
    year: 2026,
    p: 0.94,
  }
}

export function LandmarkAtlasDialog({
  open,
  onOpenChange,
  activeSpotlightId,
  onFlyTo,
}: LandmarkAtlasDialogProps) {
  const [filter, setFilter] = React.useState<AtlasFilter>("all")

  const filteredHeroes = React.useMemo(() => {
    if (filter === "bridges") return []
    const list =
      filter === "all"
        ? [...HEROES]
        : HEROES.filter((h) => h.era === filter)
    return list.sort((a, b) => a.built - b.built)
  }, [filter])

  const filteredBridges = React.useMemo(() => {
    if (filter !== "all" && filter !== "bridges") return []
    return [...BRIDGES].sort((a, b) => a.built - b.built)
  }, [filter])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[82dvh] flex flex-col overflow-hidden p-0 gap-0">
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary">
              <Compass className="size-4" aria-hidden="true" />
              <span className="text-xs font-medium text-muted-foreground">
                Manhattan East River Elevation, 1609 to 2026
              </span>
            </div>
            <DialogTitle className="skyline-serif text-2xl font-normal tracking-tight text-foreground mt-1">
              Skyline Atlas
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Select any tower or East River span to glide the camera into its
              era.
            </DialogDescription>
          </DialogHeader>

          <div
            className="flex flex-wrap gap-1.5 mt-4"
            role="group"
            aria-label="Filter landmarks by era"
          >
            {FILTERS.map((f) => {
              const selected = filter === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "min-h-9 rounded-full px-3.5 text-xs font-medium border transition-[background-color,border-color,color,transform] duration-150 ease-[var(--ease-out)] enabled:active:scale-[0.96] motion-reduce:transition-none",
                    selected
                      ? "border-border-strong bg-primary text-primary-foreground"
                      : "border-border bg-secondary/60 text-muted-foreground hover:border-border-strong hover:text-foreground"
                  )}
                >
                  {f.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="relative flex-1 min-h-0">
          <div className="h-full overflow-y-auto overscroll-contain px-6 pt-2 pb-12 divide-y divide-border/75">
            {filteredHeroes.map((h) => {
              const isCurrent = activeSpotlightId === h.id
              return (
                <div
                  key={h.id}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5 px-2 -mx-2 rounded-lg transition-[background-color] duration-150",
                    isCurrent
                      ? "bg-accent"
                      : "hover:bg-surface-elevated/45"
                  )}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                      <h3 className="skyline-serif text-base font-medium text-foreground">
                        {h.name}
                      </h3>
                      <span className="text-xs tabular-nums text-primary font-medium">
                        {h.demo ? `${h.built} to ${h.demo}` : h.built}
                      </span>
                      <span className="text-xs tabular-nums text-foreground/78">
                        {h.h.toLocaleString()} ft
                      </span>
                    </div>
                    <p className="text-xs text-foreground/82 leading-relaxed">
                      {h.summary}
                    </p>
                    <p className="text-xs text-foreground/72">
                      {h.district}, {h.architect}
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant={isCurrent ? "default" : "outline"}
                    className="shrink-0 self-start sm:self-center"
                    onClick={() => {
                      onFlyTo(buildHeroTarget(h))
                      onOpenChange(false)
                    }}
                  >
                    <Navigation className="size-3.5" aria-hidden="true" />
                    <span>{isCurrent ? "Viewing" : "Fly to"}</span>
                  </Button>
                </div>
              )
            })}

            {filteredBridges.length > 0 && (
              <div className="pt-3 divide-y divide-border/75">
                {filter === "all" && (
                  <div className="flex items-center gap-2 pt-1 pb-2.5 text-xs font-medium text-foreground/82">
                    <Building2 className="size-3.5 text-primary" aria-hidden="true" />
                    <span>East River Crossings</span>
                  </div>
                )}
                {filteredBridges.map((b) => {
                  const isCurrent = activeSpotlightId === b.id
                  return (
                    <div
                      key={b.id}
                      className={cn(
                        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5 px-2 -mx-2 rounded-lg transition-[background-color] duration-150",
                        isCurrent
                          ? "bg-accent"
                          : "hover:bg-surface-elevated/45"
                      )}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                          <h3 className="skyline-serif text-base font-medium text-foreground">
                            {b.name}
                          </h3>
                          <span className="text-xs tabular-nums text-primary font-medium">
                            {b.built}
                          </span>
                          <span className="text-xs tabular-nums text-foreground/78">
                            {b.towerH} ft towers
                          </span>
                        </div>
                        <p className="text-xs text-foreground/82 leading-relaxed">
                          {b.summary}
                        </p>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant={isCurrent ? "default" : "outline"}
                        className="shrink-0 self-start sm:self-center"
                        onClick={() => {
                          onFlyTo(buildBridgeTarget(b))
                          onOpenChange(false)
                        }}
                      >
                        <Navigation className="size-3.5" aria-hidden="true" />
                        <span>{isCurrent ? "Viewing" : "Fly to"}</span>
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-popover via-popover/75 to-transparent"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
