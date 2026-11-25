---
name: Horizons
version: 2.0.0
summary: Five iconic world skylines — New York, Paris, London, Tokyo, and Hong Kong — rising across centuries along their waterfronts, scored to music with nocturnal architectural tours.
colors:
  background: "oklch(0.145 0.028 264)"
  surface: "oklch(0.185 0.030 264)"
  surfaceElevated: "oklch(0.225 0.032 262)"
  foreground: "oklch(0.945 0.020 82)"
  mutedForeground: "oklch(0.755 0.022 80)"
  primary: "oklch(0.805 0.132 76)"
  primaryForeground: "oklch(0.165 0.028 264)"
  border: "oklch(0.945 0.020 82 / 0.14)"
  borderStrong: "oklch(0.805 0.132 76 / 0.34)"
  destructive: "oklch(0.665 0.175 26)"
  ring: "oklch(0.805 0.132 76)"
typography:
  display:
    fontFamily: "Spectral, Georgia, serif"
    fontSize: "56px"
    fontWeight: 400
    lineHeight: 1.08
  year:
    fontFamily: "Spectral, Georgia, serif"
    fontSize: "44px"
    fontWeight: 400
    lineHeight: 1.0
  title:
    fontFamily: "Spectral, Georgia, serif"
    fontSize: "38px"
    fontWeight: 400
    lineHeight: 1.12
  body:
    fontFamily: "Spectral, Georgia, serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.58
  control:
    fontFamily: "Albert Sans, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.35
  caption:
    fontFamily: "Spectral, Georgia, serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "36px"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  pill: "9999px"
---

# Horizons — Design Direction

## Surface Mode

**Experience.** The live architectural canvas fills the viewport edge to edge across five world skylines — **New York, Paris, London, Tokyo, and Hong Kong**. Every interface control (world city switcher, playback controls, timeline scrubber, and Landmark Atlas) recedes into quiet translucent nocturnal chrome anchored at the periphery so horizons, landmarks, mountain/ridge backdrops, and mirrored river reflections command full attention.

## Scene Sentence

Someone opens an architectural timelapse atlas at their desk or on their phone in the evening, in a dimly lit room, switching effortlessly between five iconic cities to watch centuries of urban architecture rise, illuminate at dusk, and shimmer across the water.

## The World

- **Mechanism:** Each city rises along its historic waterfront across centuries in sync with a 25-second diurnal musical arc, then transitions smoothly into a 5-stop nocturnal architectural tour and an interactive Landmark Atlas.
- **Category rut avoided:** Generic black-and-neon cyberpunk dashboards, heavy opaque cards floating over darkened background video, and Mapbox vector tile maps.
- **Concrete references (three material families):**
  1. **Architectural lithography & Hugh Ferriss charcoal plates** (*The Metropolis of Tomorrow*, 1929) — stepped Art Deco massing, glowing setbacks, atmospheric skyglow, and warm window light emerging from deep indigo shadow.
  2. **Engraved architectural monograph plates & brass observatory plaques** — refined editorial serif tabular numerals, elevation heights in feet and meters, hairline rules, and calm left-aligned architectural captions.
  3. **Nocturnal 35mm cinema titles & waterfront twilight** — open-sky typography with soft feathered dark scrims rather than boxed cards, mirrored city light rippling across dark water, and deliberate camera glides.

## Colour Posture & Tokens

**Drenched nocturnal canvas, restrained tungsten accent.**
- Ground: deep midnight indigo (`oklch(0.145 0.028 264)`), never pure `#000`.
- Ink: warm parchment window-light cream (`oklch(0.945 0.020 82)`), never pure `#fff`.
- Accent (`primary`): warm tungsten window-light amber (`oklch(0.805 0.132 76)`), reserved for active city selection, primary Enter CTA, active timeline ticks, focus rings, and illuminated monument highlights.
- Dark theme is the native atmosphere; dark tokens are also defined on `[data-theme="dark"]` for theme-attribute compliance.

## Typography

Two cohesive architectural faces:
- **Display & Editorial Serif (`Spectral`)** — tabular-numeral year counter (fluid `clamp(1.85rem, 3.3vw, 2.75rem)`, max `44px`), opening city title (fluid `clamp(2.15rem, 4.8vw, 3.5rem)`, max `56px`), and open-sky nocturnal tour prose.
- **Interface Sans (`Albert Sans`)** — translucent top HUD city switcher, playback controls, timeline markers, and the Landmark Atlas dialog.

## The Signature

Seamless instant switching between five handcrafted historical world skylines on a single 2.5D diurnal engine — from New York's Art Deco crowns and Brooklyn Bridge, to Paris's Haussmannian mansards and sparkling Eiffel lighthouse beam, London's rotating London Eye, Tower Bridge, and Shard, Tokyo's Skytree and Tokyo Tower beneath snow-capped Mount Fuji, and Hong Kong's Bank of China X-trusses rising against a light-speckled Victoria Peak — all mirrored live in rippling waterfront reflections.

## Mirror Test

A neighbouring architectural or travel showcase would default to a card grid of stock city photographs or a generic dark vector map. Painting custom architectural silhouettes, city-specific geographical backdrops (Mount Fuji, Victoria Peak, Montmartre, Palisades), custom bridge engineering (Tower Bridge, Brooklyn Bridge, Stonecutters cable-stays, Seine stone arches), and mirrored waterfront reflections on a single musical timeline makes Horizons unmistakable.

## Motion & Accessibility Notes

- All UI controls transition only `transform`, `opacity`, `background-color`, `border-color`, and `color` within `140ms–260ms` using `cubic-bezier(0.22, 1, 0.36, 1)`.
- Deliberate slow motion (`600ms` gate dissolve, 25-second musical skyline timelapse, smooth spring camera glide between landmarks) belongs to the Experience canvas and is completely reduced to instantaneous jumps and still atmosphere under `prefers-reduced-motion: reduce`.
- Known `sloplint` false positives documented: Gate 20 (external Hallmark stamp bookkeeping) and Gate 62 on Base UI `[data-starting-style]` / `[data-ending-style]` animation hooks.
