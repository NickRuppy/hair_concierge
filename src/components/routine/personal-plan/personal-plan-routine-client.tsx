"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { routineAnalytics } from "@/lib/personal-plan/routine/analytics"
import { CATEGORY_ROLE_POLICIES } from "@/lib/personal-plan/products/authorities"
import type {
  PersonalPlanRoutineView,
  RoutinePayloadV1,
  RoutineProposalDeltaV1,
} from "@/lib/personal-plan/routine/contracts"
import type {
  RoutineEditOperation,
  RoutineProductRef,
} from "@/lib/personal-plan/routine-candidate-compiler"
import type { RoutineProductDetail as RoutineProductDetailData } from "@/lib/personal-plan/routine/product-detail-service"
import { PRODUCT_FREQUENCIES } from "@/lib/vocabulary/frequencies"
import { reportPersonalPlanTransitionTiming } from "@/lib/personal-plan/transition-performance"

import { requestRoutineAttentionRefresh } from "./routine-attention-indicator"
import { RoutineEditor, type RoutineProductOption } from "./routine-editor"
import { routineCategoryLabel, routinePurposeLabel } from "./routine-item-card"
import { RoutinePage } from "./routine-page"
import { RoutineProductDetail } from "./routine-product-detail"
import { RoutineProposalSheet, type RoutineProposalSheetDeltaEntry } from "./routine-proposal-sheet"

type RoutineViewResponse = PersonalPlanRoutineView | { status: "no_personal_plan" }
type Mode = "overview" | "editor"

function readError(response: Response, fallback: string) {
  return response
    .json()
    .then((body: { error?: unknown }) => (typeof body.error === "string" ? body.error : fallback))
    .catch(() => fallback)
}

export function friendlyError(error: string, fallback: string) {
  if (
    [
      "stale_active_version",
      "stale_proposal",
      "revision_conflict",
      "source_revision_conflict",
      "stale_source",
    ].includes(error)
  ) {
    return "Deine Routine hat sich inzwischen geändert. Wir haben den aktuellen Stand neu geladen."
  }
  if (error === "unauthorized" || error === "forbidden") {
    return "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an."
  }
  if (error === "temporarily_unavailable") return fallback
  // API error values are server tokens, not copy. Keep unknown values out of
  // the UI even when they do not contain an underscore (for example
  // "unauthorized").
  return fallback
}

function countBand(count: number): "0" | "1" | "2_4" | "5_plus" {
  if (count <= 0) return "0"
  if (count === 1) return "1"
  if (count <= 4) return "2_4"
  return "5_plus"
}

export type ProposalReloadClassification = "resolved" | "same_pending" | "superseded"

export function classifyProposalReload(
  view: PersonalPlanRoutineView,
  attemptedProposalId: string,
): ProposalReloadClassification {
  if (view.pendingProposal?.id === attemptedProposalId) return "same_pending"
  if (view.pendingProposal) return "superseded"
  return "resolved"
}

export function refreshRouteAfterInitialRoutineAcceptance({
  action,
  wasInitial,
  refresh,
}: {
  action: "accept" | "reject"
  wasInitial: boolean
  refresh: () => void
}) {
  if (action === "accept" && wasInitial) refresh()
}

function editorSeed(view: PersonalPlanRoutineView): RoutinePayloadV1 | null {
  return view.activeVersion?.payload ?? view.pendingProposal?.candidate ?? null
}

function frozenProductOptions(
  payload: RoutinePayloadV1 | null,
): Record<string, RoutineProductOption[]> {
  if (!payload) return {}
  const choicesByCategory = new Map<string, RoutineProductOption[]>()
  for (const category of payload.intent.categories) {
    for (const assignment of category.assignments) {
      const productRef = assignment.productRef as RoutineProductRef
      if (productRef.kind === "none") continue
      const item = payload.items.find(
        (candidate) => candidate.assignmentKey === assignment.assignmentKey,
      )
      const label =
        item && typeof item.product.displayName === "string" && item.product.displayName.length > 0
          ? item.product.displayName
          : "Produkt ohne Namen"
      const choices = choicesByCategory.get(category.category) ?? []
      if (
        !choices.some((choice) => JSON.stringify(choice.productRef) === JSON.stringify(productRef))
      ) {
        choices.push({ label, productRef })
      }
      choicesByCategory.set(category.category, choices)
    }
  }
  return Object.fromEntries(
    payload.items.map((item) => [item.assignmentKey, choicesByCategory.get(item.category) ?? []]),
  )
}

