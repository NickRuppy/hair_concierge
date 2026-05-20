import Link from "next/link"

import { Wordmark } from "./wordmark"

export function LandingHeader() {
  return (
    <header
      className="sticky top-0 z-50 border-b border-border backdrop-blur-[12px]"
      style={{ backgroundColor: "rgba(253,251,249,0.95)" }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
        <Link href="/" aria-label="chaarlie Startseite">
          <Wordmark />
        </Link>
        <Link
          href="/quiz"
          className="rounded-[10px] bg-[var(--brand-coral)] px-[18px] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-coral-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)] focus-visible:ring-offset-2"
        >
          Quiz starten
        </Link>
      </div>
    </header>
  )
}
