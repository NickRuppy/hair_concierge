import Link from "next/link"

export const legalFooterLinks = [
  { href: "/kontakt", label: "Kontakt" },
  { href: "/impressum", label: "Impressum" },
  { href: "/datenschutz", label: "Datenschutz" },
  { href: "/agb", label: "AGB" },
  { href: "/widerruf", label: "Widerruf" },
] as const

export const footerLinkClass =
  "inline-flex min-h-11 items-center px-1 text-sm text-muted-foreground transition-colors hover:text-[var(--brand-plum-darkest)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)] focus-visible:ring-offset-2"

export const footerCookieButtonClass =
  "inline-flex min-h-11 cursor-pointer items-center border-0 bg-transparent px-1 py-0 text-left font-[inherit] text-sm text-muted-foreground transition-colors hover:text-[var(--brand-plum-darkest)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)] focus-visible:ring-offset-2"

export function FooterLink({
  href,
  label,
  prefetch,
}: {
  href: string
  label: string
  prefetch?: false
}) {
  return (
    <Link href={href} prefetch={prefetch} className={footerLinkClass}>
      {label}
    </Link>
  )
}

export function FooterCookieSettingsButton({
  className = footerCookieButtonClass,
}: {
  className?: string
} = {}) {
  return (
    <button type="button" data-cookie-settings-trigger className={className}>
      Cookie-Einstellungen
    </button>
  )
}
