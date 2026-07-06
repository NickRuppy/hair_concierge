import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Produkt-Intake Review",
  description: "Interne Warteschlange fuer Produkt-Intake-Pruefungen",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}
