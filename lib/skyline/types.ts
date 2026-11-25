import type { Rgb } from "./math"

export type CityId = "nyc" | "paris" | "london" | "tokyo" | "hongkong"

export type LandmarkEra = "historic" | "classic" | "modern" | "lost"

export type EraFilter = LandmarkEra | "all"

export type BackdropKind =
  | "palisades"
  | "montmartre"
  | "thames"
  | "fuji"
  | "victoria-peak"

export type BridgeStyle =
  | "stone"
  | "steel"
  | "canti"
  | "arch"
  | "towerbridge"
  | "truss"
  | "cablestay"

export type BuildingType =
  // NYC & Universal
  | "box"
  | "glass"
  | "stepped"
  | "waterfront"
  | "spire"
  | "beaux"
  | "penn"
  | "wall40"
  | "pine70"
  | "rock"
  | "w111"
  | "castle"
  | "liberty"
  | "flatiron"
  | "metlife"
  | "singer"
  | "woolworth"
  | "chrysler"
  | "esb"
  | "panam"
  | "twins"
  | "citi"
  | "bofa"
  | "owtc"
  | "p432"
  | "hy30"
  | "one57"
  | "vanderbilt"
  | "cpt"
  | "setback"
  | "taper"
  | "slab"
  | "faceted"
  | "pyramidcap"
  | "cylinder"
  // Paris
  | "eiffel"
  | "notredame"
  | "dome"
  | "triomphe"
  | "sacrecoeur"
  | "archcube"
  | "mansard"
  // London
  | "stpauls"
  | "bigben"
  | "ferris"
  | "gherkin"
  | "shard"
  | "walkie"
  | "cheesegrater"
  | "bt"
  | "battersea"
  // Tokyo
  | "pagoda"
  | "tokyotower"
  | "skytree"
  | "tmbg"
  | "cocoon"
  | "azabudai"
  // Hong Kong
  | "hsbc"
  | "boc"
  | "centralplaza"
  | "thecenter"
  | "ifc2"
  | "icc"

export interface Palette {
  top: Rgb
  mid: Rgb
  hor: Rgb
  bd: Rgb
  bdLit: Rgb
  wat: Rgb
  glow: Rgb
  sun: number
}

export interface PaletteStop extends Palette {
  p: number
}

export interface HeroLandmark {
  id: string
  name: string
  x: number
  w: number
  h: number
  built: number
  demo?: number
  ant?: number
  type: BuildingType
  era: LandmarkEra
  district: string
  architect: string
  summary: string
  layer?: "far" | "spine"
  cap?: string
  bye?: string
  beacon?: boolean
  crownGlow?: Rgb
  isHero: true
}

export interface District {
  a: number
  b: number
  w: number
  start: number
  peak: number
  maxH: number
  glass: number
  /** Optional building type bias for city character (e.g. mansard in Paris) */
  preferType?: BuildingType
}

export interface FillBuilding {
  id: string
  x: number
  w: number
  h: number
  built: number
  demo?: number
  type: BuildingType
  z: number
  win: number
  wt: boolean
  bh: boolean
  isHero: false
}

export interface BridgeDef {
  id: string
  name: string
  x: number
  span: number
  towerH: number
  deckH: number
  built: number
  style: BridgeStyle
  summary: string
  necklaceLights?: boolean
}

export type AnyBuilding = HeroLandmark | FillBuilding

export interface TimelineEvent {
  year: number
  text: string
}

export interface Milestone {
  year: number
  label: string
}

export interface TourLine {
  text?: string
  dim?: boolean
  statLabel?: string
  statValue?: string
}

export interface TourStop {
  id: string
  shortLabel: string
  subject: string
  landmarkId?: string
  x: number
  span: number
  ft: number
  align: "left" | "right" | "center"
  title: string
  eyebrow: string
  lines: TourLine[]
}

export interface EraBand {
  untilYear: number
  label: string
}

export interface SkyDome {
  wx: number
  rFactor: number
  strength: number
  tint?: Rgb
}

export interface CityConfig {
  id: CityId
  name: string
  nativeTitle: string
  country: string
  waterbody: string
  coordinates: string
  tagline: string
  startYear: number
  endYear: number
  expK: number
  islandFt: number
  finalSpan: number
  frames: readonly (readonly [number, number, number])[]
  backdrop: BackdropKind
  hasForests: boolean
  forestClearStart?: number
  hasCentralPark?: boolean
  hasPiers?: boolean
  hasTribute?: boolean
  hasFire1776?: boolean
  hasWaterTowers?: boolean
  skyglowDomes: readonly SkyDome[]
  eraBands: readonly EraBand[]
  nightEraLabel: string
  eraFilterLabels: {
    historic: string
    classic: string
    modern: string
    lost?: string
  }
  heroes: readonly HeroLandmark[]
  bridges: readonly BridgeDef[]
  districts: readonly District[]
  events: readonly TimelineEvent[]
  milestones: readonly Milestone[]
  tourStops: readonly TourStop[]
  fillSeed: number
}
