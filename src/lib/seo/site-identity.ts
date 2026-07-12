import type { Metadata } from "next"

export const SITE_ORIGIN = "https://chaarlie.de"
export const SITE_NAME = "Chaarlie"
export const SITE_LEGAL_NAME = "Haarmony LLC"
export const SITE_DEFAULT_TITLE = "Chaarlie — Dein persönlicher Haarpflege-Berater"
export const SITE_DEFAULT_DESCRIPTION =
  "Kostenlose Haaranalyse in 2 Minuten. Dein Haarprofil, deine Routine und konkrete Produkte — ehrlich, ohne Anmeldung."
export const SITE_LOGO_URL = `${SITE_ORIGIN}/icon`
export const SITE_SHARE_IMAGE_URL = `${SITE_ORIGIN}/opengraph-image`
export const SITE_SAME_AS: readonly string[] = []

const INDEXABLE_ROBOTS = { index: true, follow: true } as const
const NOINDEX_ROBOTS = { index: false, follow: false } as const

export const PRIVATE_PAGE_METADATA: Metadata = {
  robots: NOINDEX_ROBOTS,
}

type StaticPageMetadataOptions = {
  pathname: string
  title: string
  description: string
  index?: boolean
}

function createStaticPageMetadata({
  pathname,
  title,
  description,
  index = true,
}: StaticPageMetadataOptions): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: pathname,
    },
    robots: index ? INDEXABLE_ROBOTS : NOINDEX_ROBOTS,
    openGraph: {
      title,
      description,
      url: pathname,
      siteName: SITE_NAME,
      locale: "de_DE",
      type: "website",
      images: [SITE_SHARE_IMAGE_URL],
    },
  }
}

export const ROOT_METADATA: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: SITE_DEFAULT_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DEFAULT_DESCRIPTION,
  openGraph: {
    siteName: SITE_NAME,
    locale: "de_DE",
    type: "website",
    images: [SITE_SHARE_IMAGE_URL],
  },
  twitter: {
    card: "summary_large_image",
    images: [SITE_SHARE_IMAGE_URL],
  },
}

export const HOME_METADATA: Metadata = {
  ...createStaticPageMetadata({
    pathname: "/",
    title: SITE_DEFAULT_TITLE,
    description: SITE_DEFAULT_DESCRIPTION,
  }),
  title: {
    absolute: SITE_DEFAULT_TITLE,
  },
  openGraph: {
    title: "Welche Pflege passt zu deinen Haaren?",
    description: SITE_DEFAULT_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    locale: "de_DE",
    type: "website",
    images: [SITE_SHARE_IMAGE_URL],
  },
  twitter: {
    card: "summary_large_image",
    title: "Welche Pflege passt zu deinen Haaren?",
    description: SITE_DEFAULT_DESCRIPTION,
    images: [SITE_SHARE_IMAGE_URL],
  },
}

export const QUIZ_METADATA = createStaticPageMetadata({
  pathname: "/quiz",
  title: "Kostenlose Haaranalyse in 2 Minuten",
  description:
    "Beantworte kurze Fragen zu deinem Haar und erhalte dein persönliches Haarprofil mit passenden Pflegeempfehlungen.",
})

export const METHODIK_METADATA = createStaticPageMetadata({
  pathname: "/methodik",
  title: "Methodik und Transparenz",
  description:
    "So verarbeitet Chaarlie deine Angaben, ordnet Haarpflege ein und kennzeichnet Quellen, Produktdaten und kommerzielle Links.",
})

export const PRICING_METADATA = createStaticPageMetadata({
  pathname: "/pricing",
  title: "Preise und Abos",
  description:
    "Wähle den Chaarlie Plan, der zu dir passt, und nutze deine persönliche Haarpflege-Beratung dauerhaft.",
  index: false,
})

export const LEGAL_PAGE_METADATA = {
  kontakt: createStaticPageMetadata({
    pathname: "/kontakt",
    title: "Kontakt",
    description: "Kontaktiere das Chaarlie Team bei Fragen zu deinem Konto, Abo oder Service.",
  }),
  impressum: createStaticPageMetadata({
    pathname: "/impressum",
    title: "Impressum",
    description: "Anbieterkennzeichnung und rechtliche Angaben zu Chaarlie und Haarmony LLC.",
  }),
  datenschutz: createStaticPageMetadata({
    pathname: "/datenschutz",
    title: "Datenschutzerklärung",
    description:
      "Informationen zur Verarbeitung und zum Schutz personenbezogener Daten bei Chaarlie.",
  }),
  agb: createStaticPageMetadata({
    pathname: "/agb",
    title: "Allgemeine Geschäftsbedingungen (AGB)",
    description:
      "Allgemeine Geschäftsbedingungen für die Nutzung von Chaarlie und seinen Diensten.",
  }),
  widerruf: createStaticPageMetadata({
    pathname: "/widerruf",
    title: "Widerrufsbelehrung",
    description: "Informationen zum gesetzlichen Widerrufsrecht für Chaarlie Abonnements.",
  }),
} as const

export const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_ORIGIN}/#organization`,
  name: SITE_NAME,
  legalName: SITE_LEGAL_NAME,
  url: SITE_ORIGIN,
  description: SITE_DEFAULT_DESCRIPTION,
  logo: {
    "@type": "ImageObject",
    url: SITE_LOGO_URL,
    width: 512,
    height: 512,
  },
  image: SITE_SHARE_IMAGE_URL,
} as const

export const WEBSITE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_ORIGIN}/#website`,
  name: SITE_NAME,
  url: SITE_ORIGIN,
  inLanguage: "de-DE",
  publisher: {
    "@id": `${SITE_ORIGIN}/#organization`,
  },
} as const
