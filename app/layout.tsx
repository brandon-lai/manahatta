import type { Metadata, Viewport } from "next"
import { Albert_Sans, Caveat, Spectral } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const albertSans = Albert_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
})

const spectral = Spectral({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
})

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-hand",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://manahatta.vercel.app"
  ),
  title: "Manahatta: Manhattan Skyline, 1609 to 2026",
  description:
    "Four centuries of the Manhattan skyline rising along the East River in sync with music, followed by a nocturnal architectural tour.",
  openGraph: {
    title: "Manahatta: Manhattan Skyline, 1609 to 2026",
    description:
      "Four centuries of the Manhattan skyline rising along the East River in sync with music, followed by a nocturnal architectural tour.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Manahatta: Manhattan Skyline, 1609 to 2026",
    description:
      "Four centuries of the Manhattan skyline rising along the East River in sync with music.",
  },
}

export const viewport: Viewport = {
  themeColor: "#0e1222",
  colorScheme: "dark",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        albertSans.variable,
        spectral.variable,
        caveat.variable
      )}
    >
      <body>
        <ThemeProvider>
          <TooltipProvider delay={260}>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

