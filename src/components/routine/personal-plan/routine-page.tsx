import Link from "next/link"

import type {
  PersonalPlanRoutineView,
  RoutinePayloadV1,
} from "@/lib/personal-plan/routine/contracts"
import { Button, buttonVariants } from "@/components/ui/button"
import { PersonalPlanJourneyHeader } from "@/components/personal-plan-journey"
import type { PortfolioPresentation } from "@/lib/personal-plan/routine/portfolio-presentation"

import { routineCategoryLabel } from "./routine-item-card"

import { RoutineSection } from "./routine-section"

type RoutineItem = RoutinePayloadV1["items"][number]

export type RoutinePageProps = {
  view: PersonalPlanRoutineView
  stage5Reachable?: boolean
  onEdit?: () => void
  onReviewProposal?: () => void
  onItemDetail?: (item: RoutineItem) => void
  portfolioPresentation?: PortfolioPresentation | null
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
  onReviewProposal,
  onItemDetail,
  portfolioPresentation = null,
}: RoutinePageProps) {
  const payload = payloadFor(view)

  if (!payload) {
    const needsRepair = view.status === "authority_repair_required" && view.repair
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
              {needsRepair
                ? "Deine bestätigte Routine bleibt unverändert. Prüfe einmal die Produktauswahl, damit keine Kategorie aus dem alten Stand in die Anwendung rutscht."
                : "Deine Routine kann noch nicht sicher angezeigt werden. Prüfe zuerst die Produktauswahl, damit wir keine leere Anwendung erzeugen."}
            </p>
            <Link
              href={needsRepair ? view.repair!.href : "/plan-start"}
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
  const initialProposal = view.status === "proposal" && !view.activeVersion
  const successorProposal = Boolean(view.activeVersion && view.pendingProposal)
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
      <main className="personal-plan-cookie-clearance mx-auto w-full max-w-4xl space-y-6 px-4 py-5 pb-[calc(env(safe-area-inset-bottom)+7rem)] sm:px-6 sm:py-7 lg:pb-12">
        <header className="border-b border-[rgba(107,80,160,0.14)] pb-5">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--status-ok-text)]">
                {successorProposal
                  ? "Änderungen verfügbar"
                  : initialProposal
                    ? "Vorschlag"
                    : "✓ Routine aktiv"}
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--brand-plum-darkest)] sm:text-4xl">
                {successorProposal
                  ? "Deine Routine bleibt aktiv."
                  : initialProposal
                    ? "Deine Routine wird vorbereitet."
                    : "Deine Routine"}
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {initialProposal
                  ? "Der ältere Vorschlag wird nicht automatisch bestätigt."
                  : successorProposal
                    ? "Du kannst die neuen Änderungen in einer Übersicht prüfen. Bis dahin bleibt deine aktuelle Routine bestehen."
                    : `Dein Bedarfsplan mit ${activeProductCount} aktiven ${activeProductCount === 1 ? "Produkt" : "Produkten"}, Rhythmus und Anwendung.`}
              </p>
              {hasBlockingBasisGap ? (
                <p
                  role="status"
                  className="mt-3 rounded-[14px] bg-[var(--status-danger-bg)] px-3 py-2 text-sm font-medium text-[var(--status-danger-text)]"
                >
                  Mindestens ein Basis-Baustein fehlt noch. Ergänze ihn, bevor du zur Anwendung
                  wechselst.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 sm:max-w-56 sm:flex-col">
              {canOpenApplication ? (
                <Link
                  href="/anwendung"
                  className={buttonVariants({ variant: "funnelCta", size: "sm" })}
                >
                  Anwendung ansehen
                </Link>
              ) : null}
              {onEdit ? (
                <Button variant="outline" size="sm" onClick={onEdit}>
                  Anpassen
                </Button>
              ) : null}
              {successorProposal && onReviewProposal ? (
                <Button variant="outline" size="sm" onClick={onReviewProposal}>
                  Änderungen prüfen
                </Button>
              ) : null}
            </div>
          </div>
        </header>
        <RoutineSection
          title="Deine Basis"
          items={basisItems}
          emptyLabel="Deine Basis wird aus deinem Bedarfsplan aufgebaut."
          onItemDetail={onItemDetail}
          presentation={portfolioPresentation}
          productPresentation={view.productPresentation}
        />
        {optionalItems.length > 0 ? (
          <RoutineSection
            title="Optional"
            items={optionalItems}
            onItemDetail={onItemDetail}
            presentation={portfolioPresentation}
            productPresentation={view.productPresentation}
          />
        ) : null}
        {laterItems.length > 0 ? (
          <RoutineSection
            title="Später ergänzen"
            items={laterItems}
            variant="later"
            onItemDetail={onItemDetail}
            presentation={portfolioPresentation}
            productPresentation={view.productPresentation}
          />
        ) : null}
        {(portfolioPresentation?.retainedOwnedProducts.length ?? 0) > 0 ||
        (portfolioPresentation?.retainedInventoryProducts?.length ?? 0) > 0 ? (
          <details className="rounded-[20px] border border-border bg-white/80 px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-[var(--brand-plum-darkest)]">
              Nicht verwendete Produkte (
              {(portfolioPresentation?.retainedOwnedProducts.length ?? 0) +
                (portfolioPresentation?.retainedInventoryProducts?.length ?? 0)}
              )
            </summary>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {portfolioPresentation?.retainedOwnedProducts.map((product) => (
                <li key={product.capturedProductId}>
                  {product.displayName} · {routineCategoryLabel(product.category)} · Nicht verwendet
                </li>
              ))}
              {portfolioPresentation?.retainedInventoryProducts?.map((product) => (
                <li key={product.capturedProductId}>
                  {product.displayName} · {routineCategoryLabel(product.category)} · Nicht verwendet
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </main>
    </div>
  )
}
