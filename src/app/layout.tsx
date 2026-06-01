import type { Metadata, Viewport } from "next"
import { Playfair_Display, Plus_Jakarta_Sans, IBM_Plex_Mono } from "next/font/google"
import { LazyCookieConsent } from "@/components/cookie-consent/lazy-cookie-consent"
import "./globals.css"

const playfairDisplay = Playfair_Display({
  weight: ["500"],
  style: ["normal"],
  variable: "--font-playfair-display",
  subsets: ["latin"],
  display: "swap",
})

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  display: "swap",
})

const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
})

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FDFBF9",
}

export const metadata: Metadata = {
  title: "Chaarlie — Dein persönlicher Haarpflege-Berater",
  description:
    "Chaarlie ist dein persönlicher Haarpflege-Berater. Erhalte individuelle Tipps, Produktempfehlungen und Haaranalysen — auf dein Haar zugeschnitten.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de" data-scroll-behavior="smooth">
      <body
        className={`${playfairDisplay.variable} ${plusJakartaSans.variable} ${ibmPlexMono.variable} antialiased`}
      >
        {children}
        <LazyCookieConsent />
      </body>
    </html>
  )
}
