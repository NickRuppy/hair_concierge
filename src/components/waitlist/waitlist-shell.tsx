import Link from "next/link"

import { SiteFooter } from "@/components/landing/site-footer"
import { Wordmark } from "@/components/landing/wordmark"

/**
 * Huelle fuer alle Warteliste-Schritte. Bewusst ohne Navigation: auf einer
 * Opt-in-Strecke gibt es genau einen naechsten Schritt, jeder weitere Link ist
 * ein Leck. Der Footer bleibt, weil Impressum, Datenschutz und Widerruf auf
 * einer Seite mit Datenerhebung erreichbar sein muessen.
 */
export function WaitlistShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-border bg-[rgba(253,251,249,0.95)]">
        <div className="mx-auto flex max-w-3xl items-center justify-center px-4 py-4 sm:px-6">
          <Link href="/warteliste" aria-label="chaarlie Warteliste" className="shrink-0">
            <Wordmark />
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-5 pb-4 pt-10 sm:px-6 sm:pt-14">{children}</main>
      <SiteFooter />
    </>
  )
}
