import Link from "next/link"

import { FooterCookieSettingsButton, FooterLink, legalFooterLinks } from "./footer-links"
import { Wordmark } from "./wordmark"

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-background px-6 py-10">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
        <Link
          href="/"
          aria-label="chaarlie Startseite"
          className="inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)] focus-visible:ring-offset-2"
        >
          <Wordmark />
        </Link>

        <nav aria-label="Rechtliches" className="flex flex-wrap justify-center gap-x-4 gap-y-2">
          {legalFooterLinks.map((item) => (
            <FooterLink key={item.href} {...item} />
          ))}
          <FooterCookieSettingsButton />
        </nav>

        <p className="text-xs text-[var(--text-caption,#9A9892)]">
          &copy; <span suppressHydrationWarning>{new Date().getFullYear()}</span> Haarmony LLC
        </p>
      </div>
    </footer>
  )
}