function productDisplayName(item: RoutinePayloadV1["items"][number] | undefined) {
  const displayName = item?.product.displayName
  return typeof displayName === "string" && displayName.length > 0 ? displayName : null
}

export function routineProposalDeltaEntries(
  entries: RoutineProposalDeltaV1["direct"],
  active: RoutinePayloadV1 | null,
  candidate: RoutinePayloadV1,
): RoutineProposalSheetDeltaEntry[] {
  const activeItems = new Map(active?.items.map((item) => [item.itemKey, item]) ?? [])
  const candidateItems = new Map(candidate.items.map((item) => [item.itemKey, item]))
  return entries.map((entry, index) => {
    const raw = entry as { itemKey?: unknown; explanationKey?: unknown; kind?: unknown }
    const itemKey = typeof raw.itemKey === "string" ? raw.itemKey : ""
    const kind = typeof raw.kind === "string" ? raw.kind : "geändert"
    if (itemKey.startsWith("category:")) {
      const category = itemKey.slice("category:".length)
      const inclusion = candidate.intent.categories.find(
        (entry) => entry.category === category,
      )?.inclusion
      return {
        changeKey: `${itemKey}:${index}`,
        label: routineCategoryLabel(category),
        description:
          inclusion === "excluded" ? "Kategorie nicht mehr verwenden" : "Kategorie verwenden",
      }
    }

    const activeItem = activeItems.get(itemKey)
    const candidateItem = candidateItems.get(itemKey)
    const item = candidateItem ?? activeItem
    const productName = productDisplayName(item)
    const inclusionChanged = Boolean(
      activeItem && candidateItem && activeItem.state.inclusion !== candidateItem.state.inclusion,
    )
    const changeLabel =
      inclusionChanged && candidateItem?.state.inclusion === "excluded"
        ? "nicht mehr in Verwendung"
        : inclusionChanged && candidateItem?.state.inclusion === "included"
          ? "wird verwendet"
          : kind === "added"
            ? "hinzugefügt"
            : kind === "removed"
              ? "entfernt"
              : "geändert"
    return {
      changeKey: `${itemKey || "item"}:${index}`,
      label: item ? routinePurposeLabel(item.purposeKey) : "Routine-Baustein",
      description: productName ? `${productName} · ${changeLabel}` : changeLabel,
    }
  })
}

