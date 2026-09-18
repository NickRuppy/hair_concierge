import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { z } from "zod"

export const metadata: Metadata = {
  title: "Produkt in der App öffnen",
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
}

export default async function MobileResearchLinkPage({
  params,
}: {
  params: Promise<{ submissionId: string }>
}) {
  const { submissionId } = await params
  if (!z.uuid().safeParse(submissionId).success) notFound()
  const pilotURL = `chaarlie-pilot://research/${submissionId}`
  const appURL = `chaarlie://research/${submissionId}`

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-md">
        <p className="font-header text-[2rem] leading-none text-[var(--brand-plum-darkest)]">
          chaarlie
        </p>
        <h1 className="mt-12 font-header text-4xl font-medium leading-tight text-[var(--brand-plum-darkest)]">
          Dein Produkt ist bereit.
        </h1>
        <p className="mt-5 text-base leading-7 text-[var(--text-sub)]">
          Deine Einschätzung findest du in der iPhone-App.
        </p>
        <div className="mt-8 flex flex-col items-start gap-3">
          <a
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--brand-plum)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-plum-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"
            href={pilotURL}
            rel="noreferrer"
          >
            TestFlight-App öffnen
          </a>
          <a
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--brand-plum)] px-5 py-3 text-sm font-semibold text-[var(--brand-plum)] transition-colors hover:bg-[var(--brand-plum-ice)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"
            href={appURL}
            rel="noreferrer"
          >
            Chaarlie-App öffnen
          </a>
        </div>
        <p className="mt-6 text-sm leading-6 text-[var(--text-sub)]">
          Am Computer? Öffne diese E-Mail auf deinem iPhone.
        </p>
      </div>
    </main>
  )
}
