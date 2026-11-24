import {
  clamp,
  glide,
  lerp,
  mixRgb,
  monotoneSpline,
  norm,
  prng,
  type Rgb,
  smoothstep,
} from "./math"

export const INTRO_SECONDS = 25
export const FADE_SECONDS = 2.2
export const WRITE_TAIL = 2.6
export const GREETING_HOLD = 0.16

export const CFG = {
  islandFt: 70866,
  finalSpan: 0.72,
  smoothing: 0.11,
  arrival: 0.78,
} as const

// -----------------------------------------------------------------------------
// Timeline curve: smooth exponential acceleration 1609 -> 2026
// -----------------------------------------------------------------------------
const YEARS = [1609, 2026] as const
const EXP_K = 4.6
const EXP_S = Math.exp(EXP_K) - 1

function yearCurve(t: number): number {
  return Math.log(1 + t * EXP_S) / EXP_K
}

export function yearAt(p: number): number {
  const t = clamp(p, 0, CFG.arrival) / CFG.arrival
  const k = glide(t, 0.24)
  return YEARS[0] + (YEARS[1] - YEARS[0]) * yearCurve(k)
}

/** Inverse lookup (binary search) mapping any historical year back to p in [0, arrival]. */
export function progressAtYear(targetYear: number): number {
  const y = clamp(targetYear, YEARS[0], YEARS[1])
  let lo = 0
  let hi: number = CFG.arrival
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (yearAt(mid) < y) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

// -----------------------------------------------------------------------------
// Camera framing curve across Manhattan development
// -----------------------------------------------------------------------------
const FRAMES = [
  [1609, -0.012, 0.145],
  [1800, -0.014, 0.185],
  [1850, -0.015, 0.24],
  [1890, -0.018, 0.34],
  [1925, -0.018, 0.48],
  [1955, -0.018, 0.62],
  [1985, -0.016, 0.68],
  [2026, -0.016, 0.704],
] as const

const fYears = FRAMES.map((f) => f[0])
const x0Of = monotoneSpline(
  fYears,
  FRAMES.map((f) => f[1])
)
const x1Of = monotoneSpline(
  fYears,
  FRAMES.map((f) => f[2])
)

export function frameAt(year: number): { x0: number; x1: number } {
  return { x0: x0Of(year), x1: x1Of(year) }
}

// -----------------------------------------------------------------------------
// Diurnal Atmospheric Palette (10 stops across 417 years)
// -----------------------------------------------------------------------------
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

interface PaletteStop extends Palette {
  p: number
}

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
    hor: [244, 142, 84],
    bd: [32, 30, 50],
    bdLit: [152, 92, 74],
    wat: [38, 38, 66],
    glow: [250, 144, 82],
    sun: 0.08,
  },
  {
    p: 0.74,
    top: [19, 24, 58],
    mid: [62, 46, 86],
    hor: [188, 98, 92],
    bd: [20, 22, 40],
    bdLit: [88, 56, 68],
    wat: [20, 24, 48],
    glow: [218, 120, 86],
    sun: -0.05,
  },
  {
    p: 0.83,
    top: [11, 16, 40],
    mid: [24, 32, 66],
    hor: [68, 64, 96],
    bd: [15, 20, 38],
    bdLit: [44, 48, 76],
    wat: [12, 18, 40],
    glow: [232, 168, 102],
    sun: -0.18,
  },
  {
    p: 0.92,
    top: [8, 12, 32],
    mid: [16, 22, 50],
    hor: [38, 44, 74],
    bd: [12, 16, 32],
    bdLit: [36, 42, 68],
    wat: [9, 14, 34],
    glow: [242, 182, 112],
    sun: -0.26,
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
// Building & Landmark Catalog (28 Iconic Landmarks + 5 Bridges)
// -----------------------------------------------------------------------------
export type BuildingType =
  | "box"
  | "glass"
  | "spire"
  | "dome"
  | "beaux"
  | "singer"
  | "metlife"
  | "woolworth"
  | "penn"
  | "chrysler"
  | "esb"
  | "rock"
  | "panam"
  | "twins"
  | "citi"
  | "one57"
  | "owtc"
  | "p432"
  | "hy30"
  | "w111"
  | "cpt"
  | "flatiron"
  | "vanderbilt"
  | "bofa"
  | "wall40"
  | "pine70"
  | "liberty"

export type LandmarkEra = "historic" | "art-deco" | "modern" | "lost"

export interface HeroLandmark {
  id: string
  name: string
  district: string
  architect: string
  era: LandmarkEra
  summary: string
  x: number
  w: number
  h: number
  built: number
  demo?: number
  type: BuildingType
  layer?: "far" | "spine"
  ant?: number
  cap?: string
  bye?: string
  beacon?: boolean
  crownGlow?: Rgb
  isHero: true
  z: number
  win: number
}

export interface FillBuilding {
  id: string
  x: number
  w: number
  h: number
  z: number
  built: number
  demo?: number
  type: "box" | "glass"
  wt: boolean
  bh: boolean
  win: number
  isHero: false
}

export type AnyBuilding = HeroLandmark | FillBuilding

export const HEROES: readonly HeroLandmark[] = [
  {
    id: "trinity",
    name: "Trinity Church",
    district: "Financial District",
    architect: "Richard Upjohn",
    era: "historic",
    summary:
      "Manhattan's tallest structure for 44 years, anchoring Wall Street in Gothic Revival brownstone.",
    x: 0.044,
    w: 0.0044,
    h: 281,
    built: 1846,
    type: "spire",
    cap: "1846 — Trinity Church, tallest in New York",
    isHero: true,
    z: 0.62,
    win: 0.4,
  },
  {
    id: "liberty",
    name: "Statue of Liberty",
    district: "Upper New York Bay",
    architect: "Frédéric Auguste Bartholdi & Gustave Eiffel",
    era: "historic",
    summary:
      "Gifted by France and dedicated in 1886, holding a copper torch over New York Harbor.",
    x: -0.006,
    w: 0.0046,
    h: 305,
    built: 1886,
    type: "liberty",
    layer: "far",
    cap: "1886 — Liberty Enlightening the World",
    crownGlow: [255, 206, 120],
    isHero: true,
    z: 0.35,
    win: 0.2,
  },
  {
    id: "world",
    name: "New York World Building",
    district: "Park Row",
    architect: "George B. Post",
    era: "lost",
    summary:
      "Joseph Pulitzer's gilded-dome headquarters, briefly the tallest building in the world before demolition for the Brooklyn Bridge ramps.",
    x: 0.068,
    w: 0.006,
    h: 309,
    built: 1890,
    demo: 1955,
    type: "dome",
    cap: "1890 — Pulitzer's World Building",
    isHero: true,
    z: 0.58,
    win: 0.55,
  },
  {
    id: "parkrow",
    name: "Park Row Building",
    district: "Civic Center",
    architect: "R. H. Robertson",
    era: "historic",
    summary:
      "Twin Beaux-Arts cupolas that claimed the title of world's tallest office tower from 1899 to 1908.",
    x: 0.062,
    w: 0.0062,
    h: 391,
    built: 1899,
    type: "beaux",
    cap: "1899 — Park Row Building",
    isHero: true,
    z: 0.56,
    win: 0.62,
  },
  {
    id: "flatiron",
    name: "Flatiron Building",
    district: "Madison Square",
    architect: "Daniel Burnham",
    era: "historic",
    summary:
      "A 22-story steel-framed triangular prow sailing north up Fifth Avenue and Broadway.",
    x: 0.268,
    w: 0.0042,
    h: 285,
    built: 1902,
    type: "flatiron",
    cap: "1902 — The Flatiron Building",
    isHero: true,
    z: 0.52,
    win: 0.68,
  },
  {
    id: "singer",
    name: "Singer Building",
    district: "Lower Manhattan",
    architect: "Ernest Flagg",
    era: "lost",
    summary:
      "A slender Beaux-Arts lantern tower demolished in 1968—for decades the tallest building ever peacefully taken down.",
    x: 0.049,
    w: 0.0056,
    h: 612,
    built: 1908,
    demo: 1968,
    type: "singer",
    cap: "1908 — Singer Building, tallest in the world",
    bye: "1968 — Singer Building demolished",
    isHero: true,
    z: 0.64,
    win: 0.72,
  },
  {
    id: "metlife",
    name: "Metropolitan Life Tower",
    district: "Madison Square",
    architect: "Napoleon LeBrun & Sons",
    era: "historic",
    summary:
      "Modeled after St. Mark's Campanile in Venice, crowned with a glowing clock lantern overlooking Madison Square.",
    x: 0.278,
    w: 0.0052,
    h: 700,
    built: 1909,
    type: "metlife",
    cap: "1909 — Metropolitan Life Tower",
    crownGlow: [255, 224, 168],
    isHero: true,
    z: 0.65,
    win: 0.75,
  },
  {
    id: "penn",
    name: "Original Penn Station",
    district: "Midtown West",
    architect: "McKim, Mead & White",
    era: "lost",
    summary:
      "A pink-granite Roman bathhouse of a rail concourse whose 1963 demolition sparked the modern preservation movement.",
    x: 0.312,
    w: 0.017,
    h: 150,
    built: 1910,
    demo: 1963,
    type: "penn",
    layer: "far",
    bye: "1963 — Penn Station demolished",
    isHero: true,
    z: 0.28,
    win: 0.52,
  },
  {
    id: "woolworth",
    name: "Woolworth Building",
    district: "Tribeca / Civic Center",
    architect: "Cass Gilbert",
    era: "historic",
    summary:
      "The Cathedral of Commerce—glazed white terracotta Gothic tracery rising 792 feet above City Hall Park.",
    x: 0.06,
    w: 0.0074,
    h: 792,
    built: 1913,
    type: "woolworth",
    cap: "1913 — The Woolworth Building",
    crownGlow: [255, 228, 178],
    isHero: true,
    z: 0.68,
    win: 0.78,
  },
  {
    id: "wall40",
    name: "40 Wall Street",
    district: "Financial District",
    architect: "H. Craig Severance",
    era: "art-deco",
    summary:
      "Completed in eleven months in the 1930 race for the sky, topped with a verdigris pyramidal crown.",
    x: 0.031,
    w: 0.0066,
    h: 927,
    built: 1930,
    type: "wall40",
    crownGlow: [188, 232, 214],
    isHero: true,
    z: 0.66,
    win: 0.76,
  },
  {
    id: "chrysler",
    name: "Chrysler Building",
    district: "Midtown East",
    architect: "William Van Alen",
    era: "art-deco",
    summary:
      "Art Deco perfected: a riveted Nirosta steel sunburst crown secretly assembled inside the shaft to beat 40 Wall Street.",
    x: 0.371,
    w: 0.0072,
    h: 1046,
    built: 1930,
    type: "chrysler",
    cap: "1930 — The Chrysler Building",
    crownGlow: [255, 240, 206],
    beacon: true,
    isHero: true,
    z: 0.76,
    win: 0.86,
  },
  {
    id: "esb",
    name: "Empire State Building",
    district: "Midtown South",
    architect: "Shreve, Lamb & Harmon",
    era: "art-deco",
    summary:
      "Built in 410 days during the Great Depression, holding the world's tallest record for nearly four decades.",
    x: 0.33,
    w: 0.0112,
    h: 1454,
    built: 1931,
    type: "esb",
    cap: "1931 — The Empire State Building",
    crownGlow: [255, 224, 162],
    beacon: true,
    isHero: true,
    z: 0.82,
    win: 0.9,
  },
  {
    id: "pine70",
    name: "70 Pine Street",
    district: "Financial District",
    architect: "Clinton & Russell",
    era: "art-deco",
    summary:
      "Downtown's slender Art Deco skyscraper, tapering into an illuminated glass-and-steel lantern pinnacle.",
    x: 0.024,
    w: 0.006,
    h: 952,
    built: 1932,
    type: "pine70",
    crownGlow: [255, 228, 174],
    isHero: true,
    z: 0.62,
    win: 0.74,
  },
  {
    id: "rock",
    name: "30 Rockefeller Plaza",
    district: "Midtown",
    architect: "Raymond Hood",
    era: "art-deco",
    summary:
      "A limestone slab sculpted by setback daylight laws, anchoring the urban core of Rockefeller Center.",
    x: 0.405,
    w: 0.0094,
    h: 850,
    built: 1933,
    type: "rock",
    cap: "1933 — Rockefeller Center",
    crownGlow: [255, 226, 176],
    isHero: true,
    z: 0.68,
    win: 0.82,
  },
  {
    id: "seagram",
    name: "Seagram Building",
    district: "Park Avenue",
    architect: "Mies van der Rohe & Philip Johnson",
    era: "modern",
    summary:
      "Bronze-clad International Style minimalism set back behind a serene travertine granite plaza.",
    x: 0.422,
    w: 0.0062,
    h: 515,
    built: 1958,
    type: "glass",
    cap: "1958 — The Seagram Building",
    isHero: true,
    z: 0.66,
    win: 0.84,
  },
  {
    id: "panam",
    name: "MetLife (Pan Am) Building",
    district: "Midtown East",
    architect: "Emery Roth, Walter Gropius & Pietro Belluschi",
    era: "modern",
    summary:
      "An octagonal Brutalist-Modernist slab straddling Park Avenue immediately above Grand Central Terminal.",
    x: 0.382,
    w: 0.0114,
    h: 808,
    built: 1963,
    type: "panam",
    cap: "1963 — Pan Am Building",
    isHero: true,
    z: 0.72,
    win: 0.84,
  },
  {
    id: "wtc1",
    name: "World Trade Center (North)",
    district: "Lower Manhattan",
    architect: "Minoru Yamasaki",
    era: "lost",
    summary:
      "One of the iconic aluminum-sheathed Twin Towers, crowned with a 360-foot broadcast spire until September 11, 2001.",
    x: 0.046,
    w: 0.0096,
    h: 1368,
    built: 1971,
    demo: 2001,
    type: "twins",
    ant: 360,
    cap: "1973 — The World Trade Center",
    beacon: true,
    isHero: true,
    z: 0.8,
    win: 0.88,
  },
  {
    id: "wtc2",
    name: "World Trade Center (South)",
    district: "Lower Manhattan",
    architect: "Minoru Yamasaki",
    era: "lost",
    summary:
      "Twin to the North Tower, featuring the open-air Top of the World observatory overlooking New York Harbor.",
    x: 0.036,
    w: 0.0096,
    h: 1362,
    built: 1973,
    demo: 2001,
    type: "twins",
    isHero: true,
    z: 0.78,
    win: 0.88,
  },
  {
    id: "citicorp",
    name: "Citicorp Center",
    district: "Midtown East",
    architect: "Hugh Stubbins & William LeMessurier",
    era: "modern",
    summary:
      "Unmistakable 45-degree sloped aluminum crown balanced nine stories above the street on four colossal columns.",
    x: 0.434,
    w: 0.008,
    h: 915,
    built: 1977,
    type: "citi",
    cap: "1977 — Citicorp Center",
    crownGlow: [236, 242, 255],
    isHero: true,
    z: 0.74,
    win: 0.84,
  },
  {
    id: "bofa",
    name: "Bank of America Tower",
    district: "Bryant Park",
    architect: "CookFox Architects",
    era: "modern",
    summary:
      "Faceted crystalline glass planes rising 1,200 feet beside Bryant Park with a luminous diagonal spire.",
    x: 0.36,
    w: 0.0082,
    h: 1200,
    built: 2009,
    type: "bofa",
    layer: "far",
    crownGlow: [204, 228, 255],
    beacon: true,
    isHero: true,
    z: 0.48,
    win: 0.85,
  },
  {
    id: "one57",
    name: "One57",
    district: "Billionaires' Row",
    architect: "Christian de Portzamparc",
    era: "modern",
    summary:
      "A cascading blue-glass waterfall tower that inaugurated the supertall corridor along 57th Street.",
    x: 0.453,
    w: 0.0056,
    h: 1005,
    built: 2014,
    type: "one57",
    beacon: true,
    isHero: true,
    z: 0.68,
    win: 0.78,
  },
  {
    id: "owtc",
    name: "One World Trade Center",
    district: "Lower Manhattan",
    architect: "David Childs (SOM)",
    era: "modern",
    summary:
      "Eight shimmering equilateral glass triangles tapering to a symbolic 1,776-foot spire and rotating beacon.",
    x: 0.044,
    w: 0.0098,
    h: 1776,
    built: 2014,
    type: "owtc",
    cap: "2014 — One World Trade Center",
    crownGlow: [212, 234, 255],
    beacon: true,
    isHero: true,
    z: 0.86,
    win: 0.9,
  },
  {
    id: "p432",
    name: "432 Park Avenue",
    district: "Midtown East",
    architect: "Rafael Viñoly",
    era: "modern",
    summary:
      "A pure concrete grid pencil tower punctuated by open double-height wind floors glowing softly at night.",
    x: 0.445,
    w: 0.0044,
    h: 1396,
    built: 2015,
    type: "p432",
    cap: "2015 — Billionaires' Row",
    beacon: true,
    isHero: true,
    z: 0.78,
    win: 0.82,
  },
  {
    id: "hy30",
    name: "30 Hudson Yards",
    district: "Hudson Yards",
    architect: "Kohn Pedersen Fox",
    era: "modern",
    summary:
      "Sloped glass crown and the cantilevered Edge triangular sky deck suspended 1,100 feet over the West Side.",
    x: 0.305,
    w: 0.0082,
    h: 1270,
    built: 2019,
    type: "hy30",
    layer: "far",
    cap: "2019 — Hudson Yards",
    crownGlow: [210, 228, 255],
    beacon: true,
    isHero: true,
    z: 0.42,
    win: 0.84,
  },
  {
    id: "hy15",
    name: "15 Hudson Yards",
    district: "Hudson Yards",
    architect: "Diller Scofidio + Renfro",
    era: "modern",
    summary:
      "A four-lobed residential glass tower curving smoothly from a square base to a cloverleaf crown.",
    x: 0.294,
    w: 0.006,
    h: 912,
    built: 2019,
    type: "glass",
    layer: "far",
    isHero: true,
    z: 0.38,
    win: 0.8,
  },
  {
    id: "vanderbilt",
    name: "One Vanderbilt",
    district: "Midtown East",
    architect: "Kohn Pedersen Fox",
    era: "modern",
    summary:
      "Terracotta-ribbed setbacks and a crystalline pinnacle standing shoulder to shoulder with Chrysler and Grand Central.",
    x: 0.388,
    w: 0.0076,
    h: 1401,
    built: 2020,
    type: "vanderbilt",
    cap: "2020 — One Vanderbilt",
    crownGlow: [252, 236, 206],
    beacon: true,
    isHero: true,
    z: 0.8,
    win: 0.88,
  },
  {
    id: "w111",
    name: "111 West 57th Street",
    district: "Billionaires' Row",
    architect: "SHoP Architects",
    era: "modern",
    summary:
      "The most slender skyscraper in the world (24:1 ratio), feathering upward in bronze and glazed terracotta.",
    x: 0.459,
    w: 0.003,
    h: 1428,
    built: 2021,
    type: "w111",
    crownGlow: [255, 228, 178],
    beacon: true,
    isHero: true,
    z: 0.74,
    win: 0.78,
  },
  {
    id: "cpt",
    name: "Central Park Tower",
    district: "Billionaires' Row",
    architect: "Adrian Smith + Gordon Gill",
    era: "modern",
    summary:
      "At 1,550 feet, the tallest residential building on earth, canted over the southern edge of Central Park.",
    x: 0.466,
    w: 0.0056,
    h: 1550,
    built: 2021,
    type: "cpt",
    cap: "2021 — Central Park Tower",
    crownGlow: [224, 238, 255],
    beacon: true,
    isHero: true,
    z: 0.84,
    win: 0.84,
  },
]

export interface BridgeDef {
  id: string
  name: string
  x: number
  span: number
  towerH: number
  deckH: number
  built: number
  style: "stone" | "truss" | "steel" | "canti"
  necklaceLights?: boolean
  summary: string
}

export const BRIDGES: readonly BridgeDef[] = [
  {
    id: "brooklyn",
    name: "Brooklyn Bridge",
    x: 0.067,
    span: 0.044,
    towerH: 276,
    deckH: 135,
    built: 1883,
    style: "stone",
    necklaceLights: true,
    summary:
      "John & Washington Roebling's limestone Gothic arches and diagonal steel stays linking Manhattan and Brooklyn.",
  },
  {
    id: "manhattan",
    name: "Manhattan Bridge",
    x: 0.088,
    span: 0.04,
    towerH: 322,
    deckH: 134,
    built: 1909,
    style: "steel",
    necklaceLights: true,
    summary:
      "Leon Moisseiff's pioneering deflection-theory steel suspension bridge carrying subway tracks across the East River.",
  },
  {
    id: "williamsburg",
    name: "Williamsburg Bridge",
    x: 0.145,
    span: 0.042,
    towerH: 310,
    deckH: 135,
    built: 1903,
    style: "truss",
    necklaceLights: true,
    summary:
      "The first major suspension bridge built with all-steel towers, opening the Lower East Side to Brooklyn.",
  },
  {
    id: "queensboro",
    name: "Queensboro Bridge",
    x: 0.465,
    span: 0.048,
    towerH: 345,
    deckH: 135,
    built: 1909,
    style: "canti",
    summary:
      "Double-cantilever steel latticework leaping over Roosevelt Island at 59th Street.",
  },
  {
    id: "triborough",
    name: "RFK / Triborough Bridge",
    x: 0.698,
    span: 0.044,
    towerH: 315,
    deckH: 143,
    built: 1936,
    style: "steel",
    necklaceLights: true,
    summary:
      "Art Deco suspension bridge tying Manhattan, Queens, and the Bronx together across Hell Gate.",
  },
]

export const EVENTS = [
  { year: 1609, text: "Manahatta, before the grid" },
  { year: 1624, text: "New Amsterdam" },
  { year: 1664, text: "New York" },
  { year: 1776, text: "The Great Fire" },
  { year: 1811, text: "The Commissioners' Grid" },
  { year: 1858, text: "Central Park" },
  { year: 1883, text: "The Brooklyn Bridge" },
  { year: 1904, text: "The Subway opens" },
  { year: 2001, text: "Tribute in Light" },
  { year: 2026, text: "Manhattan at night" },
] as const

export interface TimelineMilestone {
  year: number
  label: string
  era: string
}

export const MILESTONES: readonly TimelineMilestone[] = [
  { year: 1609, label: "1609", era: "Manahatta" },
  { year: 1883, label: "1883", era: "Brooklyn Bridge" },
  { year: 1931, label: "1931", era: "Empire State" },
  { year: 1973, label: "1973", era: "Twin Towers" },
  { year: 2001, label: "2001", era: "Tribute in Light" },
  { year: 2026, label: "2026", era: "Night Horizon" },
]

export function eraLabelForYear(year: number, touring: boolean): string {
  if (touring) return "Nocturnal Tour"
  if (year < 1664) return "Lenape & Dutch Shore"
  if (year < 1811) return "Colonial Harbor"
  if (year < 1883) return "The Commissioners' Grid"
  if (year < 1925) return "Steel & Steam"
  if (year < 1955) return "Art Deco Sky"
  if (year < 2001) return "Modernist Skyline"
  if (year < 2012) return "Memory & Renewal"
  return "Supertall Horizon"
}

// -----------------------------------------------------------------------------
// Procedural City Fill across 8 Manhattan Districts
// -----------------------------------------------------------------------------
const DISTRICTS = [
  { a: 0.0, b: 0.085, w: 22, start: 1624, peak: 1925, maxH: 740, glass: 1962 },
  { a: 0.085, b: 0.21, w: 14, start: 1790, peak: 1915, maxH: 220, glass: 1985 },
  { a: 0.21, b: 0.3, w: 11, start: 1845, peak: 1930, maxH: 360, glass: 1995 },
  { a: 0.3, b: 0.48, w: 30, start: 1875, peak: 1965, maxH: 820, glass: 1958 },
  { a: 0.48, b: 0.65, w: 12, start: 1880, peak: 1955, maxH: 330, glass: 1975 },
  { a: 0.65, b: 0.8, w: 8, start: 1895, peak: 1960, maxH: 200, glass: 1990 },
  { a: 0.8, b: 0.93, w: 5, start: 1905, peak: 1965, maxH: 170, glass: 2000 },
  { a: 0.93, b: 1.0, w: 2, start: 1910, peak: 1965, maxH: 130, glass: 2005 },
] as const

export function buildFill(count: number): FillBuilding[] {
  const r = prng(407128)
  const totalW = DISTRICTS.reduce((s, d) => s + d.w, 0)
  const out: FillBuilding[] = []
  let idx = 0

  for (const d of DISTRICTS) {
    const n = Math.max(4, Math.round((count * d.w) / totalW))
    for (let i = 0; i < n; i++) {
      const x = d.a + r() * (d.b - d.a)
      const z = r()
      const t = Math.pow(r(), 1.32)
      const built = Math.round(d.start + t * (2024 - d.start))
      let cap = 35
      if (built > 1790) cap = 68
      if (built > 1865) cap = 155
      if (built > 1895) cap = 385
      if (built > 1920) cap = d.maxH
      if (built > 1955) cap = d.maxH * 1.1
      const h = Math.max(24, cap * (0.18 + Math.pow(r(), 1.85) * 0.82))
      const w = (0.002 + r() * 0.0046) * (h > 340 ? 1.24 : 0.86)
      const glass = built > d.glass && h > 185 && r() > 0.34
      let demo: number | undefined
      if (built < 1885 && r() < 0.62) {
        demo = Math.min(2020, built + 55 + Math.round(r() * 85))
      } else if (built < 1925 && h < 180 && r() < 0.25) {
        demo = Math.min(2022, built + 45 + Math.round(r() * 65))
      }
      out.push({
        id: `fill-${idx++}`,
        x,
        w,
        h,
        z,
        built,
        demo,
        type: glass ? "glass" : "box",
        wt: !glass && h > 82 && h < 420 && r() < 0.32,
        bh: h > 110 && r() < 0.45,
        win: r(),
        isHero: false,
      })
    }
  }
  out.sort((a, b) => a.z - b.z)
  return out
}

// -----------------------------------------------------------------------------
// Architectural Silhouettes (normalized u in [-0.5, 0.5], v in [0, 1])
// -----------------------------------------------------------------------------
export function profileOf(type: BuildingType): readonly (readonly [number, number])[] {
  switch (type) {
    case "spire":
      return [
        [-0.5, 0],
        [-0.5, 0.34],
        [-0.25, 0.34],
        [-0.22, 0.58],
        [-0.08, 0.78],
        [0, 1],
        [0.08, 0.78],
        [0.22, 0.58],
        [0.25, 0.34],
        [0.5, 0.34],
        [0.5, 0],
      ]
    case "liberty":
      return [
        [-0.48, 0],
        [-0.44, 0.22],
        [-0.32, 0.24],
        [-0.28, 0.48],
        [-0.22, 0.5],
        [-0.18, 0.72],
        [-0.1, 0.78],
        [-0.04, 0.85],
        [0.08, 0.86],
        [0.14, 1.0],
        [0.18, 0.99],
        [0.14, 0.78],
        [0.2, 0.7],
        [0.22, 0.5],
        [0.28, 0.48],
        [0.32, 0.24],
        [0.44, 0.22],
        [0.48, 0],
      ]
    case "dome":
      return [
        [-0.5, 0],
        [-0.5, 0.72],
        [-0.32, 0.76],
        [-0.2, 0.89],
        [-0.08, 0.96],
        [0, 1],
        [0.08, 0.96],
        [0.2, 0.89],
        [0.32, 0.76],
        [0.5, 0.72],
        [0.5, 0],
      ]
    case "beaux":
      return [
        [-0.5, 0],
        [-0.5, 0.76],
        [-0.44, 0.8],
        [-0.44, 0.9],
        [-0.32, 1],
        [-0.2, 0.9],
        [-0.2, 0.8],
        [0.2, 0.8],
        [0.2, 0.9],
        [0.32, 1],
        [0.44, 0.9],
        [0.44, 0.8],
        [0.5, 0.76],
        [0.5, 0],
      ]
    case "flatiron":
      return [
        [-0.5, 0],
        [-0.46, 0.88],
        [-0.52, 0.92],
        [-0.48, 0.98],
        [0.48, 0.98],
        [0.52, 0.92],
        [0.46, 0.88],
        [0.5, 0],
      ]
    case "singer":
      return [
        [-0.5, 0],
        [-0.5, 0.34],
        [-0.25, 0.34],
        [-0.25, 0.82],
        [-0.17, 0.89],
        [-0.04, 0.94],
        [0, 1],
        [0.04, 0.94],
        [0.17, 0.89],
        [0.25, 0.82],
        [0.25, 0.34],
        [0.5, 0.34],
        [0.5, 0],
      ]
    case "metlife":
      return [
        [-0.42, 0],
        [-0.42, 0.76],
        [-0.36, 0.78],
        [-0.22, 0.91],
        [-0.08, 0.96],
        [0, 1],
        [0.08, 0.96],
        [0.22, 0.91],
        [0.36, 0.78],
        [0.42, 0.76],
        [0.42, 0],
      ]
    case "woolworth":
      return [
        [-0.5, 0],
        [-0.5, 0.5],
        [-0.32, 0.5],
        [-0.32, 0.74],
        [-0.27, 0.81],
        [-0.22, 0.74],
        [-0.17, 0.86],
        [0, 1],
        [0.17, 0.86],
        [0.22, 0.74],
        [0.27, 0.81],
        [0.32, 0.74],
        [0.32, 0.5],
        [0.5, 0.5],
        [0.5, 0],
      ]
    case "penn":
      return [
        [-0.5, 0],
        [-0.5, 0.54],
        [-0.3, 0.54],
        [-0.3, 0.9],
        [-0.15, 0.98],
        [0.15, 0.98],
        [0.3, 0.9],
        [0.3, 0.54],
        [0.5, 0.54],
        [0.5, 0],
      ]
    case "wall40":
      return [
        [-0.5, 0],
        [-0.5, 0.44],
        [-0.38, 0.44],
        [-0.38, 0.66],
        [-0.26, 0.66],
        [-0.26, 0.8],
        [-0.06, 0.94],
        [0, 1],
        [0.06, 0.94],
        [0.26, 0.8],
        [0.26, 0.66],
        [0.38, 0.66],
        [0.38, 0.44],
        [0.5, 0.44],
        [0.5, 0],
      ]
    case "pine70":
      return [
        [-0.5, 0],
        [-0.5, 0.38],
        [-0.36, 0.38],
        [-0.36, 0.62],
        [-0.24, 0.62],
        [-0.24, 0.78],
        [-0.13, 0.83],
        [-0.08, 0.92],
        [0, 1],
        [0.08, 0.92],
        [0.13, 0.83],
        [0.24, 0.78],
        [0.24, 0.62],
        [0.36, 0.62],
        [0.36, 0.38],
        [0.5, 0.38],
        [0.5, 0],
      ]
    case "chrysler":
      return [
        [-0.5, 0],
        [-0.5, 0.26],
        [-0.38, 0.26],
        [-0.38, 0.58],
        [-0.28, 0.62],
        [-0.25, 0.71],
        [-0.2, 0.77],
        [-0.14, 0.83],
        [-0.08, 0.88],
        [-0.03, 0.91],
        [0, 1],
        [0.03, 0.91],
        [0.08, 0.88],
        [0.14, 0.83],
        [0.2, 0.77],
        [0.25, 0.71],
        [0.28, 0.62],
        [0.38, 0.58],
        [0.38, 0.26],
        [0.5, 0.26],
        [0.5, 0],
      ]
    case "esb":
      return [
        [-0.5, 0],
        [-0.5, 0.14],
        [-0.4, 0.14],
        [-0.4, 0.27],
        [-0.31, 0.27],
        [-0.31, 0.69],
        [-0.23, 0.69],
        [-0.23, 0.76],
        [-0.15, 0.76],
        [-0.15, 0.82],
        [-0.07, 0.84],
        [-0.03, 0.88],
        [0, 1],
        [0.03, 0.88],
        [0.07, 0.84],
        [0.15, 0.82],
        [0.15, 0.76],
        [0.23, 0.76],
        [0.23, 0.69],
        [0.31, 0.69],
        [0.31, 0.27],
        [0.4, 0.27],
        [0.4, 0.14],
        [0.5, 0.14],
        [0.5, 0],
      ]
    case "rock":
      return [
        [-0.5, 0],
        [-0.5, 0.52],
        [-0.39, 0.52],
        [-0.39, 0.76],
        [-0.28, 0.76],
        [-0.28, 1],
        [0.28, 1],
        [0.28, 0.76],
        [0.39, 0.76],
        [0.39, 0.52],
        [0.5, 0.52],
        [0.5, 0],
      ]
    case "panam":
      return [
        [-0.5, 0],
        [-0.5, 0.96],
        [-0.36, 1],
        [0.36, 1],
        [0.5, 0.96],
        [0.5, 0],
      ]
    case "citi":
      return [
        [-0.46, 0],
        [-0.46, 0.84],
        [0.46, 1],
        [0.46, 0],
      ]
    case "bofa":
      return [
        [-0.48, 0],
        [-0.48, 0.64],
        [-0.34, 0.78],
        [-0.12, 0.86],
        [0.08, 0.86],
        [0.12, 1],
        [0.16, 0.84],
        [0.42, 0.74],
        [0.48, 0.56],
        [0.48, 0],
      ]
    case "one57":
      return [
        [-0.48, 0],
        [-0.48, 0.82],
        [-0.34, 0.88],
        [-0.18, 0.94],
        [0.18, 1],
        [0.48, 1],
        [0.48, 0],
      ]
    case "owtc":
      return [
        [-0.5, 0],
        [-0.36, 0.77],
        [-0.03, 0.77],
        [0, 1],
        [0.03, 0.77],
        [0.36, 0.77],
        [0.5, 0],
      ]
    case "hy30":
      return [
        [-0.48, 0],
        [-0.48, 0.82],
        [-0.86, 0.84],
        [-0.48, 0.88],
        [-0.48, 0.9],
        [0.48, 1],
        [0.48, 0],
      ]
    case "vanderbilt":
      return [
        [-0.5, 0],
        [-0.5, 0.52],
        [-0.4, 0.56],
        [-0.4, 0.74],
        [-0.26, 0.8],
        [-0.14, 0.88],
        [-0.03, 0.92],
        [0, 1],
        [0.03, 0.92],
        [0.14, 0.88],
        [0.26, 0.8],
        [0.4, 0.74],
        [0.4, 0.56],
        [0.5, 0.52],
        [0.5, 0],
      ]
    case "w111":
      return [
        [-0.5, 0],
        [-0.5, 0.58],
        [-0.4, 0.68],
        [-0.3, 0.78],
        [-0.2, 0.88],
        [-0.1, 0.96],
        [0.5, 1],
        [0.5, 0],
      ]
    case "cpt":
      return [
        [-0.48, 0],
        [-0.48, 0.62],
        [-0.38, 0.64],
        [-0.38, 0.88],
        [-0.24, 0.9],
        [-0.24, 1],
        [0.48, 1],
        [0.48, 0],
      ]
    default:
      return [
        [-0.5, 0],
        [-0.5, 1],
        [0.5, 1],
        [0.5, 0],
      ]
  }
}

// -----------------------------------------------------------------------------
// Interactive Nocturnal Tour (5 Curated Manhattan Stops + Brandon's Story)
// -----------------------------------------------------------------------------
export const GREETING = {
  x: 0.33 + 0.0022,
  ft: 865,
} as const

export type StoryIconKey =
  | "code"
  | "trophy"
  | "footprints"
  | "cake"
  | "guitar"
  | "watch"
  | "briefcase"

export interface TourLine {
  text: string
  dim?: boolean
  icon?: StoryIconKey
  linkLabel?: string
  href?: string
  org?: string
  period?: string
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
  title?: string
  subtitle?: string
  lines: readonly TourLine[]
  cta?: {
    label: string
    href: string
  }
}

export const TOUR_STOPS: readonly TourStop[] = [
  {
    id: "empire-state",
    shortLabel: "Empire State",
    subject: "The Empire State Building, 1,454 ft",
    landmarkId: "esb",
    x: 0.33,
    span: 0.145,
    ft: 720,
    align: "right",
    lines: [
      {
        text: "Cities aren\u2019t built in a day, but truly great cities take vision, ambition, energy, and focus.",
      },
      {
        text: "So does everything worthwhile in life.",
        dim: true,
      },
    ],
  },
  {
    id: "chrysler",
    shortLabel: "Chrysler",
    subject: "The Chrysler Building, 1,046 ft",
    landmarkId: "chrysler",
    x: 0.371,
    span: 0.165,
    ft: 540,
    align: "left",
    title: "About me",
    lines: [
      { icon: "code", text: "Software engineer" },
      { icon: "trophy", text: "Tennis player" },
      { icon: "footprints", text: "Marathoner, ex-rower" },
      {
        icon: "cake",
        text: "Tiramisu World Cup competitor, Canada semi-finalist",
      },
      {
        icon: "guitar",
        text: "Beginner guitarist, scuba diver, snowboarder",
      },
    ],
  },
  {
    id: "metlife",
    shortLabel: "MetLife Tower",
    subject: "Metropolitan Life Tower, 700 ft",
    landmarkId: "metlife",
    x: 0.278,
    span: 0.175,
    ft: 380,
    align: "right",
    title: "Watches",
    lines: [
      {
        icon: "watch",
        text: "I collect watches, mostly vintage: a few hundred tiny parts agreeing to keep time for fifty years without a battery.",
      },
      {
        text: "Follow the collection at",
        linkLabel: "@watcheswbrandon",
        href: "https://instagram.com/watcheswbrandon",
      },
    ],
  },
  {
    id: "one-wtc",
    shortLabel: "One WTC",
    subject: "One World Trade Center, 1,776 ft",
    landmarkId: "owtc",
    x: 0.044,
    span: 0.175,
    ft: 860,
    align: "right",
    title: "Work",
    lines: [
      {
        org: "LinkedIn",
        text: "Software Engineer",
        period: "2022–Present",
      },
      {
        org: "Hearth",
        text: "Full-Stack Software Engineer Intern",
        period: "2022",
      },
      {
        org: "8VC",
        text: "Engineering Fellow",
        period: "2022",
        href: "https://www.8vc.com/fellowships",
      },
      {
        org: "LinkedIn",
        text: "Software Engineer Intern",
        period: "2021",
      },
      {
        org: "smoodi",
        text: "Founding Engineer, Boston",
        period: "2019–2020",
      },
    ],
  },
  {
    id: "horizon",
    shortLabel: "Horizon",
    subject: "Manhattan Night Horizon, 2026",
    x: 0.344,
    span: 0.72,
    ft: 580,
    align: "center",
    title: "Always happy to meet new people.",
    lines: [
      {
        text: "Built along the East River silhouette from 1609 to 2026.",
        dim: true,
      },
    ],
    cta: {
      label: "Reach out on LinkedIn",
      href: "https://www.linkedin.com/in/brandon-lai",
    },
  },
]

const STOP_SPAN = 1 / TOUR_STOPS.length

export interface TourSample {
  from: number
  index: number
  move: number
  greet: number
  subject: string
  activeIndex: number
  opacities: number[]
}

export function sampleTour(q: number): TourSample {
  const n = TOUR_STOPS.length
  const k = clamp(q, 0, 1)
  const raw = k * n
  const idx = Math.min(n - 1, Math.floor(raw))
  const local = raw - idx
  const move = idx === 0 ? 1 : glide(norm(0, 0.42, local), 0.25)

  const opacities: number[] = []
  let activeIndex = idx
  let bestOpacity = 0

  for (let i = 0; i < n; i++) {
    const start = i * STOP_SPAN
    const u = (k - start) / STOP_SPAN
    const enterAt = i === 0 ? 0.04 : 0.34
    const fadeIn = smoothstep(enterAt, enterAt + 0.16, u)
    const fadeOut = i === n - 1 ? 0 : smoothstep(0.84, 0.99, u)
    const opacity = clamp(fadeIn * (1 - fadeOut), 0, 1)
    opacities.push(opacity)
    if (opacity > bestOpacity) {
      bestOpacity = opacity
      activeIndex = i
    }
  }

  return {
    from: Math.max(0, idx - 1),
    index: idx,
    move,
    greet: 1 - smoothstep(0.76, 0.98, local + (idx > 0 ? 1 : 0)),
    subject: TOUR_STOPS[idx].subject,
    activeIndex,
    opacities,
  }
}

export function tourScrollProgressForStop(index: number): number {
  const clamped = clamp(index, 0, TOUR_STOPS.length - 1)
  return (clamped + (clamped === 0 ? 0.32 : 0.56)) / TOUR_STOPS.length
}
