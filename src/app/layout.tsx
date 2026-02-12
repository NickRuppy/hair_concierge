import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { AuthProvider } from "@/providers/auth-provider"
import { ToastProvider } from "@/providers/toast-provider"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
