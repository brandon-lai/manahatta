# Horizons

**Five iconic world skylines — New York, Paris, London, Tokyo, and Hong Kong — rising across centuries along their rivers and harbors, scored to music with interactive nocturnal architectural tours.**

Built with Next.js App Router, TypeScript, HTML5 Canvas 2.5D rendering, and shadcn/ui (Base UI).

## World Cities Included

1. **New York** (`1609–2026`, East River) — Palisades backdrop, Lenape forest clearing, Central Park, 28 landmarks (Empire State, Chrysler sunburst, One WTC, One Vanderbilt, 30 Hudson Yards Edge, Statue of Liberty, Flatiron, Woolworth, plus lost landmarks and Tribute in Light), and 5 East River bridges with pearl-necklace cable lights.
2. **Paris** (`1163–2026`, River Seine) — Montmartre hillside backdrop, strict low-rise Haussmannian mansard core, Notre-Dame, Panthéon, Arc de Triomphe, Sacré-Cœur, sparkling Eiffel Tower with rotating golden lighthouse beam, Tour Montparnasse, and the La Défense western cluster (Grande Arche, Tour First, Tour Majunga), plus Pont Neuf and Pont Alexandre III.
3. **London** (`1078–2026`, River Thames) — Protected St Paul's Cathedral sightlines, Palace of Westminster & glowing Big Ben dial, rotating London Eye, Tower Bridge with high-level double walkways, City of London cluster (The Gherkin, Cheesegrater, Walkie-Talkie, 22 Bishopsgate), The Shard's luminous apex, Battersea Power Station, and Canary Wharf.
4. **Tokyo** (`1603–2026`, Tokyo Bay) — Snow-capped Mount Fuji western backdrop, Edo Castle keep & Sensō-ji Pagoda, Tokyo Station, vermilion-lit Tokyo Tower, Azabudai Hills, Nishi-Shinjuku cluster (Kenzō Tange's City Hall & Cocoon Tower), 2,080-foot Tokyo Skytree with twin glowing Tembo decks, Rainbow Bridge, and Tokyo Gate Bridge.
5. **Hong Kong** (`1841–2026`, Victoria Harbour) — Light-speckled Victoria Peak granite ridge backdrop, Kowloon Clock Tower, Jardine House, Hopewell Centre, Norman Foster's HSBC exoskeleton with rooftop cranes, I. M. Pei's luminous Bank of China X-trusses, Central Plaza, The Center, Two IFC, ICC, The Henderson, Tsing Ma Bridge, and Stonecutters cable-stay Bridge.

## Highlights

- **2.5D Architectural Canvas Engine:** Sunward bevel highlights shifting with diurnal light, glass curtain-wall sky glints, clipped night windows, bespoke monument details, aviation obstruction beacons, and city-specific geographical backdrops.
- **Live Mirrored Waterfront Reflections:** Half-resolution offscreen reflection buffer sliced with live wave displacement, moonlight & sun-path glitter, and era-accurate harbor vessels.
- **Soundtrack & Web Audio Sync:** Synchronized 25-second musical score (`/public/audio/nyc.mp3`) with smooth fade-out, instant manual scroll handoff, and subtle low-frequency skyglow & river shimmer via `AnalyserNode`.
- **Interactive Controls & Landmark Atlas:** Instant city switching via top pill bar or keys `1`–`5`, `?city=` URL deep linking, drag-to-scrub historical timeline, 5-stop nocturnal architectural tour per city, and a filterable **Landmark Atlas** dialog that smoothly flies the camera to any monument or crossing in its prime era.

## Design Direction

Committed in [`DESIGN.md`](./DESIGN.md) and linted with `@google/design.md`.

- **Surface Mode:** Experience (full-bleed nocturnal canvas with peripheral translucent architectural chrome).
- **Palette:** Deep midnight indigo (`oklch(0.145 0.028 264)`), warm parchment ink, and tungsten window-light amber (`oklch(0.805 0.132 76)`).
- **Typography:** `Spectral` (display/editorial serif & tabular numerals) and `Albert Sans` (UI controls).

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `1`–`5` | Switch between New York, Paris, London, Tokyo, and Hong Kong |
| `Enter` | Enter the film with sound from the opening curtain |
| `Space` | Play / pause timelapse |
| `M` | Mute / unmute soundtrack |
| `R` | Replay current city from its earliest era |
| `A` | Open the active city's Landmark Atlas |
| `←` / `→` | Step between stops during the nocturnal tour |
| `Esc` | Close dialog or exit landmark spotlight |

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. URL jump parameters are supported for direct inspection: `?city=paris&p=0.95&gate=0`, `?city=tokyo&p=0.45&gate=0`, `?city=hongkong&p=0.96&gate=0`, or `?city=london&p=1&q=0.45&gate=0`.
