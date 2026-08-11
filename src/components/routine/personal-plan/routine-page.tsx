import Link from "next/link"

import type {
  PersonalPlanRoutineView,
  RoutinePayloadV1,
} from "@/lib/personal-plan/routine/contracts"
import { Button, buttonVariants } from "@/components/ui/button"
import { PersonalPlanJourneyHeader } from "@/components/personal-plan-journey"

import { RoutineSection } from "./routine-section"

type RoutineItem = RoutinePayloadV1["items"][number]

export type RoutinePageProps = {
  view: PersonalPlanRoutineView
  stage5Reachable?: boolean
  onEdit?: () => void
  onConfirm?: () => void
  onItemDetail?: (item: RoutineItem) => void
}

function payloadFor(view: PersonalPlanRoutineView) {
  if (view.status === "proposal") return view.pendingProposal?.candidate ?? null
  return view.activeVersion?.payload ?? null
}

function isLaterOptional(item: RoutineItem) {
  return item.state.systemAssessment !== "basis" && item.state.availability === "none"
}

function isBlockingBasisGap(item: RoutineItem) {
  return (
    item.state.systemAssessment === "basis" &&
    item.state.inclusion === "included" &&
    (item.state.availability === "none" || item.state.availability === "pending_review")
  )
}

export function RoutinePage({
  view,
  stage5Reachable = false,
  onEdit,
  onConfirm,
  onItemDetail,
}: RoutinePageProps) {
  const payload = payloadFor(view)

  if (!payload) {
    return (
      <div className="min-h-dvh bg-[var(--background)]">
        <PersonalPlanJourneyHeader currentStage={4} saveStatus="saved" />
        <main className="personal-plan-cookie-clearance mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
          <section
            aria-live="polite"
            className="rounded-[28px] border border-border bg-white px-5 py-6 shadow-sm sm:px-7"
          >
            <p className="text-sm font-semibold text-primary">Persönlicher Plan</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Routine noch nicht verfügbar
            </h1>
            <p className="mt-3 text-muted-foreground">
              Deine Routine kann noch nicht sicher angezeigt werden. Prüfe zuerst die
              Produktauswahl, damit wir keine leere Anwendung erzeugen.
            </p>
            <Link
              href="/plan-start"
              className={`${buttonVariants({ variant: "funnelCta", size: null })} mt-5`}
            >
              Produkte prüfen
            </Link>
          </section>
        </main>
      </div>
    )
  }

  const items = new Map(payload.items.map((item) => [item.itemKey, item]))
  const sectionItems = (key: "basis" | "optional") =>
    payload.sections
      .find((section) => section.key === key)
      ?.itemKeys.map((itemKey) => items.get(itemKey))
      .filter((item): item is RoutineItem => Boolean(item)) ?? []
  const initialProposal = view.status === "proposal"
  const basisItems = sectionItems("basis")
  const optionalItems = sectionItems("optional").filter((item) => !isLaterOptional(item))
  const laterItems = sectionItems("optional").filter(isLaterOptional)
  const activeProductCount = [...basisItems, ...optionalItems].filter(
    (item) => item.executable && item.state.inclusion === "included",
  ).length
  const hasBlockingBasisGap = basisItems.some(isBlockingBasisGap)
  const canOpenApplication = Boolean(view.activeVersion && stage5Reachable && !hasBlockingBasisGap)

  return (
    <div className="min-h-dvh bg-[linear-gradient(180deg,#fffaf7_0%,var(--background)_38%,#fff_100%)]">
      <PersonalPlanJourneyHeader currentStage={4} saveStatus="saved" />
      <main className="personal-plan-cookie-clearance mx-auto w-full max-w-5xl space-y-8 px-4 py-8 pb-[calc(env(safe-area-inset-bottom)+7rem)] sm:px-6 sm:py-10 lg:pb-12">
        <header className="overflow-hidden rounded-[32px] border border-[rgba(107,80,160,0.14)] bg-[linear-gradient(135deg,#f5effa_0%,#fff9f7_100%)] px-5 py-6 shadow-sm sm:px-8 sm:py-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
            <div className="space-y-3">
              <p className="inline-flex rounded-full bg-[var(--status-ok-bg)] px-3 py-1 text-xs font-bold text-[var(--status-ok-text)]">
                {initialProposal ? "Vorschlag" : `✓ ${activeProductCount} aktive Produkte`}
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-[var(--brand-plum-darkest)] sm:text-5xl">
                {initialProposal ? "Deine Routine steht." : "Deine Routine ist bereit."}
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
                {initialProposal
                  ? "Prüfe den Vorschlag als nächsten Routine-Entwurf."
                  : "Dein Bedarfsplan – jetzt mit deinen Produkten, ihrem Rhythmus und den nächsten Anwendungsschritten."}
              </p>
              {hasBlockingBasisGap ? (
                <p
                  role="status"
                  className="rounded-[16px] bg-[var(--status-danger-bg)] px-4 py-3 text-sm font-medium text-[var(--status-danger-text)]"
                >
                  Mindestens ein Basis-Baustein fehlt noch. Ergänze ihn, bevor du zur Anwendung
                  wechselst.
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-3">
              {canOpenApplication ? (
                <Link
                  href="/anwendung"
                  className={buttonVariants({ variant: "funnelCta", size: null })}
                >
                  Anwendung ansehen
                </Link>
              ) : null}
              {onEdit ? (
                <Button variant="outline" onClick={onEdit}>
                  Routine anpassen
                </Button>
              ) : null}
            </div>
          </div>
          {initialProposal || onConfirm ? (
            <div className="mt-5 flex flex-wrap gap-3">
              {initialProposal && onConfirm ? (
                <Button variant="funnelCta" onClick={onConfirm}>
                  Routine bestätigen
                </Button>
              ) : null}
            </div>
          ) : null}
        </header>
        <RoutineSection
          title="Deine Basis"
          items={basisItems}
          emptyLabel="Deine Basis wird aus deinem Bedarfsplan aufgebaut."
          onItemDetail={onItemDetail}
        />
        {optionalItems.length > 0 ? (
          <RoutineSection title="Optional" items={optionalItems} onItemDetail={onItemDetail} />
        ) : null}
        {laterItems.length > 0 ? (
          <RoutineSection
            title="Später ergänzen"
            items={laterItems}
            variant="later"
            onItemDetail={onItemDetail}
          />
        ) : null}
      </main>
    </div>
  )
}
