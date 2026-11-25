import Link from "next/link"
import { ArrowLeft, Compass } from "lucide-react"

export default function NotFound() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-16 bg-background text-foreground">
      <div className="max-w-md w-full skyline-plate rounded-2xl p-8 text-center space-y-5">
        <div className="inline-flex size-12 items-center justify-center rounded-full border border-border-strong bg-accent text-primary mx-auto">
          <Compass className="size-5" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-primary tabular-nums">
            404 · Off the Map
          </p>
          <h1 className="skyline-serif text-3xl font-normal text-foreground">
            Beyond the shoreline
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            That elevation doesn&apos;t exist in the atlas. Return to Horizons
            to watch New York, Paris, London, Tokyo, and Hong Kong rise across
            centuries.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border-strong bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-[background-color,transform] duration-150 ease-[var(--ease-out)] hover:bg-primary/90 active:scale-[0.96] motion-reduce:transition-none"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            <span>Return to Horizons</span>
          </Link>
        </div>
      </div>
    </main>
  )
}
