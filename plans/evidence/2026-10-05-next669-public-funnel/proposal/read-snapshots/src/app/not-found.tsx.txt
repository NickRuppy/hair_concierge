import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, House } from "lucide-react"

import { EditorialShell } from "@/components/editorial/editorial-shell"

export const metadata: Metadata = {
  title: "Seite nicht gefunden",
}

export default function NotFound() {
  return (
    <EditorialShell>
      <div className="mx-auto flex min-h-[60vh] max-w-5xl items-center px-5 py-16 sm:px-8 sm:py-24">
        <div className="max-w-2xl">
          <p className="font-mono text-xs font-semibold uppercase text-[var(--brand-coral-deep)]">
            Fehler 404
          </p>
          <h1 className="mt-3 font-header text-4xl font-medium leading-tight text-[var(--brand-plum-darkest)] sm:text-5xl">
            Diese Seite gibt es nicht.
          </h1>
          <p className="mt-5 text-lg leading-8 text-[var(--text-sub)]">
            Vielleicht ist der Link veraltet oder die Adresse enthält einen Tippfehler. Auf der
            Startseite und in der kostenlosen Haaranalyse findest du direkt weiter.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-md border border-[var(--brand-plum-light)] px-4 py-2.5 font-semibold text-[var(--brand-plum-darkest)] transition-colors hover:bg-[var(--brand-plum-ice)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"
            >
              <House className="size-4" aria-hidden="true" />
              Zur Startseite
            </Link>
            <Link
              href="/quiz"
              className="inline-flex items-center gap-2 rounded-md bg-[var(--brand-coral)] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[var(--brand-coral-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)] focus-visible:ring-offset-2"
            >
              Haaranalyse starten
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </EditorialShell>
  )
}
