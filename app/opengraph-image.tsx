import { ImageResponse } from "next/og"
import { OG_PALETTE } from "@/lib/skyline/og-palette"

export const alt =
  "Horizons: Five iconic world skylines — New York, Paris, London, Tokyo, and Hong Kong — rising across centuries"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const TOWERS = [
  { w: 28, h: 120, lit: false },
  { w: 42, h: 245, lit: true },
  { w: 24, h: 148, lit: false },
  { w: 30, h: 98, lit: false },
  { w: 26, h: 132, lit: false },
  { w: 34, h: 168, lit: false },
  { w: 46, h: 288, lit: true },
  { w: 32, h: 215, lit: true },
  { w: 38, h: 256, lit: true },
  { w: 26, h: 196, lit: false },
  { w: 34, h: 238, lit: false },
  { w: 22, h: 164, lit: false },
  { w: 28, h: 110, lit: false },
]

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: `linear-gradient(180deg, ${OG_PALETTE.skyTop} 0%, ${OG_PALETTE.skyMid} 54%, ${OG_PALETTE.skyHorizon} 74%, ${OG_PALETTE.riverDark} 100%)`,
          padding: "56px 72px 44px 72px",
          color: OG_PALETTE.parchment,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 64,
            right: 112,
            width: 44,
            height: 44,
            borderRadius: 99,
            background: OG_PALETTE.moon,
            opacity: 0.9,
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 21,
              color: OG_PALETTE.tungsten,
            }}
          >
            {["New York", "Paris", "London", "Tokyo", "Hong Kong"].map(
              (city, idx) => (
                <div
                  key={city}
                  style={{ display: "flex", alignItems: "center", gap: 14 }}
                >
                  {idx > 0 && (
                    <div
                      style={{
                        width: 1,
                        height: 16,
                        background: OG_PALETTE.tungsten,
                        opacity: 0.4,
                      }}
                    />
                  )}
                  <div>{city}</div>
                </div>
              )
            )}
          </div>
          <div style={{ fontSize: 78, fontFamily: "Georgia, serif", lineHeight: 1.02 }}>
            Horizons
          </div>
          <div style={{ fontSize: 26, color: OG_PALETTE.parchmentMuted, maxWidth: 680 }}>
            Five world skylines rising across centuries along their rivers and
            harbors.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              width: "100%",
              paddingLeft: 12,
              paddingRight: 12,
            }}
          >
            {TOWERS.map((t, idx) => (
              <div
                key={idx}
                style={{
                  width: t.w,
                  height: t.h,
                  background: t.lit ? OG_PALETTE.towerLit : OG_PALETTE.towerDark,
                  borderTop: t.lit
                    ? `3px solid ${OG_PALETTE.tungsten}`
                    : `1px solid ${OG_PALETTE.towerEdge}`,
                }}
              />
            ))}
          </div>
          <div
            style={{
              width: "100%",
              height: 2,
              background: OG_PALETTE.tungsten,
              opacity: 0.45,
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 14,
              fontSize: 20,
              color: OG_PALETTE.parchmentDim,
            }}
          >
            <span>1078 to 2026</span>
            <span>Interactive Skyline &amp; Nocturnal Tour</span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
