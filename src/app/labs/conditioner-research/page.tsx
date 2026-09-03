import { notFound } from "next/navigation"

import {
  getConditionerResearchLabData,
  isConditionerResearchLabEnabled,
} from "@/lib/labs/conditioner-research-access"
import { ConditionerResearchLabClient } from "./research-lab-client"

export default function ConditionerResearchLabPage() {
  if (!isConditionerResearchLabEnabled(process.env)) notFound()

  let data
  try {
    data = getConditionerResearchLabData()
  } catch {
    return (
      <main className="min-h-screen bg-[#f5eee5] p-6 text-stone-950">
        <section className="mx-auto mt-10 max-w-3xl rounded-md border border-amber-200 bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Nur Entwicklung · Artefaktmodus
          </p>
          <h1 className="mt-2 text-2xl font-semibold">
            Conditioner-Research-Artefakte konnten nicht geladen werden.
          </h1>
          <p className="mt-3 text-sm leading-6 text-stone-700">
            Die lokale Lab-Ansicht bleibt absichtlich begrenzt: keine Produktionsdatenbank, keine
            Katalogfreigabe und keine Product-Intake-Aktion. Bitte die Stage-A-Artefakte im
            Conditioner-INCI-Ordner prüfen und den lokalen Dev-Server danach neu laden.
          </p>
        </section>
      </main>
    )
  }

  return <ConditionerResearchLabClient data={data} />
}
