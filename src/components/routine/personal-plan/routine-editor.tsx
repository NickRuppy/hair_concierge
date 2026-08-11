"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import type { RoutinePayloadV1 } from "@/lib/personal-plan/routine/contracts"
import type {
  RoutineEditOperation,
  RoutineProductRef,
} from "@/lib/personal-plan/routine-candidate-compiler"
import { cn } from "@/lib/utils"
import { PRODUCT_FREQUENCY_LABELS } from "@/lib/vocabulary/frequencies"

type RoutineItem = RoutinePayloadV1["items"][number]

export type RoutineProductOption = {
  label: string
  helperText?: string
  productRef: RoutineProductRef
}

export type RoutineEditorProps = {
  routine: RoutinePayloadV1
  productOptions: Record<string, RoutineProductOption[]>
  supportedCadences: string[]
  supportedRolesByCategory: Record<string, string[]>
  isSubmitting?: boolean
  retryMessage?: string | null
  submitLabel?: string
  onCancel?: () => void
  onSubmitOperations: (operations: RoutineEditOperation[]) => void | Promise<void>
}

const sectionLabels: Record<"basis" | "optional", string> = {
  basis: "Deine Basis",
  optional: "Optional",
}

const purposeLabels: Record<string, string> = {
  shampoo_everyday: "Regelmäßige Reinigung",
  shampoo_dandruff: "Schuppenpflege",
  conditioner_rinse_out: "Pflege nach der Reinigung",
  post_wash_leave_in: "Pflege ohne Ausspülen",
  pre_heat_application: "Pflege vor dem Hitzestyling",
  intensive_conditioning_mask: "Intensivpflege",
  pre_wash_fibre_treatment: "Pflege vor der Haarwäsche",
  leave_on_fibre_conditioning: "Pflege ohne Ausspülen",
  dry_finish: "Finish",
  residue_reset: "Tiefenreinigung",
  mineral_reset: "Mineralablagerungen entfernen",
  root_refresh_bridge: "Ansatz auffrischen",
  pre_heat_protection: "Hitzeschutz",
  specialized_bond_treatment: "Strukturpflege",
  scalp_comfort: "Kopfhaut beruhigen",
  scalp_flake_oil_adjunct: "Kopfhautöl als Ergänzung",
  density_claim_tonic: "Kopfhaut-Tonic",
  scalp_exfoliant: "Kopfhaut-Peeling",
}

const categoryLabels: Record<string, string> = {
  shampoo: "Shampoo",
  conditioner: "Conditioner",
  mask: "Maske",
  oil: "Öl",
  leave_in: "Leave-in",
  heat_protectant: "Hitzeschutz",
  scalp_care: "Kopfhautpflege",
  dry_shampoo: "Trockenshampoo",
  bondbuilder: "Bondbuilder",
  deep_cleansing_shampoo: "Tiefenreinigendes Shampoo",
}

const cadenceLabels: Record<string, string> = {
  "personal_plan.cadence.none": "Nach Bedarf",
  ...PRODUCT_FREQUENCY_LABELS,
}

function labelFor(labels: Record<string, string>, value: string) {
  return labels[value] ?? value.replaceAll("_", " ")
}

function productName(item: RoutineItem) {
  const name = item.product.displayName
  return typeof name === "string" && name.length > 0 ? name : "Noch nicht abgedeckt"
}

function productOptionValue(ref: RoutineProductRef) {
  if (ref.kind === "owned") return `owned:${ref.capturedProductId}:${ref.productId}`
  if (ref.kind === "planned") return `planned:${ref.plannedPurchaseId}:${ref.productId ?? "none"}`
  if (ref.kind === "pending_review") {
    return `pending_review:${ref.capturedProductId}:${ref.submissionId}`
  }
  return "none"
}

function itemMap(routine: RoutinePayloadV1) {
  return new Map(routine.items.map((item) => [item.itemKey, item]))
}

function sectionItems(routine: RoutinePayloadV1, key: "basis" | "optional") {
  const items = itemMap(routine)
  const listed =
    routine.sections
      .find((section) => section.key === key)
      ?.itemKeys.map((itemKey) => items.get(itemKey))
      .filter((item): item is RoutineItem => Boolean(item)) ?? []
  if (key === "basis") return listed

  const listedKeys = new Set(listed.map((item) => item.itemKey))
  return listed.concat(
    routine.items.filter(
      (item) => item.state.systemAssessment === "not_recommended" && !listedKeys.has(item.itemKey),
    ),
  )
}

