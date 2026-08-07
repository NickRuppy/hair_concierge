import Link from "next/link"

import { Wordmark } from "@/components/landing/wordmark"

export function WaitlistShell({
  children,
  topBanner,
}: {
  children: React.ReactNode
  topBanner?: React.ReactNode
}) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fdfbf9] text-foreground">
      {topBanner ? <div className="border-b border-border bg-[#fff8e7]">{topBanner}</div> : null}
      <header className="border-b border-border bg-[#fdfbf9]">
        <div className="mx-auto flex max-w-3xl justify-center px-5 py-4 sm:px-6">
          <Link href="/warteliste" aria-label="chaarlie Warteliste">
            <Wordmark />
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-6 sm:py-14">{children}</main>
      <footer className="mx-auto flex max-w-3xl justify-center gap-5 px-5 py-8 text-xs text-muted-foreground sm:px-6">
        <Link href="/impressum" className="underline underline-offset-2">
          Impressum
        </Link>
        <Link href="/datenschutz" className="underline underline-offset-2">
          Datenschutz
        </Link>
        <Link href="/agb" className="underline underline-offset-2">
          AGB
        </Link>
        <Link href="/widerruf" className="underline underline-offset-2">
          Widerruf
        </Link>
      </footer>
    </div>
  )
}
