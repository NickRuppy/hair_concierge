import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { isDiscoveryCallToolkitEnabled } from "@/lib/discovery/flag"
import { resolveDiscoveryJourney } from "@/lib/discovery/journey"

/**
 * PLACEHOLDER — T3 replaces the body with the real product checklist.
 *
 * What is already load-bearing and must survive that replacement: the two
 * guards. The flag and a live enrollment for the *signed-in* account are what
 * make this the terminal destination of the middleware gate, so a revoked or
 * unenrolled visitor must 404 rather than see a shell.
 */

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function DiscoveryChecklistPage() {
  if (!isDiscoveryCallToolkitEnabled()) notFound()
  const discovery = await resolveDiscoveryJourney()
  if (discovery.kind !== "authorized") notFound()

  const firstName =
    discovery.enrollment.name.trim().split(/\s+/)[0] || discovery.enrollment.name.trim()

  return (
    <main className="grid min-h-dvh place-items-center bg-[#fcfaf7] px-4 py-10 text-center text-[var(--brand-plum-darkest)]">
      <section className="w-full max-w-md rounded-[2rem] border border-[var(--brand-plum-light)] bg-white p-7 sm:p-9">
        <h1 className="font-header text-3xl">Danke, {firstName}.</h1>
        <p className="mt-3 text-[var(--text-sub)]">
          Deine Produktliste kommt gleich. Wir melden uns vor dem Gespräch.
        </p>
      </section>
    </main>
  )
}
