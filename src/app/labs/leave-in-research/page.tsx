import { notFound } from "next/navigation"

import {
  getLeaveInResearchLabData,
  isLeaveInResearchLabEnabled,
} from "@/lib/labs/leave-in-research-access"
import { LeaveInResearchLabClient } from "./research-lab-client"

export default function LeaveInResearchLabPage() {
  if (!isLeaveInResearchLabEnabled(process.env)) notFound()

  let data
  try {
    data = getLeaveInResearchLabData()
  } catch {
    return (
      <main className="min-h-screen bg-[#f5eee5] p-6 text-stone-950">
        <section className="mx-auto mt-10 max-w-3xl rounded-md border border-amber-200 bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Nur Entwicklung · Artefaktmodus
          </p>
          <h1 className="mt-2 text-2xl font-semibold">
            Leave-In-Research-Artefakte konnten nicht geladen werden.
          </h1>
          <p className="mt-3 text-sm leading-6 text-stone-700">
            Die lokale Lab-Ansicht bleibt absichtlich begrenzt: keine Produktionsdatenbank, keine
            Katalogfreigabe und keine Product-Intake-Aktion. Bitte die Fixture unter
            <code className="mx-1">data/research/leave-in-inci/v1.0/lab-fixture.json</code>
            prüfen und den lokalen Dev-Server danach neu laden.
          </p>
        </section>
      </main>
    )
  }

  return <LeaveInResearchLabClient data={data} />
}