function replaceOperation(
  operations: RoutineEditOperation[],
  next: RoutineEditOperation,
): RoutineEditOperation[] {
  const target = operationTarget(next)
  return operations.filter((operation) => operationTarget(operation) !== target).concat(next)
}

function operationTarget(operation: RoutineEditOperation) {
  if (operation.kind === "category_inclusion") return `category:${operation.category}`
  return `${operation.kind}:${operation.assignmentKey}`
}

function currentInclusion(item: RoutineItem, operations: RoutineEditOperation[]) {
  const operation = operations.find(
    (entry): entry is Extract<RoutineEditOperation, { kind: "category_inclusion" }> =>
      entry.kind === "category_inclusion" && entry.category === item.category,
  )
  return operation?.inclusion ?? item.state.inclusion
}

function currentRole(item: RoutineItem, operations: RoutineEditOperation[]) {
  const operation = operations.find(
    (entry): entry is Extract<RoutineEditOperation, { kind: "assignment_role" }> =>
      entry.kind === "assignment_role" && entry.assignmentKey === item.assignmentKey,
  )
  return operation?.role ?? item.role
}

function currentCadence(item: RoutineItem, operations: RoutineEditOperation[]): string {
  const operation = operations.find(
    (entry) => entry.kind === "cadence_override" && entry.assignmentKey === item.assignmentKey,
  )
  // The select controls only an explicit user override. The frozen display key
  // describes the recommendation, but is not necessarily a supported override
  // value and therefore must never be used as the select's value.
  if (operation?.kind === "cadence_override") return operation.cadenceOverride ?? ""
  return typeof item.cadence.userOverride === "string" ? item.cadence.userOverride : ""
}

function validationMessages(input: {
  item: RoutineItem
  options: RoutineProductOption[]
  roles: string[]
  cadences: string[]
}) {
  const messages: string[] = []
  if (input.roles.length === 0) {
    messages.push("Keine gültige Rolle für diese Kategorie verfügbar.")
  }
  if (input.cadences.length === 0) {
    messages.push("Kein unterstützter Rhythmus verfügbar.")
  }
  if (input.item.product.kind === "none" && input.options.length === 0) {
    messages.push("Für diese Lücke wurde noch keine sichere Produktoption übergeben.")
  }
  return messages
}

