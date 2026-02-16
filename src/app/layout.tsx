import type { Metadata, Viewport } from "next"
import { Bebas_Neue, Montserrat } from "next/font/google"
import { AuthProvider } from "@/providers/auth-provider"
import { PostHogClientProvider } from "@/providers/posthog-provider"
import { ToastProvider } from "@/providers/toast-provider"
import "./globals.css"

const bebasNeue = Bebas_Neue({
  weight: "400",
  variable: "--font-bebas-neue",
  subsets: ["latin"],
})

const montserrat = Montserrat({
  variable: "--font-body",
  subsets: ["latin"],
})

// Every page requires Supabase auth (AuthProvider SSR + middleware redirect),
// so there is nothing to statically generate.
export const dynamic = "force-dynamic"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#231F20",
}

export const metadata: Metadata = {
  title: "TomBot — Deine persönliche Haar-Beraterin",
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
        className={`${bebasNeue.variable} ${montserrat.variable} antialiased`}
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
