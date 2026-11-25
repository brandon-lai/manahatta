import type { Metadata, Viewport } from "next"
import { Albert_Sans, Spectral } from "next/font/google"

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

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://manahatta.vercel.app"
  ),
  title: "Horizons: Five World Skylines Through Time",
  description:
    "Watch New York, Paris, London, Tokyo, and Hong Kong rise along their rivers and harbors across centuries, scored to music with nocturnal architectural tours.",
  openGraph: {
    title: "Horizons: Five World Skylines Through Time",
    description:
      "Watch New York, Paris, London, Tokyo, and Hong Kong rise along their rivers and harbors across centuries, scored to music with nocturnal architectural tours.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Horizons: Five World Skylines Through Time",
    description:
      "Five iconic world skylines rising across centuries along their waterfronts.",
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
        spectral.variable
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

