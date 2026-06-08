import Link from "next/link"

import { Wordmark } from "./wordmark"

export function LandingHeader() {
  return (
    <header
      className="sticky top-0 z-50 border-b border-border backdrop-blur-[12px]"
      style={{ backgroundColor: "rgba(253,251,249,0.95)" }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-3.5">
        <Link href="/" aria-label="chaarlie Startseite" className="shrink-0">
          <Wordmark />
        </Link>
        <nav className="flex shrink-0 items-center gap-3 sm:gap-5">
          <Link
            href="/auth?next=/chat"
            prefetch={false}
            className="whitespace-nowrap rounded-md text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-[var(--brand-plum-darkest)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"
          >
            Anmelden
          </Link>
          <Link
            href="/quiz"
            prefetch={false}
            className="whitespace-nowrap rounded-[10px] bg-[var(--brand-coral)] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-coral-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)] focus-visible:ring-offset-2 sm:px-[18px] sm:py-2.5"
          >
            Quiz starten
          </Link>
        </nav>
      </div>
    </header>
  )
}
