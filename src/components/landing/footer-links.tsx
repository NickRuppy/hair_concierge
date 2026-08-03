import Link from "next/link"

export const footerProductLinks = [
  { href: "/quiz", label: "Haaranalyse starten", prefetch: false },
  { href: "/methodik", label: "Methodik" },
] as const

export const footerCompanyLinks = [
  { href: "/impressum", label: "Impressum" },
  { href: "/kontakt", label: "Kontakt" },
] as const

export const footerLegalLinks = [
  { href: "/datenschutz", label: "Datenschutz" },
  { href: "/agb", label: "AGB" },
  { href: "/widerruf", label: "Widerruf" },
] as const

export const offerFooterLinks = [
  { href: "/impressum", label: "Impressum" },
  { href: "/datenschutz", label: "Datenschutz" },
  { href: "/agb", label: "AGB" },
  { href: "/widerruf", label: "Widerruf" },
  { href: "/kontakt", label: "Kontakt" },
] as const

export const footerLinkClass =
  "text-sm text-muted-foreground transition-colors hover:text-[var(--brand-plum-darkest)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)] focus-visible:ring-offset-2"

export const footerCookieButtonClass =
  "cursor-pointer border-0 bg-transparent p-0 text-left font-[inherit] text-sm text-muted-foreground transition-colors hover:text-[var(--brand-plum-darkest)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)] focus-visible:ring-offset-2"

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
