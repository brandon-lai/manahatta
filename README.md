# Manahatta

**Four centuries of the Manhattan skyline rising along the East River in twenty-five seconds, scored to music—followed by a nocturnal architectural tour.**

Extracted and elevated from the homepage skyline experience of `brandon-lai.github.io`, rebuilt as a standalone Next.js + TypeScript + shadcn/ui (Base UI) interactive architectural film.

## Highlights

- **1609 → 2026 Diurnal Timelapse:** Smooth monotone-spline camera framing, exponential historical pacing, Lenape wooded hills flattening into the 1811 Commissioners' Grid, Central Park, East River finger piers, and era-accurate harbor vessels (sloops, clippers, steamers, tugs, barges, and NYC ferries).
- **Upgraded 2.5D Architectural Canvas:** 28 Manhattan landmarks—including Empire State, Chrysler (illuminated Art Deco sunburst crown), One World Trade Center, One Vanderbilt, 30 Hudson Yards with the cantilevered Edge deck, Flatiron, Statue of Liberty with glowing harbor torch, Woolworth, 40 Wall Street, 70 Pine Street, Bank of America Tower, 432 Park Avenue, and lost legends (Original Penn Station, Singer Building, Pulitzer's World Building, and the Twin Towers + Tribute in Light).
- **True Mirrored East River Reflections:** Half-resolution offscreen reflection buffer sliced with live horizontal wave displacement, moonlight & sun-path glitter, and pearl-necklace night lights draped along Brooklyn, Manhattan, Williamsburg, and RFK bridge cables.
- **Soundtrack & Web Audio Sync:** Preserves `/public/audio/nyc.mp3` synchronized over the 25-second intro with smooth fade-out, instant manual scroll handoff, and subtle low-frequency skyglow & river shimmer via `AnalyserNode`.
- **Interactive Controls & Skyline Atlas:** Drag-to-scrub 417-year timeline with era milestones, a 5-stop nocturnal architectural tour, and a filterable **Skyline Atlas** dialog that smoothly flies the camera to any tower or East River bridge in its prime era.

## Design Direction

Committed in [`DESIGN.md`](./DESIGN.md) and linted with `@google/design.md`.

- **Surface Mode:** Experience (full-bleed nocturnal canvas with peripheral translucent architectural chrome).
- **Palette:** Deep Hudson midnight indigo (`oklch(0.145 0.028 264)`), warm parchment ink, and tungsten window-light amber (`oklch(0.805 0.132 76)`).
- **Typography:** `Spectral` (display/editorial serif & tabular numerals), `Albert Sans` (UI controls), and `Caveat` (handwritten greeting annotation).

## Decisions Recorded

- **Name:** `manahatta` — the Lenape name for the island in 1609, anchoring the 417-year arc from wooded hills to supertalls.
- **UI Foundation:** shadcn/ui on Base UI (`dialog`, `tooltip`, `slider`, `button`, `separator`, `kbd`) skinned entirely with nocturnal OKLCH tokens rather than hand-rolled overlays.
- **Tour Icons:** Replaced raw emoji (`🎾`, `🏃`, `🍰`) with monochrome Lucide vector icons to match the nocturnal architectural plate language.
- **Audio & Accessibility:** Click-to-enter gate respects browser autoplay policy, supports silent entry, honors `prefers-reduced-motion` (jumps directly to the 2026 Manhattan view with static river shimmer), and preserves a complete screen-reader semantic mirror of Brandon's bio and work history.

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `Enter` | Enter the film with sound from the opening curtain |
| `Space` | Play / pause timelapse |
| `M` | Mute / unmute soundtrack |
| `R` | Replay from 1609 |
| `A` | Open the Skyline Atlas |
| `←` / `→` | Step between stops during the nocturnal tour |
| `Esc` | Close dialog or exit landmark spotlight |

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Jump parameters are supported for inspection: `?p=0.42&gate=0` (1931 Art Deco daytime), `?p=0.63&gate=0` (1973 golden hour), or `?p=1&q=0.45&gate=0` (nocturnal tour).