export function PersonalPlanRoutineClient({
  initialView,
  enabled,
  stage5Reachable,
}: {
  initialView: PersonalPlanRoutineView
  enabled: boolean
  stage5Reachable: boolean
}) {
  const router = useRouter()
  const [view, setView] = React.useState(initialView)
  const [mode, setMode] = React.useState<Mode>("overview")
  // A successor proposal is intentionally non-blocking during the current
  // visit, but it must be presented again on the next Routine-page visit until
  // the owner explicitly accepts or rejects it.
  const [proposalOpen, setProposalOpen] = React.useState(Boolean(initialView.pendingProposal))
  const [entrySyncPending, setEntrySyncPending] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [proposalRetryId, setProposalRetryId] = React.useState<string | null>(null)
  const [detail, setDetail] = React.useState<RoutineProductDetailData | null>(null)
  const [detailOpen, setDetailOpen] = React.useState(false)
  const syncedOnEntry = React.useRef(false)
  const displayedProposalId = React.useRef<string | null>(null)
  const proposalResolutionInFlight = React.useRef(false)
  const initialAnalyticsVariant = React.useRef<"active" | "proposal" | "empty">(
    initialView.pendingProposal && !initialView.activeVersion
      ? "proposal"
      : initialView.activeVersion
        ? "active"
        : "empty",
  )

  const reload = React.useCallback(async () => {
    const startedAt = performance.now()
    let outcome = "error"
    try {
      const response = await fetch("/api/personal-plan/routine", { cache: "no-store" })
      if (!response.ok)
        throw new Error(await readError(response, "Routine konnte nicht aktualisiert werden."))
      const next = (await response.json()) as RoutineViewResponse
      if (next.status === "no_personal_plan")
        throw new Error("Dein persönlicher Plan ist nicht verfügbar.")
      setView(next)
      requestRoutineAttentionRefresh(Boolean(next.pendingProposal))
      outcome = "ok"
      return next
    } finally {
      reportPersonalPlanTransitionTiming({
        layer: "client",
        operation: "routine_reload",
        outcome,
        durationMs: performance.now() - startedAt,
      })
    }
  }, [])

  const pending = view.pendingProposal
  const isInitial = Boolean(pending && !view.activeVersion)
  const seed = editorSeed(view)
  const canEdit = enabled && Boolean(seed)

  React.useEffect(() => {
    routineAnalytics.track("personal_plan_stage4_routine_viewed", {
      surface: "routine_page",
      variant: initialAnalyticsVariant.current,
    })
  }, [])

  React.useEffect(() => {
    if (!enabled) {
      setEntrySyncPending(false)
      return
    }
    if (syncedOnEntry.current) return
    syncedOnEntry.current = true
    setEntrySyncPending(true)
    void (async () => {
      const startedAt = performance.now()
      let outcome = "error"
      try {
        const response = await fetch("/api/personal-plan/routine/sync", { method: "POST" })
        if (!response.ok) throw new Error(await readError(response, "temporarily_unavailable"))
        const result = (await response.json()) as { proposalStaged?: unknown }
        if (result.proposalStaged === true) {
          const next = await reload()
          setProposalOpen(Boolean(next.pendingProposal))
        }
        outcome = result.proposalStaged === true ? "proposal_staged" : "unchanged"
      } catch {
        routineAnalytics.track("personal_plan_stage4_outcome", {
          origin: "sync",
          outcome: "error",
        })
      } finally {
        reportPersonalPlanTransitionTiming({
          layer: "client",
          operation: "routine_entry_sync",
          outcome,
          durationMs: performance.now() - startedAt,
        })
        setEntrySyncPending(false)
      }
    })()
  }, [enabled, reload])

  React.useEffect(() => {
    if (!proposalOpen || !pending || displayedProposalId.current === pending.id) return
    displayedProposalId.current = pending.id
    routineAnalytics.track("personal_plan_stage4_proposal_interacted", {
      interaction: "displayed",
      origin: "routine_page",
      changeCountBand: countBand(pending.delta.direct.length + pending.delta.consequential.length),
    })
  }, [pending, proposalOpen])

  const openEditor = React.useCallback(() => {
    if (!canEdit) return
    setError(null)
    setMode("editor")
    routineAnalytics.track("personal_plan_stage4_editor_interacted", {
      interaction: "opened",
      origin: "routine_page",
    })
  }, [canEdit])

  const submitOperations = React.useCallback(
    async (operations: RoutineEditOperation[]) => {
      setBusy(true)
      setError(null)
      routineAnalytics.track("personal_plan_stage4_editor_interacted", {
        interaction: "submitted",
        origin: "routine_page",
        changeCountBand: countBand(operations.length),
      })
      try {
        const response = await fetch("/api/personal-plan/routine/proposals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedRevision: view.planRevision,
            expectedSourceRevision: view.sourceRevision,
            operations,
          }),
        })
        if (!response.ok) {
          const code = await readError(response, "temporarily_unavailable")
          throw new Error(friendlyError(code, "Änderungen konnten nicht geprüft werden."))
        }
        const next = await reload()
        setMode("overview")
        setProposalOpen(Boolean(next.pendingProposal))
        if (!next.pendingProposal) {
          routineAnalytics.track("personal_plan_stage4_outcome", {
            origin: "editor",
            outcome: "no_change",
          })
        }
      } catch (submissionError) {
        setError(
          submissionError instanceof Error
            ? submissionError.message
            : "Änderungen konnten nicht geprüft werden.",
        )
        try {
          await reload()
        } catch {
          // The retained local operation batch remains retryable after a stale conflict.
        }
      } finally {
        setBusy(false)
      }
    },
    [reload, view.planRevision, view.sourceRevision],
  )

  const resolveProposal = React.useCallback(
    async (action: "accept" | "reject") => {
      if (!pending || busy || entrySyncPending || proposalResolutionInFlight.current) return
      proposalResolutionInFlight.current = true
      const attemptedProposalId = pending.id
      const retryMessage = "Deine Entscheidung konnte nicht gespeichert werden."
      const reconcileReload = (next: PersonalPlanRoutineView, message: string | null) => {
        const classification = classifyProposalReload(next, attemptedProposalId)
        if (classification === "resolved") {
          setProposalRetryId(null)
          setError(null)
          setProposalOpen(false)
          routineAnalytics.track("personal_plan_stage4_proposal_interacted", {
            interaction: action === "accept" ? "accepted" : "rejected",
            origin: "routine_page",
            changeCountBand: countBand(
              pending.delta.direct.length + pending.delta.consequential.length,
            ),
          })
          refreshRouteAfterInitialRoutineAcceptance({
            action,
            wasInitial: !view.activeVersion,
            refresh: () => router.refresh(),
          })
          return
        }

        const currentProposalId = next.pendingProposal?.id ?? attemptedProposalId
        setProposalRetryId(currentProposalId)
        setProposalOpen(true)
        setError(
          classification === "superseded"
            ? "Deine Routine hat sich inzwischen geändert. Prüfe den aktuellen Vorschlag."
            : (message ?? retryMessage),
        )
      }

      setBusy(true)
      setError(null)
      setProposalRetryId(null)
      try {
        const response = await fetch(`/api/personal-plan/routine/proposals/${pending.id}/resolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, expectedRevision: view.planRevision }),
        })
        if (!response.ok) {
          const code = await readError(response, "temporarily_unavailable")
          throw new Error(
            friendlyError(code, "Deine Entscheidung konnte nicht gespeichert werden."),
          )
        }
        const next = await reload()
        reconcileReload(next, null)
      } catch (resolveError) {
        const message =
          resolveError instanceof Error &&
          [
            "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.",
            "Deine Routine hat sich inzwischen geändert. Wir haben den aktuellen Stand neu geladen.",
          ].includes(resolveError.message)
            ? resolveError.message
            : retryMessage
        try {
          const next = await reload()
          reconcileReload(next, message)
        } catch {
          setError(message)
          setProposalRetryId(attemptedProposalId)
          setProposalOpen(true)
        }
      } finally {
        proposalResolutionInFlight.current = false
        setBusy(false)
      }
    },
    [busy, entrySyncPending, pending, reload, router, view.activeVersion, view.planRevision],
  )

  const openDetail = React.useCallback(async (item: RoutinePayloadV1["items"][number]) => {
    setError(null)
    try {
      const response = await fetch(
        `/api/personal-plan/routine/items/${encodeURIComponent(item.itemKey)}`,
        { cache: "no-store" },
      )
      if (!response.ok) throw new Error(await readError(response, "Produktdetail nicht verfügbar."))
      setDetail((await response.json()) as RoutineProductDetailData)
      setDetailOpen(true)
      routineAnalytics.track("personal_plan_stage4_item_interacted", {
        interaction: "product_detail_opened",
        surface: "routine_card",
      })
    } catch {
      setError("Das Produktdetail konnte gerade nicht geladen werden.")
    }
  }, [])

  const markPurchased = React.useCallback(
    async (item: RoutinePayloadV1["items"][number]) => {
      setBusy(true)
      setError(null)
      try {
        const response = await fetch(
          `/api/personal-plan/routine/planned-items/${encodeURIComponent(item.itemKey)}/acquire`,
          { method: "POST" },
        )
        if (!response.ok) throw new Error(await readError(response, "temporarily_unavailable"))
        const result = (await response.json()) as { proposalStaged?: unknown; needsRetry?: unknown }
        routineAnalytics.track("personal_plan_stage4_item_interacted", {
          interaction: "acquisition_declared",
          surface: "routine_detail",
        })
        const next = await reload()
        setDetailOpen(false)
        setProposalOpen(result.proposalStaged === true || Boolean(next.pendingProposal))
        if (result.needsRetry === true) {
          setError(
            "Der Kauf ist gespeichert. Der neue Routine-Vorschlag wird noch einmal vorbereitet.",
          )
        }
      } catch {
        setError("Der Kaufstatus konnte gerade nicht gespeichert werden.")
      } finally {
        setBusy(false)
      }
    },
    [reload],
  )

  if (mode === "editor" && seed) {
    return (
      <RoutineEditor
        routine={seed}
        productOptions={frozenProductOptions(seed)}
        supportedCadences={[...PRODUCT_FREQUENCIES]}
        supportedRolesByCategory={Object.fromEntries(
          Object.entries(CATEGORY_ROLE_POLICIES).map(([category, policy]) => [
            category,
            [...policy.allowedRoles],
          ]),
        )}
        isSubmitting={busy}
        retryMessage={error}
        onCancel={() => setMode("overview")}
        onSubmitOperations={submitOperations}
      />
    )
  }

  if (!seed) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8">
        <section aria-live="polite" className="space-y-3 rounded-[8px] border border-border p-5">
          <h1 className="text-xl font-semibold">Deine Routine wird vorbereitet</h1>
          <p className="text-sm text-muted-foreground">
            Dein persönlicher Plan ist vorhanden, aber noch keine Routine kann sicher angezeigt
            werden. Bitte kehre später zurück.
          </p>
          <Button type="button" variant="outline" onClick={() => void reload()}>
            Erneut laden
          </Button>
        </section>
      </main>
    )
  }

  return (
    <>
      {error ? (
        <p
          className="mx-auto mt-4 w-full max-w-2xl rounded-[8px] border border-destructive/40 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <RoutinePage
        view={view}
        stage5Reachable={stage5Reachable}
        onEdit={canEdit ? openEditor : undefined}
        onConfirm={
          isInitial && enabled && !entrySyncPending ? () => setProposalOpen(true) : undefined
        }
        onItemDetail={(item) => void openDetail(item)}
      />
      {pending ? (
        <RoutineProposalSheet
          open={proposalOpen}
          onOpenChange={(open) => {
            setProposalOpen(open)
            if (!open) {
              routineAnalytics.track("personal_plan_stage4_proposal_interacted", {
                interaction: "dismissed",
                origin: "routine_page",
                changeCountBand: countBand(
                  pending.delta.direct.length + pending.delta.consequential.length,
                ),
              })
            }
          }}
          variant={isInitial ? "initial" : "successor"}
          directChanges={routineProposalDeltaEntries(
            pending.delta.direct,
            view.activeVersion?.payload ?? null,
            pending.candidate,
          )}
          consequentialChanges={routineProposalDeltaEntries(
            pending.delta.consequential,
            view.activeVersion?.payload ?? null,
            pending.candidate,
          )}
          unchangedItemCount={pending.delta.unchangedItemCount}
          submitting={busy}
          preparing={entrySyncPending}
          retrying={proposalRetryId === pending.id}
          errorMessage={error}
          onAccept={() => void resolveProposal("accept")}
          onBackToEditor={canEdit ? openEditor : undefined}
          onDiscardCandidate={isInitial ? undefined : () => void resolveProposal("reject")}
          onDismissForVisit={() => setProposalOpen(false)}
        />
      ) : null}
      <BottomSheet open={detailOpen} onOpenChange={setDetailOpen}>
        <BottomSheetContent>
          <BottomSheetTitle>Produktdetail</BottomSheetTitle>
          <BottomSheetDescription>
            Eignung aus deiner bestätigten Routine und aktuelle Shopdaten.
          </BottomSheetDescription>
          {detail ? (
            <RoutineProductDetail
              item={detail.item}
              commerce={detail.commerce}
              fitStatusLabel={detail.fitStatusLabel}
              frozenFitSummary={detail.frozenFitSummary}
              limitationLabel={detail.limitationLabel}
              onOpenProduct={
                detail.commerce.productUrl
                  ? () => {
                      window.open(detail.commerce.productUrl!, "_blank", "noopener,noreferrer")
                      routineAnalytics.track("personal_plan_stage4_item_interacted", {
                        interaction: "shop_link_opened",
                        surface: "routine_detail",
                      })
                    }
                  : undefined
              }
              onMarkPurchased={enabled && !busy ? (item) => void markPurchased(item) : undefined}
            />
          ) : null}
        </BottomSheetContent>
      </BottomSheet>
    </>
  )
}
