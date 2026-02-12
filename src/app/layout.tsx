import type { Metadata } from "next"
import { Bebas_Neue, Montserrat } from "next/font/google"
import { AuthProvider } from "@/providers/auth-provider"
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

export const metadata: Metadata = {
  title: "Hair Concierge — Deine persönliche Haar-Beraterin",
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
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