export function RoutineEditor({
  routine,
  productOptions,
  supportedCadences,
  supportedRolesByCategory,
  isSubmitting = false,
  retryMessage,
  submitLabel = "Änderungen prüfen",
  onCancel,
  onSubmitOperations,
}: RoutineEditorProps) {
  const [operations, setOperations] = React.useState<RoutineEditOperation[]>([])
  const [confirmDiscard, setConfirmDiscard] = React.useState(false)
  const dirty = operations.length > 0

  const updateOperation = React.useCallback((operation: RoutineEditOperation) => {
    setOperations((current) => replaceOperation(current, operation))
  }, [])

  const handleCancel = React.useCallback(() => {
    if (dirty) {
      setConfirmDiscard(true)
      return
    }
    onCancel?.()
  }, [dirty, onCancel])

  const discard = React.useCallback(() => {
    setOperations([])
    setConfirmDiscard(false)
    onCancel?.()
  }, [onCancel])

  return (
    <section
      aria-label="Routine bearbeiten"
      className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6"
    >
      <header className="space-y-2">
        <p className="text-sm font-semibold text-primary">Routine bearbeiten</p>
        <h2 className="text-2xl font-semibold tracking-tight">Eine Änderung, ganze Routine</h2>
        <p className="text-sm text-muted-foreground">
          Aktive Routine bleibt unverändert, bis du den neu berechneten Vorschlag bestätigst.
        </p>
      </header>

      {retryMessage ? (
        <p className="rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {retryMessage} Deine lokalen Änderungen bleiben für einen erneuten Versuch erhalten.
        </p>
      ) : null}

      {(["basis", "optional"] as const).map((sectionKey) => {
        const items = sectionItems(routine, sectionKey)
        if (items.length === 0) return null
        return (
          <section key={sectionKey} className="space-y-3" aria-labelledby={`${sectionKey}-editor`}>
            <h3 id={`${sectionKey}-editor`} className="text-lg font-semibold">
              {sectionLabels[sectionKey]}
            </h3>
            <div className="space-y-3">
              {items.map((item) => {
                const options = productOptions[item.assignmentKey] ?? []
                const roles = supportedRolesByCategory[item.category] ?? []
                const messages = validationMessages({
                  item,
                  options,
                  roles,
                  cadences: supportedCadences,
                })
                const selectedProduct =
                  operations.find(
                    (
                      operation,
                    ): operation is Extract<RoutineEditOperation, { kind: "assignment_replace" }> =>
                      operation.kind === "assignment_replace" &&
                      operation.assignmentKey === item.assignmentKey,
                  )?.productRef ?? null

                return (
                  <article
                    key={item.itemKey}
                    className="space-y-4 rounded-[8px] border border-border bg-card p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          {labelFor(categoryLabels, item.category)}
                        </p>
                        <h4 className="text-base font-semibold">
                          {labelFor(purposeLabels, item.purposeKey)}
                        </h4>
                        <p className="text-sm text-muted-foreground">{productName(item)}</p>
                      </div>
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={currentInclusion(item, operations) === "included"}
                          onChange={(event) =>
                            updateOperation({
                              kind: "category_inclusion",
                              category: item.category as never,
                              inclusion: event.target.checked ? "included" : "excluded",
                            })
                          }
                        />
                        Kategorie einplanen
                      </label>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="space-y-1 text-sm">
                        <span className="font-medium">Produkt</span>
                        <select
                          className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={selectedProduct ? productOptionValue(selectedProduct) : ""}
                          onChange={(event) => {
                            const option = options.find(
                              (entry) =>
                                productOptionValue(entry.productRef) === event.target.value,
                            )
                            if (!option) return
                            updateOperation({
                              kind: "assignment_replace",
                              assignmentKey: item.assignmentKey,
                              productRef: option.productRef,
                            })
                          }}
                        >
                          <option value="">Aktuelles Produkt behalten</option>
                          {options.map((option) => (
                            <option
                              key={productOptionValue(option.productRef)}
                              value={productOptionValue(option.productRef)}
                            >
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="font-medium">Rolle</span>
                        <select
                          className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={currentRole(item, operations)}
                          onChange={(event) =>
                            updateOperation({
                              kind: "assignment_role",
                              assignmentKey: item.assignmentKey,
                              role: event.target.value as never,
                            })
                          }
                          disabled={roles.length === 0}
                        >
                          {roles.map((role) => (
                            <option key={role} value={role}>
                              {labelFor(purposeLabels, role)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="font-medium">Rhythmus</span>
                        <select
                          className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={currentCadence(item, operations)}
                          onChange={(event) =>
                            updateOperation({
                              kind: "cadence_override",
                              assignmentKey: item.assignmentKey,
                              cadenceOverride: event.target.value || null,
                            })
                          }
                          disabled={supportedCadences.length === 0}
                        >
                          <option value="">Keine Abweichung – Empfehlung verwenden</option>
                          {supportedCadences.map((cadence) => (
                            <option key={cadence} value={cadence}>
                              {labelFor(cadenceLabels, cadence)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    {messages.length > 0 ? (
                      <ul className="space-y-1 text-sm text-destructive" aria-live="polite">
                        {messages.map((message) => (
                          <li key={message}>{message}</li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                )
              })}
            </div>
          </section>
        )
      })}

      <footer className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={handleCancel}>
          Abbrechen
        </Button>
        <Button
          className="sm:w-auto"
          type="button"
          variant="funnelCta"
          disabled={!dirty || isSubmitting}
          onClick={() => onSubmitOperations([...operations])}
        >
          {isSubmitting ? "Wird geprüft ..." : submitLabel}
        </Button>
      </footer>

      {confirmDiscard ? (
        <div
          aria-labelledby="routine-discard-title"
          aria-modal="true"
          className="rounded-[8px] border border-border bg-background p-4 shadow"
          role="alertdialog"
        >
          <h3 id="routine-discard-title" className="text-base font-semibold">
            Lokale Änderungen verwerfen?
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Deine aktive Routine bleibt unverändert. Deine unbearbeitete Änderungsliste wird
            gelöscht.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setConfirmDiscard(false)}>
              Zurück
            </Button>
            <Button type="button" variant="destructive" onClick={discard}>
              Verwerfen
            </Button>
          </div>
        </div>
      ) : null}

      <p className={cn("text-xs text-muted-foreground", !dirty && "sr-only")} aria-live="polite">
        {operations.length} lokale Änderung{operations.length === 1 ? "" : "en"} in Prüfung
        vorbereitet.
      </p>
    </section>
  )
}
