import type {
  PersonalPlanRoutineView,
  RoutinePayloadV1,
} from "@/lib/personal-plan/routine/contracts"
import { Button } from "@/components/ui/button"

import { RoutineSection } from "./routine-section"

type RoutineItem = RoutinePayloadV1["items"][number]

export type RoutinePageProps = {
  view: PersonalPlanRoutineView
  onEdit?: () => void
  onConfirm?: () => void
  onItemDetail?: (item: RoutineItem) => void
}

function payloadFor(view: PersonalPlanRoutineView) {
  if (view.status === "proposal") return view.pendingProposal?.candidate ?? null
  return view.activeVersion?.payload ?? null
}

export function RoutinePage({ view, onEdit, onConfirm, onItemDetail }: RoutinePageProps) {
  const payload = payloadFor(view)
  if (!payload) return null

  const items = new Map(payload.items.map((item) => [item.itemKey, item]))
  const sectionItems = (key: "basis" | "optional") =>
    payload.sections
      .find((section) => section.key === key)
      ?.itemKeys.map((itemKey) => items.get(itemKey))
      .filter((item): item is RoutineItem => Boolean(item)) ?? []
  const initialProposal = view.status === "proposal"

  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-8">
      <header className="space-y-3">
        <p className="text-sm font-semibold text-primary">Persönlicher Plan</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {initialProposal ? "Deine Routine steht" : "Deine Routine"}
        </h1>
        <p className="text-muted-foreground">
          {initialProposal
            ? "Dein Vorschlag ist bereit. Prüfe alle Bausteine, bevor du ihn bestätigst."
            : "Dein bestätigter Routine-Schnappschuss."}
        </p>
        <div className="flex flex-wrap gap-3">
          {initialProposal && onConfirm ? (
            <Button variant="cta" onClick={onConfirm}>
              Routine bestätigen
            </Button>
          ) : null}
          {onEdit ? (
            <Button variant="outline" onClick={onEdit}>
              Routine bearbeiten
            </Button>
          ) : null}
        </div>
      </header>
      <RoutineSection
        title="Deine Basis"
        items={sectionItems("basis")}
        onItemDetail={onItemDetail}
      />
      <RoutineSection
        title="Optional"
        items={sectionItems("optional")}
        onItemDetail={onItemDetail}
      />
    </main>
  )
}
