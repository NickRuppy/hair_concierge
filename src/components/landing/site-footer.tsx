import Link from "next/link"

import { Wordmark } from "./wordmark"

const linkClass =
  "text-sm text-muted-foreground transition-colors hover:text-[var(--brand-plum-darkest)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)] focus-visible:ring-offset-2"

const headingClass =
  "mb-4 font-mono text-xs font-medium uppercase tracking-wider text-[var(--brand-plum)]"

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-card pb-8 pt-14">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 grid grid-cols-1 gap-12 sm:grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <Link
              href="/"
              aria-label="chaarlie Startseite"
              className="inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)] focus-visible:ring-offset-2"
            >
              <Wordmark />
            </Link>
            <p className="mt-3 max-w-[280px] text-sm leading-relaxed text-muted-foreground">
              Wissenschaftliche Haaranalyse, persönlich abgestimmt. Ein Produkt der Haarmony LLC.
            </p>
          </div>

          <div>
            <h4 className={headingClass}>Produkt</h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <Link href="/quiz" prefetch={false} className={linkClass}>
                  Haaranalyse starten
                </Link>
              </li>
              <li>
                <Link href="/#preise" className={linkClass}>
                  Preise
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className={headingClass}>Unternehmen</h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <Link href="/impressum" className={linkClass}>
                  Impressum
                </Link>
              </li>
              <li>
                <Link href="/kontakt" className={linkClass}>
                  Kontakt
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className={headingClass}>Rechtliches</h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <Link href="/datenschutz" className={linkClass}>
                  Datenschutz
                </Link>
              </li>
              <li>
                <Link href="/agb" className={linkClass}>
                  AGB
                </Link>
              </li>
              <li>
                <Link href="/widerruf" className={linkClass}>
                  Widerruf
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  data-cookie-settings-trigger
                  className="cursor-pointer border-0 bg-transparent p-0 text-left font-[inherit] text-sm text-muted-foreground transition-colors hover:text-[var(--brand-plum-darkest)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)] focus-visible:ring-offset-2"
                >
                  Cookie-Einstellungen
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-8 text-xs text-[var(--text-caption,#9A9892)]">
          <p>
            &copy; <span suppressHydrationWarning>{new Date().getFullYear()}</span> Haarmony LLC.
            Alle Rechte vorbehalten.
          </p>
          <p>Made with care · Dover, DE 19904, USA</p>
        </div>
      </div>
    </footer>
  )
}
