import type { Metadata, Viewport } from "next"
import { Playfair_Display, Plus_Jakarta_Sans, IBM_Plex_Mono } from "next/font/google"
import { AuthProvider } from "@/providers/auth-provider"
import { PostHogClientProvider } from "@/providers/posthog-provider"
import { ToastProvider } from "@/providers/toast-provider"
import "./globals.css"

const playfairDisplay = Playfair_Display({
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-playfair-display",
  subsets: ["latin"],
})

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
})

const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
})

// Every page requires Supabase auth (AuthProvider SSR + middleware redirect),
// so there is nothing to statically generate.
export const dynamic = "force-dynamic"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FDFBF9",
}

export const metadata: Metadata = {
  title: "Hair Concierge — Personalisierte Haarpflege-Beratung",
  description:
    "Personalisierte Haarpflege-Beratung powered by AI. Erhalte individuelle Tipps, Produktempfehlungen und Haar-Analysen.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de">
      <body
        className={`${playfairDisplay.variable} ${plusJakartaSans.variable} ${ibmPlexMono.variable} antialiased`}
      >
        <AuthProvider>
          <PostHogClientProvider>
            <ToastProvider>{children}</ToastProvider>
          </PostHogClientProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
