import { AgentCompareLab } from "@/components/labs/agent-compare-lab"
import { notFound } from "next/navigation"

export default function AgentComparePage() {
  if (process.env.NODE_ENV !== "development") {
    notFound()
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <div className="space-y-2">
        <p className="type-label text-muted-foreground">Local Lab</p>
        <h1 className="text-3xl font-semibold tracking-tight">Agent Compare</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Testet die neue Produktionslogik AgentV2 GPT-5.4-mini + CareBalance fuer einen echten
          gespeicherten Testnutzer. Geladen werden Profil, Routine und relevante Memory; der Prompt
          ist die eigentliche Frage.
        </p>
      </div>

      <AgentCompareLab />
    </div>
  )
}
