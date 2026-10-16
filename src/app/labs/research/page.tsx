import { notFound } from "next/navigation"
import { getSharedResearchLab } from "@/lib/labs/research/access"
import { RESEARCH_CATEGORIES, supportsResearchDataset } from "@/lib/labs/research/model"
import { ResearchLabClient } from "@/components/labs/research/research-lab-client"

export default async function ResearchLabPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; dataset?: string }>
}) {
  if (process.env.NODE_ENV !== "development") notFound()
  const query = await searchParams
  const category = RESEARCH_CATEGORIES.find((entry) => entry.id === (query.category ?? "mask"))
  if (!category || (query.dataset && !supportsResearchDataset(category.id, query.dataset)))
    notFound()
  let data
  try {
    data = getSharedResearchLab(
      category.id,
      query.dataset ?? (category.id === "shampoo" ? "pilot" : "default"),
    )
  } catch {
    // Artifact load errors are handled below; rendering stays outside try/catch.
  }
  if (!data) {
    return (
      <main className="min-h-screen bg-[#f5eee5] p-6 text-stone-950">
        <section className="mx-auto max-w-2xl rounded-xl border border-stone-200 bg-white p-6">
          <h1 className="text-xl font-semibold">
            Forschungsartefakte konnten nicht geladen werden.
          </h1>
          <p className="mt-3">
            {category.id === "oil" && query.dataset === "intake"
              ? "Zuerst ein aktuelles Öl-Prüfpaket über die Intake-CLI exportieren. Vorhandene Pakete und lokale Quelldateien prüfen."
              : category.id === "oil" && query.dataset === "candidate"
                ? "Die lokalen europäischen Forschungsprofile und Quelldateien prüfen und erneut laden."
                : "Die Auswahl oder lokale Quelldateien prüfen und erneut laden."}
          </p>
          <div className="mt-4 flex gap-4">
            <a
              href={`/labs/research?${new URLSearchParams({ category: category.id, ...(query.dataset ? { dataset: query.dataset } : {}) })}`}
            >
              Erneut laden
            </a>
            {category.id !== "oil" && <a href={category.legacyHref}>Bisherige Kategorieansicht</a>}
            <a href="/labs/research">Zu Masken</a>
          </div>
        </section>
      </main>
    )
  }
  return <ResearchLabClient key={`${data.category}:${data.dataset}`} initialData={data} />
}
