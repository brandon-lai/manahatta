import { ImageResponse } from "next/og"
import { OG_PALETTE } from "@/lib/skyline/og-palette"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          background: `linear-gradient(180deg, ${OG_PALETTE.iconTop} 0%, ${OG_PALETTE.skyMid} 68%, ${OG_PALETTE.riverDark} 100%)`,
          paddingBottom: 28,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 26,
            right: 34,
            width: 18,
            height: 18,
            borderRadius: 99,
            background: OG_PALETTE.moon,
            opacity: 0.88,
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
          }}
        >
          <div style={{ width: 18, height: 48, background: OG_PALETTE.parchmentMuted, opacity: 0.68 }} />
          <div style={{ width: 20, height: 76, background: OG_PALETTE.parchment, opacity: 0.84 }} />
          <div style={{ width: 26, height: 112, background: OG_PALETTE.tungsten }} />
          <div style={{ width: 20, height: 84, background: OG_PALETTE.parchment, opacity: 0.84 }} />
          <div style={{ width: 18, height: 52, background: OG_PALETTE.parchmentMuted, opacity: 0.68 }} />
        </div>
        <div
          style={{
            width: 130,
            height: 3,
            marginTop: 4,
            background: OG_PALETTE.tungsten,
            opacity: 0.55,
          }}
        />
      </div>
    ),
    { ...size }
  )
}
