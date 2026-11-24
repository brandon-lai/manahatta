---
name: Manahatta
version: 1.0.0
summary: Four hundred years of the Manhattan skyline, scored to music, followed by a nocturnal architectural tour.
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
    fontFamily: "Caveat, cursive"
    fontSize: "32px"
    fontWeight: 500
    lineHeight: 1.2
  body:
    fontFamily: "Spectral, Georgia, serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.62
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

# Manahatta — Design Direction

## Surface Mode

**Experience.** The 1609–2026 Manhattan skyline canvas and its 25-second musical soundtrack lead the viewport from edge to edge. Every interface control recedes into quiet translucent nocturnal chrome anchored at the periphery so the horizon, river reflections, and architecture never compete with heavy UI containers.

## Scene Sentence

Someone opens an architectural timelapse film at their desk or on their phone in the evening, in a dimly lit room, expecting the city and its soundtrack to fill the whole frame while the timeline, landmark index, and story controls remain calm, crisp, and effortless to reach.

## The World

- **Mechanism:** Four centuries of Manhattan rise, shift, demolish, and illuminate along a single East River horizon in sync with a 25-second musical arc, then glide into an interactive nocturnal tour of iconic towers.
- **Category rut avoided:** Generic black-and-neon cyberpunk dashboards, heavy glassmorphism cards floating over darkened background video, and static portfolio hero templates with tracked-caps eyebrows.
- **Concrete references (three material families):**
  1. **Architectural lithography & Hugh Ferriss charcoal plates** (*The Metropolis of Tomorrow*, 1929) — stepped Art Deco massing, glowing setbacks, atmospheric skyglow, and warm light emerging from deep indigo shadow.
  2. **Engraved New York monograph typography & brass observatory plaques** — refined editorial serif tabular numerals (`1609`–`2026`), architectural height figures in feet, hairline brass rules, and disciplined left-aligned captions.
  3. **Nocturnal 35mm cinema titles & East River twilight** — Gordon Willis optical softness, low-corner titles with soft dark drop shadows rather than opaque boxes, shimmering reflected city light on dark water, and deliberate camera pushes.

## Colour Posture & Tokens

**Drenched nocturnal canvas, restrained tungsten accent.**
- Ground: deep midnight Hudson indigo (`oklch(0.145 0.028 264)`), never pure `#000`.
- Ink: warm parchment window-light cream (`oklch(0.945 0.020 82)`), never pure `#fff`.
- Accent (`primary`): warm tungsten window-light amber (`oklch(0.805 0.132 76)`), reserved for the primary Enter call to action, active timeline indicator, focus ring, and lit Empire State greeting highlight.
- Dark theme is the native atmosphere; dark tokens are also defined on `[data-theme="dark"]` for theme-attribute compliance.

## Typography

Two core families plus one dedicated handwritten outlier:
- **Display & Editorial Serif (`Spectral`)** — tabular-numeral year counter (fluid `clamp(1.75rem, 3.2vw, 2.75rem)`, max `44px` recorded in front matter), opening title (fluid `clamp(2.25rem, 5vw, 3.5rem)`, max `56px`), and open-sky architectural story text.
- **Interface Sans (`Albert Sans`)** — translucent controls, interactive timeline markers, and the Landmark Atlas dialog.
- **Handwritten Outlier (`Caveat`)** — reserved strictly for the personal `"Hi, I'm Brandon"` window annotation and tour chapter headings, preserving the warmth of the original hand-drawn signature across all platforms.

## The Signature

The continuous single-take diurnal timelapse from Lenape woods in 1609 through Art Deco daylight to 2026 Manhattan night — with true East River mirrored light reflections, illuminated Art Deco crowns (Chrysler sunburst, Empire State tiers, Brooklyn Bridge cable necklace), and the camera push into a single glowing Empire State window with a hand-scribbled arrow and greeting, seamlessly transitioning into an interactive 5-stop skyline tour and fly-to Landmark Atlas.

## Mirror Test

A neighbouring personal-site or interactive-map PRD would default to a standard light landing page with a card grid or a Mapbox dark vector tile map with purple accents. Changing the ground to indigo-tinted lithography charcoal, pairing `Spectral` + `Albert Sans` + `Caveat`, painting 2.5D architectural lighting with mirrored water reflections on a 417-year musical timeline, and keeping story copy floating cleanly in open sky without opaque boxes makes this unmistakably Manahatta.

## Motion & Accessibility Notes

- All UI controls transition only `transform`, `opacity`, `background-color`, `border-color`, and `color` within `140ms–260ms` using `cubic-bezier(0.22, 1, 0.36, 1)`.
- Deliberate slow motion (`600ms` gate dissolve, 25-second musical skyline timelapse, smooth spring camera glide between landmarks) belongs to the Experience canvas and is completely reduced to instantaneous jumps and still atmosphere under `prefers-reduced-motion: reduce`.
- Known `sloplint` false positives documented: Gate 20 (external Hallmark stamp bookkeeping) and Gate 62 on Base UI `[data-starting-style]` / `[data-ending-style]` animation hooks.
