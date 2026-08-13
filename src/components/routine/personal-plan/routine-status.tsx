import type { RoutinePayloadV1 } from "@/lib/personal-plan/routine/contracts"
import type { PortfolioPresentation } from "@/lib/personal-plan/routine/portfolio-presentation"
import { routinePresentationLabels } from "@/lib/personal-plan/routine/portfolio-presentation"
import { cn } from "@/lib/utils"

type RoutineItem = RoutinePayloadV1["items"][number]

export type RoutineStatus = {
  label: string
  tone: string
}

export function getRoutineStatus(
  item: RoutineItem,
  presentation: PortfolioPresentation | null = null,
): RoutineStatus {
  if (item.state.inclusion === "excluded") {
    return { label: "Empfohlen, aber nicht eingeplant", tone: "bg-stone-100 text-stone-800" }
  }
  if (item.state.systemAssessment === "not_recommended") {
    return { label: "Nicht empfohlen · von dir eingeplant", tone: "bg-violet-50 text-violet-900" }
  }
  if (item.state.availability === "planned") {
    return {
      label:
        routinePresentationLabels(presentation).plannedLabelFor(item.sourceDecisionKeys) ??
        "Geplant",
      tone: "bg-[var(--status-pending-bg)] text-[var(--status-pending-text)]",
    }
  }
  if (item.state.availability === "pending_review") {
    return {
      label: "Noch in Prüfung",
      tone: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]",
    }
  }
  if (item.state.availability === "none") {
    return {
      label: item.state.systemAssessment === "basis" ? "Basis-Lücke" : "Offen",
      tone: "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
    }
  }
  if (!item.executable) {
    return {
      label: "Noch nicht einsatzbereit",
      tone: "bg-[var(--status-pending-bg)] text-[var(--status-pending-text)]",
    }
  }
  return { label: "Aktiv", tone: "bg-[var(--status-ok-bg)] text-[var(--status-ok-text)]" }
}

export function RoutineStatusBadge({
  item,
  presentation = null,
}: {
  item: RoutineItem
  presentation?: PortfolioPresentation | null
}) {
  const status = getRoutineStatus(item, presentation)
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", status.tone)}>
      {status.label}
    </span>
  )
}
