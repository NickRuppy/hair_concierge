import { notFound } from "next/navigation"

import { getMaskResearchLabData, isMaskResearchLabEnabled } from "@/lib/labs/mask-research-access"
import { MaskResearchLabClient } from "./research-lab-client"

export default function MaskResearchLabPage() {
  if (!isMaskResearchLabEnabled(process.env)) notFound()

  let data
  try {
    data = getMaskResearchLabData()
  } catch {
    return (
      <main className="min-h-screen bg-[#f5eee5] p-6 text-stone-950">
        <section className="mx-auto mt-10 max-w-3xl rounded-md border border-amber-200 bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Nur Entwicklung · Artefaktmodus
          </p>
          <h1 className="mt-2 text-2xl font-semibold">
            Mask-Research-Artefakte konnten nicht geladen werden.
          </h1>
          <p className="mt-3 text-sm leading-6 text-stone-700">
            Die lokale Lab-Ansicht bleibt absichtlich begrenzt: keine Produktionsdatenbank, keine
            Katalogfreigabe und keine Product-Intake-Aktion. Bitte die Kohorte unter
            <code className="mx-1">data/research/mask-inci/v1.0/cohort.json</code>
            prüfen und den lokalen Dev-Server danach neu laden.
          </p>
        </section>
      </main>
    )
  }

  return <MaskResearchLabClient data={data} />
}
