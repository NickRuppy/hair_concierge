import Link from "next/link"

import {
  FooterCookieSettingsButton,
  FooterButton,
  FooterLink,
  footerCompanyLinks,
  footerLegalLinks,
  footerProductLinks,
} from "./footer-links"
import { Wordmark } from "./wordmark"

const headingClass =
  "mb-4 font-mono text-xs font-medium uppercase tracking-wider text-[var(--brand-plum)]"

export function SiteFooter({
  onQuizAction,
}: {
  onQuizAction?: (trigger: HTMLButtonElement) => void
} = {}) {
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
              Strukturierte Haarpflege-Auswertung auf Basis deiner Angaben. Ein Produkt der Haarmony
              LLC.
            </p>
          </div>

          <div>
            <h4 className={headingClass}>Produkt</h4>
            <ul className="flex flex-col gap-2.5">
              {footerProductLinks.map((item) => (
                <li key={item.href}>
                  {item.href === "/quiz" && onQuizAction ? (
                    <FooterButton label={item.label} onClick={onQuizAction} />
                  ) : (
                    <FooterLink {...item} />
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className={headingClass}>Unternehmen</h4>
            <ul className="flex flex-col gap-2.5">
              {footerCompanyLinks.map((item) => (
                <li key={item.href}>
                  <FooterLink {...item} />
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className={headingClass}>Rechtliches</h4>
            <ul className="flex flex-col gap-2.5">
              {footerLegalLinks.map((item) => (
                <li key={item.href}>
                  <FooterLink {...item} />
                </li>
              ))}
              <li>
                <FooterCookieSettingsButton />
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
