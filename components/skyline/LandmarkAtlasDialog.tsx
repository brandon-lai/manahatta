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
  type BridgeDef,
  type CityConfig,
  type EraFilter,
  type HeroLandmark,
  progressAtYearForCity,
} from "@/lib/skyline/data"
import { type SpotlightTarget } from "@/lib/skyline/renderer"
import { cn } from "@/lib/utils"

type AtlasFilter = "all" | EraFilter | "bridges"

interface LandmarkAtlasDialogProps {
  city: CityConfig
  open: boolean
  onOpenChange: (open: boolean) => void
  activeSpotlightId: string | null
  onFlyTo: (target: SpotlightTarget) => void
}

function buildHeroTarget(city: CityConfig, h: HeroLandmark): SpotlightTarget {
  // Fly into each landmark's defining era so historic icons stand clear and prominent
  let year: number
  if (h.demo) {
    year = Math.min(h.demo - 3, Math.max(h.built + 10, city.startYear + 40))
  } else if (h.era === "historic") {
    year = Math.min(1918, Math.max(h.built + 12, city.startYear + 60))
  } else if (h.era === "classic") {
    year = Math.min(1986, Math.max(h.built + 6, 1936))
  } else {
    year = city.endYear
  }

  const p =
    year >= city.endYear ? 0.94 : progressAtYearForCity(city, year)
  const span =
    h.h > 1400 ? 0.25 : h.h > 950 ? 0.21 : h.h > 450 ? 0.18 : 0.16
  return {
    id: h.id,
    x: h.x,
    span,
    ft: Math.max(160, h.h * 0.52),
    year,
    p,
  }
}

function buildBridgeTarget(city: CityConfig, b: BridgeDef): SpotlightTarget {
  return {
    id: b.id,
    x: b.x,
    span: 0.21,
    ft: Math.max(120, b.towerH * 0.62),
    year: city.endYear,
    p: 0.94,
  }
}

export function LandmarkAtlasDialog({
  city,
  open,
  onOpenChange,
  activeSpotlightId,
  onFlyTo,
}: LandmarkAtlasDialogProps) {
  const [filterState, setFilterState] = React.useState<{
    cityId: string
    value: AtlasFilter
  }>({ cityId: city.id, value: "all" })
  const filter: AtlasFilter =
    filterState.cityId === city.id ? filterState.value : "all"
  const setFilter = React.useCallback(
    (value: AtlasFilter) => {
      setFilterState({ cityId: city.id, value })
    },
    [city.id]
  )

  const filters = React.useMemo(() => {
    const out: { id: AtlasFilter; label: string }[] = [
      { id: "all", label: "All" },
      { id: "historic", label: city.eraFilterLabels.historic },
      { id: "classic", label: city.eraFilterLabels.classic },
      { id: "modern", label: city.eraFilterLabels.modern },
    ]
    if (city.eraFilterLabels.lost && city.heroes.some((h) => h.era === "lost")) {
      out.push({ id: "lost", label: city.eraFilterLabels.lost })
    }
    if (city.bridges.length > 0) {
      out.push({ id: "bridges", label: "Bridges" })
    }
    return out
  }, [city])

  const filteredHeroes = React.useMemo(() => {
    if (filter === "bridges") return []
    const list =
      filter === "all"
        ? [...city.heroes]
        : city.heroes.filter((h) => h.era === filter)
    return list.sort((a, b) => a.built - b.built)
  }, [city.heroes, filter])

  const filteredBridges = React.useMemo(() => {
    if (filter !== "all" && filter !== "bridges") return []
    return [...city.bridges].sort((a, b) => a.built - b.built)
  }, [city.bridges, filter])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[82dvh] flex flex-col overflow-hidden p-0 gap-0">
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary">
              <Compass className="size-4" aria-hidden="true" />
              <span className="text-xs font-medium text-muted-foreground">
                {city.name}, {city.waterbody} Elevation ({city.startYear} to{" "}
                {city.endYear})
              </span>
            </div>
            <DialogTitle className="skyline-serif text-2xl font-normal tracking-tight text-foreground mt-1">
              {city.name} Landmark Atlas
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Select any tower, monument, or crossing to glide the camera into
              its era.
            </DialogDescription>
          </DialogHeader>

          <div
            className="flex flex-wrap gap-1.5 mt-4"
            role="group"
            aria-label="Filter landmarks by era"
          >
            {filters.map((f) => {
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
                      onFlyTo(buildHeroTarget(city, h))
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
                    <span>{city.waterbody} Crossings</span>
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
                            {b.towerH} ft span
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
                          onFlyTo(buildBridgeTarget(city, b))
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
