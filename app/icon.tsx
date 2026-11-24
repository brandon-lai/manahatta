import { ImageResponse } from "next/og"
import { OG_PALETTE } from "@/lib/skyline/og-palette"

export const size = { width: 32, height: 32 }
export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          background: `linear-gradient(180deg, ${OG_PALETTE.iconTop} 0%, ${OG_PALETTE.iconBottom} 100%)`,
          borderRadius: 7,
          paddingBottom: 5,
          gap: 2,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 4,
            left: 14,
            width: 4,
            height: 4,
            borderRadius: 99,
            background: OG_PALETTE.tungstenBright,
          }}
        />
        <div style={{ width: 4, height: 10, background: OG_PALETTE.parchmentMuted, opacity: 0.72 }} />
        <div style={{ width: 4, height: 15, background: OG_PALETTE.parchment, opacity: 0.85 }} />
        <div style={{ width: 5, height: 21, background: OG_PALETTE.tungstenBright }} />
        <div style={{ width: 4, height: 13, background: OG_PALETTE.parchment, opacity: 0.8 }} />
      </div>
    ),
    { ...size }
  )
}
